'use client';

import { useState, useRef } from 'react';
import { addContactAction, checkDuplicateAction, enrichDraftAction } from '../actions';
import { Plus, X, Upload, Loader2, Sparkles, CheckCircle2, AlertCircle, FileImage, Trash2, Tag, Calendar, AlignLeft, RefreshCw } from 'lucide-react';
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
                    aiSummary: res.result.aiSummary || activeItem.data.aiSummary
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
                phone: formData.get('phone'),
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
    const displayData = activeItem?.data || { name: '', title: '', company: '', email: '', phone: '', metAt: '', notes: '', tags: [] };
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
                                                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest pl-1">Tags</label>
                                                        <div className="relative group">
                                                            <Tag size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-[#5e52ff] transition-colors" />
                                                            <input
                                                                name="tags"
                                                                value={displayData.tags?.join(', ') || ''}
                                                                onChange={(e) => {
                                                                    const val = e.target.value;
                                                                    const newTags = val.split(',').map(s => s.trim()); // Keep empty strings while typing comma
                                                                    // Actually for controlled input of array joined by comma, proper handling is tricky.
                                                                    // Simpler to just store the string in a temporary state?
                                                                    // But efficient way here is just treating tags as string for editing, and array for storage.
                                                                    // But displayData.tags is array.
                                                                    // Let's assume displayData.tags IS array.
                                                                    // We need to be careful not to create new array on every keystroke if it causes issues.
                                                                    // Better: Update the array.
                                                                    // Limit: User types "Tag1, " -> array ["Tag1", ""]
                                                                    updateItemStatus(activeId, activeItem.status, { data: { ...displayData, tags: val.split(',') } });

                                                                    // Logic for tag suggestion query
                                                                    const parts = val.split(',').map(p => p.trim());
                                                                    setTagQuery(parts[parts.length - 1]);
                                                                }}
                                                                className="w-full bg-black/20 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white focus:outline-none focus:border-[#5e52ff] transition-all"
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
