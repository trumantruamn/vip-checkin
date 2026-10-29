/* 活動總召：唯讀即時儀表板 */
(function () {
'use strict';
var V = window.VIP, S = V.S, U = V.u, esc = U.esc, T = U.fmtT;
function $(s, r) { return (r || document).querySelector(s); }
var root, q = '', nCat = '';
var BUCKET = 10 * 60000;

function pct(a, b) { return b ? Math.round(a * 100 / b) : 0; }
function bar(a, b, cls) { var p = Math.min(100, pct(a, b)); return '<div class="pbar ' + (cls || '') + '"><i style="width:' + p + '%"></i></div>'; }

function compute() {
  var all = V.list(), exp = all.filter(U.isExpected), c = {};
  c.all = all; c.exp = exp.length;
  c.trNeed = exp.filter(U.isTr).length;
  c.onway = all.filter(function (r) { return r.pk && !r.dl && !r.ci; }).length;
  c.pk = all.filter(function (r) { return r.pk; }).length;
  c.dl = all.filter(function (r) { return r.dl; }).length;
  c.ci = all.filter(function (r) { return r.ci; }).length;
  c.se = all.filter(function (r) { return r.se; }).length;
  c.an = all.filter(function (r) { return r.an; }).length;
  c.walk = all.filter(function (r) { return r.walk; }).length;
  c.absent = exp.filter(function (r) { return !r.ci; });
  c.waitSeat = all.filter(function (r) { return r.ci && !r.se; }).length;
  c.trTotal = all.filter(U.isTr).length;
  return c;
}
function tile(label, n, of, cls, sub) {
  return '<div class="kpi ' + (cls || '') + '"><div class="k-l">' + label + '</div><div class="k-n">' + n + '</div>' + (of != null ? '<div class="k-p">' + pct(n, of) + '%</div>' + bar(n, of, cls) : '') + (sub ? '<div class="k-s">' + sub + '</div>' : '') + '</div>';
}
function trend(c) {
  var ts = c.all.filter(function (r) { return r.ci; }).map(function (r) { return r.ci; });
  if (!ts.length) return '<div class="empty">尚無人報到</div>';
  var min = Math.floor(Math.min.apply(null, ts) / BUCKET) * BUCKET, max = Math.max(Math.ceil(Date.now() / BUCKET) * BUCKET, Math.max.apply(null, ts) + BUCKET);
  var n = Math.round((max - min) / BUCKET); if (n > 36) { min = max - 36 * BUCKET; n = 36; }
  var b = []; for (var i = 0; i < n; i++) b.push(0);
  ts.forEach(function (t) { var k = Math.floor((t - min) / BUCKET); if (k >= 0 && k < n) b[k]++; });
  var cum = [], s = ts.filter(function (t) { return t < min; }).length;
  b.forEach(function (x) { s += x; cum.push(s); });
  var mx = Math.max.apply(null, b.concat([1])), W = 600, H = 150, bw = W / n, h = '<svg viewBox="0 0 ' + W + ' ' + (H + 26) + '" class="chart" preserveAspectRatio="none">';
  b.forEach(function (x, i) { var bh = Math.round(x / mx * (H - 14)); h += '<rect x="' + (i * bw + 1) + '" y="' + (H - bh) + '" width="' + (bw - 2) + '" height="' + bh + '" rx="2" class="cbar"/>'; if (x) h += '<text x="' + (i * bw + bw / 2) + '" y="' + (H - bh - 3) + '" class="clbl">' + x + '</text>'; });
  var tot = Math.max(cum[cum.length - 1], 1), pts = cum.map(function (v, i) { return (i * bw + bw / 2) + ',' + (H - Math.round(v / tot * (H - 14))); }).join(' ');
  h += '<polyline points="' + pts + '" class="cline"/>';
  var step = Math.max(1, Math.ceil(n / 8));
  for (var j = 0; j < n; j += step) h += '<text x="' + (j * bw + bw / 2) + '" y="' + (H + 16) + '" class="cax">' + T(min + j * BUCKET) + '</text>';
  return h + '</svg><div class="legend"><span><i class="lg1"></i>每10分鐘報到人數</span><span><i class="lg2"></i>累計（共 ' + tot + ' 人）</span></div>';
}
function catTable(c) {
  var rows = {}, order = (S.ev && S.ev.cats) || [];
  c.all.forEach(function (r) {
    var k = r.cat || '（未分類）'; var x = rows[k] || (rows[k] = {exp: 0, ci: 0, se: 0, an: 0});
    if (U.isExpected(r)) x.exp++; if (r.ci) x.ci++; if (r.se) x.se++; if (r.an) x.an++;
  });
  var keys = Object.keys(rows).sort(function (a, b) { var ia = order.indexOf(a), ib = order.indexOf(b); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib); });
  var h = '<table class="tbl"><tr><th>類別</th><th>預計</th><th>已報到</th><th>已入座</th><th>已唱名</th><th>未到</th></tr>';
  keys.forEach(function (k) { var x = rows[k]; h += '<tr><td>' + esc(k) + '</td><td>' + x.exp + '</td><td>' + x.ci + '<div class="mini">' + bar(x.ci, x.exp) + '</div></td><td>' + x.se + '</td><td>' + x.an + '</td><td class="' + (x.exp - x.ci > 0 ? 'late' : '') + '">' + Math.max(0, x.exp - x.ci) + '</td></tr>'; });
  return h + '</table>';
}
function tableGrid(c) {
  var t = {};
  c.all.forEach(function (r) { var k = r.tbl || ''; if (!k) return; var x = t[k] || (t[k] = {n: 0, ci: 0, se: 0}); x.n++; if (r.ci) x.ci++; if (r.se) x.se++; });
  var keys = Object.keys(t).sort(function (a, b) { return U.tblNum(a) - U.tblNum(b) || a.localeCompare(b); });
  if (!keys.length) return '<div class="empty">尚未排桌次</div>';
  var h = '<div class="tgrid">';
  keys.forEach(function (k) {
    var x = t[k], full = x.se >= x.n && x.n > 0, started = x.ci > 0;
    h += '<div class="tt' + (full ? ' full' : started ? ' part' : '') + '"><div class="tt-n">' + esc(U.tblLabel(k)) + '</div><div class="tt-v"><b>' + x.se + '</b>/' + x.n + '</div><div class="tt-s">到 ' + x.ci + '</div><div class="tt-bar"><i class="a" style="width:' + pct(x.ci, x.n) + '%"></i><i class="b" style="width:' + pct(x.se, x.n) + '%"></i></div></div>';
  });
  var un = c.all.filter(function (r) { return !r.tbl; }).length;
  return h + '</div>' + (un ? '<div class="muted small">另有 ' + un + ' 位尚未排桌次</div>' : '');
}
function absentList(c) {
  var arr = c.absent.filter(function (r) { return (!nCat || r.cat === nCat) && U.matches(r, q); }).sort(function (a, b) { return (a.seq || 99999) - (b.seq || 99999); });
  var h = '<div class="muted small">未到 ' + c.absent.length + ' 位' + (arr.length !== c.absent.length ? '，符合 ' + arr.length + ' 位' : '') + '</div><div class="alist">';
  arr.slice(0, 80).forEach(function (r) {
    var s = r.dl ? '<span class="tag hot">已到門口</span>' : r.pk ? '<span class="tag hot2">接送中</span>' : U.isTr(r) ? '<span class="tag">待接送</span>' : '';
    h += '<div class="ar"><span class="seq">' + (r.seq || '') + '</span><div class="ar-m"><b>' + esc(r.name) + '</b> <span class="muted">' + esc(U.addrName(r)) + '</span></div>' + s + (r.rsvp && r.rsvp !== '回覆出席' ? '<span class="tag warn">' + esc(r.rsvp) + '</span>' : '') + '</div>';
  });
  if (arr.length > 80) h += '<div class="more-note">還有 ' + (arr.length - 80) + ' 位，請用搜尋縮小</div>';
  return h + '</div>';
}
function feed(c) {
  var ev = [], lab = {pk: '接到', dl: '送達門口', ci: '報到', cl: '認領帶位', se: '入座', an: '唱名'};
  c.all.forEach(function (r) { ['pk', 'dl', 'ci', 'cl', 'se', 'an'].forEach(function (s) { if (r[s]) ev.push({t: r[s], s: s, who: r[s + 'By'], n: r.name, tb: r.tbl}); }); });
  ev.sort(function (a, b) { return b.t - a.t; });
  var h = '<div class="feed">';
  ev.slice(0, 40).forEach(function (e) { h += '<div class="fe"><span class="ft">' + T(e.t) + '</span><span class="tag s-' + e.s + '">' + V.ROLES[V.STAGES[e.s].role].name + '</span> <b>' + esc(e.who || '?') + '</b> ' + lab[e.s] + ' <b>' + esc(e.n) + '</b>' + (e.s === 'ci' && e.tb ? ' → ' + esc(U.tblLabel(e.tb)) : '') + '</div>'; });
  return h + (ev.length ? '' : '<div class="empty">尚無動態</div>') + '</div>';
}
function staffTable(c) {
  var roles = {transport: {}, checkin: {}, reception: {}, stage: {}};
  c.all.forEach(function (r) {
    ['pk', 'dl', 'ci', 'cl', 'se', 'an'].forEach(function (s) {
      if (!r[s]) return; var role = V.STAGES[s].role, who = r[s + 'By'] || '?', x = roles[role][who] || (roles[role][who] = {n: 0, last: 0});
      x.n++; if (r[s] > x.last) x.last = r[s];
    });
  });
  var h = '<table class="tbl"><tr><th>組別</th><th>人員</th><th>處理筆數</th><th>最後動作</th></tr>';
  ['transport', 'checkin', 'reception', 'stage'].forEach(function (role) {
    var ks = Object.keys(roles[role]).sort(function (a, b) { return roles[role][b].last - roles[role][a].last; });
    if (!ks.length) h += '<tr><td>' + V.ROLES[role].icon + ' ' + V.ROLES[role].name + '</td><td colspan="3" class="muted">尚無動作</td></tr>';
    ks.forEach(function (k, i) { var x = roles[role][k]; var idle = Date.now() - x.last; h += '<tr><td>' + (i ? '' : V.ROLES[role].icon + ' ' + V.ROLES[role].name) + '</td><td>' + esc(k) + '</td><td>' + x.n + '</td><td class="' + (idle < 300000 ? 'okc' : '') + '">' + T(x.last) + '・' + U.ago(x.last) + '</td></tr>'; });
  });
  return h + '</table>';
}

V.views.director = {
  mount: function (r) {
    root = r;
    r.innerHTML = '<div class="dash"><div id="kpis" class="kpis"></div>' +
      '<section class="pnl"><h3>📈 報到趨勢</h3><div id="trend"></div></section>' +
      '<section class="pnl"><h3>🗂 各類別進度</h3><div id="cats"></div></section>' +
      '<section class="pnl wide"><h3>🪑 各桌狀況 <span class="muted small">（入座／應到，下方淺色條＝已報到）</span></h3><div id="tables"></div></section>' +
      '<section class="pnl"><h3>🕒 最新動態</h3><div id="feed"></div></section>' +
      '<section class="pnl"><h3>👥 各組人員活動</h3><div id="staff"></div></section>' +
      '<section class="pnl wide"><h3>⏳ 尚未抵達名單</h3><div class="bar"><input id="aq" class="inp search" placeholder="搜尋未到貴賓"><select id="acat" class="inp sm"></select></div><div id="absent"></div></section></div>';
    $('#aq', r).oninput = function (e) { q = e.target.value; V.views.director.update(); };
    $('#acat', r).onchange = function (e) { nCat = e.target.value; V.views.director.update(); };
    this.timer = setInterval(function () { V.views.director.update(); }, 20000);
  },
  unmount: function () { clearInterval(this.timer); },
  update: function () {
    if (!root) return;
    var c = compute();
    $('#kpis', root).innerHTML =
      tile('預計出席', c.exp, null, 'k0', (c.trNeed ? '需接送 ' + c.trNeed + ' 人' : '') + (c.walk ? '・現場新增 ' + c.walk : '')) +
      tile('接送中', c.onway, c.trTotal || null, 'k1', '已接到未送達') +
      tile('已送達門口', c.dl, c.trTotal || null, 'k2', '佔需接送人數') +
      tile('已報到', c.ci, c.exp, 'k3', '含現場新增') +
      tile('已入座', c.se, c.exp, 'k4', c.waitSeat ? '等待帶位 ' + c.waitSeat : '') +
      tile('已唱名', c.an, c.exp, 'k5', '') +
      tile('未到', c.absent.length, c.exp, 'k6', '預計出席尚未報到');
    $('#trend', root).innerHTML = trend(c);
    $('#cats', root).innerHTML = catTable(c);
    $('#tables', root).innerHTML = tableGrid(c);
    $('#feed', root).innerHTML = feed(c);
    $('#staff', root).innerHTML = staffTable(c);
    var ac = $('#acat', root); if (ac.options.length - 1 !== ((S.ev && S.ev.cats) || []).length) ac.innerHTML = V.catOptions(nCat, true);
    $('#absent', root).innerHTML = absentList(c);
  }
};
})();
