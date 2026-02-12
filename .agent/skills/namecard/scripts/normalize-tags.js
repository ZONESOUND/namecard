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
    // --- VENUES & INSTITUTIONS ---
    "Museum": "Museum",
    "博物館": "Museum",
    "美術館": "Art Museum",
    "Art Venue": "Art Venue",
    "Art Center": "Art Center",
    "藝術中心": "Art Center",
    "Festival": "Festival",
    "藝術節": "Festival",
    "Gallery": "Gallery",
    "畫廊": "Gallery",
    "C-LAB": "C-LAB",
    "C-lab": "C-LAB",
    "臺灣當代文化實驗場": "C-LAB",
    "IRCAM": "IRCAM",
    "Ircam": "IRCAM",
    "Taicc": "TAICCA",
    "TAICCA": "TAICCA",
    "文策院": "TAICCA",
    "文化內容策進院": "TAICCA",
    "北藝中心": "TPAC",
    "TPAC": "TPAC",
    "兩廳院": "NTCH",
    "NTCH": "NTCH",
    "衛武營": "Weiwuying",
    "歌劇院": "NTT",
    "CMHK": "Contemporary Musiking Hong Kong",
    "現在音樂": "Contemporary Musiking Hong Kong",

    // --- ROLES ---
    "Curator": "Curator",
    "策展人": "Curator",
    "策展": "Curator",
    "Director": "Director",
    "總監": "Director",
    "Admin": "Administration",
    "Administrator": "Administration",
    "行政": "Administration",
    "Producer": "Producer",
    "製作人": "Producer",
    "Artist": "Artist",
    "藝術家": "Artist",

    // --- SECTORS ---
    "教育": "Education",
    "Higher Education": "Education",
    "大學": "University",
    "University": "University",
    "Academic": "Academia",
    "科技": "Tech",
    "Technology": "Tech",
    "AI": "AI",
    "Artificial Intelligence": "AI",
    "藝術": "Art",
    "Arts": "Art",
    "音樂": "Music",
    "Music": "Music",
    "Sound Art": "Sound Art",
    "聲音藝術": "Sound Art",
    "New Media": "New Media",
    "新媒體": "New Media",
    "Government": "Government",
    "公部門": "Government",

    // --- BUSINESS ---
    "CEO": "Executive",
    "Founder": "Founder",
    "Manager": "Management",
    "管理": "Management",
    "行銷": "Marketing"
};

// Helper: Convert to Title Case (Pascal Case-like for tags)
// e.g. "higher education" -> "Higher Education", "art" -> "Art"
function toTitleCase(str) {
    // Handle special acronyms
    if (["AI", "VR", "XR", "CEO", "CTO", "CFO", "MBA", "PHD", "USA", "UK", "EU"].includes(str.toUpperCase())) {
        return str.toUpperCase();
    }
    return str.replace(
        /\w\S*/g,
        text => text.charAt(0).toUpperCase() + text.substring(1).toLowerCase()
    );
}

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
                } else if (TAG_MAPPING[t.toLowerCase()]) { // Check normalized source key? No, mapping keys are source.
                    // Actually, keys in mapping are mixed.
                    // Let's just normalize 't' to Title Case if not mapped.
                    newTagsSet.add(toTitleCase(t));
                } else {
                    // Normalize to Title Case
                    newTagsSet.add(toTitleCase(t));
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
