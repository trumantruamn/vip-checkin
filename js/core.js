/* 貴賓報到系統 — 核心：API / 資料倉 / 離線佇列 / 同步 / 共用 UI */
(function () {
'use strict';
var CFG = window.VIP_CONFIG || {};
var BRAND = (function () {
  var d = {name: '三恆一樹', en: 'TREE OF ETERNITY', appName: '貴賓報到系統', logoH: 'img/logo-h.png', logoV: 'img/logo-v.png', favicon: 'img/favicon.png', themeColor: '#78BFBB'};
  var b = CFG.BRAND || {}; for (var k in b) if (b[k] !== undefined && b[k] !== null) d[k] = b[k];
  return d;
})();
(function applyBrand() {
  try {
    document.title = BRAND.appName + (BRAND.name ? '｜' + BRAND.name : '');
    var head = document.head, set = function (sel, mk) { var el = head.querySelector(sel) || head.appendChild(mk()); return el; };
    if (BRAND.favicon) { var ic = set('link[rel=icon]', function () { var l = document.createElement('link'); l.rel = 'icon'; return l; }); ic.href = BRAND.favicon; }
    var tc = head.querySelector('meta[name=theme-color]'); if (tc && BRAND.themeColor) tc.setAttribute('content', BRAND.themeColor);
  } catch (e) {}
})();
function brandFoot() {
  return '<footer class="foot">' + (BRAND.logoH ? '<img src="' + esc(BRAND.logoH) + '" alt="">' : '') + '<span>' + esc(BRAND.appName) + ' · ' + esc(BRAND.name) + (BRAND.en ? ' ' + esc(BRAND.en) : '') + '</span></footer>';
}
var V = window.VIP = {};
V.BRAND = BRAND;
var LS = window.localStorage;
function lsGet(k, d) { try { var v = LS.getItem(k); return v === null ? d : v; } catch (e) { return d; } }
function lsSet(k, v) { try { LS.setItem(k, v); } catch (e) {} }
function lsDel(k) { try { LS.removeItem(k); } catch (e) {} }

/* ---------- 工具 ---------- */
var ROLES = {
  transport: {name: '交通組', icon: '🚐', desc: '接送貴賓'},
  checkin: {name: '報到組', icon: '✅', desc: '報到櫃檯'},
  reception: {name: '接待組', icon: '🤝', desc: '引導入座'},
  stage: {name: '舞台組', icon: '🎤', desc: '司儀唱名'},
  director: {name: '活動總召', icon: '📊', desc: '即時總覽（唯讀）'},
  admin: {name: '後台管理', icon: '⚙️', desc: '名單與設定'}
};
var STAGES = {
  pk: {label: '已接到', role: 'transport'}, dl: {label: '已送達門口', role: 'transport'},
  ci: {label: '已報到', role: 'checkin'}, cl: {label: '帶領中', role: 'reception'},
  se: {label: '已入座', role: 'reception'}, an: {label: '已唱名', role: 'stage'}
};
V.ROLES = ROLES; V.STAGES = STAGES;
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]; }); }
var tfmt = new Intl.DateTimeFormat('zh-TW', {timeZone: 'Asia/Taipei', hour: '2-digit', minute: '2-digit', hour12: false});
var tfmtS = new Intl.DateTimeFormat('zh-TW', {timeZone: 'Asia/Taipei', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false});
function fmtT(ms) { return ms ? tfmt.format(new Date(ms)).replace(/^24/, '00') : ''; }
function fmtTS(ms) { return ms ? tfmtS.format(new Date(ms)).replace(/^24/, '00') : ''; }
function fmtDT(ms) {
  if (!ms) return '';
  var p = new Intl.DateTimeFormat('en-CA', {timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false}).format(new Date(ms));
  return p.replace(',', '').replace(/ 24:/, ' 00:');
}
function ago(ms) {
  var m = Math.floor((Date.now() - ms) / 60000);
  if (m < 1) return '剛剛'; if (m < 60) return m + ' 分鐘前';
  return Math.floor(m / 60) + ' 小時 ' + (m % 60) + ' 分前';
}
function waitMin(ms) { return Math.max(0, Math.floor((Date.now() - ms) / 60000)); }
function tblLabel(t) { t = String(t || '').trim(); if (!t) return ''; return /^\d+$/.test(t) ? '第' + t + '桌' : t; }
function tblNum(t) { var m = /\d+/.exec(String(t || '')); return m ? +m[0] : 9999; }
function uid(n) { var a = 'abcdefghjkmnpqrstuvwxyz23456789', s = ''; for (var i = 0; i < (n || 8); i++) s += a[Math.floor(Math.random() * a.length)]; return s; }
function norm(s) { return String(s || '').toLowerCase().replace(/\s+/g, ''); }
function hay(r) {
  if (r._h && r._hu === r.u + '|' + (r.tbl || '')) return r._h;
  r._hu = r.u + '|' + (r.tbl || '');
  return (r._h = norm([r.name, r.org, r.title, r.seq, r.tbl, tblLabel(r.tbl), r.cat, r.note, r.tr, r.veh].join(' ')));
}
function matches(r, q) {
  if (!q) return true;
  var toks = String(q).toLowerCase().split(/\s+/).filter(Boolean), h = hay(r);
  for (var i = 0; i < toks.length; i++) if (h.indexOf(toks[i]) < 0) return false;
  return true;
}
function isTr(r) { return !!(r.tr || r.veh || r.pl); }
function isExpected(r) { return !r.walk && r.rsvp !== '請假'; }
function stageKey(r) { return r.an ? 'an' : r.se ? 'se' : r.cl ? 'cl' : r.ci ? 'ci' : r.dl ? 'dl' : r.pk ? 'pk' : ''; }
function addrName(r) { return [r.org, r.title].filter(Boolean).join(' '); }
V.u = {esc: esc, fmtT: fmtT, fmtTS: fmtTS, fmtDT: fmtDT, ago: ago, waitMin: waitMin, tblLabel: tblLabel, tblNum: tblNum, uid: uid, matches: matches, isTr: isTr, isExpected: isExpected, stageKey: stageKey, addrName: addrName, norm: norm, lsGet: lsGet, lsSet: lsSet, lsDel: lsDel};

