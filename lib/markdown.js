import fs from 'fs/promises';
import path from 'path';

const CARDS_DIR = path.join(process.cwd(), 'Cards');

// --- MARKDOWN GENERATION ---

export function generateMarkdown(contact) {
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
    `verification_status: "${contact.verificationStatus || 'Unknown'}"`,
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
    contact.secondaryEmail ? `- Secondary Email: ${contact.secondaryEmail}` : '',
    `- Phone: ${contact.phone || 'N/A'}`,
    `- Website: ${contact.socialProfiles?.website || contact.website || 'N/A'}`,
    '',
    '## Online Presence',
    contact.socialProfiles?.linkedin ? `- LinkedIn: ${contact.socialProfiles.linkedin}` : '',
    contact.socialProfiles?.facebook ? `- Facebook: ${contact.socialProfiles.facebook}` : '',
    contact.socialProfiles?.instagram ? `- Instagram: ${contact.socialProfiles.instagram}` : '',
    '',
    '## AI Summary',
    contact.aiSummary || 'No summary generated yet.',
    '',
    '## Notes',
    contact.notes || '',
    '',
    '## Career History',
    ...(contact.history || []).map(h => `- ${h.title} @ ${h.company} (${h.date || 'Past'})`),
    '',
  ].filter(line => line !== null).join('\n');

  return frontmatter;
}

function safeName(name) {
  return name.trim().replace(/[\\/:"*?<>|]+/g, '_');
}

export async function writeMarkdownFile(contact) {
  try {
    await fs.mkdir(CARDS_DIR, { recursive: true });
    const filename = safeName(contact.name);
    const mdContent = generateMarkdown(contact);
    await fs.writeFile(path.join(CARDS_DIR, `${filename}.md`), mdContent);
  } catch (e) {
    console.error('Failed to write markdown file:', e.message);
  }
}

export async function deleteMarkdownFile(contact) {
  const filename = safeName(contact.name);
  const oldFilename = contact.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();

  try { await fs.unlink(path.join(CARDS_DIR, `${filename}.md`)); } catch (e) { /* ignore */ }
  try { await fs.unlink(path.join(CARDS_DIR, `${oldFilename}.md`)); } catch (e) { /* ignore */ }
}
