# Smart Name Card Manager | 智慧名片管理系統

A dual-mode (Local + Cloud) contact management system with AI enrichment, designed for syncing with Obsidian and deploying to Zeabur.
結合「本地優先」與「雲端部署」的智慧名片系統，支援 AI 自動補充資訊，並可與 Obsidian 筆記軟體同步。

## Features | 功能
*   **Active Intelligence**: Auto-fill missing contact details using OpenAI. (AI 自動補全背景資訊)
*   **Dual Storage**:
    *   **Local**: JSON + Markdown files (Obsidian compatible).
    *   **Cloud**: Synced with **Cloudflare R2** for web access.
*   **Secure Access**: Password-protected login. (密碼保護)

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

