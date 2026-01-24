const { S3Client, ListObjectsV2Command, GetObjectCommand } = require("@aws-sdk/client-s3");
const fs = require('fs/promises');
const path = require('path');
const { pipeline } = require('stream/promises');
const { createWriteStream } = require('fs');

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

async function syncDirectory(prefix, localDir) {
    console.log(`\n📥 Syncing ${prefix}...`);
    await fs.mkdir(localDir, { recursive: true });

    let isTruncated = true;
    let continuationToken = undefined;
    const remoteKeys = new Set(); // Track all remote filenames

    // 1. Download & Overwrite
    while (isTruncated) {
        const command = new ListObjectsV2Command({
            Bucket: BUCKET_NAME,
            Prefix: prefix,
            ContinuationToken: continuationToken
        });

        try {
            const res = await R2.send(command);

            if (res.Contents) {
                for (const obj of res.Contents) {
                    const key = obj.Key;
                    const fileName = path.basename(key);

                    // Skip folders
                    if (!fileName) continue;

                    remoteKeys.add(fileName); // Record as existing

                    const localPath = path.join(localDir, fileName);

                    // console.log(`  Downloading: ${fileName}`); // Reduce noise

                    const getCmd = new GetObjectCommand({ Bucket: BUCKET_NAME, Key: key });
                    const getRes = await R2.send(getCmd);

                    // Stream to file
                    await pipeline(getRes.Body, createWriteStream(localPath));
                    process.stdout.write('.'); // Progress indicator
                }
            }

            isTruncated = res.IsTruncated;
            continuationToken = res.NextContinuationToken;

        } catch (e) {
            console.error(`Error listing/downloading ${prefix}:`, e);
            break;
        }
    }
    console.log(" Done.");

    // 2. Delete Stale Local Files
    try {
        const localFiles = await fs.readdir(localDir);
        let deletedCount = 0;
        for (const file of localFiles) {
            if (!remoteKeys.has(file) && file !== '.DS_Store') {
                await fs.unlink(path.join(localDir, file));
                console.log(`  🗑️  Deleted stale file: ${file}`);
                deletedCount++;
            }
        }
        if (deletedCount > 0) console.log(`  (Cleaned up ${deletedCount} local files)`);
    } catch (e) {
        console.error("Error cleaning up local files:", e);
    }
}

async function main() {
    console.log("🚀 Starting Cloud -> Local Pull...");

    // 1. Sync data/contacts.json
    try {
        console.log("\n📥 Pulling Database...");
        const res = await R2.send(new GetObjectCommand({ Bucket: BUCKET_NAME, Key: 'data/contacts.json' }));
        const str = await res.Body.transformToString();
        await fs.mkdir(path.join(process.cwd(), 'data'), { recursive: true });
        await fs.writeFile(path.join(process.cwd(), 'data/contacts.json'), str);
        console.log("  ✅ contacts.json updated");
    } catch (e) {
        console.error("  ❌ Failed to pull contacts.json (maybe it doesn't exist yet?)", e.message);
    }

    // 2. Sync Cards/ (Markdown)
    await syncDirectory('Cards/', path.join(process.cwd(), 'Cards'));

    // 3. Sync Images/ (Optional? User might want to backup)
    // await syncDirectory('Images/', path.join(process.cwd(), 'public/images')); 
    // Commented out images for now as they might be large and user logic uses standard R2 URLs anyway.
    // If user wants local backup of images, uncomment next line:
    // await syncDirectory('Images/', path.join(process.cwd(), 'Images_Backup'));

    console.log("\n✨  Pull Complete! Local files are now in sync with Cloudflare R2.");
}

main();
