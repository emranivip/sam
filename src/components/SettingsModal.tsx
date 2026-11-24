import React from 'react';
import { X, Trash2 } from 'lucide-react';
import type { UserPreferences } from '../types';

interface SettingsModalProps {
  open: boolean;
  preferences: UserPreferences;
  historyCount: number;
  onClose: () => void;
  onSave: (prefs: UserPreferences) => void;
  onClearHistory: () => void;
}

const STYLE_OPTIONS = [
  'حديث دافئ',
  'عربي معاصر',
  'بسيط هادئ',
  'نيوكلاسيك أنيق',
  'بوهيمي طبيعي',
];

const BUDGET_OPTIONS = ['اقتصادية', 'متوسطة', 'مرتفعة'];

const LIGHTING_OPTIONS = ['دافئة مريحة (2700K)', 'متوازنة طبيعية (3000K)', 'بيضاء ساطعة (4000K)'];

export function SettingsModal({
  open,
  preferences,
  historyCount,
  onClose,
  onSave,
  onClearHistory,
}: SettingsModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/45 backdrop-blur-xs p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-title"
    >
      <div className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-4 border-b border-[#3b1c5e]/10 mb-5">
          <h2 id="settings-title" className="text-lg font-extrabold text-[#3b1c5e]">
            تخصيص التفضيلات والهوية
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق الإعدادات"
            className="min-h-[44px] min-w-[44px] rounded-full bg-[#f7f3ee] text-[#2c1846] flex items-center justify-center hover:bg-[#efe8df] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-5">
          <div>
            <label htmlFor="pref-name" className="block text-xs font-bold text-[#3b1c5e] mb-1.5">
              الاسم الظاهر في ملفك
            </label>
            <input
              id="pref-name"
              type="text"
              value={preferences.displayName}
              onChange={(e) => onSave({ ...preferences, displayName: e.target.value })}
              placeholder="ضيف منزل الأفكار"
              className="w-full min-h-[44px] rounded-xl bg-[#f7f3ee] border border-[#3b1c5e]/15 px-3.5 text-sm text-[#2c1846] focus:outline-none focus:border-[#6c1bb0]"
            />
          </div>

          <div>
            <span className="block text-xs font-bold text-[#3b1c5e] mb-2">النمط التصميمي المفضل</span>
            <div className="flex flex-wrap gap-2">
              {STYLE_OPTIONS.map((style) => {
                const active = preferences.preferredStyle === style;
                return (
                  <button
                    key={style}
                    type="button"
                    onClick={() => onSave({ ...preferences, preferredStyle: style })}
                    className={`min-h-[40px] px-3.5 rounded-xl text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                      active
                        ? 'bg-[#6c1bb0] text-white'
                        : 'bg-[#f7f3ee] text-[#2c1846] hover:bg-[#efe5f8]'
                    }`}
                  >
                    {style}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <span className="block text-xs font-bold text-[#3b1c5e] mb-2">نطاق الميزانية الافتراضي</span>
            <div className="grid grid-cols-3 gap-2">
              {BUDGET_OPTIONS.map((budget) => {
                const active = preferences.budgetLevel === budget;
                return (
                  <button
                    key={budget}
                    type="button"
                    onClick={() => onSave({ ...preferences, budgetLevel: budget })}
                    className={`min-h-[42px] rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                      active
                        ? 'bg-[#3b1c5e] text-white'
                        : 'bg-[#f7f3ee] text-[#2c1846] hover:bg-[#efe8df]'
                    }`}
                  >
                    {budget}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <span className="block text-xs font-bold text-[#3b1c5e] mb-2">حرارة الإضاءة المفضلة</span>
            <div className="space-y-2">
              {LIGHTING_OPTIONS.map((tone) => {
                const active = preferences.lightingTone === tone;
                return (
                  <button
                    key={tone}
                    type="button"
                    onClick={() => onSave({ ...preferences, lightingTone: tone })}
                    className={`w-full min-h-[44px] px-3.5 rounded-xl text-xs font-bold text-right transition-colors cursor-pointer ${
                      active
                        ? 'bg-[#efe5f8] text-[#6c1bb0] border border-[#6c1bb0]/35'
                        : 'bg-[#f7f3ee] text-[#2c1846] hover:bg-[#efe8df]'
                    }`}
                  >
                    {tone}
                  </button>
                );
              })}
            </div>
          </div>

          {historyCount > 0 && (
            <div className="pt-4 border-t border-[#3b1c5e]/10 flex items-center justify-between">
              <span className="text-xs text-[#6e6478] tabular-nums">
                التصاميم المحفوظة: {historyCount}
              </span>
              <button
                type="button"
                onClick={onClearHistory}
                className="min-h-[40px] px-3 rounded-xl text-xs font-bold text-red-700 bg-red-50 hover:bg-red-100 inline-flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>مسح السجل</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
