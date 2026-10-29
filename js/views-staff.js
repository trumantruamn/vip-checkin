/* 交通組／報到組／接待組／舞台組 畫面 */
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

/* ================== 交通組 ================== */
(function () {
  var st = {tab: 'todo', drv: U.lsGet('vip.trDrv', ''), q: ''};
  var root;
  V.views.transport = {
    mount: function (r) {
      root = r;
      r.innerHTML = '<div class="bar"><input id="q" class="inp search" placeholder="🔍 搜尋姓名／單位／車號" autocomplete="off"></div>' +
        '<div class="chips scroll" id="drv"></div><div class="tabs" id="tabs"></div><div id="list" class="cards"></div>';
      $('#q', r).oninput = debounce(function (e) { st.q = e.target.value; V.views.transport.update(); }, 120);
      r.onclick = function (e) {
        var b = e.target.closest('[data-a],[data-tab],[data-drv]');
        if (!b) return;
        if (b.dataset.tab) { st.tab = b.dataset.tab; this_update(); return; }
        if (b.dataset.drv !== undefined) { st.drv = b.dataset.drv; U.lsSet('vip.trDrv', st.drv); this_update(); return; }
        var id = b.closest('[data-id]').dataset.id, a = b.dataset.a;
        if (a === 'pk') V.stage(id, 'pk', 1);
        else if (a === 'dl') V.stage(id, 'dl', 1);
        else if (a === 'unpk') V.stage(id, 'pk', 0);
        else if (a === 'undl') V.stage(id, 'dl', 0);
      };
    },
    update: this_update
  };
  function this_update() {
    if (!root) return;
    var all = V.list().filter(U.isTr);
    var drvs = {};
    all.forEach(function (r) { var k = r.tr || r.veh || '(未指定)'; drvs[k] = (drvs[k] || 0) + (r.pk ? 0 : 1); });
    var h = chip('全部 (' + all.length + ')', !st.drv, 'data-drv=""');
    Object.keys(drvs).sort().forEach(function (k) { h += chip(esc(k) + (drvs[k] ? ' · 待接 ' + drvs[k] : ''), st.drv === k, 'data-drv="' + esc(k) + '"'); });
    $('#drv', root).innerHTML = h;
    var mine = all.filter(function (r) { return (!st.drv || (r.tr || r.veh || '(未指定)') === st.drv) && U.matches(r, st.q); });
    var todo = mine.filter(function (r) { return !r.pk; }), on = mine.filter(function (r) { return r.pk && !r.dl; }), done = mine.filter(function (r) { return r.dl; });
    $('#tabs', root).innerHTML = chip('待接送 <b>' + todo.length + '</b>', st.tab === 'todo', 'data-tab="todo"') + chip('已接到・在途 <b>' + on.length + '</b>', st.tab === 'onway', 'data-tab="onway"') + chip('已送達 <b>' + done.length + '</b>', st.tab === 'done', 'data-tab="done"');
    var arr = st.tab === 'todo' ? todo.sort(function (a, b) { return (a.pl || '').localeCompare(b.pl || '') || (a.seq || 0) - (b.seq || 0); }) :
      st.tab === 'onway' ? on.sort(function (a, b) { return a.pk - b.pk; }) : done.sort(function (a, b) { return b.dl - a.dl; });
    var c = capList(arr, 120), out = '';
    c.items.forEach(function (r) {
      out += '<div class="card g" data-id="' + r.id + '"><div class="g-main"><div class="g-name">' + esc(r.name) + '</div><div class="g-sub">' + esc(U.addrName(r)) + '</div>' +
        '<div class="g-meta">' + (r.tr ? '🚐 ' + esc(r.tr) + ' ' : '') + (r.veh ? '<b>' + esc(r.veh) + '</b> ' : '') + (r.pl ? '📍 ' + esc(r.pl) : '') + '</div>' +
        (r.ci ? '<div class="g-meta ok">✅ 已報到 ' + T(r.ci) + '</div>' : '') +
        (r.pk ? '<div class="g-meta">接到 ' + T(r.pk) + '（' + esc(r.pkBy || '') + '）' + (r.dl ? '・送達 ' + T(r.dl) + '（' + esc(r.dlBy || '') + '）' : '') + '</div>' : '') + '</div><div class="g-act">';
      if (!r.pk) out += '<button class="btn primary xl" data-a="pk">已接到</button>';
      else if (!r.dl) out += '<button class="btn ok xl" data-a="dl">已送達門口</button><button class="btn link" data-a="unpk">復原「已接到」</button>';
      else out += '<div class="done-mark">✓ ' + T(r.dl) + '</div><button class="btn link" data-a="undl">復原「已送達」</button>';
      out += '</div></div>';
    });
    $('#list', root).innerHTML = (out || '<div class="empty">' + (all.length ? '這個分頁沒有貴賓' : '目前沒有分配給交通組的貴賓') + '</div>') + moreNote(c.more);
  }
})();

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
      var h = '<div class="card g' + (r.ci ? ' arrived' : '') + (r.dl && !r.ci ? ' hot' : '') + '" data-id="' + r.id + '">' + seqBadge(r) + '<div class="g-main"><div class="g-name">' + esc(r.name) + '</div><div class="g-sub">' + esc(U.addrName(r)) + '</div><div class="g-meta">' + tags(r) +
        (r.dl && !r.ci ? '<span class="tag hot">🚐 已到門口 ' + T(r.dl) + '</span>' : r.pk && !r.ci ? '<span class="tag hot2">🚐 接送中・即將抵達</span>' : (U.isTr(r) && !r.pk && !r.ci ? '<span class="tag">有專車接送</span>' : '')) + (r.note ? '<span class="note">📝 ' + esc(r.note) + '</span>' : '') + '</div></div><div class="g-act">';
      if (r.ci) h += '<div class="tbl-badge sm">' + esc(U.tblLabel(r.tbl) || '未排桌') + '</div><div class="muted small">' + T(r.ci) + ' 已報到</div><button class="btn" data-a="show">查看</button>';
      else h += '<button class="btn ok xl" data-a="ci">報到</button>';
      return h + '</div></div>';
    }
    if (!q && st.status === 'todo') {
      var d = arr.filter(function (r) { return r.dl; }).sort(function (a, b) { return b.dl - a.dl; }), p = arr.filter(function (r) { return r.pk && !r.dl; }).sort(function (a, b) { return b.pk - a.pk; });
      var rest = arr.filter(function (r) { return !r.dl && !r.pk; }).sort(function (a, b) { return (a.seq || 99999) - (b.seq || 99999); });
      if (d.length) out += '<div class="sec hot">🚐 已到門口（交通組已送達） · ' + d.length + '</div>' + d.map(row).join('');
      if (p.length) out += '<div class="sec hot2">🚐 接送中・即將抵達 · ' + p.length + '</div>' + p.map(row).join('');
      var c = capList(rest, 60);
      out += '<div class="sec">其他待報到 · ' + rest.length + '（輸入姓名／單位快速搜尋）</div>' + c.items.map(row).join('') + moreNote(c.more);
    } else {
      arr.sort(function (a, b) { return (a.ci ? 1 : 0) - (b.ci ? 1 : 0) || (a.seq || 99999) - (b.seq || 99999); });
      var c2 = capList(arr, 80);
      out = c2.items.map(row).join('') + moreNote(c2.more);
    }
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

