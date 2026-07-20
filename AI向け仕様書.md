# ビジネスダイアグラムメーカー — AI向け仕様書

このドキュメントは、**AI（コーディングアシスタント）に本アプリの仕様を素早く正確に理解させる**ことを目的とした説明書です。実装ファイル（`diagram_v8.05.html`）を全文読まなくても、アーキテクチャ・データモデル・主要関数・拡張時の注意点を把握できるように構成しています。

- 対象実装: `diagram_v8.05.html`（最新版。運用は「最新版を直接更新」）
- 併読推奨: `CLAUDE.md`（プロジェクト指示）／`運用ルール.txt`（バージョニング）／`開発ロードマップ.txt`（計画）／`開発記録_v8.txt`（why・経緯）
- 本ファイルはコードの「what/how の索引」。**why・バグ経緯は `開発記録*.txt` が正**。仕様変更時は本ファイルも追随更新すること。

---

## 1. アプリ概要

- **単一 HTML ファイル完結**のビジネス図エディタ。ビルド・サーバー・外部CDN不要。ブラウザで開くだけで動作する。
- 依存ライブラリ（ExcelJS＝Excel出力用）も**実行時フェッチせずインライン同梱**（`<script id="exceljs-lib">`）。オフライン完結が設計の絶対条件。
- **コアエンジン共通化**が設計思想。ノード配置・接続線ルーティング・保存/復元・エクスポートを全図種で共用し、図種ごとに「パレット・レーン有無・描画」だけを切り替える。
- 保存ファイル自体が**自己完結HTML**（アプリ＋状態を1ファイルに埋め込み）。開けば編集を再開できる。

### 対応図種（10種）
`swimlane`（スイムレーン図）／`flowchart`（フローチャート）／`bpmn`（プロセスフロー BPMN）／`statechart`（状態遷移図）／`er`（ER図）／`orgchart`（樹状図。旧「組織図」。**内部キーは後方互換のため `orgchart` 固定**）／`sequence`（シーケンス図）／`gantt`（ガントチャート／工程表）／`mindmap`（マインドマップ）／`uml`（UMLクラス図）。

---

## 2. 技術構成・制約

| 項目 | 内容 |
|---|---|
| 言語 | 素の HTML + CSS + Vanilla JavaScript（フレームワーク・ビルドツール一切なし） |
| 描画 | SVG（`<svg id="diagram-svg">` に全図形を描画。DOM直接操作） |
| 状態 | 単一グローバルオブジェクト `S`（後述）。DOMは`render()`で状態から毎回再生成 |
| 依存 | ExcelJS（MIT・インライン同梱）。それ以外の外部依存なし |
| 座標 | SVGユーザー座標系。ズームは `transform: scale()` で表現 |
| 永続化 | 保存＝自己完結HTMLダウンロード。復元＝そのHTMLを読み込み `window.__SWIMLANE_STATE__` を復元 |

**絶対に守る制約**: ①単一HTML完結を崩さない（外部リクエスト追加禁止）、②既存図種の後方互換維持（保存済みファイルが開けること）、③コアエンジン改修は最小限に。

---

## 3. ファイル内の区画マップ（`diagram_v8.05.html`・全10166行）

| 行 | 区画 | 内容 |
|---|---|---|
| 3–6 | `<head>` | メタ情報 |
| 7–236 | `<style>` | 全CSS（UIツールバー・サイドバー・モーダル・SVG要素スタイル） |
| 238–285 | ExcelJS | インライン同梱ライブラリ（`<script id="exceljs-lib">`・**ミニファイ済み1行が長大**。読む必要はほぼ無い） |
| 286–738 | `<body>` UI | ツールバー・サイドバー・SVGキャンバス・各種モーダルのHTML骨格 |
| 739–10164 | メインJS | アプリ本体（約9400行）。以降の全ロジック |
| 10165– end | 終了タグ | |

