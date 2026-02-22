# Smart Name Card Manager - Specification Document

## 1. Project Overview
**Project Name**: Smart Name Card Manager (Tentative)
**Objective**: A premium, AI-powered web application to digitize, organize, and actively monitor professional contacts. It features "Active Intelligence" to keep data fresh and provides flexible storage options (Google Sheets + Markdown) for easy indexing and portability.

## 2. Core Functional Requirements

### 2.1 Smart Input & Digitization
- **Multi-modal Input**:
  - **OCR from Images**: Upload photos of business cards. The system must extract Name, Title, Company, Email, Phone, Address, and Website. ✅ Implemented
  - **Manual Entry**: A sleek form for typing details. ✅ Implemented
  - **Bulk Import**: Support for CSV/JSON or drag-and-drop of multiple card images.
- **Auto-Correction**: During input, the system should standardize formatting (e.g., phone number formats, removing typos). ✅ Implemented (via GPT-4o)

### 2.2 Organization & Management
- **Categorization**:
  - Tags/Groups (e.g., Client, Vendor, Partner). ✅ Implemented
  - "Date Added" tracking (Automatic). ✅ Implemented
- **Search & Filter**: Instant search by any field (Name, Company, Tags). ✅ Implemented
- **Sort**: By name, importance score, or date added. ✅ Implemented
- **Filter**: By tag, region, or verification status (Stale/Mismatch). ✅ Implemented

### 2.3 Active Monitoring & Data Enrichment (The "Smart" Layer)
- **Staleness Detection**: ✅ Implemented
  - **Job Title/Unit auto-check**: Verify if the person still holds the position (via OpenAI Responses API + web_search_preview).
  - **Auto-Tagging**: If a contact seems outdated, automatically tag as "Potential Info Mismatch" and show red status dot.
- **Email Validation**: ✅ Implemented
  - Syntax check.
  - Domain existence check (DNS MX record query) to spot dead company domains.
- **Data Enrichment**: ✅ Implemented
  - AI fills in missing fields (social profiles, secondary email, organization context).

### 2.4 AI Intelligence & Valuation
- **Importance Analysis**: ✅ Implemented
  - GPT-4o analyzes the contact's relevance to 紀柏豪's professional network (0-100 score).
  - Scoring criteria: institutional influence, collaboration potential, field overlap, geographic proximity.
- **Contextual Summary**: ✅ Implemented
  - AI-generated professional background summary in Traditional Chinese.

## 3. User Experience (UX) & Design

### 3.1 Aesthetic Guideline: "Clean Modern" (Vercel/Linear Style)
-   **Color Palette**:
    -   Strictly monochromatic grayscale background (Slate-50 to Slate-900).
    -   **Accent**: Single vibrant color (e.g., Electric Blue or Violet) used *only* for primary actions (Buttons, Active States).
-   **Borders & Depth**:
    -   No heavy drop shadows. Use subtle 1px borders (`border-white/10`) to define edges.
    -   Use `backdrop-blur` for floating elements (Models, Sticky Headers) to maintain context.
-   **Spacing & Typography**:
    -   **Whitespace**: Significant padding (`p-6` or `p-8`) to let content breathe.
    -   **Font**: Tight sans-serif (Inter or Plus Jakarta Sans). High contrast between Headings (Bold, `tracking-tight`) and Body text.

### 3.2 Layout Strategy: "Bento Grid"
-   **Structure**:
    -   Content organized into modular, rectangular cards (rounded-2xl).
    -   Strict alignment to a responsive grid system.
-   **Card Style**:
    -   Subtle localized background colors (e.g., `bg-white/5`) contrasting slightly with the main background.
    -   **Micro-interactions**: Cards should have a subtle hover effect (e.g., proper border color change, slight scale `scale-[1.02]`, smooth `transition-all`).
    -   **Verification Status**: Color dots on avatar (green=Fresh, yellow=Stale, red=Mismatch).
    -   **Importance Badge**: Amber star badge with score on card top-left.
-   **Inputs**: Minimalist. No background (or transparent), minimal border, clean focus ring.

## 4. Technical Architecture & Data Strategy

### 4.1 Storage Model (Google Sheets + R2 + Markdown)
1.  **Primary Data Store**:
    -   **Technology**: **Google Sheets** (via googleapis + Service Account).
    -   **Reason**: Editable by humans and machines, built-in collaboration, version history, API access.
    -   **Cache**: In-memory cache with 30-second TTL, invalidated on mutation.
2.  **Image Storage**:
    -   **Technology**: **Cloudflare R2** (S3-compatible).
    -   Business card photos stored under `Images/` prefix.
3.  **Markdown Mirror (The "Obsidian" Layer)**:
    -   **Feature**: **Auto-Sync to Markdown**.
    -   **Function**: Whenever a contact is added/updated, the system writes a `.md` file to the `Cards/` directory.
    -   **Format**: Obsidian-compatible Frontmatter (YAML) + Content.
4.  **Local JSON Backup**:
    -   `data/contacts.json` preserved as fallback, synced via `npm run pull`.

### 4.2 Integrations
-   **Obsidian**: Native support via the Markdown Mirror (Project folder = Obsidian Vault).
-   **Google Sheets**: Direct editing in Sheets reflected in app within 30 seconds.

### 4.3 Tech Stack
-   **Frontend**: Next.js 14 (App Router) + Tailwind CSS.
-   **Backend Logic**: Next.js Server Actions for data mutations, API Routes for OCR and image proxy.
-   **AI Integration**: OpenAI API (GPT-4o) for OCR, enrichment, tag generation, importance scoring.
-   **Verification**: OpenAI Responses API (web_search_preview) for staleness detection.
-   **DNS**: Node.js built-in `dns.promises.resolveMx` for email validation.
-   **Auth**: JWT (jose) + HTTP-only cookies.

## 5. Implementation Roadmap
1.  **Phase 1: Foundation & Data**: Next.js + Local JSON + Markdown Mirror. ✅
2.  **Phase 2: "Clean Modern" UI**: Bento Grid dashboard, Vercel-like aesthetics, bilingual OCR form. ✅
3.  **Phase 3: Obsidian Sync**: Markdown output with metadata (tags, summary). ✅
4.  **Phase 4: AI Enrichment**: Job Title translation and Company background generation. ✅
5.  **Phase 5: Active Monitoring**: Email DNS validation, staleness detection, importance scoring. ✅
6.  **Phase 6: Google Sheets Migration**: Replace JSON + R2 data store with Google Sheets. ✅