/* ---------- API ---------- */
var qs = new URLSearchParams(location.search);
var apiUrl = CFG.API_URL || qs.get('api') || lsGet('vip.api', '');
if (qs.get('api')) lsSet('vip.api', qs.get('api'));
var DEMO = !apiUrl || qs.get('demo') === '1';
V.demo = DEMO; V.apiUrl = apiUrl;

function api(body) {
  if (DEMO) {
    return new Promise(function (res, rej) {
      setTimeout(function () {
        try { res(JSON.parse(window.VIPDEMO.handle(JSON.stringify(body)))); } catch (e) { rej(e); }
      }, 30 + Math.random() * 90);
    });
  }
  var ctl = new AbortController(), to = setTimeout(function () { ctl.abort(); }, 28000);
  return fetch(apiUrl, {method: 'POST', body: JSON.stringify(body), headers: {'Content-Type': 'text/plain;charset=utf-8'}, redirect: 'follow', signal: ctl.signal})
    .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .finally(function () { clearTimeout(to); });
}
V.api = api;

/* ---------- 資料倉 ---------- */
var S = V.S = {code: '', role: '', ev: null, evId: '', base: {}, ver: 0, epoch: 0, mv: 0, have: false, pending: [], online: true, lastOk: 0, staff: '', dev: lsGet('vip.dev', ''), events: null};
function staffKey() { return 'vip.staff.' + (S.role || ''); }
if (!S.dev) { S.dev = 'D' + uid(5); lsSet('vip.dev', S.dev); }
var subs = [], listCache = null, listVer = 0;
function subscribe(fn) { subs.push(fn); return function () { subs = subs.filter(function (x) { return x !== fn; }); }; }
var notifyQ = false;
function notify() {
  listCache = null;
  if (notifyQ) return; notifyQ = true;
  requestAnimationFrame(function () { notifyQ = false; subs.slice().forEach(function (f) { try { f(); } catch (e) { console.error(e); } }); });
}
function applyLocal(rec, act) {
  var t = act.t;
  if (act.a === 'st') {
    var by = act.s + 'By';
    if (act.on) { if (!rec[act.s]) { rec[act.s] = t; rec[by] = S.staff; } }
    else { delete rec[act.s]; delete rec[by]; }
  } else if (act.a === 'edit') {
    for (var k in act.f) { var v = act.f[k]; if (v === '' || v === 0 || v == null) delete rec[k]; else rec[k] = v; }
  } else if (act.a === 'del') rec.del = 1;
  return rec;
}
function list() {
  if (listCache) return listCache;
  var ov = {}, extra = [];
  S.pending.forEach(function (a) {
    var id = a.g;
    if (a.a === 'walkin' || a.a === 'add') {
      if (!S.base[id] && !ov[id]) {
        var f = a.f || {}, r = {id: id, u: 0, seq: 99999, name: f.name, org: f.org, title: f.title, cat: f.cat, tbl: f.tbl, note: f.note, rsvp: a.a === 'walkin' ? '現場新增' : f.rsvp, tr: f.tr, veh: f.veh, pl: f.pl, grp: f.grp, _local: 1};
        if (a.a === 'walkin') { r.walk = 1; r.ci = a.t; r.ciBy = S.staff; }
        ov[id] = r;
      }
      return;
    }
    var base = ov[id] || S.base[id];
    if (!base) return;
    if (!ov[id]) ov[id] = Object.assign({}, base);
    applyLocal(ov[id], a); ov[id]._local = 1;
  });
  var out = [];
  Object.keys(S.base).forEach(function (id) { var r = ov[id] || S.base[id]; if (!r.del) out.push(r); });
  Object.keys(ov).forEach(function (id) { if (!S.base[id] && !ov[id].del) out.push(ov[id]); });
  return (listCache = out);
}
V.list = list; V.subscribe = subscribe; V.notify = notify;
V.get = function (id) { var l = list(); for (var i = 0; i < l.length; i++) if (l[i].id === id) return l[i]; return null; };

