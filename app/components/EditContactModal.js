'use client';

import { useState, useRef, useEffect } from 'react';
import { updateContactAction, enrichSingleContactAction } from '../actions';
import { X, Sparkles, Save, User, Briefcase, Building, Mail, Phone, Tag, Calendar, MapPin, AlignLeft, RefreshCw, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';

export default function EditContactModal({ contact, isOpen, onClose, availableTags = [] }) {
    const [tagQuery, setTagQuery] = useState('');
    const [isEnriching, setIsEnriching] = useState(false);
    const formRef = useRef(null);
    const tagsInputRef = useRef(null);
    const router = useRouter();

    // Close on Escape key
    useEffect(() => {
        const handleEsc = (e) => {
            if (e.key === 'Escape') onClose();
        };
        if (isOpen) window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [isOpen, onClose]);

    // Scroll Lock
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => { document.body.style.overflow = 'unset'; };
    }, [isOpen]);

    // Handle AI Enrichment
    const handleEnrich = async () => {
        setIsEnriching(true);
        try {
            const res = await enrichSingleContactAction(contact.id);
            if (res.success) {
                // Manually update the textarea value if possible, or trigger a refresh
                alert('AI Analysis Complete! Please save to apply changes.');
                if (formRef.current) {
                    const aiField = formRef.current.querySelector('textarea[name="aiSummary"]');
                    if (aiField) aiField.value = res.aiSummary;
                }
                router.refresh(); // Refresh server data
            } else {
                alert('Analysis failed: ' + res.error);
            }
        } catch (e) {
            alert('Error during enrichment');
        } finally {
            setIsEnriching(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-0 md:p-6"
                    onClick={onClose}
                >
                    <motion.div
                        initial={{ scale: 0.95, y: 20 }}
                        animate={{ scale: 1, y: 0 }}
                        exit={{ scale: 0.95, y: 20 }}
                        className="bg-[#13151b] border-t md:border border-white/10 w-full max-w-6xl h-[95vh] mt-[5vh] md:mt-0 md:h-auto md:max-h-[90vh] md:rounded-2xl rounded-t-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row transition-all duration-300 pointer-events-auto"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Mobile: Parent Scrolls. Desktop: Children Scroll. */}
                        <div className="flex flex-col md:flex-row w-full h-full md:overflow-hidden overflow-y-auto">

                            {/* Left Panel: Preview / Info */}
                            <div className="w-full md:w-1/3 bg-black/20 p-8 border-b md:border-b-0 md:border-r border-white/5 flex flex-col items-center justify-start text-center space-y-6 md:overflow-y-auto shrink-0 bg-gradient-to-b from-white/5 to-transparent">

                                {contact.imageUrl ? (
                                    <div className="w-full aspect-[1.6] rounded-xl overflow-hidden shadow-2xl border border-white/10 mb-2 relative group">
                                        <img src={contact.imageUrl} alt="Card" className="w-full h-full object-cover" />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center pb-4">
                                            <span className="text-white text-xs font-medium">Original Card</span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="w-32 h-32 rounded-full bg-gradient-to-br from-[#5e52ff] to-purple-600 flex items-center justify-center text-4xl font-bold text-white shadow-xl mb-4 border-4 border-[#13151b]">
                                        {contact.name.slice(0, 2).toUpperCase()}
                                    </div>
                                )}

                                <div className="flex flex-col items-center w-full">
                                    <h3 className="text-white font-bold text-2xl break-words w-full tracking-tight">{contact.name}</h3>
                                    <p className="text-[#5e52ff] font-medium text-base mt-2">{contact.title}</p>
                                    <p className="text-gray-400 text-sm mt-1">{contact.company}</p>
                                </div>

                                <div className="w-full space-y-4 text-left pt-6 border-t border-white/5">
                                    {contact.metAt && (
                                        <div className="p-4 rounded-xl bg-black/20 border border-white/5 hover:border-white/10 transition-colors">
                                            <p className="text-[10px] text-gray-500 uppercase font-bold mb-2 flex items-center gap-1.5">
                                                <Calendar size={12} /> Encounter Context
                                            </p>
                                            <p className="text-sm text-gray-200">{contact.metAt}</p>
                                        </div>
                                    )}

                                    <div className="p-4 rounded-xl bg-black/20 border border-white/5">
                                        <p className="text-[10px] text-gray-400 uppercase font-bold mb-2">System Info</p>
                                        <p className="text-xs text-gray-600 italic">Added on {new Date(contact.addedAt).toLocaleDateString()}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Right Panel: Form */}
                            <div className="w-full md:w-2/3 p-6 md:p-10 md:overflow-y-auto bg-[#0b0c10]">
                                <div className="flex justify-between items-center mb-8 sticky top-0 bg-[#0b0c10] z-10 py-2 border-b border-white/5">
                                    <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                                        Edit Details
                                    </h2>
                                    <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors p-2 rounded-full hover:bg-white/5">
                                        <X size={24} />
                                    </button>
                                </div>

                                <form ref={formRef} action={async (formData) => {
                                    await updateContactAction(formData);
                                    onClose();
                                }} className="space-y-8 pb-10">

                                    <input type="hidden" name="id" value={contact.id} />

                                    {/* Identity */}
                                    <div className="space-y-5">
                                        <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest pl-1 border-l-2 border-[#5e52ff] pl-3">Identity</p>
                                        <div className="relative group">
                                            <User size={18} className="absolute left-4 top-4 text-gray-500 group-focus-within:text-[#5e52ff] transition-colors" />
                                            <input
                                                name="name"
                                                defaultValue={contact.name}
                                                placeholder="Full Name"
                                                className="w-full bg-[#13151b] border border-white/10 rounded-2xl py-3.5 pl-12 pr-4 text-white focus:outline-none focus:border-[#5e52ff] transition-all text-lg font-medium"
                                            />
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                            <div className="relative group">
                                                <Briefcase size={18} className="absolute left-4 top-4 text-gray-500 group-focus-within:text-[#5e52ff] transition-colors" />
                                                <input name="title" defaultValue={contact.title} placeholder="Job Title" className="w-full bg-[#13151b] border border-white/10 rounded-2xl py-3.5 pl-12 pr-4 text-white focus:outline-none focus:border-[#5e52ff] transition-all" />
                                            </div>
                                            <div className="relative group">
                                                <Building size={18} className="absolute left-4 top-4 text-gray-500 group-focus-within:text-[#5e52ff] transition-colors" />
                                                <input name="company" defaultValue={contact.company} placeholder="Company" className="w-full bg-[#13151b] border border-white/10 rounded-2xl py-3.5 pl-12 pr-4 text-white focus:outline-none focus:border-[#5e52ff] transition-all" />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Meeting Info */}
                                    <div className="space-y-5">
                                        <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest pl-1 border-l-2 border-[#5e52ff] pl-3">When & Where we met</p>
                                        <div className="relative group">
                                            <MapPin size={18} className="absolute left-4 top-4 text-gray-500 group-focus-within:text-[#5e52ff] transition-colors" />
                                            <input name="metAt" defaultValue={contact.metAt} placeholder="e.g. 2024 Art Fair" className="w-full bg-[#13151b] border border-white/10 rounded-2xl py-3.5 pl-12 pr-4 text-white focus:outline-none focus:border-[#5e52ff] transition-all" />
                                        </div>
                                    </div>

                                    {/* Contact */}
                                    <div className="space-y-5">
                                        <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest pl-1 border-l-2 border-[#5e52ff] pl-3">Communication</p>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                            <div className="relative group">
                                                <Mail size={18} className="absolute left-4 top-4 text-gray-500 group-focus-within:text-[#5e52ff] transition-colors" />
                                                <input name="email" type="email" defaultValue={contact.email} placeholder="Email" className="w-full bg-[#13151b] border border-white/10 rounded-2xl py-3.5 pl-12 pr-4 text-white focus:outline-none focus:border-[#5e52ff] transition-all" />
                                            </div>
                                            <div className="relative group">
                                                <Phone size={18} className="absolute left-4 top-4 text-gray-500 group-focus-within:text-[#5e52ff] transition-colors" />
                                                <input name="phone" defaultValue={contact.phone} placeholder="Phone" className="w-full bg-[#13151b] border border-white/10 rounded-2xl py-3.5 pl-12 pr-4 text-white focus:outline-none focus:border-[#5e52ff] transition-all" />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Tags */}
                                    <div className="space-y-5">
                                        <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest pl-1 border-l-2 border-[#5e52ff] pl-3">Tags</p>
                                        <div className="relative group">
                                            <Tag size={18} className="absolute left-4 top-4 text-gray-500 group-focus-within:text-[#5e52ff] transition-colors" />
                                            <input
                                                ref={tagsInputRef}
                                                name="tags"
                                                defaultValue={contact.tags?.join(', ')}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    const parts = val.split(',').map(p => p.trim());
                                                    setTagQuery(parts[parts.length - 1]);
                                                }}
                                                placeholder="Tags (comma separated)..."
                                                className="w-full bg-[#13151b] border border-white/10 rounded-2xl py-3.5 pl-12 pr-4 text-white focus:outline-none focus:border-[#5e52ff] transition-all"
                                            />
                                        </div>
                                        {/* Tag Suggestions */}
                                        <div className="flex flex-wrap gap-2 px-1 min-h-[28px]">
                                            {(tagQuery ?
                                                availableTags.filter(t => t.toLowerCase().includes(tagQuery.toLowerCase()) && !contact.tags?.includes(t)) :
                                                availableTags.slice(0, 8)
                                            ).slice(0, 10).map(tag => (
                                                <button
                                                    key={tag}
                                                    type="button"
                                                    onClick={() => {
                                                        const currentParts = tagsInputRef.current.value.split(',').map(p => p.trim());
                                                        currentParts[currentParts.length - 1] = tag;
                                                        tagsInputRef.current.value = [...new Set(currentParts)].join(', ') + ', ';
                                                        setTagQuery('');
                                                        tagsInputRef.current.focus();
                                                    }}
                                                    className="text-[11px] px-3 py-1 rounded-full border border-[#5e52ff]/30 bg-[#5e52ff]/5 text-[#5e52ff] hover:bg-[#5e52ff] hover:text-white transition-all font-medium"
                                                >
                                                    {tagQuery ? `+ ${tag}` : `#${tag}`}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* AI Intelligence */}
                                    <div className="space-y-4 pt-4 border-t border-white/5">
                                        <div className="flex items-center justify-between ml-1">
                                            <p className="text-[11px] font-bold text-[#5e52ff] uppercase tracking-widest pl-1 flex items-center gap-2">
                                                <Sparkles size={14} /> AI Background & Notes
                                            </p>
                                            <button
                                                type="button"
                                                onClick={handleEnrich}
                                                disabled={isEnriching}
                                                className="flex items-center gap-1.5 text-[10px] bg-[#5e52ff]/10 hover:bg-[#5e52ff] text-[#5e52ff] hover:text-white px-3 py-1.5 rounded-full transition-all font-bold border border-[#5e52ff]/20"
                                            >
                                                {isEnriching ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                                                {isEnriching ? 'Analyzing...' : 'Refresh AI'}
                                            </button>
                                        </div>
                                        <textarea
                                            name="aiSummary"
                                            defaultValue={contact.aiSummary}
                                            rows={6}
                                            className="w-full bg-[#5e52ff]/5 border border-[#5e52ff]/10 rounded-2xl px-5 py-4 text-gray-200 focus:outline-none focus:border-[#5e52ff] transition-all text-sm leading-relaxed resize-none"
                                            placeholder="AI generated background info (You can also write your own notes here)..."
                                        />
                                    </div>

                                    <div className="pt-6 border-t border-white/5 flex gap-3">
                                        <button
                                            type="button"
                                            onClick={onClose}
                                            className="flex-1 py-3 rounded-xl border border-white/10 text-gray-400 hover:text-white hover:bg-white/5 transition-colors font-medium"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            className="flex-1 py-3 rounded-xl bg-[#5e52ff] text-white hover:bg-[#4b3ff0] transition-colors font-bold shadow-lg shadow-[#5e52ff]/20 flex items-center justify-center gap-2"
                                        >
                                            <Save size={18} />
                                            Save Changes
                                        </button>
                                    </div>
                                </form>
                            </div>

                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
