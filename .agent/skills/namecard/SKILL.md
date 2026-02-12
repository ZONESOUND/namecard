---
name: namecard
description: Manage the Name Card Manager project operations including data sync, cleanup, standardized workflows, and data enrichment.
---

# Namecard Skill

This skill provides a comprehensive set of tools and workflows for managing the Name Card Manager project. It encapsulates common maintenance tasks, data synchronization processes, and data enrichment workflows.

## Capabilities

### 1. Data Management & Synchronization
- **Pull Data**: Fetches the latest contact data from the source.
  - Command: `npm run pull`
  - Script: `scripts/pull-data.js`
- **Data Migration**:
  - `scripts/migrate-data.js`: General data migration.
  - `scripts/migrate-to-r2.js`: Migrates local data to Cloudflare R2 storage.
- **Export Data**:
  - **Mailchimp Export**: Generates a CSV file formatted for Mailchimp import.
    - Command: `npm run export`
    - Output: `data/mailchimp-export.csv`
    - Notes: Includes Email, Full Name, Company, Title, Tags, Phone. UTF-8 BOM encoding included for Excel compatibility.

### 2. Data Quality & Maintenance
- **Deduplication**: Identifies and merges duplicate contact entries to maintain a clean database.
  - Command: `npm run dedup`
  - Script: `scripts/deduplicate.js`
- **Cleanup**: Removes orphaned files and ensures data consistency.
  - Command: `npm run cleanup`
  - Script: `scripts/cleanup-orphans.js`
  - Script: `scripts/cleanup.js`: General cleanup utility.
- **Normalization**:
  - **Tags**: Standardizes tags across all contacts.
    - Command: `npm run normalize-tags`
    - Script: `scripts/normalize-tags.js`
  - **Company Names**: Standardizes company names for consistency.
    - Script: `scripts/standardize-company.js`

### 3. Data Enrichment (AI)
- **AI Enrichment**: Uses AI/External tools to enrich contact data (e.g., missing fields, social profiles, auto-tagging).
  - Script: `.agent/skills/namecard/scripts/enrich-all.js`
  - Command: `npm run enrich`

### 4. Development Workflow
- **Start Development Server**: Launches the local Next.js development server.
  - Command: `npm run dev`
- **Build Production**: Compiles the project for production deployment.
  - Command: `npm run build`
- **Lint Code**: checks for code quality issues.
  - Command: `npm run lint`

## Usage Guidelines

1.  **Always back up data** before running destructive commands like `cleanup` or `deduplicate`.
2.  **Check environment variables** in `.env.local` before running scripts that require external services (e.g., OpenAI, R2).
3.  **Run `npm install`** first to ensure all dependencies are available for the scripts.
