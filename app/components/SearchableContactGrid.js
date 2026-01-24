import EditContactModal from './EditContactModal';

export default function SearchableContactGrid({ contacts, availableTags = [] }) {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedTag, setSelectedTag] = useState(null);
    const [viewMode, setViewMode] = useState('grid');
    const [showSidebar, setShowSidebar] = useState(true);
    const [isEnriching, setIsEnriching] = useState(false);
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [isExporting, setIsExporting] = useState(false);

    // NEW: Centralized Editing State
    const [editingContact, setEditingContact] = useState(null);

    // ... (rest of logic) ...

    return (
        <div className="flex h-full gap-8">
            {/* ... Sidebar ... */}

            {/* --- MAIN CONTENT AREA --- */}
            <div className="flex-1 min-w-0 flex flex-col">

                {/* ... Header ... */}

                {/* 2. Highlight Section (Recently Added) */}
                {!searchTerm && !selectedTag && viewMode === 'grid' && (
                    <div className="mb-12 animate-in fade-in slide-in-from-bottom-2 duration-700">
                        <div className="flex items-center gap-2 mb-6 text-gray-400">
                            <TrendingUp size={16} />
                            <span className="text-sm font-bold uppercase tracking-wider">Recently Processed</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {recentlyAdded.map(contact => (
                                <div
                                    key={contact.id}
                                    onClick={() => setEditingContact(contact)}
                                    className={`bg-white/5 border border-white/5 rounded-xl p-4 flex items-center gap-3 hover:bg-white/[0.08] transition-all group cursor-pointer ${selectedIds.has(contact.id) ? 'ring-2 ring-[#5e52ff] bg-[#5e52ff]/10' : ''}`}
                                >
                                    <div className="w-10 h-10 rounded-full bg-[#5e52ff] flex items-center justify-center text-white font-bold text-sm">
                                        {contact.name.slice(0, 1)}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-white text-sm font-bold truncate">{contact.name}</p>
                                        <p className="text-gray-500 text-[11px] truncate">{contact.company}</p>
                                    </div>
                                    <ChevronRight className="ml-auto text-gray-700 group-hover:text-white transition-colors" size={14} />
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* 3. Main Data View */}
                <div className="flex-1">
                    {filteredContacts.length === 0 ? (
                        // ... Empty State ...
                        <div className="flex flex-col items-center justify-center py-32 rounded-3xl border border-dashed border-white/5 bg-[#13151b]/30">
                            <div className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center text-white/10 mb-6">
                                <Search size={24} />
                            </div>
                            <p className="text-gray-400 font-bold text-lg">Nothing matches your search</p>
                            <p className="text-gray-600 text-sm mt-1">Try different keywords or tags.</p>
                            <button
                                onClick={() => { setSearchTerm(''); setSelectedTag(null); }}
                                className="mt-6 text-[#5e52ff] text-sm font-bold hover:underline"
                            >
                                Reset all filters
                            </button>
                        </div>
                    ) : (
                        viewMode === 'grid' ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-6 animate-in fade-in duration-500">
                                {filteredContacts.map((contact) => (
                                    <ContactCard
                                        key={contact.id}
                                        contact={contact}
                                        availableTags={availableTags}
                                        isSelected={selectedIds.has(contact.id)}
                                        onSelect={toggleSelect}
                                        onEdit={(c) => setEditingContact(c)}
                                    />
                                ))}
                            </div>
                        ) : (
                            // List View
                            <div className="bg-[#13151b] border border-white/10 rounded-2xl overflow-hidden animate-in fade-in duration-500">
                                <table className="w-full text-left border-collapse">
                                    {/* ... Table Header ... */}
                                    <thead className="bg-black/20 border-b border-white/5">
                                        <tr>
                                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Name</th>
                                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest hidden md:table-cell">Title</th>
                                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Company</th>
                                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest hidden md:table-cell">Tags</th>
                                            <th className="px-6 py-4"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {filteredContacts.map(contact => (
                                            <tr
                                                key={contact.id}
                                                onClick={() => setEditingContact(contact)}
                                                className={`group transition-colors cursor-pointer ${selectedIds.has(contact.id) ? 'bg-[#5e52ff]/10' : 'hover:bg-white/[0.02]'
                                                    }`}
                                            >
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div
                                                            onClick={(e) => { e.stopPropagation(); toggleSelect(contact.id); }}
                                                            className={`h-5 w-5 rounded border flex items-center justify-center transition-all cursor-pointer ${selectedIds.has(contact.id) ? 'bg-[#5e52ff] border-[#5e52ff] text-white' : 'border-white/10 text-transparent hover:border-white/30'
                                                                }`}
                                                        >
                                                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                                        </div>
                                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-[10px] ${['bg-blue-500', 'bg-violet-500', 'bg-emerald-500', 'bg-rose-500', 'bg-amber-500'][contact.name.length % 5]
                                                            }`}>
                                                            {contact.name.slice(0, 1)}
                                                        </div>
                                                        <span className="text-sm text-white font-bold">{contact.name}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-sm text-gray-400 hidden md:table-cell">{contact.title}</td>
                                                <td className="px-6 py-4 text-sm text-gray-400">{contact.company}</td>
                                                <td className="px-6 py-4 hidden md:table-cell">
                                                    {/* Capsulate tags */}
                                                    <div className="flex gap-1">
                                                        {contact.tags?.slice(0, 2).map(t => (
                                                            <span key={t} className="text-[10px] bg-white/5 border border-white/5 px-2 py-0.5 rounded text-gray-500">{t}</span>
                                                        ))}
                                                        {contact.tags?.length > 2 && <span className="text-[10px] text-gray-700">+{contact.tags.length - 2}</span>}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-right pr-8">
                                                    <MailIcon size={14} className={contact.email ? 'text-gray-600' : 'text-gray-800'} />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )
                    )}
                </div>

            </div>

            {/* --- BATCH ACTION BAR --- */}
            {/* ... */}

            {/* --- EXPORT MODAL --- */}
            <AnimatePresence>
                {isExporting && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm shadow-2xl overflow-y-auto">
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-[#13151b] border border-white/10 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl"
                        >
                            <div className="p-6 border-b border-white/5 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-[#5e52ff]/10 rounded-lg text-[#5e52ff]">
                                        <Download size={20} />
                                    </div>
                                    <h3 className="text-xl font-bold text-white">匯出群組信件資訊</h3>
                                </div>
                                <button onClick={() => setIsExporting(false)} className="text-gray-500 hover:text-white transition-colors">
                                    <X size={24} />
                                </button>
                            </div>

                            <div className="p-8">
                                <p className="text-sm text-gray-400 mb-6">以下是您選取的聯絡人資訊，您可以直接複製並貼上到電子郵件中作為正文或參考：</p>

                                <div className="relative group">
                                    <textarea
                                        readOnly
                                        value={exportText}
                                        rows={12}
                                        className="w-full bg-black/40 border border-white/10 rounded-xl p-6 text-sm font-mono text-gray-300 focus:outline-none focus:border-[#5e52ff] transition-all"
                                    />
                                    <button
                                        onClick={copyExportText}
                                        className="absolute top-4 right-4 flex items-center gap-2 px-3 py-1.5 bg-[#5e52ff] text-white text-[10px] font-bold rounded-md hover:bg-[#4b3ff0] transition-colors"
                                    >
                                        <CopyIcon size={12} /> 複製全部
                                    </button>
                                </div>

                                <div className="mt-8 flex justify-end gap-3">
                                    <button
                                        onClick={() => setIsExporting(false)}
                                        className="px-6 py-2 bg-white/5 hover:bg-white/10 text-white text-sm font-bold rounded-xl transition-all"
                                    >
                                        關閉
                                    </button>
                                    <button
                                        onClick={copyExportText}
                                        className="px-8 py-2 bg-[#5e52ff] hover:bg-[#4b3ff0] text-white text-sm font-bold rounded-xl transition-all shadow-lg shadow-[#5e52ff]/20"
                                    >
                                        複製並結束
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* --- EDIT MODAL (Centralized) --- */}
            {editingContact && (
                <EditContactModal
                    contact={editingContact}
                    isOpen={!!editingContact}
                    onClose={() => setEditingContact(null)}
                    availableTags={availableTags}
                />
            )}
        </div>
    );
}
