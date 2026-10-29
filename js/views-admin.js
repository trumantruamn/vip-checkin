/* 後台管理：總覽／活動／匯入／類別／存取碼／匯出列印／設定 */
(function () {
'use strict';
var V = window.VIP, S = V.S, U = V.u, esc = U.esc, T = U.fmtT;
function $(s, r) { return (r || document).querySelector(s); }
function debounce(fn, ms) { var t; return function () { var a = arguments, c = this; clearTimeout(t); t = setTimeout(function () { fn.apply(c, a); }, ms); }; }
var root, tab = U.lsGet('vip.adminTab', 'over');
var TABS = [['over', '📋 總覽'], ['event', '📅 活動'], ['imp', '📥 匯入名單'], ['cats', '🏷 類別'], ['codes', '🔑 存取碼'], ['out', '📤 匯出列印'], ['set', '⚙️ 設定']];
var ov = {q: '', cat: '', f: 'all', limit: 60};
function admin(cmd, extra) {
  var b = Object.assign({op: 'admin', code: S.code, ev: S.evId, cmd: cmd, staff: S.staff}, extra || {});
  return V.api(b).then(function (r) { if (!r.ok) throw new Error(r.msg || r.error); return r; });
}
V.admin = admin;
function err(e) { V.toast(String(e && e.message || e), 'bad'); }

V.views.admin = {
  mount: function (r) {
    root = r;
    r.innerHTML = '<div class="tabs admin-tabs" id="atabs"></div><div id="apane" class="apane"></div>';
    r.onclick = function (e) { var b = e.target.closest('[data-atab]'); if (b) { tab = b.dataset.atab; U.lsSet('vip.adminTab', tab); render(); } };
    render();
  },
  update: function () { if (tab === 'over') drawOver(); else if (tab === 'cats') {} else if (tab === 'out') { drawOutStats(); } }
};
function render() {
  if (!root) return;
  $('#atabs', root).innerHTML = TABS.map(function (t) { return '<button class="chip' + (tab === t[0] ? ' on' : '') + '" data-atab="' + t[0] + '">' + t[1] + '</button>'; }).join('');
  var p = $('#apane', root); p.innerHTML = '';
  if (!S.evId && tab !== 'event') { p.innerHTML = '<div class="empty">請先到「活動」建立或選擇一個活動</div>'; return; }
  ({over: paneOver, event: paneEvent, imp: paneImport, cats: paneCats, codes: paneCodes, out: paneOut, set: paneSet})[tab](p);
}

/* ---------- 總覽 ---------- */
var STG = ['pk', 'dl', 'ci', 'cl', 'se', 'an'], STL = {pk: '接到', dl: '送達', ci: '報到', cl: '認領', se: '入座', an: '唱名'};
function paneOver(p) {
  p.innerHTML = '<div class="bar"><input id="oq" class="inp search" placeholder="🔍 搜尋姓名／單位／桌次" value="' + esc(ov.q) + '"><button class="btn primary" id="oadd">＋ 新增貴賓</button></div>' +
    '<div class="subbar"><select id="ocat" class="inp sm">' + V.catOptions(ov.cat, true) + '</select><select id="of" class="inp sm"><option value="all">全部狀態</option><option value="absent">未到</option><option value="ci">已報到</option><option value="wait">等待帶位</option><option value="se">已入座</option><option value="an">已唱名</option><option value="tr">需接送</option></select><span id="ocount" class="stat-pill"></span></div>' +
    '<div class="twrap"><table class="tbl big" id="otbl"></table></div><div id="omore"></div>';
  $('#of', p).value = ov.f;
  $('#oq', p).oninput = debounce(function (e) { ov.q = e.target.value; ov.limit = 60; drawOver(); }, 120);
  $('#ocat', p).onchange = function (e) { ov.cat = e.target.value; ov.limit = 60; drawOver(); };
  $('#of', p).onchange = function (e) { ov.f = e.target.value; ov.limit = 60; drawOver(); };
  $('#oadd', p).onclick = function () { guestModal(null); };
  p.onclick = function (e) {
    var tdc = e.target.closest('[data-stg]');
    if (tdc) { var id = tdc.closest('tr').dataset.id, s = tdc.dataset.stg, r = V.get(id);
      if (r[s]) V.confirm('清除「' + esc(r.name) + '」的「' + STL[s] + '」紀錄？', '清除', true).then(function (ok) { if (ok) V.stage(id, s, 0); });
      else V.confirm('手動將「' + esc(r.name) + '」標記為「' + STL[s] + '」（時間＝現在）？', '標記').then(function (ok) { if (ok) V.stage(id, s, 1); });
      return; }
    var ed = e.target.closest('[data-edit]'); if (ed) { guestModal(ed.closest('tr').dataset.id); return; }
    if (e.target.id === 'omoreb') { ov.limit += 100; drawOver(); }
  };
  p.onchange = function (e) {
    var t = e.target, tr = t.closest('tr'); if (!tr || !t.dataset.f) return;
    var f = {}; f[t.dataset.f] = t.value.trim(); V.act({a: 'edit', g: tr.dataset.id, f: f});
  };
  drawOver();
}
function drawOver() {
  var p = $('#apane', root), tb = $('#otbl', p); if (!tb) return;
  var all = V.list(), shown = all.filter(function (r) {
    if (ov.cat && r.cat !== ov.cat) return false;
    if (!U.matches(r, ov.q)) return false;
    switch (ov.f) { case 'absent': return U.isExpected(r) && !r.ci; case 'ci': return !!r.ci; case 'wait': return r.ci && !r.se; case 'se': return !!r.se; case 'an': return !!r.an; case 'tr': return U.isTr(r); }
    return true;
  }).sort(function (a, b) { return (a.seq || 99999) - (b.seq || 99999); });
  $('#ocount', p).textContent = shown.length + ' / ' + all.length + ' 位';
  var focus = document.activeElement && document.activeElement.closest && document.activeElement.closest('#otbl');
  if (focus && document.activeElement.tagName === 'INPUT') return;   // 正在編輯時不重繪
  var h = '<tr><th>序</th><th>姓名</th><th>單位／職稱</th><th>類別</th><th>桌次</th><th>接送</th>' + STG.map(function (s) { return '<th>' + STL[s] + '</th>'; }).join('') + '<th></th></tr>';
  shown.slice(0, ov.limit).forEach(function (r) {
    h += '<tr data-id="' + r.id + '"><td>' + (r.seq && r.seq < 99999 ? r.seq : '') + '</td><td class="nm"><b>' + esc(r.name) + '</b>' + (r.walk ? ' <span class="tag walk">現場</span>' : '') + (r.rsvp === '請假' ? ' <span class="tag warn">請假</span>' : '') + '</td><td class="org">' + esc(U.addrName(r)) + '</td>' +
      '<td><select class="inp sm" data-f="cat">' + V.catOptions(r.cat, false) + '</select></td><td><input class="inp sm tin" data-f="tbl" value="' + esc(r.tbl || '') + '" placeholder="桌次"></td><td class="sm">' + esc([r.tr, r.veh].filter(Boolean).join(' / ')) + '</td>' +
      STG.map(function (s) { return '<td class="stg ' + (r[s] ? 'on' : '') + '" data-stg="' + s + '" title="' + esc(r[s] ? (r[s + 'By'] || '') : '點擊手動標記') + '">' + (r[s] ? T(r[s]) + '<small>' + esc(r[s + 'By'] || '') + '</small>' : '–') + '</td>'; }).join('') + '<td><button class="btn sm" data-edit>編輯</button></td></tr>';
  });
  tb.innerHTML = h;
  $('#omore', p).innerHTML = shown.length > ov.limit ? '<button class="btn" id="omoreb">顯示更多（還有 ' + (shown.length - ov.limit) + ' 位）</button>' : '';
}
function guestModal(id) {
  var r = id ? V.get(id) : {}, f = {};
  var fields = [['seq', '序'], ['name', '姓名 *'], ['org', '單位名稱'], ['title', '職稱'], ['rsvp', '回覆情形'], ['grp', '報到組別'], ['tbl', '桌次/座位'], ['tr', '接送人員'], ['veh', '車號'], ['pl', '接送地點'], ['note', '備註']];
  var h = '<h3>' + (id ? '編輯貴賓' : '新增貴賓') + '</h3><div class="form">';
  fields.forEach(function (x) { h += '<label>' + x[1] + '<input class="inp" id="f-' + x[0] + '" value="' + esc(r[x[0]] || '') + '"></label>'; });
  h += '<label>類別<select class="inp" id="f-cat">' + V.catOptions(r.cat, false) + '</select></label></div><div class="m-btns">' + (id ? '<button class="btn danger" id="f-del">刪除</button>' : '') + '<button class="btn" data-close>取消</button><button class="btn primary" id="f-ok">儲存</button></div>';
  var m = V.modal(h, {sticky: true});
  $('#f-ok', m).onclick = function () {
    fields.concat([['cat']]).forEach(function (x) { f[x[0]] = $('#f-' + x[0], m).value.trim(); });
    if (!f.name) { V.toast('姓名必填', 'bad'); return; }
    if (f.seq) f.seq = +f.seq || 0;
    if (id) V.act({a: 'edit', g: id, f: f}); else V.act({a: 'add', g: 'a' + U.uid(9), f: f});
    m.close();
  };
  if (id) $('#f-del', m).onclick = function () { V.confirm('確定刪除「' + esc(r.name) + '」？', '刪除', true).then(function (ok) { if (ok) { V.act({a: 'del', g: id}); m.close(); } }); };
}

/* ---------- 活動 ---------- */
function refreshEvents() { return admin('events').then(function (r) { S.events = r.events; return r; }); }
function paneEvent(p) {
  function draw() {
    var h = '<div class="pnl"><h3>活動列表</h3>';
    (S.events || []).forEach(function (e) {
      h += '<div class="evrow' + (e.id === S.evId ? ' cur' : '') + '"><div><b>' + esc(e.name) + '</b> <span class="muted">' + esc(e.date) + '</span>' + (e.status === 'archived' ? ' <span class="tag warn">已封存</span>' : '') + (e.id === S.evId ? ' <span class="tag hot">目前選用</span>' : '') + '</div><div class="evb">' +
        (e.id !== S.evId ? '<button class="btn sm primary" data-sel="' + e.id + '">選用</button>' : '') + '<button class="btn sm" data-ren="' + e.id + '">改名／日期</button><button class="btn sm" data-arc="' + e.id + '">' + (e.status === 'archived' ? '取消封存' : '封存') + '</button></div></div>';
    });
    if (!(S.events || []).length) h += '<div class="empty">還沒有活動，請在下方建立</div>';
    h += '</div><div class="pnl"><h3>＋ 建立新活動</h3><div class="form"><label>活動名稱<input id="en" class="inp" placeholder="例如 2026 感恩晚宴"></label><label>日期<input id="ed" class="inp" type="date" value="2026-10-31"></label></div><button class="btn primary" id="ecreate">建立活動</button><p class="muted small">建立後會自動產生各組存取碼；名單請到「匯入名單」。</p></div>';
    p.innerHTML = h;
    $('#ecreate', p).onclick = function () {
      var n = $('#en', p).value.trim(); if (!n) { V.toast('請輸入活動名稱', 'bad'); return; }
      admin('event.create', {name: n, date: $('#ed', p).value}).then(function (r) { return refreshEvents().then(function () { V.switchEvent(r.event.id); V.toast('已建立並切換到新活動'); tab = 'imp'; render(); }); }).catch(err);
    };
    p.querySelectorAll('[data-sel]').forEach(function (b) { b.onclick = function () { V.switchEvent(b.dataset.sel); V.toast('已切換活動'); render(); }; });
    p.querySelectorAll('[data-ren]').forEach(function (b) { b.onclick = function () {
      var e = S.events.filter(function (x) { return x.id === b.dataset.ren; })[0];
      var m = V.modal('<h3>修改活動</h3><div class="form"><label>名稱<input class="inp" id="rn" value="' + esc(e.name) + '"></label><label>日期<input class="inp" type="date" id="rd" value="' + esc(e.date) + '"></label></div><div class="m-btns"><button class="btn" data-close>取消</button><button class="btn primary" id="rok">儲存</button></div>');
      $('#rok', m).onclick = function () { admin('event.update', {ev: e.id, name: $('#rn', m).value, date: $('#rd', m).value}).then(refreshEvents).then(function () { m.close(); draw(); V.forceResync(); }).catch(err); };
    }; });
    p.querySelectorAll('[data-arc]').forEach(function (b) { b.onclick = function () {
      var e = S.events.filter(function (x) { return x.id === b.dataset.arc; })[0];
      admin('event.update', {ev: e.id, status: e.status === 'archived' ? 'active' : 'archived'}).then(refreshEvents).then(draw).catch(err);
    }; });
  }
  refreshEvents().then(draw).catch(err); draw();
}

/* ---------- 匯入 ---------- */
var ALIAS = {
  seq: ['序', '序號', '順序', '編號', 'no', 'no.', '#', '唱名順序'], cat: ['類別', '分類', '身分別', '類型', '貴賓類別'], org: ['單位名稱', '單位', '機關', '公司', '組織', '服務單位', '機關團體'],
  title: ['職稱', '職銜', '頭銜', '職務'], name: ['姓名', '名字', '貴賓姓名', '貴賓'], rsvp: ['回覆情形', '回覆', '出席情形', '出席回覆', '是否出席'],
  grp: ['報到組別', '報到組', '組別'], tbl: ['桌次/座位', '桌次', '桌號', '座位', '席次', '桌次座位'], note: ['備註', '說明', '附註'],
  tr: ['接送人員', '接送', '交通', '司機', '駕駛', '接送司機', '交通接送'], veh: ['車號', '車牌', '車輛', '車牌號碼'], pl: ['接送地點', '上車地點', '接送地', '集合地點', '地點']
};
var FIELD_LABEL = {seq: '序', cat: '類別', org: '單位名稱', title: '職稱', name: '姓名', rsvp: '回覆情形', grp: '報到組別', tbl: '桌次/座位', note: '備註', tr: '接送人員', veh: '車號', pl: '接送地點'};
function cleanH(s) { return String(s == null ? '' : s).replace(/[\s\u3000*＊（）()]/g, '').toLowerCase(); }
function mapHeaders(row) {
  var map = {}, used = {};
  row.forEach(function (h, i) {
    var c = cleanH(h); if (!c) return;
    for (var f in ALIAS) if (!used[f] && ALIAS[f].some(function (a) { return cleanH(a) === c; })) { map[i] = f; used[f] = 1; return; }
  });
  return map;
}
function parseWorkbook(wb) {
  var best = null, skip = /分類|說明|填寫|設定|readme/i;
  wb.SheetNames.forEach(function (sn) {
    var rows = XLSX.utils.sheet_to_json(wb.Sheets[sn], {header: 1, defval: '', raw: false});
    for (var i = 0; i < Math.min(rows.length, 12); i++) {
      var map = mapHeaders(rows[i]);
      if (Object.keys(map).some(function (k) { return map[k] === 'name'; })) {
        var data = rows.slice(i + 1).filter(function (r) { return r.some(function (c) { return String(c).trim(); }); });
        var score = data.length - (skip.test(sn) ? 10000 : 0);
        if (!best || score > best.score) best = {sheet: sn, headerRow: i, map: map, data: data, score: score, header: rows[i]};
        return;
      }
    }
  });
  return best;
}
function toRows(best) {
  var out = [];
  best.data.forEach(function (r) {
    var o = {}; for (var i in best.map) o[best.map[i]] = String(r[i] == null ? '' : r[i]).trim();
    if (o.seq) o.seq = parseInt(o.seq, 10) || 0;
    out.push(o);
  });
  return out;
}
function loadXlsx() {
  return new Promise(function (res, rej) {
    if (window.XLSX) return res();
    function add(src, next) { var s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = next; document.head.appendChild(s); }
    add('lib/xlsx.full.min.js', function () { add('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js', function () { rej(new Error('無法載入 Excel 元件')); }); });
  });
}
V.loadXlsx = loadXlsx;
function decodeCsv(buf) {
  try { return new TextDecoder('utf-8', {fatal: true}).decode(buf).replace(/^\uFEFF/, ''); }
  catch (e) { try { return new TextDecoder('big5').decode(buf); } catch (e2) { return new TextDecoder('utf-8').decode(buf); } }
}
function paneImport(p) {
  p.innerHTML = '<div class="pnl"><h3>📥 匯入貴賓名單</h3><p class="muted">支援 Excel（.xlsx/.xls）與 CSV（含 Big5 編碼）。第一列需有欄位名稱，「姓名」為必填。<a href="貴賓名單範本.xlsx" download>下載範本</a></p>' +
    '<input type="file" id="file" accept=".xlsx,.xls,.csv,.txt" class="file"><div id="prev"></div></div>';
  $('#file', p).onchange = function (e) {
    var f = e.target.files[0]; if (!f) return;
    var prev = $('#prev', p); prev.innerHTML = '讀取中…';
    Promise.all([loadXlsx(), new Promise(function (res) { var fr = new FileReader(); fr.onload = function () { res(fr.result); }; fr.readAsArrayBuffer(f); })]).then(function (a) {
      var buf = a[1], wb;
      if (/\.(csv|txt)$/i.test(f.name)) wb = XLSX.read(decodeCsv(buf), {type: 'string'}); else wb = XLSX.read(buf, {type: 'array'});
      var best = parseWorkbook(wb);
      if (!best) { prev.innerHTML = '<div class="err">找不到「姓名」欄位。請確認第一列是欄位名稱（序、類別、單位名稱、職稱、姓名…）。</div>'; return; }
      showPreview(prev, best, f.name);
    }).catch(function (er) { prev.innerHTML = '<div class="err">' + esc(er.message || er) + '</div>'; });
  };
}
function showPreview(prev, best, fname) {
  var rows = toRows(best), valid = rows.filter(function (r) { return r.name; }), skipped = rows.length - valid.length;
  var names = {}, dups = []; valid.forEach(function (r) { var k = r.name + '|' + (r.org || ''); if (names[k]) dups.push(r.name); names[k] = 1; });
  var cats = {}; valid.forEach(function (r) { if (r.cat) cats[r.cat] = 1; });
  var evCats = (S.ev && S.ev.cats) || [], newCats = Object.keys(cats).filter(function (c) { return evCats.indexOf(c) < 0; });
  var hasTr = valid.filter(function (r) { return r.tr || r.veh || r.pl; }).length;
  var cols = Object.keys(best.map).map(function (k) { return best.map[k]; });
  var h = '<div class="ok-box">檔案「' + esc(fname) + '」工作表「' + esc(best.sheet) + '」：共 <b>' + valid.length + '</b> 位貴賓' + (skipped ? '（略過 ' + skipped + ' 列沒有姓名）' : '') + '，其中 ' + hasTr + ' 位有接送資訊。</div>';
  h += '<div class="muted small">辨識到的欄位：' + cols.map(function (c) { return '<span class="tag">' + FIELD_LABEL[c] + '</span>'; }).join(' ') + '</div>';
  if (dups.length) h += '<div class="warn-box">⚠ 有 ' + dups.length + ' 筆「姓名＋單位」重複：' + esc(dups.slice(0, 6).join('、')) + (dups.length > 6 ? '…' : '') + '</div>';
  if (newCats.length) h += '<div class="warn-box">新類別會自動加入：' + esc(newCats.join('、')) + '</div>';
  h += '<div class="twrap"><table class="tbl"><tr>' + cols.map(function (c) { return '<th>' + FIELD_LABEL[c] + '</th>'; }).join('') + '</tr>';
  valid.slice(0, 6).forEach(function (r) { h += '<tr>' + cols.map(function (c) { return '<td>' + esc(r[c] || '') + '</td>'; }).join('') + '</tr>'; });
  h += '</table></div><div class="form"><label>匯入方式<select id="mode" class="inp"><option value="replace">取代目前名單（清空後匯入，報到紀錄會清除）</option><option value="merge">合併更新（以「姓名＋單位」比對，保留已有的報到紀錄）</option><option value="append">全部附加在後面</option></select></label></div><button class="btn primary xl" id="doimp">開始匯入 ' + valid.length + ' 位</button><div id="impst"></div>';
  prev.innerHTML = h;
  $('#doimp', prev).onclick = function () {
    var mode = $('#mode', prev).value, btn = this;
    V.confirm(mode === 'replace' ? '將「清空目前名單」並匯入 ' + valid.length + ' 位，確定嗎？' : '匯入 ' + valid.length + ' 位貴賓，確定嗎？', '匯入', mode === 'replace').then(function (ok) {
      if (!ok) return;
      btn.disabled = true; var added = 0, updated = 0, i = 0, CH = 150, st = $('#impst', prev);
      (function next() {
        if (i >= valid.length) {
          var go = newCats.length ? admin('cats.set', {cats: evCats.concat(newCats)}) : Promise.resolve();
          go.then(function () { st.innerHTML = '<div class="ok-box">✅ 匯入完成：新增 ' + added + '、更新 ' + updated + ' 位</div>'; V.forceResync(); btn.disabled = false; }).catch(err); return;
        }
        st.textContent = '匯入中… ' + i + ' / ' + valid.length;
        admin('guests.import', {mode: mode, start: i === 0, rows: valid.slice(i, i + CH)}).then(function (r) { added += r.added; updated += r.updated; i += CH; next(); }).catch(function (e) { st.innerHTML = '<div class="err">匯入失敗：' + esc(e.message) + '（可重新匯入）</div>'; btn.disabled = false; });
      })();
    });
  };
}

/* ---------- 類別 ---------- */
function paneCats(p) {
  var cats = ((S.ev && S.ev.cats) || []).map(function (c) { return {o: c, n: c}; });
  function draw() {
    var counts = {}; V.list().forEach(function (r) { counts[r.cat || ''] = (counts[r.cat || ''] || 0) + 1; });
    var h = '<div class="pnl"><h3>🏷 類別管理</h3><p class="muted small">修改名稱會同步更新所有貴賓；刪除類別不會刪除貴賓（該類別貴賓會變成「未分類」）。</p>';
    cats.forEach(function (c, i) { h += '<div class="catrow"><input class="inp" data-i="' + i + '" value="' + esc(c.n) + '"><span class="muted small">' + (counts[c.o] || 0) + ' 位</span><button class="btn sm" data-up="' + i + '">↑</button><button class="btn sm danger" data-rm="' + i + '">刪除</button></div>'; });
    h += '<div class="catrow"><input class="inp" id="newcat" placeholder="新增類別名稱"><button class="btn sm primary" id="addcat">新增</button></div><button class="btn primary xl" id="savecat">儲存類別</button></div>';
    p.innerHTML = h;
    p.querySelectorAll('input[data-i]').forEach(function (el) { el.oninput = function () { cats[+el.dataset.i].n = el.value; }; });
    p.querySelectorAll('[data-rm]').forEach(function (b) { b.onclick = function () { cats.splice(+b.dataset.rm, 1); draw(); }; });
    p.querySelectorAll('[data-up]').forEach(function (b) { b.onclick = function () { var i = +b.dataset.up; if (i > 0) { var t = cats[i]; cats[i] = cats[i - 1]; cats[i - 1] = t; draw(); } }; });
    $('#addcat', p).onclick = function () { var v = $('#newcat', p).value.trim(); if (v) { cats.push({o: null, n: v}); draw(); } };
    $('#savecat', p).onclick = function () {
      var ren = {}; cats.forEach(function (c) { if (c.o && c.n.trim() && c.o !== c.n.trim()) ren[c.o] = c.n.trim(); });
      admin('cats.set', {cats: cats.map(function (c) { return c.n.trim(); }).filter(Boolean), renames: ren}).then(function () { V.toast('已儲存類別'); V.forceResync(); setTimeout(function () { cats = ((S.ev && S.ev.cats) || []).map(function (c) { return {o: c, n: c}; }); draw(); }, 800); }).catch(err);
    };
  }
  draw();
}

/* ---------- 存取碼 ---------- */
function linkBase() { return location.origin + location.pathname.replace(/[^/]*$/, ''); }
function paneCodes(p) {
  function draw(codes) {
    var base = linkBase(), extra = (!window.VIP_CONFIG.API_URL && V.apiUrl && !V.demo) ? '&api=' + encodeURIComponent(V.apiUrl) : '';
    var h = '<div class="pnl"><h3>🔑 存取碼與連結</h3><p class="muted">只有兩組碼：<b>工作人員共用碼</b>（四個工作組共用，登入後在手機上選自己的組別）與<b>總召專用碼</b>（只能看、不能操作）。' + (V.demo ? '<br><b>預覽模式：連結只在這個瀏覽器有效。</b>' : '') + '</p>';
    var defs = [
      ['staff', '👥 工作人員共用碼', '交通組・報到組・接待組・舞台組 共用', '登入後自己選組別，隨時可切換。每一組只能按自己負責的步驟，但看得到所有組別的進度。', '工作人員報到系統連結'],
      ['director', '📊 活動總召專用碼', '只能看，不能操作', '即時總覽儀表板，無法按任何動作按鈕。', '活動總召儀表板連結']
    ];
    defs.forEach(function (d) {
      var k = d[0], c = codes[k] || '', link = base + '?c=' + c + extra;
      h += '<div class="coderow" data-code-role="' + k + '"><div class="cr-h"><b>' + d[1] + '</b> <span class="muted small">' + d[2] + '</span></div><div class="cr-note">' + d[3] + '</div><div class="cr-c">' + esc(c) + '</div><input class="inp sm" readonly value="' + esc(link) + '" onclick="this.select()">' +
        '<div class="cr-b"><button class="btn sm" data-copy="' + esc(link) + '">複製連結</button><a class="btn sm" target="_blank" rel="noopener" href="https://line.me/R/msg/text/?' + encodeURIComponent(d[4] + '（存取碼 ' + c + '）\n' + link) + '">LINE 分享</a><a class="btn sm" target="_blank" href="' + esc(link) + '">開啟</a><button class="btn sm danger" data-regen="' + k + '">重新產生</button></div></div>';
    });
    h += '<div class="coderow"><div class="cr-h"><b>⚙️ 後台管理</b></div><div class="muted">使用你在 Apps Script「指令碼屬性」設定的 ADMIN_CODE（管理密碼）登入' + (V.demo ? '（預覽版：這個頁面已用管理權限登入）' : '') + '。請勿傳給他人。</div></div></div>';
    p.innerHTML = h;
    p.querySelectorAll('[data-copy]').forEach(function (b) { b.onclick = function () { (navigator.clipboard ? navigator.clipboard.writeText(b.dataset.copy) : Promise.reject()).then(function () { V.toast('已複製連結'); }, function () { prompt('請手動複製：', b.dataset.copy); }); }; });
    p.querySelectorAll('[data-regen]').forEach(function (b) { b.onclick = function () {
      V.confirm('重新產生「' + (b.dataset.regen === 'staff' ? '工作人員共用碼' : '總召專用碼') + '」？舊碼與舊連結會立即失效，' + (b.dataset.regen === 'staff' ? '所有工作人員的手機都需要重新輸入新碼。' : '總召需要用新碼重新登入。'), '重新產生', true).then(function (ok) { if (ok) admin('codes.regen', {roles: [b.dataset.regen]}).then(function (r) { draw(r.codes); }).catch(err); });
    }; });
  }
  admin('codes.get').then(function (r) { draw(r.codes); }).catch(err);
}

/* ---------- 匯出／列印 ---------- */
function drawOutStats() {}
function rowsForExport() {
  return V.list().sort(function (a, b) { return (a.seq || 99999) - (b.seq || 99999); }).map(function (r) {
    return [r.seq && r.seq < 99999 ? r.seq : '', r.cat || '', r.org || '', r.title || '', r.name || '', r.rsvp || '', r.grp || '', r.tbl || '', r.note || '', r.tr || '', r.veh || '', r.pl || '', r.walk ? '是' : '',
      U.fmtDT(r.pk), r.pkBy || '', U.fmtDT(r.dl), r.dlBy || '', U.fmtDT(r.ci), r.ciBy || '', U.fmtDT(r.cl), r.clBy || '', U.fmtDT(r.se), r.seBy || '', U.fmtDT(r.an), r.anBy || ''];
  });
}
var EXPORT_HEAD = ['序', '類別', '單位名稱', '職稱', '姓名', '回覆情形', '報到組別', '桌次/座位', '備註', '接送人員', '車號', '接送地點', '現場新增', '接到時間', '接到人員', '送達時間', '送達人員', '報到時間', '報到人員', '認領時間', '認領人員', '入座時間', '入座人員', '唱名時間', '唱名人員'];
function exportXlsx() {
  return loadXlsx().then(function () { return admin('log.get').catch(function () { return {log: []}; }); }).then(function (lg) {
    var wb = XLSX.utils.book_new(), ws = XLSX.utils.aoa_to_sheet([EXPORT_HEAD].concat(rowsForExport()));
    ws['!cols'] = EXPORT_HEAD.map(function (h, i) { return {wch: i === 2 ? 22 : i === 8 ? 24 : (i >= 13 && i % 2 === 1) ? 18 : 12}; });
    XLSX.utils.book_append_sheet(wb, ws, '貴賓名單與結果');
    var all = V.list(), exp = all.filter(U.isExpected), cnt = function (f) { return all.filter(f).length; };
    var sum = [['活動', S.ev ? S.ev.name : ''], ['日期', S.ev ? S.ev.date : ''], ['匯出時間', U.fmtDT(Date.now())], [], ['預計出席', exp.length], ['已接到', cnt(function (r) { return r.pk; })], ['已送達門口', cnt(function (r) { return r.dl; })], ['已報到', cnt(function (r) { return r.ci; })], ['  其中現場新增', cnt(function (r) { return r.walk; })], ['已入座', cnt(function (r) { return r.se; })], ['已唱名', cnt(function (r) { return r.an; })], ['未到（預計出席）', exp.filter(function (r) { return !r.ci; }).length]];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sum), '統計');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['時間', '活動', '組別／角色', '人員', '裝置', '貴賓', '動作', '說明']].concat((lg.log || []).map(function (x) { x = x.slice(); if (V.ROLES[x[2]]) x[2] = V.ROLES[x[2]].name; return x; }))), '操作紀錄');
    var name = (S.ev ? S.ev.name : '活動').replace(/[\\\/:*?"<>|\s]+/g, ' ').trim().slice(0, 40) + '_報到結果_' + U.fmtDT(Date.now()).replace(/[-: ]/g, '').slice(0, 12) + '.xlsx';
    XLSX.writeFile(wb, name);
    V.toast('已匯出 Excel');
  });
}
function printTables() {
  var all = V.list().sort(function (a, b) { return U.tblNum(a.tbl) - U.tblNum(b.tbl) || (a.seq || 0) - (b.seq || 0); }), cur = null, h = '<div id="print-area"><h2>' + esc(S.ev ? S.ev.name : '') + ' 桌次名單（備援）</h2><table><tr><th>桌次</th><th>序</th><th>姓名</th><th>單位／職稱</th><th>到</th></tr>';
  all.forEach(function (r) { var t = U.tblLabel(r.tbl) || '未排桌'; h += '<tr' + (t !== cur ? ' class="brk"' : '') + '><td>' + (t !== cur ? '<b>' + esc(t) + '</b>' : '') + '</td><td>' + (r.seq && r.seq < 99999 ? r.seq : '') + '</td><td><b>' + esc(r.name) + '</b></td><td>' + esc(U.addrName(r)) + '</td><td>☐</td></tr>'; cur = t; });
  V.printHtml(h + '</table></div>');
}
function printAlpha() {
  var all = V.list().sort(function (a, b) { return (a.name || '').localeCompare(b.name || '', 'zh-Hant'); });
  var h = '<div id="print-area"><h2>' + esc(S.ev ? S.ev.name : '') + ' 報到名冊（依姓名）</h2><table><tr><th>姓名</th><th>單位／職稱</th><th>類別</th><th>桌次</th><th>簽到</th></tr>';
  all.forEach(function (r) { h += '<tr><td><b>' + esc(r.name) + '</b></td><td>' + esc(U.addrName(r)) + '</td><td>' + esc(r.cat) + '</td><td>' + esc(U.tblLabel(r.tbl)) + '</td><td>☐</td></tr>'; });
  V.printHtml(h + '</table></div>');
}
function paneOut(p) {
  p.innerHTML = '<div class="pnl"><h3>📤 匯出與列印</h3><div class="outb"><button class="btn primary xl" id="ox">匯出完整結果 Excel（含各階段時間與操作紀錄）</button><button class="btn xl" id="op1">🖨 列印司儀唱名表（依序）</button><button class="btn xl" id="op2">🖨 列印桌次名單（備援）</button><button class="btn xl" id="op3">🖨 列印報到名冊（依姓名，紙本備援）</button></div><p class="muted small">建議活動當天開始前、中場、結束各匯出一次存檔。</p></div>';
  $('#ox', p).onclick = function () { exportXlsx().catch(err); };
  $('#op1', p).onclick = function () { var c = V.list().sort(function (a, b) { return (a.seq || 99999) - (b.seq || 99999); }), h = '<div id="print-area"><h2>' + esc(S.ev ? S.ev.name : '') + ' 司儀唱名表</h2><table><tr><th>序</th><th>類別</th><th>單位</th><th>職稱</th><th>姓名</th><th>桌次</th><th>唱名</th></tr>'; c.forEach(function (r) { h += '<tr><td>' + (r.seq && r.seq < 99999 ? r.seq : '') + '</td><td>' + esc(r.cat) + '</td><td>' + esc(r.org) + '</td><td>' + esc(r.title) + '</td><td><b>' + esc(r.name) + '</b></td><td>' + esc(U.tblLabel(r.tbl)) + '</td><td>☐</td></tr>'; }); V.printHtml(h + '</table></div>'); };
  $('#op2', p).onclick = printTables; $('#op3', p).onclick = printAlpha;
}

