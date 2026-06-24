const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  ImageRun, Header, Footer, AlignmentType, LevelFormat,
  HeadingLevel, BorderStyle, WidthType, ShadingType, PageBreak,
  PageNumber, VerticalAlign, TableOfContents
} = require('C:/Users/h.keduka/AppData/Roaming/npm/node_modules/docx');

const screenshotDir = path.join(__dirname, 'screenshots');
const APP_VERSION = 'v4.01';

function pngDimensions(filepath) {
  const buf = fs.readFileSync(filepath);
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

function img(filename, displayWidth) {
  const filepath = path.join(screenshotDir, filename);
  const { w, h } = pngDimensions(filepath);
  const displayHeight = Math.round(displayWidth * (h / w));
  return new ImageRun({
    type: 'png',
    data: fs.readFileSync(filepath),
    transformation: { width: displayWidth, height: displayHeight },
    altText: { title: filename, description: filename, name: filename }
  });
}

const pageProps = {
  page: {
    size: { width: 11906, height: 16838 },
    margin: { top: 1418, right: 567, bottom: 1134, left: 1134 }
  }
};

const thinBorder = { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' };

function metaRow(label, value) {
  const cellBorders = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder };
  return new TableRow({
    children: [
      new TableCell({
        width: { size: 2000, type: WidthType.DXA },
        borders: cellBorders,
        shading: { fill: 'D6E4F0', type: ShadingType.CLEAR },
        margins: { top: 60, bottom: 60, left: 120, right: 120 },
        children: [new Paragraph({ children: [new TextRun({ text: label, font: 'Meiryo UI', size: 20, bold: true })] })]
      }),
      new TableCell({
        width: { size: 3000, type: WidthType.DXA },
        borders: cellBorders,
        margins: { top: 60, bottom: 60, left: 120, right: 120 },
        children: [new Paragraph({ children: [new TextRun({ text: value, font: 'Meiryo UI', size: 20 })] })]
      }),
    ]
  });
}

function heading(level, text) {
  const sizes = { 1: 32, 2: 28, 3: 24 };
  const colors = { 1: '1F4E79', 2: '2E75B6', 3: '404040' };
  const hl = level === 1 ? HeadingLevel.HEADING_1 : level === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3;
  return new Paragraph({
    heading: hl,
    spacing: { before: level === 1 ? 360 : 240, after: 120 },
    children: [new TextRun({ text, font: 'Meiryo UI', size: sizes[level], bold: true, color: colors[level] })]
  });
}

function para(text, opts = {}) {
  return new Paragraph({
    spacing: { before: opts.spaceBefore || 80, after: opts.spaceAfter || 80 },
    indent: opts.indent ? { left: opts.indent } : undefined,
    children: [new TextRun({ text, font: 'Meiryo UI', size: 21, ...(opts.bold && { bold: true }), ...(opts.color && { color: opts.color }) })]
  });
}

function bullet(text, level = 0) {
  return new Paragraph({
    numbering: { reference: 'bullets', level },
    spacing: { before: 40, after: 40 },
    children: [new TextRun({ text, font: 'Meiryo UI', size: 21 })]
  });
}

function spacer(before = 160) { return new Paragraph({ spacing: { before }, children: [] }); }
function pageBreak() { return new Paragraph({ children: [new PageBreak()] }); }

function imgPara(filename, displayWidth, caption) {
  const children = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 200, after: 80 },
      children: [img(filename, displayWidth)]
    }),
  ];
  if (caption) {
    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [new TextRun({ text: caption, font: 'Meiryo UI', size: 18, italics: true, color: '666666' })]
    }));
  }
  return children;
}

function tipBox(text) {
  return new Table({
    width: { size: 10200, type: WidthType.DXA },
    columnWidths: [10200],
    rows: [new TableRow({
      children: [new TableCell({
        width: { size: 10200, type: WidthType.DXA },
        borders: {
          top: { style: BorderStyle.SINGLE, size: 1, color: '2E75B6' },
          bottom: { style: BorderStyle.SINGLE, size: 1, color: '2E75B6' },
          left: { style: BorderStyle.SINGLE, size: 12, color: '2E75B6' },
          right: { style: BorderStyle.SINGLE, size: 1, color: '2E75B6' },
        },
        shading: { fill: 'EBF5FF', type: ShadingType.CLEAR },
        margins: { top: 100, bottom: 100, left: 200, right: 200 },
        children: [
          new Paragraph({ children: [
            new TextRun({ text: '[Hint] ', font: 'Meiryo UI', size: 20, bold: true, color: '2E75B6' }),
            new TextRun({ text, font: 'Meiryo UI', size: 20 })
          ]})
        ]
      })]
    })]
  });
}

