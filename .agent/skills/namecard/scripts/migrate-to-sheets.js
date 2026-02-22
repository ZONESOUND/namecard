/**
 * One-time migration: data/contacts.json → Google Sheets
 * Usage: npm run migrate-sheets
 */
const fs = require('fs');
const path = require('path');
const { getSheets, contactToRow, SPREADSHEET_ID, SHEET_NAME } = require('./lib/sheets-client');

async function migrate() {
  const contactsPath = path.join(process.cwd(), 'data/contacts.json');

  if (!fs.existsSync(contactsPath)) {
    console.error('❌ data/contacts.json not found');
    process.exit(1);
  }

  const contacts = JSON.parse(fs.readFileSync(contactsPath, 'utf8'));
  console.log(`📦 Found ${contacts.length} contacts to migrate.\n`);

  // Convert each contact to a sheet row
  const rows = contacts.map(c => {
    // Add default values for new verification fields
    const enriched = {
      ...c,
      importanceScore: c.importanceScore || 0,
      lastVerifiedAt: c.lastVerifiedAt || '',
      verificationStatus: c.verificationStatus || 'Unknown',
      emailValid: c.emailValid || 'Unknown',
    };
    return contactToRow(enriched);
  });

  console.log(`📊 Converted ${rows.length} contacts to rows.`);
  console.log(`   Sample row (first contact): ${contacts[0].name}`);

  // Batch write to Google Sheets (single API call)
  const sheets = getSheets();
  const range = `${SHEET_NAME}!A2:V${rows.length + 1}`;

  console.log(`\n🚀 Writing to Google Sheets...`);
  console.log(`   Range: ${range}`);

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range,
    valueInputOption: 'RAW',
    requestBody: { values: rows },
  });

  // Verify
  const verifyRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A:A`,
  });
  const sheetRowCount = (verifyRes.data.values || []).length - 1; // minus header

  console.log(`\n✅ Migration complete!`);
  console.log(`   JSON contacts: ${contacts.length}`);
  console.log(`   Sheet rows: ${sheetRowCount}`);

  if (sheetRowCount === contacts.length) {
    console.log('   ✅ Counts match! Migration successful.');
  } else {
    console.log('   ⚠️  Count mismatch! Please check the spreadsheet.');
  }

  console.log(`\n📌 Spreadsheet: https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit`);
  console.log('\n💡 data/contacts.json is preserved as backup. Do NOT delete it.');
}

migrate().catch(e => {
  console.error('❌ Migration failed:', e);
  process.exit(1);
});
