import React, { useState } from 'react';
import { Check, Copy, Heart, Loader2, Send, CheckSquare, Square } from 'lucide-react';
import type { DecorCategory, DecorProposal } from '../types';

interface ProposalViewProps {
  proposal: DecorProposal;
  focusCategory: DecorCategory;
  isFavorite: boolean;
  completedSteps: number[];
  isRefining: boolean;
  onToggleFavorite: () => void;
  onToggleStep: (index: number) => void;
  onRefine: (prompt: string) => Promise<void>;
}

export function ProposalView({
  proposal,
  focusCategory,
  isFavorite,
  completedSteps,
  isRefining,
  onToggleFavorite,
  onToggleStep,
  onRefine,
}: ProposalViewProps) {
  const [copiedHex, setCopiedHex] = useState<string | null>(null);
  const [refineText, setRefineText] = useState('');

  const handleCopyHex = async (hex: string) => {
    try {
      await navigator.clipboard.writeText(hex);
      setCopiedHex(hex);
      setTimeout(() => setCopiedHex(null), 1600);
    } catch {
      setCopiedHex(hex);
      setTimeout(() => setCopiedHex(null), 1600);
    }
  };

  const handleRefineSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = refineText.trim();
    if (!trimmed || isRefining) return;
    await onRefine(trimmed);
    setRefineText('');
  };

  const sortedRecommendations = [...proposal.recommendations].sort((a, b) => {
    if (focusCategory === 'عام') return 0;
    if (a.category === focusCategory && b.category !== focusCategory) return -1;
    if (b.category === focusCategory && a.category !== focusCategory) return 1;
    return 0;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 border-b border-[#3b1c5e]/10 pb-4">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[#6e6478]">
            <span>{proposal.roomType}</span>
            <span aria-hidden="true">·</span>
            <span>{proposal.styleName}</span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">{proposal.budgetEstimate}</span>
          </div>
          <h3 className="text-xl font-extrabold text-[#2c1846] leading-snug">{proposal.title}</h3>
        </div>

        <button
          type="button"
          onClick={onToggleFavorite}
          aria-label={isFavorite ? 'إزالة من المفضلة' : 'حفظ في المفضلة'}
          className={`min-h-[44px] min-w-[44px] rounded-xl flex items-center justify-center transition-colors shrink-0 cursor-pointer ${
            isFavorite
              ? 'bg-[#6c1bb0] text-white'
              : 'bg-[#f7f3ee] text-[#3b1c5e] hover:bg-[#efe5f8]'
          }`}
        >
          <Heart className="w-5 h-5" fill={isFavorite ? 'currentColor' : 'none'} />
        </button>
      </div>

      <p className="text-sm leading-7 text-[#2c1846]/90">{proposal.summary}</p>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-extrabold text-[#3b1c5e]">لوحة الألوان المقترحة</h4>
          <span className="text-xs text-[#6e6478]">اضغط على اللون لنسخ الكود</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {proposal.colorPalette.map((swatch, idx) => {
            const isCopied = copiedHex === swatch.hex;
            return (
              <button
                key={`${swatch.hex}-${idx}`}
                type="button"
                onClick={() => handleCopyHex(swatch.hex)}
                className="text-right rounded-2xl bg-[#f7f3ee] p-2.5 hover:bg-[#efe8df] transition-colors cursor-pointer group"
              >
                <div
                  className="h-12 w-full rounded-xl mb-2 border border-black/5"
                  style={{ backgroundColor: swatch.hex }}
                />
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-bold text-[#2c1846] truncate">{swatch.name}</span>
                  {isCopied ? (
                    <Check className="w-3.5 h-3.5 text-[#6c1bb0] shrink-0" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-[#6e6478] opacity-60 group-hover:opacity-100 shrink-0" />
                  )}
                </div>
                <div className="text-[11px] font-semibold text-[#6e6478] tabular-nums" dir="ltr">
                  {isCopied ? 'تم النسخ' : swatch.hex}
                </div>
                <p className="text-[11px] text-[#6e6478] mt-1 leading-snug line-clamp-2">{swatch.usage}</p>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <h4 className="text-sm font-extrabold text-[#3b1c5e] mb-3">توصيات التجديد حسب القسم</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {sortedRecommendations.map((rec, idx) => {
            const isFocused = focusCategory !== 'عام' && rec.category === focusCategory;
            return (
              <div
                key={`${rec.category}-${idx}`}
                className={`rounded-2xl p-4 transition-colors ${
                  isFocused
                    ? 'bg-[#efe5f8]/65 border border-[#6c1bb0]/35'
                    : 'bg-[#f7f3ee] border border-[#3b1c5e]/8'
                }`}
              >
                <div className="flex items-center justify-between gap-2 text-xs text-[#6e6478] mb-1.5">
                  <span className="font-bold text-[#6c1bb0]">{rec.category}</span>
                  <span>{rec.priority}</span>
                </div>
                <h5 className="text-sm font-extrabold text-[#2c1846] mb-1">{rec.title}</h5>
                <p className="text-xs leading-6 text-[#2c1846]/80">{rec.detail}</p>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-extrabold text-[#3b1c5e]">خطوات التنفيذ السريعة</h4>
          <span className="text-xs font-semibold text-[#6e6478] tabular-nums">
            {completedSteps.length} / {proposal.quickSteps.length} مكتملة
          </span>
        </div>
        <div className="divide-y divide-[#3b1c5e]/8 rounded-2xl bg-[#f7f3ee] px-4">
          {proposal.quickSteps.map((step, idx) => {
            const done = completedSteps.includes(idx);
            return (
              <button
                key={idx}
                type="button"
                onClick={() => onToggleStep(idx)}
                className="w-full min-h-[48px] py-3 flex items-start gap-3 text-right cursor-pointer"
              >
                {done ? (
                  <CheckSquare className="w-5 h-5 text-[#6c1bb0] shrink-0 mt-0.5" />
                ) : (
                  <Square className="w-5 h-5 text-[#6e6478] shrink-0 mt-0.5" />
                )}
                <span
                  className={`text-xs sm:text-sm leading-6 ${
                    done ? 'line-through text-[#6e6478]' : 'text-[#2c1846] font-medium'
                  }`}
                >
                  {step}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <form onSubmit={handleRefineSubmit} className="pt-2 border-t border-[#3b1c5e]/10">
        <label htmlFor="refine-input" className="block text-xs font-bold text-[#3b1c5e] mb-2">
          اطلب تعديلاً مخصصاً على هذا التصميم
        </label>
        <div className="flex items-center gap-2">
          <input
            id="refine-input"
            type="text"
            value={refineText}
            onChange={(e) => setRefineText(e.target.value)}
            placeholder="مثال: اجعل الألوان أدفأ وأضف لمسة ذهبية"
            disabled={isRefining}
            className="flex-1 min-h-[44px] rounded-xl bg-[#f7f3ee] border border-[#3b1c5e]/15 px-3.5 text-sm text-[#2c1846] placeholder:text-[#6e6478]/70 focus:outline-none focus:border-[#6c1bb0]"
          />
          <button
            type="submit"
            disabled={isRefining || !refineText.trim()}
            className="min-h-[44px] px-4 rounded-xl bg-[#3b1c5e] text-white text-xs font-bold inline-flex items-center gap-2 hover:bg-[#6c1bb0] disabled:opacity-50 transition-colors cursor-pointer shrink-0 whitespace-nowrap"
          >
            {isRefining ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>جاري التعديل</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>تحديث</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
