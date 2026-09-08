# 閉眼上網：無障礙體驗工作坊（a11y-blindfold-lab）

給職訓網頁班的體驗式教案：學生閉上眼睛、只用鍵盤與耳朵，先在一個做好無障礙的購物網站完成任務，再到一個「看起來很正常」但沒做無障礙的網站做同樣的事，親身感受差別。

純靜態 HTML + Tailwind CSS（CDN），不需要安裝任何東西，可直接部署到 GitHub Pages。

## 結構

```
index.html              首頁：語音檢測、流程說明
lesson/01-keyboard.html 教學一：鍵盤操作（睜眼）
lesson/02-reader.html   教學二：聽懂報讀在唸什麼（睜眼）
lab/good/               小舖 A：無障礙版（首頁、搜尋結果、結帳）
lab/bad/                小舖 B：一般版，刻意埋入八個常見問題
reveal.html             揭曉：兩版時間與按鍵數對照、八個問題逐條說明
teacher.html            教師手冊：課程節奏、討論題、快速鍵
assets/js/sr-sim.js     報讀模擬器（Web Speech API）
assets/js/shop.js       商品資料與購物車（localStorage）
assets/js/tasks.js      任務判定、計時、按鍵統計
```

## 報讀模擬器

`sr-sim.js` 以瀏覽器內建語音合成模擬螢幕報讀軟體的核心行為：

- 焦點朗讀：名稱、角色、狀態、值（名稱計算依循 W3C Accessible Name 演算法的主要規則）
- 瀏覽模式：↑↓ 逐段、H 標題、K 連結、B 按鈕、F 表單欄位、G 圖形、1～6 指定層級標題、Enter 啟動
- aria-live 動態訊息、打字回音、對話方塊與地標進入提示
- 字幕列（給觀察者看）、黑幕模式、語音與語速設定

它不是 NVDA，功能簡化很多，但對「名稱／角色／狀態」的判斷方式與真實報讀軟體一致，因此小舖 B 的問題是真實的，不是模擬器刁難。

## 部署到 GitHub Pages

1. 推到 GitHub 倉庫
2. Settings → Pages → Source 選 `main` 分支根目錄
3. 所有連結皆為相對路徑，放在子路徑下也能運作

## 瀏覽器與語音

- Windows：建議 Edge（內建線上中文語音）。Chrome 需系統已安裝「中文（台灣）」語音。
- macOS：系統設定 → 輔助使用 → 朗讀內容 → 系統語音，下載中文（台灣）。
- 語音被瀏覽器的自動播放政策擋住時，頁面上方會出現提示，按任意鍵即解鎖。

## 授權

教學用途自由使用與修改。
