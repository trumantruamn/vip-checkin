/* 後台管理：總覽／活動／匯入／唱名順序／類別／存取碼／匯出列印／設定 */
(function () {
'use strict';
var V = window.VIP, S = V.S, U = V.u, esc = U.esc, T = U.fmtT;
function $(s, r) { return (r || document).querySelector(s); }
function debounce(fn, ms) { var t; return function () { var a = arguments, c = this; clearTimeout(t); t = setTimeout(function () { fn.apply(c, a); }, ms); }; }
var root, tab = U.lsGet('vip.adminTab', 'over'), ordEd = null;
var TABS = [['over', '📋 總覽'], ['event', '📅 活動'], ['imp', '📥 匯入名單'], ['plan', '🗺 座位圖'], ['ord', '🎤 唱名順序'], ['cats', '🏷 類別'], ['codes', '🔑 存取碼'], ['out', '📤 匯出列印'], ['set', '⚙️ 設定']];
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
  update: function () { if (tab === 'over') drawOver(); else if (tab === 'ord' && ordEd) ordEd.update(); else if (tab === 'cats') {} else if (tab === 'out') { drawOutStats(); } },
  unmount: function () { if (ordEd) ordEd.unmount(); ordEd = null; }
};
function render() {
  if (!root) return;
  $('#atabs', root).innerHTML = TABS.map(function (t) { return '<button class="chip' + (tab === t[0] ? ' on' : '') + '" data-atab="' + t[0] + '">' + t[1] + '</button>'; }).join('');
  var p = $('#apane', root); p.innerHTML = ''; if (ordEd) { ordEd.unmount(); ordEd = null; }
  if (!S.evId && tab !== 'event') { p.innerHTML = '<div class="empty">請先到「活動」建立或選擇一個活動</div>'; return; }
  ({over: paneOver, event: paneEvent, imp: paneImport, plan: paneLayout, ord: paneOrd, cats: paneCats, codes: paneCodes, out: paneOut, set: paneSet})[tab](p);
}

/* ---------- 總覽 ---------- */
var STG = ['ci', 'se', 'an'], STL = {ci: '報到', se: '入座', an: '唱名'};
function paneOrd(p) {
  p.innerHTML = '<div class="pnl"><h3>🎤 主持人唱名順序</h3><p class="muted small">在這裡排好順序，主持人（舞台組）的畫面會依這個順序顯示、並可按「唱名」。舞台組也能自己調整。也可以在「匯入名單」用 Excel 的「唱名順序」欄一次匯入。</p><div id="ordbox"></div></div>';
  ordEd = V.mountOrder($('#ordbox', p), {admin: true}); ordEd.update();
}
function paneOver(p) {
  p.innerHTML = '<div class="bar"><input id="oq" class="inp search" placeholder="🔍 搜尋姓名／單位／桌次" value="' + esc(ov.q) + '"><button class="btn primary" id="oadd">＋ 新增貴賓</button></div>' +
    '<div class="subbar"><select id="ocat" class="inp sm">' + V.catOptions(ov.cat, true) + '</select><select id="of" class="inp sm"><option value="all">全部狀態</option><option value="absent">未到</option><option value="ci">已報到</option><option value="wait">已報到・待入座</option><option value="se">已入座</option><option value="an">已唱名</option><option value="ord">已排唱名順序</option></select><span id="ocount" class="stat-pill"></span></div>' +
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
    switch (ov.f) { case 'absent': return U.isExpected(r) && !r.ci; case 'ci': return !!r.ci; case 'wait': return r.ci && !r.se; case 'se': return !!r.se; case 'an': return !!r.an; case 'ord': return +r.ord > 0; }
    return true;
  }).sort(function (a, b) { return (a.seq || 99999) - (b.seq || 99999); });
  $('#ocount', p).textContent = shown.length + ' / ' + all.length + ' 位';
  var focus = document.activeElement && document.activeElement.closest && document.activeElement.closest('#otbl');
  if (focus && document.activeElement.tagName === 'INPUT') return;   // 正在編輯時不重繪
  var h = '<tr><th>序</th><th>姓名</th><th>單位／職稱</th><th>類別</th><th>桌次</th><th>唱名順序</th>' + STG.map(function (s) { return '<th>' + STL[s] + '</th>'; }).join('') + '<th></th></tr>';
  shown.slice(0, ov.limit).forEach(function (r) {
    h += '<tr data-id="' + r.id + '"><td>' + (r.seq && r.seq < 99999 ? r.seq : '') + '</td><td class="nm"><b>' + esc(r.name) + '</b>' + (r.walk ? ' <span class="tag walk">現場</span>' : '') + (r.rsvp === '請假' ? ' <span class="tag warn">請假</span>' : '') + '</td><td class="org">' + esc(U.addrName(r)) + '</td>' +
      '<td><select class="inp sm" data-f="cat">' + V.catOptions(r.cat, false) + '</select></td><td><input class="inp sm tin" data-f="tbl" value="' + esc(r.tbl || '') + '" placeholder="桌次"></td><td><input class="inp sm tin" data-f="ord" inputmode="numeric" value="' + (+r.ord > 0 ? r.ord : '') + '" placeholder="順序"></td>' +
      STG.map(function (s) { return '<td class="stg ' + (r[s] ? 'on' : '') + '" data-stg="' + s + '" title="' + esc(r[s] ? (r[s + 'By'] || '') : '點擊手動標記') + '">' + (r[s] ? T(r[s]) + '<small>' + esc(r[s + 'By'] || '') + '</small>' : '–') + '</td>'; }).join('') + '<td><button class="btn sm" data-edit>編輯</button></td></tr>';
  });
  tb.innerHTML = h;
  $('#omore', p).innerHTML = shown.length > ov.limit ? '<button class="btn" id="omoreb">顯示更多（還有 ' + (shown.length - ov.limit) + ' 位）</button>' : '';
}
function guestModal(id) {
  var r = id ? V.get(id) : {}, f = {};
  var fields = [['seq', '序'], ['name', '姓名 *'], ['org', '單位名稱'], ['title', '職稱'], ['rsvp', '回覆情形'], ['grp', '報到組別'], ['tbl', '桌次/座位'], ['ord', '唱名順序（數字，空白＝不排）'], ['note', '備註']];
  var h = '<h3>' + (id ? '編輯貴賓' : '新增貴賓') + '</h3><div class="form">';
  fields.forEach(function (x) { h += '<label>' + x[1] + '<input class="inp" id="f-' + x[0] + '" value="' + esc(r[x[0]] || '') + '"></label>'; });
  h += '<label>類別<select class="inp" id="f-cat">' + V.catOptions(r.cat, false) + '</select></label></div><div class="m-btns">' + (id ? '<button class="btn danger" id="f-del">刪除</button>' : '') + '<button class="btn" data-close>取消</button><button class="btn primary" id="f-ok">儲存</button></div>';
  var m = V.modal(h, {sticky: true});
  $('#f-ok', m).onclick = function () {
    fields.concat([['cat']]).forEach(function (x) { f[x[0]] = $('#f-' + x[0], m).value.trim(); });
    if (!f.name) { V.toast('姓名必填', 'bad'); return; }
    if (f.seq) f.seq = +f.seq || 0;
    f.ord = +f.ord > 0 ? +f.ord : 0;
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
  seq: ['序', '序號', '順序', '編號', 'no', 'no.', '#'], ord: ['唱名順序', '唱名序', '主持順序', '主持人順序', '主持人唱名順序', '唱名'], cat: ['類別', '分類', '身分別', '類型', '貴賓類別'], org: ['單位名稱', '單位', '機關', '公司', '組織', '服務單位', '機關團體'],
  title: ['職稱', '職銜', '頭銜', '職務'], name: ['姓名', '名字', '貴賓姓名', '貴賓'], rsvp: ['回覆情形', '回覆', '出席情形', '出席回覆', '是否出席'],
  grp: ['報到組別', '報到組', '組別'], tbl: ['桌次/座位', '桌次', '桌號', '座位', '席次', '桌次座位'], note: ['備註', '說明', '附註']
};
var FIELD_LABEL = {seq: '序', cat: '類別', org: '單位名稱', title: '職稱', name: '姓名', rsvp: '回覆情形', grp: '報到組別', tbl: '桌次/座位', note: '備註', ord: '唱名順序'};
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
    if (o.ord) o.ord = parseFloat(o.ord) > 0 ? parseFloat(o.ord) : 0;
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
  var hasOrd = valid.filter(function (r) { return +r.ord > 0; }).length;
  var cols = Object.keys(best.map).map(function (k) { return best.map[k]; });
  var h = '<div class="ok-box">檔案「' + esc(fname) + '」工作表「' + esc(best.sheet) + '」：共 <b>' + valid.length + '</b> 位貴賓' + (skipped ? '（略過 ' + skipped + ' 列沒有姓名）' : '') + '，其中 ' + hasOrd + ' 位有填「唱名順序」。</div>';
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

/* ---------- 座位圖設定（v1.4） ---------- */
var FP_TYPES = [['table', '桌'], ['stage', '舞台'], ['aisle', '走道'], ['door', '出入口'], ['label', '文字']];
var FP_HDR = {t: ['類型', '種類', '項目'], id: ['桌號', '編號', 'id'], name: ['名稱', '桌名', '顯示名稱'], cap: ['人數', '桌位', '桌位數', '容量'], x: ['欄', 'x', '橫'], y: ['列', 'y', '縱', '行'], w: ['跨欄', '寬', '寬度'], h: ['跨列', '高', '高度'], alias: ['別名', '別稱', '對應桌次']};
function fpClone(o) { return o ? JSON.parse(JSON.stringify(o)) : null; }
function fpCheck(d) {
  var errs = [], tabs = [], seen = {};
  if (!d || !d.items || !d.items.length) return errs;
  d.items.forEach(function (it, i) {
    var n = '第 ' + (i + 1) + ' 列';
    if (!(+it.x >= 1) || !(+it.y >= 1)) errs.push(n + '：欄、列要填 1 以上的數字');
    if (it.t === 'table') {
      if (!String(it.id || '').trim()) { errs.push(n + '：桌號不能空白'); return; }
      var ks = [V.fp.key(it.id), V.fp.key(it.name || it.id)].concat((it.alias || []).map(V.fp.key));
      ks.forEach(function (k) { if (k && seen[k] && seen[k] !== it) errs.push('桌號重複：「' + it.id + '」與「' + (seen[k].name || seen[k].id) + '」重複（'+ n + '）'); else if (k) seen[k] = it; });
      tabs.push(it);
    }
  });
  var cells = {};
  d.items.forEach(function (it, i) {
    for (var a = 0; a < (+it.w || 1); a++) for (var b = 0; b < (+it.h || 1); b++) {
      var k = (+it.x + a) + ',' + (+it.y + b), o = cells[k];
      if (o && (o.t === 'table' || it.t === 'table') && o !== it) errs.push('位置重疊：「' + (o.name || o.label || o.t) + '」與「' + (it.name || it.label || it.t) + '」都在 欄' + (+it.x + a) + '、列' + (+it.y + b));
      if (!o || it.t === 'table') cells[k] = it;
    }
  });
  var uniq = {}; return errs.filter(function (e) { if (uniq[e]) return false; uniq[e] = 1; return true; }).slice(0, 8);
}
/* Excel「座位圖」工作表 → 版面 */
function fpFromRows(rows) {
  var hi = -1, map = {};
  for (var i = 0; i < Math.min(rows.length, 10) && hi < 0; i++) {
    var m = {}, hit = 0;
    rows[i].forEach(function (h, c) { var k = cleanH(h); Object.keys(FP_HDR).forEach(function (f) { if (m[f] == null && FP_HDR[f].some(function (a) { return cleanH(a) === k; })) { m[f] = c; hit++; } }); });
    if (m.x != null && m.y != null && hit >= 4) { hi = i; map = m; }
  }
  if (hi < 0) return {err: '找不到欄位標題。第一列需有：類型、桌號、名稱、人數、欄、列（跨欄、跨列、別名可省略）'};
  var items = [], errs = [];
  function g(r, f) { return map[f] == null ? '' : String(r[map[f]] == null ? '' : r[map[f]]).trim(); }
  rows.slice(hi + 1).forEach(function (r, ri) {
    if (!r.some(function (c) { return String(c).trim(); })) return;
    var tx = g(r, 't'), n = '第 ' + (hi + ri + 2) + ' 列', t = /主桌|^桌|桌$/.test(tx) && !/走道/.test(tx) ? 'table' : /舞台/.test(tx) ? 'stage' : /走道/.test(tx) ? 'aisle' : /出入口|出入|門|入口/.test(tx) ? 'door' : /文字|標示|說明/.test(tx) ? 'label' : '';
    if (!t) { errs.push(n + '：看不懂「類型」（' + tx + '），請填 桌／主桌／舞台／走道／出入口／文字'); return; }
    var x = parseInt(g(r, 'x'), 10), y = parseInt(g(r, 'y'), 10);
    if (!(x >= 1) || !(y >= 1)) { errs.push(n + '：欄、列必填（1 以上的數字）'); return; }
    var it = {t: t, x: x, y: y, w: Math.max(1, parseInt(g(r, 'w'), 10) || 1), h: Math.max(1, parseInt(g(r, 'h'), 10) || 1)};
    if (t === 'table') {
      var id = g(r, 'id'), nm = g(r, 'name'); if (!id && nm) { var mm = /(\d+)/.exec(nm); id = mm ? mm[1] : nm; }
      if (!id) { errs.push(n + '：桌號必填'); return; }
      id = String(id).replace(/^第\s*/, '').replace(/\s*桌$/, '') || id;
      it.id = id; it.name = nm || '第' + id + '桌'; it.cap = Math.max(0, parseInt(g(r, 'cap'), 10) || 0);
      if (/主桌/.test(tx)) { it.main = 1; }
      var al = g(r, 'alias').split(/[,，、;；\s]+/).filter(Boolean); if (it.main && al.indexOf('主桌') < 0) al.push('主桌'); if (al.length) it.alias = al;
    } else it.label = g(r, 'name') || g(r, 'id');
    items.push(it);
  });
  return {layout: {v: 1, items: items}, errs: errs};
}
function fpToRows(d) {
  var NM = {table: '桌', stage: '舞台', aisle: '走道', door: '出入口', label: '文字'}, rows = [['類型', '桌號', '名稱', '人數', '欄', '列', '跨欄', '跨列', '別名']];
  (d.items || []).forEach(function (it) {
    rows.push([it.t === 'table' && it.main ? '主桌' : NM[it.t], it.t === 'table' ? it.id : '', it.t === 'table' ? it.name : (it.label || ''), it.t === 'table' ? it.cap : '', it.x, it.y, it.w, it.h, (it.alias || []).filter(function (a) { return a !== '主桌'; }).join('、')]);
  });
  return rows;
}
function paneLayout(p) {
  var saved = fpClone(S.ev && S.ev.layout), draft = fpClone(saved), msg = '', ver = '';
  function dirty() { return JSON.stringify(draft) !== JSON.stringify(saved); }
  function nTables(d) { return d && d.items ? d.items.filter(function (i) { return i.t === 'table'; }).length : 0; }
  function sorted() { return (draft ? draft.items : []).map(function (it, i) { return {it: it, i: i}; }); }
  function draw() {
    var cur = nTables(saved), h = '<div class="pnl"><h3>🗺 座位圖設定</h3>' +
      '<p class="muted small">設定後，接待組與總召會看到「桌位平面圖」（點桌子看名單、確認入座）。沒有設定時，維持原本的桌次清單。每一場活動各自設定。</p>' +
      (ver && !/1\.[4-9]|[2-9]\.\d/.test(ver) ? '<div class="warn-box">⚠ 後端 Code.gs 還是舊版（' + esc(ver) + '），請先依「設定說明」更新 Code.gs 並重新部署，座位圖才能儲存、同步到各台裝置。</div>' : '') +
      '<div class="muted">目前狀態：' + (cur ? '<b>已設定</b>（' + cur + ' 桌，桌位合計 ' + capSum(saved) + '）' : '<b>尚未設定</b>（使用桌次清單）') + (dirty() ? ' ・ <span class="warnc">有尚未儲存的修改</span>' : '') + '</div>' +
      '<div class="fp-btns"><button class="btn primary" id="fp-preset">⚡ 載入本場預設（主桌 15 人、其他桌 10 人）</button>' +
      '<label class="btn" for="fp-file">📥 匯入 Excel（工作表「座位圖」）</label><input type="file" id="fp-file" accept=".xlsx,.xls,.csv" style="display:none">' +
      '<button class="btn" id="fp-dl">📄 下載 Excel 範本／匯出目前</button><button class="btn danger" id="fp-clear">🗑 清除（改回桌次清單）</button></div>' +
      (msg ? '<div class="' + (/^⚠/.test(msg) ? 'warn-box' : 'ok-box') + '" id="fp-msg">' + msg + '</div>' : '') + '</div>';
    h += '<div class="pnl"><h3>預覽</h3><div class="row fp-cap"><label>一般桌位數 <input class="inp sm tin" id="fp-capall" type="number" min="0" value="10"></label><label>主桌 <input class="inp sm tin" id="fp-capmain" type="number" min="0" value="15"></label><button class="btn sm" id="fp-capgo">套用到所有桌</button></div><div id="fp-prev"></div><div id="fp-chk"></div></div>';
    h += '<div class="pnl"><h3>項目表 <span class="muted small">（欄＝由左數第幾格、列＝由上數第幾格；跨欄、跨列＝佔幾格）</span></h3><div class="twrap"><table class="tbl" id="fp-tbl"><tr><th>類型</th><th>桌號／文字</th><th>名稱</th><th>人數</th><th>欄</th><th>列</th><th>跨欄</th><th>跨列</th><th>主桌</th><th>別名</th><th></th></tr>';
    sorted().forEach(function (o) {
      var it = o.it, i = o.i, tb = it.t === 'table';
      function inp(f, v, cls, type) { return '<input class="inp sm ' + (cls || '') + '" data-i="' + i + '" data-f="' + f + '" value="' + esc(v == null ? '' : v) + '"' + (type ? ' type="number" min="1"' : '') + '>'; }
      h += '<tr><td><select class="inp sm" data-i="' + i + '" data-f="t">' + FP_TYPES.map(function (t) { return '<option value="' + t[0] + '"' + (it.t === t[0] ? ' selected' : '') + '>' + t[1] + '</option>'; }).join('') + '</select></td>' +
        '<td>' + (tb ? inp('id', it.id, 'tin') : inp('label', it.label, '')) + '</td><td>' + (tb ? inp('name', it.name, '') : '') + '</td><td>' + (tb ? inp('cap', it.cap, 'tin', 1) : '') + '</td>' +
        '<td>' + inp('x', it.x, 'tin', 1) + '</td><td>' + inp('y', it.y, 'tin', 1) + '</td><td>' + inp('w', it.w, 'tin', 1) + '</td><td>' + inp('h', it.h, 'tin', 1) + '</td>' +
        '<td>' + (tb ? '<input type="checkbox" data-i="' + i + '" data-f="main"' + (it.main ? ' checked' : '') + '>' : '') + '</td><td>' + (tb ? inp('alias', (it.alias || []).join('、'), '') : '') + '</td><td><button class="btn sm danger" data-del="' + i + '" aria-label="刪除這一列">✕</button></td></tr>';
    });
    h += '</table></div><div class="row"><button class="btn sm" id="fp-add">＋ 新增一桌</button><button class="btn sm" id="fp-add2">＋ 新增舞台／走道／出入口／文字</button></div></div>';
    h += '<div class="pnl"><button class="btn primary xl" id="fp-save"' + (dirty() && draft ? '' : ' disabled') + '>💾 儲存座位圖</button><div class="muted small">儲存後，所有工作人員的裝置會在幾秒內自動更新畫面。</div></div>';
    p.innerHTML = h; bind(); preview();
  }
  function capSum(d) { var c = 0; (d.items || []).forEach(function (i) { if (i.t === 'table') c += +i.cap || 0; }); return c; }
  function preview() {
    var box = $('#fp-prev', p), chk = $('#fp-chk', p); if (!box) return;
    var L = draft ? V.fp.normalize(draft) : null;
    if (!L) { box.innerHTML = '<div class="empty">還沒有座位圖。按上方「載入本場預設」，或匯入 Excel。</div>'; chk.innerHTML = ''; return; }
    var st = V.fp.stats(L, V.list());
    box.innerHTML = V.fp.plan(L, st, {attr: 'data-px'}); V.fp.fit(box);
    var errs = fpCheck(draft), h = '';
    if (errs.length) h += '<div class="warn-box">⚠ 請先修正：<ul>' + errs.map(function (e) { return '<li>' + esc(e) + '</li>'; }).join('') + '</ul></div>';
    var oth = Object.keys(st.other); if (oth.length) h += '<div class="warn-box">名單中有 ' + st.otherCount + ' 位貴賓的桌次不在這張圖上：' + esc(oth.slice(0, 12).join('、')) + (oth.length > 12 ? '…' : '') + '。可在「別名」欄把它們對應到某一桌。</div>';
    chk.innerHTML = h;
    var sv = $('#fp-save', p); if (sv) sv.disabled = !(dirty() && draft) || errs.length > 0;
  }
  var pv = debounce(preview, 150);
  function bind() {
    $('#fp-tbl', p).oninput = $('#fp-tbl', p).onchange = function (e) {
      var el = e.target, i = el.dataset.i; if (i == null) return; var it = draft.items[+i], f = el.dataset.f;
      if (f === 't') { it.t = el.value; if (it.t === 'table') { it.id = it.id || ''; it.name = it.name || ''; it.cap = it.cap || 10; } if (e.type === 'change') draw(); else return; return; }
      if (f === 'main') it.main = el.checked ? 1 : 0;
      else if (f === 'alias') it.alias = el.value.split(/[,，、;；\s]+/).filter(Boolean);
      else if (/^(x|y|w|h|cap)$/.test(f)) it[f] = parseInt(el.value, 10) || 0;
      else it[f] = el.value;
      pv();
    };
    p.querySelectorAll('[data-del]').forEach(function (b) { b.onclick = function () { draft.items.splice(+b.dataset.del, 1); if (!draft.items.length) draft = null; msg = ''; draw(); }; });
    $('#fp-add', p).onclick = function () {
      draft = draft || {v: 1, items: []};
      var my = 1, nid = 1; draft.items.forEach(function (it) { my = Math.max(my, it.y + it.h - 1); if (it.t === 'table' && /^\d+$/.test(it.id)) nid = Math.max(nid, +it.id + 1); });
      draft.items.push({t: 'table', id: String(nid), name: '第' + nid + '桌', cap: 10, x: 1, y: my + 1, w: 1, h: 1}); msg = ''; draw();
    };
    $('#fp-add2', p).onclick = function () { draft = draft || {v: 1, items: []}; draft.items.push({t: 'aisle', label: '走　道', x: 1, y: 1, w: 1, h: 1}); msg = ''; draw(); };
    $('#fp-capgo', p).onclick = function () {
      if (!draft) { V.toast('還沒有座位圖', 'bad'); return; }
      var a = parseInt($('#fp-capall', p).value, 10), m = parseInt($('#fp-capmain', p).value, 10);
      if (!(a >= 0) || !(m >= 0)) { V.toast('請填人數', 'bad'); return; }
      draft.items.forEach(function (it) { if (it.t === 'table') it.cap = it.main ? m : a; }); msg = ''; draw();
    };
    $('#fp-preset', p).onclick = function () {
      var a = parseInt($('#fp-capall', p).value, 10), m = parseInt($('#fp-capmain', p).value, 10);
      V.confirm('載入並<b>儲存</b>本場預設座位圖（主桌第 1 桌 ' + (m >= 0 ? m : 15) + ' 人、其他桌 ' + (a >= 0 ? a : 10) + ' 人，共 45 桌）？' + (saved ? '<br>目前已設定的座位圖會被取代。' : ''), '載入並儲存', false).then(function (ok) {
        if (ok) save(V.fp.preset({mainCap: m >= 0 ? m : 15, cap: a >= 0 ? a : 10}), '已載入並儲存本場預設座位圖');
      });
    };
    $('#fp-clear', p).onclick = function () {
      if (!saved && !draft) { V.toast('目前沒有座位圖'); return; }
      V.confirm('清除座位圖？接待組與總召會改回桌次清單。（貴賓名單與入座紀錄不受影響）', '清除', true).then(function (ok) { if (ok) save(null, '已清除座位圖'); });
    };
    $('#fp-dl', p).onclick = function () {
      loadXlsx().then(function () {
        var d = draft && draft.items.length ? draft : V.fp.preset(), wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(fpToRows(d)), '座位圖');
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['說明'], ['每一列是一個項目。類型：桌、主桌、舞台、走道、出入口、文字。'], ['欄＝由左數第幾格（1 開始）、列＝由上數第幾格；跨欄、跨列＝佔幾格（主桌常跨 3 欄）。'], ['桌號要和貴賓名單「桌次」對得起來（1、1桌、第1桌 都視為同一桌）。別名可填其他叫法，例如 主桌。'], ['改好後，到後台「座位圖」按「匯入 Excel」，確認預覽沒問題再按儲存。']]), '說明');
        XLSX.writeFile(wb, '座位圖.xlsx');
      }).catch(err);
    };
    $('#fp-file', p).onchange = function (e) {
      var f = e.target.files[0]; if (!f) return;
      Promise.all([loadXlsx(), new Promise(function (res) { var fr = new FileReader(); fr.onload = function () { res(fr.result); }; fr.readAsArrayBuffer(f); })]).then(function (a) {
        var wb = /\.(csv|txt)$/i.test(f.name) ? XLSX.read(decodeCsv(a[1]), {type: 'string'}) : XLSX.read(a[1], {type: 'array'});
        var sn = wb.SheetNames.filter(function (n) { return /座位圖/.test(n); })[0] || wb.SheetNames.filter(function (n) { return /座位|桌/.test(n); })[0] || wb.SheetNames[0];
        var r = fpFromRows(XLSX.utils.sheet_to_json(wb.Sheets[sn], {header: 1, defval: '', raw: false}));
        if (r.err) { msg = '⚠ ' + esc(r.err); draw(); return; }
        if (!r.layout.items.length) { msg = '⚠ 工作表「' + esc(sn) + '」裡沒有可用的項目'; draw(); return; }
        draft = r.layout; msg = (r.errs.length ? '⚠ 匯入了 ' + r.layout.items.length + ' 個項目，但有 ' + r.errs.length + ' 列略過：<br>' + r.errs.slice(0, 5).map(esc).join('<br>') + '<br>' : '') + (r.errs.length ? '' : '已讀入工作表「' + esc(sn) + '」的 ' + r.layout.items.length + ' 個項目，') + '請確認預覽後按「儲存座位圖」。'; draw();
      }).catch(function (er) { msg = '⚠ ' + esc(er.message || er); draw(); });
    };
    $('#fp-save', p).onclick = function () {
      var errs = fpCheck(draft); if (errs.length) { V.toast(errs[0], 'bad'); return; }
      save(draft, '已儲存座位圖，各裝置會在幾秒內自動更新');
    };
  }
  function save(layout, okMsg) {
    admin('layout.set', {layout: layout}).then(function (r) {
      var lay = r.layout || null;
      if (S.ev) S.ev.layout = lay;
      (S.events || []).forEach(function (e) { if (e.id === S.evId) e.layout = lay; });
      saved = fpClone(lay); draft = fpClone(lay); msg = ''; V.toast(okMsg); V.notify(); draw();
    }).catch(function (e) {
      var m = String(e && e.message || e);
      err(/未知指令/.test(m) ? new Error('後端 Code.gs 還是舊版，請先更新並重新部署（見設定說明）') : e);
    });
  }
  draw();
  admin('events').then(function (r) { ver = String(r.version || ''); if ($('#fp-save', p) && !dirty()) draw(); }).catch(function () {});
}

