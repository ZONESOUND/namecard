const path = require('path');
const { readAllRows, writeAllRows, COL } = require('./lib/sheets-client');

require('dotenv').config({ path: path.join(process.cwd(), '.env.local') });

// Define Tag Mapping Rules (Source -> Target)
const TAG_MAPPING = {
    "Museum": "Museum", "博物館": "Museum",
    "美術館": "Art Museum",
    "Art Venue": "Art Venue", "Art Center": "Art Center", "藝術中心": "Art Center",
    "Festival": "Festival", "藝術節": "Festival",
    "Gallery": "Gallery", "畫廊": "Gallery",
    "C-LAB": "C-LAB", "C-lab": "C-LAB", "臺灣當代文化實驗場": "C-LAB",
    "IRCAM": "IRCAM", "Ircam": "IRCAM",
    "Taicc": "TAICCA", "TAICCA": "TAICCA", "文策院": "TAICCA", "文化內容策進院": "TAICCA",
    "北藝中心": "TPAC", "TPAC": "TPAC",
    "兩廳院": "NTCH", "NTCH": "NTCH",
    "衛武營": "Weiwuying", "歌劇院": "NTT",
    "CMHK": "Contemporary Musiking Hong Kong", "現在音樂": "Contemporary Musiking Hong Kong",
    "Curator": "Curator", "策展人": "Curator", "策展": "Curator",
    "Director": "Director", "總監": "Director",
    "Admin": "Administration", "Administrator": "Administration", "行政": "Administration",
    "Producer": "Producer", "製作人": "Producer",
    "Artist": "Artist", "藝術家": "Artist",
    "教育": "Education", "Higher Education": "Education",
    "大學": "University", "University": "University",
    "Academic": "Academia", "科技": "Tech", "Technology": "Tech",
    "AI": "AI", "Artificial Intelligence": "AI",
    "藝術": "Art", "Arts": "Art", "音樂": "Music", "Music": "Music",
    "Sound Art": "Sound Art", "聲音藝術": "Sound Art",
    "New Media": "New Media", "新媒體": "New Media",
    "Government": "Government", "公部門": "Government",
    "CEO": "Executive", "Founder": "Founder",
    "Manager": "Management", "管理": "Management", "行銷": "Marketing"
};

function toTitleCase(str) {
    if (["AI", "VR", "XR", "CEO", "CTO", "CFO", "MBA", "PHD", "USA", "UK", "EU"].includes(str.toUpperCase())) {
        return str.toUpperCase();
    }
    return str.replace(/\w\S*/g, text => text.charAt(0).toUpperCase() + text.substring(1).toLowerCase());
}

async function run() {
    console.log("🚀 Starting Tag Normalization...");

    const rows = await readAllRows();
    let updateCount = 0;

    for (let i = 0; i < rows.length; i++) {
        const tagsStr = rows[i][COL.tags] || '';
        const originalTags = tagsStr.split(',').map(t => t.trim()).filter(Boolean);
        if (originalTags.length === 0) continue;

        const newTagsSet = new Set();
        for (const t of originalTags) {
            if (TAG_MAPPING[t]) {
                newTagsSet.add(TAG_MAPPING[t]);
            } else {
                newTagsSet.add(toTitleCase(t));
            }
        }

        const newTags = Array.from(newTagsSet);
        const isChanged = newTags.length !== originalTags.length || !newTags.every(t => originalTags.includes(t));

        if (isChanged) {
            console.log(`\n🏷️  Fixing tags for ${rows[i][COL.name]}:`);
            console.log(`   Old: ${originalTags.join(', ')}`);
            console.log(`   New: ${newTags.join(', ')}`);
            rows[i][COL.tags] = newTags.join(', ');
            updateCount++;
        }
    }

    if (updateCount === 0) {
        console.log("✨ All tags are already normalized!");
        return;
    }

    console.log(`\n💾 Saving updates for ${updateCount} contacts...`);
    await writeAllRows(rows);
    console.log("✨ Tag Normalization Complete!");
}

run().catch(e => {
    console.error("❌ Error:", e);
    process.exit(1);
});
