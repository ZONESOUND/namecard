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

        // Group by unique key (Name + Email + Company)
        for (const c of contacts) {
            const key = `${c.name?.trim().toLowerCase()}|${c.email?.trim().toLowerCase()}|${c.company?.trim().toLowerCase()}`;

            if (map.has(key)) {
                // Determine which one to keep? 
                // Keep the one with more fields filled, or the latest one.
                // Assuming multi-click duplicates are mostly identical or very close in time.
                // Let's keep the OLDER one to avoid breaking existing links? 
                // Actually usually we keep the NEWEST one in updates, but for pure duplicates it doesn't matter.
                const existing = map.get(key);

                // Compare modification times if available, or just keep first found
                // We'll mark the current 'c' as duplicate and keep 'existing'
                duplicates.push(c);
            } else {
                map.set(key, c);
            }
        }

        if (duplicates.length === 0) {
            console.log("✅ No duplicates found!");
            return;
        }

        console.log(`⚠️  Found ${duplicates.length} duplicates. cleaning up...`);

        // 2. Identify Survivors
        const survivors = Array.from(map.values());

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