> 注意: このHTMLには**極端に長い行（ミニファイ済みブロック）**が含まれる。`Read` で全文読むとトークン超過する。`awk 'NR>=A && NR<=B && length($0)<400'` 等で範囲＋行長を絞って読むこと。

### メインJSの主なセクション順（739行〜）
定数・図種定義（`DIAGRAM_TYPES`/`SD`/`STYLES`/`STEP_THEMES`）→ グローバル状態 `S` → ジオメトリ/レーン ヘルパ → ノード/エッジ操作 → 履歴 → 接続線ルーティング（A*）→ 図種別ロジック（ガント・マインドマップ・シーケンス・樹状図・UML）→ 描画パイプライン（`render()` 系）→ 入力ハンドラ（マウス/キー）→ 保存/エクスポート/インポート。

---

## 4. グローバル状態モデル `S`

すべての編集状態は単一オブジェクト `S` に集約（739行台で `let S={...}`）。

```js
let S = {
  diagramType:'swimlane',  // 現在の図種キー（DIAGRAM_TYPES のキー）
  orientation:'vertical',  // 'vertical' | 'horizontal'（縦横。図種により固定/非表示あり）
  lanes:[],   // レーン配列（useLanes 図種のみ）。{id,name,bg,hd,w}
  nodes:[],   // シェイプ配列（下記データモデル）
  edges:[],   // 接続線配列（下記データモデル）
  sel:[],     // 選択中ノードidの配列（複数選択対応）
  mode:'select',  // 'select' | 'connect' | パレット配置中はパレット由来のモード
  conn:null,  // 接続作成中の始点情報
  drag:null,  // ドラッグ中の一時状態
  hist:[], hi:-1,  // Undo/Redo履歴（JSON文字列スタック・最大80）
  uid:0,      // id採番カウンタ（uid()が'e'+(++S.uid)を返す）
  gantt:defaultGantt(),   // ガント時間軸・見出し欄・凡例モデル
  mindLayout:'radial',    // マインドマップのレイアウト 'radial' | 'tree'
  gridOn:true,   // 方眼グリッド表示
  style:'standard',  // デザインテンプレート（STYLES のキー）
  stepNums:false     // ステップ番号バッジ表示
};
```

補足: 図面名は別変数 `S_diagramName`。保存時にHTMLの `<title>` にも反映される。

---

## 5. データモデル

### ノード（`S.nodes[]` の要素）
```js
{
  id, type,          // type は SD/DIAGRAM_TYPES.palette のキー
  x, y, w, h,        // 左上座標とサイズ（SVGユーザー座標）
  text,              // 主ラベル
  lid,               // 所属レーンid（レーン無し図種は VIRTUAL_LANE.id='__virtual__'）
  // 以下はオプショナル（機能ごとに付与・後方互換のため未定義でも動く）
  color, stroke,     // 個別色（未指定は SD のデフォルト）
  variant,           // シェイプの変種
  note,              // note/state_detail の補足本文（量に応じ自動リサイズ）
  sections,          // ER/UML/組織ノードの区画（複数行の内部テーブル）
  textAlign,         // 'left'|'center'|'right'
  groupId,           // グループ化（swimlane/flowchart/bpmn 等のみ）
  flowId, flowKind,  // ステップ図（番号サークル/ピル/矢羽）の列管理
  // 図種固有:
  row, phaseId,      // gantt: 行番号・所属フェーズ
  parentId, collapsed, importance, // mindmap 系（※親子は主にエッジで表現。下記参照）
  lifelineId,        // sequence: activation が属する lifeline
  mainPos,           // crosslane の主軸固定位置
  busPos,            // 樹状図/組織図のバス型接続線の分岐位置(0.08〜0.92)
}
```

