'use client';

import { useState, useRef, useEffect } from 'react';
import { updateContactAction, enrichSingleContactAction, generateTagsAction, aiSmartUpdateAction } from '../actions';
import { X, Sparkles, Save, User, Briefcase, Building, Mail, Phone, Tag, Calendar, MapPin, AlignLeft, RefreshCw, Loader2, Bot, Globe, Linkedin, Facebook, Instagram, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';

export default function EditContactModal({ contact, isOpen, onClose, availableTags = [] }) {
    const [tagQuery, setTagQuery] = useState('');
    const [isEnriching, setIsEnriching] = useState(false);
    const [isTagging, setIsTagging] = useState(false);
    const [isSmartUpdating, setIsSmartUpdating] = useState(false);
    const [smartInstruction, setSmartInstruction] = useState('');
    const [showAgent, setShowAgent] = useState(true); // Default to open

    // Controlled Inputs State (Fixes jumping issues)
    // Controlled Inputs State (Fixes jumping issues)
    const [tagsValue, setTagsValue] = useState(contact.tags?.join(', ') || '');
    const [aiSummaryValue, setAiSummaryValue] = useState(contact.aiSummary || '');
    const [socialProfiles, setSocialProfiles] = useState(contact.socialProfiles || {});
    const [secondaryEmail, setSecondaryEmail] = useState(contact.secondaryEmail || '');

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
                alert('AI Analysis Complete! Please save to apply changes.');
                setAiSummaryValue(res.aiSummary);

                // Update new fields if found
                if (res.secondaryEmail) setSecondaryEmail(res.secondaryEmail);
                if (res.socialProfiles) {
                    setSocialProfiles(prev => ({ ...prev, ...res.socialProfiles }));
                }
                // We don't necessarily need router.refresh() here if we want to keep the local state editing flow
                // But if we want to update other parts of the UI, we can.
                // For now, let's keep the user in the "Edit" flow with the new data.

                // router.refresh(); // Removed to prevent potential prop/state conflict, rely on local state
            } else {
                alert('Analysis failed: ' + res.error);
            }
        } catch (e) {
            alert('Error during enrichment');
        } finally {
            setIsEnriching(false);
        }
    };

    const handleAiTags = async () => {
        setIsTagging(true);
        try {
            const formData = new FormData(formRef.current);
            const contactData = {
                name: formData.get('name'),
                title: formData.get('title'),
                company: formData.get('company'),
                notes: formData.get('aiSummary') || contact.aiSummary,
            };

            const res = await generateTagsAction(contactData);
            if (res.success && res.tags) {
                const currentTags = tagsValue.split(',').map(s => s.trim()).filter(Boolean);
                const uniqueTags = new Set([...currentTags, ...res.tags]);

                const newTagsValue = Array.from(uniqueTags).join(', ');
                setTagsValue(newTagsValue);
                alert(`Generated tags: ${res.tags.join(', ')}`);
            } else {
                alert('Tag generation failed: ' + (res.error || 'Unknown error'));
            }
        } catch (e) {
            console.error(e);
            alert('Error generating tags');
        } finally {
            setIsTagging(false);
        }
    };

    const handleSmartUpdate = async () => {
        if (!smartInstruction.trim()) return;
        setIsSmartUpdating(true);
        try {
            const res = await aiSmartUpdateAction(contact.id, smartInstruction);
            if (res.success) {
                alert('Contact updated successfully!');
                // Refresh local inputs or close?
                // Since it saved to server, we should probably just reload to see changes or update locally.
                // Simplest is to reload the page to fetch fresh data including history.
                window.location.reload();
            } else {
                alert('Update failed: ' + res.error);
            }
        } catch (e) {
            alert('Error updating contact');
        } finally {
            setIsSmartUpdating(false);
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
                        className="bg-[#13151b] border-t md:border border-white/10 w-full max-w-6xl h-[95vh] md:h-[85vh] md:rounded-2xl rounded-t-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row transition-all duration-300 pointer-events-auto relative"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* LEFT PANEL: Preview (Scrollable independently on mobile, fixed height on desktop) */}
                        <div className="hidden md:flex w-1/3 bg-black/20 border-r border-white/5 flex-col shrink-0 bg-gradient-to-b from-white/5 to-transparent h-full overflow-y-auto custom-scrollbar relative z-10">
                            <div className="p-8 flex flex-col items-center justify-start text-center space-y-6">
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
                        </div>

                        {/* RIGHT PANEL: Form (Flex Col) */}
                        <div className="w-full md:w-2/3 bg-[#0b0c10] flex flex-col h-full relative font-sans z-0">

                            {/* Sticky Header */}
                            <div className="shrink-0 flex justify-between items-center px-6 md:px-10 py-5 border-b border-white/5 bg-[#0b0c10]/95 backdrop-blur z-20">
                                <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                                    Edit Details
                                </h2>
                                <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors p-2 rounded-full hover:bg-white/5">
                                    <X size={24} />
                                </button>
                            </div>

                            {/* AI AGENT BAR (Fixed Location) */}
                            <div className="shrink-0 max-h-40 bg-[#13151b] border-b border-white/5 p-4 z-20">
                                <div className="bg-[#5e52ff]/10 border border-[#5e52ff]/20 rounded-xl p-3 flex flex-col gap-2">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-[10px] font-bold text-[#5e52ff] uppercase tracking-widest flex items-center gap-2">
                                            <Bot size={14} /> AI Assistant
                                        </h3>
                                    </div>
                                    <div className="flex gap-2">
                                        <input
                                            value={smartInstruction}
                                            onChange={(e) => setSmartInstruction(e.target.value)}
                                            placeholder="Ask to update, fix, or search..."
                                            className="flex-1 bg-[#0b0c10] border border-white/10 rounded-lg px-3 py-2 text-xs md:text-sm text-white focus:outline-none focus:border-[#5e52ff]"
                                            onKeyDown={(e) => e.key === 'Enter' && handleSmartUpdate()}
                                        />
                                        <button
                                            type="button"
                                            onClick={handleSmartUpdate}
                                            disabled={isSmartUpdating || !smartInstruction}
                                            className="bg-[#5e52ff] hover:bg-[#4b3ff0] text-white px-3 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[40px]"
                                        >
                                            {isSmartUpdating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Scrollable Form Content */}
                            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-10">
                                <form id="edit-form" ref={formRef} action={async (formData) => {
                                    await updateContactAction(formData);
                                    onClose();
                                }} className="space-y-8 pb-32"> {/* Large padding bottom for footer space in mobile */}

                                    <input type="hidden" name="id" value={contact.id} />
                                    <input type="hidden" name="socialProfiles" value={JSON.stringify(socialProfiles)} />

                                    {/* Identity */}
                                    <div className="space-y-6">
                                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest pl-3 border-l-2 border-[#5e52ff]">Identity</p>
                                        <div className="relative group">
                                            <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-[#5e52ff] transition-colors" />
                                            <input
                                                name="name"
                                                defaultValue={contact.name}
                                                placeholder="Full Name"
                                                className="w-full bg-[#13151b] border border-white/10 rounded-xl py-4 pl-12 pr-4 text-white focus:outline-none focus:border-[#5e52ff] transition-all text-lg font-medium"
                                            />
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                            <div className="relative group">
                                                <Briefcase size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-[#5e52ff] transition-colors" />
                                                <input name="title" defaultValue={contact.title} placeholder="Job Title" className="w-full bg-[#13151b] border border-white/10 rounded-xl py-4 pl-12 pr-4 text-white focus:outline-none focus:border-[#5e52ff] transition-all" />
                                            </div>
                                            <div className="relative group">
                                                <Building size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-[#5e52ff] transition-colors" />
                                                <input name="company" defaultValue={contact.company} placeholder="Company" className="w-full bg-[#13151b] border border-white/10 rounded-xl py-4 pl-12 pr-4 text-white focus:outline-none focus:border-[#5e52ff] transition-all" />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Meeting Info */}
                                    <div className="space-y-5 mt-8">
                                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest pl-3 border-l-2 border-[#5e52ff]">Encounter</p>
                                        <div className="relative group">
                                            <MapPin size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-[#5e52ff] transition-colors" />
                                            <input name="metAt" defaultValue={contact.metAt} placeholder="Where did we met? (e.g. 2024 Art Fair)" className="w-full bg-[#13151b] border border-white/10 rounded-xl py-4 pl-12 pr-4 text-white focus:outline-none focus:border-[#5e52ff] transition-all" />
                                        </div>
                                    </div>

                                    {/* Contact */}
                                    <div className="space-y-5 mt-8">
                                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest pl-3 border-l-2 border-[#5e52ff]">Contact Links</p>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                            <div className="relative group">
                                                <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-[#5e52ff] transition-colors" />
                                                <input name="email" type="email" defaultValue={contact.email} placeholder="Email" className="w-full bg-[#13151b] border border-white/10 rounded-xl py-4 pl-12 pr-4 text-white focus:outline-none focus:border-[#5e52ff] transition-all" />
                                            </div>
                                            <div className="relative group">
                                                <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-[#5e52ff] transition-colors opacity-50" />
                                                <input
                                                    name="secondaryEmail"
                                                    type="email"
                                                    value={secondaryEmail}
                                                    onChange={(e) => setSecondaryEmail(e.target.value)}
                                                    placeholder="Secondary Email"
                                                    className="w-full bg-[#13151b] border border-white/10 rounded-xl py-4 pl-12 pr-4 text-white focus:outline-none focus:border-[#5e52ff] transition-all"
                                                />
                                            </div>
                                            <div className="relative group">
                                                <Phone size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-[#5e52ff] transition-colors" />
                                                <input name="phone" defaultValue={contact.phone} placeholder="Phone" className="w-full bg-[#13151b] border border-white/10 rounded-xl py-4 pl-12 pr-4 text-white focus:outline-none focus:border-[#5e52ff] transition-all" />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Social Profiles */}
                                    <div className="space-y-5 mt-8">
                                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest pl-3 border-l-2 border-[#5e52ff]">Online Presence</p>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                            <div className="relative group">
                                                <Globe size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-[#5e52ff] transition-colors" />
                                                <input
                                                    value={socialProfiles.website || ''}
                                                    onChange={(e) => setSocialProfiles({ ...socialProfiles, website: e.target.value })}
                                                    placeholder="Website"
                                                    className="w-full bg-[#13151b] border border-white/10 rounded-xl py-4 pl-12 pr-12 text-white focus:outline-none focus:border-[#5e52ff] transition-all"
                                                />
                                                {socialProfiles.website && (
                                                    <a href={socialProfiles.website} target="_blank" rel="noopener noreferrer" className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-[#5e52ff] transition-colors p-1" title="Open Website">
                                                        <ExternalLink size={16} />
                                                    </a>
                                                )}
                                            </div>
                                            <div className="relative group">
                                                <Linkedin size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-[#0077b5] transition-colors" />
                                                <input
                                                    value={socialProfiles.linkedin || ''}
                                                    onChange={(e) => setSocialProfiles({ ...socialProfiles, linkedin: e.target.value })}
                                                    placeholder="LinkedIn URL"
                                                    className="w-full bg-[#13151b] border border-white/10 rounded-xl py-4 pl-12 pr-12 text-white focus:outline-none focus:border-[#5e52ff] transition-all"
                                                />
                                                {socialProfiles.linkedin && (
                                                    <a href={socialProfiles.linkedin} target="_blank" rel="noopener noreferrer" className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-[#0077b5] transition-colors p-1" title="Open LinkedIn">
                                                        <ExternalLink size={16} />
                                                    </a>
                                                )}
                                            </div>
                                            <div className="relative group">
                                                <Facebook size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-[#1877f2] transition-colors" />
                                                <input
                                                    value={socialProfiles.facebook || ''}
                                                    onChange={(e) => setSocialProfiles({ ...socialProfiles, facebook: e.target.value })}
                                                    placeholder="Facebook URL"
                                                    className="w-full bg-[#13151b] border border-white/10 rounded-xl py-4 pl-12 pr-12 text-white focus:outline-none focus:border-[#5e52ff] transition-all"
                                                />
                                                {socialProfiles.facebook && (
                                                    <a href={socialProfiles.facebook} target="_blank" rel="noopener noreferrer" className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-[#1877f2] transition-colors p-1" title="Open Facebook">
                                                        <ExternalLink size={16} />
                                                    </a>
                                                )}
                                            </div>
                                            <div className="relative group">
                                                <Instagram size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-[#E1306C] transition-colors" />
                                                <input
                                                    value={socialProfiles.instagram || ''}
                                                    onChange={(e) => setSocialProfiles({ ...socialProfiles, instagram: e.target.value })}
                                                    placeholder="Instagram URL"
                                                    className="w-full bg-[#13151b] border border-white/10 rounded-xl py-4 pl-12 pr-12 text-white focus:outline-none focus:border-[#5e52ff] transition-all"
                                                />
                                                {socialProfiles.instagram && (
                                                    <a href={socialProfiles.instagram} target="_blank" rel="noopener noreferrer" className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-[#E1306C] transition-colors p-1" title="Open Instagram">
                                                        <ExternalLink size={16} />
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Tags */}
                                    <div className="space-y-5 mt-8">
                                        <div className="flex items-center justify-between ml-1">
                                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest pl-3 border-l-2 border-[#5e52ff]">Tags</p>
                                        </div>
                                        <div className="relative group">
                                            <Tag size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-[#5e52ff] transition-colors" />
                                            <input
                                                ref={tagsInputRef}
                                                name="tags"
                                                value={tagsValue}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    setTagsValue(val);
                                                    const parts = val.split(',');
                                                    setTagQuery(parts[parts.length - 1].trim());
                                                }}
                                                placeholder="Tags (comma separated)..."
                                                className="w-full bg-[#13151b] border border-white/10 rounded-xl py-4 pl-12 pr-24 text-white focus:outline-none focus:border-[#5e52ff] transition-all font-mono text-sm tracking-wide"
                                            />
                                            {/* Integrated Auto Tag Button */}
                                            <button
                                                type="button"
                                                onClick={handleAiTags}
                                                disabled={isTagging}
                                                className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-[10px] bg-[#5e52ff]/10 hover:bg-[#5e52ff] text-[#5e52ff] hover:text-white px-3 py-1.5 rounded-lg transition-all font-bold border border-[#5e52ff]/20 cursor-pointer pointer-events-auto h-8"
                                            >
                                                {isTagging ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                                                {isTagging ? '...' : 'Auto Tag'}
                                            </button>
                                        </div>
                                        <div className="flex flex-wrap gap-2 px-1 min-h-[28px]">
                                            {(tagQuery ?
                                                availableTags.filter(t => t.toLowerCase().includes(tagQuery.toLowerCase()) && !contact.tags?.includes(t)) :
                                                availableTags.slice(0, 8)
                                            ).slice(0, 10).map(tag => (
                                                <button
                                                    key={tag}
                                                    type="button"
                                                    onClick={() => {
                                                        const currentParts = tagsValue.split(',').map(p => p.trim());
                                                        currentParts[currentParts.length - 1] = tag;
                                                        const newValue = [...new Set(currentParts)].join(', ') + ', ';
                                                        setTagsValue(newValue);
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
                                    <div className="space-y-4 pt-8 border-t border-white/5 mt-8">
                                        <div className="flex items-center justify-between ml-1">
                                            <p className="text-[11px] font-bold text-[#5e52ff] uppercase tracking-widest pl-1 flex items-center gap-2">
                                                <Sparkles size={14} /> AI Background & Notes
                                            </p>
                                            <button
                                                type="button"
                                                onClick={handleEnrich}
                                                disabled={isEnriching}
                                                className="flex items-center gap-1.5 text-[10px] bg-[#5e52ff]/10 hover:bg-[#5e52ff] text-[#5e52ff] hover:text-white px-3 py-1.5 rounded-full transition-all font-bold border border-[#5e52ff]/20 cursor-pointer pointer-events-auto"
                                            >
                                                {isEnriching ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                                                {isEnriching ? 'Analyzing...' : 'Refresh AI'}
                                            </button>
                                        </div>
                                        <textarea
                                            name="aiSummary"
                                            value={aiSummaryValue}
                                            onChange={(e) => setAiSummaryValue(e.target.value)}
                                            rows={8}
                                            className="w-full bg-[#5e52ff]/5 border border-[#5e52ff]/10 rounded-2xl px-5 py-4 text-gray-200 focus:outline-none focus:border-[#5e52ff] transition-all text-sm leading-relaxed resize-none"
                                            placeholder="AI generated background info (You can also write your own notes here)..."
                                        />
                                    </div>

                                </form>
                            </div>

                            {/* Sticky Footer (Actions) */}
                            <div className="shrink-0 p-6 md:px-10 md:py-6 border-t border-white/5 bg-[#0b0c10] flex justify-end gap-3 z-30 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="px-6 py-3 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    form="edit-form"
                                    className="px-8 py-3 bg-[#5e52ff] hover:bg-[#4b3ff0] text-white font-bold rounded-xl transition-all shadow-lg shadow-[#5e52ff]/20 flex items-center gap-2"
                                >
                                    <Save size={18} /> Save Changes
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
