// Storage Facade — re-exports from specialized modules
// All import paths (@/lib/storage) remain unchanged across the app

// Data operations → Google Sheets
export {
  getContacts,
  saveContact,
  updateContact,
  deleteContact,
  findDuplicate,
  getUniqueTags,
} from './sheets.js';

// Image operations → Cloudflare R2
export { uploadImage, getR2Stream, getImageBuffer } from './r2.js';

// Markdown generation
export { generateMarkdown } from './markdown.js';
