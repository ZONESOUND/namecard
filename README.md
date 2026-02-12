# Smart Name Card Manager | 智慧名片管理系統

A dual-mode (Local + Cloud) contact management system with AI enrichment, designed for syncing with Obsidian and deploying to Zeabur.
結合「本地優先」與「雲端部署」的智慧名片系統，支援 AI 自動補充資訊，並可與 Obsidian 筆記軟體同步。

## Features | 功能
*   **Active Intelligence**: Auto-fill missing contact details using OpenAI. (AI 自動補全背景資訊)
*   **Dual Storage**:
    *   **Local**: JSON + Markdown files (Obsidian compatible).
    *   **Cloud**: Synced with **Cloudflare R2** for web access.
*   **Secure Access**: Password-protected login. (密碼保護)

---

## 🚀 Operation Guide | 操作指南

### 1. Data Synchronization | 資料同步

**Important**: Always pull the latest data before making changes.
**重要**: 修改資料前，請務必確認已下載最新版本。

```bash
# Download latest contacts and images from Cloudflare R2
# 從 Cloudflare R2 下載最新的聯絡人與圖片
npm run pull
```

### 2. Export for Mailchimp | 匯出至 Mailchimp

Generate a CSV file optimized for Mailchimp import (UTF-8 BOM included).
產生專為 Mailchimp 優化的 CSV 檔案（包含 UTF-8 BOM 格式，Excel 可正常開啟）。

```bash
npm run export
```
*   **Output**: `data/mailchimp-export.csv`
*   **Import Mapping (匯入對應)**:
    *   **Email Address** -> Email
    *   **Full Name** -> First Name (or Custom Field)
    *   **Company** -> Company
    *   **Tags** -> Tags

### 3. Data Maintenance | 資料維護

```bash
# Merge duplicate contacts
# 合併重複的聯絡人資料
npm run dedup

# Cleanup orphaned files (images/markdown without JSON entry)
# 清理孤兒檔案（沒有對應資料的圖片或 Markdown）
npm run cleanup

# Standardize tags
# 統一標籤格式
npm run normalize-tags
```

### 4. AI Enrichment | AI 資料補全

Use AI to generate summaries and automatically tag contacts.
使用 AI 產生簡介並自動為聯絡人加上標籤。

```bash
npm run enrich
```
*   **Enrichment**: Generates a professional summary in Traditional Chinese. (產生繁體中文專業簡介)
*   **Auto Tagging**: Suggests up to 5 relevant tags based on the person's background. (根據背景自動建議 5 個相關標籤)

---

## Deployment | 部署 (Zeabur)

1.  Push code to GitHub.
2.  Deploy on Zeabur and set these **Environment Variables**:

```bash
# Auth (安全性)
ADMIN_PASSWORD=your_password
JWT_SECRET=random_string_xyz

# AI
OPENAI_API_KEY=sk-...

# Storage (Cloudflare R2)
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=namecard
```

## Local Development | 本地開發

```bash
npm install
npm run dev
# Open http://localhost:3000
```
