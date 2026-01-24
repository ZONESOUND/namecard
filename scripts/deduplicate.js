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

        for (const [key, group] of map.entries()) {
            if (group.length === 1) {
                survivors.push(group[0]);
                continue;
            }

            // Multiple records found for this key. Smart Merge.
            console.log(`\n🔄 Merging ${group.length} records for key: ${key}`);

            // Sort by timestamp (newest first)
            // If updatedAt is missing, fall back to addedAt, then current time
            group.sort((a, b) => {
                const dateA = new Date(a.updatedAt || a.addedAt || 0);
                const dateB = new Date(b.updatedAt || b.addedAt || 0);
                return dateB - dateA; // Descending (Newest first)
            });

            const survivor = group[0]; // This is the newest one (so user's latest edit wins)
            const others = group.slice(1);

            // Merge valuable data from older records if missing in survivor
            for (const other of others) {
                duplicates.push(other); // Mark for deletion

                if (!survivor.imageUrl && other.imageUrl) survivor.imageUrl = other.imageUrl;
                if (!survivor.notes && other.notes) survivor.notes = other.notes;
                if (!survivor.metAt && other.metAt) survivor.metAt = other.metAt;
                if (!survivor.title && other.title) survivor.title = other.title;
                if (!survivor.tags) survivor.tags = [];
                if (other.tags) {
                    survivor.tags = [...new Set([...survivor.tags, ...other.tags])];
                }
            }

            survivors.push(survivor);
        }

        // 3. Delete Duplicate .md files
        for (const dup of duplicates) {
            const safeName = dup.name.trim().replace(/[\\/:"*?<>|]+/g, '_');
            const mdKey = `Cards/${safeName}.md`;

            // Check if survivor uses the same mdKey (likely), if so, DON'T delete it!
            const survivor = map.get(`${dup.name?.trim().toLowerCase()}|${dup.email?.trim().toLowerCase()}|${dup.company?.trim().toLowerCase()}`);

            // If the ID is different but the name is same, the MD file overwrites each other anyway.
            // But we should check if the ID is different.

            console.log(`  Deleting duplicate record: ${dup.name} (ID: ${dup.id.substr(0, 8)}...)`);

            // Note: We don't delete MD files because multiple IDs might map to same Name.md 
            // (The system overwrites MD based on Name). 
            // So if we delete the MD, the survivor might lose its file.
            // Since we are keeping one survivor, we just need to ensure the JSON is clean.
            // The survivor will just own the MD file.
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
