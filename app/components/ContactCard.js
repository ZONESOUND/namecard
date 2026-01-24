'use client';

import { Mail, Building2, Copy, Trash2, Phone, Sparkles, Pencil, Calendar, ChevronRight } from 'lucide-react';
import { deleteContactAction } from '../actions';
import { useState } from 'react';

export default function ContactCard({ contact, availableTags = [], isSelected, onSelect, onEdit }) {
    const [copied, setCopied] = useState(false);

    const initials = contact.name.slice(0, 2).toUpperCase();

    // Generate a consistent color for the avatar based on name length
    const colors = ['bg-blue-500', 'bg-violet-500', 'bg-emerald-500', 'bg-rose-500', 'bg-amber-500'];
    const colorIndex = contact.name.length % colors.length;
    const avatarColor = colors[colorIndex];

    const copyEmail = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (contact.email) {
            navigator.clipboard.writeText(contact.email);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    }

    return (
        <div
            onClick={() => onEdit(contact)}
            className={`group relative flex flex-col h-full bg-[#13151b] border rounded-xl transition-all duration-300 shadow-sm hover:shadow-2xl hover:-translate-y-1 p-5 cursor-pointer ${isSelected ? 'border-[#5e52ff] bg-[#5e52ff]/5' : 'border-white/5 hover:border-white/10 hover:bg-[#1a1d24]'
                }`}
        >
            {/* Selection Checkbox */}
            <div
                className={`absolute -top-2 -left-2 z-10 h-6 w-6 rounded-md border flex items-center justify-center transition-all ${isSelected ? 'bg-[#5e52ff] border-[#5e52ff] text-white shadow-lg' : 'bg-[#1a1d24] border-white/10 text-transparent opacity-0 group-hover:opacity-100 h-5 w-5 -top-1 -left-1'
                    }`}
                onClick={(e) => {
                    e.stopPropagation();
                    onSelect(contact.id);
                }}
            >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
            </div>

            {/* Absolute Actions */}
            <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                <button
                    onClick={(e) => { e.stopPropagation(); onEdit(contact); }}
                    className="p-1.5 text-gray-500 hover:text-[#5e52ff] hover:bg-white/5 rounded-lg transition-colors"
                    title="Edit Details"
                >
                    <Pencil size={15} />
                </button>
                <button
                    onClick={(e) => { e.stopPropagation(); if (confirm('Delete this contact?')) deleteContactAction(contact.id); }}
                    className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                    title="Delete Contact"
                >
                    <Trash2 size={15} />
                </button>
            </div>

            <div className="flex items-start gap-4 mb-5 pr-12">
                <div className={`h-11 w-11 rounded-full flex-shrink-0 flex items-center justify-center text-white font-bold text-base shadow-inner ${avatarColor}`}>
                    {initials}
                </div>
                <div className="flex-1 min-w-0">
                    <h3 className="text-base font-bold text-white leading-tight truncate">{contact.name}</h3>
                    <p className="text-xs text-gray-500 font-medium truncate mt-1">{contact.title}</p>
                </div>
            </div>

            <div className="space-y-3 flex-1">
                {contact.company && (
                    <div className="flex items-center gap-3 text-sm text-gray-400">
                        <Building2 size={13} className="text-gray-600 flex-shrink-0" />
                        <span className="truncate">{contact.company}</span>
                    </div>
                )}

                {contact.email && (
                    <div
                        onClick={copyEmail}
                        className="group/email flex items-center justify-between py-1 px-2 -ml-2 rounded-lg hover:bg-white/5 cursor-pointer transition-colors"
                    >
                        <div className="flex items-center gap-3 overflow-hidden">
                            <Mail size={13} className="text-gray-600 flex-shrink-0 group-hover/email:text-[#5e52ff] transition-colors" />
                            <span className="text-sm text-gray-500 group-hover/email:text-gray-300 transition-colors truncate">
                                {contact.email}
                            </span>
                        </div>
                        {copied && <span className="text-[10px] text-green-500 font-mono font-bold">COPIED</span>}
                    </div>
                )}
            </div>

            <div className="mt-5 pt-4 border-t border-white/5">
                <div className="flex flex-wrap gap-1.5 min-h-[1.5rem]">
                    {contact.tags?.map(tag => (
                        <span key={tag} className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-white/5 text-gray-600 border border-white/5 uppercase tracking-wider">
                            {tag}
                        </span>
                    ))}
                </div>
            </div>

            {contact.aiSummary && (
                <div className="absolute bottom-[72px] right-5 opacity-0 group-hover:opacity-100 transition-all transform translate-y-1 group-hover:translate-y-0">
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#5e52ff]/10 text-[#5e52ff] border border-[#5e52ff]/20">
                        <Sparkles size={10} />
                    </div>
                </div>
            )}
        </div>
    );
}