// 図種カード一覧テーブル（概要章）
function dtypeTable(rows) {
  const hdr = (t) => new TableCell({
    width: { size: 2400, type: WidthType.DXA }, borders: { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder },
    shading: { fill: '2E75B6', type: ShadingType.CLEAR }, margins: { top: 50, bottom: 50, left: 120, right: 120 },
    children: [new Paragraph({ children: [new TextRun({ text: t, font: 'Meiryo UI', size: 19, bold: true, color: 'FFFFFF' })] })]
  });
  const cell = (t, w, bold) => new TableCell({
    width: { size: w, type: WidthType.DXA }, borders: { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder },
    margins: { top: 50, bottom: 50, left: 120, right: 120 },
    children: [new Paragraph({ children: [new TextRun({ text: t, font: 'Meiryo UI', size: 19, ...(bold && { bold: true }) })] })]
  });
  return new Table({
    width: { size: 10200, type: WidthType.DXA }, columnWidths: [2600, 7600],
    rows: [
      new TableRow({ tableHeader: true, children: [
        new TableCell({ width: { size: 2600, type: WidthType.DXA }, borders: { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder }, shading: { fill: '2E75B6', type: ShadingType.CLEAR }, margins: { top: 50, bottom: 50, left: 120, right: 120 }, children: [new Paragraph({ children: [new TextRun({ text: '図の種類', font: 'Meiryo UI', size: 19, bold: true, color: 'FFFFFF' })] })] }),
        new TableCell({ width: { size: 7600, type: WidthType.DXA }, borders: { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder }, shading: { fill: '2E75B6', type: ShadingType.CLEAR }, margins: { top: 50, bottom: 50, left: 120, right: 120 }, children: [new Paragraph({ children: [new TextRun({ text: '用途', font: 'Meiryo UI', size: 19, bold: true, color: 'FFFFFF' })] })] }),
      ]}),
      ...rows.map(([n, d]) => new TableRow({ children: [cell(n, 2600, true), cell(d, 7600)] })),
    ]
  });
}

// ===================================================================
//  表紙
// ===================================================================
const coverSection = {
  properties: { ...pageProps, titlePage: true },
  children: [
    new Paragraph({ spacing: { before: 2400 }, children: [] }),
    new Paragraph({ spacing: { before: 2400 }, children: [] }),
    new Paragraph({
      alignment: AlignmentType.CENTER, spacing: { after: 400 },
      children: [new TextRun({ text: '操作マニュアル', font: 'Meiryo UI', size: 56, bold: true, color: '1F4E79' })]
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER, spacing: { after: 200 },
      children: [new TextRun({ text: 'ビジネスダイアグラムメーカー ' + APP_VERSION, font: 'Meiryo UI', size: 36, color: '2E75B6' })]
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER, spacing: { after: 1200 },
      children: [new TextRun({ text: '総合編（全10図種対応）', font: 'Meiryo UI', size: 28, color: '404040' })]
    }),
    new Paragraph({ spacing: { before: 3600 }, children: [] }),
    new Table({
      width: { size: 5000, type: WidthType.DXA }, columnWidths: [2000, 3000],
      rows: [
        metaRow('作成者', '毛塚'),
        metaRow('作成日', '2026年5月25日'),
        metaRow('最終更新日', '2026年5月30日'),
        metaRow('バージョン', APP_VERSION),
      ]
    }),
  ]
};

