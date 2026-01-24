import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import fs from 'fs/promises';
import path from 'path';

// --- CONFIGURATION ---
const USE_R2 = process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && process.env.R2_BUCKET_NAME;

// R2 Client Setup
const R2 = USE_R2 ? new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
}) : null;

const BUCKET_NAME = process.env.R2_BUCKET_NAME;

// Local Fallback Paths
const DATA_DIR = path.join(process.cwd(), 'data');
const CARDS_DIR = path.join(process.cwd(), 'Cards');
const DB_FILE = 'data/contacts.json'; // Relative path for R2 keys

// --- HELPER: Ensure Local Dirs ---
async function ensureLocalDirs() {
    if (!USE_R2) {
        await fs.mkdir(DATA_DIR, { recursive: true });
        await fs.mkdir(CARDS_DIR, { recursive: true });
    }
}

// --- IMAGE HANDLING ---
export async function uploadImage(buffer, key, contentType) {
    if (USE_R2) {
        await R2.send(new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key,
            Body: buffer,
            ContentType: contentType
        }));
        return key; // Return the key (path)
    } else {
        // Local Fallback (Not implemented for now, or just save to public?)
        // Let's essentially skip local image save for simplicity or mock it
        return null;
    }
}

export async function getR2Stream(key) {
    if (!USE_R2) return null;
    try {
        const res = await R2.send(new GetObjectCommand({ Bucket: BUCKET_NAME, Key: key }));
        return { stream: res.Body, contentType: res.ContentType };
    } catch (e) {
        return null;
    }
}

// --- CORE FUNCTIONS (Unified API) ---

// 1. READ ALL CONTACTS
export async function getContacts() {
    if (USE_R2) {
        try {
            const command = new GetObjectCommand({
                Bucket: BUCKET_NAME,
                Key: DB_FILE,
            });
            const response = await R2.send(command);
            const str = await response.Body.transformToString();
            return JSON.parse(str);
        } catch (error) {
            // NoSuchKey is expected on first run
            if (error.name === 'NoSuchKey') {
                await saveContactsToStorage([]); // Init empty
                return [];
            }
            console.error("R2 Read Error:", error);
            throw error;
        }
    } else {
        // Local Fallback
        await ensureLocalDirs();
        try {
            const data = await fs.readFile(path.join(process.cwd(), DB_FILE), 'utf-8');
            return JSON.parse(data);
        } catch (error) {
            if (error.code === 'ENOENT') {
                return [];
            }
            throw error;
        }
    }
}

// Internal Helper to save the full contacts array
async function saveContactsToStorage(contacts) {
    const jsonString = JSON.stringify(contacts, null, 2);

    if (USE_R2) {
        // Save JSON to R2
        await R2.send(new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: DB_FILE,
            Body: jsonString,
            ContentType: "application/json"
        }));
    } else {
        // Save JSON Locally
        await ensureLocalDirs();
        await fs.writeFile(path.join(process.cwd(), DB_FILE), jsonString);
    }
}

// 2. GENERATE MARKDOWN (Pure utility, no I/O)
function generateMarkdown(contact) {
    const frontmatter = [
        '---',
        `id: "${contact.id}"`,
        `name: "${contact.name}"`,
        `title: "${contact.title || ''}"`,
        `company: "${contact.company || ''}"`,
        `email: "${contact.email || ''}"`,
        `phone: "${contact.phone || ''}"`,
        `tags: [${(contact.tags || []).map(t => `"${t}"`).join(', ')}]`,
        `met_at: "${contact.metAt || ''}"`,
        `added_at: "${contact.addedAt}"`,
        `image_url: "${contact.imageUrl || ''}"`,
        `importance_score: ${contact.importanceScore || 0}`,
        '---',
        '',
        `# ${contact.name}`,
        '',
        contact.imageUrl ? `![Card Image](${contact.imageUrl})` : '',
        '',
        `**${contact.title}** @ ${contact.company}`,
        '',
        '## Relationship Context',
        `- Met At: ${contact.metAt || 'Not specified'}`,
        '',
        '## Contact Details',
        `- Email: ${contact.email || 'N/A'}`,
        `- Phone: ${contact.phone || 'N/A'}`,
        `- Website: ${contact.website || 'N/A'}`,
        `- Address: ${contact.address || 'N/A'}`,
        '',
        '## AI Summary',
        contact.aiSummary || 'No summary generated yet.',
        '',
        '## Notes',
        contact.notes || '',
        '',
        '## Career History',
        ...(contact.history || []).map(h => `- ${h.title} @ ${h.company} (${h.date || 'Past'})`),
        ''
    ].join('\n');

    return frontmatter;
}

