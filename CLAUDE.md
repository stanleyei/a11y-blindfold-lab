# CLAUDE.md

此文件提供 Claude Code 在此儲存庫工作時的指引。

## 語言設定

請所有回覆均使用「繁體中文」回答，避免簡體字與中國特有用語，用詞精確且適合台灣地區開發者閱讀。

## 圖片與圖示

圖示以 `<img src="./images/icon/...svg">` 引用。為了在 CSS 未生效（快取拿到舊檔、in-app 瀏覽器擋 CSS）時圖示不會撐爆版面：

- **SVG 圖示必須有可辨識的內在尺寸與長寬比**。新增或修改 `images/icon/*.svg` 時，外層 `<svg>` 應使用與 `viewBox` 對應的數值 `width` / `height`，例如 `<svg width="24" height="24" viewBox="0 0 24 24">`，不要使用 `width="100%" height="100%"`。`viewBox` 可提供內在長寬比，但百分比型的 `width` / `height` 不會提供固定的內在寬高。
- **icon 預設不要使用 `preserveAspectRatio="none"`**。這個屬性不是尺寸設定，而是讓 `viewBox` 內容以不同的 X、Y 縮放比例填滿 viewport；外層 `<img>` 與 `viewBox` 長寬比不同時會造成圖示變形。只有刻意需要滿版拉伸的裝飾性 SVG（wave、mask、線條與分隔線）才保留。
- **HTML 中的 `<img>` 一律補上 `width` / `height` 屬性**，包含 `js/` 動態產生的 `<img>`；數值對應設計上的預設顯示尺寸與長寬比（即該元素的 `size-*` utility）。這可先確定外層圖片盒尺寸、降低 CLS，並作為 CSS 失效時的安全底線，但不會覆寫 SVG 內部的 `preserveAspectRatio`。

## Subagent 使用規範

- 涉及同一檔案的修改**禁止**分派到不同 subagent，應合併為同一任務
- Subagent 的 prompt 需自帶完整任務描述與檔案路徑，它看不到主對話內容
- **Subagent 禁止對外發布**：不得執行 `gh pr comment`、`gh issue comment`、`git push` 等對外操作，一律回傳主對話統一處理；派發時須在 prompt 中明確指示此限制

## PR Review 發布

**發布前必須先在對話中展示完整審查結果，經使用者確認後才可發布**，且只發布一則彙整後的 comment。詳細流程請載入 `/pr-review-publish` skill。

## Git Commit 規範

- 採用 Conventional Commits 格式，type 與 scope 用英文（`fix:`、`feat(api):`）
- subject 與 body 使用繁體中文，避免簡體字與中國特有用語
- 不要加 `Co-Authored-By` 行
