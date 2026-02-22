const fs = require('fs');
const path = require('path');
const { readAllRows, rowToContact } = require('./lib/sheets-client');

require('dotenv').config({ path: path.join(process.cwd(), '.env.local') });

const OUTPUT_FILE = path.join(process.cwd(), 'data/mailchimp-export.csv');

function escapeCsv(value) {
  if (!value) return '';
  const stringValue = String(value);
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

async function main() {
  console.log('🚀 Starting Mailchimp Export (from Google Sheets)...');

  const rows = await readAllRows();
  const contacts = rows.map(rowToContact);
  console.log(`📦 Found ${contacts.length} contacts.`);

  const headers = ['Email Address', 'Full Name', 'Company', 'Title', 'Tags', 'Phone Number'];
  const csvRows = [headers];

  let skippedCount = 0;

  contacts.forEach(contact => {
    if (!contact.email || !contact.email.trim()) {
      skippedCount++;
      return;
    }

    csvRows.push([
      escapeCsv(contact.email.trim()),
      escapeCsv((contact.name || '').trim()),
      escapeCsv((contact.company || '').trim()),
      escapeCsv((contact.title || '').trim()),
      escapeCsv(Array.isArray(contact.tags) ? contact.tags.join(',') : ''),
      escapeCsv((contact.phone || '').trim())
    ]);
  });

  const csvContent = csvRows.map(row => row.join(',')).join('\n');
  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, '\uFEFF' + csvContent, 'utf8');

  console.log(`✅ Exported ${csvRows.length - 1} contacts to ${OUTPUT_FILE}`);
  if (skippedCount > 0) {
    console.log(`⚠️  Skipped ${skippedCount} contacts without email addresses.`);
  }
}

main().catch(e => {
  console.error('❌ Export failed:', e);
  process.exit(1);
});