### エッジ（`S.edges[]` の要素）
```js
{
  id, from, to,      // 接続元/先ノードid
  label, fromLabel, toLabel,  // 中央/端点ラベル
  fromLid, toLid,    // 端点のレーン参照
  // オプショナル:
  labelDX, labelDY,  // ラベルの手動オフセット
  msgType, msgY,     // sequence: 同期/非同期・メッセージのY位置
  depType,           // gantt: 依存タイプ
  umlType,           // uml: 関連の種類（継承/実装/集約/コンポジション等でマーカー切替）
  waypoints,         // 手動経由点（区間スライド編集の結果）
}
```

### レーン（`S.lanes[]`）
`{id, name, bg（背景色）, hd（見出し色）, w（幅＝縦モードでは横幅・横モードでは高さ）}`。色プリセットは定数 `LC`。レーン無し図種は `VIRTUAL_LANE` を用いる。

### ガントモデル（`S.gantt`）
`defaultGantt()` が生成。時間軸（`startDate`/`endDate`/`scale='day'|'week'|'month'`/`colWidth`）、左情報欄の列幅（`nameW`/`descW`/`assigneeW`）、見出し欄 `header`（工事名・自由な「ラベル：値」行・作成日・承認欄）、凡例 `legend` を持つ。工程表用途に対応する汎用カラムモデル。

---

## 6. 図種定義 `DIAGRAM_TYPES`（766行〜）

各図種の「振る舞いの差」を宣言的に持つテーブル。新図種追加や図種特性の理解はまずここを見る。

```js
DIAGRAM_TYPES[key] = {
  name,             // 表示名（日本語）
  useLanes,         // レーンを使うか（true/false）
  defaultLanes,     // 初期レーン数
  palette:[...],    // 左パレットに並ぶシェイプtypeの配列
  palLabels:{...},  // パレットの表示ラベル
  shapeTexts:{...}, // 配置時の初期テキスト
  noArrow,          // 接続線に矢印を付けない（orgchart/mindmap）
  fixedOrientation, // 縦横固定（gantt='horizontal'）
}
```

- シェイプ既定サイズ・色は別テーブル `SD`（854行〜）。`SD[type] = {w,h,text,fill,stroke}`。
- `useLanes()` / `getDT()` / `usesLanes()` 等のヘルパで図種特性を参照する。
- 図種切替は `selectDiagramType(type)`（**全リセットして切替**・確認あり）→ `applyDiagramType()` がUI表示（ツールバーのガント/マインド/UML専用ツール群など）を切り替える。

---

## 7. 座標系・縦横・レーン

- **縦横（orientation）**: `isV()`＝縦モード判定。多くのロジックが「主軸（フローの進む向き）」と「交差軸（レーンをまたぐ向き）」で書かれる。`isV()`のとき主軸=Y・交差軸=X。
- `tV()` / `textUpright()`: 組織図（樹状図）は横向きでも箱・文字を回転させない例外。
- レーン: `laneAt(pos)`（座標→レーン）、`laneX(id)`（レーン左端）、`headerSize()`（レーン見出し帯の厚み）。
- **フリーシェイプ**（`isFreeShape(type)`）: レーンに束縛されず自由配置できるtype（グループ枠など）。
- 自由図種（レーン無し）では全ノードが `VIRTUAL_LANE` 所属になる。

---

## 8. コア機能と主要関数

### 配置・選択・移動
- `addNode(type,sx,sy,opts)`: シェイプ配置の中枢。レーン吸着・他シェイプへの整列スナップを行う。**v8.05以降、配置直後は選択状態にしない**（マインドマップだけは例外＝選択＝次の配置の親）。
- パレット操作: `palClick` / `palDragStart`（クリック・ドラッグ配置）、`placeShape` / `place`。
- 選択: 単一/複数（Ctrl・Shift＋クリック）。`selectAll()`（Ctrl+A）、`selWithGroup()`（グループ単位選択）。
- 移動: ドラッグ、`nudgeSel(dx,dy)`（矢印キー微移動）。Shiftドラッグ＝水平/垂直固定、Ctrl+Shiftドラッグ＝固定方向コピー。
- 整列スナップ: `computeAlignSnap` / `equalSpaceSnap`（等間隔）／ガイド線描画 `renderAlignGuides`。方眼グリッド吸着 `gridSnapActive()`（Altで一時解除）。
- グループ化: `groupSel` / `ungroupSel`（`groupingAllowed()`＝gantt/sequence/mindmap以外）。

