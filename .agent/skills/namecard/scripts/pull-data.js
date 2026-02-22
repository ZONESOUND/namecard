/**
 * Pull data from Google Sheets → local JSON backup
 * (Replaces the old R2 → local sync)
 * Usage: npm run pull
 */
const fs = require('fs');
const path = require('path');
const { readAllRows, rowToContact } = require('./lib/sheets-client');

require('dotenv').config({ path: path.join(process.cwd(), '.env.local') });

async function main() {
    console.log("🚀 Starting Google Sheets → Local JSON sync...");

    const rows = await readAllRows();
    const contacts = rows.map(rowToContact);

    console.log(`📦 Fetched ${contacts.length} contacts from Google Sheets.`);

    // Save to local JSON as backup
    const dataDir = path.join(process.cwd(), 'data');
    fs.mkdirSync(dataDir, { recursive: true });

    const outputPath = path.join(dataDir, 'contacts.json');
    fs.writeFileSync(outputPath, JSON.stringify(contacts, null, 2));
    console.log(`✅ Saved to ${outputPath}`);

    console.log("\n✨ Pull Complete! Local JSON is now in sync with Google Sheets.");
}

main().catch(e => {
    console.error("❌ Pull failed:", e);
    process.exit(1);
});
