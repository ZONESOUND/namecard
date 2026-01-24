const { S3Client, GetObjectCommand, PutObjectCommand } = require("@aws-sdk/client-s3");
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
    console.log("🚀 Starting Data Standardization...");

    try {
        const res = await R2.send(new GetObjectCommand({ Bucket: BUCKET_NAME, Key: 'data/contacts.json' }));
        const str = await res.Body.transformToString();
        const contacts = JSON.parse(str);

        let updateCount = 0;

        for (const c of contacts) {
            let changed = false;
            let tags = new Set(c.tags || []);

            // Rule 1: TAICCA
            // If Company implies TAICCA, ensure tag exists and normalize company name if needed (optional, user focused on tags)
            const taiccaKeywords = ["文策院", "文化內容策進院", "Taiwan Creative Content Agency", "TAICCA"];
            if (c.company && taiccaKeywords.some(k => c.company.includes(k))) {
                if (!tags.has("TAICCA")) {
                    tags.add("TAICCA");
                    changed = true;
                    console.log(`🔹 [${c.name}] Added tag 'TAICCA' based on company '${c.company}'`);
                }
            }

            // Rule 2: CMHK
            // If Company is CMHK, update name and tag
            if (c.company === "CMHK" || c.company === "現在音樂") {
                console.log(`🔹 [${c.name}] expanding company '${c.company}' -> 'Contemporary Musiking Hong Kong'`);
                c.company = "Contemporary Musiking Hong Kong";
                tags.add("Contemporary Musiking Hong Kong");
                changed = true;
            }

            if (changed) {
                c.tags = Array.from(tags);
                updateCount++;
            }
        }

        if (updateCount === 0) {
            console.log("✨ No special standardizations needed.");
        } else {
            console.log(`\n💾 Saving updates for ${updateCount} contacts...`);
            await R2.send(new PutObjectCommand({
                Bucket: BUCKET_NAME,
                Key: 'data/contacts.json',
                Body: JSON.stringify(contacts, null, 2),
                ContentType: "application/json"
            }));
            console.log("✨ Standardization Complete!");
        }

    } catch (e) {
        console.error("Error", e);
    }
}

run();