/* ---------- 設定 ---------- */
function paneSet(p) {
  p.innerHTML = '<div class="pnl"><h3>🔌 連線</h3><p>模式：<b>' + (V.demo ? '預覽／示範（資料在本機瀏覽器）' : '正式（Google 試算表）') + '</b></p>' + (V.demo ? '' : '<p class="small muted" style="word-break:break-all">' + esc(V.apiUrl) + '</p>') + '<button class="btn" id="ping">測試連線</button> <span id="pingr"></span></div>' +
    '<div class="pnl"><h3>⚠ 危險區</h3><p class="muted small">正式活動前，請先清除試用時產生的報到紀錄（名單與桌次會保留）。</p><button class="btn danger" id="reset">清除所有報到／接送紀錄</button></div>' +
    (V.demo ? '<div class="pnl"><h3>🧪 示範資料</h3><button class="btn" id="dreset">重新產生示範資料（400 位）</button></div>' : '');
  $('#ping', p).onclick = function () { var t = Date.now(); V.api({op: 'ping'}).then(function (r) { $('#pingr', p).innerHTML = r.ok ? '<span class="okc">✓ 正常（' + (Date.now() - t) + ' ms）' + (r.ready ? '' : '，但尚未設定管理密碼') + '</span>' : '<span class="late">異常</span>'; }).catch(function () { $('#pingr', p).innerHTML = '<span class="late">無法連線</span>'; }); };
  $('#reset', p).onclick = function () {
    var m = V.modal('<h3>清除所有報到紀錄</h3><p>這會清除所有貴賓的接到／送達／報到／帶位／入座／唱名紀錄，無法復原。請先匯出 Excel 備份。</p><label class="chk"><input type="checkbox" id="rw"> 同時移除「現場新增」的貴賓</label><p>請輸入「清除」兩字確認：</p><input class="inp" id="rc"><div class="m-btns"><button class="btn" data-close>取消</button><button class="btn danger" id="rok">確定清除</button></div>', {sticky: true});
    $('#rok', m).onclick = function () { if ($('#rc', m).value.trim() !== '清除') { V.toast('請輸入「清除」', 'bad'); return; } admin('states.reset', {removeWalkins: $('#rw', m).checked}).then(function () { m.close(); V.forceResync(); V.toast('已清除'); }).catch(err); };
  };
  var d = $('#dreset', p); if (d) d.onclick = function () { V.confirm('重新產生示範資料？目前示範資料會被覆蓋。', '重新產生', true).then(function (ok) { if (ok) window.VIPDEMO.resetAll(); }); };
}
})();
