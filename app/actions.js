'use server';

import { saveContact, deleteContact, updateContact, findDuplicate, getContacts } from '@/lib/storage';
import { revalidatePath } from 'next/cache';

export async function addContactAction(formData) {
    let name = formData.get('name');
    const company = formData.get('company');
    let tags = formData.get('tags')?.split(',').map(s => s.trim()).filter(Boolean) || [];

    if (!name && company) {
        name = company;
        if (!tags.includes('Company Card')) {
            tags.push('Company Card');
        }
    }

    const rawFormData = {
        name,
        title: formData.get('title'),
        company,
        email: formData.get('email'),
        phone: formData.get('phone'),
        metAt: formData.get('metAt'),
        notes: formData.get('notes'),
        tags,
        jobStatus: formData.get('jobStatus'),
        id: formData.get('id'),
        imageUrl: formData.get('imageUrl'), // Capture Image URL
        socialProfiles: formData.get('socialProfiles') ? JSON.parse(formData.get('socialProfiles')) : {},
        secondaryEmail: formData.get('secondaryEmail'),
    };

    await saveContact(rawFormData);
    revalidatePath('/');
}

export async function checkDuplicateAction(contactData) {
    return await findDuplicate(contactData);
}

export async function deleteContactAction(id) {
    await deleteContact(id);
    revalidatePath('/');
}

export async function updateContactAction(formData) {
    const id = formData.get('id');

    const tagsStr = formData.get('tags');
    let tags = [];
    if (tagsStr) {
        tags = tagsStr.split(',').map(t => t.trim()).filter(Boolean);
    }

    const updates = {
        name: formData.get('name'),
        title: formData.get('title'),
        company: formData.get('company'),
        email: formData.get('email'),
        phone: formData.get('phone'),
        metAt: formData.get('metAt'),
        notes: formData.get('notes'),
        tags: tags,
        tags: tags,
        aiSummary: formData.get('aiSummary') || null,
        socialProfiles: formData.get('socialProfiles') ? JSON.parse(formData.get('socialProfiles')) : (contact.socialProfiles || {}), // Preservation handled by merge, but here we explicitly look for form data
        secondaryEmail: formData.get('secondaryEmail'),
    };

    await updateContact(id, updates);
    revalidatePath('/');
}

