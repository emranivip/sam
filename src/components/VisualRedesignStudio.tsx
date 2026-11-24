import React, { useState } from 'react';
import {
  CheckCircle2,
  Cpu,
  Download,
  ImagePlus,
  Layers,
  Loader2,
  RefreshCw,
  SlidersHorizontal,
  Sparkles,
  Wand2,
} from 'lucide-react';
import type { ImageProviderId, ImageProviderInfo, VisualOption } from '../types';
import { ResilientImage } from './ResilientImage';

interface VisualRedesignStudioProps {
  originalImageSrc: string;
  options: VisualOption[];
  selectedOptionId: string | null;
  providers: ImageProviderInfo[];
  selectedProvider: ImageProviderId;
  isGenerating: boolean;
  isEditingCustom: boolean;
  visualError: string | null;
  hasProposal: boolean;
  onSelectProvider: (provider: ImageProviderId) => void;
  onSelectOption: (id: string) => void;
  onGenerateVariants: () => void;
  onCustomVisualEdit: (prompt: string) => Promise<void>;
}

const QUICK_EDIT_PROMPTS = [
  'اجعل الجدران بلون بيج رملي دافئ',
  'أضف إضاءة مخفية دافئة ومصابيح جانبية أنيقة',
  'جدّد الأثاث والسجاد بأسلوب عصري هادئ',
  'أضف نباتات داخلية ولمسات خشبية طبيعية',
];