function persistKey() { return 'vip.st.' + S.code + (S.role === 'admin' ? '.' + S.evId : ''); }
var persistT = null;
function persist() {
  if (persistT) return;
  persistT = setTimeout(function () {
    persistT = null;
    if (!S.code) return;
    lsSet(persistKey(), JSON.stringify({base: S.base, ver: S.ver, epoch: S.epoch, mv: S.mv, have: S.have, ev: S.ev, pending: S.pending}));
  }, 400);
}
function restore() {
  var raw = lsGet(persistKey(), null);
  if (!raw) return;
  try { var o = JSON.parse(raw); S.base = o.base || {}; S.ver = o.ver || 0; S.epoch = o.epoch || 0; S.mv = o.mv || 0; S.have = !!o.have; S.ev = o.ev || S.ev; S.pending = o.pending || []; } catch (e) {}
}

/* 送出動作（先樂觀更新，再進佇列） */
V.act = function (act) {
  act.cid = uid(10); act.t = Date.now();
  S.pending.push(act); listCache = null; persist(); notify(); kick(60);
  return act.cid;
};
V.stage = function (id, s, on) { return V.act({a: 'st', g: id, s: s, on: on ? 1 : 0}); };

var timer = null, busy = false, fails = 0, forceNext = false, lastForce = Date.now();
function kick(ms) { clearTimeout(timer); timer = setTimeout(cycle, ms == null ? 0 : ms); }
V.kick = kick;
function nextDelay() {
  var base = CFG.POLL_MS || 3500;
  if (DEMO) base = 1500;
  if (document.hidden) base = 15000;
  if (fails) base = Math.min(20000, base * Math.pow(1.7, fails));
  return base + Math.random() * 700;
}
function cycle() {
  if (busy || !S.code) return;
  if (S.role === 'admin' && !S.evId) { timer = setTimeout(cycle, 1000); return; }
  busy = true;
  var sent = S.pending.slice(0, 30), now = Date.now();
  var force = forceNext || (now - lastForce > 60000);
  var body = {op: 'sync', code: S.code, ev: S.evId, since: S.ver, epoch: S.epoch, mv: S.mv, have: S.have, staff: S.staff, dev: S.dev, force: force,
    acts: sent.map(function (a) { return {cid: a.cid, a: a.a, g: a.g, s: a.s, on: a.on, f: a.f, age: now - a.t}; })};
  if (!sent.length) delete body.acts;
  api(body).then(function (r) {
    busy = false;
    if (!r.ok) {
      if (r.error === 'busy') { fails = 1; setStatus(true); return; }
      if (r.error === 'auth' || r.error === 'noadmin') { V.logout('存取碼已失效，請重新輸入'); return; }
      if (r.error === 'noevent') { setStatus(true); toast(r.msg || '活動不存在', 'bad'); fails = 2; return; }
      throw new Error(r.msg || r.error);
    }
    fails = 0; if (force) { forceNext = false; lastForce = Date.now(); }
    var changed = false;
    if (r.meta) { S.ev = r.meta; S.mv = r.mv; changed = true; }
    if (r.full) { S.base = {}; }
    r.recs.forEach(function (x) {
      if (x.hide || x.del) delete S.base[x.id]; else { var o = S.base[x.id]; if (!o || (x.u || 0) >= (o.u || 0)) S.base[x.id] = x; }
    });
    if (r.res) {
      var done = {};
      r.res.forEach(function (x) {
        if (x.err === 'busy') return;
        done[x.cid] = 1;
        if (x.rec && x.rec.id) { if (x.rec.del || x.rec.hide) delete S.base[x.rec.id]; else { var o2 = S.base[x.rec.id]; if (!o2 || (x.rec.u || 0) >= (o2.u || 0)) S.base[x.rec.id] = x.rec; } }
        if (!x.ok) toast(x.msg || '動作失敗', 'bad');
        else if (x.already && x.already.at && x.already.by) {
          var sent0 = sent.filter(function (a) { return a.cid === x.cid; })[0];
          if (sent0 && sent0.on) toast('此項已由「' + x.already.by + '」於 ' + fmtT(x.already.at) + ' 完成', 'warn');
        }
      });
      S.pending = S.pending.filter(function (a) { return !done[a.cid]; });
    }
    S.ver = r.ver; S.epoch = r.epoch; S.have = true; S.lastOk = Date.now();
    setStatus(true); persist(); notify();
    if (S.pending.length) kick(200); else kick(nextDelay());
  }).catch(function (e) {
    busy = false; fails++; setStatus(false); kick(nextDelay());
  });
}
V.sync = function () { kick(0); };
V.forceResync = function () { forceNext = true; S.have = false; S.ver = 0; kick(0); };
document.addEventListener('visibilitychange', function () { if (!document.hidden && S.code) kick(100); });
window.addEventListener('online', function () { fails = 0; kick(200); });

