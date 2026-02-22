import { google } from 'googleapis';

// --- CONFIGURATION ---
const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;
const SHEET_NAME = 'Contacts';
const RANGE_ALL = `${SHEET_NAME}!A2:V`;
const RANGE_HEADER = `${SHEET_NAME}!A1:V1`;

// Column mapping: object key → column index (0-based)
const COL_MAP = {
  id: 0, name: 1, title: 2, company: 3, email: 4, secondaryEmail: 5,
  phone: 6, website: 7, linkedin: 8, facebook: 9, instagram: 10,
  metAt: 11, notes: 12, tags: 13, aiSummary: 14, addedAt: 15,
  updatedAt: 16, imageUrl: 17, importanceScore: 18, lastVerifiedAt: 19,
  verificationStatus: 20, emailValid: 21,
};

const COL_COUNT = 22; // A through V

// --- AUTH ---
let _authClient = null;
let _sheetsApi = null;

function getAuth() {
  if (_authClient) return _authClient;

  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  let key = process.env.GOOGLE_PRIVATE_KEY;

  if (!email || !key) {
    throw new Error('Missing GOOGLE_SERVICE_ACCOUNT_EMAIL or GOOGLE_PRIVATE_KEY in environment');
  }

  // Handle various env var formats:
  // 1. Wrapped in extra quotes from some env managers
  // 2. Escaped \n from .env.local files
  // 3. Spaces instead of newlines (Zeabur UI copy-paste strips newlines)
  // 4. Real newlines from Docker/CLI env vars
  key = key.replace(/^["']|["']$/g, '');
  key = key.replace(/\\n/g, '\n');

  // If the key has no real newlines (all on one line with spaces), reconstruct PEM format
  if (!key.includes('\n') || key.split('\n').length < 3) {
    const b64 = key
      .replace(/-----BEGIN PRIVATE KEY-----/, '')
      .replace(/-----END PRIVATE KEY-----/, '')
      .replace(/\s+/g, '');
    const lines = b64.match(/.{1,64}/g) || [];
    key = ['-----BEGIN PRIVATE KEY-----', ...lines, '-----END PRIVATE KEY-----', ''].join('\n');
  }

  _authClient = new google.auth.GoogleAuth({
    credentials: { client_email: email, private_key: key },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  return _authClient;
}

function getSheetsApi() {
  if (_sheetsApi) return _sheetsApi;
  _sheetsApi = google.sheets({ version: 'v4', auth: getAuth() });
  return _sheetsApi;
}

// --- IN-MEMORY CACHE (TTL 30s) ---
let _cache = null;
let _cacheTime = 0;
const CACHE_TTL = 30_000;

function invalidateCache() {
  _cache = null;
  _cacheTime = 0;
}

// --- SERIALIZATION ---

function contactToRow(contact) {
  const row = new Array(COL_COUNT).fill('');
  row[COL_MAP.id] = contact.id || '';
  row[COL_MAP.name] = contact.name || '';
  row[COL_MAP.title] = contact.title || '';
  row[COL_MAP.company] = contact.company || '';
  row[COL_MAP.email] = contact.email || '';
  row[COL_MAP.secondaryEmail] = contact.secondaryEmail || '';
  row[COL_MAP.phone] = contact.phone || '';

  // Flatten socialProfiles into columns
  const sp = contact.socialProfiles || {};
  row[COL_MAP.website] = sp.website || contact.website || '';
  row[COL_MAP.linkedin] = sp.linkedin || '';
  row[COL_MAP.facebook] = sp.facebook || '';
  row[COL_MAP.instagram] = sp.instagram || '';

  row[COL_MAP.metAt] = contact.metAt || '';
  row[COL_MAP.notes] = contact.notes || '';
  row[COL_MAP.tags] = (contact.tags || []).join(', ');
  row[COL_MAP.aiSummary] = contact.aiSummary || '';
  row[COL_MAP.addedAt] = contact.addedAt || '';
  row[COL_MAP.updatedAt] = contact.updatedAt || '';
  row[COL_MAP.imageUrl] = contact.imageUrl || '';
  row[COL_MAP.importanceScore] = String(contact.importanceScore || 0);
  row[COL_MAP.lastVerifiedAt] = contact.lastVerifiedAt || '';
  row[COL_MAP.verificationStatus] = contact.verificationStatus || 'Unknown';
  row[COL_MAP.emailValid] = contact.emailValid || 'Unknown';

  return row;
}

function rowToContact(row) {
  // Pad row to COL_COUNT to avoid undefined
  while (row.length < COL_COUNT) row.push('');

  return {
    id: row[COL_MAP.id],
    name: row[COL_MAP.name],
    title: row[COL_MAP.title],
    company: row[COL_MAP.company],
    email: row[COL_MAP.email],
    secondaryEmail: row[COL_MAP.secondaryEmail] || '',
    phone: row[COL_MAP.phone],
    socialProfiles: {
      website: row[COL_MAP.website] || '',
      linkedin: row[COL_MAP.linkedin] || '',
      facebook: row[COL_MAP.facebook] || '',
      instagram: row[COL_MAP.instagram] || '',
    },
    website: row[COL_MAP.website] || '',
    metAt: row[COL_MAP.metAt],
    notes: row[COL_MAP.notes],
    tags: row[COL_MAP.tags] ? row[COL_MAP.tags].split(',').map(t => t.trim()).filter(Boolean) : [],
    aiSummary: row[COL_MAP.aiSummary],
    addedAt: row[COL_MAP.addedAt],
    updatedAt: row[COL_MAP.updatedAt],
    imageUrl: row[COL_MAP.imageUrl],
    importanceScore: parseInt(row[COL_MAP.importanceScore]) || 0,
    lastVerifiedAt: row[COL_MAP.lastVerifiedAt] || '',
    verificationStatus: row[COL_MAP.verificationStatus] || 'Unknown',
    emailValid: row[COL_MAP.emailValid] || 'Unknown',
    history: [], // history not stored in Sheets; always empty array for compat
  };
}

// --- CRUD OPERATIONS ---

export async function getContacts() {
  // Check cache
  if (_cache && Date.now() - _cacheTime < CACHE_TTL) {
    return _cache;
  }

  // Graceful fallback if Google Sheets is not configured
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY;
  if (!email || !key || !SPREADSHEET_ID) {
    console.warn('[sheets] Google Sheets not configured — returning empty contacts. Set GOOGLE_SPREADSHEET_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY.');
    return [];
  }

  try {
    const sheets = getSheetsApi();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: RANGE_ALL,
    });

    const rows = res.data.values || [];
    const contacts = rows.filter(r => r[0]).map(rowToContact);

    // Update cache
    _cache = contacts;
    _cacheTime = Date.now();

    return contacts;
  } catch (err) {
    console.error('[sheets] Failed to fetch contacts:', err.message);
    return [];
  }
}

// Find the Sheet row number (1-indexed) for a given contact ID
async function findRowIndex(id) {
  const sheets = getSheetsApi();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A:A`,
  });

  const col = res.data.values || [];
  for (let i = 1; i < col.length; i++) {
    if (col[i] && col[i][0] === id) {
      return i + 1; // 1-indexed sheet row (row 1 = header)
    }
  }
  return -1;
}

export async function saveContact(contact) {
  const sheets = getSheetsApi();
  const contacts = await getContacts();
  const index = contacts.findIndex(c => c.id === contact.id);

  const now = new Date().toISOString();

  if (index >= 0) {
    // --- UPDATE existing contact ---
    const existing = contacts[index];
    let history = existing.history || [];

    if (contact.jobStatus === 'history' && contact.title !== existing.title) {
      history.push({
        title: existing.title,
        company: existing.company,
        date: existing.updatedAt || existing.addedAt,
      });
    }

    let currentTitle = contact.title;
    let currentCompany = contact.company;
    if (contact.jobStatus === 'concurrent' && contact.title !== existing.title) {
      currentTitle = `${existing.title} & ${contact.title}`;
      if (existing.company !== contact.company) {
        currentCompany = `${existing.company} / ${contact.company}`;
      }
    }

    const merged = {
      ...existing,
      ...contact,
      title: currentTitle,
      company: currentCompany,
      history,
      updatedAt: now,
    };

    const row = contactToRow(merged);
    const rowNum = await findRowIndex(merged.id);
    if (rowNum > 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_NAME}!A${rowNum}:V${rowNum}`,
        valueInputOption: 'RAW',
        requestBody: { values: [row] },
      });
    }

    invalidateCache();

    // Write Markdown
    const { generateMarkdown, writeMarkdownFile } = await import('./markdown.js');
    await writeMarkdownFile(merged);

    return merged;
  } else {
    // --- INSERT new contact ---
    const newContact = {
      ...contact,
      history: [],
      tags: contact.tags || [],
      id: contact.id || crypto.randomUUID(),
      addedAt: contact.addedAt || now,
      updatedAt: now,
      importanceScore: contact.importanceScore || 0,
      verificationStatus: contact.verificationStatus || 'Unknown',
      emailValid: contact.emailValid || 'Unknown',
    };

    const row = contactToRow(newContact);
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: RANGE_ALL,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [row] },
    });

    invalidateCache();

    // Write Markdown
    const { writeMarkdownFile } = await import('./markdown.js');
    await writeMarkdownFile(newContact);

    return newContact;
  }
}