/* ---------- 存取碼 ---------- */
function linkBase() { return location.origin + location.pathname.replace(/[^/]*$/, ''); }
function paneCodes(p) {
  function draw(codes) {
    var base = linkBase(), extra = (!window.VIP_CONFIG.API_URL && V.apiUrl && !V.demo) ? '&api=' + encodeURIComponent(V.apiUrl) : '';
    var h = '<div class="pnl"><h3>🔑 存取碼與連結</h3><p class="muted">只要一組碼：<b>工作人員共用碼</b>。報到、接待、舞台、總召都用同一個碼進入同一個畫面，進去後在上方分頁選自己的組別（總召分頁只能看、不能操作）。' + (V.demo ? '<br><b>預覽模式：連結只在這個瀏覽器有效。</b>' : '') + '</p>';
    var d = ['staff', '👥 工作人員共用碼', '報到組・接待組・舞台組・總召 共用', '登入後自己選組別，隨時可切換。每一組只能按自己負責的步驟，但看得到所有組別的進度；總召分頁為唯讀。', '貴賓報到系統連結'];
    var k = d[0], c = codes[k] || '', link = base + '?c=' + c + extra;
    h += '<div class="coderow" data-code-role="' + k + '"><div class="cr-h"><b>' + d[1] + '</b> <span class="muted small">' + d[2] + '</span></div><div class="cr-note">' + d[3] + '</div><div class="cr-c">' + esc(c) + '</div><input class="inp sm" readonly value="' + esc(link) + '" onclick="this.select()">' +
      '<div class="cr-b"><button class="btn sm" data-copy="' + esc(link) + '">複製連結</button><a class="btn sm" target="_blank" rel="noopener" href="https://line.me/R/msg/text/?' + encodeURIComponent(d[4] + '（存取碼 ' + c + '）\n' + link) + '">LINE 分享</a><a class="btn sm" target="_blank" href="' + esc(link) + '">開啟</a><button class="btn sm danger" data-regen="' + k + '">重新產生</button></div></div>';
    h += '<div class="coderow"><div class="cr-h"><b>⚙️ 後台管理</b></div><div class="muted">使用你在 Apps Script「指令碼屬性」設定的 ADMIN_CODE（管理密碼）登入' + (V.demo ? '（預覽版：這個頁面已用管理權限登入）' : '') + '。請勿傳給他人。</div></div></div>';
    p.innerHTML = h;
    p.querySelectorAll('[data-copy]').forEach(function (b) { b.onclick = function () { (navigator.clipboard ? navigator.clipboard.writeText(b.dataset.copy) : Promise.reject()).then(function () { V.toast('已複製連結'); }, function () { prompt('請手動複製：', b.dataset.copy); }); }; });
    p.querySelectorAll('[data-regen]').forEach(function (b) { b.onclick = function () {
      V.confirm('重新產生「工作人員共用碼」？舊碼與舊連結會立即失效，所有工作人員（含總召）的手機都需要重新輸入新碼。', '重新產生', true).then(function (ok) { if (ok) admin('codes.regen', {roles: ['staff']}).then(function (r) { draw(r.codes); }).catch(err); });
    }; });
  }
  admin('codes.get').then(function (r) { draw(r.codes); }).catch(err);
}