function setStatus(ok) {
  S.online = ok;
  var el = document.getElementById('sync-dot');
  if (!el) return;
  var p = S.pending.length;
  el.className = 'sync ' + (!ok ? 'off' : p ? 'wait' : 'ok');
  el.title = !ok ? '離線中，動作已暫存，連線後自動送出' : p ? '傳送中…' : '已同步 ' + fmtTS(S.lastOk);
  var t = document.getElementById('sync-txt');
  if (t) t.textContent = !ok ? ('離線' + (p ? '・待送 ' + p : '')) : p ? ('傳送 ' + p) : '已同步';
}
subscribe(function () { setStatus(S.online); });

/* ---------- 共用 UI ---------- */
function toast(msg, kind) {
  var box = document.getElementById('toasts');
  if (!box) return;
  var d = document.createElement('div'); d.className = 'toast ' + (kind || ''); d.textContent = msg;
  box.appendChild(d); setTimeout(function () { d.classList.add('out'); setTimeout(function () { d.remove(); }, 400); }, kind === 'bad' ? 5000 : 3000);
}
function modal(html, opts) {
  opts = opts || {};
  var m = document.createElement('div'); m.className = 'modal' + (opts.cls ? ' ' + opts.cls : '');
  m.innerHTML = '<div class="modal-box">' + html + '</div>';
  document.body.appendChild(m);
  function close() { if (m.parentNode) m.remove(); if (opts.onClose) opts.onClose(); }
  m.addEventListener('click', function (e) { if (e.target === m && !opts.sticky) close(); var c = e.target.closest('[data-close]'); if (c) close(); });
  m.close = close;
  return m;
}
function confirmBox(msg, okLabel, danger) {
  return new Promise(function (res) {
    var m = modal('<div class="m-msg">' + msg + '</div><div class="m-btns"><button class="btn" data-no>取消</button><button class="btn ' + (danger ? 'danger' : 'primary') + '" data-yes>' + (okLabel || '確定') + '</button></div>', {sticky: true});
    m.querySelector('[data-no]').onclick = function () { m.close(); res(false); };
    m.querySelector('[data-yes]').onclick = function () { m.close(); res(true); };
  });
}
function askName(force) {
  return new Promise(function (res) {
    var m = modal('<h3>你的名字／代號</h3><p class="muted">會記錄在每一筆操作上（例如「小美」「接待2號」）。</p><input id="nm" class="inp big" maxlength="12" placeholder="請輸入" value="' + esc(S.staff) + '"><div class="m-btns">' + (force ? '' : '<button class="btn" data-close>取消</button>') + '<button class="btn primary" id="nmok">確定</button></div>', {sticky: force});
    var inp = m.querySelector('#nm'); if (!inp.value && V.defaultName) inp.value = V.defaultName(); inp.focus(); inp.select();
    function ok() { var v = inp.value.trim(); if (!v) { inp.focus(); return; } S.staff = v; lsSet(staffKey(), v); m.close(); updateHeader(); res(v); }
    m.querySelector('#nmok').onclick = ok; inp.onkeydown = function (e) { if (e.key === 'Enter') ok(); };
  });
}
V.toast = toast; V.modal = modal; V.confirm = confirmBox; V.askName = askName;

