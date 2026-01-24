const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const path = require('path');

const prisma = new PrismaClient();

async function migrate() {
    try {
        console.log('Starting migration...');

        const jsonPath = path.join(process.cwd(), 'data', 'contacts.json');
        const fileContent = fs.readFileSync(jsonPath, 'utf8');
        const contacts = JSON.parse(fileContent);

        console.log(`Found ${contacts.length} contacts in JSON.`);

        let count = 0;
        for (const c of contacts) {
            // Check if exists
            const exists = await prisma.contact.findUnique({
                where: { id: c.id }
            });

            if (!exists) {
                // Ensure tags is array of strings
                const tags = Array.isArray(c.tags) ? c.tags : [];

                await prisma.contact.create({
                    data: {
                        id: c.id,
                        name: c.name || '',
                        title: c.title || null,
                        company: c.company || null,
                        email: c.email || null,
                        phone: c.phone || null,
                        metAt: c.metAt || null,
                        notes: c.notes || null,
                        tags: tags,
                        aiSummary: c.aiSummary || null,
                        history: c.history || [],
                        addedAt: c.addedAt ? new Date(c.addedAt) : new Date(),
                        updatedAt: c.updatedAt ? new Date(c.updatedAt) : new Date(),
                    }
                });
                count++;
            }
        }

        console.log(`Successfully migrated ${count} new contacts to PostgreSQL.`);

    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

migrate();