export async function updateContact(id, updates) {
  const contacts = await getContacts();
  const existing = contacts.find(c => c.id === id);
  if (!existing) return null;

  const updatedContact = {
    ...existing,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  return await saveContact(updatedContact);
}

export async function deleteContact(id) {
  const sheets = getSheetsApi();
  const contacts = await getContacts();
  const contact = contacts.find(c => c.id === id);
  if (!contact) return;

  // Find the row and delete it
  const rowNum = await findRowIndex(id);
  if (rowNum > 0) {
    // Get sheetId for the Contacts tab
    const meta = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
      fields: 'sheets.properties',
    });
    const sheet = meta.data.sheets.find(
      s => s.properties.title === SHEET_NAME
    );
    const sheetId = sheet?.properties?.sheetId || 0;

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [{
          deleteDimension: {
            range: {
              sheetId,
              dimension: 'ROWS',
              startIndex: rowNum - 1, // 0-indexed
              endIndex: rowNum,
            },
          },
        }],
      },
    });
  }

  invalidateCache();

  // Delete Markdown file
  const { deleteMarkdownFile } = await import('./markdown.js');
  await deleteMarkdownFile(contact);

  return contacts.filter(c => c.id !== id);
}

export async function findDuplicate(contact) {
  const contacts = await getContacts();

  return contacts.find(c => {
    if (contact.email && c.email && c.email.toLowerCase() === contact.email.toLowerCase()) return true;

    if (contact.phone && c.phone) {
      const p1 = contact.phone.replace(/\D/g, '');
      const p2 = c.phone.replace(/\D/g, '');
      if (p1.length > 7 && p1 === p2) return true;
    }

    if (contact.name && c.name) {
      const n1 = contact.name.toLowerCase().trim();
      const n2 = c.name.toLowerCase().trim();
      if (n1 === n2) return true;
      if (n1.length > 1 && n2.length > 1 && (n1.includes(n2) || n2.includes(n1))) return true;
    }

    if (contact.company && c.company && contact.company === c.company &&
      contact.title && c.title && contact.title === c.title) {
      const hasHan = (s) => /[\u4e00-\u9fa5]/.test(s);
      const name1 = contact.name || '';
      const name2 = c.name || '';
      if ((hasHan(name1) && !hasHan(name2)) || (!hasHan(name1) && hasHan(name2))) {
        return true;
      }
    }
    return false;
  });
}

export async function getUniqueTags() {
  const contacts = await getContacts();
  const tags = new Set();
  contacts.forEach(c => {
    if (c.tags && Array.isArray(c.tags)) {
      c.tags.forEach(t => tags.add(t));
    }
  });
  return Array.from(tags).sort();
}

// --- BATCH HELPERS (used by migration & verification scripts) ---

export async function batchWriteRows(rows) {
  const sheets = getSheetsApi();
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A2:V${rows.length + 1}`,
    valueInputOption: 'RAW',
    requestBody: { values: rows },
  });
  invalidateCache();
}

export async function updateCells(rowNum, colStart, colEnd, values) {
  const sheets = getSheetsApi();
  const startCol = String.fromCharCode(65 + colStart); // A=0, B=1, ...
  const endCol = String.fromCharCode(65 + colEnd);
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!${startCol}${rowNum}:${endCol}${rowNum}`,
    valueInputOption: 'RAW',
    requestBody: { values: [values] },
  });
  invalidateCache();
}

// Export constants for external use
export { COL_MAP, SPREADSHEET_ID, contactToRow, rowToContact, findRowIndex };
