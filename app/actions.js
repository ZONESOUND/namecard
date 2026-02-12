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
        aiSummary: formData.get('aiSummary') || null
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
           - FIX OCR errors in Name, Title, Company (e.g., "簡瑞齊" -> "簡瑞春").
           - Check Email/Phone: Fix if typo'd. 
           
        2. **ENRICHMENT (Mandatory)**:
           - **Identify the Person**: Check your internal knowledge for this person.
           - **Fallback Strategy (CRITICAL)**: If you do NOT know the person, you **MUST** describe the **Organization's significance** and the **Role's responsibilities** instead. 
           - **Style**: Professional, objective, Traditional Chinese context.

        3. **TAGGING (Strict Taxonomy)**:
           - You MUST classify the contact using the following specific categories if applicable:
             - **Organization**: 'Venue' (場館/中心/美術館/劇院), 'Foundation' (基金會), 'Government' (政府單位), 'Gallery' (畫廊), 'Festival' (藝術節), 'Company' (公司), 'University' (學校/學術).
             - **Role**: 'Curator' (策展人), 'Director' (總監/館長), 'Producer' (製作人), 'Artist' (藝術家), 'Critic' (評論), 'Teacher' (教師/教授).
             - **Field**: 'Performing Arts' (表演藝術), 'Visual Arts' (視覺藝術), 'New Media' (新媒體), 'Music' (音樂), 'Tech' (科技), 'Film' (電影).
             - **Region**: 'Taiwan', 'Japan', 'USA', 'Germany', 'Switzerland', 'Hong Kong', 'China', 'UK'.
           
           - **Rules**:
             - Assign 4-6 tags total.
             - **PRIORITY 1 - Organization Type (CRITICAL)**:
               - If the organization is a Performing Arts Center (e.g., National Theater & Concert Hall, Weiwuying, Taichung Opera House), you **MUST** tag it as 'Venue' (場館).
               - You can ALSO add the specific abbreviation (e.g., "NTCH"), but 'Venue' is mandatory.
             - **PRIORITY 2 - Role Precision**:
               - **DO NOT** use 'Director' for a School Teacher (老師). Use 'Teacher' or 'Professor'. 
               - Only use 'Director' for high-level executives (Artistic Director, Museum Director, Executive Director).
             - **PRIORITY 3 - Region**: Always tag the region.
             - Use Traditional Chinese for the Role/Org tags if the input is Chinese, otherwise English. Keep Regions in English. 

        4. **OUTPUT**:
           - Return JSON.
           - NO email/phone in summary.
        
        Format:
        {
            "name": "Corrected Name",
            "title": "Corrected Title",
            "company": "Corrected Company",
            "email": "Corrected Email",
            "tags": ["Tag1", "Tag2"],
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
            "tags": ["Tag1", "Tag2"],
            "aiSummary": "..."
        }`;

        const res = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [{ role: "user", content: prompt }],
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
        6. Return the FULL updated contact object as JSON.

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
