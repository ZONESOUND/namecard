const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const fs = require('fs/promises');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

// Setup R2 Client
const R2 = new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
});

const BUCKET_NAME = process.env.R2_BUCKET_NAME;

async function uploadFile(localPath, r2Key, contentType) {
    try {
        const content = await fs.readFile(localPath);
        await R2.send(new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: r2Key,
            Body: content,
            ContentType: contentType
        }));
        console.log(`✅ Uploaded: ${r2Key}`);
    } catch (e) {
        if (e.code === 'ENOENT') {
            console.log(`⚠️ Check skipping: ${localPath} not found.`);
        } else {
            console.error(`❌ Failed: ${r2Key}`, e.message);
        }
    }
}

async function migrate() {
    console.log("🚀 Starting migration to Cloudflare R2...");
    console.log(`   Bucket: ${BUCKET_NAME}`);

    // 1. Upload Database
    await uploadFile(path.join(process.cwd(), 'data/contacts.json'), 'data/contacts.json', 'application/json');

    // 2. Upload Cards
    const cardsDir = path.join(process.cwd(), 'Cards');
    try {
        const files = await fs.readdir(cardsDir);
        for (const file of files) {
            if (file.endsWith('.md')) {
                await uploadFile(path.join(cardsDir, file), `Cards/${file}`, 'text/markdown');
            }
        }
    } catch (e) {
        console.log("No Cards directory found or empty.");
    }

    console.log("\n✨ Migration complete!");
}

migrate();
