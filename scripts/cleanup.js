const { S3Client, ListObjectsV2Command, DeleteObjectCommand, GetObjectCommand, PutObjectCommand } = require("@aws-sdk/client-s3");
const fs = require('fs/promises');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

// --- CONFIG ---
const USE_R2 = process.env.R2_ACCOUNT_ID && process.env.R2_BUCKET_NAME;
const BUCKET_NAME = process.env.R2_BUCKET_NAME;

const R2 = USE_R2 ? new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
}) : null;

// Helper to generate filename from name (Must match lib/storage.js logic EXACTLY)
function getSafeFileName(name) {
    return name.trim().replace(/[\\/:"*?<>|]+/g, '_') + '.md';
}

async function cleanup() {
    console.log("🧹 Starting Cleanup (Orphan Removal)...");

    // 1. Get Source of Truth (Database)
    let contacts = [];
    if (USE_R2) {
        try {
            const res = await R2.send(new GetObjectCommand({ Bucket: BUCKET_NAME, Key: 'data/contacts.json' }));
            const str = await res.Body.transformToString();
            contacts = JSON.parse(str);
        } catch (e) {
            console.error("❌ Failed to read database from R2:", e);
            return;
        }
    } else {
        const str = await fs.readFile(path.join(process.cwd(), 'data/contacts.json'), 'utf-8');
        contacts = JSON.parse(str);
    }

    console.log(`✅ Loaded ${contacts.length} active contacts from database.`);

    // 2. Identify Valid Files
    const validFiles = new Set(contacts.map(c => getSafeFileName(c.name)));

    // 3. Clean R2
    if (USE_R2) {
        console.log("\n☁️  Checking Cloudflare R2...");
        try {
            let isTruncated = true;
            let continuationToken = undefined;
            while (isTruncated) {
                const listCmd = new ListObjectsV2Command({
                    Bucket: BUCKET_NAME,
                    Prefix: 'Cards/',
                    ContinuationToken: continuationToken
                });
                const res = await R2.send(listCmd);

                if (res.Contents) {
                    for (const obj of res.Contents) {
                        const fileName = obj.Key.replace('Cards/', '');
                        if (fileName === '' || fileName === '.DS_Store') continue; // Skip folders/junk

                        if (!validFiles.has(fileName)) {
                            console.log(`🗑️  Deleting orphan in R2: ${obj.Key}`);
                            await R2.send(new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: obj.Key }));
                        }
                    }
                }
                isTruncated = res.IsTruncated;
                continuationToken = res.NextContinuationToken;
            }
        } catch (e) {
            console.error("Error cleaning R2:", e);
        }
    }

    // 4. Clean Valid Files (Rename check) logic is implicit: if name changed, old name is orphan

    // 5. Clean Local (Just in case)
    console.log("\n💻 Checking Local Disk...");
    try {
        const localFiles = await fs.readdir(path.join(process.cwd(), 'Cards'));
        for (const file of localFiles) {
            if (!file.endsWith('.md')) continue;

            if (!validFiles.has(file)) {
                console.log(`🗑️  Deleting local orphan: ${file}`);
                await fs.unlink(path.join(process.cwd(), 'Cards', file));
            }
        }
    } catch (e) {
        console.error("Error cleaning local files:", e);
    }

    console.log("\n✨ Cleanup Complete! All files are now synced with JSON database.");
}

cleanup();
