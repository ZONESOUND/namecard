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
                    className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-0 md:p-4"
                    onClick={onClose}
                >
                    <motion.div
                        initial={{ scale: 0.95, y: 20 }}
                        animate={{ scale: 1, y: 0 }}
                        exit={{ scale: 0.95, y: 20 }}
                        className="bg-[#13151b] border-t md:border border-white/10 w-full max-w-4xl h-[90vh] mt-[10vh] md:mt-0 md:h-auto md:max-h-[90vh] md:rounded-2xl rounded-t-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row transition-all duration-300 pointer-events-auto"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Mobile: Parent Scrolls. Desktop: Children Scroll. */}
                        <div className="flex flex-col md:flex-row w-full h-full md:overflow-hidden overflow-y-auto">

                            {/* Left Panel: Preview / Info */}
                            <div className="w-full md:w-1/3 bg-black/20 p-6 border-b md:border-b-0 md:border-r border-white/5 flex flex-col items-center justify-start text-center space-y-6 md:overflow-y-auto shrink-0">
                                <div className="flex flex-col items-center w-full">
                                    <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#5e52ff] to-purple-600 flex items-center justify-center text-3xl font-bold text-white shadow-xl mb-4">
                                        {contact.name.slice(0, 2).toUpperCase()}
                                    </div>
                                    <h3 className="text-white font-bold text-xl break-words w-full">{contact.name}</h3>
                                    <p className="text-[#5e52ff] font-medium text-sm mt-1">{contact.title}</p>
                                    <p className="text-gray-500 text-sm">{contact.company}</p>
                                </div>

                                <div className="w-full space-y-4 text-left">
                                    {contact.metAt && (
                                        <div className="p-3 rounded-lg bg-white/5 border border-white/5">
                                            <p className="text-[10px] text-gray-500 uppercase font-bold mb-1 flex items-center gap-1.5">
                                                <Calendar size={10} /> Encounter Context
                                            </p>
                                            <p className="text-xs text-gray-300">{contact.metAt}</p>
                                        </div>
                                    )}

                                    <div className="p-3 rounded-lg bg-white/5 border border-white/5">
                                        <p className="text-[10px] text-gray-400 uppercase font-bold mb-1">System Info</p>
                                        <p className="text-[10px] text-gray-600 italic">Added on {new Date(contact.addedAt).toLocaleDateString()}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Right Panel: Form */}
                            <div className="w-full md:w-2/3 p-6 md:p-8 md:overflow-y-auto">
                                <div className="flex justify-between items-center mb-6">
                                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                        Edit Details
                                    </h2>
                                    <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors p-1 rounded-full hover:bg-white/5">
                                        <X size={20} />
                                    </button>
                                </div>

                                <form ref={formRef} action={async (formData) => {
                                    await updateContactAction(formData);
                                    onClose();
                                }} className="space-y-6">

                                    <input type="hidden" name="id" value={contact.id} />

                                    {/* Identity */}
                                    <div className="space-y-4">
                                        <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest ml-1">Identity</p>
                                        <input
                                            name="name"
                                            defaultValue={contact.name}
                                            placeholder="Full Name"
                                            className="w-full bg-black/20 border border-white/10 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-[#5e52ff] transition-all"
                                        />
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <input name="title" defaultValue={contact.title} placeholder="Job Title" className="w-full bg-black/20 border border-white/10 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-[#5e52ff] transition-all" />
                                            <input name="company" defaultValue={contact.company} placeholder="Company" className="w-full bg-black/20 border border-white/10 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-[#5e52ff] transition-all" />
                                        </div>
                                    </div>

                                    {/* Meeting Info */}
                                    <div className="space-y-4">
                                        <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest ml-1">When & Where we met</p>
                                        <input name="metAt" defaultValue={contact.metAt} placeholder="e.g. 2024 Art Fair" className="w-full bg-black/20 border border-white/10 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-[#5e52ff] transition-all" />
                                    </div>

                                    {/* Contact */}
                                    <div className="space-y-4">
                                        <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest ml-1">Communication</p>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <input name="email" type="email" defaultValue={contact.email} placeholder="Email" className="w-full bg-black/20 border border-white/10 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-[#5e52ff] transition-all" />
                                            <input name="phone" defaultValue={contact.phone} placeholder="Phone" className="w-full bg-black/20 border border-white/10 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-[#5e52ff] transition-all" />
                                        </div>
                                    </div>

                                    {/* Tags */}
                                    <div className="space-y-4">
                                        <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest ml-1">Tags</p>
                                        <input
                                            ref={tagsInputRef}
                                            name="tags"
                                            defaultValue={contact.tags?.join(', ')}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                const parts = val.split(',').map(p => p.trim());
                                                setTagQuery(parts[parts.length - 1]);
                                            }}
                                            placeholder="Tags..."
                                            className="w-full bg-black/20 border border-white/10 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-[#5e52ff] transition-all"
                                        />
                                        {/* Tag Suggestions */}
                                        <div className="flex flex-wrap gap-2 px-1 min-h-[28px]">
                                            {(tagQuery ?
                                                availableTags.filter(t => t.toLowerCase().includes(tagQuery.toLowerCase()) && !contact.tags?.includes(t)) :
                                                availableTags.slice(0, 8)
                                            ).slice(0, 8).map(tag => (
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
                                                    className="text-[10px] px-2 py-0.5 rounded border border-[#5e52ff]/30 bg-[#5e52ff]/5 text-[#5e52ff] hover:bg-[#5e52ff] hover:text-white transition-all font-medium"
                                                >
                                                    {tagQuery ? `+ ${tag}` : `#${tag}`}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Notes */}
                                    <div className="space-y-4">
                                        <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest ml-1">Personal Notes</p>
                                        <textarea name="notes" defaultValue={contact.notes} placeholder="Notes..." rows={3} className="w-full bg-black/20 border border-white/10 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-[#5e52ff] transition-all resize-none" />
                                    </div>

                                    {/* AI Intelligence */}
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between ml-1">
                                            <p className="text-[10px] font-bold text-[#5e52ff] uppercase tracking-widest">AI Background Information</p>
                                            <button
                                                type="button"
                                                onClick={handleEnrich}
                                                disabled={isEnriching}
                                                className="flex items-center gap-1.5 text-[10px] bg-[#5e52ff]/10 hover:bg-[#5e52ff] text-[#5e52ff] hover:text-white px-2 py-1 rounded-md transition-all font-bold border border-[#5e52ff]/20"
                                            >
                                                {isEnriching ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                                                {isEnriching ? 'Analyzing...' : 'Refresh AI'}
                                            </button>
                                        </div>
                                        <textarea
                                            name="aiSummary"
                                            defaultValue={contact.aiSummary}
                                            rows={4}
                                            className="w-full bg-[#5e52ff]/5 border border-[#5e52ff]/10 rounded-xl px-4 py-3 text-gray-300 focus:outline-none focus:border-[#5e52ff] transition-all text-xs leading-relaxed resize-none"
                                            placeholder="AI generated background info..."
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
