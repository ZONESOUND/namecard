# Namecard CRM — 系統架構

## 架構概覽

```
┌─────────────────────────────────────────────────────┐
│                    Next.js App                       │
│                  (App Router)                        │
│                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │  page.js  │  │ actions  │  │  API Routes      │  │
│  │  (SSR)   │  │ (server) │  │  /api/parse-card  │  │
│  └────┬─────┘  └────┬─────┘  │  /api/images/*   │  │
│       │              │        │  /api/login       │  │
│       └──────┬───────┘        └──────────────────┘  │
│              │                                       │
│     ┌────────▼────────┐                             │
│     │  lib/storage.js  │  ← Facade (re-exports)     │
│     └────────┬────────┘                             │
│              │                                       │
│    ┌─────────┼──────────┐                           │
│    │         │          │                            │
│  ┌─▼──┐  ┌──▼──┐  ┌───▼────┐                      │
│  │r2.js│  │sheet│  │markdown│                       │
│  │     │  │s.js │  │.js     │                       │
│  └──┬──┘  └──┬──┘  └───┬────┘                      │
│     │        │          │                            │
└─────┼────────┼──────────┼────────────────────────────┘
      │        │          │
      ▼        ▼          ▼
 ┌────────┐ ┌─────────┐ ┌──────┐
 │Cloudflare│ │ Google  │ │Local │
 │   R2    │ │ Sheets  │ │Cards/│
 │(Images) │ │(Data)   │ │(.md) │
 └────────┘ └─────────┘ └──────┘
```

## 資料流

### 讀取聯絡人
```
page.js → getContacts() → lib/sheets.js → Google Sheets API → 記憶體快取 (30s TTL)
```

### 儲存/更新聯絡人
```
actions.js → saveContact() → lib/sheets.js → Google Sheets API
                            → lib/markdown.js → Cards/*.md (本地 Obsidian)
```

### 圖片上傳
```
/api/parse-card → lib/r2.js → Cloudflare R2 (Images/)
                → /api/images/* 代理讀取
```

## 儲存層

| 層 | 用途 | 技術 |
|----|------|------|
| **Google Sheets** | 結構化資料主源 | googleapis (Service Account) |
| **Cloudflare R2** | 名片圖片儲存 | @aws-sdk/client-s3 |
| **Local Markdown** | Obsidian 鏡像 | fs (Cards/ 目錄) |
| **Local JSON** | 備份 (data/contacts.json) | npm run pull 同步 |

## 快取策略

- 記憶體快取 TTL: 30 秒
- 任何寫入操作（save/update/delete）立即失效快取
- Google Sheets 直接編輯的變更會在 ≤30 秒後反映

## 認證

| 系統 | 方法 |
|------|------|
| App 登入 | JWT (jose) + Cookie |
| Google Sheets | GCP Service Account |
| Cloudflare R2 | Access Key/Secret |
| OpenAI | API Key |

## 智慧驗證功能

| 功能 | 技術 | 觸發方式 |
|------|------|----------|
| Email DNS 驗證 | Node.js dns.promises.resolveMx | 按鈕 / 批次 |
| Importance Score | GPT-4o 評分 (0-100) | 按鈕 / 批次 |
| Staleness Detection | OpenAI Responses API + web_search | 按鈕 |
| Batch Verify | 依序執行以上三項 | 側欄按鈕 / CLI |

## 目錄結構

```
namecard/
├── app/
│   ├── page.js              # 首頁 (SSR)
│   ├── actions.js           # Server Actions (CRUD + AI + Verify)
│   ├── api/
│   │   ├── login/           # JWT 登入
│   │   ├── parse-card/      # OCR 解析
│   │   └── images/[...path] # R2 圖片代理
│   └── components/
│       ├── ContactCard.js
│       ├── EditContactModal.js
│       └── SearchableContactGrid.js
├── lib/
│   ├── storage.js           # Facade (re-exports)
│   ├── sheets.js            # Google Sheets CRUD + 快取
│   ├── r2.js                # Cloudflare R2 圖片操作
│   ├── markdown.js          # Markdown 生成
│   ├── auth.js              # JWT 認證
│   └── s3.js                # (legacy, 可移除)
├── data/
│   └── contacts.json        # 本地 JSON 備份
├── Cards/                   # Obsidian Markdown 鏡像
├── docs/
│   ├── GOOGLE_SHEETS_SETUP.md
│   ├── ARCHITECTURE.md
│   └── CHANGELOG.md
└── .agent/skills/namecard/scripts/
    ├── lib/sheets-client.js  # CLI 共用 Sheets 客戶端
    ├── migrate-to-sheets.js  # 一次性遷移
    ├── verify-all.js         # 批次驗證
    ├── enrich-all.js         # 批次 AI 補充
    ├── normalize-tags.js     # 標籤標準化
    ├── deduplicate.js        # 去重
    ├── export-mailchimp.js   # Mailchimp 匯出
    └── pull-data.js          # Sheets → 本地 JSON
```

## 環境變數

| 變數 | 用途 |
|------|------|
| `OPENAI_API_KEY` | GPT-4o API |
| `ADMIN_PASSWORD` | App 登入密碼 |
| `JWT_SECRET` | JWT 簽名金鑰 |
| `R2_ACCOUNT_ID` | Cloudflare R2 |
| `R2_ACCESS_KEY_ID` | Cloudflare R2 |
| `R2_SECRET_ACCESS_KEY` | Cloudflare R2 |
| `R2_BUCKET_NAME` | Cloudflare R2 |
| `GOOGLE_SPREADSHEET_ID` | Google Sheets ID |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | GCP Service Account |
| `GOOGLE_PRIVATE_KEY` | GCP Service Account |
