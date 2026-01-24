'use client';

import { useState, useRef } from 'react';
import { addContactAction, checkDuplicateAction } from '../actions';
import { Plus, X, Upload, Loader2, Sparkles, CheckCircle2, AlertCircle, FileImage, Trash2, Tag, Calendar, AlignLeft } from 'lucide-react';
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

    // Helper to add tag from suggestions
    const addTag = (tag) => {
        if (!tagsInputRef.current) return;
        const currentVal = tagsInputRef.current.value;
        if (currentVal.includes(tag)) return;

        const newVal = currentVal ? `${currentVal}, ${tag}` : tag;
        tagsInputRef.current.value = newVal;
    };

    const suggestedTags = availableTags.slice(0, 20);

    // Handle File Selection
    const handleFileSelect = (e) => {
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

        newItems.forEach(item => processItem(item));
    };

    const processItem = async (item) => {
        updateItemStatus(item.id, 'parsing');

        const formData = new FormData();
        formData.append('file', item.file);

        try {
            const res = await fetch('/api/parse-card', {
                method: 'POST',
                body: formData,
            });

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

    const handleSave = async (formData) => {
        const activeItem = queue.find(i => i.id === activeId);
        if (!activeItem) {
            await addContactAction(formData);
            setIsOpen(false);
            return;
        }

        if (activeItem.data?.aiSummary) {
            formData.set('aiSummary', activeItem.data.aiSummary);
        }

        // RE-CHECK for potential duplicate JUST before saving (catches race conditions in batch)
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

        // Handle Merge/Update if duplicate exists
        if (duplicateId) {
            formData.set('id', duplicateId);
        }

        // Capture ALL fields to update local state so navigation back works
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
            aiSummary: formData.get('aiSummary') || activeItem.data?.aiSummary
        };

        await addContactAction(formData);

        // Update item in queue with the FULL saved data
        updateItemStatus(activeId, 'saved', {
            data: savedData
        });

        const nextItem = queue.find(i => i.id !== activeId && i.status !== 'saved');
        if (nextItem) {
            setActiveId(nextItem.id);
            setTagQuery(''); // Reset tag query
        } else {
            setActiveId(null);
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
                className="fixed bottom-8 right-8 bg-[#5e52ff] hover:bg-[#4b3ff0] text-white px-6 py-4 rounded-full shadow-2xl flex items-center gap-2 font-medium transition-all hover:scale-105 active:scale-95 z-50"
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
                        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                        onClick={handleClose}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className={`bg-[#13151b] border border-white/10 w-full ${isBatchMode ? 'max-w-6xl' : 'max-w-2xl'} rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row max-h-[90vh] transition-all duration-300`}
                            onClick={e => e.stopPropagation()}
                        >

                            {/* LEFT PANEL: Queue List & Upload */}
                            <div className={`w-full ${isBatchMode ? 'md:w-1/3 border-b md:border-b-0 md:border-r border-white/5' : 'hidden'} bg-[#0b0c10] flex flex-col`}>
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
                                                    {item.data?.name || "Business Card"}
                                                </p>
                                                <p className="text-xs text-gray-500 truncate">
                                                    {item.status === 'idle' && 'Waiting...'}
                                                    {item.status === 'parsing' && 'Analyzing...'}
                                                    {item.status === 'success' && 'Ready to review'}
                                                    {item.status === 'error' && 'Failed'}
                                                    {item.status === 'saved' && 'Saved'}
                                                </p>
                                            </div>
                                            {item.status === 'parsing' && <Loader2 size={16} className="text-[#5e52ff] animate-spin" />}
                                            {item.status === 'success' && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                                            {item.status === 'error' && <AlertCircle size={16} className="text-red-500" />}
                                            {item.status === 'saved' && <CheckCircle2 size={16} className="text-green-500" />}
                                            <button
                                                onClick={(e) => removeItem(item.id, e)}
                                                className="absolute right-2 top-2 p-1.5 bg-black/50 rounded-md text-white/60 hover:text-red-400 hover:bg-black opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* RIGHT PANEL: Form */}
                            <div className="flex-1 flex flex-col min-w-0 bg-[#0b0c10]">
                                <div className="p-6 border-b border-white/5 flex justify-between items-center bg-[#13151b] flex-shrink-0">
                                    <h2 className="text-xl font-bold text-white">
                                        {isBatchMode ? (activeItem ? 'Review Details' : 'Batch Processor') : 'New Connection'}
                                    </h2>
                                    <button onClick={handleClose} className="text-gray-500 hover:text-white transition-colors">
                                        <X size={20} />
                                    </button>
                                </div>

                                <div className="p-6 overflow-y-auto flex-1 bg-[#13151b]">
                                    {(!isBatchMode || (isBatchMode && !activeItem && queue.length === 0)) && (
                                        <div className="mb-6">
                                            <input type="file" multiple accept="image/*" ref={fileInputRef} onChange={handleFileSelect} className="hidden" />
                                            <div
                                                onClick={() => fileInputRef.current?.click()}
                                                className="border-2 border-dashed border-white/10 rounded-2xl p-16 flex flex-col items-center justify-center text-center hover:border-[#5e52ff]/50 hover:bg-[#5e52ff]/5 transition-all cursor-pointer group"
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
                                                            {activeItem.duplicate.title && (
                                                                <> as <span className="text-amber-200">{activeItem.duplicate.title}</span> at <span className="text-amber-200">{activeItem.duplicate.company}</span></>
                                                            )}
                                                        </p>

                                                        {activeItem.duplicate.title !== displayData.title && (
                                                            <div className="bg-black/40 p-3 rounded-lg border border-white/5 space-y-2">
                                                                <p className="text-xs font-bold text-gray-400 uppercase">Career Update Detected</p>
                                                                <div className="flex items-center gap-4">
                                                                    <div className="flex-1">
                                                                        <p className="text-[10px] text-gray-500 uppercase">Existing</p>
                                                                        <p className="text-xs text-gray-400">{activeItem.duplicate.title || 'No Title'}</p>
                                                                    </div>
                                                                    <div className="text-gray-600">→</div>
                                                                    <div className="flex-1">
                                                                        <p className="text-[10px] text-amber-500 uppercase font-bold">New Card</p>
                                                                        <p className="text-xs text-white font-medium">{displayData.title || 'No Title'}</p>
                                                                    </div>
                                                                </div>
                                                                <div className="flex gap-4 mt-2 pt-2 border-t border-white/5">
                                                                    <label className="flex items-center gap-2 cursor-pointer group">
                                                                        <input type="radio" name="jobStatus" value="history" defaultChecked className="accent-[#5e52ff]" />
                                                                        <span className="text-[11px] text-gray-300 group-hover:text-white transition-colors underline decoration-dotted">換職位了 (Archive Old)</span>
                                                                    </label>
                                                                    <label className="flex items-center gap-2 cursor-pointer group">
                                                                        <input type="radio" name="jobStatus" value="concurrent" className="accent-[#5e52ff]" />
                                                                        <span className="text-[11px] text-gray-300 group-hover:text-white transition-colors underline decoration-dotted">並存職位 (Keep Both)</span>
                                                                    </label>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}

                                            <form key={activeId} action={handleSave} className="space-y-8">
                                                <div className="space-y-6">
                                                    <div className="space-y-4">
                                                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest pl-1">Professional Identity</label>
                                                        <input
                                                            key={activeId}
                                                            name="name"
                                                            defaultValue={displayData.name}
                                                            onChange={(e) => {
                                                                const newName = e.target.value;
                                                                setQueue(prev => prev.map(item =>
                                                                    item.id === activeId ? { ...item, data: { ...item.data, name: newName } } : item
                                                                ));
                                                            }}
                                                            className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#5e52ff] transition-all"
                                                            placeholder="Full Name (Leave empty if only company)"
                                                        />
                                                        <div className="grid grid-cols-2 gap-4">
                                                            <input key={activeId} name="title" defaultValue={displayData.title} className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#5e52ff] transition-all" placeholder="Title" />
                                                            <input key={activeId} name="company" defaultValue={displayData.company} className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#5e52ff] transition-all" placeholder="Company" />
                                                        </div>
                                                    </div>

                                                    <div className="space-y-4">
                                                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest pl-1">Relationship Context</label>
                                                        <div className="relative">
                                                            <Calendar size={16} className="absolute left-3.5 top-3.5 text-gray-500" />
                                                            <input key={activeId} name="metAt" defaultValue={displayData.metAt} className="w-full bg-black/20 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:border-[#5e52ff] transition-all text-sm" placeholder="Where and when did you meet? (e.g. 2024 Art Expo)" />
                                                        </div>
                                                        <div className="relative">
                                                            <AlignLeft size={16} className="absolute left-3.5 top-3.5 text-gray-500" />
                                                            <textarea key={activeId} name="notes" defaultValue={displayData.notes} rows={2} className="w-full bg-black/20 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:border-[#5e52ff] transition-all text-sm resize-none" placeholder="Additional notes or context..." />
                                                        </div>
                                                    </div>

                                                    <div className="space-y-4">
                                                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest pl-1">Contact Details & Tags</label>
                                                        <div className="grid grid-cols-2 gap-4">
                                                            <input key={activeId} name="email" type="email" defaultValue={displayData.email} className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#5e52ff] transition-all" placeholder="Email" />
                                                            <input key={activeId} name="phone" defaultValue={displayData.phone} className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#5e52ff] transition-all" placeholder="Phone" />
                                                        </div>
                                                        <div className="relative">
                                                            <Tag size={16} className="absolute left-3.5 top-3.5 text-gray-500" />
                                                            <input
                                                                key={activeId}
                                                                ref={tagsInputRef}
                                                                name="tags"
                                                                defaultValue={displayData.tags?.join(', ')}
                                                                onChange={(e) => {
                                                                    const val = e.target.value;
                                                                    const parts = val.split(',').map(p => p.trim());
                                                                    const lastPart = parts[parts.length - 1];
                                                                    setTagQuery(lastPart);
                                                                }}
                                                                className="w-full bg-black/20 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:border-[#5e52ff] transition-all text-sm"
                                                                placeholder="Tags (comma separated)..."
                                                            />
                                                        </div>

                                                        {/* Dynamic Suggested Tags */}
                                                        <div className="flex flex-wrap gap-2 px-1 min-h-[24px]">
                                                            {(tagQuery ?
                                                                availableTags.filter(t => t.toLowerCase().includes(tagQuery.toLowerCase()) && !displayData.tags?.includes(t)) :
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
                                                                    className="text-[10px] px-2 py-0.5 rounded border border-[#5e52ff]/30 bg-[#5e52ff]/5 text-[#5e52ff] hover:bg-[#5e52ff] hover:text-white transition-all font-medium"
                                                                >
                                                                    {tagQuery ? `+ ${tag}` : `#${tag}`}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    {/* AI Background Field */}
                                                    <div className="space-y-4">
                                                        <div className="flex items-center justify-between ml-1">
                                                            <label className="text-[10px] font-bold text-[#5e52ff] uppercase tracking-widest pl-1">AI Intelligence & Research</label>
                                                            <Sparkles className="text-[#5e52ff]" size={14} />
                                                        </div>
                                                        <textarea
                                                            key={activeId}
                                                            name="aiSummary"
                                                            defaultValue={displayData.aiSummary}
                                                            rows={3}
                                                            className="w-full bg-[#5e52ff]/5 border border-[#5e52ff]/10 rounded-xl px-4 py-3 text-gray-300 focus:outline-none focus:border-[#5e52ff] transition-all text-xs leading-relaxed resize-none"
                                                            placeholder="AI generated background info..."
                                                        />
                                                    </div>
                                                </div>

                                                <div className="pt-6 border-t border-white/5 flex gap-3">
                                                    {isBatchMode && (
                                                        <button type="button" onClick={() => updateItemStatus(activeId, 'saved')} className="px-6 py-3 text-gray-500 hover:text-white transition-colors text-sm font-bold">Skip</button>
                                                    )}
                                                    <button type="submit" disabled={activeItem?.status === 'parsing'} className="flex-1 bg-[#5e52ff] hover:bg-[#4b3ff0] disabled:bg-gray-700 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-[#5e52ff]/20 flex items-center justify-center gap-2">
                                                        {isBatchMode ? (activeItem?.status === 'saved' ? 'Update & Next' : 'Save & Next') : 'Add to Connections'}
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
