# Google Sheets 設定指南

## 前置條件

- Google 帳號 (已使用: `zonesoundcreative@gmail.com`)
- Google Cloud Platform 存取權限

## 步驟 1: 建立 GCP 專案

1. 前往 https://console.cloud.google.com
2. 建立新專案，名稱: `namecard-crm`
3. 選擇該專案

## 步驟 2: 啟用 Google Sheets API

1. 左側選單 → APIs & Services → Library
2. 搜尋 "Google Sheets API"
3. 點擊 Enable

## 步驟 3: 建立 Service Account

1. 左側選單 → IAM & Admin → Service Accounts
2. 點擊 "Create Service Account"
3. 名稱: `namecard-sheets-access`
4. 不需要額外角色（Role），直接完成
5. 點擊剛建立的 Service Account
6. 上方 Keys 分頁 → Add Key → Create new key → JSON
7. 下載 JSON key 檔案

## 步驟 4: 設定環境變數

從下載的 JSON key 中取出 `client_email` 和 `private_key`，加入 `.env.local`:

```env
GOOGLE_SPREADSHEET_ID=1Z84xETSl4wJQDdi6AcbrJZpHY1dD6c-hJmFvAhGNHGg
GOOGLE_SERVICE_ACCOUNT_EMAIL=namecard-sheets-access@namecard-crm.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEv...\n-----END PRIVATE KEY-----\n"
```

> **注意**: `GOOGLE_PRIVATE_KEY` 的值需要用雙引號包裹，`\n` 會自動在程式中轉換為換行。

## 步驟 5: 分享 Spreadsheet 給 Service Account

1. 開啟 Google Spreadsheet: https://docs.google.com/spreadsheets/d/1Z84xETSl4wJQDdi6AcbrJZpHY1dD6c-hJmFvAhGNHGg/edit
2. 右上角「共用」→ 輸入 Service Account 的 email
3. 權限設為 **Editor**
4. 送出

## 步驟 6: 執行資料遷移

```bash
npm run migrate-sheets
```

預期輸出:
```
📦 Found 71 contacts to migrate.
📊 Converted 71 contacts to rows.
🚀 Writing to Google Sheets...
✅ Migration complete!
   JSON contacts: 71
   Sheet rows: 71
   ✅ Counts match! Migration successful.
```

## 步驟 7: Zeabur 部署環境變數

在 Zeabur Dashboard 加入同樣的三個環境變數:
- `GOOGLE_SPREADSHEET_ID`
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_PRIVATE_KEY`

## Spreadsheet 結構

| 欄 | 欄位 | 說明 |
|----|------|------|
| A | ID | UUID |
| B | Name | 姓名 |
| C | Title | 職稱 |
| D | Company | 組織 |
| E | Email | 主要信箱 |
| F | Secondary Email | 次要信箱 |
| G | Phone | 電話 |
| H | Website | 網站 |
| I | LinkedIn | LinkedIn URL |
| J | Facebook | Facebook URL |
| K | Instagram | Instagram URL |
| L | Met At | 認識場合 |
| M | Notes | 備註 |
| N | Tags | 標籤（逗號分隔） |
| O | AI Summary | AI 摘要 |
| P | Added Date | 建立日期 |
| Q | Updated Date | 更新日期 |
| R | Image URL | R2 圖片路徑 |
| S | Importance Score | 重要度 0-100 |
| T | Last Verified | 最後驗證日期 |
| U | Verification Status | Fresh/Stale/Mismatch/Unknown |
| V | Email Valid | Valid/Invalid/Unknown |

## 故障排除

### "Missing GOOGLE_SERVICE_ACCOUNT_EMAIL"
→ 確認 `.env.local` 有正確設定三個 `GOOGLE_*` 環境變數

### "PERMISSION_DENIED"
→ 確認 Spreadsheet 已分享給 Service Account email（Editor 權限）

### "The caller does not have permission"
→ 確認 GCP 專案已啟用 Google Sheets API
