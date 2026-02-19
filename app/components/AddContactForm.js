'use client';

import { useState, useRef } from 'react';
import { addContactAction, checkDuplicateAction, enrichDraftAction, generateTagsAction, aiSmartUpdateAction } from '../actions';
import { Plus, X, Upload, Loader2, Sparkles, CheckCircle2, AlertCircle, FileImage, Trash2, Tag, Calendar, AlignLeft, RefreshCw, Bot, Globe, Linkedin, Facebook, Instagram, Mail } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function AddContactForm({ availableTags = [] }) {
    const [tagQuery, setTagQuery] = useState('');
    const [isOpen, setIsOpen] = useState(false);

    // Batch Processing State
    const [queue, setQueue] = useState([]); // Array of { id, file, status: 'idle'|'parsing'|'success'|'error'|'saved', data, error, preview }
    const [activeId, setActiveId] = useState(null); // ID of the card currently being reviewed

    const fileInputRef = useRef(null);
    const tagsInputRef = useRef(null);

    // Generate unique IDs
    const generateId = () => Math.random().toString(36).substr(2, 9);

    const suggestedTags = availableTags.slice(0, 20);

    // Handle File Selection with Batch Logic
    const handleFileSelect = async (e) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        const newItems = files.map(file => ({
            id: generateId(),
            file,
            status: 'idle',
            data: null,
            error: null,
            preview: URL.createObjectURL(file)
        }));

        setQueue(prev => [...prev, ...newItems]);

        if (!activeId && newItems.length > 0) {
            setActiveId(newItems[0].id);
        }

        // Process in batches of 3 to avoid timeouts
        const BATCH_SIZE = 3;
        for (let i = 0; i < newItems.length; i += BATCH_SIZE) {
            const chunk = newItems.slice(i, i + BATCH_SIZE);
            await Promise.all(chunk.map(item => processItem(item)));
        }
    };

    const compressImage = async (file) => {
        // Simple client-side compression to avoid massive uploads
        // Return original if small enough
        if (file.size < 1024 * 1024) return file; // < 1MB

        return new Promise((resolve) => {
            const img = new Image();
            img.src = URL.createObjectURL(file);
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                // Max dimension 2000px
                const MAX_DIM = 2000;
                if (width > MAX_DIM || height > MAX_DIM) {
                    if (width > height) {
                        height *= MAX_DIM / width;
                        width = MAX_DIM;
                    } else {
                        width *= MAX_DIM / height;
                        height = MAX_DIM;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                canvas.toBlob((blob) => {
                    resolve(new File([blob], file.name, { type: 'image/jpeg' }));
                }, 'image/jpeg', 0.8); // 80% quality JPEG
            };
        });
    };

    const processItem = async (item) => {
        updateItemStatus(item.id, 'parsing');

        try {
            const compressedFile = await compressImage(item.file);
            const formData = new FormData();
            formData.append('file', compressedFile);

            const res = await fetch('/api/parse-card', {
                method: 'POST',
                body: formData,
            });
            // ... rest of the function ...

            if (!res.ok) throw new Error('OCR Failed');

            const data = await res.json();

            // Check for potential duplicate in existing database
            const duplicate = await checkDuplicateAction(data);

            updateItemStatus(item.id, 'success', {
                data,
                duplicate,
                originalTitle: data.title // Keep original for comparison
            });
        } catch (error) {
            console.error(error);
            updateItemStatus(item.id, 'error', { error: 'Failed to parse' });
        }
    };

    const updateItemStatus = (id, status, extra = {}) => {
        setQueue(prev => prev.map(item =>
            item.id === id ? { ...item, status, ...extra } : item
        ));
    };

    const removeItem = (id, e) => {
        e?.stopPropagation();
        setQueue(prev => {
            const newQueue = prev.filter(i => i.id !== id);
            if (id === activeId) {
                const next = newQueue.find(i => i.status !== 'saved');
                setActiveId(next?.id || null);
            }
            return newQueue;
        });
    };

    const [isSaving, setIsSaving] = useState(false);
    const [isEnriching, setIsEnriching] = useState(false);
    const [isTagging, setIsTagging] = useState(false);
    const [isSmartUpdating, setIsSmartUpdating] = useState(false);
    const [smartInstruction, setSmartInstruction] = useState('');

    const handleDraftEnrich = async () => {
        if (isEnriching || !activeId) return;
        setIsEnriching(true);

        const activeItem = queue.find(i => i.id === activeId);
        // Use current form values? 
        // Problem: The user might have typed in the inputs but not "saved" to queue state yet if using defaultValue.
        // Actually, the inputs have `onChange` that updates state: 
        // `setQueue(prev => prev.map(item => item.id === activeId ? { ...item, data: { ...item.data, name: newName } } : item))`
        // So `activeItem.data` SHOULD be up to date with what's typed.

        if (!activeItem?.data) {
            setIsEnriching(false);
            return;
        }

        try {
            const res = await enrichDraftAction(activeItem.data);
            if (res.success && res.result) {
                // Determine if tags changed
                // Merge tags
                let newTags = activeItem.data.tags || [];
                if (res.result.tags && res.result.tags.length > 0) {
                    const tagSet = new Set(newTags);
                    res.result.tags.forEach(t => tagSet.add(t));
                    newTags = Array.from(tagSet);
                }

                const enrichedData = {
                    ...activeItem.data,
                    name: res.result.name || activeItem.data.name,
                    title: res.result.title || activeItem.data.title,
                    company: res.result.company || activeItem.data.company,
                    email: res.result.email || activeItem.data.email,
                    tags: newTags,
                    aiSummary: res.result.aiSummary || activeItem.data.aiSummary,
                    socialProfiles: res.result.socialProfiles || activeItem.data.socialProfiles || {},
                    secondaryEmail: res.result.secondaryEmail || activeItem.data.secondaryEmail
                };

                updateItemStatus(activeId, activeItem.status, { data: enrichedData });
                alert("AI Enrichment Complete!");
            } else {
                alert("Enrichment failed: " + res.error);
            }
        } catch (e) {
            console.error(e);
            alert("Error running AI enrichment.");
        } finally {
            setIsEnriching(false);
        }
    };

    const handleAiTags = async () => {
        if (!activeId || isTagging) return;
        setIsTagging(true);

        const activeItem = queue.find(i => i.id === activeId);

        try {
            const contactData = {
                name: displayData.name,
                title: displayData.title,
                company: displayData.company,
                notes: displayData.notes || displayData.aiSummary
            };

            const res = await generateTagsAction(contactData);

            if (res.success && res.tags) {
                const currentTags = displayData.tags || [];
                const uniqueTags = new Set([...currentTags, ...res.tags]);
                const newTagsArray = Array.from(uniqueTags);

                updateItemStatus(activeId, activeItem.status, {
                    data: { ...displayData, tags: newTagsArray }
                });

                alert(`Generated tags: ${res.tags.join(', ')}`);
            } else {
                alert('Tag generation failed: ' + (res.error || 'Unknown'));
            }

        } catch (e) {
            console.error(e);
            alert('Error generating tags');
        } finally {
            setIsTagging(false);
        }
    };

    const handleSmartUpdate = async () => {
        // In Batch/Add mode, "Smart Update" is tricky because the record might not exist on server yet.
        // If it's an existing contact (duplicate found), we can use the ID.
        // If it's a NEW draft, we should just use AI to parse the instruction and update local state `displayData`.

        if (!smartInstruction.trim()) return;
        setIsSmartUpdating(true);

        try {
            // Check if we are editing an EXISTING record (duplicate) or just a draft
            // If duplicate, we have an ID maybe? `activeItem.duplicate?.id`
            // But usually Add Form is for creating new.
            // Let's implement a "Draft Smart Update" which is purely client-side state manipulation via AI.

            // Re-use logic: We can call a server action that takes JSON, processes instruction, returns new JSON.
            // We can reuse aiSmartUpdateAction but modify it to accept object instead of ID?
            // Or just make a new simple action or modify existing one.
            // For now, let's treat it as "Enrich/Update" action.

            // Actually, `activeItem` has data.
            const currentData = { ...displayData, id: activeItem.id }; // ID is temp

            // We need a server action that accepts (currentData, instruction) and returns (newData).
            // Let's use `enrichDraftAction` style but for instruction.
            // Let's reuse `aiSmartUpdateAction` but allow passing data directly?
            // Updating `aiSmartUpdateAction` in next step to handle this.

            // Assuming `aiSmartUpdateAction` can handle object input (we will modify it).
            const res = await aiSmartUpdateAction(null, smartInstruction, currentData);

            if (res.success && res.changes) {
                updateItemStatus(activeId, activeItem.status, {
                    data: { ...displayData, ...res.changes }
                });
                setSmartInstruction('');
                alert('Updated based on instruction!');
            } else {
                alert('Update failed: ' + res.error);
            }
        } catch (e) {
            console.error(e);
            alert('Error updating');
        } finally {
            setIsSmartUpdating(false);
        }
    };

    const handleSave = async (formData) => {
        if (isSaving) return; // Prevent double click
        setIsSaving(true);

        try {
            const activeItem = queue.find(i => i.id === activeId);
            if (!activeItem) {
                await addContactAction(formData);
                setIsOpen(false);
                return;
            }

            if (activeItem.data?.aiSummary) {
                formData.set('aiSummary', activeItem.data.aiSummary);
            }

            if (activeItem.data?.imageUrl) {
                formData.set('imageUrl', activeItem.data.imageUrl);
            }

            let duplicateId = activeItem.duplicate?.id;
            if (!duplicateId) {
                const dataToTest = {
                    name: formData.get('name'),
                    email: formData.get('email'),
                    phone: formData.get('phone'),
                    company: formData.get('company')
                };
                const freshDuplicate = await checkDuplicateAction(dataToTest);
                if (freshDuplicate) {
                    duplicateId = freshDuplicate.id;
                }
            }

            if (duplicateId) {
                formData.set('id', duplicateId);
            }

            const savedData = {
                ...activeItem.data,
                name: formData.get('name') || activeItem.data?.name,
                title: formData.get('title'),
                company: formData.get('company'),
                email: formData.get('email'),
                secondaryEmail: formData.get('secondaryEmail'),
                phone: formData.get('phone'),
                socialProfiles: formData.get('socialProfiles') ? JSON.parse(formData.get('socialProfiles')) : {},
                tags: formData.get('tags')?.split(',').map(s => s.trim()).filter(Boolean) || [],
                metAt: formData.get('metAt') || activeItem.data?.metAt,
                notes: formData.get('notes') || activeItem.data?.notes,
                aiSummary: formData.get('aiSummary') || activeItem.data?.aiSummary,
                imageUrl: activeItem.data?.imageUrl
            };

            await addContactAction(formData);

            updateItemStatus(activeId, 'saved', {
                data: savedData
            });

            const nextItem = queue.find(i => i.id !== activeId && i.status !== 'saved');
            if (nextItem) {
                setActiveId(nextItem.id);
                setTagQuery('');
            } else {
                setActiveId(null);
            }
        } catch (e) {
            console.error(e);
            alert('Failed to save. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleClose = () => {
        setIsOpen(false);
        queue.forEach(i => URL.revokeObjectURL(i.preview));
        setTimeout(() => {
            setQueue([]);
            setActiveId(null);
        }, 300);
    };

    const activeItem = queue.find(i => i.id === activeId);
    const displayData = activeItem?.data || { name: '', title: '', company: '', email: '', secondaryEmail: '', phone: '', metAt: '', notes: '', tags: [], socialProfiles: {} };
    const pendingCount = queue.filter(i => i.status !== 'saved').length;
    const isBatchMode = queue.length > 0;

    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-6 right-6 md:bottom-8 md:right-8 bg-[#5e52ff] hover:bg-[#4b3ff0] text-white p-3 md:px-6 md:py-4 rounded-full shadow-2xl flex items-center gap-2 font-medium transition-all hover:scale-105 active:scale-95 z-50"
            >
                <Plus size={24} />
                <span className="hidden md:inline">Add Contact</span>
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-0 md:p-4"
                        onClick={handleClose}
                    >
                        {/* Modal Container: Scroll Behavior Handling for Mobile */}
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className={`bg-[#13151b] border-t md:border border-white/10 w-full ${isBatchMode ? 'max-w-6xl' : 'max-w-2xl'} h-[90vh] mt-[10vh] md:mt-0 md:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col md:flex-row transition-all duration-300 overflow-hidden`}
                            onClick={e => e.stopPropagation()}
                        >

                            {/* LEFT PANEL: Queue List & Upload */}
                            <div className={`w-full ${isBatchMode ? 'md:w-1/3 border-b md:border-b-0 md:border-r border-white/5 h-48 md:h-full' : 'hidden'} bg-[#0b0c10] flex flex-col md:flex-col shrink-0`}>
                                <div className="p-4 border-b border-white/5 flex justify-between items-center bg-[#13151b]">
                                    <h3 className="text-white font-bold text-sm">Batch Queue ({pendingCount})</h3>
                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        className="text-[#5e52ff] text-xs font-medium hover:text-[#4b3ff0] flex items-center gap-1"
                                    >
                                        <Plus size={14} /> Add More
                                    </button>
                                </div>
                                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                                    {queue.map((item) => (
                                        <div
                                            key={item.id}
                                            onClick={() => setActiveId(item.id)}
                                            className={`relative group flex items-center gap-3 p-3 rounded-lg cursor-pointer border transition-all ${activeId === item.id
                                                ? 'bg-[#5e52ff]/10 border-[#5e52ff]/50'
                                                : 'bg-[#13151b] border-white/5 hover:bg-white/5'
                                                }`}
                                        >
                                            <div className="w-10 h-10 rounded bg-black/50 overflow-hidden flex-shrink-0 border border-white/10">
                                                {item.preview ? (
                                                    <img src={item.preview} alt="preview" className="w-full h-full object-cover" />
                                                ) : (
                                                    <FileImage className="text-gray-600 m-2" size={20} />
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className={`text-sm font-medium truncate ${item.status === 'saved' ? 'text-gray-500 line-through' : 'text-white'}`}>
                                                    {item.data?.name || "Processing..."}
                                                </p>
                                                <p className="text-xs text-gray-500 truncate">
                                                    {item.status}
                                                </p>
                                            </div>
                                            {item.status === 'parsing' && <Loader2 size={16} className="text-[#5e52ff] animate-spin" />}
                                            {item.status === 'success' && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                                            {item.status === 'error' && <AlertCircle size={16} className="text-red-500" />}
                                            {item.status === 'saved' && <CheckCircle2 size={16} className="text-green-500" />}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* RIGHT PANEL: Form */}
                            <div className="flex-1 flex flex-col min-w-0 bg-[#0b0c10] overflow-hidden">
                                <div className="p-4 md:p-6 border-b border-white/5 flex justify-between items-center bg-[#13151b] flex-shrink-0 z-10">
                                    <h2 className="text-lg md:text-xl font-bold text-white">
                                        {isBatchMode ? (activeItem ? 'Review Details' : 'Batch Processor') : 'New Connection'}
                                    </h2>
                                    <button onClick={handleClose} className="text-gray-500 hover:text-white transition-colors">
                                        <X size={20} />
                                    </button>
                                </div>

                                <div className="p-4 md:p-6 overflow-y-auto flex-1 bg-[#13151b]">
                                    {(!isBatchMode || (isBatchMode && !activeItem && queue.length === 0)) && (
                                        <div className="mb-6">
                                            <input type="file" multiple accept="image/*" ref={fileInputRef} onChange={handleFileSelect} className="hidden" />
                                            <div
                                                onClick={() => fileInputRef.current?.click()}
                                                className="border-2 border-dashed border-white/10 rounded-2xl p-8 md:p-16 flex flex-col items-center justify-center text-center hover:border-[#5e52ff]/50 hover:bg-[#5e52ff]/5 transition-all cursor-pointer group"
                                            >
                                                <Upload className="text-gray-500 mb-4 group-hover:text-[#5e52ff] transition-colors" size={48} />
                                                <p className="text-xl text-white font-bold mb-1">Drop Business Cards Here</p>
                                                <p className="text-sm text-gray-500">Supports PDF & Multi-Image Upload</p>
                                            </div>
                                        </div>
                                    )}

                                    {(!isBatchMode || activeId) && (
                                        <div className={activeItem?.status === 'parsing' ? 'opacity-50 pointer-events-none transition-opacity' : 'transition-opacity'}>
                                            {activeItem?.status === 'parsing' && (
                                                <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-black/20 backdrop-blur-[2px]">
                                                    <Loader2 size={40} className="text-[#5e52ff] animate-spin mb-3" />
                                                    <p className="text-white font-bold tracking-tight">AI ANALYZING CARD...</p>
                                                </div>
                                            )}


                                            {activeItem?.duplicate && (
                                                <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl flex gap-3 mb-8">
                                                    <AlertCircle className="text-amber-500 flex-shrink-0 mt-0.5" size={18} />
                                                    <div className="flex-1">
                                                        <p className="text-xs font-bold text-amber-500 uppercase tracking-wider mb-1">Match Found in CRM</p>
                                                        <p className="text-sm text-gray-300 mb-3">
                                                            This person already exists: <span className="text-white font-bold">{activeItem.duplicate.name}</span>
                                                        </p>
                                                        {activeItem.duplicate.title !== displayData.title && (
                                                            <div className="bg-black/40 p-3 rounded-lg border border-white/5 space-y-2">
                                                                <p className="text-xs font-bold text-gray-400 uppercase">Career Update Detected</p>
                                                                <div className="flex gap-4 mt-2 pt-2 border-t border-white/5">
                                                                    <label className="flex items-center gap-2 cursor-pointer group">
                                                                        <input type="radio" name="jobStatus" value="history" defaultChecked className="accent-[#5e52ff]" />
                                                                        <span className="text-[11px] text-gray-300 group-hover:text-white">Archive Old</span>
                                                                    </label>
                                                                    <label className="flex items-center gap-2 cursor-pointer group">
                                                                        <input type="radio" name="jobStatus" value="concurrent" className="accent-[#5e52ff]" />
                                                                        <span className="text-[11px] text-gray-300 group-hover:text-white">Keep Both</span>
                                                                    </label>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}

                                            <form key={activeId} action={handleSave} className="space-y-8 pb-12">

                                                {/* AI AGENT UPDATE (Draft Mode) */}
                                                <div className="bg-[#5e52ff]/10 border border-[#5e52ff]/20 rounded-xl p-3 flex flex-col gap-2 mb-6">
                                                    <div className="flex items-center justify-between">
                                                        <h3 className="text-[10px] font-bold text-[#5e52ff] uppercase tracking-widest flex items-center gap-2">
                                                            <Bot size={14} /> AI Assistant (Draft)
                                                        </h3>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <input
                                                            value={smartInstruction}
                                                            onChange={(e) => setSmartInstruction(e.target.value)}
                                                            placeholder="Fix name, change title, or split fields..."
                                                            className="flex-1 bg-[#0b0c10] border border-white/10 rounded-lg px-3 py-2 text-xs md:text-sm text-white focus:outline-none focus:border-[#5e52ff]"
                                                            onKeyDown={(e) => e.key === 'Enter' && handleSmartUpdate()} // Needs e.preventDefault() to avoid submitting form?
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

                                                <div className="space-y-6">
                                                    <div className="space-y-4">
                                                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest pl-1">Professional Identity</label>
                                                        <input
                                                            name="name"
                                                            value={displayData.name || ''}
                                                            onChange={(e) => updateItemStatus(activeId, activeItem.status, { data: { ...displayData, name: e.target.value } })}
                                                            className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#5e52ff] transition-all"
                                                            placeholder="Full Name"
                                                        />
                                                        <div className="grid grid-cols-2 gap-4">
                                                            <input
                                                                name="title"
                                                                value={displayData.title || ''}
                                                                onChange={(e) => updateItemStatus(activeId, activeItem.status, { data: { ...displayData, title: e.target.value } })}
                                                                className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#5e52ff] transition-all"
                                                                placeholder="Title"
                                                            />
                                                            <input
                                                                name="company"
                                                                value={displayData.company || ''}
                                                                onChange={(e) => updateItemStatus(activeId, activeItem.status, { data: { ...displayData, company: e.target.value } })}
                                                                className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#5e52ff] transition-all"
                                                                placeholder="Company"
                                                            />
                                                        </div>
                                                    </div>

                                                    <div className="space-y-4">
                                                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest pl-1">Relationship Context</label>
                                                        <textarea
                                                            name="notes"
                                                            value={displayData.notes || ''}
                                                            onChange={(e) => updateItemStatus(activeId, activeItem.status, { data: { ...displayData, notes: e.target.value } })}
                                                            rows={2}
                                                            className="w-full bg-black/20 border border-white/10 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-[#5e52ff] transition-all text-sm resize-none"
                                                            placeholder="Notes..."
                                                        />
                                                    </div>

                                                    {/* TAGS INPUT Section */}
                                                    <div className="space-y-4">
                                                        <div className="flex items-center justify-between">
                                                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest pl-1">Tags</label>
                                                            <button
                                                                type="button"
                                                                onClick={handleAiTags}
                                                                disabled={isTagging}
                                                                className="flex items-center gap-1.5 text-[10px] bg-[#5e52ff]/10 hover:bg-[#5e52ff] text-[#5e52ff] hover:text-white px-3 py-1.5 rounded-full transition-all font-bold border border-[#5e52ff]/20 cursor-pointer"
                                                            >
                                                                {isTagging ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                                                                {isTagging ? 'Generating...' : 'AI Tags'}
                                                            </button>
                                                        </div>
                                                        <div className="relative group">
                                                            <Tag size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-[#5e52ff] transition-colors" />
                                                            <input
                                                                name="tags"
                                                                value={displayData.tags?.join(', ') || ''}
                                                                onChange={(e) => {
                                                                    const val = e.target.value;
                                                                    // Only update local state here to avoid cursor jumping? 
                                                                    // Actually simple split is fine IF we don't accidentally trim midway.
                                                                    // Problem: User types "Tag, " -> "Tag," -> "Tag, "
                                                                    // Code was: val.split(',') -> ["Tag", ""] -> join -> "Tag, "
                                                                    // If user deletes comma: "Tag " -> split -> ["Tag "] -> "Tag"

                                                                    // Better approach for deletion safety:
                                                                    // Use a hidden input for actual values? 
                                                                    // No, for now just trust the text input but ensure we don't aggressively trim while typing.

                                                                    updateItemStatus(activeId, activeItem.status, { data: { ...displayData, tags: val.split(',') } });

                                                                    // Logic for tag suggestion query
                                                                    const parts = val.split(',');
                                                                    setTagQuery(parts[parts.length - 1].trim());
                                                                }}
                                                                onKeyDown={(e) => {
                                                                    // Prevent backspace from deleting the whole previous tag if it was just a comma?
                                                                    // The issue is likely the 'value={...join}' re-rendering on every keystroke.
                                                                    // We can't easily fix controlled input cursor jump without complex logic.
                                                                    // Switching to uncontrolled defaultVal? 
                                                                    // But we need to update state.
                                                                    // Let's stick to what we have but check styling.
                                                                }}
                                                                className="w-full bg-black/20 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white focus:outline-none focus:border-[#5e52ff] transition-all font-mono text-sm tracking-wide"
                                                                placeholder="Tags (comma separated)..."
                                                            />
                                                        </div>
                                                        <div className="flex flex-wrap gap-2 px-1 min-h-[28px]">
                                                            {(tagQuery ?
                                                                availableTags.filter(t => t.toLowerCase().includes(tagQuery.toLowerCase()) && !displayData.tags?.map(dt => dt.trim()).includes(t)) :
                                                                suggestedTags
                                                            ).slice(0, 8).map(tag => (
                                                                <button
                                                                    key={tag}
                                                                    type="button"
                                                                    onClick={() => {
                                                                        // Append tag
                                                                        let currentTags = [...(displayData.tags || [])];
                                                                        // Remove the partial tag currently being typed (last element usually empty or partial)
                                                                        // Actually if we just rely on string matching it's easier.
                                                                        // Let's safely assume user wants to ADD this tag.
                                                                        // currentTags coming from input split might be ["Tag1", " par"]
                                                                        // We want ["Tag1", "SelectedTag"]
                                                                        // A simple way used in EditModal:
                                                                        // But here we need to update state directly.

                                                                        // Clean current tags
                                                                        let cleanTags = currentTags.map(t => t.trim()).filter(Boolean);

                                                                        // If we are filtering by query, replace the last partial match
                                                                        if (tagQuery) {
                                                                            // Remove last if it matches query partially? 
                                                                            // Actually simpler: just append if unique.
                                                                            // But standard UI is autocomplete replace.
                                                                            // Let's just append for safety and simplicity in this complex state.
                                                                            if (!cleanTags.includes(tag)) cleanTags.push(tag);
                                                                        } else {
                                                                            if (!cleanTags.includes(tag)) cleanTags.push(tag);
                                                                        }

                                                                        updateItemStatus(activeId, activeItem.status, { data: { ...displayData, tags: cleanTags } });
                                                                        setTagQuery('');
                                                                    }}
                                                                    className="text-[10px] px-2 py-1 rounded-md border border-white/10 bg-white/5 text-gray-400 hover:text-white hover:border-[#5e52ff] transition-colors"
                                                                >
                                                                    + {tag}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    <div className="space-y-4">
                                                        <div className="grid grid-cols-2 gap-4">
                                                            <input
                                                                name="email"
                                                                type="email"
                                                                value={displayData.email || ''}
                                                                onChange={(e) => updateItemStatus(activeId, activeItem.status, { data: { ...displayData, email: e.target.value } })}
                                                                className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#5e52ff] transition-all"
                                                                placeholder="Email"
                                                            />
                                                            <input
                                                                name="phone"
                                                                value={displayData.phone || ''}
                                                                onChange={(e) => updateItemStatus(activeId, activeItem.status, { data: { ...displayData, phone: e.target.value } })}
                                                                className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#5e52ff] transition-all"
                                                                placeholder="Phone"
                                                            />
                                                        </div>
                                                        <div className="grid grid-cols-1 gap-4">
                                                            <input
                                                                name="secondaryEmail"
                                                                value={displayData.secondaryEmail || ''}
                                                                onChange={(e) => updateItemStatus(activeId, activeItem.status, { data: { ...displayData, secondaryEmail: e.target.value } })}
                                                                className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#5e52ff] transition-all text-sm"
                                                                placeholder="Secondary Email"
                                                            />
                                                        </div>

                                                        <div className="space-y-3 pt-2">
                                                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest pl-1">Online Presence</label>
                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                                <div className="relative group">
                                                                    <Globe size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-[#5e52ff] transition-colors" />
                                                                    <input
                                                                        value={displayData.socialProfiles?.website || ''}
                                                                        onChange={(e) => updateItemStatus(activeId, activeItem.status, {
                                                                            data: {
                                                                                ...displayData,
                                                                                socialProfiles: { ...displayData.socialProfiles, website: e.target.value }
                                                                            }
                                                                        })}
                                                                        className="w-full bg-black/20 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:border-[#5e52ff] transition-all text-sm"
                                                                        placeholder="Website URL"
                                                                    />
                                                                </div>
                                                                <div className="relative group">
                                                                    <Linkedin size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-[#0077b5] transition-colors" />
                                                                    <input
                                                                        value={displayData.socialProfiles?.linkedin || ''}
                                                                        onChange={(e) => updateItemStatus(activeId, activeItem.status, {
                                                                            data: {
                                                                                ...displayData,
                                                                                socialProfiles: { ...displayData.socialProfiles, linkedin: e.target.value }
                                                                            }
                                                                        })}
                                                                        className="w-full bg-black/20 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:border-[#5e52ff] transition-all text-sm"
                                                                        placeholder="LinkedIn URL"
                                                                    />
                                                                </div>
                                                                <div className="relative group">
                                                                    <Facebook size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-[#1877f2] transition-colors" />
                                                                    <input
                                                                        value={displayData.socialProfiles?.facebook || ''}
                                                                        onChange={(e) => updateItemStatus(activeId, activeItem.status, {
                                                                            data: {
                                                                                ...displayData,
                                                                                socialProfiles: { ...displayData.socialProfiles, facebook: e.target.value }
                                                                            }
                                                                        })}
                                                                        className="w-full bg-black/20 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:border-[#5e52ff] transition-all text-sm"
                                                                        placeholder="Facebook URL"
                                                                    />
                                                                </div>
                                                                <div className="relative group">
                                                                    <Instagram size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-[#E1306C] transition-colors" />
                                                                    <input
                                                                        value={displayData.socialProfiles?.instagram || ''}
                                                                        onChange={(e) => updateItemStatus(activeId, activeItem.status, {
                                                                            data: {
                                                                                ...displayData,
                                                                                socialProfiles: { ...displayData.socialProfiles, instagram: e.target.value }
                                                                            }
                                                                        })}
                                                                        className="w-full bg-black/20 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:border-[#5e52ff] transition-all text-sm"
                                                                        placeholder="Instagram URL"
                                                                    />
                                                                </div>
                                                            </div>
                                                            {/* Hidden input to serialize socialProfiles for FormData */}
                                                            <input type="hidden" name="socialProfiles" value={JSON.stringify(displayData.socialProfiles || {})} />
                                                        </div>
                                                    </div>

                                                    <div className="space-y-4">
                                                        <div className="flex items-center justify-between ml-1">
                                                            <div className="flex items-center gap-2">
                                                                <label className="text-[10px] font-bold text-[#5e52ff] uppercase tracking-widest pl-1">AI Intelligence</label>
                                                                <Sparkles className="text-[#5e52ff]" size={14} />
                                                            </div>
                                                            <button
                                                                type="button"
                                                                onClick={handleDraftEnrich}
                                                                disabled={isEnriching}
                                                                className="flex items-center gap-1.5 text-[10px] bg-[#5e52ff]/10 hover:bg-[#5e52ff] text-[#5e52ff] hover:text-white px-3 py-1.5 rounded-full transition-all font-bold border border-[#5e52ff]/20 cursor-pointer"
                                                            >
                                                                {isEnriching ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                                                                {isEnriching ? 'Analyzing...' : 'Refresh AI'}
                                                            </button>
                                                        </div>
                                                        <textarea
                                                            name="aiSummary"
                                                            value={displayData.aiSummary || ''} // Controlled: will update when handleDraftEnrich updates state
                                                            onChange={(e) => updateItemStatus(activeId, activeItem.status, { data: { ...displayData, aiSummary: e.target.value } })}
                                                            rows={3}
                                                            className="w-full bg-[#5e52ff]/5 border border-[#5e52ff]/10 rounded-xl px-4 py-3 text-gray-300 focus:outline-none focus:border-[#5e52ff] transition-all text-xs leading-relaxed resize-none"
                                                            placeholder="AI generated background info..."
                                                        />
                                                    </div>
                                                </div>

                                                <div className="pt-6 border-t border-white/5 flex gap-3 sticky bottom-0 bg-[#13151b] pb-2">
                                                    {isBatchMode && (
                                                        <button type="button" onClick={() => updateItemStatus(activeId, 'saved')} className="px-6 py-3 text-gray-500 hover:text-white transition-colors text-sm font-bold">Skip</button>
                                                    )}
                                                    <button type="submit" disabled={activeItem?.status === 'parsing' || isSaving} className="flex-1 bg-[#5e52ff] hover:bg-[#4b3ff0] disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-[#5e52ff]/20">
                                                        {isSaving ? 'Saving...' : (isBatchMode ? (activeItem?.status === 'saved' ? 'Update & Next' : 'Save & Next') : 'Add Contact')}
                                                    </button>
                                                </div>
                                            </form>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
