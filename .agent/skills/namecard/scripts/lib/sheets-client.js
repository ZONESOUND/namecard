/**
 * Shared Google Sheets client for CLI scripts (CommonJS)
 * Usage: const { getSheets, SPREADSHEET_ID, SHEET_NAME } = require('./lib/sheets-client');
 */
const { google } = require('googleapis');
const path = require('path');

require('dotenv').config({ path: path.join(process.cwd(), '.env.local') });

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;
const SHEET_NAME = 'Contacts';

if (!SPREADSHEET_ID) {
  console.error('❌ GOOGLE_SPREADSHEET_ID missing in .env.local');
  process.exit(1);
}

let _sheets = null;

function getSheets() {
  if (_sheets) return _sheets;

  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!email || !key) {
    console.error('❌ GOOGLE_SERVICE_ACCOUNT_EMAIL or GOOGLE_PRIVATE_KEY missing in .env.local');
    process.exit(1);
  }

  const auth = new google.auth.GoogleAuth({
    credentials: { client_email: email, private_key: key },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  _sheets = google.sheets({ version: 'v4', auth });
  return _sheets;
}

// Read all contacts from Sheets as raw rows
async function readAllRows() {
  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A2:V`,
  });
  return res.data.values || [];
}

// Write all rows back (overwrite from A2)
async function writeAllRows(rows) {
  const sheets = getSheets();
  // Clear existing data first
  await sheets.spreadsheets.values.clear({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A2:V`,
  });
  if (rows.length > 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A2:V${rows.length + 1}`,
      valueInputOption: 'RAW',
      requestBody: { values: rows },
    });
  }
}

// Column mapping (same as lib/sheets.js)
const COL = {
  id: 0, name: 1, title: 2, company: 3, email: 4, secondaryEmail: 5,
  phone: 6, website: 7, linkedin: 8, facebook: 9, instagram: 10,
  metAt: 11, notes: 12, tags: 13, aiSummary: 14, addedAt: 15,
  updatedAt: 16, imageUrl: 17, importanceScore: 18, lastVerifiedAt: 19,
  verificationStatus: 20, emailValid: 21,
};

function rowToContact(row) {
  while (row.length < 22) row.push('');
  return {
    id: row[COL.id],
    name: row[COL.name],
    title: row[COL.title],
    company: row[COL.company],
    email: row[COL.email],
    secondaryEmail: row[COL.secondaryEmail] || '',
    phone: row[COL.phone],
    socialProfiles: {
      website: row[COL.website] || '',
      linkedin: row[COL.linkedin] || '',
      facebook: row[COL.facebook] || '',
      instagram: row[COL.instagram] || '',
    },
    metAt: row[COL.metAt],
    notes: row[COL.notes],
    tags: row[COL.tags] ? row[COL.tags].split(',').map(t => t.trim()).filter(Boolean) : [],
    aiSummary: row[COL.aiSummary],
    addedAt: row[COL.addedAt],
    updatedAt: row[COL.updatedAt],
    imageUrl: row[COL.imageUrl],
    importanceScore: parseInt(row[COL.importanceScore]) || 0,
    lastVerifiedAt: row[COL.lastVerifiedAt] || '',
    verificationStatus: row[COL.verificationStatus] || 'Unknown',
    emailValid: row[COL.emailValid] || 'Unknown',
  };
}

function contactToRow(c) {
  const row = new Array(22).fill('');
  row[COL.id] = c.id || '';
  row[COL.name] = c.name || '';
  row[COL.title] = c.title || '';
  row[COL.company] = c.company || '';
  row[COL.email] = c.email || '';
  row[COL.secondaryEmail] = c.secondaryEmail || '';
  row[COL.phone] = c.phone || '';
  const sp = c.socialProfiles || {};
  row[COL.website] = sp.website || c.website || '';
  row[COL.linkedin] = sp.linkedin || '';
  row[COL.facebook] = sp.facebook || '';
  row[COL.instagram] = sp.instagram || '';
  row[COL.metAt] = c.metAt || '';
  row[COL.notes] = c.notes || '';
  row[COL.tags] = (c.tags || []).join(', ');
  row[COL.aiSummary] = c.aiSummary || '';
  row[COL.addedAt] = c.addedAt || '';
  row[COL.updatedAt] = c.updatedAt || '';
  row[COL.imageUrl] = c.imageUrl || '';
  row[COL.importanceScore] = String(c.importanceScore || 0);
  row[COL.lastVerifiedAt] = c.lastVerifiedAt || '';
  row[COL.verificationStatus] = c.verificationStatus || 'Unknown';
  row[COL.emailValid] = c.emailValid || 'Unknown';
  return row;
}

module.exports = {
  getSheets,
  readAllRows,
  writeAllRows,
  rowToContact,
  contactToRow,
  COL,
  SPREADSHEET_ID,
  SHEET_NAME,
};
