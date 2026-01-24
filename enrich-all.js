import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

async function enrichContacts() {
    const contactsPath = './data/contacts.json';
    const contacts = JSON.parse(fs.readFileSync(contactsPath, 'utf8'));

    console.log(`Starting enrichment for ${contacts.length} contacts...`);

    for (let i = 0; i < contacts.length; i++) {
        const c = contacts[i];

        // Skip if already has a substantial AI summary (unless looking to update)
        // We'll update the ones that have null or very short summaries.
        if (c.aiSummary && c.aiSummary.length > 50 && c.name !== '郭文華 (Wen-Hua Kuo)') continue;

        console.log(`Enriching: ${c.name} @ ${c.company}...`);

        try {
            const prompt = `You are a research assistant. Provide a brief professional background summary (in Traditional Chinese 繁體中文) for the following person and their organization. 
            Name: ${c.name}
            Title: ${c.title}
            Company: ${c.company}
            Email: ${c.email}

            Rules:
            1. Focus on their professional field, expertise, and the organization's role in the industry.
            2. If the person is hard to find, focus exclusively on the organization's background.
            3. For universities (like NYCU), mention their academic strengths.
            4. Keep it concise (2-4 sentences).
            5. Return ONLY the summary text. No preamble.`;

            const response = await openai.chat.completions.create({
                model: "gpt-4o",
                messages: [{ role: "user", content: prompt }],
                max_tokens: 300,
            });

            const summary = response.choices[0].message.content.trim();
            c.aiSummary = summary;

            // Special fix for tags and names during this pass
            if (c.email === 'whkuo@nycu.edu.tw') {
                c.name = "郭文華 (Wen-Hua Kuo)";
                c.company = "國立陽明交通大學 (NYCU)";
                if (!c.tags.includes('科技發明與社會')) c.tags.push('科技發明與社會');
                if (!c.tags.includes('Taiwan')) c.tags.push('Taiwan');
            }

            console.log(`Done: ${c.name}`);
        } catch (err) {
            console.error(`Error enriching ${c.name}:`, err.message);
        }
    }

    fs.writeFileSync(contactsPath, JSON.stringify(contacts, null, 2));
    console.log('Finished enrichment. Regenerating Markdown files...');

    // Regenerate MDs
    const storage = require('./lib/storage.js');
    await storage.regenerateAllMarkdown();
    console.log('All clear.');
}

enrichContacts();