### 接続線ルーティング（A* 直交配線）
本アプリの技術的核心。774行台〜の記述に集約。
- `addEdge(f,t,opts)`: エッジ生成。
- `routePath(...)` → `orthoRoute(...)`: **A*直交ルーティング**。箱の縁を格子線にして、箱を最短で迂回する直角折れ経路を探索。ループ/逆走/箱貫通を構造的に回避。
- 障害物回避 `routeObs`、経路キャッシュ `_edgeRouteCache`（ドラッグ中の再計算削減）。
- 判断（ひし形）シェイプは頂点固定接続（`assignDiamondPorts`）。差戻し戻り線 `isReturnEdge` の整形。
- 同一出口辺を共有する複数分岐は段違いトラックに配置しクロス回避（`processFan`/`rankedSides`）。
- 手動編集: 区間スライド（`startSegDrag`/`buildOrthoManualPts`）、経由点ハンドル（`wpAddHandle`/`waypoints`）、ラベル移動。

### 履歴（Undo/Redo）
- `snap()`: `S.lanes/nodes/edges/gantt/mindLayout` をJSON化して履歴スタックに push（最大80）。**状態変更の確定時に必ず呼ぶ**。
- `restore(json)` / `undo()`（Ctrl+Z）/ `redo()`（Ctrl+Y / Ctrl+Shift+Z）。

### 自動レイアウト・その他
- `autoLayout()`（整列ボタン）、`fitView()` / `centerOnRect()`（表示調整）、`zoomIn/zoomOut/applyZoom`。
- 検索/置換パネル: `openSearch`/`searchUpdate`/`replaceAll`。
- シェイプ種変更: `replaceNodeType`（配置済みシェイプの型変換・`isReplaceableShape`）。
- 色変更: `showShapeColorMenu` / `showLaneColorMenu` / `applyColorTheme`（配色テーマ一括）。

---

## 9. 図種別の特記事項

### ガントチャート／工程表（`gantt*` 関数群・最多）
- 横固定（`fixedOrientation:'horizontal'`）。座標はドラッグではなく**日付×行から計算**（`calcGanttPositions`/`ganttDateToX`/`ganttXToDate`）。ゆえに `nudgeSel`・グループ化の対象外。
- シェイプ: `gantt_task`（バー）/`gantt_milestone`（◆）/`gantt_summary`（フェーズ＝括り）。
- フェーズ: タスクの所属フェーズ（`phaseId`）が変わると色を自動追従（`ganttSyncPhaseTaskColors`）。空フェーズ掃除 `ganttCleanupPhases`。
- 左情報欄は汎用カラムモデル（列の追加/削除/幅調整・`ganttAddColumn` 等）。見出し欄（表題部）＋承認欄（押印枠）＋凡例。
- **Excel(.xlsx)出力対応**（`expExcel`・ExcelJS使用。左情報欄の縦結合/縦書き・時間軸色バーを再現）。

### マインドマップ（`mind*` 関数群）
- 親子は**エッジで表現**（`mindChildren`/`mindParentId`/`mindDescendants`/`mindRoot`）。中心トピック `mind_root` は削除不可。
- シェイプ3種: `mind_topic`（問題）/`mind_action`（対策・矢印タグ型）/`mind_note`（補足情報・付箋型／枝色に染まらない）。
- レイアウト: `mindLayoutRadial`（放射状）/`mindLayoutTree`（樹状）。`S.mindLayout`で切替。
- 操作: ノード追加（Tab＝子`mindAddChild`／Enter＝兄弟`mindAddSibling`）、サブツリー連動移動＋ドラッグ再ペアレント（`mindReparent`/`mindDropTargetAt`）、折りたたみ（`collapsed`）、フォーカスモード、表示レベル1/2/3/全。
- メタデータ: 合意状態（合意済/未決/反対ありバッジ）・重要度（輪郭内側の二重赤線・高中低でサイズ差）・確信度・工数。属性絞り込み。すべてoptionalプロパティ＝後方互換維持。
- 凡例自動表示（`renderMindLegend`）。