/* ---------- 匯出／列印 ---------- */
function drawOutStats() {}
function rowsForExport() {
  return V.list().sort(function (a, b) { return (a.seq || 99999) - (b.seq || 99999); }).map(function (r) {
    return [r.seq && r.seq < 99999 ? r.seq : '', +r.ord > 0 ? r.ord : '', r.cat || '', r.org || '', r.title || '', r.name || '', r.rsvp || '', r.grp || '', r.tbl || '', r.note || '', r.walk ? '是' : '',
      U.fmtDT(r.ci), r.ciBy || '', U.fmtDT(r.se), r.seBy || '', U.fmtDT(r.an), r.anBy || ''];
  });
}
var EXPORT_HEAD = ['序', '唱名順序', '類別', '單位名稱', '職稱', '姓名', '回覆情形', '報到組別', '桌次/座位', '備註', '現場新增', '報到時間', '報到人員', '入座時間', '入座人員', '唱名時間', '唱名人員'];
function exportXlsx() {
  return loadXlsx().then(function () { return admin('log.get').catch(function () { return {log: []}; }); }).then(function (lg) {
    var wb = XLSX.utils.book_new(), ws = XLSX.utils.aoa_to_sheet([EXPORT_HEAD].concat(rowsForExport()));
    ws['!cols'] = EXPORT_HEAD.map(function (h, i) { return {wch: i === 3 ? 22 : i === 9 ? 24 : (i >= 11 && i % 2 === 1) ? 18 : 12}; });
    XLSX.utils.book_append_sheet(wb, ws, '貴賓名單與結果');
    var all = V.list(), exp = all.filter(U.isExpected), cnt = function (f) { return all.filter(f).length; };
    var sum = [['活動', S.ev ? S.ev.name : ''], ['日期', S.ev ? S.ev.date : ''], ['匯出時間', U.fmtDT(Date.now())], [], ['預計出席', exp.length], ['已報到', cnt(function (r) { return r.ci; })], ['  其中現場新增', cnt(function (r) { return r.walk; })], ['已入座', cnt(function (r) { return r.se; })], ['已唱名', cnt(function (r) { return r.an; })], ['未到（預計出席）', exp.filter(function (r) { return !r.ci; }).length]];
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
  p.innerHTML = '<div class="pnl"><h3>📤 匯出與列印</h3><div class="outb"><button class="btn primary xl" id="ox">匯出完整結果 Excel（含各階段時間與操作紀錄）</button><button class="btn xl" id="op1">🖨 列印主持人唱名順序</button><button class="btn xl" id="op2">🖨 列印桌次名單（備援）</button><button class="btn xl" id="op3">🖨 列印報到名冊（依姓名，紙本備援）</button></div><p class="muted small">建議活動當天開始前、中場、結束各匯出一次存檔。</p></div>';
  $('#ox', p).onclick = function () { exportXlsx().catch(err); };
  $('#op1', p).onclick = V.printOrder;
  $('#op2', p).onclick = printTables; $('#op3', p).onclick = printAlpha;
}

/* ---------- 設定 ---------- */
function paneSet(p) {
  p.innerHTML = '<div class="pnl"><h3>🔌 連線</h3><p>模式：<b>' + (V.demo ? '預覽／示範（資料在本機瀏覽器）' : '正式（Google 試算表）') + '</b></p>' + (V.demo ? '' : '<p class="small muted" style="word-break:break-all">' + esc(V.apiUrl) + '</p>') + '<button class="btn" id="ping">測試連線</button> <span id="pingr"></span></div>' +
    '<div class="pnl"><h3>⚠ 危險區</h3><p class="muted small">正式活動前，請先清除試用時產生的報到紀錄（名單與桌次會保留）。</p><button class="btn danger" id="reset">清除所有報到／入座／唱名紀錄</button></div>' +
    (V.demo ? '<div class="pnl"><h3>🧪 示範資料</h3><button class="btn" id="dreset">重新產生示範資料（400 位）</button></div>' : '');
  $('#ping', p).onclick = function () { var t = Date.now(); V.api({op: 'ping'}).then(function (r) { $('#pingr', p).innerHTML = r.ok ? '<span class="okc">✓ 正常（' + (Date.now() - t) + ' ms）' + (r.ready ? '' : '，但尚未設定管理密碼') + '</span>' : '<span class="late">異常</span>'; }).catch(function () { $('#pingr', p).innerHTML = '<span class="late">無法連線</span>'; }); };
  $('#reset', p).onclick = function () {
    var m = V.modal('<h3>清除所有報到紀錄</h3><p>這會清除所有貴賓的報到／入座／唱名紀錄，無法復原（名單、桌次與唱名順序會保留）。請先匯出 Excel 備份。</p><label class="chk"><input type="checkbox" id="rw"> 同時移除「現場新增」的貴賓</label><p>請輸入「清除」兩字確認：</p><input class="inp" id="rc"><div class="m-btns"><button class="btn" data-close>取消</button><button class="btn danger" id="rok">確定清除</button></div>', {sticky: true});
    $('#rok', m).onclick = function () { if ($('#rc', m).value.trim() !== '清除') { V.toast('請輸入「清除」', 'bad'); return; } admin('states.reset', {removeWalkins: $('#rw', m).checked}).then(function () { m.close(); V.forceResync(); V.toast('已清除'); }).catch(err); };
  };
  var d = $('#dreset', p); if (d) d.onclick = function () { V.confirm('重新產生示範資料？目前示範資料會被覆蓋。', '重新產生', true).then(function (ok) { if (ok) window.VIPDEMO.resetAll(); }); };
}
})();