/* ================== 接待組 ================== */
(function () {
  var st = {tab: 'wait', f: 'all', tbl: ''};
  var root;
  V.views.reception = {
    mount: function (r) {
      root = r;
      r.innerHTML = '<div class="bar"><input id="tb" class="inp search" placeholder="🔍 桌次或姓名" inputmode="search" autocomplete="off"></div><div class="tabs" id="tabs"></div><div class="chips scroll" id="fl"></div><div id="list" class="cards"></div>';
      $('#tb', r).oninput = debounce(function (e) { st.tbl = e.target.value; upd(); }, 100);
      r.onclick = function (e) {
        var b = e.target.closest('[data-a],[data-tab],[data-f]'); if (!b) return;
        if (b.dataset.tab) { st.tab = b.dataset.tab; upd(); return; }
        if (b.dataset.f) { st.f = b.dataset.f; upd(); return; }
        var id = b.closest('[data-id]').dataset.id, a = b.dataset.a;
        if (a === 'cl') V.stage(id, 'cl', 1);
        else if (a === 'uncl') V.stage(id, 'cl', 0);
        else if (a === 'take') { V.stage(id, 'cl', 0); V.stage(id, 'cl', 1); }
        else if (a === 'se') { V.stage(id, 'se', 1); }
        else if (a === 'unse') V.stage(id, 'se', 0);
      };
      this.timer = setInterval(upd, 30000);
    },
    unmount: function () { clearInterval(this.timer); },
    update: upd
  };
  function upd() {
    if (!root) return;
    var all = V.list().filter(function (r) { return r.ci; }), q = st.tbl.trim();
    var wait = all.filter(function (r) { return !r.se; }), seated = all.filter(function (r) { return r.se; });
    $('#tabs', root).innerHTML = chip('等待帶位 <b>' + wait.length + '</b>', st.tab === 'wait', 'data-tab="wait"') + chip('已入座 <b>' + seated.length + '</b>', st.tab === 'seated', 'data-tab="seated"');
    var unc = wait.filter(function (r) { return !r.cl; }).length, mine = wait.filter(function (r) { return r.cl && r.clBy === S.staff; }).length;
    $('#fl', root).innerHTML = st.tab === 'wait' ? chip('全部', st.f === 'all', 'data-f="all"') + chip('未認領 ' + unc, st.f === 'un', 'data-f="un"') + chip('我帶的 ' + mine, st.f === 'me', 'data-f="me"') : '';
    var arr = (st.tab === 'wait' ? wait : seated).filter(function (r) {
      if (q && !(U.matches(r, q))) return false;
      if (st.tab === 'wait') { if (st.f === 'un') return !r.cl; if (st.f === 'me') return r.cl && r.clBy === S.staff; }
      return true;
    });
    arr.sort(st.tab === 'wait' ? function (a, b) { return a.ci - b.ci; } : function (a, b) { return b.se - a.se; });
    var c = capList(arr, 100), out = '';
    c.items.forEach(function (r) {
      var w = U.waitMin(r.ci), mineC = r.cl && r.clBy === S.staff;
      out += '<div class="card g rc' + (r.cl ? ' claimed' : '') + (mineC ? ' mine' : '') + (r.se ? ' seated' : '') + '" data-id="' + r.id + '"><div class="tbl-badge">' + esc(U.tblLabel(r.tbl) || '未排桌') + '</div><div class="g-main"><div class="g-name">' + esc(r.name) + '</div><div class="g-sub">' + esc(U.addrName(r)) + '</div><div class="g-meta">';
      if (r.se) out += '✓ 入座 ' + T(r.se) + '（' + esc(r.seBy || '') + '）';
      else out += '報到 ' + T(r.ci) + ' · <span class="' + (w >= 5 ? 'late' : '') + '">等候 ' + w + ' 分</span> · ' + (r.cl ? '👤 <b>' + esc(r.clBy) + '</b> 帶領中' : '<span class="un">尚未有人認領</span>');
      out += '</div>' + (r.note ? '<div class="g-meta">📝 ' + esc(r.note) + '</div>' : '') + '</div><div class="g-act">';
      if (r.se) out += '<button class="btn link" data-a="unse">復原入座</button>';
      else if (!r.cl) out += '<button class="btn primary xl" data-a="cl">我來帶</button><button class="btn link" data-a="se">直接標記入座</button>';
      else if (mineC) out += '<button class="btn ok xl" data-a="se">已入座</button><button class="btn link" data-a="uncl">放棄帶領</button>';
      else out += '<button class="btn ok" data-a="se">已入座</button><button class="btn link" data-a="take">改我來帶</button>';
      out += '</div></div>';
    });
    $('#list', root).innerHTML = (out || '<div class="empty">' + (st.tab === 'wait' ? '目前沒有等待帶位的貴賓 👍' : '尚無已入座貴賓') + '</div>') + moreNote(c.more);
  }
})();