// ===================================================================
//  本文
// ===================================================================
const body = [
  new TableOfContents('目次', { hyperlink: true, headingStyleRange: '1-3' }),
  pageBreak(),

  // ===== 1. 概要 =====
  heading(1, '1. 概要'),
  para('ビジネスダイアグラムメーカー ' + APP_VERSION + ' は、業務で利用する各種ダイアグラムを直感的に作成できるWebアプリケーションです。単一のHTMLファイルとして動作し、サーバーやインストールは不要です。HTMLファイルをブラウザで開くだけで利用できます。'),
  para('本マニュアルでは、全図種に共通する基本操作と、各図種固有の使い方を説明します。'),
  spacer(),
  para('対応する図の種類（全10種類）:', { bold: true }),
  spacer(40),
  dtypeTable([
    ['スイムレーン図', 'レーン（担当者/部門）ごとに業務フローを整理する図'],
    ['フローチャート', '処理手順・分岐を自由配置で表現する汎用フロー図'],
    ['プロセスフロー (BPMN)', 'イベント・ゲートウェイを含む業務プロセスモデル図'],
    ['状態遷移図', '状態と遷移条件でシステムの振る舞いを表現する図'],
    ['ER図', 'エンティティとリレーションでデータ構造を表現する図'],
    ['組織図', '役職・部門の階層構造をツリー形式で表現する図'],
    ['シーケンス図', 'オブジェクト間のメッセージ送受信を時系列で表現する図'],
    ['ガントチャート', 'タスクの期間・進捗・依存関係を時間軸で表現する工程表'],
    ['マインドマップ', '中心テーマから放射状に枝を広げ発想を整理する図'],
    ['UMLクラス図', 'クラスの属性・メソッドと継承・関連などの関係を表す図'],
  ]),
  spacer(),
  para(APP_VERSION + ' で利用できる主な機能:', { bold: true }),
  bullet('10種類の図に対応し、作成途中でも図の種類を相互に切り替え可能'),
  bullet('コピー＆貼り付け（クリック配置・プレビュー表示）／Ctrl+ドラッグによる複製'),
  bullet('シェイプの色変更・自由なリサイズ・範囲選択（マーキー）・グループ移動'),
  bullet('ノードの自動整列、保存した図（.html）のインポート'),
  bullet('レーンの並べ替え・幅調整、接続線ラベルの移動、折り返し位置の編集'),
  bullet('PNG / SVG 形式での画像エクスポート、JSON相当データを含むHTML保存'),
  pageBreak(),

  // ===== 2. 新しい図の作成 =====
  heading(1, '2. 新しい図の作成'),
  para('アプリケーションを開くと、最初に図の種類を選択するダイアログが表示されます。'),
  ...imgPara('01_new_diagram_dialog.png', 460, '図1: 新規作成ダイアログ（全10図種）'),
  para('作成したい図の種類のカードをクリックすると、対応するエディタ画面が開きます。'),
  tipBox('HTMLファイルをダブルクリックするだけで起動できます。インストール不要・サーバー不要です。保存したファイルを開いた場合は、ダイアログは表示されず前回の状態が復元されます。'),
  pageBreak(),

  // ===== 3. 画面構成 =====
  heading(1, '3. 画面構成'),
  para('スイムレーン図を選択した場合を例に、画面構成を説明します。'),
  ...imgPara('02_main_screen.png', 460, '図2: メイン画面（スイムレーン図）'),
  spacer(200),
  heading(2, '3.1 タイトルバー'),
  para('画面上部にタイトルバーが配置されています。左側に図の名前入力欄、右側に現在の図の種類が表示されます。'),
  para('図の種類表示をクリックすると、図の種類を切り替えることができます（詳細は第9章参照）。'),
  spacer(200),
  heading(2, '3.2 ツールバー'),
  para('タイトルバーの下にツールバーが配置されています。操作の大半はこのツールバーから行います。'),
  ...imgPara('11_toolbar.png', 520, '図3: ツールバー'),
  spacer(120),
  para('主なボタン:', { bold: true }),
  bullet('[▶ 選択] - シェイプの選択・移動モード'),
  bullet('[→ 接続] - シェイプ間を矢印で接続するモード'),
  bullet('[↩ 元に戻す / ↪ やり直す] - 操作の取消・再実行'),
  bullet('[⧉ コピー / 📋 貼り付け] - 選択シェイプのコピーと配置（第6章）'),
  bullet('[🎨 色] - 選択シェイプの塗り/枠の色変更（第6章）'),
  bullet('[✕ 削除] - 選択したシェイプの削除'),
  bullet('[縦・横] - レイアウト方向の切替（第8章）'),
  bullet('[⊞ 整列] - ノードの自動整列（第6章）'),
  bullet('[💾 名前をつけて保存] - 図データを含むHTMLとして保存'),
  bullet('[📂 インポート] - 保存した.htmlから編集データを読込（第6章）'),
  bullet('[↓ PNG / ↓ SVG] - 画像としてエクスポート（第11章）'),
  bullet('[－ / ＋ / ⊡ 全体] - ズーム操作'),
  para('※ ツールバーのボタンは図の種類に応じて自動的に切り替わります。たとえばガントチャートでは「日/週/月」のスケール切替、マインドマップでは「放射状/ツリー」の配置切替、UMLクラス図では「abstract」「«interface»」のボタンが追加表示されます。', { color: '555555' }),
  spacer(200),
  heading(2, '3.3 サイドパネル'),
  para('画面左側にシェイプパレットとレーン管理パネルがあります。'),
  ...imgPara('10_sidebar_panel.png', 130, '図4: サイドパネル'),
  para('上部「シェイプ」: 使用可能なシェイプの一覧。クリックまたはドラッグ＆ドロップで配置します。'),
  para('下部「レーン」: レーンの一覧と管理ボタン（レーンを使う図種のみ表示）。'),
  para('※ ガントチャートでは「プロジェクト設定」、マインドマップでは「レイアウト」など、図種専用の設定セクションがサイドパネルに表示されます。', { color: '555555' }),
  pageBreak(),

  // ===== 4. シェイプの基本操作 =====
  heading(1, '4. シェイプの基本操作'),
  heading(2, '4.1 シェイプの配置'),
  para('サイドパネルのシェイプをクリックしてからキャンバスをクリックするか、ドラッグ＆ドロップで配置します。'),
  ...imgPara('03_shapes_placed.png', 460, '図5: シェイプ配置例（スイムレーン図）'),
  spacer(120),
  para('スイムレーン図／フローチャートで利用できる主なシェイプ:', { bold: true }),
  bullet('プロセス - 通常の処理ステップ（長方形）'),
  bullet('プロセス(説明有) - 説明文付きのプロセス'),
  bullet('複数レーンプロセス／マルチプロセス - 複数レーンにまたがる処理'),
  bullet('判断 - 分岐条件（ひし形）'),
  bullet('開始/終了 - フローの始点・終点（角丸）'),
  bullet('データ - 入出力データ（平行四辺形）'),
  bullet('書類 - ドキュメント（波型下辺）'),
  para('※ 各図種で使えるシェイプは第10章を参照してください。', { color: '555555' }),

  heading(2, '4.2 シェイプの選択'),
  para('シェイプの選択方法は3通りあります。'),
  bullet('単一選択 - シェイプをクリック'),
  bullet('複数選択 - Shiftキーを押しながらクリックで追加/解除'),
  bullet('範囲選択（マーキー） - 何もない場所からドラッグして矩形で囲む'),
  ...imgPara('20_marquee_select.png', 460, '図6: 範囲選択（マーキー）で複数シェイプを選択'),

  heading(2, '4.3 移動とグループ移動'),
  para('選択したシェイプをドラッグして移動します。複数選択した状態でドラッグすると、選択したすべてのシェイプがまとめて移動します。'),
  tipBox('スイムレーン図では、シェイプはレーン内にスナップして整列します。「データ」「書類」などのフリー配置シェイプはスナップせず、レーン境界を越えて自由に配置できます（4.6参照）。'),

  heading(2, '4.4 シェイプのリサイズ'),
  para('シェイプを選択すると、四隅と各辺の中央に合計8個のハンドルが表示されます。ハンドルをドラッグしてサイズを変更します。'),
  ...imgPara('22_resize_handles.png', 460, '図7: 選択シェイプのリサイズハンドル（8方向）'),
  para('※ ガント・シーケンス・マインドマップ等の専用図形は、それぞれ専用の操作（期間変更・高さ変更など）でサイズを調整します。', { color: '555555' }),

  heading(2, '4.5 テキストの編集'),
  para('シェイプをダブルクリックすると、テキスト編集モードになります。'),
  ...imgPara('06_text_editing.png', 460, '図8: テキスト編集モード'),
  para('テキストを入力後、シェイプ外をクリックまたはEnterキーで確定します。'),
  para('「プロセス(説明有)」やER図のエンティティ、UMLクラスなど複数の領域を持つシェイプは、領域ごとにダブルクリックして個別に編集できます。'),

  heading(2, '4.6 フリー配置シェイプ'),
  para('「データ」と「書類」のシェイプは、通常のシェイプと異なりフリー配置が可能です。'),
  bullet('レーンの境界に関係なく自由に配置できます'),
  bullet('スナップラインにスナップされません'),
  bullet('接続線はこれらのシェイプを避けず、交差して通過します'),
  pageBreak(),

  // ===== 5. シェイプの接続 =====
  heading(1, '5. シェイプの接続'),
  para('シェイプ間を矢印（接続線）で接続する手順:'),
  bullet('1. ツールバーの「→ 接続」ボタンをクリック', 0),
  bullet('2. 接続元のシェイプをクリック', 0),
  bullet('3. 接続先のシェイプをクリック', 0),
  ...imgPara('12_connection_mode.png', 460, '図9: 接続モード'),
  ...imgPara('04_connections.png', 460, '図10: 接続完了後の図'),
  para('接続線は障害物となるシェイプを自動的に迂回し、直角に折れ曲がる経路で描画されます。'),

  heading(2, '5.1 クロッシングブリッジ'),
  para('接続線が他の接続線と交差する場合、交差点に自動的にアーク（ブリッジ）が表示されます。これにより、どの線がどの線の上を通過しているかが視覚的に明確になります。'),
  para('「差戻し」のような戻り方向の矢印が順方向の矢印と交差する場合に特に有効です。'),

  heading(2, '5.2 接続線のラベル'),
  para('接続線をダブルクリックすると、ラベル（テキスト）を入力できます。状態遷移図では、接続を作成した直後に自動でラベル入力が始まります。'),
  para('ラベルは不透明な背景で表示され、ドラッグして位置を移動できます。'),

  heading(2, '5.3 折り返し位置の編集'),
  para('接続線を選択すると、折り返し（クランク）部分に編集ハンドルが表示されます。ハンドルをドラッグすると折り返し位置を調整できます。ダブルクリックで自動位置に戻ります。'),
  tipBox('ER図・シーケンス図・ガントチャート・UMLクラス図では、接続の作成時にカーディナリティ・メッセージ種別・依存種別・関連種別を選ぶメニューが表示されます（第10章参照）。'),
  pageBreak(),

  // ===== 6. 編集を効率化する機能 =====
  heading(1, '6. 編集を効率化する機能'),
  heading(2, '6.1 コピー＆貼り付け'),
  para('シェイプを選択して「⧉ コピー」（または Ctrl+C）でコピーします。続いて「📋 貼り付け」（または Ctrl+V）を押すと貼り付けモードになり、カーソルに追従する半透明のプレビューが表示されます。配置したい位置をクリックすると貼り付けられます（Escでキャンセル）。'),
  para('選択したシェイプ同士を結ぶ接続線も一緒に複製されます。'),

  heading(2, '6.2 シェイプの複製（Ctrl+ドラッグ）'),
  para('シェイプを Ctrl（macOSは⌘）キーを押しながらドラッグすると、その場に複製を作りながら移動できます。ドラッグの開始後にCtrlを押しても複製に切り替わります。'),

  heading(2, '6.3 色の変更'),
  para('シェイプを選択して「🎨 色」ボタンを押すと、色のメニューが開きます。プリセットから塗りと枠の色を選べます。「標準の色に戻す」で既定色に戻ります。'),
  ...imgPara('21_color_menu.png', 460, '図11: シェイプの色変更メニュー'),

  heading(2, '6.4 自動整列'),
  para('「⊞ 整列」ボタンを押すと、接続関係をもとにノードがツリー状に自動整列されます。'),
  ...imgPara('23_auto_layout.png', 440, '図12: 自動整列の結果'),
  para('※ マインドマップでは「放射状」または「ツリー」のレイアウトで整列します。', { color: '555555' }),

  heading(2, '6.5 元に戻す・やり直す'),
  para('「↩ 元に戻す」「↪ やり直す」で操作を取り消し・再実行できます。シェイプの追加・移動・色・サイズ・接続など、ほぼすべての編集が対象です。'),

  heading(2, '6.6 インポート'),
  para('「📂 インポート」ボタンから、保存済みの.htmlファイルを選ぶと、その図のシェイプ・レーン・接続線を読み込みます。'),
  para('インポートは現在の図を取り込んだ内容に置き換えます。実行前に確認ダイアログが表示されます。', { color: 'CC0000' }),
  pageBreak(),

  // ===== 7. レーン管理 =====
  heading(1, '7. レーン管理'),
  para('スイムレーン図・プロセスフロー（BPMN）では、レーンが業務の担当者や部門を表します。'),
  heading(2, '7.1 レーンの追加'),
  para('サイドパネル下部の「＋ レーンを追加」ボタンでレーンを追加できます。'),
  ...imgPara('07_lane_added.png', 460, '図13: レーン追加後（4レーン）'),
  heading(2, '7.2 レーン名の変更'),
  para('サイドパネルまたはキャンバス上のレーン名をクリックすると、レーン名を編集できます。'),
  heading(2, '7.3 レーンの削除'),
  para('各レーン名の横にある「×」ボタンでレーンを削除できます。'),
  para('※ レーン内にシェイプがある場合は、シェイプも一緒に削除されます。', { color: 'CC0000' }),
  heading(2, '7.4 レーンの並べ替え'),
  para('サイドパネルのレーン行左端のハンドル（⠿）をドラッグするか、キャンバス上のレーン見出し帯をドラッグすると、レーンの順序を入れ替えられます。レーン内のシェイプも一緒に移動します。'),
  heading(2, '7.5 レーンの幅調整'),
  para('レーンの境界線をドラッグして幅を調整できます。最も右（横方向では最も下）のレーンも調整可能です。'),
  pageBreak(),

  // ===== 8. 縦横切替 =====
  heading(1, '8. 縦横切替'),
  para('「縦・横」ボタンでレイアウトの方向を切り替えられます。'),
  bullet('縦方向: レーンが左から右に並び、フローが上から下に流れます'),
  bullet('横方向: レーンが上から下に並び、フローが左から右に流れます'),
  ...imgPara('08_horizontal_layout.png', 460, '図14: 横方向レイアウト'),
  tipBox('切り替えてもシェイプの接続関係は保持されます。ガントチャートのように方向が固定された図種では、このボタンは表示されません。'),
  pageBreak(),

  // ===== 9. 図の種類の切替 =====
  heading(1, '9. 図の種類の切替'),
  para('作成中の図を別の種類に切り替えることができます。'),
  bullet('1. タイトルバー右側の図の種類名（例:「スイムレーン図」）をクリック', 0),
  bullet('2. ドロップダウンメニューから切り替え先の図種を選択', 0),
  ...imgPara('13_diagram_type_menu.png', 460, '図15: 図の種類切替メニュー（全10種）'),
  heading(2, '9.1 レーンあり図種とレーンなし図種'),
  para('レーンを使うのはスイムレーン図とプロセスフロー（BPMN）です。その他の図種はレーンを使いません。'),
  bullet('レーンあり→レーンなし: レーンが削除され、シェイプは自由配置になります'),
  bullet('レーンなし→レーンあり: 既定のレーンが作成されます'),
  ...imgPara('14_flowchart_mode.png', 460, '図16: フローチャートモードに切替後'),
  tipBox('既存のシェイプ・接続線は図の種類を切り替えても可能な範囲で保持されます。パレットのシェイプ一覧は図種に応じて自動的に切り替わります。'),
  pageBreak(),

  // ===== 10. 各図種の使い方 =====
  heading(1, '10. 各図種の使い方'),
  para('ここまでの基本操作（配置・選択・接続・編集）は全図種に共通です。本章では各図種固有の機能を説明します。'),

  heading(2, '10.1 スイムレーン図'),
  para('レーン（担当者・部門）ごとに業務フローを整理する図です。シェイプはレーン内にスナップして配置されます。レーンの追加・並べ替え・幅調整は第7章を参照してください。'),
  para('利用シェイプ: プロセス / プロセス(説明有) / 複数レーンプロセス / 判断 / 開始・終了 / データ / 書類'),

  heading(2, '10.2 フローチャート'),
  para('処理手順や分岐を自由配置で表現する汎用フロー図です。レーンは使わず、シェイプをキャンバス上に自由に配置します。複数レーンにまたがる処理は「マルチプロセス」シェイプで表現します。'),

  heading(2, '10.3 プロセスフロー（BPMN）'),
  para('イベント・ゲートウェイを含む業務プロセスモデル図です。レーンを使用します。'),
  bullet('タスク / サブプロセス / 複数レーンタスク'),
  bullet('排他ゲートウェイ（✕）・並行ゲートウェイ（＋）'),
  bullet('イベント（配置時に 開始/中間/終了 を選択。色で区別）'),
  bullet('書類'),

  heading(2, '10.4 状態遷移図'),
  para('状態と遷移条件でシステムの振る舞いを表現する図です。'),
  bullet('状態 / 状態(詳細）（entry・do・exit などのアクションを記述可能）'),
  bullet('開始（黒丸）・終了（二重丸）'),
  bullet('分岐（ひし形）'),
  para('接続線を作成すると、自動的に「[条件] / アクション」形式のラベル入力が始まります。'),
  pageBreak(),

  heading(2, '10.5 ER図'),
  para('エンティティ（テーブル）とリレーションでデータ構造を表現する図です。'),
  ...imgPara('30_er.png', 460, '図17: ER図の例'),
  bullet('エンティティ - 上段がテーブル名、下段がカラムリスト。領域をダブルクリックして編集します'),
  bullet('リレーション - ひし形（必要に応じて使用）'),
  para('接続を作成すると、カーディナリティ（1:1 / 1:N / N:N / 0..1:1 / 0..N:1 / なし）を選ぶメニューが表示され、線の両端に記号が表示されます。'),

  heading(2, '10.6 組織図'),
  para('役職・部門の階層構造をツリー形式で表現する図です。接続線は矢印なしの直線で描画されます。'),
  ...imgPara('31_orgchart.png', 460, '図18: 組織図の例'),
  bullet('ポジション - 上段が役職名、下段が氏名の2段ボックス'),
  bullet('部門 - 背景となる破線の枠（複数のポジションをグループ化）'),
  para('「⊞ 整列」で階層構造に沿って自動整列できます。'),
  pageBreak(),

  heading(2, '10.7 シーケンス図'),
  para('オブジェクト間のメッセージ送受信を時系列で表現する図です。'),
  ...imgPara('32_sequence.png', 460, '図19: シーケンス図の例'),
  bullet('ライフライン - 上部のヘッダーボックスから縦の破線が伸びます。横方向にのみ移動できます'),
  bullet('活性区間 - ライフライン上の処理中区間。縦方向にのみ移動・リサイズできます'),
  para('接続（メッセージ）を作成すると、種類（同期 → / 非同期 ⇢ / 応答 ⇠）を選ぶメニューが表示されます。自己呼び出しや、同じ相手への複数メッセージも作成できます。'),

  heading(2, '10.8 ガントチャート'),
  para('タスクの期間・進捗・依存関係を時間軸で表現する工程表です。方向は横向きに固定されます。'),
  ...imgPara('33_gantt.png', 480, '図20: ガントチャートの例'),
  para('左側の表は「タスク名 / 概要 / 担当」の3列で構成されます（' + APP_VERSION + ' で概要・担当列を追加）。'),
  bullet('タスク - 期間を表すバー。進捗率（青いフィル）を表示します'),
  bullet('マイルストーン - ひし形の節目'),
  bullet('サマリー - フェーズ全体を表す太線バー'),
  spacer(60),
  para('主な操作:', { bold: true }),
  bullet('バーを左右にドラッグして日程を移動、両端のハンドルで期間を変更'),
  bullet('バーの下辺のハンドルで進捗率を変更'),
  bullet('タスク名列をドラッグして行を並べ替え、列の境界をドラッグして列幅を調整'),
  bullet('バーをダブルクリックすると詳細編集モーダル（名前/日付/進捗/概要/担当/色）が開きます'),
  bullet('ツールバーで時間スケール（日/週/月）を切替、ズームで列幅を調整'),
  bullet('依存関係を接続すると FS / SS / FF / SF の種別を選択できます'),
  para('新規作成したガントチャートの開始日は、その月の初日に自動設定されます。保存して再度開いた場合は、保存時の開始日が維持されます。'),
  pageBreak(),

  heading(2, '10.9 マインドマップ'),
  para('中心テーマから放射状に枝を広げて発想を整理する図です。枝は矢印なしの曲線で描画され、階層ごとに色分けされます。'),
  ...imgPara('34_mindmap.png', 460, '図21: マインドマップの例（放射状レイアウト）'),
  para('主な操作:', { bold: true }),
  bullet('パレットの「トピック」をクリック、または Tab キーで選択中ノードに子トピックを追加'),
  bullet('Enter キーで兄弟トピックを追加、ダブルクリックで名称を編集'),
  bullet('親ノードをドラッグするとサブツリー全体が連動。別ノードへドロップで親を変更'),
  bullet('Space キーまたはノード右端のトグルで折り畳み/展開'),
  bullet('「⊞ 整列」または配置モード（放射状/ツリー）で自動レイアウト'),
  para('中心トピックは削除できません。子ノードを削除するとそのサブツリーごと削除されます。'),

  heading(2, '10.10 UMLクラス図'),
  para('クラスの属性・メソッドと、クラス間の関係を表す図です。'),
  ...imgPara('35_uml.png', 460, '図22: UMLクラス図の例'),
  bullet('クラス - クラス名 / 属性 / メソッドの3段ボックス。各段をダブルクリックで編集（メソッドは1行1項目）'),
  bullet('インターフェース - «interface» と表示される2段ボックス'),
  para('ツールバーの「abstract」「«interface»」ボタンで、選択クラスを抽象クラス（名称を斜体＋«abstract»表示）やインターフェースに切り替えられます。'),
  para('接続を作成すると、関連の種別を6種類から選べます: 継承 / 実装 / 依存 / 関連 / 集約 / コンポジション。種別ごとに線種と端点マーカー（白三角・開矢印・ひし形）が変わります。'),
  pageBreak(),

  // ===== 11. 保存とエクスポート =====
  heading(1, '11. 保存とエクスポート'),
  ...imgPara('09_save_export.png', 460, '図23: 保存・エクスポート'),
  spacer(200),
  heading(2, '11.1 名前をつけて保存'),
  para('「💾 名前をつけて保存」をクリックすると、図のデータを埋め込んだHTMLファイルをダウンロードします。このファイルはそのままブラウザで開いて編集を再開でき、「📂 インポート」で他の図に取り込むこともできます。'),
  heading(2, '11.2 PNG / SVG エクスポート'),
  para('「↓ PNG」「↓ SVG」ボタンで、図を画像としてエクスポートします。'),
  bullet('PNG - ラスタ画像（プレゼンや文書への貼り付けに最適）'),
  bullet('SVG - ベクタ画像（拡大しても劣化しない）'),
  para('※ ファイル名は図種に応じて自動的に決まります（例: gantt_chart.png / mindmap.svg / uml_class.svg）。', { color: '555555' }),
  heading(2, '11.3 図の名称'),
  para('画面左上の入力欄に図の名称を入力しておくと、保存ファイル名に反映されます。'),
  tipBox('編集中のデータはブラウザを閉じると失われます。こまめに「名前をつけて保存」することをお勧めします。'),
];

