/**
 * Batch verification CLI: DNS check + Staleness check + Importance score
 * Usage: npm run verify
 */
const dns = require('dns').promises;
const path = require('path');
const { readAllRows, writeAllRows, rowToContact, contactToRow, COL } = require('./lib/sheets-client');

require('dotenv').config({ path: path.join(process.cwd(), '.env.local') });

const DELAY_MS = 2000;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function verifyEmailDNS(email) {
  if (!email || !email.includes('@')) return 'No Email';
  const domain = email.split('@')[1];
  try {
    const records = await dns.resolveMx(domain);
    return records && records.length > 0 ? 'Valid' : 'Invalid';
  } catch (e) {
    return 'Invalid';
  }
}

async function calculateImportance(contact) {
  const OpenAI = require('openai');
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const prompt = `Rate the professional relevance (0-100) of this contact to 紀柏豪 (Chi Po-Hao), a Taiwanese sound artist working in new media art, sound installations, and electroacoustic music.

Contact:
Name: ${contact.name}
Title: ${contact.title}
Company: ${contact.company}
Tags: ${(contact.tags || []).join(', ')}
Summary: ${contact.aiSummary || ''}

Scoring criteria:
- Institutional influence (arts organizations, funding bodies, major festivals): +20-30
- Direct collaboration potential (curators, producers, artists in related fields): +20-30
- Field overlap (sound art, new media, electroacoustic, digital art): +15-25
- Geographic proximity (Taiwan-based or frequent Taiwan ties): +5-15
- Active professional relationship indicators: +5-10

Return ONLY a JSON object: { "score": <number>, "reason": "<brief reason>" }`;

  try {
    const res = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      max_tokens: 150,
    });
    const result = JSON.parse(res.choices[0].message.content);
    return Math.min(100, Math.max(0, parseInt(result.score) || 0));
  } catch (e) {
    console.error(`    Importance error: ${e.message}`);
    return 0;
  }
}

async function run() {
  console.log('🚀 Starting batch verification...\n');

  const rows = await readAllRows();
  console.log(`📊 ${rows.length} contacts to verify.\n`);

  const now = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  let dnsChecked = 0, importanceChecked = 0;

  for (let i = 0; i < rows.length; i++) {
    const contact = rowToContact(rows[i]);
    console.log(`[${i + 1}/${rows.length}] ${contact.name}`);

    // 1. Email DNS verification
    const emailResult = await verifyEmailDNS(contact.email);
    rows[i][COL.emailValid] = emailResult;
    if (emailResult !== 'No Email') {
      console.log(`  📧 Email DNS: ${emailResult}`);
      dnsChecked++;
    }

    // 2. Importance Score (only if not already scored or score is 0)
    if (!parseInt(rows[i][COL.importanceScore])) {
      const score = await calculateImportance(contact);
      rows[i][COL.importanceScore] = String(score);
      console.log(`  ⭐ Importance: ${score}`);
      importanceChecked++;
      await sleep(DELAY_MS); // Rate limiting for OpenAI
    }

    // 3. Update verification timestamp
    rows[i][COL.lastVerifiedAt] = now;
    if (rows[i][COL.verificationStatus] === 'Unknown' || !rows[i][COL.verificationStatus]) {
      rows[i][COL.verificationStatus] = 'Fresh';
    }
  }

  // Batch write back
  console.log('\n💾 Writing results to Google Sheets...');
  await writeAllRows(rows);

  console.log(`\n✅ Verification complete!`);
  console.log(`   DNS checked: ${dnsChecked}`);
  console.log(`   Importance scored: ${importanceChecked}`);
}

run().catch(e => {
  console.error('❌ Verification failed:', e);
  process.exit(1);
});
