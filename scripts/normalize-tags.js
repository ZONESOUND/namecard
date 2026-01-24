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

// Define Tag Mapping Rules (Source -> Target)
// Target should be the "Canonical" tag.
const TAG_MAPPING = {
    // Education
    "教育": "Education",
    "Higher Education": "Education",
    "大學": "University",
    "Academic": "Education",
    "Academia": "Education",

    // Tech
    "科技": "Tech",
    "Technology": "Tech",
    "AI": "Artificial Intelligence",

    // Art & Culture
    "藝術": "Art",
    "Arts": "Art",
    "Culture": "Culture",
    "Cultural": "Culture",
    "文化": "Culture",
    "策展": "Curator",
    "Curating": "Curator",
    "Music": "Music",
    "音樂": "Music",

    // Business
    "Management": "Management",
    "管理": "Management",
    "Business": "Business",
    "Marketing": "Marketing",
    "行銷": "Marketing",

    // Roles
    "CEO": "Executive",
    "Founder": "Founder",
    "Manager": "Management"
};

async function run() {
    console.log("🚀 Starting Tag Normalization...");

    try {
        // 1. Fetch Data
        const res = await R2.send(new GetObjectCommand({ Bucket: BUCKET_NAME, Key: 'data/contacts.json' }));
        const str = await res.Body.transformToString();
        const contacts = JSON.parse(str);

        let updateCount = 0;
        let totalTagsFixed = 0;

        // 2. Normalize Tags
        for (const c of contacts) {
            if (!c.tags || c.tags.length === 0) continue;

            const originalTags = [...c.tags];
            const newTagsSet = new Set();

            for (const t of originalTags) {
                // Check exact match in mapping
                if (TAG_MAPPING[t]) {
                    newTagsSet.add(TAG_MAPPING[t]);
                } else {
                    // Check case-insensitive
                    const lower = t.toLowerCase();
                    // Simple normalization: Title Case
                    // const normalized = t.charAt(0).toUpperCase() + t.slice(1);
                    newTagsSet.add(t);
                }
            }

            // Re-check mapping for any newly added tags that might still need mapping (recurse if needed, but 1 level is usually enough)

            const newTags = Array.from(newTagsSet);

            // Check if changed
            const isChanged = newTags.length !== originalTags.length || !newTags.every(t => originalTags.includes(t));

            if (isChanged) {
                console.log(`\n🏷️  Fixing tags for ${c.name}:`);
                console.log(`   Old: ${originalTags.join(', ')}`);
                console.log(`   New: ${newTags.join(', ')}`);
                c.tags = newTags;
                updateCount++;
                totalTagsFixed += (originalTags.length - newTags.length); // rough metric
            }
        }

        if (updateCount === 0) {
            console.log("✨ All tags are already normalized!");
            return;
        }

        // 3. Save Back
        console.log(`\n💾 Saving updates for ${updateCount} contacts...`);
        await R2.send(new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: 'data/contacts.json',
            Body: JSON.stringify(contacts, null, 2),
            ContentType: "application/json"
        }));

        console.log("✨ Tag Normalization Complete!");

    } catch (e) {
        console.error("Error", e);
    }
}

run();