const contentSection = {
  properties: { ...pageProps },
  headers: {
    default: new Header({
      children: [new Paragraph({
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '2E75B6', space: 4 } },
        children: [new TextRun({ text: 'ビジネスダイアグラムメーカー ' + APP_VERSION + ' 操作マニュアル', font: 'Meiryo UI', size: 18, color: '2E75B6' })]
      })]
    })
  },
  footers: {
    default: new Footer({
      children: [new Paragraph({
        alignment: AlignmentType.CENTER,
        border: { top: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC', space: 4 } },
        children: [
          new TextRun({ text: 'Page ', font: 'Meiryo UI', size: 18, color: '808080' }),
          new TextRun({ children: [PageNumber.CURRENT], font: 'Meiryo UI', size: 18, color: '808080' }),
          new TextRun({ text: ' / ', font: 'Meiryo UI', size: 18, color: '808080' }),
          new TextRun({ children: [PageNumber.TOTAL_PAGES], font: 'Meiryo UI', size: 18, color: '808080' }),
        ]
      })]
    })
  },
  children: body
};

const doc = new Document({
  styles: {
    default: { document: { run: { font: 'Meiryo UI', size: 21 } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 32, bold: true, font: 'Meiryo UI', color: '1F4E79' },
        paragraph: { spacing: { before: 360, after: 120 }, outlineLevel: 0 } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 28, bold: true, font: 'Meiryo UI', color: '2E75B6' },
        paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 1 } },
      { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 24, bold: true, font: 'Meiryo UI', color: '404040' },
        paragraph: { spacing: { before: 200, after: 80 }, outlineLevel: 2 } },
    ]
  },
  numbering: {
    config: [{
      reference: 'bullets',
      levels: [
        { level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } } },
        { level: 1, format: LevelFormat.BULLET, text: '◦', alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 1080, hanging: 360 } } } },
      ]
    }]
  },
  sections: [coverSection, contentSection]
});

Packer.toBuffer(doc).then(buffer => {
  const outPath = path.join(__dirname, 'ビジネスダイアグラムメーカー_操作マニュアル_' + APP_VERSION + '.docx');
  fs.writeFileSync(outPath, buffer);
  console.log('Manual created: ' + outPath);
  console.log('Size: ' + (buffer.length / 1024).toFixed(1) + ' KB');
});
