'use client';

import { useState, useRef, useEffect } from 'react';
import { updateContactAction } from '../actions';
import { X, Sparkles, Save, User, Briefcase, Building, Mail, Phone, Tag, Calendar, MapPin, AlignLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function EditContactModal({ contact, isOpen, onClose, availableTags = [] }) {
    const [tagQuery, setTagQuery] = useState('');
    const formRef = useRef(null);
    const tagsInputRef = useRef(null);

    // Close on Escape key
    useEffect(() => {
        const handleEsc = (e) => {
            if (e.key === 'Escape') onClose();
        };
        if (isOpen) window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [isOpen, onClose]);

    // Helper to add tag from suggestions
    const addTag = (tag) => {
        if (!tagsInputRef.current) return;
        const currentVal = tagsInputRef.current.value;
        if (currentVal.includes(tag)) return;

        const newVal = currentVal ? `${currentVal}, ${tag}` : tag;
        tagsInputRef.current.value = newVal;
    };

    const suggestedTags = availableTags.slice(0, 20);

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                    onClick={onClose}
                >
                    <motion.div
                        initial={{ scale: 0.95, y: 20 }}
                        animate={{ scale: 1, y: 0 }}
                        exit={{ scale: 0.95, y: 20 }}
                        className="bg-[#13151b] border border-white/10 w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row max-h-[90vh]"
                        onClick={e => e.stopPropagation()}
                    >

                        {/* Left Panel: Preview / Info */}
                        <div className="w-full md:w-1/3 bg-black/20 p-6 border-b md:border-b-0 md:border-r border-white/5 flex flex-col items-center justify-start text-center space-y-6 overflow-y-auto">
                            <div className="flex flex-col items-center">
                                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#5e52ff] to-purple-600 flex items-center justify-center text-3xl font-bold text-white shadow-xl mb-4">
                                    {contact.name.slice(0, 2).toUpperCase()}
                                </div>
                                <h3 className="text-white font-bold text-xl">{contact.name}</h3>
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

                            {contact.aiSummary && (
                                <div className="mt-4 p-4 rounded-xl bg-[#5e52ff]/5 border border-[#5e52ff]/10 text-left w-full">
                                    <div className="flex items-center gap-2 mb-2 text-[#5e52ff] text-xs font-bold uppercase tracking-wider">
                                        <Sparkles size={12} /> AI Insight
                                    </div>
                                    <p className="text-xs text-gray-400 leading-relaxed font-medium">
                                        {contact.aiSummary}
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Right Panel: Form */}
                        <div className="w-full md:w-2/3 p-6 md:p-8 overflow-y-auto">
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
                                <input type="hidden" name="id" value={contact.id} />

                                <div className="space-y-6">

                                    {/* Section: Identity */}
                                    <div className="space-y-4">
                                        <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest ml-1">Identity</p>
                                        <div className="relative group">
                                            <User size={16} className="absolute left-3 top-3.5 text-gray-500 group-focus-within:text-[#5e52ff] transition-colors" />
                                            <input
                                                name="name"
                                                defaultValue={contact.name}
                                                placeholder="Full Name (Leave empty if only company)"
                                                className="w-full bg-black/20 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:border-[#5e52ff] transition-all placeholder-gray-600"
                                            />
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="relative group">
                                                <Briefcase size={16} className="absolute left-3 top-3.5 text-gray-500 group-focus-within:text-[#5e52ff] transition-colors" />
                                                <input
                                                    name="title"
                                                    defaultValue={contact.title}
                                                    placeholder="Job Title"
                                                    className="w-full bg-black/20 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:border-[#5e52ff] transition-all placeholder-gray-600"
                                                />
                                            </div>
                                            <div className="relative group">
                                                <Building size={16} className="absolute left-3 top-3.5 text-gray-500 group-focus-within:text-[#5e52ff] transition-colors" />
                                                <input
                                                    name="company"
                                                    defaultValue={contact.company}
                                                    placeholder="Company"
                                                    className="w-full bg-black/20 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:border-[#5e52ff] transition-all placeholder-gray-600"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Section: Meeting Info (Encounter) */}
                                    <div className="space-y-4">
                                        <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest ml-1">When & Where we met</p>
                                        <div className="relative group">
                                            <MapPin size={16} className="absolute left-3 top-3.5 text-gray-500 group-focus-within:text-[#5e52ff] transition-colors" />
                                            <input
                                                name="metAt"
                                                defaultValue={contact.metAt}
                                                placeholder="e.g. 2024 Art Fair / Taipei"
                                                className="w-full bg-black/20 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:border-[#5e52ff] transition-all placeholder-gray-600 text-sm"
                                            />
                                        </div>
                                    </div>

                                    {/* Section: Communication */}
                                    <div className="space-y-4">
                                        <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest ml-1">Communication</p>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="relative group">
                                                <Mail size={16} className="absolute left-3 top-3.5 text-gray-500 group-focus-within:text-[#5e52ff] transition-colors" />
                                                <input
                                                    name="email"
                                                    type="email"
                                                    defaultValue={contact.email}
                                                    placeholder="Email Address"
                                                    className="w-full bg-black/20 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:border-[#5e52ff] transition-all placeholder-gray-600"
                                                />
                                            </div>
                                            <div className="relative group">
                                                <Phone size={16} className="absolute left-3 top-3.5 text-gray-500 group-focus-within:text-[#5e52ff] transition-colors" />
                                                <input
                                                    name="phone"
                                                    defaultValue={contact.phone}
                                                    placeholder="Phone Number"
                                                    className="w-full bg-black/20 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:border-[#5e52ff] transition-all placeholder-gray-600"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Section: Categorization */}
                                    <div className="space-y-4">
                                        <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest ml-1">Tags</p>
                                        <div className="relative group">
                                            <Tag size={16} className="absolute left-3 top-3.5 text-gray-500 group-focus-within:text-[#5e52ff] transition-colors" />
                                            <input
                                                ref={tagsInputRef}
                                                name="tags"
                                                defaultValue={contact.tags?.join(', ')}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    const parts = val.split(',').map(p => p.trim());
                                                    const lastPart = parts[parts.length - 1];
                                                    setTagQuery(lastPart);
                                                }}
                                                placeholder="Tags (comma separated)..."
                                                className="w-full bg-black/20 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:border-[#5e52ff] transition-all placeholder-gray-600"
                                            />
                                        </div>

                                        {/* Dynamic Suggested Tags */}
                                        <div className="flex flex-wrap gap-2 px-1 min-h-[28px]">
                                            {(tagQuery ?
                                                availableTags.filter(t => t.toLowerCase().includes(tagQuery.toLowerCase()) && !contact.tags?.includes(t)) :
                                                availableTags.slice(0, 8)
                                            ).slice(0, 12).map(tag => (
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
                                                    {tagQuery ? `Match: ${tag}` : `#${tag}`}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Section: Notes */}
                                    <div className="space-y-4">
                                        <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest ml-1">Personal Notes</p>
                                        <div className="relative group">
                                            <AlignLeft size={16} className="absolute left-3 top-3.5 text-gray-500 group-focus-within:text-[#5e52ff] transition-colors" />
                                            <textarea
                                                name="notes"
                                                defaultValue={contact.notes}
                                                placeholder="Any additional context about this relationship..."
                                                rows={3}
                                                className="w-full bg-black/20 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:border-[#5e52ff] transition-all placeholder-gray-600 text-sm resize-none"
                                            />
                                        </div>
                                    </div>
                                    {/* Section: AI Intelligence (Background) */}
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between ml-1">
                                            <p className="text-[10px] font-bold text-[#5e52ff] uppercase tracking-widest">AI Background Information</p>
                                            <Sparkles size={12} className="text-[#5e52ff]" />
                                        </div>
                                        <div className="relative group">
                                            <AlignLeft size={16} className="absolute left-3 top-3.5 text-gray-500 group-focus-within:text-[#5e52ff] transition-colors" />
                                            <textarea
                                                name="aiSummary"
                                                defaultValue={contact.aiSummary}
                                                placeholder="Background information about this person or organization..."
                                                rows={4}
                                                className="w-full bg-[#5e52ff]/5 border border-[#5e52ff]/10 rounded-xl py-3 pl-10 pr-4 text-gray-300 focus:outline-none focus:border-[#5e52ff] transition-all text-xs leading-relaxed resize-none"
                                            />
                                        </div>
                                    </div>
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

                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