function setBig(on) { document.body.classList.toggle('lg', !!on); lsSet('vip.big', on ? '1' : '0'); }
if (lsGet('vip.big', '0') === '1') document.body.classList.add('lg');

/* ---------- 外框／路由 ---------- */
var views = V.views = {};   // role -> {mount(root), unmount()}
var curView = null, curUnsub = null;
function shell() {
  document.getElementById('app').innerHTML =
    '<header class="top"><div class="top-l">' + (BRAND.logoH ? '<img class="brand-logo" src="' + esc(BRAND.logoH) + '" alt="' + esc(BRAND.name + ' ' + BRAND.en) + '">' : '') + '<span class="role-badge" id="hd-role"></span><span class="ev-name" id="hd-ev"></span></div>' +
    '<div class="top-r"><span class="sync ok" id="sync-dot"></span><span id="sync-txt" class="sync-txt">已同步</span><button class="icon-btn" id="hd-menu" aria-label="選單">☰</button></div></header>' +
    (DEMO ? '<div class="demo-bar">🧪 預覽／示範模式：資料只存在這個瀏覽器，內容皆為虛構。多開幾個分頁＝模擬多台裝置。<a href="?" id="demo-home">回到示範入口</a></div>' : '') +
    '<main id="view"></main>' + brandFoot();
  document.getElementById('hd-menu').onclick = menu;
  updateHeader();
}
function updateHeader() {
  var r = document.getElementById('hd-role'); if (!r) return;
  var rr = ROLES[V.viewRole || S.role] || {};
  r.textContent = (rr.icon || '') + ' ' + (rr.name || '');
  var e = document.getElementById('hd-ev');
  e.textContent = S.ev ? S.ev.name : '';
}
V.updateHeader = updateHeader;
function menu() {
  var h = '<h3>' + esc(S.staff || '(未填名字)') + ' <span class="muted small">裝置 ' + esc(S.dev) + '</span></h3><div class="menu-list">';
  h += '<button class="btn" id="mn-name">✏️ 修改名字</button>';
  h += '<button class="btn" id="mn-big">🔠 大字模式：' + (document.body.classList.contains('lg') ? '開（點擊關閉）' : '關（點擊開啟）') + '</button>';
  h += '<button class="btn" id="mn-sync">🔄 立即重新同步 ' + (S.pending.length ? '（待送 ' + S.pending.length + '）' : '') + '</button>';
  if (S.role === 'admin') {
    h += '<div class="muted small" style="margin-top:8px">切換到各組畫面（管理員可代為操作）：</div><div class="chips">';
    ['admin', 'transport', 'checkin', 'reception', 'stage', 'director'].forEach(function (k) { h += '<button class="chip' + ((V.viewRole || S.role) === k ? ' on' : '') + '" data-view="' + k + '">' + ROLES[k].icon + ' ' + ROLES[k].name + '</button>'; });
    h += '</div>';
  }
  h += '<button class="btn danger" id="mn-out">登出</button></div><div class="m-btns"><button class="btn" data-close>關閉</button></div>';
  var m = modal(h);
  m.querySelector('#mn-name').onclick = function () { m.close(); askName(false); };
  m.querySelector('#mn-big').onclick = function () { setBig(!document.body.classList.contains('lg')); m.close(); };
  m.querySelector('#mn-sync').onclick = function () { m.close(); V.forceResync(); toast('重新同步中…'); };
  m.querySelector('#mn-out').onclick = function () { m.close(); V.logout(); };
  m.querySelectorAll('[data-view]').forEach(function (b) { b.onclick = function () { m.close(); showView(b.dataset.view); }; });
}
function showView(role) {
  if (curView && curView.unmount) curView.unmount();
  if (curUnsub) curUnsub();
  V.viewRole = role; updateHeader();
  var root = document.getElementById('view'); root.innerHTML = ''; root.className = 'v-' + role;
  curView = views[role];
  if (!curView) { root.innerHTML = '<p class="pad">此畫面尚未提供</p>'; return; }
  curView.mount(root);
  curUnsub = subscribe(function () { if (curView && curView.update) curView.update(); });
  if (curView.update) curView.update();
  if (location.hash !== '#' + role) history.replaceState(null, '', location.pathname + location.search + '#' + role);
}
V.showView = showView;