### シーケンス図（`sequence`）
- `lifeline`（ライフライン）と `activation`（活性区間）。activationは lifeline に従属（`lifelineId`・削除カスケード）。
- 自己呼出・同一ペア重複エッジを許可（他図種は禁止）。同期/非同期メッセージ（`msgType`）を専用マーカーで描画（`renderSequenceEdges`）。

### 樹状図（`orgchart`＝旧組織図・`org*` 関数群）
- ノード: `org_node`（ラベル有）/`org_node_plain`（役職なし）/`org_group`（部門枠）。矢印なし（`noArrow`）。
- バス型接続線（親から子へ横バス経由・`orgBusRoutes`/`busPos`調整）。ツリー自動レイアウト（`orgTreeLayout`）、部下追加＋ボタン（`orgAddSubordinate`）、部門枠の自動フィット（`orgFitGroups`）、内部テーブル編集（`orgEditTable`）。

### UMLクラス図（`uml`）
- `uml_class`/`uml_interface`。区画（属性/操作）を `sections` で保持。関連ごとに個別マーカー（継承・実装・集約・コンポジション等＝`umlType`/`umlEdgeStyle`）。抽象/インターフェーストグル。

---

## 10. 見た目（デザインテンプレート・ステップ図）

- **デザインテンプレート `STYLES`**（899行〜）: 色は変えず**形の装飾だけ**を差し替える。standard/soft/flat/shadow/card/business/rich/accent/chevron/pill。`curStyle()`/`styRx()`/`stySW()`で参照。
- **ステップ図**（`insertStepFlow`/`flowAddStep`/`flowRemoveStep`）: 番号サークル・ピル・矢羽のレイアウトを一括挿入。`flowId`で1列を管理し、現在の縦横モードに沿って自動配置＋末尾に＋/−ボタン。
- **番号バッジ**（`S.stepNums`/`stepBadgeMap`）: プロセス系シェイプに配置順で 1,2,3… を自動採番。
- **配色テーマ `STEP_THEMES`**（vivid/warm/cool/navy）: `applyColorTheme` で対象シェイプにステップ順で循環適用。

---

## 11. 保存/復元フォーマット

### 保存（`saveHtmlCore(name)`・7998行〜）
1. 現在の `document.documentElement.outerHTML` を取得（＝アプリ本体そのもの）。
2. 状態オブジェクト `st = {diagramType,orientation,lanes,nodes,edges,uid,diagramName,gantt,mindLayout,gridOn,style,stepNums}` をJSON化。
3. 既存の状態埋め込みscriptを除去し、`</head>` の直前に `<script id="swimlane-state">window.__SWIMLANE_STATE__={...};</script>` を注入。
4. `<filename>.html` としてダウンロード（`dl()`）。→ **アプリ＋データが1ファイルに同梱された自己完結HTML**。

### 復元（`init` / `extractSavedState` / `importStateFromHtml`）
- 起動時に `window.__SWIMLANE_STATE__` があれば読み込んで `S` を復元。
- 別の保存HTMLを取り込む場合は `importFromFile`→`extractSavedState(html)`（正規表現で埋め込み状態を抽出）。
- **後方互換**: 旧キー（`swimlane-state`/`__state__`/`data-state`）も読めるよう配慮。新プロパティは未定義でも動くようにする（optional前提）。

---

## 12. エクスポート／インポート

