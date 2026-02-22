const path = require('path');
const { readAllRows, writeAllRows, rowToContact, contactToRow, COL } = require('./lib/sheets-client');

require('dotenv').config({ path: path.join(process.cwd(), '.env.local') });

async function run() {
    console.log("🚀 Starting Deduplication (Google Sheets)...");

    const rows = await readAllRows();
    const contacts = rows.map(rowToContact);
    console.log(`\n📊 Analyzing ${contacts.length} contacts...`);

    const map = new Map();

    for (const c of contacts) {
        let key = null;
        if (c.email && c.email.length > 3) {
            key = `email:${c.email.trim().toLowerCase()}`;
        } else {
            key = `nc:${c.name?.trim().toLowerCase()}|${c.company?.trim().toLowerCase()}`;
        }

        if (!map.has(key)) {
            map.set(key, [c]);
        } else {
            map.get(key).push(c);
        }
    }

    const survivors = [];
    let duplicatesCount = 0;

    for (const [key, group] of map.entries()) {
        if (group.length === 1) {
            survivors.push(group[0]);
            continue;
        }

        console.log(`\n🔄 Merging ${group.length} records for key: ${key}`);

        // Sort by timestamp (newest first)
        group.sort((a, b) => new Date(b.updatedAt || b.addedAt || 0) - new Date(a.updatedAt || a.addedAt || 0));

        const survivor = group[0];
        const others = group.slice(1);

        for (const other of others) {
            duplicatesCount++;
            console.log(`   ❌ Marking as duplicate: ${other.name} (ID: ${other.id})`);

            const otherHasEng = /[a-zA-Z]/.test(other.name);
            const survivorHasEng = /[a-zA-Z]/.test(survivor.name);
            if (otherHasEng && !survivorHasEng) {
                survivor.name = other.name;
            }

            if (!survivor.imageUrl && other.imageUrl) survivor.imageUrl = other.imageUrl;
            if (!survivor.notes && other.notes) survivor.notes = other.notes;
            if (!survivor.metAt && other.metAt) survivor.metAt = other.metAt;
            if (!survivor.title && other.title) survivor.title = other.title;

            const tagSet = new Set(survivor.tags || []);
            (other.tags || []).forEach(t => tagSet.add(t));
            survivor.tags = Array.from(tagSet);
        }

        survivors.push(survivor);
    }

    if (duplicatesCount === 0) {
        console.log("✨ No duplicates found!");
        return;
    }

    console.log(`\n💾 Saving cleaned database (${survivors.length} contacts, removed ${duplicatesCount} duplicates)...`);
    const newRows = survivors.map(contactToRow);
    await writeAllRows(newRows);
    console.log("✨ Deduplication Complete!");
}

run().catch(e => {
    console.error("❌ Error:", e);
    process.exit(1);
});