V.logout = function (msg) {
  lsDel('vip.code'); S.code = ''; S.role = ''; S.base = {}; S.pending = []; S.ev = null; S.have = false; S.ver = 0; S.epoch = 0; S.mv = 0;
  clearTimeout(timer); history.replaceState(null, '', location.pathname);
  qs = new URLSearchParams('');
  start(msg);
};

function loginScreen(msg) {
  var app = document.getElementById('app');
  var h = '<div class="login"><div class="login-card"><div class="login-brand">' + (BRAND.logoV ? '<img class="login-logo" src="' + esc(BRAND.logoV) + '" alt="' + esc(BRAND.name + ' ' + BRAND.en) + '">' : '') + '<div class="logo">' + esc(BRAND.appName) + '</div></div><p class="muted">請輸入組別存取碼（或點選工作人員傳給你的連結）</p>' +
    '<input id="lg-code" class="inp big" autocapitalize="characters" autocomplete="off" placeholder="存取碼" maxlength="40"><div id="lg-err" class="err">' + esc(msg || '') + '</div>' +
    '<button class="btn primary big" id="lg-go">進入</button></div>';
  if (DEMO) h += '<div class="login-card" id="demo-launch"><h3>🧪 示範入口</h3><p class="muted">這是預覽版，內含 400 位虛構貴賓。點下方進入各組畫面，也可以「開新分頁」同時開多個組別，看資料即時流動。</p><div id="demo-links" class="demo-links">載入中…</div><div class="demo-tools" id="demo-tools"></div></div>';
  h += brandFoot() + '</div>';
  app.innerHTML = h;
  var inp = document.getElementById('lg-code');
  function go() { var c = inp.value.trim(); if (c) enter(c); }
  document.getElementById('lg-go').onclick = go; inp.onkeydown = function (e) { if (e.key === 'Enter') go(); };
  if (DEMO) window.VIPDEMO.launcher(document.getElementById('demo-links'), document.getElementById('demo-tools'), enter);
}

