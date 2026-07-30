import {
  FileText, Receipt, HeartPulse, Landmark, Plane, Car, Calculator,
  Shield, Briefcase, Baby, Zap, GraduationCap, Scale, File, type LucideIcon,
} from 'lucide-react';
import type { DocumentCategory } from '@/types/database';

export const categoryIcons: Record<DocumentCategory, LucideIcon> = {
  Invoice: Receipt,
  'Medical Report': HeartPulse,
  'Bank Statement': Landmark,
  Passport: Plane,
  'Driver License': Car,
  Tax: Calculator,
  Insurance: Shield,
  'Employment Contract': Briefcase,
  'Birth Certificate': Baby,
  Receipt: Receipt,
  'Utility Bill': Zap,
  Academic: GraduationCap,
  Legal: Scale,
  Other: File,
};

export const categoryColors: Record<DocumentCategory, { bg: string; text: string; border: string; gradient: string }> = {
  Invoice: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', gradient: 'from-blue-500 to-cyan-500' },
  'Medical Report': { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', gradient: 'from-rose-500 to-pink-500' },
  'Bank Statement': { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', gradient: 'from-emerald-500 to-teal-500' },
  Passport: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', gradient: 'from-amber-500 to-orange-500' },
  'Driver License': { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200', gradient: 'from-indigo-500 to-blue-500' },
  Tax: { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200', gradient: 'from-violet-500 to-purple-500' },
  Insurance: { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200', gradient: 'from-teal-500 to-cyan-500' },
  'Employment Contract': { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200', gradient: 'from-slate-600 to-slate-800' },
  'Birth Certificate': { bg: 'bg-pink-50', text: 'text-pink-700', border: 'border-pink-200', gradient: 'from-pink-500 to-rose-500' },
  Receipt: { bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200', gradient: 'from-cyan-500 to-blue-500' },
  'Utility Bill': { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200', gradient: 'from-yellow-500 to-amber-500' },
  Academic: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', gradient: 'from-purple-500 to-indigo-500' },
  Legal: { bg: 'bg-stone-100', text: 'text-stone-700', border: 'border-stone-200', gradient: 'from-stone-600 to-stone-800' },
  Other: { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-200', gradient: 'from-gray-500 to-slate-500' },
};

export function getCategoryIcon(category: string): LucideIcon {
  return categoryIcons[category as DocumentCategory] || FileText;
}

export function getCategoryColors(category: string) {
  return categoryColors[category as DocumentCategory] || categoryColors.Other;
}
