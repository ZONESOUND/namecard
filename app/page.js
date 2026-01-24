import { getContacts } from '@/lib/storage';
import SearchableContactGrid from './components/SearchableContactGrid';
import AddContactForm from './components/AddContactForm';

export const dynamic = 'force-dynamic';

export default async function Home() {
    const contacts = await getContacts();

    // Extract unique tags for suggestions
    const tags = new Set();
    contacts.forEach(c => c.tags?.forEach(t => tags.add(t)));
    const uniqueTags = Array.from(tags).sort();

    return (
        <div className="min-h-screen pb-32 bg-[#0b0c10]">
            <div className="max-w-7xl mx-auto px-6 md:px-8 pt-12 pb-12">

                {/* Client Side Search & Grid */}
                <SearchableContactGrid contacts={contacts} availableTags={uniqueTags} />

            </div>

            <AddContactForm availableTags={uniqueTags} />
        </div>
    );
}
