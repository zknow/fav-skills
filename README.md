# My Favorite Skills Repositories

這份文件用於記錄與整理我喜歡的Skills Repositories，方便日後查閱與擴充。

技能清單整理於獨立的紀錄檔中，請參閱：[favorite_skills.md](./favorite_skills.md)。

---

## 技能快速安裝工具 (TUI)

為了方便您將 [favorite_skills.md](./favorite_skills.md) 中喜愛的技能安裝到特定的 AI Agent 目錄下，專案中附帶了一個**除 Node.js 執行環境外，無須安裝任何額外第三方套件依賴**的互動式終端小工具 [install-skills.js](./install-skills.js)。

### 使用方法

#### 1. 本地執行方法

在終端機進入此專案目錄後，可選擇直接安裝於本目錄，或傳入其他目標工作區目錄作為參數：

```bash
# 預設安裝至目前專案目錄下
node install-skills.js

# 或者，安裝到指定的工作區目錄
node install-skills.js "D:\my-other-project"
```

#### 2. 跨專案執行方法 (最推薦)

您可以在**任何終端機環境**直接執行以下指令，無須複製本專案的程式碼：

```bash
# 預設安裝至目前目錄下
npx github:zknow/fav-skills

# 或者，安裝到指定的工作區目錄
npx github:zknow/fav-skills "D:\my-other-project"
```

> **提示**：`npx` 會自動下載您的喜愛清單與指令，並在您指定的目標路徑（或目前工作目錄）下進行安裝。

### TUI 操作說明

- **↑ / ↓**：上下移動游標。
- **[空白鍵 (Space)]**：勾選或取消勾選要安裝的技能（在技能選擇選單中適用）。
- **[Enter]**：確認選擇並進行下一步。
- **[Esc] / Ctrl+C**：取消並結束。

### 步驟流程

- **步驟一 (選擇技能)**：多選您要下載的技能（支援最上方的「全選/取消全選」）。
- **步驟二 (安裝範圍)**：
  - `專案目錄 (Project Scope)`：將技能安裝至您目前專案的相對應目錄下。
  - `使用者全域目錄 (Global Scope)`：將技能安裝至系統的使用者家目錄（Home Directory）下。
- **步驟三 (目標工具)**：選擇您要安裝給哪一個 AI 工具（支援 `Claude Code`, `GitHub Copilot`, `Google Antigravity`, `Cursor`, `OpenCode`, `OpenAI Codex`, `Gemini CLI`, `Windsurf`，程式會自動尋找對應的目錄名）。
- **步驟四 (自動下載)**：程式將自動解析清單，建立目錄，並下載所有檔案。

---

## 清單維護與更新指南 (給 AI Agent 的編輯規範)

本專案將由各式 AI Agent 協作進行維護。當您（AI Agent）受命要新增、修改或調整技能清單時，請遵守以下格式與規則：

### 1. 檔案格式限制

- 所有的喜愛技能清單必須記錄於 [favorite_skills.json](./favorite_skills.json) 中。
- 請勿手動修改 [favorite_skills.md](./favorite_skills.md)，因為它會在每次執行安裝指令時由程式自動讀取 JSON 重新同步生成。

### 2. JSON 格式定義與規則

JSON 必須為一個物件陣列，每個物件代表一個技能庫：

- **category**: 技能庫分類（例如 `"Productivity"`、`"UI/UX"`、`"Coding"`）。
- **repoName**: 技能庫名稱（例如 `"Matt Pocock Skills"`）。
- **repoUrl**: 技能庫 GitHub 網址（例如 `"https://github.com/mattpocock/skills"`）。
- **skills**: 該倉庫中喜愛技能的清單，為一個物件陣列：
  - **name**: 技能名稱（例如 `"grill-me"`）。
  - **url**: 技能的 GitHub 目錄或檔案之精確連結（例如 `"https://github.com/mattpocock/skills/tree/main/skills/productivity/grill-me"`）。
- **summary**: 簡短的特色與功能總結。
