# Smart Name Card Manager

A premium, AI-powered contact management system designed for creative professionals. It digitizes, organizes, and actively monitors your professional network with a "Local-First, Cloud-Ready" architecture.

## 🌟 Key Features

*   **Active Intelligence**: Automatically enriches contact details (background, company info) using OpenAI.
*   **Dual Storage Engine**:
    *   **Local Mode**: Stores data in `data.json` and Markdown files for Obsidan compatibility.
    *   **Cloud Mode**: Seamlessly syncs with **Cloudflare R2** for serverless deployment.
*   **Secure Access**: Built-in password authentication for web deployment.
*   **Markdown Mirror**: Every contact is mirrored as a `.md` file, perfect for syncing with Obsidian or other knowledge base tools.

## 🚀 Deployment (Zeabur)

This project is optimized for deployment on **Zeabur**.

1.  Connect your GitHub repository to Zeabur.
2.  Add the following **Environment Variables** in Zeabur settings:

```bash
# Security
ADMIN_PASSWORD=your_password_here
JWT_SECRET=generate_a_random_string_here

# AI Service
OPENAI_API_KEY=sk-...

# Storage (Cloudflare R2)
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=namecard
```

## 🛠 Local Development

1.  Sidebar dependencies:
    ```bash
    npm install
    ```
2.  Run the development server:
    ```bash
    npm run dev
    ```
3.  Open [http://localhost:3000](http://localhost:3000).

## 📂 Project Structure

*   **/app**: Next.js App Router source code.
*   **/data**: Local fallback storage for the JSON database.
*   **/Cards**: Local fallback storage for Markdown files.
*   **/scripts**: Utilities for database migration and cleanup.