export async function enrichSingleContactAction(id) {
    const { getContacts, saveContact, getImageBuffer } = await import('@/lib/storage');
    const contacts = await getContacts();
    const contact = contacts.find(c => c.id === id);
    if (!contact) return { success: false, error: 'Contact not found' };

    const OpenAI = (await import('openai')).default;
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    try {
        let messages = [];
        let imagePart = null;

        // Try to fetch original image for better context/correction
        if (contact.imageUrl) {
            // Extract filename from URL likely format "/api/images/uuid.jpg"
            const filename = contact.imageUrl.split('/').pop();
            const r2Key = `Images/${filename}`;
            const imageBuffer = await getImageBuffer(r2Key);

            if (imageBuffer) {
                const base64Image = imageBuffer.toString('base64');
                imagePart = {
                    type: "image_url",
                    image_url: {
                        "url": `data:image/jpeg;base64,${base64Image}`,
                    },
                };
            }
        }

        // Context: Get existing tags to encourage reuse
        const allTags = new Set();
        contacts.forEach(c => c.tags?.forEach(t => allTags.add(t)));
        const existingTagsList = Array.from(allTags).slice(0, 50).join(', ');

        const prompt = `Your task is to **Validate, Correct, and Enrich** this contact.
        
        **Current Data**:
        Name: ${contact.name}
        Title: ${contact.title}
        Company: ${contact.company}
        Email: ${contact.email}
        Existing System Tags: [${existingTagsList}]

        **Instructions**:
        1. **CORRECTION (High Priority)**: 
           - FIX OCR errors (Name/Title/Company).
           - Check Email/Phone: Fix if typo'd. 
           
        2. **VERIFICATION & ENRICHMENT (Mandatory)**:
           - **Sanity Check**: Does this person exist in public records? 
             - If YES: Provide a concise professional summary.
             - If NO or UNSURE: Write "Unknown Person." and then describe the **Organization** instead.
           - **Social Media**: Search for public LinkedIn, Facebook, Instagram, or Personal Website. 
           - **Secondary Contact**: Look for alternative emails or phone numbers.
           - **Style**: strictly professional, factual, NO FLUFF. No "visionary", "distinguished", "leading" kinds of adjectives unless part of a proper noun.
           - **Language**: Traditional Chinese.

        3. **TAGGING (Strict & Comprehensive)**:
           - **Nationality/Region (MANDATORY)**: You MUST infer the country/region (e.g., 'Taiwan', 'Japan', 'USA', 'China', 'Hong Kong', 'Singapore', 'Malaysia').
             - Multiple regions allowed if they split time (e.g. "Taiwan", "USA").
           - **Organization Type**: 'Venue', 'Festival', 'Gallery', 'Government', 'Company', 'School', 'Foundation'.
           - **Role**: 'Curator', 'Artist', 'Director', 'Producer', 'Critic', 'Collector'.
           - **Field**: 'Performing Arts', 'Visual Arts', 'Music', 'Tech', 'Film', 'Literature'.

        4. **OUTPUT JSON**:
           - socialProfiles: { "linkedin": "url", "facebook": "url", "instagram": "url", "website": "url" }
           - secondaryEmail: string or null
        
        Format:
        {
            "name": "Corrected Name",
            "title": "Corrected Title",
            "company": "Corrected Company",
            "email": "Corrected Email",
            "secondaryEmail": "alt@email.com",
            "socialProfiles": { "linkedin": "...", "website": "..." },
            "tags": ["Taiwan", "Curator", "Visual Arts"],
            "aiSummary": "..."
        }`;

        const content = [{ type: "text", text: prompt }];
        if (imagePart) content.push(imagePart);

        const res = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [{ role: "user", content: content }],
            response_format: { type: "json_object" }
        });

        const result = JSON.parse(res.choices[0].message.content);

        // Apply updates
        let hasChanges = false;
        if (result.name && result.name !== contact.name) { contact.name = result.name; hasChanges = true; }
        if (result.email && result.email !== contact.email) { contact.email = result.email; hasChanges = true; }
        if (result.phone && result.phone !== contact.phone) { contact.phone = result.phone; hasChanges = true; }

        // Merge New Fields
        if (result.secondaryEmail) { contact.secondaryEmail = result.secondaryEmail; hasChanges = true; }
        if (result.socialProfiles) {
            contact.socialProfiles = { ...(contact.socialProfiles || {}), ...result.socialProfiles };
            hasChanges = true;
        }

        // Merge AI Tags
        if (result.tags && Array.isArray(result.tags) && result.tags.length > 0) {
            const currentTags = new Set(contact.tags || []);
            result.tags.forEach(t => currentTags.add(t));
            // Convert back to array
            const newTags = Array.from(currentTags);
            if (newTags.length !== (contact.tags || []).length) {
                contact.tags = newTags;
                hasChanges = true;
            }
        }

        // Always update summary
        contact.aiSummary = result.aiSummary;

        await saveContact(contact);
        revalidatePath('/');
        return { success: true, aiSummary: result.aiSummary, corrected: hasChanges };

    } catch (e) {
        console.error("Enrichment failed", e);
        return { success: false, error: e.message };
    }
}

