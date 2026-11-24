import React, { useState } from 'react';
import { Download, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'header' | 'card';
}

export function PWAInstallButton({ variant = 'header' }: PWAInstallButtonProps) {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className={
          variant === 'card'
            ? 'w-full min-h-[44px] px-4 rounded-xl bg-[#3b1c5e] hover:bg-[#6c1bb0] text-white text-sm font-bold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer'
            : 'min-h-[40px] px-3.5 rounded-xl bg-[#efe5f8] hover:bg-[#e3d1f5] text-[#3b1c5e] text-xs font-bold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer'
        }
      >
        <Download className="w-4 h-4" />
        <span>تثبيت التطبيق على الجوال</span>
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setShowGuideModal(true)}
        className={
          variant === 'card'
            ? 'w-full min-h-[44px] px-4 rounded-xl bg-[#3b1c5e] hover:bg-[#6c1bb0] text-white text-sm font-bold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer'
            : 'min-h-[40px] px-3.5 rounded-xl bg-[#efe5f8] hover:bg-[#e3d1f5] text-[#3b1c5e] text-xs font-bold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer'
        }
      >
        <Smartphone className="w-4 h-4" />
        <span>{isIOS ? 'تثبيت على الآيفون' : 'تثبيت كتطبيق أندرويد'}</span>
      </button>

      {showGuideModal && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/45 backdrop-blur-xs p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="install-guide-title"
        >
          <div className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#3b1c5e]/10">
              <h3 id="install-guide-title" className="text-lg font-extrabold text-[#3b1c5e]">
                {isIOS ? 'تثبيت التطبيق على iPhone / iPad' : 'تشغيل وتصدير تطبيق أندرويد (APK)'}
              </h3>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                aria-label="إغلاق"
                className="min-h-[44px] min-w-[44px] rounded-full bg-[#f7f3ee] text-[#2c1846] flex items-center justify-center hover:bg-[#efe8df] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {isIOS ? (
              <ol className="space-y-2.5 text-sm text-[#2c1846] leading-7 list-decimal list-inside">
                <li>اضغط على زر <strong>المشاركة (Share)</strong> في شريط متصفح Safari.</li>
                <li>مرر للأسفل واختر <strong>إضافة إلى الشاشة الرئيسية (Add to Home Screen)</strong>.</li>
                <li>اضغط <strong>إضافة</strong> ليظهر «منزل الأفكار» كتطبيق مستقل على هاتفك.</li>
              </ol>
            ) : (
              <div className="space-y-3 text-xs sm:text-sm text-[#2c1846] leading-6">
                <div className="rounded-2xl bg-[#f7f3ee] p-3.5 space-y-1">
                  <p className="font-extrabold text-[#3b1c5e]">1. التثبيت الفوري على أندرويد (WebAPK)</p>
                  <p className="text-[#6e6478]">
                    افتح رابط التطبيق في متصفح <strong>Chrome</strong> على هاتفك، ثم اضغط القائمة
                    (⋮) واختر <strong>«تثبيت التطبيق»</strong> ليُثبّت مباشرة كتطبيق مستقل بملء الشاشة.
                  </p>
                </div>
                <div className="rounded-2xl bg-[#f7f3ee] p-3.5 space-y-1">
                  <p className="font-extrabold text-[#3b1c5e]">2. استخراج ملف APK موقع للتوزيع</p>
                  <p className="text-[#6e6478]">
                    التطبيق مهيأ بملف Manifest وأيقونات أندرويد الكاملة وإعدادات Capacitor، ويمكنك
                    تحويل رابط التطبيق المنشور مباشرة إلى ملف <strong>APK</strong> عبر خدمة{' '}
                    <strong>PWABuilder</strong> أو بناء مجلد المشروع محلياً عبر{' '}
                    <span dir="ltr" className="font-semibold">npx cap add android</span>.
                  </p>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowGuideModal(false)}
              className="w-full min-h-[44px] rounded-xl bg-[#6c1bb0] hover:bg-[#5b189e] text-white text-sm font-bold transition-colors cursor-pointer"
            >
              حسناً، فهمت
            </button>
          </div>
        </div>
      )}
    </>
  );
}
