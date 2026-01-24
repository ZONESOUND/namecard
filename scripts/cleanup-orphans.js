const { S3Client, ListObjectsV2Command, DeleteObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3");
const path = require('path');

// Load environment variables manually
require('dotenv').config({ path: '.env.local' });

if (!process.env.R2_ACCOUNT_ID || !process.env.R2_BUCKET_NAME) {
    console.error("❌ R2 Credentials missing");
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
    console.log("🚀 Starting Cloud Orphan Cleanup...");

    // 1. Get Source of Truth (JSON)
    const res = await R2.send(new GetObjectCommand({ Bucket: BUCKET_NAME, Key: 'data/contacts.json' }));
    const str = await res.Body.transformToString();
    const contacts = JSON.parse(str);

    // Create a Set of "Valid" MD filenames
    const validFilenames = new Set();
    contacts.forEach(c => {
        const safeName = c.name.trim().replace(/[\\/:"*?<>|]+/g, '_');
        validFilenames.add(`${safeName}.md`);
    });

    console.log(`✅ Index contains ${validFilenames.size} valid cards.`);

    // 2. Scan R2 Cards/ directory
    let isTruncated = true;
    let continuationToken = undefined;
    const filesToDelete = [];

    console.log("🔍 Scanning R2 bucket for files...");

    while (isTruncated) {
        const command = new ListObjectsV2Command({
            Bucket: BUCKET_NAME,
            Prefix: 'Cards/',
            ContinuationToken: continuationToken
        });

        const listRes = await R2.send(command);

        if (listRes.Contents) {
            for (const obj of listRes.Contents) {
                const fileName = path.basename(obj.Key);
                if (!fileName) continue; // Skip split

                // Check if this file is in our valid set
                if (!validFilenames.has(fileName)) {
                    console.log(`Snapshot: Found Orphan -> ${fileName}`);
                    filesToDelete.push(obj.Key); // Store full key
                }
            }
        }
        isTruncated = listRes.IsTruncated;
        continuationToken = listRes.NextContinuationToken;
    }

    // 3. Delete Orphans
    if (filesToDelete.length === 0) {
        console.log("✨ No orphaned files found. Bucket is clean.");
        return;
    }

    console.log(`\n🗑️  Found ${filesToDelete.length} orphaned files. Deleting...`);

    for (const key of filesToDelete) {
        try {
            await R2.send(new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: key }));
            console.log(`  Deleted: ${key}`);
        } catch (e) {
            console.error(`  Failed to delete ${key}`, e.message);
        }
    }

    console.log("\n✨ Cleanup Complete!");
}

run();
