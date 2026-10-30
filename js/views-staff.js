/* 報到組／接待組／舞台組 畫面（與總召同一個介面） */
(function () {
'use strict';
var V = window.VIP, S = V.S, U = V.u, esc = U.esc, T = U.fmtT;
function $(sel, root) { return (root || document).querySelector(sel); }
function debounce(fn, ms) { var t; return function () { var a = arguments, c = this; clearTimeout(t); t = setTimeout(function () { fn.apply(c, a); }, ms); }; }
function byId(id) { return V.get(id); }
function catOptions(sel, withAll) {
  var cats = (S.ev && S.ev.cats) || [], h = withAll ? '<option value="">全部類別</option>' : '<option value="">（未分類）</option>';
  cats.forEach(function (c) { h += '<option' + (c === sel ? ' selected' : '') + '>' + esc(c) + '</option>'; });
  return h;
}
V.catOptions = catOptions;
function chip(label, on, attrs) { return '<button class="chip' + (on ? ' on' : '') + '" ' + attrs + '>' + label + '</button>'; }
function seqBadge(r) { return r.seq && r.seq < 99999 ? '<span class="seq">' + r.seq + '</span>' : '<span class="seq new">新</span>'; }
function tags(r) {
  var h = '';
  if (r.cat) h += '<span class="tag">' + esc(r.cat) + '</span>';
  if (r.grp) h += '<span class="tag grp">' + esc(r.grp) + '</span>';
  if (r.walk) h += '<span class="tag walk">現場新增</span>';
  if (r.rsvp === '代理出席') h += '<span class="tag warn">代理出席</span>';
  return h;
}
V.guestTags = tags;
function capList(arr, cap, q) {
  if (arr.length <= cap) return {items: arr, more: 0};
  return {items: arr.slice(0, cap), more: arr.length - cap};
}
function moreNote(n) { return n ? '<div class="more-note">還有 ' + n + ' 位未顯示，請輸入更多關鍵字縮小範圍</div>' : ''; }

/* ================== 報到組 ================== */
(function () {
  var st = {status: 'todo', grp: U.lsGet('vip.ciGrp', ''), cat: '', q: ''};
  var root;
  function upd() {
    if (!root) return;
    var all = V.list(), q = st.q.trim();
    var groups = {}; all.forEach(function (r) { if (r.grp) groups[r.grp] = 1; });
    var tot = all.filter(function (r) { return r.ci; }).length;
    $('#stat', root).innerHTML = '已報到 <b>' + tot + '</b> / ' + all.filter(U.isExpected).length + ' 預計';
    var gh = chip('全部組別', !st.grp, 'data-grp=""');
    Object.keys(groups).sort().forEach(function (g) { gh += chip(esc(g), st.grp === g, 'data-grp="' + esc(g) + '"'); });
    $('#grps', root).innerHTML = gh;
    var sh = chip('待報到', st.status === 'todo', 'data-st="todo"') + chip('已報到', st.status === 'done', 'data-st="done"') + chip('全部', st.status === 'all', 'data-st="all"');
    $('#sts', root).innerHTML = sh;
    var arr = all.filter(function (r) {
      if (st.grp && r.grp !== st.grp) return false;
      if (st.cat && r.cat !== st.cat) return false;
      if (!U.matches(r, q)) return false;
      if (q) return true;
      return st.status === 'all' || (st.status === 'todo' ? !r.ci : !!r.ci);
    });
    var out = '';
    function row(r) {
      var h = '<div class="card g' + (r.ci ? ' arrived' : '') + '" data-id="' + r.id + '">' + seqBadge(r) + '<div class="g-main"><div class="g-name">' + esc(r.name) + '</div><div class="g-sub">' + esc(U.addrName(r)) + '</div><div class="g-meta">' + tags(r) +
        (r.note ? '<span class="note">📝 ' + esc(r.note) + '</span>' : '') + '</div></div><div class="g-act">';
      if (r.ci) h += '<div class="tbl-badge sm">' + esc(U.tblLabel(r.tbl) || '未排桌') + '</div><div class="muted small">' + T(r.ci) + ' 已報到</div><button class="btn" data-a="show">查看</button>';
      else h += '<button class="btn ok xl" data-a="ci">報到</button>';
      return h + '</div></div>';
    }
    arr.sort(function (a, b) { return (a.ci ? 1 : 0) - (b.ci ? 1 : 0) || (a.seq || 99999) - (b.seq || 99999); });
    var c2 = capList(arr, !q && st.status === 'todo' ? 60 : 80);
    if (!q && st.status === 'todo') out += '<div class="sec">待報到 · ' + arr.length + '（輸入姓名／單位快速搜尋）</div>';
    out += c2.items.map(row).join('') + moreNote(c2.more);
    $('#list', root).innerHTML = out || '<div class="empty">找不到符合的貴賓。可點右上「＋現場新增」。</div>';
  }
  function resultOverlay(id) {
    var r = byId(id); if (!r) return;
    var m = V.modal('', {cls: 'result', sticky: true});
    function draw() {
      var r = byId(id) || {};
      var tb = U.tblLabel(r.tbl);
      m.querySelector('.modal-box').innerHTML = '<div class="res-ok">✓ ' + (r.ci ? '已報到 ' + T(r.ci) : '處理中') + '</div><div class="res-label">請引導至</div>' +
        (tb ? '<div class="res-tbl">' + esc(tb) + '</div>' : '<div class="res-tbl none">尚未排桌</div><div class="res-assign"><input class="inp big" id="tbin" placeholder="輸入桌次，例如 12" inputmode="numeric"><button class="btn primary" id="tbok">指定桌次</button></div>') +
        '<div class="res-name">' + esc(r.name) + '</div><div class="res-sub">' + esc(U.addrName(r)) + '</div>' +
        (r.note ? '<div class="res-note">📝 ' + esc(r.note) + '</div>' : '') +
        '<div class="m-btns"><button class="btn" id="resundo">復原報到</button>' + (tb ? '<button class="btn" id="chtb">改桌次</button>' : '') + '<button class="btn primary xl" id="resnext">完成・下一位</button></div>';
      var ok = m.querySelector('#tbok');
      if (ok) ok.onclick = function () { var v = m.querySelector('#tbin').value.trim(); if (v) { V.act({a: 'edit', g: id, f: {tbl: v}}); } };
      var ch = m.querySelector('#chtb');
      if (ch) ch.onclick = function () { var v = prompt('新桌次（例如 12）', r.tbl || ''); if (v !== null && v.trim()) V.act({a: 'edit', g: id, f: {tbl: v.trim()}}); };
      m.querySelector('#resundo').onclick = function () { unsub(); m.close(); V.stage(id, 'ci', 0); };
      m.querySelector('#resnext').onclick = function () { unsub(); m.close(); var q = $('#q', root); if (q) { q.value = ''; st.q = ''; upd(); q.focus(); } };
    }
    var unsub = V.subscribe(function () { if (document.body.contains(m) && !m.querySelector('#tbin:focus')) draw(); });
    draw();
  }
  function walkinModal() {
    var m = V.modal('<h3>＋ 現場新增貴賓</h3><div class="form"><label>姓名 *<input id="w-name" class="inp" maxlength="30" value="' + esc(st.q) + '"></label><label>單位名稱<input id="w-org" class="inp"></label><label>職稱<input id="w-title" class="inp"></label>' +
      '<label>類別<select id="w-cat" class="inp">' + catOptions('', false) + '</select></label><label>桌次（可先留空）<input id="w-tbl" class="inp" placeholder="例如 12"></label><label>備註<input id="w-note" class="inp"></label></div>' +
      '<div class="m-btns"><button class="btn" data-close>取消</button><button class="btn primary xl" id="w-ok">新增並報到</button></div>', {sticky: true});
    $('#w-name', m).focus();
    $('#w-ok', m).onclick = function () {
      var name = $('#w-name', m).value.trim();
      if (!name) { V.toast('請輸入姓名', 'bad'); return; }
      var id = 'w' + U.uid(9);
      V.act({a: 'walkin', g: id, f: {name: name, org: $('#w-org', m).value.trim(), title: $('#w-title', m).value.trim(), cat: $('#w-cat', m).value, tbl: $('#w-tbl', m).value.trim(), note: $('#w-note', m).value.trim()}});
      m.close(); resultOverlay(id);
    };
  }
  V.views.checkin = {
    mount: function (r) {
      root = r;
      r.innerHTML = '<div class="bar"><input id="q" class="inp search" placeholder="🔍 搜尋 姓名／單位／職稱／桌次" autocomplete="off" autocapitalize="off"><button class="btn primary" id="walk">＋ 現場新增</button></div>' +
        '<div class="subbar"><span id="stat" class="stat-pill"></span><select id="cat" class="inp sm"></select></div><div class="chips scroll" id="sts"></div><div class="chips scroll" id="grps"></div><div id="list" class="cards"></div>';
      $('#cat', r).innerHTML = catOptions('', true);
      $('#cat', r).onchange = function (e) { st.cat = e.target.value; upd(); };
      $('#q', r).oninput = debounce(function (e) { st.q = e.target.value; upd(); }, 100);
      $('#walk', r).onclick = walkinModal;
      r.onclick = function (e) {
        var b = e.target.closest('[data-a],[data-st],[data-grp]'); if (!b) return;
        if (b.dataset.st) { st.status = b.dataset.st; upd(); return; }
        if (b.dataset.grp !== undefined) { st.grp = b.dataset.grp; U.lsSet('vip.ciGrp', st.grp); upd(); return; }
        var id = b.closest('[data-id]').dataset.id;
        if (b.dataset.a === 'ci') { V.stage(id, 'ci', 1); resultOverlay(id); }
        else if (b.dataset.a === 'show') resultOverlay(id);
      };
      setTimeout(function () { var q = $('#q', r); if (q && window.innerWidth > 700) q.focus(); }, 50);
    },
    update: function () { var c = $('#cat', root); if (c && c.options.length - 1 !== ((S.ev && S.ev.cats) || []).length) { c.innerHTML = catOptions(st.cat, true); } upd(); }
  };
})();
/* ================== 共用：狀態標籤、唱名順序列印 ================== */
function statusChip(r) {
  if (r.an) return '<span class="stc s-an">🎤 已唱名 ' + U.fmtTS(r.an) + '</span>';
  if (r.se) return '<span class="stc s-se">🪑 已入座 ' + T(r.se) + '</span>';
  if (r.ci) return '<span class="stc s-ci">✅ 已報到・未入座</span>';
  return '<span class="stc s-none">⚪ 尚未報到</span>';
}
V.statusChip = statusChip;
V.printOrder = function () {
  var o = V.orderedList().ordered;
  if (!o.length) { V.toast('還沒有設定唱名順序', 'bad'); return; }
  var h = '<div id="print-area"><h2>' + esc(S.ev ? S.ev.name : '') + ' 主持人唱名順序</h2><table><tr><th>順序</th><th>類別</th><th>單位</th><th>職稱</th><th>姓名</th><th>桌次</th><th>唱名</th></tr>';
  o.forEach(function (r) { h += '<tr><td>' + r.ord + '</td><td>' + esc(r.cat) + '</td><td>' + esc(r.org) + '</td><td>' + esc(r.title) + '</td><td><b>' + esc(r.name) + '</b></td><td>' + esc(U.tblLabel(r.tbl)) + '</td><td>☐</td></tr>'; });
  V.printHtml(h + '</table></div>');
};

/* ================== 接待組：看著現場桌面，直接按「已入座」 ================== */
(function () {
  var st = {t: null, q: ''};
  var root;
  function tkey(r) { return String(r.tbl || '').trim() || '__none'; }
  function tname(k) { return k === '__none' ? '尚未排桌' : U.tblLabel(k); }
  function gRow(r, showTbl) {
    var w = r.ci && !r.se ? U.waitMin(r.ci) : 0;
    var h = '<div class="card g rc2' + (r.se ? ' seated' : r.ci ? ' arrived' : ' notyet') + '" data-id="' + r.id + '">' + (showTbl ? '<div class="tbl-badge" data-tbl="' + esc(tkey(r)) + '">' + esc(tname(tkey(r))) + '</div>' : '') +
      '<div class="g-main"><div class="g-name">' + esc(r.name) + '</div><div class="g-sub">' + esc(U.addrName(r)) + '</div><div class="g-meta">' + tags(r) +
      (r.se ? '<span class="stc s-se">🪑 已入座 ' + T(r.se) + (r.seBy ? '（' + esc(r.seBy) + '）' : '') + '</span>' :
        r.ci ? '<span class="stc s-ci">✅ 已報到 ' + T(r.ci) + (w >= 5 ? ' ・ <b class="late">已等 ' + w + ' 分</b>' : '') + '</span>' : '<span class="stc s-none">⚪ 尚未報到</span>') +
      (r.note ? '<span class="note">📝 ' + esc(r.note) + '</span>' : '') + '</div></div><div class="g-act">';
    if (r.se) h += '<button class="btn link" data-a="unse">復原入座</button>';
    else if (r.ci) h += '<button class="btn ok xl" data-a="se">已入座</button>';
    else h += '<button class="btn xl" data-a="senc">已入座<small>（尚未報到）</small></button>';
    return h + '</div></div>';
  }
  function sortSeq(a, b) { return (a.seq || 99999) - (b.seq || 99999) || String(a.name).localeCompare(String(b.name)); }
  function upd() {
    if (!root) return;
    var all = V.list(), q = st.q.trim(), tabs = {}, keys = [];
    all.forEach(function (r) { var k = tkey(r); if (!tabs[k]) { tabs[k] = []; keys.push(k); } tabs[k].push(r); });
    keys.sort(function (a, b) { if (a === '__none') return 1; if (b === '__none') return -1; return U.tblNum(a) - U.tblNum(b) || a.localeCompare(b); });
    var ci = all.filter(function (r) { return r.ci; }).length, se = all.filter(function (r) { return r.se; }).length;
    $('#stat', root).innerHTML = '已入座 <b>' + se + '</b> ／ 已報到 <b>' + ci + '</b>' + (ci - se > 0 ? ' ・ <span class="warnc">待入座 ' + (ci - se) + '</span>' : '');
    var out = '', top = '';
    if (q) {
      var arr = all.filter(function (r) { return U.matches(r, q); }).sort(sortSeq), c = capList(arr, 60);
      out = c.items.map(function (r) { return gRow(r, true); }).join('') + moreNote(c.more) || '';
      if (!arr.length) out = '<div class="empty">找不到符合的貴賓或桌次</div>';
      out = '<div class="muted small">搜尋結果 ' + arr.length + ' 位（點桌號可看整桌）</div>' + out;
    } else if (st.t != null && tabs[st.t]) {
      var g = tabs[st.t].slice().sort(sortSeq), n = g.length, a = g.filter(function (r) { return r.ci; }).length, s = g.filter(function (r) { return r.se; }).length, wait = g.filter(function (r) { return r.ci && !r.se; }).length;
      top = '<div class="rc-head"><button class="btn" id="rc-back">‹ 所有桌次</button><div class="rc-title"><h3>🪑 ' + esc(tname(st.t)) + '</h3><div class="muted">共 <b>' + n + '</b> 位 ・ 已報到 <b>' + a + '</b> ・ 已入座 <b>' + s + '</b></div></div>' +
        (wait ? '<button class="btn primary" id="rc-all">已報到的 ' + wait + ' 位全部入座</button>' : '<span class="stc s-se">' + (s === n && n ? '✓ 全桌已入座' : '') + '</span>') + '</div>';
      out = g.map(function (r) { return gRow(r, false); }).join('');
    } else {
      if (st.t != null) st.t = null;
      out = '<div class="rc-tip">👇 點選桌號，看這桌的貴賓名單，坐定後直接按「已入座」。</div><div class="tgrid rc-tiles">' + keys.map(function (k) {
        var g = tabs[k], n = g.length, a = g.filter(function (r) { return r.ci; }).length, s = g.filter(function (r) { return r.se; }).length, wait = a - s;
        return '<div class="tt' + (s >= n && n ? ' full' : a ? ' part' : '') + '" role="button" tabindex="0" data-t="' + esc(k) + '"><div class="tt-n">' + esc(tname(k)) + '</div><div class="tt-v"><b>' + s + '</b>/' + n + '</div><div class="tt-s">' + (wait > 0 ? '<span class="warnc">待入座 ' + wait + '</span>' : '已報到 ' + a) + '</div><div class="tt-bar"><i class="a" style="width:' + (n ? a * 100 / n : 0) + '%"></i><i class="b" style="width:' + (n ? s * 100 / n : 0) + '%"></i></div></div>';
      }).join('') + '</div>' + (keys.length ? '' : '<div class="empty">目前沒有貴賓資料</div>');
    }
    $('#rtop', root).innerHTML = top;
    var l = $('#list', root);
    if (l.innerHTML !== out) { var y = window.scrollY; l.innerHTML = out; if (y) window.scrollTo(0, y); }
  }
  function openT(k) { st.t = k; st.q = ''; $('#tb', root).value = ''; U.lsSet('vip.rcTbl', k); upd(); window.scrollTo(0, 0); }
  V.views.reception = {
    mount: function (r) {
      root = r;
      var last = U.lsGet('vip.rcTbl', ''); st.t = last || null; st.q = '';
      r.innerHTML = '<div class="bar"><input id="tb" class="inp search" placeholder="🔍 輸入桌號，或貴賓姓名" inputmode="search" autocomplete="off"></div><div class="subbar"><span id="stat" class="stat-pill"></span></div><div id="rtop"></div><div id="list" class="cards"></div>';
      $('#tb', r).oninput = debounce(function (e) { st.q = e.target.value; upd(); }, 100);
      r.onclick = function (e) {
        var t = e.target.closest('[data-t]'); if (t) { openT(t.dataset.t); return; }
        var tb = e.target.closest('.tbl-badge[data-tbl]'); if (tb) { openT(tb.dataset.tbl); return; }
        if (e.target.closest('#rc-back')) { st.t = null; U.lsDel('vip.rcTbl'); upd(); return; }
        if (e.target.closest('#rc-all')) {
          var g = V.list().filter(function (x) { return tkey(x) === st.t && x.ci && !x.se; });
          V.confirm('把「' + esc(tname(st.t)) + '」已報到的 ' + g.length + ' 位貴賓，全部標記為已入座？', '全部入座', false).then(function (ok) { if (ok) g.forEach(function (x) { V.stage(x.id, 'se', 1); }); });
          return;
        }
        var b = e.target.closest('[data-a]'); if (!b) return;
        var id = b.closest('[data-id]').dataset.id, a = b.dataset.a, rec = byId(id);
        if (a === 'se') V.stage(id, 'se', 1);
        else if (a === 'unse') V.stage(id, 'se', 0);
        else if (a === 'senc') V.confirm('「' + esc(rec ? rec.name : '') + '」尚未報到。<br>確定直接標記為已入座？（系統會同時補記報到）', '確定入座', false).then(function (ok) { if (ok) V.stage(id, 'se', 1, true); });
      };
      r.onkeydown = function (e) { var t = e.target.closest && e.target.closest('[data-t]'); if (t && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openT(t.dataset.t); } };
      this.timer = setInterval(upd, 30000);
    },
    unmount: function () { clearInterval(this.timer); root = null; },
    update: upd
  };
})();

/* ================== 唱名順序編輯器（舞台組／管理後台共用） ================== */
(function () {
  V.mountOrder = function (el, opts) {
    var st = {q: ''}, self = {};
    el.innerHTML = '<div class="ord-tools"><button class="btn" data-o="seq">📑 依名單序號自動排序</button><button class="btn" data-o="addall">＋ 加入全部尚未排的貴賓</button><button class="btn" data-o="print">🖨 列印順序</button><button class="btn danger" data-o="clear">清除全部順序</button></div>' +
      '<div class="muted small ord-hint">順序 1 最先唱名。可用 ▲▼ 調整，或直接改左邊的數字（例如把 30 改成 2，就會移到第 2 位）。</div><div id="ord-sum" class="ord-sum"></div><div id="ord-list" class="ord-list"></div>' +
      '<section class="pnl ord-add"><h3>＋ 加入貴賓到唱名順序</h3><input id="ord-q" class="inp search" placeholder="🔍 搜尋尚未排順序的貴賓（姓名／單位／職稱）" autocomplete="off"><div id="ord-res"></div></section>';
    function arr() { return V.orderedList().ordered; }
    function commit(a) { var pairs = []; a.forEach(function (r, i) { pairs.push([r.id, i + 1]); }); return V.setOrder(pairs); }
    function upd() {
      var o = V.orderedList(), a = o.ordered, rest = o.rest;
      var an = a.filter(function (r) { return r.an; }).length;
      $('#ord-sum', el).innerHTML = '已排順序 <b>' + a.length + '</b> 位' + (an ? '（已唱名 ' + an + '）' : '') + ' ・ 尚未排順序 <b>' + rest.length + '</b> 位';
      var act = document.activeElement;
      if (!(act && act.classList && act.classList.contains('ord-n') && el.contains(act))) {
        var h = '';
        a.forEach(function (r, i) {
          h += '<div class="ord-row' + (r.an ? ' done' : '') + '" data-id="' + r.id + '"><input class="inp ord-n" inputmode="numeric" value="' + (i + 1) + '" aria-label="順序"><div class="ord-who"><b>' + esc(r.name) + '</b><span class="muted">' + esc(U.addrName(r)) + (r.tbl ? ' ・ ' + esc(U.tblLabel(r.tbl)) : '') + '</span></div>' + statusChip(r) +
            '<div class="ord-btns"><button class="btn sm" data-o="up" aria-label="上移"' + (i ? '' : ' disabled') + '>▲</button><button class="btn sm" data-o="dn" aria-label="下移"' + (i < a.length - 1 ? '' : ' disabled') + '>▼</button><button class="btn sm" data-o="rm" aria-label="移出順序">✕</button></div></div>';
        });
        $('#ord-list', el).innerHTML = h || '<div class="empty">還沒有設定唱名順序。<br>可按上方「依名單序號自動排序」，或在下方搜尋加入貴賓。</div>';
      }
      var q = st.q.trim(), res = rest.filter(function (r) { return !q || U.matches(r, q); }), c = capList(res, 30), rh = '';
      c.items.forEach(function (r) { rh += '<div class="ord-row add" data-id="' + r.id + '"><div class="ord-who"><b>' + esc(r.name) + '</b><span class="muted">' + esc(U.addrName(r)) + '</span></div>' + (r.rsvp === '請假' ? '<span class="tag warn">請假</span>' : '') + '<button class="btn sm primary" data-o="add">＋ 加到最後</button></div>'; });
      $('#ord-res', el).innerHTML = rh ? rh + moreNote(c.more) : '<div class="muted small pad">' + (rest.length ? '沒有符合的貴賓' : '所有貴賓都已排入順序') + '</div>';
    }
    $('#ord-q', el).oninput = debounce(function (e) { st.q = e.target.value; upd(); }, 100);
    el.onclick = function (e) {
      var b = e.target.closest('[data-o]'); if (!b) return;
      var o = b.dataset.o, a = arr(), row = b.closest('[data-id]'), id = row ? row.dataset.id : '', i = -1;
      a.forEach(function (r, k) { if (r.id === id) i = k; });
      if (o === 'up' && i > 0) { var x = a[i]; a[i] = a[i - 1]; a[i - 1] = x; commit(a); }
      else if (o === 'dn' && i >= 0 && i < a.length - 1) { var y = a[i]; a[i] = a[i + 1]; a[i + 1] = y; commit(a); }
      else if (o === 'rm' && i >= 0) { var rr = a.splice(i, 1)[0]; V.setOrder([[rr.id, 0]]).then(function () { commit(arr()); }); }
      else if (o === 'add') { var rec = byId(id); if (rec) { a.push(rec); commit(a); } }
      else if (o === 'print') V.printOrder();
      else if (o === 'seq') {
        V.confirm('依「名單序號」重新排列？現有的順序會被取代。', '重新排序', false).then(function (ok) {
          if (!ok) return; V.ordApi({cmd: 'seq'}).then(function (r) { if (r && r.ok) V.toast('已依序號排好 ' + (r.changed || 0) + ' 位'); });
        });
      }
      else if (o === 'addall') {
        var rest = V.orderedList().rest.filter(function (r) { return r.rsvp !== '請假'; });
        if (!rest.length) { V.toast('沒有需要加入的貴賓'); return; }
        commit(a.concat(rest)).then(function () { V.toast('已加入 ' + rest.length + ' 位到順序最後'); });
      }
      else if (o === 'clear') {
        if (!a.length) return;
        V.confirm('清除全部 ' + a.length + ' 位的唱名順序？（已唱名的紀錄不受影響）', '清除', true).then(function (ok) { if (ok) V.ordApi({cmd: 'clear'}).then(function () { V.toast('已清除順序'); }); });
      }
    };
    el.onchange = function (e) {
      var n = e.target.closest('.ord-n'); if (!n) return;
      var a = arr(), id = n.closest('[data-id]').dataset.id, i = -1, v = parseInt(n.value, 10);
      a.forEach(function (r, k) { if (r.id === id) i = k; });
      if (i < 0 || !(v >= 1)) { upd(); return; }
      var it = a.splice(i, 1)[0]; a.splice(Math.min(v, a.length + 1) - 1, 0, it); n.blur(); commit(a);
    };
    el.onkeydown = function (e) { if (e.key === 'Enter' && e.target.classList && e.target.classList.contains('ord-n')) e.target.blur(); };
    self.update = upd; self.unmount = function () { el.onclick = null; el.onchange = null; };
    return self;
  };
})();

/* ================== 舞台組：主持人唱名順序 ================== */
(function () {
  var st = {tab: 'host', f: 'todo', q: '', fs: +U.lsGet('vip.stageFs', '1')};
  var root, editor = null;
  function hostRow(r, i) {
    var fresh = r.ci && !r.an && Date.now() - r.ci < 180000;
    return '<div class="sc' + (r.an ? ' done' : '') + (!r.ci ? ' abs' : '') + (fresh ? ' fresh' : '') + '" data-id="' + r.id + '"><div class="sc-seq">' + (+r.ord > 0 ? r.ord : '—') + '</div><div class="sc-main"><div class="sc-org">' + esc(U.addrName(r)) + '</div><div class="sc-name">' + esc(r.name) + '</div>' +
      '<div class="sc-meta">' + statusChip(r) + (r.cat ? ' <span class="tag">' + esc(r.cat) + '</span>' : '') + (r.tbl ? ' ・ ' + esc(U.tblLabel(r.tbl)) : '') + (r.rsvp === '請假' ? ' <span class="tag warn">請假</span>' : '') + (r.note ? ' ・ 📝' + esc(r.note) : '') + '</div></div><div class="sc-act">' +
      (r.an ? '<div class="an-done">✓ 已唱名<br><b>' + U.fmtTS(r.an) + '</b></div><button class="btn link" data-a="unan">復原</button>' : '<button class="btn primary xxl" data-a="an">唱名</button>') + '</div></div>';
  }
  function upd() {
    if (!root) return;
    root.className = 'v-stage fs' + st.fs;
    var tabs = chip('🎤 主持人唱名', st.tab === 'host', 'data-t="host"') + chip('↕ 設定唱名順序', st.tab === 'edit', 'data-t="edit"');
    var tb = $('#stabs', root); if (tb.innerHTML !== tabs) tb.innerHTML = tabs;
    $('#shost', root).style.display = st.tab === 'host' ? '' : 'none';
    $('#sedit', root).style.display = st.tab === 'edit' ? '' : 'none';
    if (st.tab === 'edit') { if (!editor) editor = V.mountOrder($('#sedit', root)); editor.update(); return; }
    $('#fs', root).textContent = '字級 ' + ['', 'A', 'A+', 'A++'][st.fs];
    var o = V.orderedList(), a = o.ordered, all = V.list();
    var done = a.filter(function (r) { return r.an; }), todo = a.filter(function (r) { return !r.an; });
    var seatedTodo = todo.filter(function (r) { return r.se; }).length, arrTodo = todo.filter(function (r) { return r.ci && !r.se; }).length;
    $('#stats', root).innerHTML = '<div class="sp"><span>順序內</span><b>' + a.length + '</b></div><div class="sp ok"><span>已唱名</span><b>' + done.length + '</b></div><div class="sp hot"><span>待唱名</span><b>' + todo.length + '</b></div><div class="sp"><span>待唱名・已入座</span><b>' + seatedTodo + '</b></div>';
    var nx = todo[0];
    $('#next', root).innerHTML = nx ? '<div class="nx-l">⏭ 下一位（第 ' + nx.ord + ' 順位）</div><div class="nx-org">' + esc(U.addrName(nx)) + '</div><div class="nx-name">' + esc(nx.name) + '</div><div class="nx-s">' + statusChip(nx) + (nx.tbl ? ' ・ ' + esc(U.tblLabel(nx.tbl)) : '') + '</div><div data-id="' + nx.id + '"><button class="btn primary xxl" data-a="an">唱名</button></div>' :
      (a.length ? '<div class="nx-l">🎉 順序內的貴賓已全部唱名完畢</div>' : '');
    $('#sfl', root).innerHTML = chip('待唱名 ' + todo.length, st.f === 'todo', 'data-f="todo"') + chip('已唱名 ' + done.length, st.f === 'done', 'data-f="done"') + chip('全部', st.f === 'all', 'data-f="all"');
    var q = st.q.trim();
    var arr = a.filter(function (r) { return (st.f === 'all' || (st.f === 'todo' ? !r.an : !!r.an)) && (!q || U.matches(r, q)); });
    if (st.f === 'todo' && !q && nx) arr = arr.slice(1);   // 第一位已在「下一位」大卡片
    var c = capList(arr, 150), out = '';
    if (st.f === 'todo' && !q && nx && arr.length) out += '<div class="sec">之後的順序</div>';
    out += c.items.map(hostRow).join('') + moreNote(c.more);
    if (!a.length) out = '<div class="empty">尚未設定唱名順序。<br>請按上方「↕ 設定唱名順序」，或請管理員在後台設定。</div>';
    else if (!arr.length && !nx) out = '<div class="empty">目前沒有符合的貴賓</div>';
    var extra = o.rest.filter(function (r) { return r.ci && !r.an; });
    if (st.f !== 'done' && !q && extra.length) out += '<div class="sec">未排順序但已到場 · ' + extra.length + '（臨時加入的貴賓）</div>' + extra.slice(0, 30).map(hostRow).join('');
    var lst = $('#list', root); if (lst.innerHTML !== out) lst.innerHTML = out;
  }
  V.views.stage = {
    mount: function (r) {
      root = r; editor = null;
      r.innerHTML = '<div class="chips" id="stabs"></div><div id="shost"><div class="stage-top"><div class="stage-stats" id="stats"></div><div class="stage-ctl"><input id="sq" class="inp sm" placeholder="🔍 搜尋" autocomplete="off"><button class="btn sm" id="fs">字級 A</button><button class="btn sm" id="pr">🖨 列印</button></div></div>' +
        '<div class="next-card" id="next"></div><div class="chips" id="sfl"></div><div id="list" class="stage-list"></div></div><div id="sedit" style="display:none"></div>';
      $('#sq', r).oninput = debounce(function (e) { st.q = e.target.value; upd(); }, 100);
      $('#fs', r).onclick = function () { st.fs = st.fs % 3 + 1; U.lsSet('vip.stageFs', st.fs); upd(); };
      $('#pr', r).onclick = function () { V.printOrder(); };
      r.onclick = function (e) {
        var t = e.target.closest('[data-t]'); if (t && t.closest('#stabs')) { st.tab = t.dataset.t; upd(); return; }
        var f = e.target.closest('#sfl [data-f]'); if (f) { st.f = f.dataset.f; upd(); return; }
        var b = e.target.closest('[data-a]'); if (!b) return;
        var id = b.closest('[data-id]').dataset.id;
        if (b.dataset.a === 'an') V.stage(id, 'an', 1); else if (b.dataset.a === 'unan') V.stage(id, 'an', 0);
      };
      this.timer = setInterval(upd, 20000);
    },
    unmount: function () { clearInterval(this.timer); if (editor) editor.unmount(); editor = null; root = null; },
    update: upd
  };
})();

/* ================== 全部貴賓狀態（所有組別共用・唯讀） ================== */
(function () {
  var st = {mode: 'guest', f: 'all', q: ''};
  var root;
  var STEPS = [['ci', '報到'], ['se', '入座'], ['an', '唱名']];
  var FL = [['all', '全部'], ['none', '尚未報到'], ['ci', '已報到・待入座'], ['se', '已入座'], ['an', '已唱名']];
  function key(r) { return U.stageKey(r) || 'none'; }
  function stepsHtml(r) {
    return '<div class="ag-steps">' + STEPS.map(function (x) {
      var k = x[0], t = r[k];
      if (t) return '<div class="stp on"><span class="sl">' + x[1] + '</span><span class="stt">' + T(t) + '</span><span class="sb">' + esc(r[k + 'By'] || '') + '</span></div>';
      return '<div class="stp"><span class="sl">' + x[1] + '</span><span class="stt">—</span><span class="sb"></span></div>';
    }).join('') + '</div>';
  }
  function row(r) {
    var k = key(r), lab = (FL.filter(function (x) { return x[0] === k; })[0] || [0, ''])[1];
    return '<div class="card ag s-' + k + '" data-id="' + r.id + '"><div class="ag-h">' + seqBadge(r) + '<div class="ag-n"><b>' + esc(r.name) + '</b><span class="ag-sub">' + esc(U.addrName(r)) + '</span></div>' +
      '<span class="ag-st s-' + k + '">' + lab + '</span><span class="tbl-badge sm">' + esc(U.tblLabel(r.tbl) || '未排桌') + '</span></div>' +
      '<div class="g-meta">' + tags(r) + (+r.ord > 0 ? '<span class="tag">唱名第 ' + r.ord + ' 順位</span>' : '') + (r.note ? '<span class="note">📝 ' + esc(r.note) + '</span>' : '') + '</div>' + stepsHtml(r) + '</div>';
  }
  function tablesHtml(arr) {
    var m = {}, keys = [];
    arr.forEach(function (r) { var k = String(r.tbl || '').trim(); if (!m[k]) { m[k] = []; keys.push(k); } m[k].push(r); });
    keys.sort(function (a, b) { return U.tblNum(a) - U.tblNum(b) || a.localeCompare(b); });
    return keys.map(function (k) {
      var g = m[k], seated = g.filter(function (r) { return r.se; }).length, arrived = g.filter(function (r) { return r.ci; }).length;
      return '<div class="card tb"><div class="tb-h"><span class="tbl-badge sm">' + esc(U.tblLabel(k) || '未排桌') + '</span><span class="tb-c">入座 <b>' + seated + '</b>／報到 <b>' + arrived + '</b>／共 ' + g.length + '</span></div><div class="tb-g">' +
        g.sort(function (a, b) { return (a.seq || 0) - (b.seq || 0); }).map(function (r) {
          var kk = key(r);
          return '<span class="tb-p s-' + kk + '" title="' + esc(r.name) + (r.se ? '・入座 ' + T(r.se) : r.ci ? '・報到 ' + T(r.ci) : '') + '">' + esc(r.name) + '<i>' + (r.an ? '🎤' : r.se ? '🪑' : r.ci ? '✅' : '') + '</i></span>';
        }).join('') + '</div></div>';
    }).join('');
  }
  function upd() {
    if (!root) return;
    var all = V.list(), cnt = {all: all.length};
    all.forEach(function (r) { var k = key(r); cnt[k] = (cnt[k] || 0) + 1; });
    var q = st.q.trim();
    $('#afl', root).innerHTML = FL.map(function (x) { return chip(x[1] + ' <b>' + (cnt[x[0]] || 0) + '</b>', st.f === x[0], 'data-f="' + x[0] + '"'); }).join('');
    $('#amd', root).innerHTML = chip('👤 依貴賓', st.mode === 'guest', 'data-m="guest"') + chip('🪑 依桌次', st.mode === 'table', 'data-m="table"');
    var arr = all.filter(function (r) { return (st.f === 'all' || key(r) === st.f) && U.matches(r, q); });
    arr.sort(function (a, b) { return (a.seq || 99999) - (b.seq || 99999); });
    var out;
    if (st.mode === 'table') out = tablesHtml(arr) || '<div class="empty">沒有符合的貴賓</div>';
    else { var c = capList(arr, 100); out = c.items.map(row).join('') + moreNote(c.more); if (!arr.length) out = '<div class="empty">沒有符合的貴賓</div>'; }
    $('#alist', root).innerHTML = out;
    $('#acount', root).textContent = '共 ' + arr.length + ' 位';
  }
  V.views.all = {
    mount: function (r) {
      root = r;
      r.innerHTML = '<div class="ro-note">👀 唯讀檢視：這裡看得到所有組別、每位貴賓目前的進度與時間。要操作請按上方「我的工作」。</div>' +
        '<div class="bar"><input id="aq" class="inp search" placeholder="🔍 搜尋姓名／單位／桌次" autocomplete="off"></div>' +
        '<div class="chips scroll" id="afl"></div><div class="chips" id="amd"></div><div class="muted small ag-count" id="acount"></div><div id="alist" class="cards"></div>';
      $('#aq', r).value = st.q;
      $('#aq', r).oninput = debounce(function (e) { st.q = e.target.value; upd(); }, 120);
      r.onclick = function (e) {
        var b = e.target.closest('[data-f],[data-m]'); if (!b) return;
        if (b.dataset.f) st.f = b.dataset.f; if (b.dataset.m) st.mode = b.dataset.m; upd();
      };
    },
    update: upd,
    unmount: function () { root = null; }
  };
})();

V.printHtml = function (html) {
  var d = document.createElement('div'); d.id = 'print-host'; d.innerHTML = html; document.body.appendChild(d);
  document.body.classList.add('printing');
  setTimeout(function () { try { window.print(); } catch (e) {} setTimeout(function () { d.remove(); document.body.classList.remove('printing'); }, 500); }, 50);
};
})();