export async function enrichDraftAction(currData) {
    const { getContacts } = await import('@/lib/storage');
    // We still need all contacts to get existing tags
    const contacts = await getContacts();

    // Context: Get existing tags to encourage reuse
    const allTags = new Set();
    contacts.forEach(c => c.tags?.forEach(t => allTags.add(t)));
    const existingTagsList = Array.from(allTags).slice(0, 50).join(', ');

    const OpenAI = (await import('openai')).default;
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    try {
        const prompt = `Your task is to **Validate, Correct, and Enrich** this NEW contact draft.
        
        **Draft Data**:
        Name: ${currData.name}
        Title: ${currData.title}
        Company: ${currData.company}
        Email: ${currData.email}
        Existing System Tags: [${existingTagsList}]

        **Instructions**:
        1. **CORRECTION**: 
           - Suggest corrections for potential OCR errors in Name, Title, Company.
           
        2. **ENRICHMENT**:
           - **Identify the Person**: Check your internal knowledge.
           - **Fallback**: Describe the **Organization's significance** and **Role**. 
           - **Socials**: Extract Website, LinkedIn, Facebook, Instagram if known or inferable.
           - **Style**: Professional, objective, Traditional Chinese context.

        3. **TAGGING**:
           - Assign 3-5 relevant tags.
           - **MANDATORY**: Identify the **Country/Region** (e.g. "Taiwan", "Japan", "USA", "Germany", "Switzerland", "Hong Kong", "China") and add it as a tag.
           - **PRIORITY**: REUSE "Existing System Tags" if they fit.
           - Tags should be English or Traditional Chinese (consistent with existing).

        4. **OUTPUT**:
           - Return JSON.
           - NO email/phone in summary.
        
        Format:
        {
            "name": "Corrected Name",
            "title": "Corrected Title",
            "company": "Corrected Company",
            "email": "Corrected Email",
            "secondaryEmail": "alt@email.com",
            "socialProfiles": { "website": "https://...", "linkedin": "..." },
            "tags": ["Tag1", "Tag2"],
            "aiSummary": "..."
        }`;

        // Reinforce Region
        const mandatoryRegionPrompt = prompt + "\n\nCRITICAL: You MUST include a 'Region' tag (e.g. Taiwan, Japan, USA, China, Hong Kong) based on the contact details.";

        const res = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [{ role: "user", content: mandatoryRegionPrompt }],
            response_format: { type: "json_object" }
        });

        const result = JSON.parse(res.choices[0].message.content);

        return { success: true, result };

    } catch (e) {
        console.error("Draft enrichment failed", e);
        return { success: false, error: e.message };
    }
}

export async function batchEnrichAction() {
    // ... existing logic ...
    const { getContacts, saveContact } = await import('@/lib/storage');
    const contacts = await getContacts();
    const OpenAI = (await import('openai')).default;
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // Lazy load to prevent build issues
    if (!process.env.OPENAI_API_KEY) return;

    for (let c of contacts) {
        if ((!c.aiSummary || c.aiSummary.length < 10) || c.email === 'whkuo@nycu.edu.tw') {
            try {
                const prompt = `Provide a professional summary (Traditional Chinese) for:
                Name: ${c.name}
                Title: ${c.title}
                Company: ${c.company}
                Email: ${c.email}
                
                Rules: 
                - Use a neutral, factual, and strictly professional tone. 
                - **NO flowery language** or marketing adjectives (e.g., remove "卓越", "引領", "傑出").
                - Summarize the field/expertise of the person or the primary function of the organization.
                - If data is ambiguous, keep it extremely brief (one sentence).
                - For 'whkuo@nycu.edu.tw', identify as 郭文華 (Wen-Hua Kuo), Associate University Librarian at NYCU, expert in STS (Science, Technology, and Society).
                - Language: Traditional Chinese.
                - **MANDATORY**: Include the Country/Region in the summary text (e.g. "台灣", "美國") if known.
                - Max 80 words.`;

                const res = await openai.chat.completions.create({
                    model: "gpt-4o",
                    messages: [{ role: "user", content: prompt }],
                });

                c.aiSummary = res.choices[0].message.content.trim();

                if (c.email === 'whkuo@nycu.edu.tw') {
                    c.name = "郭文華 (Wen-Hua Kuo)";
                    c.company = "國立陽明交通大學 (NYCU)";
                }

                await saveContact(c);
            } catch (e) {
                console.error("Enrichment failed for", c.name, e);
            }
        }
    }
    revalidatePath('/');
}