/* ================== 舞台組 ================== */
(function () {
  var st = {sort: 'seq', f: 'todo', cat: '', showAbs: false, fs: +U.lsGet('vip.stageFs', '1')};
  var root;
  V.views.stage = {
    mount: function (r) {
      root = r;
      r.innerHTML = '<div class="stage-top"><div class="stage-stats" id="stats"></div><div class="stage-ctl"><select id="cat" class="inp sm"></select><button class="btn sm" id="fs">字級 A</button><button class="btn sm" id="pr">🖨 列印</button></div></div>' +
        '<div class="chips" id="fl"></div><div id="list" class="stage-list"></div>';
      var self = this;
      $('#cat', r).onchange = function (e) { st.cat = e.target.value; upd(); };
      $('#fs', r).onclick = function () { st.fs = st.fs % 3 + 1; U.lsSet('vip.stageFs', st.fs); upd(); };
      $('#pr', r).onclick = function () { printList(); };
      r.onclick = function (e) {
        var b = e.target.closest('[data-a],[data-f]'); if (!b) return;
        if (b.dataset.f) { var f = b.dataset.f; if (f === 'sortseq') st.sort = 'seq'; else if (f === 'sortnew') st.sort = 'new'; else if (f === 'abs') st.showAbs = !st.showAbs; else st.f = f; upd(); return; }
        var id = b.closest('[data-id]').dataset.id;
        if (b.dataset.a === 'an') V.stage(id, 'an', 1); else if (b.dataset.a === 'unan') V.stage(id, 'an', 0);
      };
      this.timer = setInterval(upd, 20000);
    },
    unmount: function () { clearInterval(this.timer); },
    update: upd
  };
  function upd() {
    if (!root) return;
    root.className = 'v-stage fs' + st.fs;
    $('#fs', root).textContent = '字級 ' + ['', 'A', 'A+', 'A++'][st.fs];
    var cs = $('#cat', root); if (cs.options.length - 1 !== ((S.ev && S.ev.cats) || []).length) cs.innerHTML = catOptions(st.cat, true);
    var all = V.list(), arrived = all.filter(function (r) { return r.ci; }), an = arrived.filter(function (r) { return r.an; });
    $('#stats', root).innerHTML = '<div class="sp"><span>預計</span><b>' + all.filter(U.isExpected).length + '</b></div><div class="sp"><span>已到</span><b>' + arrived.length + '</b></div><div class="sp ok"><span>已唱名</span><b>' + an.length + '</b></div><div class="sp hot"><span>待唱名</span><b>' + (arrived.length - an.length) + '</b></div><div class="sp"><span>未到</span><b>' + all.filter(function (r) { return U.isExpected(r) && !r.ci; }).length + '</b></div>';
    $('#fl', root).innerHTML = chip('待唱名', st.f === 'todo', 'data-f="todo"') + chip('已唱名', st.f === 'done', 'data-f="done"') + chip('全部到場', st.f === 'all', 'data-f="all"') + '<span class="sepv"></span>' +
      chip('依唱名順序(序)', st.sort === 'seq', 'data-f="sortseq"') + chip('最新抵達優先', st.sort === 'new', 'data-f="sortnew"') + '<span class="sepv"></span>' + chip('顯示未到貴賓', st.showAbs, 'data-f="abs"');
    var arr = all.filter(function (r) {
      if (st.cat && r.cat !== st.cat) return false;
      if (!r.ci) return st.showAbs && U.isExpected(r) && st.f !== 'done';
      return st.f === 'all' || (st.f === 'todo' ? !r.an : !!r.an);
    });
    arr.sort(function (a, b) {
      var an = a.ci ? 0 : 1, bn = b.ci ? 0 : 1; if (an !== bn) return an - bn;
      if (st.sort === 'new') return (b.ci || 0) - (a.ci || 0) || (a.seq || 0) - (b.seq || 0);
      return (a.seq || 99999) - (b.seq || 99999);
    });
    var c = capList(arr, 150), out = '', now = Date.now();
    c.items.forEach(function (r) {
      var fresh = r.ci && !r.an && now - r.ci < 180000;
      out += '<div class="sc' + (r.an ? ' done' : '') + (!r.ci ? ' abs' : '') + (fresh ? ' fresh' : '') + '" data-id="' + r.id + '"><div class="sc-seq">' + (r.seq && r.seq < 99999 ? r.seq : '新') + '</div><div class="sc-main"><div class="sc-org">' + esc(U.addrName(r)) + '</div><div class="sc-name">' + esc(r.name) + '</div>' +
        '<div class="sc-meta">' + (r.cat ? '<span class="tag">' + esc(r.cat) + '</span>' : '') + (r.ci ? '到場 <b>' + T(r.ci) + '</b>' : '<span class="late">尚未到場</span>') + (r.ci ? (r.se ? ' ・ <span class="okc">已入座 ' + T(r.se) + '</span>' : ' ・ <span class="warnc">尚未入座</span>') : '') + (r.tbl ? ' ・ ' + esc(U.tblLabel(r.tbl)) : '') + (fresh ? ' <span class="tag hot">NEW</span>' : '') + (r.note ? ' ・ 📝' + esc(r.note) : '') + '</div></div><div class="sc-act">';
      if (!r.ci) out += '<div class="muted">未到</div>';
      else if (r.an) out += '<div class="an-done">✓ 已唱名<br><b>' + T(r.an) + '</b></div><button class="btn link" data-a="unan">復原</button>';
      else out += '<button class="btn primary xxl" data-a="an">唱名</button>';
      out += '</div></div>';
    });
    $('#list', root).innerHTML = (out || '<div class="empty">目前沒有符合的貴賓</div>') + moreNote(c.more);
  }
  function printList() {
    var all = V.list().filter(function (r) { return !st.cat || r.cat === st.cat; }).sort(function (a, b) { return (a.seq || 99999) - (b.seq || 99999); });
    var h = '<div id="print-area"><h2>' + esc(S.ev ? S.ev.name : '') + ' 司儀唱名表</h2><table><tr><th>序</th><th>類別</th><th>單位</th><th>職稱</th><th>姓名</th><th>桌次</th><th>唱名</th></tr>';
    all.forEach(function (r) { h += '<tr><td>' + (r.seq && r.seq < 99999 ? r.seq : '') + '</td><td>' + esc(r.cat) + '</td><td>' + esc(r.org) + '</td><td>' + esc(r.title) + '</td><td><b>' + esc(r.name) + '</b></td><td>' + esc(U.tblLabel(r.tbl)) + '</td><td>☐</td></tr>'; });
    V.printHtml(h + '</table></div>');
  }
})();

V.printHtml = function (html) {
  var d = document.createElement('div'); d.id = 'print-host'; d.innerHTML = html; document.body.appendChild(d);
  document.body.classList.add('printing');
  setTimeout(function () { try { window.print(); } catch (e) {} setTimeout(function () { d.remove(); document.body.classList.remove('printing'); }, 500); }, 50);
};
})();
