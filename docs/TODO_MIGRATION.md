# 遷移待辦事項

> 程式碼已全部寫好並通過 build。以下是需要手動完成的步驟。

---

## ✅ 已完成（程式碼）

- [x] Google Spreadsheet 建立（ID: `1Z84xETSl4wJQDdi6AcbrJZpHY1dD6c-hJmFvAhGNHGg`）
- [x] Header row 寫入 + 格式化
- [x] `npm install googleapis`
- [x] `lib/sheets.js` — Google Sheets CRUD + 快取
- [x] `lib/r2.js` — R2 圖片操作
- [x] `lib/markdown.js` — Markdown 生成
- [x] `lib/storage.js` — Facade 重構
- [x] 4 個新 server actions（DNS / Importance / Staleness / BatchVerify）
- [x] UI 更新（驗證色點、Importance 徽章、Verify 按鈕、排序篩選）
- [x] 所有 CLI 腳本改為讀寫 Sheets
- [x] 遷移腳本 `migrate-to-sheets.js`
- [x] 批次驗證腳本 `verify-all.js`
- [x] 文件（ARCHITECTURE / CHANGELOG / SETUP / SPECIFICATIONS）
- [x] `npm run build` 通過

---

## 🔧 Step 1: 建立 GCP Service Account

1. 開啟 https://console.cloud.google.com
2. 左上角選擇或建立專案 → 命名 `namecard-crm`
3. 左側選單 → **APIs & Services** → **Library**
4. 搜尋 `Google Sheets API` → 點 **Enable**
5. 左側選單 → **IAM & Admin** → **Service Accounts**
6. 點 **Create Service Account**
   - 名稱：`namecard-sheets`
   - 不需要額外 Role，直接 Done
7. 點進剛建立的 Service Account → **Keys** 分頁
8. **Add Key** → **Create new key** → **JSON** → 下載

---

## 🔧 Step 2: 填入環境變數

打開下載的 JSON，找到 `client_email` 和 `private_key`，填入：

**檔案：** `.env.local`（已預留空位）

```
GOOGLE_SERVICE_ACCOUNT_EMAIL=namecard-sheets@namecard-crm.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEv......\n-----END PRIVATE KEY-----\n"
```

> ⚠️ `GOOGLE_PRIVATE_KEY` 值必須用雙引號包裹，JSON 中的 `\n` 原樣貼上即可。

---

## 🔧 Step 3: 分享 Spreadsheet

1. 開啟 https://docs.google.com/spreadsheets/d/1Z84xETSl4wJQDdi6AcbrJZpHY1dD6c-hJmFvAhGNHGg/edit
2. 右上角 **共用**
3. 輸入 Service Account 的 email（Step 2 的 `client_email`）
4. 權限選 **Editor**
5. 送出（不勾「通知」）

---

## 🔧 Step 4: 執行資料遷移

```bash
cd ~/Library/Mobile\ Documents/com~apple~CloudDocs/AntigravityProjects/namecard
npm run migrate-sheets
```

預期輸出：
```
📦 Found 71 contacts to migrate.
🚀 Writing to Google Sheets...
✅ Migration complete!
   ✅ Counts match!
```

遷移後到 Spreadsheet 確認 71 行資料完整。

---

## 🔧 Step 5: 本地驗證

```bash
npm run dev
```

打開 http://localhost:3000 確認：

- [ ] 首頁載入正常，顯示所有聯絡人
- [ ] 搜尋、標籤篩選正常
- [ ] 點開一筆 → 編輯 → 儲存 → Spreadsheet 同步更新
- [ ] 新增一筆 → Spreadsheet 出現新行 + `Cards/` 出現 .md
- [ ] 刪除一筆 → Spreadsheet 移除行 + .md 刪除
- [ ] AI Enrichment → Spreadsheet O 欄更新
- [ ] Verify 按鈕 → Staleness / DNS / Importance 正常
- [ ] 側欄排序（By Importance）正常
- [ ] 側欄「僅顯示過期」篩選正常

---

## 🔧 Step 6: Zeabur 部署

在 Zeabur Dashboard 的環境變數加入：

| 變數 | 值 |
|------|-----|
| `GOOGLE_SPREADSHEET_ID` | `1Z84xETSl4wJQDdi6AcbrJZpHY1dD6c-hJmFvAhGNHGg` |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | （同 Step 2） |
| `GOOGLE_PRIVATE_KEY` | （同 Step 2） |

然後 push 觸發自動部署：

```bash
git add -A
git commit -m "feat: migrate to Google Sheets + smart verification"
git push
```

---

## 🔧 Step 7: 部署後驗證

- [ ] 線上版首頁載入正常
- [ ] CRUD 操作正常
- [ ] AI 功能正常

---

## 📋 備註

- `data/contacts.json` 保留不刪除，作為備份
- 舊的 R2 JSON 資料（`data/contacts.json` on R2）不影響新系統，可日後清理
- R2 仍用於圖片儲存，不受影響
- Google Sheets API 限額：每分鐘 300 次請求，快取 30 秒 TTL 避免濫用