export function VisualRedesignStudio({
  originalImageSrc,
  options,
  selectedOptionId,
  providers,
  selectedProvider,
  isGenerating,
  isEditingCustom,
  visualError,
  hasProposal,
  onSelectProvider,
  onSelectOption,
  onGenerateVariants,
  onCustomVisualEdit,
}: VisualRedesignStudioProps) {
  const [viewMode, setViewMode] = useState<'after' | 'compare' | 'before'>('after');
  const [sliderPercent, setSliderPercent] = useState(50);
  const [customPrompt, setCustomPrompt] = useState('');

  const activeOption =
    options.find((opt) => opt.id === selectedOptionId) ?? options[0] ?? null;

  const activeProviderInfo =
    providers.find((p) => p.id === selectedProvider) ?? null;

  const handleCustomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = customPrompt.trim();
    if (!trimmed || isEditingCustom || isGenerating) return;
    await onCustomVisualEdit(trimmed);
    setCustomPrompt('');
    setViewMode('after');
  };

  const handleQuickEdit = async (promptText: string) => {
    if (isEditingCustom || isGenerating) return;
    await onCustomVisualEdit(promptText);
    setViewMode('after');
  };

  const handleDownload = () => {
    if (!activeOption) return;
    const link = document.createElement('a');
    link.href = activeOption.imageDataUrl;
    link.download = `manzel-alafkar-${activeOption.id}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4">
      {/* إطار المعاينة الرئيسي: يدعم العرض المباشر أو مقارنة قبل وبعد */}
      <div className="relative rounded-2xl overflow-hidden bg-[#efe8df] aspect-16/10 select-none">
        {activeOption && viewMode === 'compare' ? (
          <div className="relative w-full h-full">
            <img
              src={activeOption.imageDataUrl}
              alt={activeOption.label}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
            <div
              className="absolute inset-0 overflow-hidden"
              style={{ clipPath: `inset(0 ${100 - sliderPercent}% 0 0)` }}
            >
              <ResilientImage
                src={originalImageSrc}
                alt="الغرفة الأصلية قبل التعديل"
                fallbackTitle="الغرفة الأصلية"
                className="w-full h-full object-cover"
              />
            </div>

            <div
              className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_8px_rgba(0,0,0,0.45)] pointer-events-none"
              style={{ right: `${sliderPercent}%` }}
            >
              <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-white text-[#3b1c5e] shadow-lg flex items-center justify-center">
                <SlidersHorizontal className="w-4 h-4" />
              </div>
            </div>

            <input
              type="range"
              min={5}
              max={95}
              value={sliderPercent}
              onChange={(e) => setSliderPercent(Number(e.target.value))}
              aria-label="تحريك مؤشر المقارنة بين قبل وبعد"
              className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize z-10"
            />

            <span className="absolute top-3 right-3 px-2.5 py-1 rounded-lg bg-black/55 text-white text-[11px] font-bold pointer-events-none">
              قبل
            </span>
            <span className="absolute top-3 left-3 px-2.5 py-1 rounded-lg bg-[#6c1bb0]/90 text-white text-[11px] font-bold pointer-events-none">
              بعد · {activeOption.label}
            </span>
          </div>
        ) : activeOption && viewMode === 'after' ? (
          <div className="relative w-full h-full">
            <img
              src={activeOption.imageDataUrl}
              alt={activeOption.label}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
            <span className="absolute top-3 right-3 px-2.5 py-1 rounded-lg bg-[#6c1bb0]/90 text-white text-[11px] font-bold inline-flex items-center gap-1.5">
              <Sparkles className="w-3 h-3" />
              <span>{activeOption.label}</span>
            </span>
          </div>
        ) : (
          <div className="relative w-full h-full">
            <ResilientImage
              src={originalImageSrc}
              alt="معاينة الغرفة الأصلية"
              fallbackTitle="معاينة الغرفة"
              className="w-full h-full object-cover"
            />
            {options.length > 0 && (
              <span className="absolute top-3 right-3 px-2.5 py-1 rounded-lg bg-black/55 text-white text-[11px] font-bold">
                الصورة الأصلية
              </span>
            )}
          </div>
        )}

        {(isGenerating || isEditingCustom) && (
          <div className="absolute inset-0 bg-[#2c1846]/65 backdrop-blur-xs flex flex-col items-center justify-center text-white p-4 text-center z-20">
            <Loader2 className="w-8 h-8 animate-spin text-[#f7d86b] mb-2.5" />
            <p className="text-sm font-extrabold">
              {isEditingCustom
                ? `جاري تخيل وتعديل الصورة عبر ${activeProviderInfo?.name ?? 'منصة الذكاء الاصطناعي'}...`
                : `جاري توليد تصور بصري عبر ${activeProviderInfo?.name ?? 'منصة الذكاء الاصطناعي'}...`}
            </p>
            <p className="text-xs text-white/80 mt-1">
              {activeProviderInfo?.supportsPhotoEdit
                ? 'يتم تعديل صورتك مع الحفاظ على أبعاد الغرفة وتوزيع الجدران والنوافذ'
                : 'يتم توليد تصورات ديكور مستوحاة من وصف غرفتك وألوانها'}
            </p>
          </div>
        )}
      </div>

      {/* اختيار منصة توليد وتخيل الصور */}
      {providers.length > 0 && (
        <div className="rounded-2xl bg-[#f7f3ee] p-3 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-extrabold text-[#3b1c5e] inline-flex items-center gap-1.5">
              <Cpu className="w-4 h-4 text-[#6c1bb0]" />
              <span>نماذج الذكاء الاصطناعي المفتوحة والمجانية</span>
            </span>
            <span className="text-[11px] font-semibold text-emerald-700">
              مفتوحة المصدر · مجانية للاستخدام المتكرر بدون مفتاح
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {providers.map((provider) => {
              const active = provider.id === selectedProvider;
              return (
                <button
                  key={provider.id}
                  type="button"
                  onClick={() => onSelectProvider(provider.id)}
                  className={`rounded-xl px-2.5 py-2 text-right border transition-colors cursor-pointer ${
                    active
                      ? 'bg-[#6c1bb0] border-[#6c1bb0] text-white'
                      : 'bg-white border-[#3b1c5e]/10 text-[#2c1846] hover:border-[#6c1bb0]/40'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[11.5px] font-extrabold truncate" dir="ltr">
                      {provider.name}
                    </span>
                    {provider.configured && (
                      <CheckCircle2
                        className={`w-3.5 h-3.5 shrink-0 ${
                          active ? 'text-[#f7d86b]' : 'text-emerald-600'
                        }`}
                      />
                    )}
                  </div>
                  <p
                    className={`text-[10.5px] mt-0.5 line-clamp-1 ${
                      active ? 'text-white/85' : 'text-[#6e6478]'
                    }`}
                  >
                    {provider.subtitle}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* شريط التحكم في طريقة العرض وتنزيل الصورة */}
      {activeOption && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex items-center gap-1 rounded-xl bg-[#f7f3ee] p-1">
            <button
              type="button"
              onClick={() => setViewMode('after')}
              className={`min-h-[34px] px-3 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                viewMode === 'after'
                  ? 'bg-[#6c1bb0] text-white'
                  : 'text-[#3b1c5e] hover:bg-[#efe8df]'
              }`}
            >
              بعد التعديل
            </button>
            <button
              type="button"
              onClick={() => setViewMode('compare')}
              className={`min-h-[34px] px-3 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                viewMode === 'compare'
                  ? 'bg-[#6c1bb0] text-white'
                  : 'text-[#3b1c5e] hover:bg-[#efe8df]'
              }`}
            >
              مقارنة قبل / بعد
            </button>
            <button
              type="button"
              onClick={() => setViewMode('before')}
              className={`min-h-[34px] px-3 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                viewMode === 'before'
                  ? 'bg-[#6c1bb0] text-white'
                  : 'text-[#3b1c5e] hover:bg-[#efe8df]'
              }`}
            >
              الأصلية
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onGenerateVariants}
              disabled={isGenerating || isEditingCustom}
              className="min-h-[36px] px-3 rounded-xl bg-[#efe5f8] hover:bg-[#e3d1f5] text-[#3b1c5e] text-xs font-bold inline-flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>توليد تصور جديد</span>
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="min-h-[36px] px-3 rounded-xl bg-[#f7f3ee] hover:bg-[#efe8df] text-[#3b1c5e] text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>حفظ الصورة</span>
            </button>
          </div>
        </div>
      )}

      {/* زر توليد الخيارات البصرية في حال لم تُنشأ بعد */}
      {options.length === 0 && !isGenerating && (
        <div className="rounded-2xl bg-[#fcf9ff] border border-[#6c1bb0]/20 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <p className="text-xs sm:text-sm font-extrabold text-[#3b1c5e] flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-[#6c1bb0]" />
              <span>توليد تصور بصري عبر {activeProviderInfo?.name ?? 'المنصة المختارة'}</span>
            </p>
            <p className="text-xs text-[#6e6478]">
              {hasProposal
                ? 'أنشئ صورة بصرية مقترحة لغرفتك بالإضافة للتوصيات النصية.'
                : 'اضغط لتوليد صورة بصرية مستوحاة من غرفتك.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onGenerateVariants}
            disabled={isGenerating || isEditingCustom}
            className="min-h-[40px] px-4 rounded-xl bg-[#3b1c5e] hover:bg-[#6c1bb0] text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <ImagePlus className="w-4 h-4" />
            <span>توليد تصور بصري</span>
          </button>
        </div>
      )}

      {visualError && (
        <div
          role="alert"
          className="rounded-xl bg-amber-50 border border-amber-200 px-3.5 py-2.5 text-xs text-amber-950 leading-5"
        >
          <span className="font-bold">تنبيه توليد الصور: </span>
          {visualError}
        </div>
      )}

      {/* شريط الخيارات البصرية المتعددة */}
      {options.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs sm:text-sm font-extrabold text-[#3b1c5e]">
              التصورات البصرية المولّدة ({options.length})
            </h4>
            <span className="text-[11px] text-[#6e6478]">اختر تصوراً للمعاينة المباشرة</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {options.map((opt) => {
              const selected = activeOption?.id === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    onSelectOption(opt.id);
                    if (viewMode === 'before') setViewMode('after');
                  }}
                  className={`rounded-2xl overflow-hidden text-right border transition-all cursor-pointer bg-[#f7f3ee] ${
                    selected
                      ? 'border-[#6c1bb0] ring-2 ring-[#6c1bb0]/20 bg-[#fcf9ff]'
                      : 'border-[#3b1c5e]/10 hover:border-[#6c1bb0]/40'
                  }`}
                >
                  <div className="aspect-16/9 w-full overflow-hidden bg-[#efe8df]">
                    <img
                      src={opt.imageDataUrl}
                      alt={opt.label}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="p-2.5">
                    <p className="text-xs font-extrabold text-[#2c1846] line-clamp-1">
                      {opt.label}
                    </p>
                    <p className="text-[11px] text-[#6e6478] line-clamp-1 mt-0.5">
                      {opt.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* تعديل أو تخيل بصري مخصص */}
      <div className="rounded-2xl bg-[#f7f3ee] p-3.5 space-y-2.5">
        <div className="flex items-center gap-1.5 text-xs font-extrabold text-[#3b1c5e]">
          <Wand2 className="w-4 h-4 text-[#6c1bb0]" />
          <span>تخيل أو عدّل الديكور مباشرة بأي وصف تريده</span>
        </div>

        <form onSubmit={handleCustomSubmit} className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            disabled={isEditingCustom || isGenerating}
            placeholder="مثال: غرفة معيشة دافئة بأريكة بيج وإضاءة مخفية ولمسات خشب"
            className="flex-1 min-h-[40px] rounded-xl bg-white border border-[#3b1c5e]/15 px-3 text-xs sm:text-sm text-[#2c1846] placeholder:text-[#6e6478]/70 focus:outline-none focus:border-[#6c1bb0]"
          />
          <button
            type="submit"
            disabled={!customPrompt.trim() || isEditingCustom || isGenerating}
            className="min-h-[40px] px-4 rounded-xl bg-[#3b1c5e] hover:bg-[#6c1bb0] text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
          >
            {isEditingCustom ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>جاري التوليد...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                <span>توليد الصورة</span>
              </>
            )}
          </button>
        </form>

        <div className="flex flex-wrap gap-1.5">
          {QUICK_EDIT_PROMPTS.map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => handleQuickEdit(chip)}
              disabled={isEditingCustom || isGenerating}
              className="px-2.5 py-1 rounded-lg bg-white border border-[#3b1c5e]/10 hover:border-[#6c1bb0]/40 text-[11px] font-semibold text-[#3b1c5e] transition-colors disabled:opacity-50 cursor-pointer"
            >
              {chip}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