export async function generateTagsAction(contactData) {
    const { getContacts } = await import('@/lib/storage');
    // Get all existing tags for context
    const contacts = await getContacts();
    const allTags = new Set();
    contacts.forEach(c => c.tags?.forEach(t => allTags.add(t)));
    const existingTagsList = Array.from(allTags).join(', ');

    const OpenAI = (await import('openai')).default;
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    try {
        const prompt = `Your task is to generate relevant tags for this contact to expand their metadata.
        
        Contact:
        Name: ${contactData.name}
        Title: ${contactData.title}
        Company: ${contactData.company}
        Bio/Summary: ${contactData.notes || contactData.aiSummary || ''}

        EXISTING TAG SYSTEM (USE THESE PRECISELY IF APPLICABLE):
        [${existingTagsList}]

        INSTRUCTIONS:
        1. **Goal**: Select 3-6 high-quality tags.
        2. **Taxonomy First**: You MUST check the "EXISTING TAG SYSTEM" list first. If a concept exists there (e.g., "Visual Arts"), use that EXACT string. Do NOT create synonyms like "Visual Art" or "Art, Visual".
        3. **Mandatory Categories**:
           - **Region**: (e.g. Taiwan, Japan, USA, UK, Germany).
           - **Role**: (e.g. Curator, Artist, Producer, Director, CEO).
           - **Sector**: (e.g. Performing Arts, Visual Arts, Music, Tech, Gov).
           - **Type**: (e.g. Venue, Festival, Company, Foundation).
        4. **Media Rule**: If they are in Media/PR/Journalism, you MUST add the tag "Media".
        5. **Language**: Use Traditional Chinese if the existing tags use it for that concept, otherwise English. (Regions are usually English).
        
        **CRITICAL**: You MUST include a "Region" tag (e.g. Taiwan, Japan, USA, China, Hong Kong). If unknown, infer from Company or Email domain.


        6. Return ONLY a JSON array of strings.

        Example Output:
        { "tags": ["Curator", "Taiwan", "Media", "Magazine", "Visual Arts"] }
        `;

        const res = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" }
        });

        const result = JSON.parse(res.choices[0].message.content);
        return { success: true, tags: result.tags };

    } catch (e) {
        console.error("Tag generation failed", e);
        return { success: false, error: e.message };
    }
}

export async function aiSmartUpdateAction(id, userInstruction) {
    const { getContacts, saveContact } = await import('@/lib/storage');
    const contacts = await getContacts();
    const contact = contacts.find(c => c.id === id);

    if (!contact) return { success: false, error: 'Contact not found' };

    const OpenAI = (await import('openai')).default;
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    try {
        const prompt = `You are a smart contact manager. The user wants to update a contact based on an instruction.
        
        **Current Contact Data**:
        ${JSON.stringify(contact, null, 2)}

        **User Instruction**:
        "${userInstruction}"

        **Task**:
        1. Parse the instruction to understand what fields need updating.
        2. If the user mentions a new Role, Job, or Company, understand that the person has moved.
           - Update 'title' and 'company'.
           - **CRITICAL**: If this is a job change, set "jobStatus" to "history" in the output so the system preserves the old job in history.
        3. If the user provides a new tag or category, add it to 'tags'.
           - **Taxonomy Rule**: If adding "Media" related tags, allow granular tags (Journalist, Radio, etc.) BUT also consider adding "Media" as a shared parent tag if appropriate.
        4. If the user corrects a typo, just fix it.
        5. "search" usually means use your internal knowledge to fill in details if the user provides a vague hint (e.g. "He works at Apple now" -> Fill in probable title if known, or just update Company).
        6. **Social/Contact Info**: If the user provides a LinkedIn URL or secondary email, add it to 'socialProfiles' or 'secondaryEmail'.
        7. Return the FULL updated contact object as JSON.

        **Output Format**: JSON only.
        `;

        const res = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" }
        });

        const result = JSON.parse(res.choices[0].message.content);

        // Sanity check: Ensure ID remains
        result.id = contact.id;

        // Save using saveContact to trigger history logic
        await saveContact(result);
        revalidatePath('/');

        return { success: true, changes: result };

    } catch (e) {
        console.error("Smart Update failed", e);
        return { success: false, error: e.message };
    }
}

// ============================
// SMART VERIFICATION ACTIONS
// ============================

export async function verifyEmailDNSAction(contactId) {
    const { getContacts, updateContact } = await import('@/lib/storage');
    const dns = await import('dns');
    const resolveMx = dns.promises.resolveMx;

    const contacts = await getContacts();
    const contact = contacts.find(c => c.id === contactId);
    if (!contact) return { success: false, error: 'Contact not found' };

    if (!contact.email || !contact.email.includes('@')) {
        await updateContact(contactId, { emailValid: 'No Email' });
        revalidatePath('/');
        return { success: true, result: 'No Email' };
    }

    const domain = contact.email.split('@')[1];
    try {
        const records = await resolveMx(domain);
        const status = records && records.length > 0 ? 'Valid' : 'Invalid';
        await updateContact(contactId, { emailValid: status });
        revalidatePath('/');
        return { success: true, result: status };
    } catch (e) {
        await updateContact(contactId, { emailValid: 'Invalid' });
        revalidatePath('/');
        return { success: true, result: 'Invalid' };
    }
}

