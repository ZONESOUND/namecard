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
    const contacts = await getContacts();
    const contact = contacts.find(c => c.id === id);
    if (!contact) return { success: false, error: 'Contact not found' };

    const OpenAI = (await import('openai')).default;
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    try {
        const prompt = `Provide a professional summary (Traditional Chinese) for:
        Name: ${contact.name}
        Title: ${contact.title}
        Company: ${contact.company}
        Email: ${contact.email}
        
        Rules: 
        - Use a neutral, factual, and strictly professional tone. 
        - **NO flowery language** or marketing adjectives (e.g., remove "卓越", "引領", "傑出").
        - Summarize the field/expertise of the person or the primary function of the organization.
        - If data is ambiguous, keep it extremely brief (one sentence).
        - Language: Traditional Chinese.
        - Max 80 words.`;

        const res = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [{ role: "user", content: prompt }],
        });

        const newSummary = res.choices[0].message.content.trim();
        contact.aiSummary = newSummary;

        await saveContact(contact);
        revalidatePath('/');
        return { success: true, aiSummary: newSummary };
    } catch (e) {
        console.error("Enrichment failed", e);
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
