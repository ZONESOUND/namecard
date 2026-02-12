const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(process.cwd(), 'data/contacts.json');
const OUTPUT_FILE = path.join(process.cwd(), 'data/mailchimp-export.csv');

function escapeCsv(value) {
  if (!value) return '';
  const stringValue = String(value);
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

function main() {
  console.log('🚀 Starting Mailchimp Export...');

  if (!fs.existsSync(DATA_FILE)) {
    console.error(`❌ Data file not found: ${DATA_FILE}`);
    process.exit(1);
  }

  const rawData = fs.readFileSync(DATA_FILE, 'utf8');
  let contacts;
  try {
    contacts = JSON.parse(rawData);
  } catch (error) {
    console.error('❌ Failed to parse JSON data:', error);
    process.exit(1);
  }

  console.log(`📦 Found ${contacts.length} contacts.`);

  const headers = ['Email Address', 'Full Name', 'Company', 'Title', 'Tags', 'Phone Number'];
  const rows = [headers];

  let skippedCount = 0;

  contacts.forEach(contact => {
    // Only export contacts with email addresses
    if (!contact.email || !contact.email.trim()) {
      skippedCount++;
      return;
    }

    const email = contact.email.trim();
    const fullName = (contact.name || '').trim();
    const company = (contact.company || '').trim();
    const title = (contact.title || '').trim();
    const phone = (contact.phone || '').trim();

    // Join tags with commas, but ensure the field is quoted by escapeCsv if needed
    // Mailchimp often imports tags as comma-separated if mapped to one field, 
    // or sometimes requires specific formatting. A single comma-separated string is standard for bulk import.
    const tags = Array.isArray(contact.tags) ? contact.tags.join(',') : '';

    rows.push([
      escapeCsv(email),
      escapeCsv(fullName),
      escapeCsv(company),
      escapeCsv(title),
      escapeCsv(tags),
      escapeCsv(phone)
    ]);
  });

  const csvContent = rows.map(row => row.join(',')).join('\n');

  // Add BOM for Excel compatibility (UTF-8 with BOM)
  const bom = '\uFEFF';
  fs.writeFileSync(OUTPUT_FILE, bom + csvContent, 'utf8');

  console.log(`✅ Exported ${rows.length - 1} contacts to ${OUTPUT_FILE}`);
  if (skippedCount > 0) {
    console.log(`⚠️  Skipped ${skippedCount} contacts without email addresses.`);
  }
}

main();
