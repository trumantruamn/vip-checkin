/* ★ 部署時只需要改下面 API_URL 這一行 ★
   把 Apps Script「網頁應用程式」的網址（以 https://script.google.com/macros/s/ 開頭、/exec 結尾）貼在 API_URL 的引號中間。
   留空 = 「預覽／示範模式」：用假資料試玩，資料只存在這個瀏覽器，不會連到 Google。
   注意：這個檔案會公開在 GitHub 上，所以「管理密碼」絕對不要寫在這裡（管理密碼只放在 Apps Script 的「指令碼屬性」）。 */
window.VIP_CONFIG = {
  API_URL: 'https://script.google.com/macros/s/AKfycbxSw4679KJ9aEt0vUT7kfShy6Ty5cwzB5X-gGfKIL4R2TYaWF8dDF_EUVxTi8DnMWnUcw/exec',
  POLL_MS: 3500,

  /* 品牌設定：換活動／換公司時只改這裡（圖檔放在 img/ 資料夾）。 */
  BRAND: {
    name: '三恆一樹',                    // 公司名稱（頁尾、登入頁）
    en: 'TREE OF ETERNITY',             // 英文名稱
    appName: '貴賓報到系統',             // 系統名稱（網頁標題、登入頁）
    logoH: 'img/logo-h.png',            // 橫式 logo（每個畫面上方）
    logoV: 'img/logo-v.png',            // 直式 logo（登入頁）
    favicon: 'img/favicon.png',         // 網頁小圖示
    themeColor: '#78BFBB',              // 手機瀏覽器網址列顏色
    eventName: ''                       // 登入頁要顯示的活動全名（可留空；工作人員登入過一次後，登入頁會自動記住）
  }
};