export async function calculateImportanceAction(contactId) {
    const { getContacts, updateContact } = await import('@/lib/storage');
    const contacts = await getContacts();
    const contact = contacts.find(c => c.id === contactId);
    if (!contact) return { success: false, error: 'Contact not found' };

    const OpenAI = (await import('openai')).default;
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    try {
        const prompt = `Rate the professional relevance (0-100) of this contact to 紀柏豪 (Chi Po-Hao), a Taiwanese sound artist working in new media art, sound installations, and electroacoustic music.

Contact:
Name: ${contact.name}
Title: ${contact.title}
Company: ${contact.company}
Tags: ${(contact.tags || []).join(', ')}
Summary: ${contact.aiSummary || ''}

Scoring criteria:
- Institutional influence (arts organizations, funding bodies, major festivals): +20-30
- Direct collaboration potential (curators, producers, artists in related fields): +20-30
- Field overlap (sound art, new media, electroacoustic, digital art): +15-25
- Geographic proximity (Taiwan-based or frequent Taiwan ties): +5-15
- Active professional relationship indicators: +5-10

Return ONLY a JSON object: { "score": <number>, "reason": "<brief reason in Traditional Chinese>" }`;

        const res = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [{ role: 'user', content: prompt }],
            response_format: { type: 'json_object' },
            max_tokens: 200,
        });

        const result = JSON.parse(res.choices[0].message.content);
        const score = Math.min(100, Math.max(0, parseInt(result.score) || 0));

        await updateContact(contactId, { importanceScore: score });
        revalidatePath('/');
        return { success: true, score, reason: result.reason };
    } catch (e) {
        console.error('Importance calculation failed', e);
        return { success: false, error: e.message };
    }
}

export async function verifyStalenessAction(contactId) {
    const { getContacts, updateContact } = await import('@/lib/storage');
    const contacts = await getContacts();
    const contact = contacts.find(c => c.id === contactId);
    if (!contact) return { success: false, error: 'Contact not found' };

    const OpenAI = (await import('openai')).default;
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    try {
        const res = await openai.responses.create({
            model: 'gpt-4o',
            tools: [{ type: 'web_search_preview' }],
            input: `Search the web: Is "${contact.name}" currently working at "${contact.company}" as "${contact.title}"? Find the most recent public information about this person's current role and affiliation. Report in Traditional Chinese.

Return a JSON object:
{
  "status": "Fresh" | "Stale" | "Mismatch",
  "evidence": "<what you found>",
  "newTitle": "<if different, the current title>",
  "newCompany": "<if different, the current company>"
}

- "Fresh" = confirmed still in same role
- "Stale" = no recent info found, data might be outdated
- "Mismatch" = found evidence of a different role/company`,
            text: { format: { type: 'json_object' } },
        });

        const result = JSON.parse(res.output_text);
        const now = new Date().toISOString().split('T')[0];

        const updates = {
            lastVerifiedAt: now,
            verificationStatus: result.status || 'Unknown',
        };

        // If mismatch, add warning tag
        if (result.status === 'Mismatch') {
            const currentTags = new Set(contact.tags || []);
            currentTags.add('Potential Info Mismatch');
            updates.tags = Array.from(currentTags);
        }

        await updateContact(contactId, updates);
        revalidatePath('/');
        return {
            success: true,
            status: result.status,
            evidence: result.evidence,
            newTitle: result.newTitle,
            newCompany: result.newCompany,
        };
    } catch (e) {
        console.error('Staleness check failed', e);
        // Fallback: mark as Unknown
        const now = new Date().toISOString().split('T')[0];
        await updateContact(contactId, {
            lastVerifiedAt: now,
            verificationStatus: 'Unknown',
        });
        revalidatePath('/');
        return { success: false, error: e.message };
    }
}

export async function batchVerifyAction() {
    const { getContacts } = await import('@/lib/storage');
    const contacts = await getContacts();
    const results = { dns: 0, importance: 0, staleness: 0, errors: 0 };

    for (const contact of contacts) {
        try {
            // 1. DNS check
            await verifyEmailDNSAction(contact.id);
            results.dns++;

            // 2. Importance (only if not yet scored)
            if (!contact.importanceScore) {
                await calculateImportanceAction(contact.id);
                results.importance++;
                // Rate limiting
                await new Promise(r => setTimeout(r, 2000));
            }
        } catch (e) {
            results.errors++;
            console.error(`Batch verify error for ${contact.name}:`, e.message);
        }
    }

    revalidatePath('/');
    return { success: true, results };
}
