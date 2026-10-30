/* Apps Script 模擬層：讓 Code.gs 可在 Node（測試）或瀏覽器（示範模式）中執行。UMD。 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GasMock = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  function colOf(a1) { return a1; }
  function create(opts) {
    // opts: {source, store:{get():string|null,set(str)}, adminCode?, now?:fn, onLock?}
    var world = null, dirty = false;
    var nowFn = opts.now || function () { return Date.now(); };
    function load() {
      var raw = opts.store ? opts.store.get() : null;
      world = raw ? JSON.parse(raw) : {sheets: {}, order: [], cache: {}, props: {}};
      dirty = false;
    }
    function save() { if (dirty && opts.store) opts.store.set(JSON.stringify(world)); dirty = false; }
    function lastRowOf(sh) {
      for (var i = sh.rows.length - 1; i >= 0; i--) {
        var r = sh.rows[i];
        if (r) for (var j = 0; j < r.length; j++) if (r[j] !== '' && r[j] !== null && r[j] !== undefined) return i + 1;
      }
      return 0;
    }
    // 工作表欄數：新工作表預設 26 欄（與 Google 試算表相同）；寫入會自動擴張，但「讀取」超出欄數會丟錯（模擬真實行為）
    function maxColsOf(sh) {
      if (!sh.maxCols) { var m = 26; sh.rows.forEach(function (r) { if (r && r.length > m) m = r.length; }); sh.maxCols = m; }
      return sh.maxCols;
    }
    function Range(sh, r, c, nr, nc) {
      this.sh = sh; this.r = r; this.c = c; this.nr = nr; this.nc = nc;
    }
    Range.prototype.getValues = function () {
      var out = [], sh = this.sh;
      if (this.c - 1 + this.nc > maxColsOf(sh)) throw new Error('The coordinates or dimensions of the range are invalid（讀取超出工作表欄數 ' + maxColsOf(sh) + '）');
      for (var i = 0; i < this.nr; i++) {
        var row = sh.rows[this.r - 1 + i] || [], o = [];
        for (var j = 0; j < this.nc; j++) {
          var v = row[this.c - 1 + j];
          o.push(v === undefined || v === null ? '' : v);
        }
        out.push(o);
      }
      return out;
    };
    Range.prototype.getValue = function () { return this.getValues()[0][0]; };
    Range.prototype.setValues = function (vals) {
      if (vals.length !== this.nr || (vals[0] && vals[0].length !== this.nc)) throw new Error('setValues 大小不符 ' + vals.length + 'x' + (vals[0] && vals[0].length) + ' vs ' + this.nr + 'x' + this.nc);
      var sh = this.sh;
      if (this.c - 1 + this.nc > maxColsOf(sh)) sh.maxCols = this.c - 1 + this.nc;
      for (var i = 0; i < this.nr; i++) {
        var ri = this.r - 1 + i;
        while (sh.rows.length <= ri) sh.rows.push([]);
        var row = sh.rows[ri];
        for (var j = 0; j < this.nc; j++) {
          var ci = this.c - 1 + j, v = vals[i][j];
          if (v === undefined || v === null) v = '';
          if (typeof v === 'string' && v.length > 50000) throw new Error('儲存格超過 50000 字元');
          var tf = sh.text[ci];
          if (tf && ri + 1 >= tf[0] && ri + 1 <= tf[1] && v !== '') v = (typeof v === 'number') ? v : String(v);
          while (row.length <= ci) row.push('');
          row[ci] = v;
        }
      }
      dirty = true; return this;
    };
    Range.prototype.setValue = function (v) { var a = []; for (var i = 0; i < this.nr; i++) { a.push([]); for (var j = 0; j < this.nc; j++) a[i].push(v); } return this.setValues(a); };
    Range.prototype.clearContent = function () {
      var sh = this.sh;
      for (var i = 0; i < this.nr; i++) { var row = sh.rows[this.r - 1 + i]; if (row) for (var j = 0; j < this.nc; j++) row[this.c - 1 + j] = ''; }
      dirty = true; return this;
    };
    Range.prototype.setNumberFormat = function (f) {
      if (f === '@') this.sh.text[this.c - 1 + 0] = [this.r, this.r + this.nr - 1];
      if (f === '@') for (var j = 0; j < this.nc; j++) this.sh.text[this.c - 1 + j] = [this.r, this.r + this.nr - 1];
      dirty = true; return this;
    };
    Range.prototype.setFontWeight = function () { return this; };
    Range.prototype.setBackground = function () { return this; };

    function Sheet(name) { this.name = name; }
    Object.defineProperty(Sheet.prototype, 'sh', {get: function () { return world.sheets[this.name]; }});
    Sheet.prototype.getName = function () { return this.name; };
    Sheet.prototype.getLastRow = function () { return lastRowOf(this.sh); };
    Sheet.prototype.getRange = function (r, c, nr, nc) { return new Range(this.sh, r, c, nr || 1, nc || 1); };
    Sheet.prototype.getMaxColumns = function () { return maxColsOf(this.sh); };
    Sheet.prototype.insertColumnsAfter = function (pos, n) { var sh = this.sh; maxColsOf(sh); sh.maxCols += n; dirty = true; };
    Sheet.prototype.setFrozenRows = function () { return this; };
    Sheet.prototype.appendRow = function (arr) { this.getRange(this.getLastRow() + 1, 1, 1, arr.length).setValues([arr]); };
    var ssObj = {
      getSheetByName: function (n) { return world.sheets[n] ? new Sheet(n) : null; },
      insertSheet: function (n) { if (world.sheets[n]) throw new Error('工作表已存在'); world.sheets[n] = {rows: [], text: {}, maxCols: 26}; world.order.push(n); dirty = true; return new Sheet(n); },
      getSheets: function () { return world.order.map(function (n) { return new Sheet(n); }); }
    };
    var SpreadsheetApp = {getActiveSpreadsheet: function () { return ssObj; }};

    var lockHeld = false;
    var LockService = {getScriptLock: function () {
      return {
        waitLock: function () { if (lockHeld) throw new Error('lock busy'); lockHeld = true; },
        releaseLock: function () { lockHeld = false; },
        hasLock: function () { return lockHeld; }
      };
    }};
    function cacheGet(k) {
      var e = world.cache[k];
      if (!e) return null;
      if (e.exp < nowFn()) { delete world.cache[k]; return null; }
      return e.v;
    }
    var CacheService = {getScriptCache: function () {
      return {
        get: cacheGet,
        getAll: function (ks) { var o = {}; ks.forEach(function (k) { var v = cacheGet(k); if (v !== null) o[k] = v; }); return o; },
        put: function (k, v, ttl) {
          if (String(v).length > 100 * 1024) throw new Error('快取值超過 100KB: ' + k);
          if (k.length > 250) throw new Error('key 太長');
          world.cache[k] = {v: String(v), exp: nowFn() + (ttl || 600) * 1000}; dirty = true;
        },
        putAll: function (o, ttl) { for (var k in o) this.put(k, o[k], ttl); },
        remove: function (k) { delete world.cache[k]; dirty = true; }
      };
    }};
    var PropertiesService = {getScriptProperties: function () {
      return {getProperty: function (k) { world.propReads = (world.propReads || 0) + 1; return k === 'ADMIN_CODE' && opts.adminCode ? opts.adminCode : (world.props[k] || null); },
        setProperty: function (k, v) { world.props[k] = v; dirty = true; }};
    }};
    var ContentService = {
      MimeType: {JSON: 'application/json'},
      createTextOutput: function (t) { return {text: t, setMimeType: function () { return this; }, getContent: function () { return this.text; }}; }
    };
    var Utilities = {
      sleep: function () {},
      formatDate: function (d, tz, f) {
        var p = new Intl.DateTimeFormat('en-GB', {timeZone: tz, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit'}).formatToParts(d), m = {};
        p.forEach(function (x) { m[x.type] = x.value; });
        if (m.hour === '24') m.hour = '00';
        return f.replace('yyyy', m.year).replace('MM', m.month).replace('dd', m.day).replace('HH', m.hour).replace('mm', m.minute).replace('ss', m.second);
      }
    };
    var Logger = {log: function () {}};
    var DateShim = Date;
    var fn = new Function('SpreadsheetApp', 'LockService', 'CacheService', 'PropertiesService', 'ContentService', 'Utilities', 'Logger',
      opts.source + '\n;return {doPost:doPost,doGet:doGet,setup:setup};');
    var api = fn(SpreadsheetApp, LockService, CacheService, PropertiesService, ContentService, Utilities, Logger);
    return {
      handle: function (bodyString) {
        load();
        try {
          var out = api.doPost({postData: {contents: bodyString}});
          return out.getContent();
        } finally { lockHeld = false; save(); }
      },
      get: function () { load(); try { return api.doGet({}).getContent(); } finally { save(); } },
      world: function () { load(); return world; },
      reset: function () { world = {sheets: {}, order: [], cache: {}, props: {}}; dirty = true; save(); },
      evictCache: function () { load(); world.cache = {}; dirty = true; save(); }
    };
  }
  return {create: create};
});
