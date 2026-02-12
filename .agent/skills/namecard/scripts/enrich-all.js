const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(process.cwd(), '.env.local') });

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

async function enrichContacts() {
    const contactsPath = path.join(process.cwd(), 'data/contacts.json');

    if (!fs.existsSync(contactsPath)) {
        console.error("Contacts file not found at " + contactsPath);
        process.exit(1);
    }

    const contacts = JSON.parse(fs.readFileSync(contactsPath, 'utf8'));

    console.log(`Starting enrichment for ${contacts.length} contacts...`);
    let updatedCount = 0;

    for (let i = 0; i < contacts.length; i++) {
        const c = contacts[i];

        // Only process if summary is missing or user requested specific update
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
                c.aiSummary = result.summary;
            }

            if (result.tags && Array.isArray(result.tags)) {
                // Merge tags
                const currentTags = new Set(c.tags || []);
                result.tags.forEach(t => currentTags.add(t));
                c.tags = Array.from(currentTags);
            }

            updatedCount++;
            console.log(`  ✅ Done: ${c.name}`);
        } catch (err) {
            console.error(`  ❌ Error enriching ${c.name}:`, err.message);
        }
    }

    if (updatedCount > 0) {
        fs.writeFileSync(contactsPath, JSON.stringify(contacts, null, 2));
        console.log(`\n💾 Saved updates for ${updatedCount} contacts.`);

        // Note: We are NOT calling regenerateAllMarkdown here because that logic resides in lib/storage.js 
        // which is part of the Next.js app, not this standalone script.
        // To update markdown files, the user should run 'npm run pull' or force a regeneration if available.
        console.log('⚠️  Please run the app or a separate markdown syncer to update .md files.');
    } else {
        console.log('✨ No contacts needed enrichment.');
    }
}

enrichContacts();
