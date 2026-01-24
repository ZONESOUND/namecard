'use client';

import { useState, useMemo } from 'react';
import EditContactModal from './EditContactModal';
import ContactCard from './ContactCard';
import { Search, Users, Zap, X, LayoutGrid, List, Filter, TrendingUp, Clock, Tag as TagIcon, ChevronRight, MapPin, Sparkles, Loader2, CheckSquare, Square, Download, Copy as CopyIcon, Mail as MailIcon } from 'lucide-react';
import { batchEnrichAction } from '../actions';
import { motion, AnimatePresence } from 'framer-motion';

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

    // 1. Tag Cloud Calculations (Top Tags)
    const tagCounts = useMemo(() => {
        return contacts.reduce((acc, contact) => {
            contact.tags?.forEach(tag => {
                acc[tag] = (acc[tag] || 0) + 1;
            });
            // Canonicalize Taiwan counts
            if (contact.tags?.includes('台灣') && !contact.tags?.includes('Taiwan')) {
                acc['Taiwan'] = (acc['Taiwan'] || 0) + 1;
            }
            return acc;
        }, {});
    }, [contacts]);

    const sortedTags = useMemo(() => {
        return Object.entries(tagCounts)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 30); // Show more tags
    }, [tagCounts]);

    // 2. Filter Logic
    const filteredContacts = useMemo(() => {
        return contacts.filter(contact => {
            const term = searchTerm.toLowerCase();
            const matchesSearch = (
                contact.name?.toLowerCase().includes(term) ||
                contact.title?.toLowerCase().includes(term) ||
                contact.company?.toLowerCase().includes(term) ||
                contact.tags?.some(tag => tag.toLowerCase().includes(term)) ||
                contact.aiSummary?.toLowerCase().includes(term)
            );
            const matchesTag = selectedTag ? (
                contact.tags?.includes(selectedTag) ||
                (selectedTag === 'Taiwan' && contact.tags?.includes('台灣'))
            ) : true;
            return matchesSearch && matchesTag;
        });
    }, [contacts, searchTerm, selectedTag]);

    // 3. Recently Added (Visual Slice)
    const recentlyAdded = useMemo(() => {
        return [...contacts]
            .sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt))
            .slice(0, 3);
    }, [contacts]);

    // 4. Batch Actions
    const toggleSelect = (id) => {
        const next = new Set(selectedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedIds(next);
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === filteredContacts.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filteredContacts.map(c => c.id)));
        }
    };

    const exportText = useMemo(() => {
        const selectedContacts = contacts.filter(c => selectedIds.has(c.id));
        return selectedContacts.map(c => {
            const parts = [c.name];
            if (c.title) parts.push(c.title);
            if (c.company) parts.push(c.company);
            return `${parts.join(' / ')} <${c.email || 'N/A'}>`;
        }).join('\n');
    }, [contacts, selectedIds]);

    const copyExportText = () => {
        navigator.clipboard.writeText(exportText);
        alert('已複製選中的聯絡人資訊，可直接貼上至郵件收件者或本文。');
    };

    return (
        <div className="flex h-full gap-8">

            {/* --- LEFT SIDEBAR (The Filter Engine) --- */}
            {showSidebar && (
                <div className="w-64 hidden lg:flex flex-col flex-shrink-0 space-y-8 animate-in fade-in slide-in-from-left-4 duration-500">

                    {/* Navigation Groups */}
                    <div className="space-y-1">
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 ml-2">Library</p>
                        <button
                            onClick={() => { setSelectedTag(null); setSearchTerm(''); }}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all ${!selectedTag && !searchTerm ? 'bg-[#5e52ff]/10 text-[#5e52ff] font-medium' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}
                        >
                            <div className="flex items-center gap-2.5">
                                <Users size={16} /> All Connections
                            </div>
                            <span className="text-[10px] opacity-50">{contacts.length}</span>
                        </button>
                    </div>

                    {/* AI Magic Enrichment Tool */}
                    <div className="space-y-3">
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1 ml-2">Intelligence</p>
                        <button
                            onClick={async () => {
                                if (confirm('要讓 AI 自動為您的所有名片補充人物背景與單位資訊嗎？（這可能需要一點時間）')) {
                                    setIsEnriching(true);
                                    try {
                                        await batchEnrichAction();
                                        alert('背景資訊補充完成！');
                                    } catch (e) {
                                        alert('補充過程發生錯誤。');
                                    } finally {
                                        setIsEnriching(false);
                                    }
                                }
                            }}
                            disabled={isEnriching}
                            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-all border ${isEnriching
                                ? 'bg-gray-800 text-gray-500 border-white/5 cursor-not-allowed'
                                : 'bg-[#5e52ff]/10 text-[#5e52ff] border-[#5e52ff]/20 hover:bg-[#5e52ff] hover:text-white shadow-lg shadow-[#5e52ff]/10'
                                }`}
                        >
                            {isEnriching ? (
                                <Loader2 size={14} className="animate-spin" />
                            ) : (
                                <Sparkles size={14} />
                            )}
                            {isEnriching ? 'AI Researching...' : 'AI 批量補充背景'}
                        </button>
                    </div>

                    {/* Region Filter Group */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between px-2">
                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Regions</p>
                            <MapPin size={12} className="text-gray-600" />
                        </div>
                        <div className="flex flex-wrap gap-2 px-2">
                            {['Taiwan', 'Japan', 'USA', 'Germany', 'UK', 'Korea', 'France', 'Singapore', 'China']
                                .filter(country => tagCounts[country])
                                .map(country => {
                                    const isSelected = selectedTag === country;
                                    return (
                                        <button
                                            key={country}
                                            onClick={() => setSelectedTag(isSelected ? null : country)}
                                            className={`px-2 py-1 rounded-md text-[10px] font-bold transition-all border ${isSelected
                                                ? 'bg-[#5e52ff] text-white border-[#5e52ff]'
                                                : 'text-gray-400 border-white/5 hover:border-white/20 hover:text-white'
                                                }`}
                                        >
                                            {country}
                                        </button>
                                    );
                                })}
                        </div>
                    </div>

                    {/* General Tag Cloud in Sidebar */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between px-2">
                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Topics</p>
                            <TagIcon size={12} className="text-gray-600" />
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-2 px-2 max-h-[300px] overflow-y-auto scrollbar-hide">
                            {sortedTags
                                .filter(([tag]) => !['Taiwan', 'Japan', 'USA', 'Germany', 'UK', 'Korea', 'France', 'Singapore', 'China'].includes(tag))
                                .map(([tag, count]) => {
                                    const isSelected = selectedTag === tag;
                                    const bucket = count >= 5 ? 'text-sm font-bold opacity-100' : count >= 3 ? 'text-xs font-semibold opacity-90' : 'text-[11px] opacity-70';

                                    return (
                                        <button
                                            key={tag}
                                            onClick={() => setSelectedTag(isSelected ? null : tag)}
                                            className={`transition-all hover:text-[#5e52ff] hover:opacity-100 ${isSelected ? 'text-[#5e52ff] underline underline-offset-4 ring-offset-4' : `text-gray-300 ${bucket}`}`}
                                        >
                                            #{tag}
                                        </button>
                                    );
                                })}
                        </div>
                    </div>

                    {/* Pro Tip Card */}
                    <div className="bg-gradient-to-br from-[#1a1d24] to-[#13151b] border border-white/5 p-4 rounded-xl">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#5e52ff]/10 mb-3">
                            <Zap size={16} className="text-[#5e52ff]" />
                        </div>
                        <p className="text-xs text-white font-bold mb-1">Knowledge Sync</p>
                        <p className="text-[10px] text-gray-500 leading-relaxed">
                            Contacts are stored as Markdown files in your local <code className="text-[#5e52ff]">/Cards</code> directory.
                        </p>
                    </div>
                </div>
            )}


            {/* --- MAIN CONTENT AREA --- */}
            <div className="flex-1 min-w-0 flex flex-col">

                {/* 1. Header & Global Search */}
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-8 pb-8 border-b border-white/5">
                    <div>
                        <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
                            Contacts
                            <span className="text-xs font-mono font-normal text-gray-600 border border-white/10 px-2 py-0.5 rounded-full">{filteredContacts.length}</span>
                        </h1>
                        <p className="text-sm text-gray-500 mt-1">藝術創作者的專業關係維護系統。</p>
                    </div>

                    <div className="flex items-center gap-4 w-full md:w-auto">
                        {/* Search Bar */}
                        <div className="relative group flex-1 md:w-80">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4 group-focus-within:text-[#5e52ff] transition-colors" />
                            <input
                                type="text"
                                placeholder="Search..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-[#13151b] border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#5e52ff] focus:ring-4 focus:ring-[#5e52ff]/10 transition-all font-medium"
                            />
                        </div>

                        {/* View Switcher Toggle */}
                        <div className="flex items-center bg-[#13151b] border border-white/10 rounded-xl p-1 mr-3">
                            <button
                                onClick={() => setViewMode('grid')}
                                className={`p-1.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-[#1a1d24] text-[#5e52ff] shadow-inner' : 'text-gray-500 hover:text-white'}`}
                            >
                                <LayoutGrid size={18} />
                            </button>
                            <button
                                onClick={() => setViewMode('list')}
                                className={`p-1.5 rounded-lg transition-all ${viewMode === 'list' ? 'bg-[#1a1d24] text-[#5e52ff] shadow-inner' : 'text-gray-500 hover:text-white'}`}
                            >
                                <List size={18} />
                            </button>
                        </div>
                        <button
                            onClick={toggleSelectAll}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all border ${selectedIds.size > 0 && selectedIds.size === filteredContacts.length
                                ? 'bg-[#5e52ff]/20 border-[#5e52ff] text-[#5e52ff]'
                                : 'border-white/10 text-gray-500 hover:text-white hover:border-white/20'
                                }`}
                        >
                            {selectedIds.size > 0 && selectedIds.size === filteredContacts.length ? <CheckSquare size={14} /> : <Square size={14} />}
                            {selectedIds.size > 0 ? `已選 ${selectedIds.size}` : '選取本頁全部'}
                        </button>
                    </div>
                </div>

                {/* --- RESPONSIVE TAG BAR (Visible only when Sidebar is hidden) --- */}
                <div className="lg:hidden mb-8 overflow-x-auto pb-2 scrollbar-hide">
                    <div className="flex items-center gap-3 whitespace-nowrap">
                        <button
                            onClick={() => setSelectedTag(null)}
                            className={`text-[11px] px-3 py-1 rounded-full border transition-all ${!selectedTag ? 'bg-white text-black border-white font-bold' : 'text-gray-500 border-white/10'}`}
                        >
                            ALL
                        </button>
                        {sortedTags.map(([tag]) => (
                            <button
                                key={tag}
                                onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                                className={`text-[11px] px-3 py-1 rounded-full border transition-all ${selectedTag === tag ? 'bg-[#5e52ff] text-white border-[#5e52ff] font-bold' : 'text-gray-500 border-white/10 hover:text-white'}`}
                            >
                                #{tag}
                            </button>
                        ))}
                    </div>
                </div>


                {/* 2. Highlight Section */}
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
                            <div className="bg-[#13151b] border border-white/10 rounded-2xl overflow-hidden animate-in fade-in duration-500">
                                <table className="w-full text-left border-collapse">
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
            <AnimatePresence>
                {selectedIds.size > 0 && (
                    <motion.div
                        initial={{ y: 100, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 100, opacity: 0 }}
                        className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-6 px-6 py-4 bg-[#1a1d24] border border-[#5e52ff]/30 rounded-2xl shadow-2xl backdrop-blur-xl"
                    >
                        <div className="flex items-center gap-3 pr-6 border-r border-white/10">
                            <div className="h-8 w-8 rounded-lg bg-[#5e52ff] flex items-center justify-center text-white">
                                <Users size={16} />
                            </div>
                            <div className="hidden sm:block">
                                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider leading-none mb-1">已選取聯絡人</p>
                                <p className="text-sm font-bold text-white leading-none">{selectedIds.size} 位聯絡人</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setIsExporting(true)}
                                className="flex items-center gap-2 px-4 py-2 bg-[#5e52ff] hover:bg-[#4b3ff0] text-white text-xs font-bold rounded-lg transition-all shadow-lg shadow-[#5e52ff]/20"
                            >
                                <Download size={14} /> 匯出名單 (群組信件用)
                            </button>
                            <button
                                onClick={() => {
                                    const emails = contacts.filter(c => selectedIds.has(c.id)).map(c => c.email).filter(Boolean).join(', ');
                                    navigator.clipboard.writeText(emails);
                                    alert('已複製所有 Email 地址');
                                }}
                                className="hidden md:flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-white text-xs font-bold rounded-lg transition-all border border-white/5"
                            >
                                <MailIcon size={14} /> 僅複製 Email
                            </button>
                            <button
                                onClick={() => setSelectedIds(new Set())}
                                className="p-2 text-gray-500 hover:text-white transition-colors"
                                title="取消選取"
                            >
                                <X size={20} />
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

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