// 3. SAVE SINGLE CONTACT (Updates JSON + Writes Markdown)
export async function saveContact(contact) {
    const contacts = await getContacts();

    // Update or Add to Array
    const index = contacts.findIndex(c => c.id === contact.id);
    if (index >= 0) {
        const existing = contacts[index];
        let history = existing.history || [];

        if (contact.jobStatus === 'history' && contact.title !== existing.title) {
            history.push({
                title: existing.title,
                company: existing.company,
                date: existing.updatedAt || existing.addedAt
            });
        }

        let currentTitle = contact.title;
        let currentCompany = contact.company;
        if (contact.jobStatus === 'concurrent' && contact.title !== existing.title) {
            currentTitle = `${existing.title} & ${contact.title}`;
            if (existing.company !== contact.company) {
                currentCompany = `${existing.company} / ${contact.company}`;
            }
        }

        contacts[index] = {
            ...existing,
            ...contact,
            title: currentTitle,
            company: currentCompany,
            history,
            updatedAt: new Date().toISOString()
        };
    } else {
        contacts.push({
            ...contact,
            history: [],
            tags: contact.tags || [],
            id: contact.id || crypto.randomUUID(),
            addedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });
    }

    // A. Perform Write (JSON)
    await saveContactsToStorage(contacts);

    // B. Perform Write (Markdown)
    const targetContact = contacts[index >= 0 ? index : contacts.length - 1];
    const safeName = targetContact.name.trim().replace(/[\\/:"*?<>|]+/g, '_');
    const mdContent = generateMarkdown(targetContact);
    const mdKey = `Cards/${safeName}.md`;

    if (USE_R2) {
        await R2.send(new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: mdKey,
            Body: mdContent,
            ContentType: "text/markdown"
        }));
    } else {
        await fs.writeFile(path.join(CARDS_DIR, `${safeName}.md`), mdContent);
    }

    return targetContact;
}

// 4. UPDATE CONTACT (Partial Update)
export async function updateContact(id, updates) {
    const contacts = await getContacts();
    const index = contacts.findIndex(c => c.id === id);

    if (index === -1) return null;

    const originalContact = contacts[index]; // Capture state before update

    const updatedContact = {
        ...originalContact,
        ...updates,
        updatedAt: new Date().toISOString()
    };

    contacts[index] = updatedContact;

    // A. Write JSON
    await saveContactsToStorage(contacts);

    // B. Handle File Rename (Delete old file if name changed)
    if (originalContact.name !== updatedContact.name) {
        const oldSafeName = originalContact.name.trim().replace(/[\\/:"*?<>|]+/g, '_');
        const oldKey = `Cards/${oldSafeName}.md`;

        if (USE_R2) {
            try { await R2.send(new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: oldKey })); } catch (e) { }
        } else {
            try { await fs.unlink(path.join(CARDS_DIR, `${oldSafeName}.md`)); } catch (e) { }
        }
    }

    // C. Write New Markdown
    const safeName = updatedContact.name.trim().replace(/[\\/:"*?<>|]+/g, '_');
    const mdContent = generateMarkdown(updatedContact);
    const mdKey = `Cards/${safeName}.md`;

    if (USE_R2) {
        await R2.send(new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: mdKey,
            Body: mdContent,
            ContentType: "text/markdown"
        }));
    } else {
        await fs.writeFile(path.join(CARDS_DIR, `${safeName}.md`), mdContent);
    }

    return updatedContact;
}

// 5. DELETE CONTACT
export async function deleteContact(id) {
    const contacts = await getContacts();
    const contact = contacts.find(c => c.id === id);
    if (!contact) return;

    const newContacts = contacts.filter(c => c.id !== id);
    await saveContactsToStorage(newContacts);

    // Remove Markdown
    const safeName = contact.name.trim().replace(/[\\/:"*?<>|]+/g, '_');
    const oldSafeName = contact.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();

    if (USE_R2) {
        // Try Delete New Name
        try {
            await R2.send(new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: `Cards/${safeName}.md` }));
        } catch (e) { }
        // Try Delete Old Name (cleanup legacy)
        try {
            await R2.send(new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: `Cards/${oldSafeName}.md` }));
        } catch (e) { }
    } else {
        try { await fs.unlink(path.join(CARDS_DIR, `${safeName}.md`)); } catch (e) { }
        try { await fs.unlink(path.join(CARDS_DIR, `${oldSafeName}.md`)); } catch (e) { }
    }

    return newContacts;
}

// 6. FIND DUPLICATE
export async function findDuplicate(contact) {
    const contacts = await getContacts();

    return contacts.find(c => {
        if (contact.email && c.email && c.email.toLowerCase() === contact.email.toLowerCase()) return true;

        if (contact.phone && c.phone) {
            const p1 = contact.phone.replace(/\D/g, '');
            const p2 = c.phone.replace(/\D/g, '');
            if (p1.length > 7 && p1 === p2) return true;
        }

        if (contact.name && c.name) {
            const n1 = contact.name.toLowerCase().trim();
            const n2 = c.name.toLowerCase().trim();
            if (n1 === n2) return true;
            if (n1.length > 1 && n2.length > 1 && (n1.includes(n2) || n2.includes(n1))) return true;
        }

        if (contact.company && c.company && contact.company === c.company &&
            contact.title && c.title && contact.title === c.title) {
            const hasHan = (s) => /[\u4e00-\u9fa5]/.test(s);
            const name1 = contact.name || '';
            const name2 = c.name || '';
            if ((hasHan(name1) && !hasHan(name2)) || (!hasHan(name1) && hasHan(name2))) {
                return true;
            }
        }
        return false;
    });
}

// 7. LIST UNIQUE TAGS
export async function getUniqueTags() {
    const contacts = await getContacts();
    const tags = new Set();
    contacts.forEach(c => {
        if (c.tags && Array.isArray(c.tags)) {
            c.tags.forEach(t => tags.add(t));
        }
    });
    return Array.from(tags).sort();
}