function enter(code) {
  var err = document.getElementById('lg-err');
  if (err) err.textContent = '驗證中…';
  api({op: 'login', code: code, ev: lsGet('vip.adminEv', '')}).then(function (r) {
    if (!r.ok) { if (err) err.textContent = r.error === 'auth' ? '存取碼不正確' : (r.msg || r.error); return; }
    S.code = code; S.role = r.role; lsSet('vip.code', code);
    if (r.role === 'admin') {
      S.events = r.events || [];
      var want = lsGet('vip.adminEv', '');
      var ev = S.events.filter(function (e) { return e.id === want; })[0] || S.events.filter(function (e) { return e.status === 'active'; })[0] || S.events[0];
      S.evId = ev ? ev.id : ''; S.ev = ev || null;
      if (ev) lsSet('vip.adminEv', ev.id);
    } else { S.ev = r.event; S.evId = r.event.id; }
    restore();
    boot();
  }).catch(function () {
    // 離線：若有快取的資料仍可進入
    var raw = lsGet('vip.lastrole.' + code, '');
    if (raw) { S.code = code; S.role = raw; restore(); S.evId = S.ev ? S.ev.id : ''; boot(); setStatus(false); }
    else if (err) err.textContent = '連不上伺服器，請檢查網路';
  });
}
V.enter = enter;
V.switchEvent = function (id) {
  S.evId = id; lsSet('vip.adminEv', id);
  var ev = (S.events || []).filter(function (e) { return e.id === id; })[0]; S.ev = ev || null;
  S.base = {}; S.ver = 0; S.epoch = 0; S.mv = 0; S.have = false; S.pending = []; listCache = null;
  restore(); updateHeader(); notify(); kick(0);
};

function boot() {
  lsSet('vip.lastrole.' + S.code, S.role);
  S.staff = lsGet(staffKey(), '');
  try { var u = new URL(location.href); if (S.role === 'admin') u.searchParams.delete('c'); else u.searchParams.set('c', S.code); history.replaceState(null, '', u.pathname + u.search + u.hash); } catch (e) {}
  shell();
  var go = function () {
    var want = (location.hash || '').slice(1), role = S.role;
    if (S.role === 'admin' && ROLES[want]) role = want;
    showView(role); kick(0);
  };
  if (!S.staff) askName(true).then(go); else go();
}

function start(msg) {
  var c = qs.get('c') || lsGet('vip.code', '');
  if (c && !msg) enter(c); else loginScreen(msg);
}
V.start = start;
V.setStatus = setStatus;
window.addEventListener('DOMContentLoaded', function () {
  if (DEMO) window.VIPDEMO.init().then(function () { start(); }); else start();
});
V.afterDemoReady = function () { start(); };
})();
