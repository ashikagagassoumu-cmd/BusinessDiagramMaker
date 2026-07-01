const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

// v8.00 マニュアル用の撮影対象。v8.00 が 99_旧バージョン へ退避された後は退避先パスに読み替える。
const URL = 'http://localhost:8765/diagram_v8.00.html';
const outDir = path.join(__dirname, 'screenshots');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

function shotPath(name) { return path.join(outDir, name); }
const wait = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 900 });
  await page.goto(URL, { waitUntil: 'networkidle0' });
  await page.waitForSelector('[onclick]', { timeout: 5000 });

  // ============================================================
  //  共通ヘルパー（ページ内に注入）
  // ============================================================
  await page.evaluate(() => {
    // 状態を空にして指定図種へ切替（selectDiagramType 相当・確認ダイアログ無し）
    window._reset = (type) => {
      S.nodes = []; S.edges = []; S.sel = []; S.conn = null; S.lanes = [];
      S.diagramType = type; S.orientation = 'vertical';
      if (type === 'gantt') S.gantt = defaultGantt();
      applyDiagramType();
      const dt = DIAGRAM_TYPES[type];
      for (let i = 0; i < (dt.defaultLanes || 0); i++) addLane();
      if (type === 'mindmap') mindCreateRoot();
      render();
    };
    // インライン編集ボックス等を閉じる（blur で確定させてから再描画）
    window._clean = () => {
      const ed = document.querySelector('foreignObject input, foreignObject textarea, foreignObject [contenteditable]');
      if (ed) { try { ed.blur(); } catch (e) {} }
      document.getElementById('lane-choice')?.remove();
      render();
    };
  });

  // ============================================================
  //  基本操作（スイムレーン図ベース）
  // ============================================================

  // 01: 新規作成ダイアログ（10図種カード）
  await page.screenshot({ path: shotPath('01_new_diagram_dialog.png') });
  console.log('01 done');

  // スイムレーン図を選択
  await page.evaluate(() => {
    const cards = document.querySelectorAll('[onclick]');
    for (const c of cards) { if (c.textContent.includes('スイムレーン図')) { c.click(); break; } }
  });
  await wait(400);

  // 02: メイン画面（空・スイムレーン）
  await page.screenshot({ path: shotPath('02_main_screen.png') });
  console.log('02 done');

  // シェイプ配置
  await page.evaluate(() => {
    addNode('terminal', 110, 80, { text: '開始' });
    addNode('rect', 110, 200, { text: '申請書作成' });
    addNode('rect', 330, 340, { text: '内容確認' });
    addNode('diamond', 330, 480, { text: '承認?' });
    addNode('rect', 550, 620, { text: '処理実行' });
    addNode('terminal', 550, 760, { text: '終了' });
    addNode('parallelogram', 200, 300, { text: '申請データ' });
    addNode('doc', 460, 560, { text: '通知書' });
    S.sel = []; render();
  });
  await page.screenshot({ path: shotPath('03_shapes_placed.png') });
  console.log('03 done');

  // 接続線
  await page.evaluate(() => {
    const ids = S.nodes.map(n => n.id);
    addEdge(ids[0], ids[1]);
    addEdge(ids[1], ids[2]);
    addEdge(ids[2], ids[3]);
    addEdge(ids[3], ids[4]);
    addEdge(ids[4], ids[5]);
    addEdge(ids[1], ids[6]);
    addEdge(ids[4], ids[7]);
    const rejId = addEdge(ids[3], ids[1]);
    if (rejId) { const e = S.edges.find(e => e.id === rejId); if (e) e.label = '差戻し'; render(); }
    S.sel = []; render();
  });
  await page.screenshot({ path: shotPath('04_connections.png') });
  console.log('04 done');

  // 05: シェイプ選択（リサイズハンドル表示）
  await page.evaluate(() => { S.sel = [S.nodes[1].id]; render(); });
  await page.screenshot({ path: shotPath('05_shape_selected.png') });
  console.log('05 done');

  // 06: テキスト編集
  await page.evaluate(() => { editText(S.nodes[1].id); });
  await wait(300);
  await page.screenshot({ path: shotPath('06_text_editing.png') });
  console.log('06 done');
  await page.evaluate(() => { window._clean(); S.sel = []; render(); });

  // 07: レーン追加
  await page.evaluate(() => { addLane(); });
  await page.screenshot({ path: shotPath('07_lane_added.png') });
  console.log('07 done');

  // 08: 横方向レイアウト
  await page.evaluate(() => { S.lanes.pop(); render(); toggleOrientation(); });
  await page.screenshot({ path: shotPath('08_horizontal_layout.png') });
  console.log('08 done');
  await page.evaluate(() => { toggleOrientation(); });

  // 図名入力
  await page.evaluate(() => {
    const inp = document.querySelector('input[type="text"]');
    if (inp) { inp.value = '承認フロー_v1'; inp.dispatchEvent(new Event('input')); }
  });

  // 09: 保存・エクスポート
  await page.screenshot({ path: shotPath('09_save_export.png') });
  console.log('09 done');

  // 10: サイドバー（クリップ）
  const sidebarBox = await page.evaluate(() => {
    const svg = document.getElementById('diagram-svg');
    const sidebar = svg.parentElement.previousElementSibling;
    const r = sidebar.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  });
  await page.screenshot({ path: shotPath('10_sidebar_panel.png'), clip: sidebarBox });
  console.log('10 done');

  // 11: ツールバー（クリップ）
  const toolbarBox = await page.evaluate(() => {
    const btn = document.getElementById('btn-select');
    const toolbar = btn ? btn.parentElement : null;
    if (!toolbar) return null;
    const r = toolbar.getBoundingClientRect();
    return { x: r.x, y: r.y, width: Math.min(r.width, 1200), height: r.height };
  });
  if (toolbarBox) {
    await page.screenshot({ path: shotPath('11_toolbar.png'), clip: toolbarBox });
    console.log('11 done');
  }

  // 12: 接続モード（setMode は SVG.className 代入で puppeteer 上だけ例外になるため状態を直接設定）
  await page.evaluate(() => {
    S.mode = 'connect'; S.conn = null;
    document.getElementById('prev-edge').style.display = 'none';
    document.querySelectorAll('.tbtn').forEach(b => b.classList.remove('on'));
    document.getElementById('btn-connect')?.classList.add('on');
    document.getElementById('diagram-svg').setAttribute('class', 'cx');
    hint('接続元ノードをクリック → 接続先ノードをクリック (Escでキャンセル)');
    render();
  });
  await wait(200);
  await page.screenshot({ path: shotPath('12_connection_mode.png') });
  console.log('12 done');
  await page.evaluate(() => {
    S.mode = 'select'; S.conn = null;
    document.querySelectorAll('.tbtn').forEach(b => b.classList.remove('on'));
    document.getElementById('btn-select')?.classList.add('on');
    document.getElementById('diagram-svg').setAttribute('class', '');
    render();
  });

  // 13: 図種切替メニュー（10種）
  await page.evaluate(() => { document.getElementById('dtype-label').click(); });
  await wait(300);
  await page.screenshot({ path: shotPath('13_diagram_type_menu.png') });
  console.log('13 done');
  await page.evaluate(() => { document.getElementById('dtype-menu').style.display = 'none'; });

  // 14: フローチャートモード
  await page.evaluate(() => { changeDiagramType('flowchart'); });
  await wait(300);
  await page.screenshot({ path: shotPath('14_flowchart_mode.png') });
  console.log('14 done');

  // ============================================================
  //  共通の新機能
  // ============================================================

  // 20: 範囲選択（マーキー）＋複数選択
  await page.evaluate(() => {
    window._reset('flowchart');
    addNode('rect', 160, 140, { text: 'タスクA' });
    addNode('rect', 360, 140, { text: 'タスクB' });
    addNode('rect', 260, 280, { text: 'タスクC' });
    S.sel = S.nodes.map(n => n.id); render();
    // マーキー枠を g-guides に描画
    const g = document.getElementById('g-guides');
    if (g) {
      const r = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      r.setAttribute('x', 90); r.setAttribute('y', 90);
      r.setAttribute('width', 380); r.setAttribute('height', 250);
      r.setAttribute('fill', '#3b82f6'); r.setAttribute('fill-opacity', '0.08');
      r.setAttribute('stroke', '#3b82f6'); r.setAttribute('stroke-dasharray', '5,3');
      g.appendChild(r);
    }
  });
  await page.screenshot({ path: shotPath('20_marquee_select.png') });
  console.log('20 done');

  // 21: 色変更メニュー
  await page.evaluate(() => {
    window._reset('flowchart');
    addNode('rect', 220, 180, { text: 'プロセス' });
    S.sel = [S.nodes[0].id]; render();
    showShapeColorMenu({ stopPropagation() {}, clientX: 300, clientY: 240 });
  });
  await wait(250);
  await page.screenshot({ path: shotPath('21_color_menu.png') });
  console.log('21 done');
  await page.evaluate(() => { document.getElementById('lane-choice')?.remove(); });

  // 22: リサイズハンドル（選択時の8方向ハンドル）
  await page.evaluate(() => {
    window._reset('flowchart');
    const n = addNode('rect', 260, 220, { text: 'サイズ変更' });
    S.sel = [n.id]; render();
  });
  await wait(150);
  await page.screenshot({ path: shotPath('22_resize_handles.png') });
  console.log('22 done');

  // 23: 自動整列（ツリー配置）
  await page.evaluate(() => {
    window._reset('flowchart');
    const a = addNode('rect', 300, 120, { text: 'A' });
    const b = addNode('rect', 120, 300, { text: 'B' });
    const c = addNode('rect', 300, 300, { text: 'C' });
    const d = addNode('rect', 480, 300, { text: 'D' });
    addEdge(a.id, b.id); addEdge(a.id, c.id); addEdge(a.id, d.id);
    S.sel = []; autoLayout();
  });
  await wait(200);
  await page.screenshot({ path: shotPath('23_auto_layout.png') });
  console.log('23 done');

  // ============================================================
  //  各図種
  // ============================================================

  // 30: ER図
  await page.evaluate(() => {
    window._reset('er');
    placeShape('entity', 150, 150);
    placeShape('entity', 520, 360);
    const [a, b] = S.nodes;
    a.sections = [{ text: '顧客', style: 'header' }, { rows: ['id (PK)', '氏名', 'メール'], style: 'list' }];
    b.sections = [{ text: '注文', style: 'header' }, { rows: ['id (PK)', '顧客id (FK)', '金額', '注文日'], style: 'list' }];
    a.text = ''; b.text = '';
    addEdge(a.id, b.id, { fromLabel: '1', toLabel: 'N' });
    S.sel = []; render();
  });
  await page.screenshot({ path: shotPath('30_er.png') });
  console.log('30 done');

  // 31: 組織図
  await page.evaluate(() => {
    window._reset('orgchart');
    const set = (n, role, name) => { n.sections = [{ text: role, style: 'header' }, { text: name, style: 'sub' }]; n.text = ''; };
    placeShape('org_node', 330, 110);
    placeShape('org_node', 150, 300);
    placeShape('org_node', 330, 300);
    placeShape('org_node', 510, 300);
    const [ceo, a, b, c] = S.nodes;
    set(ceo, '代表取締役', '山田 太郎');
    set(a, '営業部長', '佐藤 花子');
    set(b, '開発部長', '鈴木 一郎');
    set(c, '管理部長', '田中 美咲');
    addEdge(ceo.id, a.id); addEdge(ceo.id, b.id); addEdge(ceo.id, c.id);
    S.sel = []; render();
  });
  await page.screenshot({ path: shotPath('31_orgchart.png') });
  console.log('31 done');

  // 32: シーケンス図
  await page.evaluate(() => {
    window._reset('sequence');
    placeShape('lifeline', 160, 40);
    placeShape('lifeline', 420, 40);
    placeShape('lifeline', 680, 40);
    const [u, s, d] = S.nodes;
    u.text = '利用者'; s.text = 'システム'; d.text = 'DB';
    addEdge(u.id, s.id, { msgType: 'sync', msgY: 120 });
    addEdge(s.id, d.id, { msgType: 'sync', msgY: 180 });
    addEdge(d.id, s.id, { msgType: 'reply', msgY: 240 });
    addEdge(s.id, u.id, { msgType: 'reply', msgY: 300 });
    S.edges[0].label = 'ログイン要求';
    S.edges[1].label = '認証照会';
    S.edges[2].label = '結果';
    S.edges[3].label = '応答';
    S.sel = []; render();
  });
  await page.screenshot({ path: shotPath('32_sequence.png') });
  console.log('32 done');

  // 33: ガントチャート
  await page.evaluate(() => {
    window._reset('gantt');
    S.gantt.startDate = '2026-05-01'; S.gantt.scale = 'day'; S.gantt.colWidth = 22;
    // 基本例（図20）は見出し欄・凡例を伏せてクラシックな工程表として見せる（見出し欄は図21以降で解説）
    if (S.gantt.header) S.gantt.header.show = false;
    if (S.gantt.legend) S.gantt.legend.show = false;
    const add = (o) => { S.nodes.push(Object.assign({ id: uid(), progress: 0, desc: '', assignee: '' }, o)); };
    add({ type: 'gantt_summary', row: 0, text: '設計フェーズ', startDate: '2026-05-04', endDate: '2026-05-15' });
    add({ type: 'gantt_task', row: 1, text: '要件定義', desc: '業務要件の整理', assignee: '山田', startDate: '2026-05-04', endDate: '2026-05-08', progress: 100 });
    add({ type: 'gantt_task', row: 2, text: '基本設計', desc: '画面・DB設計', assignee: '佐藤', startDate: '2026-05-11', endDate: '2026-05-15', progress: 60 });
    add({ type: 'gantt_milestone', row: 3, text: '設計完了', date: '2026-05-15' });
    add({ type: 'gantt_task', row: 4, text: '実装', desc: 'コーディング', assignee: '鈴木', startDate: '2026-05-18', endDate: '2026-05-22', progress: 0 });
    const ids = S.nodes.map(n => n.id);
    addEdge(ids[1], ids[2], { depType: 'FS' });
    addEdge(ids[2], ids[4], { depType: 'FS' });
    S.sel = []; render();
  });
  await page.screenshot({ path: shotPath('33_gantt.png') });
  console.log('33 done');

  // 34: マインドマップ
  await page.evaluate(() => {
    window._reset('mindmap');
    const root = S.nodes.find(n => n.type === 'mind_root'); root.text = '新製品企画';
    const addT = (pid, text) => {
      const n = { id: uid(), type: 'mind_topic', text, x: 0, y: 0, w: SD.mind_topic.w, h: SD.mind_topic.h };
      S.nodes.push(n);
      S.edges.push({ id: uid(), from: pid, to: n.id, label: '', fromLabel: '', toLabel: '', fromLid: null, toLid: null });
      return n.id;
    };
    const market = addT(root.id, '市場調査');
    addT(market, '競合分析'); addT(market, '顧客ニーズ');
    const dev = addT(root.id, '開発');
    addT(dev, '試作'); addT(dev, 'テスト');
    const promo = addT(root.id, '販促');
    addT(promo, 'SNS'); addT(promo, '展示会');
    mindLayout(); S.sel = []; render();
  });
  await page.screenshot({ path: shotPath('34_mindmap.png') });
  console.log('34 done');

  // 35: UMLクラス図
  await page.evaluate(() => {
    window._reset('uml');
    placeShape('uml_class', 200, 130);
    placeShape('uml_class', 200, 420);
    placeShape('uml_interface', 560, 130);
    const [animal, dog, comparable] = S.nodes;
    animal.sections = [{ text: 'Animal', style: 'header' }, { rows: ['- name: String', '- age: int'], style: 'list' }, { rows: ['+ eat()', '+ sleep()'], style: 'list' }];
    animal.abstract = true; animal.text = '';
    dog.sections = [{ text: 'Dog', style: 'header' }, { rows: ['- breed: String'], style: 'list' }, { rows: ['+ bark()'], style: 'list' }];
    dog.text = '';
    comparable.sections = [{ text: 'Comparable', style: 'header', stereotype: 'interface' }, { rows: ['+ compareTo()'], style: 'list' }];
    comparable.text = '';
    addEdge(dog.id, animal.id, { umlType: 'generalization' });
    addEdge(dog.id, comparable.id, { umlType: 'realization' });
    S.sel = []; render();
  });
  await page.screenshot({ path: shotPath('35_uml.png') });
  console.log('35 done');

  // ============================================================
  //  v8.00 新機能
  // ============================================================

  // 40: ガント見出し欄（表題部＋承認欄＋凡例）付きの工程表
  //   見出しは工程表の全幅（時間軸の右端）に合わせて描画され、承認欄(右上)・凡例が右端に来るため、
  //   ビューポートを一時的に広げて見出し全体を収める。
  await page.setViewport({ width: 2000, height: 950 });
  await page.evaluate(() => {
    window._reset('gantt');
    // 工事名＝図の名称（連動）。前工程の名称が残らないよう明示設定する。
    const nameInp = document.getElementById('diagram-name');
    if (nameInp) { nameInp.value = '○○ビル新築工事'; nameInp.dispatchEvent(new Event('input')); }
    const g = S.gantt;
    g.startDate = '2026-05-01'; g.endDate = '2026-05-29'; g.scale = 'day'; g.colWidth = 26; g.visibleUnits = 28;
    g.header.show = true;
    g.header.title = '○○ビル新築工事';
    g.header.rows = [
      { label: '工事場所', value: '東京都千代田区○○' },
      { label: '発注者', value: '株式会社○○' },
      { label: '工期', value: '2026/05/01〜2026/08/31' },
      { label: '担当', value: '山田 太郎' },
    ];
    g.header.showDate = true;
    g.header.approval = { show: true, slots: [{ role: '承認', name: '部長' }, { role: '確認', name: '課長' }, { role: '作成', name: '山田' }] };
    g.legend = { show: true, auto: true, overrides: {}, extra: [] };
    const add = (o) => { S.nodes.push(Object.assign({ id: uid(), progress: 0, desc: '', assignee: '' }, o)); };
    add({ type: 'gantt_summary', row: 0, text: '基礎工事', startDate: '2026-05-04', endDate: '2026-05-15' });
    add({ type: 'gantt_task', row: 1, text: '掘削', assignee: '佐藤', startDate: '2026-05-04', endDate: '2026-05-08', progress: 100 });
    add({ type: 'gantt_task', row: 2, text: '配筋', assignee: '鈴木', startDate: '2026-05-11', endDate: '2026-05-15', progress: 60 });
    add({ type: 'gantt_milestone', row: 3, text: '基礎完了', date: '2026-05-15' });
    S.sel = []; render();
  });
  await wait(200);
  // 描画内容の右端に合わせてクリップ（見出しの右端＝時間軸の右端。固定データのため約1330px）
  await page.screenshot({ path: shotPath('40_gantt_header.png'), clip: { x: 0, y: 0, width: 1330, height: 950 } });
  console.log('40 done');
  // 以降のクリップ/モーダル撮影のため既定ビューポートに戻す
  await page.setViewport({ width: 1200, height: 900 });
  await wait(150);
  await page.evaluate(() => { render(); });

  // 41: サイドパネルの「見出し・凡例」セクション（クリップ）
  const headBox = await page.evaluate(() => {
    const ph = document.getElementById('gantt-head-ph');
    const body = document.getElementById('gantt-head-body');
    if (!ph) return null;
    const r1 = ph.getBoundingClientRect();
    const r2 = body ? body.getBoundingClientRect() : r1;
    const top = Math.min(r1.y, r2.y), bottom = Math.max(r1.bottom, r2.bottom);
    const left = Math.min(r1.x, r2.x), right = Math.max(r1.right, r2.right);
    return { x: Math.max(0, left - 4), y: Math.max(0, top - 4), width: Math.min(right - left + 8, 340), height: Math.min(bottom - top + 8, 880) };
  });
  if (headBox && headBox.height > 20 && headBox.width > 20) {
    await page.screenshot({ path: shotPath('41_gantt_header_panel.png'), clip: headBox });
    console.log('41 done');
  } else {
    console.log('41 skipped (panel box not found)');
  }

  // 42: 「見出しを編集」ダイアログ
  await page.evaluate(() => { openGanttHeadEditor(); });
  await wait(350);
  await page.screenshot({ path: shotPath('42_gantt_header_modal.png') });
  console.log('42 done');
  await page.evaluate(() => { closeGanttHeadEditor(); });

  // 45: テキストから作図ダイアログ
  await page.evaluate(() => {
    window._reset('flowchart');
    openText2Diagram();
    const ta = document.getElementById('t2d-input');
    if (ta) {
      ta.value = 'flowchart TD\n  A[受付] --> B{在庫あり?}\n  B -->|はい| C[出荷]\n  B -->|いいえ| D[発注]';
      ta.dispatchEvent(new Event('input'));
    }
  });
  await wait(300);
  await page.screenshot({ path: shotPath('45_textgen_modal.png') });
  console.log('45 done');
  await page.evaluate(() => { closeText2Diagram(); });

  // 46: 検索・置換パネル
  await page.evaluate(() => {
    window._reset('flowchart');
    addNode('rect', 150, 130, { text: '申請書作成' });
    addNode('rect', 360, 130, { text: '申請内容確認' });
    addNode('rect', 260, 280, { text: '申請却下' });
    S.sel = []; render();
    openSearch();
    const inp = document.getElementById('search-input');
    if (inp) { inp.value = '申請'; inp.dispatchEvent(new Event('input')); }
  });
  await wait(300);
  await page.screenshot({ path: shotPath('46_search_panel.png') });
  console.log('46 done');

  await browser.close();
  console.log('All screenshots captured successfully.');
})();
