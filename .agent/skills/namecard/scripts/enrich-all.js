const OpenAI = require('openai');
const path = require('path');
const { readAllRows, writeAllRows, rowToContact, contactToRow, COL } = require('./lib/sheets-client');

require('dotenv').config({ path: path.join(process.cwd(), '.env.local') });

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

async function enrichContacts() {
    const rows = await readAllRows();
    const contacts = rows.map(rowToContact);

    console.log(`Starting enrichment for ${contacts.length} contacts...`);
    let updatedCount = 0;

    for (let i = 0; i < contacts.length; i++) {
        const c = contacts[i];

        // Only process if summary is missing
        if (c.aiSummary && c.aiSummary.length > 50) continue;

        console.log(`Enriching: ${c.name} @ ${c.company}...`);

        try {
            const prompt = `You are a research assistant.
            1. Provide a brief professional background summary (in Traditional Chinese 繁體中文) for the following person and their organization.
            2. Suggest up to 5 relevant tags (in English or Traditional Chinese) for categorization.

            Name: ${c.name}
            Title: ${c.title}
            Company: ${c.company}
            Email: ${c.email}

            Rules:
            - Summary: Focus on professional field, expertise, and organization's role. Keep it concise (2-4 sentences).
            - Tags: Return a JSON array of strings for tags. Do not duplicate existing tags if possible, but prioritize accuracy.
            - Output Format: JSON object with keys "summary" and "tags".
            `;

            const response = await openai.chat.completions.create({
                model: "gpt-4o",
                messages: [{ role: "user", content: prompt }],
                response_format: { type: "json_object" },
                max_tokens: 500,
            });

            const result = JSON.parse(response.choices[0].message.content);

            if (result.summary) {
                rows[i][COL.aiSummary] = result.summary;
            }

            if (result.tags && Array.isArray(result.tags)) {
                const currentTags = new Set(c.tags || []);
                result.tags.forEach(t => currentTags.add(t));
                rows[i][COL.tags] = Array.from(currentTags).join(', ');
            }

            updatedCount++;
            console.log(`  ✅ Done: ${c.name}`);
        } catch (err) {
            console.error(`  ❌ Error enriching ${c.name}:`, err.message);
        }
    }

    if (updatedCount > 0) {
        await writeAllRows(rows);
        console.log(`\n💾 Saved updates for ${updatedCount} contacts to Google Sheets.`);
    } else {
        console.log('✨ No contacts needed enrichment.');
    }
}

enrichContacts().catch(e => {
    console.error('❌ Enrichment failed:', e);
    process.exit(1);
});