| 機能 | 関数 | 補足 |
|---|---|---|
| PNG | `expPNG` | `buildExportSvg`で白背景＋図面名タイトル帯付きSVGを生成→ラスタライズ |
| SVG | `expSVG` | 同上（ベクター） |
| PDF | `expPDF` | 印刷（`@page`余白・内容中央配置）。ボタンは「PDF/印刷」 |
| Excel | `expExcel` | ガント/工程表専用。ExcelJSで真の.xlsx |
| Markdown | `mindToMarkdown`/`nodeMD` 系 | マインドマップ等のテキスト書き出し |
| OPML | `mindToOpml`/`generateFromOpml` | 往復（シェイプ種別も `_shape`/`SHAPE_BDM` で保持） |
| FreeMind(.mm) | `mindToFreeMind`/`generateFromFreeMind` | 往復 |

### テキスト→図（Text to Diagram）
`openText2Diagram`／`runText2Diagram`。**Mermaid** 記法（flowchart/sequence/state/ER/class/gantt）や CSV・アウトライン・OPML/.mm からの図生成をサポート（`parseMermaid*`/`generateFrom*`）。

---

## 13. 描画パイプライン `render()`（5304行〜）

状態 `S` から SVG を毎回作り直す（差分更新はしない）。

```
render():
  if gantt   → renderGantt()   （専用パス・return）
  if mindmap → renderMindmap()  （専用パス・return）
  それ以外:
    calcCanvasSize()                     // キャンバスサイズ算出
    note/state_detail/sections の自動リサイズ
    orgFitGroups()                       // 部門枠フィット
    renderLanes(); renderGrid(); renderLifelines();
    renderEdges()（seqは renderSequenceEdges）
    renderNodes(); renderDividers();
    renderEdgeReconnectHandles(); renderOrgAddButton();
    applyZoom();
```

- SVGレイヤは `<g id="g-lanes|g-grid|g-lifelines|g-guides|g-edges|g-nodes|g-dividers">` 等に分離（`<body>`のdefs付近で定義）。
- 個別シェイプ描画は `shapeEl` / `mindShapeEl` / `renderGantt*` 系。SVG要素生成は `e(tag,attrs)` ヘルパ。

---

## 14. 入力操作（マウス／キーボード）

### マウス（SVG上）
- `svgMD`（mousedown）: 配置/選択/接続開始/各種ドラッグ開始の振り分け。
- `svgDbl`（dblclick）: テキスト編集（`openSvgEditor`/`editText`/`editNote`/`editSection`）、ダブルクリック追加配置。
- 各種ドラッグ状態: ノード移動、リサイズ（`startNodeResize`）、レーンドラッグ/リサイズ、接続線区間/経由点/ラベル、バス位置、マインド再ペアレント、ガントバー。

### キーボード（`document.addEventListener('keydown'…`・7871行〜）
| キー | 動作 |
|---|---|
| Delete / Backspace | 選択削除 `delSel()` |
| Ctrl+Z | Undo ／ Ctrl+Y・Ctrl+Shift+Z | Redo |
| Ctrl+A | 全選択（貼付モード中は無効） |
| Escape | 選択/モード解除・検索/モーダル閉じ |
| 矢印キー | 選択の微移動 `nudgeSel` |
| Ctrl+C / Ctrl+V | コピー／貼付（`copySelection`/`pasteAt`/貼付モード） |

---

## 15. よく使う関数の索引（役割つき）

**判定/ヘルパ**: `isV`（縦モード）`tV`/`textUpright`（回転しない図種）`usesLanes`/`getDT`/`useLanes`（図種特性）`isFreeShape`/`isMindShape`/`isGanttShape`/`isUmlShape`/`isDiamondShape`/`isReplaceableShape`/`isResizable`／`uid`（id採番）`e`（SVG要素生成）`svgPt`（画面→SVG座標）`nc`（中心座標）`hint`（画面下部メッセージ）。

