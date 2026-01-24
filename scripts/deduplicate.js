const { S3Client, ListObjectsV2Command, GetObjectCommand, PutObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");
const path = require('path');

// Load environment variables manually if not using dotenv-cli
require('dotenv').config({ path: '.env.local' });

// --- CONFIG ---
if (!process.env.R2_ACCOUNT_ID || !process.env.R2_BUCKET_NAME) {
    console.error("❌ R2 Credentials missing in .env.local");
    process.exit(1);
}

const R2 = new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
});

const BUCKET_NAME = process.env.R2_BUCKET_NAME;

async function run() {
    console.log("🚀 Starting Cloud Deduplication...");

    // 1. Fetch entire database
    try {
        const res = await R2.send(new GetObjectCommand({ Bucket: BUCKET_NAME, Key: 'data/contacts.json' }));
        const str = await res.Body.transformToString();
        const contacts = JSON.parse(str);

        console.log(`\n📊 Analyzing ${contacts.length} contacts...`);

        const map = new Map();
        const duplicates = [];

        // Group by unique key
        // Strategy: 
        // 1. Primary Key: Email (if exists) -> "email:xxxx@xxx.com"
        // 2. Fallback Key: Name|Company -> "nc:name|company"

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

            // Multiple records found for this key. Smart Merge.
            console.log(`\n🔄 Merging ${group.length} records for key: ${key}`);
            const names = group.map(g => g.name).join(', ');
            console.log(`   Names involved: ${names}`);

            // Sort by timestamp (newest first)
            group.sort((a, b) => {
                const dateA = new Date(a.updatedAt || a.addedAt || 0);
                const dateB = new Date(b.updatedAt || b.addedAt || 0);
                return dateB - dateA; // Descending (Newest first)
            });

            const survivor = group[0];
            const others = group.slice(1);

            // Merge valuable data form older records
            // Merge valuable data form older records
            for (const other of others) {
                duplicates.push(other);
                duplicatesCount++;
                console.log(`   ❌ Marking as duplicate: ${other.name} (ID: ${other.id})`);

                // 1. Name Enrichment (If older record has better name, e.g. "Name (EnName)")
                // Check if other name has parens and survivor doesn't, or if other name is significantly longer
                const otherHasEng = /[a-zA-Z]/.test(other.name);
                const survivorHasEng = /[a-zA-Z]/.test(survivor.name);

                if (otherHasEng && !survivorHasEng) {
                    console.log(`     -> Updating name to richer version: ${other.name}`);
                    survivor.name = other.name;
                }

                if (!survivor.imageUrl && other.imageUrl) survivor.imageUrl = other.imageUrl;
                if (!survivor.notes && other.notes) survivor.notes = other.notes;
                if (!survivor.metAt && other.metAt) survivor.metAt = other.metAt;
                // Don't overwrite title if survivor has one, as survivor is newer.
                if (!survivor.title && other.title) survivor.title = other.title;

                // Merge tags
                const tagSet = new Set(survivor.tags || []);
                (other.tags || []).forEach(t => tagSet.add(t));
                survivor.tags = Array.from(tagSet);
            }

            survivors.push(survivor);
        }

        // 3. Delete Duplicate .md files
        for (const dup of duplicates) {
            const safeName = dup.name.trim().replace(/[\\/:"*?<>|]+/g, '_');
            const mdKey = `Cards/${safeName}.md`;

            // CRITICAL: Only delete if the survivor has a DIFFERENT name.
            // If name is same, the survivor overwrites it, so NO delete needed (and delete would be dangerous).

            // Find survivor for this duplicate
            const sKey = dup.email && dup.email.length > 3
                ? `email:${dup.email.trim().toLowerCase()}`
                : `nc:${dup.name?.trim().toLowerCase()}|${dup.company?.trim().toLowerCase()}`;

            let survivor = null;
            if (map.has(sKey)) {
                // The group was sorted, so survivor is index 0
                survivor = map.get(sKey)[0];
            }

            if (survivor && survivor.name !== dup.name) {
                console.log(`  🗑️  Deleting duplicate file in R2: ${mdKey} (Survivor is ${survivor.name})`);
                try {
                    await R2.send(new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: mdKey }));
                } catch (e) {
                    console.error(`     Failed to delete ${mdKey}`, e.message);
                }
            } else {
                console.log(`  Skipping file delete for ${dup.name} (Same name as survivor or survivor not found)`);
            }
        }


        // 4. Update JSON in R2
        console.log(`\n💾 Saving cleaned database (${survivors.length} contacts)...`);

        await R2.send(new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: 'data/contacts.json',
            Body: JSON.stringify(survivors, null, 2),
            ContentType: "application/json"
        }));

        console.log("✨ Deduplication Complete! Cloud database is clean.");

    } catch (e) {
        console.error("❌ Error:", e);
    }
}

run();
