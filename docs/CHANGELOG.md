# Changelog

## [2.0.0] - 2026-02-21

### 重大變更: Google Sheets 遷移

#### 新增
- **Google Sheets 主資料源**: 取代 JSON + R2 作為結構化資料儲存
- **智慧驗證功能**:
  - Email DNS 驗證 (`verifyEmailDNSAction`)
  - Importance Score 計算 (`calculateImportanceAction`)
  - Staleness Detection + Web Search (`verifyStalenessAction`)
  - 批次驗證 (`batchVerifyAction`)
- **UI 增強**:
  - ContactCard: 驗證狀態色點、Email DNS 圖示、Importance Score 徽章
  - EditContactModal: Verify/Check DNS/Recalculate 按鈕面板
  - SearchableContactGrid: 按重要度排序、過期篩選、批次驗證按鈕
- **新模組**:
  - `lib/sheets.js` — Google Sheets API CRUD + 30s 記憶體快取
  - `lib/r2.js` — R2 圖片操作（從 storage.js 提取）
  - `lib/markdown.js` — Markdown 生成（從 storage.js 提取）
- **CLI 腳本更新**: 所有腳本改為讀寫 Google Sheets
- **新腳本**:
  - `migrate-to-sheets.js` — 一次性遷移
  - `verify-all.js` — 批次驗證 CLI
  - `lib/sheets-client.js` — CLI 共用 Sheets 認證
- **文件**:
  - `docs/GOOGLE_SHEETS_SETUP.md` — GCP 設定教學
  - `docs/ARCHITECTURE.md` — 系統架構圖

#### 變更
- `lib/storage.js`: 351 行 → 15 行 facade（re-export from sheets/r2/markdown）
- `package.json`: 新增 `googleapis` 依賴、`migrate-sheets` 和 `verify` 腳本
- Contact 資料結構新增欄位: `importanceScore`, `lastVerifiedAt`, `verificationStatus`, `emailValid`

#### 保留不變
- `lib/auth.js` — JWT 認證
- `middleware.js` — 路由保護
- `app/api/parse-card/` — OCR 解析
- `app/api/images/` — R2 圖片代理
- R2 圖片儲存 — 名片照片仍存 R2

#### 架構變更
```
Before: Local JSON + Cloudflare R2 (JSON + Images) + Markdown
After:  Google Sheets (Data) + Cloudflare R2 (Images only) + Markdown
```