**状態変更**: `addNode`/`addEdge`/`delSel`/`nudgeSel`/`groupSel`/`ungroupSel`/`setTextAlign`/`replaceNodeType`/`snap`/`undo`/`redo`/`restore`。

**図種**: `selectDiagramType`/`applyDiagramType`/`changeDiagramType`/`buildPalette`/`palClick`。

**描画**: `render`/`renderNodes`/`renderEdges`/`renderLanes`/`renderGrid`/`renderGantt`/`renderMindmap`/`shapeEl`/`applyZoom`。

**接続**: `routePath`/`orthoRoute`/`routeObs`/`processFan`/`assignDiamondPorts`/`renderOneEdge`。

**保存/出力**: `saveHtmlCore`/`confirmSaveAs`/`buildExportSvg`/`expPNG`/`expSVG`/`expPDF`/`expExcel`/`importFromFile`/`extractSavedState`。

（全関数一覧は本体を `grep -oE 'function [a-zA-Z0-9_]+'` で取得可能。500超の関数がある。）

---

## 16. 拡張・改修時の指針

### 新しい図種を追加する手順（概略）
1. `DIAGRAM_TYPES` にキーを追加（`name`/`useLanes`/`palette`/`palLabels`/`shapeTexts`/必要なら`noArrow`/`fixedOrientation`）。
2. `SD` に新シェイプtypeの既定（`w,h,text,fill,stroke`）を追加。
3. シェイプ描画が特殊なら `shapeEl` 系に分岐を追加。専用レイアウト/描画が要るなら `render()` に `renderXxx()` の分岐を足す（ガント/マインドが前例）。
4. 図種専用ツールバーが要るなら `<body>`にUIを足し `applyDiagramType` で表示切替。
5. 保存対象プロパティが増えるなら `saveHtmlCore` の `st` と `snap()`/`restore()` に含める（**後方互換のため未定義許容**）。

### 後方互換の鉄則
- 既存プロパティの意味を変えない。新機能は**optionalプロパティ**で足し、未定義時にデフォルト動作する分岐を書く。
- `orgchart` のように**内部キーは改名しない**（表示名だけ変える）。
- 保存フォーマットの読み取りは旧キーもフォールバックする。

### コードスタイル
- 周囲のコードに合わせる（1行密度が高い・日本語コメントで版番号と意図を記す＝例 `// v8.05: …`）。
- 状態変更後は `snap()`→`render()` を忘れない。

---

## 17. 運用ルール（要約・詳細は `運用ルール.txt`/`CLAUDE.md`）

- **1セッション＝1バージョン＝1PR。** バグ修正以外の変更をしたらバージョンを1つだけ上げ、同一feature ブランチにまとめる。
- **バグ修正のみは版番据置の「追補」**＝新ファイルを作らず最新版HTMLを直接更新。
- **`main`へ直接pushしない。** feature ブランチ → PR → マージで**バージョン単位のマージ履歴**を残すことがGit運用の主目的。
- **PRはユーザーの明示指示があるまで作らない。**
- 版を上げたら `CLAUDE.md` の「現行ステータス」欄と `開発ロードマップ.txt` を更新。why/経緯があれば `開発記録_v8.txt`（アクティブ）へ。
- コミットメッセージに what（何を変えたか）を具体的に書く。why は開発記録に。

---

## 付録: AIが調査を始めるときの初手

1. 本ファイル（AI向け仕様書）→ `CLAUDE.md` の現行ステータスを読む。
2. 図種特性は `DIAGRAM_TYPES`（766行〜）、シェイプ既定は `SD`（854行〜）。
3. 状態は `S`（739行台）、データモデルは本書§5。
4. 特定機能は §15/§9 の関数名で `grep -nE 'function 名前' diagram_v8.05.html` して該当箇所へ。
5. 全文読み込みはトークン超過に注意（§3）。範囲＋行長フィルタで読む。
