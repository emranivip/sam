import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Camera,
  ChevronLeft,
  Clock,
  Heart,
  Home,
  Loader2,
  Settings,
  Sparkles,
  Trash2,
  Upload,
  User,
} from 'lucide-react';
import { CategoryIcon, HouseBrandLogo, SparkleEmblem } from './components/BrandMark';
import { OfflineIndicator } from './components/OfflineIndicator';
import { ProposalView } from './components/ProposalView';
import { PWAInstallButton } from './components/PWAInstallButton';
import { ResilientImage } from './components/ResilientImage';
import { SettingsModal } from './components/SettingsModal';
import { VisualRedesignStudio } from './components/VisualRedesignStudio';
import { CURATED_IDEAS, HERO_BACKDROP_SRC } from './data/ideas';
import type {
  CuratedIdea,
  DecorCategory,
  DecorProposal,
  DesignRecord,
  ImageProviderId,
  ImageProviderInfo,
  NavTab,
  UserPreferences,
  VisualOption,
} from './types';

const STORAGE_HISTORY_KEY = 'manzel_afkar_history_v1';
const STORAGE_PREFS_KEY = 'manzel_afkar_prefs_v1';
const STORAGE_FAV_IDEAS_KEY = 'manzel_afkar_fav_ideas_v1';

const CATEGORIES: Array<Exclude<DecorCategory, 'عام'>> = [
  'ألوان الطلاء',
  'الأثاث',
  'الإضاءة',
  'الأرضيات',
];

const DEFAULT_PREFERENCES: UserPreferences = {
  displayName: 'عاشق التصميم',
  preferredStyle: 'حديث دافئ',
  budgetLevel: 'متوسطة',
  lightingTone: 'دافئة مريحة (2700K)',
};

async function resizeImageToDataUrl(file: File, maxDimension = 1280): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('تعذر قراءة ملف الصورة.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('تنسيق الصورة غير مدعوم.'));
      img.onload = () => {
        const ratio = Math.min(1, maxDimension / Math.max(img.width, img.height));
        const width = Math.max(1, Math.round(img.width * ratio));
        const height = Math.max(1, Math.round(img.height * ratio));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(reader.result as string);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

const API_BASE = ((import.meta as unknown as { env?: Record<string, string> }).env?.VITE_API_BASE_URL ?? '').replace(/\/+$/, '');

async function parseJsonResponse<T>(response: Response, fallbackError: string): Promise<T> {
  const contentType = response.headers.get('content-type') || '';
  const text = await response.text();
  const trimmed = text.trimStart().toLowerCase();

  if (
    trimmed.startsWith('<!doctype') ||
    trimmed.startsWith('<html') ||
    (!contentType.includes('application/json') && trimmed.startsWith('<'))
  ) {
    if (response.status === 413) {
      throw new Error('حجم الصورة كبير جداً. يرجى اختيار صورة أصغر والمحاولة مرة أخرى.');
    }
    if (response.status === 401 || response.status === 403) {
      throw new Error('تعذر التحقق من الصلاحية للوصول إلى الخادم. يرجى إعادة تحميل التطبيق.');
    }
    throw new Error('تعذر الاتصال بخدمة التحليل الذكي حالياً (استجابة غير صالحة من الخادم). تأكد من تشغيل الخادم والاتصال بالإنترنت.');
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(fallbackError);
  }
}

async function urlToBase64DataUrl(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('تعذر تحميل الصورة للتحليل.');
  }
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('text/html')) {
    throw new Error('تعذر تحميل ملف الصورة المطلوب.');
  }
  const blob = await response.blob();
  if (blob.type && !blob.type.startsWith('image/')) {
    throw new Error('الملف المحمّل ليس صورة صالحة.');
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('تعذر تحويل الصورة.'));
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });
}

export default function App() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const studioRef = useRef<HTMLElement>(null);

  const [activeTab, setActiveTab] = useState<NavTab>('home');
  const [selectedCategory, setSelectedCategory] = useState<DecorCategory>('عام');
  const [showAllIdeas, setShowAllIdeas] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [preferences, setPreferences] = useState<UserPreferences>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_PREFS_KEY);
      return raw ? { ...DEFAULT_PREFERENCES, ...JSON.parse(raw) } : DEFAULT_PREFERENCES;
    } catch {
      return DEFAULT_PREFERENCES;
    }
  });

  const [history, setHistory] = useState<DesignRecord[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_HISTORY_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const [favoriteIdeaIds, setFavoriteIdeaIds] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_FAV_IDEAS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const [activeImageSrc, setActiveImageSrc] = useState<string | null>(null);
  const [activeRecordId, setActiveRecordId] = useState<string | null>(null);
  const [activeProposal, setActiveProposal] = useState<DecorProposal | null>(null);
  const [visualOptions, setVisualOptions] = useState<VisualOption[]>([]);
  const [selectedVisualId, setSelectedVisualId] = useState<string | null>(null);
  const [imageProviders, setImageProviders] = useState<ImageProviderInfo[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<ImageProviderId>('icbinp');
  const [isVisualizing, setIsVisualizing] = useState(false);
  const [isEditingVisual, setIsEditingVisual] = useState(false);
  const [visualError, setVisualError] = useState<string | null>(null);
  const [roomNotes, setRoomNotes] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isRefining, setIsRefining] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [historyFilter, setHistoryFilter] = useState<DecorCategory | 'الكل'>('الكل');

  useEffect(() => {
    let mounted = true;
    fetch(`${API_BASE}/api/decor/providers`)
      .then((res) => parseJsonResponse<{ providers?: ImageProviderInfo[] }>(res, ''))
      .then((data) => {
        if (!mounted || !data.providers?.length) return;
        setImageProviders(data.providers);
        const preferred =
          data.providers.find((p) => p.configured) ?? data.providers[0];
        if (preferred) {
          setSelectedProvider(preferred.id);
        }
      })
      .catch(() => {
        // Ignore silent provider metadata fetch error
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_PREFS_KEY, JSON.stringify(preferences));
    } catch {
      // Ignore quota errors
    }
  }, [preferences]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_HISTORY_KEY, JSON.stringify(history));
    } catch {
      try {
        const compactHistory = history.map((item, idx) =>
          idx === 0 ? item : { ...item, visualOptions: undefined }
        );
        localStorage.setItem(STORAGE_HISTORY_KEY, JSON.stringify(compactHistory));
      } catch {
        try {
          const textOnlyHistory = history.map((item) => ({ ...item, visualOptions: undefined }));
          localStorage.setItem(STORAGE_HISTORY_KEY, JSON.stringify(textOnlyHistory));
        } catch {
          // Ignore quota errors
        }
      }
    }
  }, [history]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_FAV_IDEAS_KEY, JSON.stringify(favoriteIdeaIds));
    } catch {
      // Ignore quota errors
    }
  }, [favoriteIdeaIds]);

  const activeRecord = useMemo(
    () => history.find((item) => item.id === activeRecordId) ?? null,
    [history, activeRecordId]
  );

  const favoriteRecords = useMemo(() => history.filter((item) => item.isFavorite), [history]);
  const favoriteIdeas = useMemo(
    () => CURATED_IDEAS.filter((idea) => favoriteIdeaIds.includes(idea.id)),
    [favoriteIdeaIds]
  );

  const visibleIdeas = showAllIdeas ? CURATED_IDEAS : CURATED_IDEAS.slice(0, 2);

  const filteredHistory = useMemo(() => {
    if (historyFilter === 'الكل') return history;
    return history.filter((item) => item.category === historyFilter);
  }, [history, historyFilter]);

  const scrollToStudio = () => {
    setTimeout(() => {
      studioRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 60);
  };

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setErrorMessage(null);
    setVisualError(null);
    try {
      const dataUrl = await resizeImageToDataUrl(file);
      setActiveImageSrc(dataUrl);
      setActiveProposal(null);
      setActiveRecordId(null);
      setVisualOptions([]);
      setSelectedVisualId(null);
      setActiveTab('home');
      scrollToStudio();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'تعذر تحميل الصورة المختارة.');
    } finally {
      event.target.value = '';
    }
  };

  const handleCategoryClick = (category: Exclude<DecorCategory, 'عام'>) => {
    setSelectedCategory((prev) => (prev === category ? 'عام' : category));
  };

  const handleOpenIdea = (idea: CuratedIdea) => {
    setErrorMessage(null);
    setVisualError(null);
    setActiveImageSrc(idea.imageSrc);
    setActiveProposal(idea.presetProposal);
    setSelectedCategory(idea.focusCategory);
    setActiveRecordId(null);
    setVisualOptions([]);
    setSelectedVisualId(null);
    setActiveTab('home');
    scrollToStudio();
  };

  const generateVisualVariants = async (
    imageSrc: string,
    proposalObj: DecorProposal | null,
    recordIdToUpdate: string | null,
    replaceExisting = false
  ) => {
    setVisualError(null);
    setIsVisualizing(true);
    try {
      const imageBase64 = imageSrc.startsWith('data:')
        ? imageSrc
        : await urlToBase64DataUrl(imageSrc);

      const variantIndex = replaceExisting ? 0 : visualOptions.length;

      const response = await fetch(`${API_BASE}/api/decor/visualize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: selectedProvider,
          imageBase64,
          proposal: proposalObj,
          category: selectedCategory,
          notes: roomNotes,
          stylePreference: preferences.preferredStyle,
          variantIndex,
        }),
      });

      const data = await parseJsonResponse<{ options?: VisualOption[]; error?: string }>(
        response,
        'تعذر قراءة استجابة تعديل الصورة.'
      );
      if (!response.ok || !data.options || data.options.length === 0) {
        throw new Error(data.error || 'تعذر توليد التصور البصري حالياً.');
      }

      const generatedOption = data.options[0];
      setVisualOptions((prev) => {
        const next = replaceExisting ? [generatedOption] : [generatedOption, ...prev];
        if (recordIdToUpdate) {
          setHistory((hist) =>
            hist.map((rec) =>
              rec.id === recordIdToUpdate ? { ...rec, visualOptions: next } : rec
            )
          );
        }
        return next;
      });
      setSelectedVisualId(generatedOption.id);
    } catch (err) {
      setVisualError(
        err instanceof Error ? err.message : 'تعذر توليد التصور البصري للغرفة حالياً.'
      );
    } finally {
      setIsVisualizing(false);
    }
  };

  const handleCustomVisualEdit = async (customPrompt: string) => {
    if (!activeImageSrc || isEditingVisual || isVisualizing) return;
    setVisualError(null);
    setIsEditingVisual(true);

    try {
      const imageBase64 = activeImageSrc.startsWith('data:')
        ? activeImageSrc
        : await urlToBase64DataUrl(activeImageSrc);

      const response = await fetch(`${API_BASE}/api/decor/visualize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: selectedProvider,
          imageBase64,
          proposal: activeProposal,
          customPrompt,
          category: selectedCategory,
          stylePreference: preferences.preferredStyle,
        }),
      });

      const data = await parseJsonResponse<{ options?: VisualOption[]; error?: string }>(
        response,
        'تعذر قراءة استجابة تعديل الصورة.'
      );
      if (!response.ok || !data.options || data.options.length === 0) {
        throw new Error(data.error || 'تعذر تطبيق التعديل البصري المطلوب.');
      }

      const newOption = data.options[0];
      setVisualOptions((prev) => {
        const next = [newOption, ...prev];
        if (activeRecordId) {
          setHistory((hist) =>
            hist.map((rec) =>
              rec.id === activeRecordId ? { ...rec, visualOptions: next } : rec
            )
          );
        }
        return next;
      });
      setSelectedVisualId(newOption.id);
    } catch (err) {
      setVisualError(
        err instanceof Error ? err.message : 'تعذر تطبيق التعديل البصري على الصورة.'
      );
    } finally {
      setIsEditingVisual(false);
    }
  };

  const handleAnalyzeRoom = async () => {
    if (!activeImageSrc || isAnalyzing) return;
    setErrorMessage(null);
    setVisualError(null);
    setIsAnalyzing(true);

    try {
      const imageBase64 = activeImageSrc.startsWith('data:')
        ? activeImageSrc
        : await urlToBase64DataUrl(activeImageSrc);

      const response = await fetch(`${API_BASE}/api/decor/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64,
          category: selectedCategory,
          notes: roomNotes,
          stylePreference: preferences.preferredStyle,
          budgetLevel: preferences.budgetLevel,
        }),
      });

      const data = await parseJsonResponse<{ proposal?: DecorProposal; error?: string }>(
        response,
        'تعذر قراءة استجابة تحليل الديكور.'
      );
      if (!response.ok || !data.proposal) {
        throw new Error(data.error || 'تعذر تحليل الغرفة حالياً.');
      }

      const newRecord: DesignRecord = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        createdAt: new Date().toISOString(),
        imageSrc: activeImageSrc,
        category: selectedCategory,
        notes: roomNotes.trim() || undefined,
        proposal: data.proposal,
        isFavorite: false,
        completedSteps: [],
      };

      setHistory((prev) => [newRecord, ...prev.slice(0, 19)]);
      setActiveRecordId(newRecord.id);
      setActiveProposal(data.proposal);
      setVisualOptions([]);
      setSelectedVisualId(null);

      // توليد تصور بصري واحد للغرفة بالتوازي بعد عرض التوصيات النصية
      void generateVisualVariants(activeImageSrc, data.proposal, newRecord.id, true);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'حدث خطأ أثناء الاتصال بخدمة التصميم.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleRefineProposal = async (refinementPrompt: string) => {
    if (!activeProposal || isRefining) return;
    setErrorMessage(null);
    setIsRefining(true);

    try {
      const imageBase64 =
        activeImageSrc && activeImageSrc.startsWith('data:')
          ? activeImageSrc
          : activeImageSrc
            ? await urlToBase64DataUrl(activeImageSrc)
            : undefined;

      const response = await fetch(`${API_BASE}/api/decor/refine`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentProposal: activeProposal,
          refinementPrompt,
          imageBase64,
        }),
      });

      const data = await parseJsonResponse<{ proposal?: DecorProposal; error?: string }>(
        response,
        'تعذر قراءة استجابة تعديل التصميم.'
      );
      if (!response.ok || !data.proposal) {
        throw new Error(data.error || 'تعذر تحديث التصميم.');
      }

      const proposal = data.proposal;
      setActiveProposal(proposal);
      if (activeRecordId) {
        setHistory((prev) =>
          prev.map((rec) =>
            rec.id === activeRecordId ? { ...rec, proposal } : rec
          )
        );
      } else if (activeImageSrc) {
        const newRecord: DesignRecord = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          createdAt: new Date().toISOString(),
          imageSrc: activeImageSrc,
          category: selectedCategory,
          proposal,
          isFavorite: false,
          completedSteps: [],
        };
        setHistory((prev) => [newRecord, ...prev.slice(0, 19)]);
        setActiveRecordId(newRecord.id);
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'حدث خطأ أثناء تحديث التصميم.');
    } finally {
      setIsRefining(false);
    }
  };

  const handleToggleActiveFavorite = () => {
    if (activeRecordId) {
      setHistory((prev) =>
        prev.map((rec) => (rec.id === activeRecordId ? { ...rec, isFavorite: !rec.isFavorite } : rec))
      );
      return;
    }
    if (activeImageSrc && activeProposal) {
      const newRecord: DesignRecord = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        createdAt: new Date().toISOString(),
        imageSrc: activeImageSrc,
        category: selectedCategory,
        proposal: activeProposal,
        isFavorite: true,
        completedSteps: [],
      };
      setHistory((prev) => [newRecord, ...prev.slice(0, 19)]);
      setActiveRecordId(newRecord.id);
    }
  };

  const handleToggleStep = (index: number) => {
    if (!activeRecordId) return;
    setHistory((prev) =>
      prev.map((rec) => {
        if (rec.id !== activeRecordId) return rec;
        const exists = rec.completedSteps.includes(index);
        return {
          ...rec,
          completedSteps: exists
            ? rec.completedSteps.filter((i) => i !== index)
            : [...rec.completedSteps, index],
        };
      })
    );
  };

  const handleOpenRecord = (record: DesignRecord) => {
    setErrorMessage(null);
    setVisualError(null);
    setActiveImageSrc(record.imageSrc);
    setActiveProposal(record.proposal);
    setActiveRecordId(record.id);
    setSelectedCategory(record.category);
    const savedVisuals = record.visualOptions ?? [];
    setVisualOptions(savedVisuals);
    setSelectedVisualId(savedVisuals[0]?.id ?? null);
    setActiveTab('home');
    scrollToStudio();
  };

  const handleDeleteRecord = (id: string) => {
    setHistory((prev) => prev.filter((item) => item.id !== id));
    if (activeRecordId === id) {
      setActiveRecordId(null);
    }
  };

  const toggleIdeaFavorite = (ideaId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavoriteIdeaIds((prev) =>
      prev.includes(ideaId) ? prev.filter((id) => id !== ideaId) : [...prev, ideaId]
    );
  };

  const formatDate = (iso: string) => {
    try {
      return new Intl.DateTimeFormat('ar-SA', {
        day: 'numeric',
        month: 'short',
      }).format(new Date(iso));
    } catch {
      return '';
    }
  };

  return (
    <div className="min-h-screen bg-[#f7f3ee] text-[#2c1846] pb-24 lg:pb-12">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handlePhotoUpload}
        className="hidden"
        aria-label="التقاط أو اختيار صورة للغرفة"
      />

      {/* شريط علوي لأجهزة سطح المكتب وفق عقد الأشرطة العلوية الثلاثي */}
      <header className="hidden lg:block sticky top-0 z-30 bg-[#f7f3ee]/90 backdrop-blur-md border-b border-[#3b1c5e]/10">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between gap-8">
          <button
            type="button"
            onClick={() => setActiveTab('home')}
            className="text-xl font-extrabold text-[#3b1c5e] whitespace-nowrap shrink-0 cursor-pointer"
          >
            منزل الأفكار
          </button>

          <nav className="flex items-center gap-7" aria-label="التنقل الرئيسي">
            {(
              [
                { id: 'home', label: 'الرئيسية' },
                { id: 'history', label: 'سجل التصاميم' },
                { id: 'favorites', label: 'المفضلة' },
                { id: 'profile', label: 'حسابي' },
              ] as const
            ).map((item) => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`py-1.5 text-sm font-bold whitespace-nowrap shrink-0 border-b-2 transition-colors cursor-pointer ${
                    active
                      ? 'text-[#6c1bb0] border-[#6c1bb0]'
                      : 'text-[#6e6478] border-transparent hover:text-[#3b1c5e]'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 rounded-xl bg-[#6c1bb0] hover:bg-[#5b189e] text-white text-xs font-bold inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Camera className="w-4 h-4" />
              <span>التقط صورة لغرفتك</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto lg:max-w-6xl lg:px-6 lg:pt-8">
        {activeTab === 'home' && (
          <div className="lg:grid lg:grid-cols-12 lg:gap-8 lg:items-start">
            {/* العمود الرئيسي: البانر، زر الكاميرا، والأقسام */}
            <div className="lg:col-span-5 space-y-5">
              {/* القسم العلوي بالهوية البصرية لمنزل الأفكار */}
              <section className="relative overflow-hidden lg:rounded-3xl rounded-b-[28px] bg-[#efe8df] shadow-[0_8px_22px_rgba(59,28,94,0.08)]">
                <div className="absolute inset-0">
                  <ResilientImage
                    src={HERO_BACKDROP_SRC}
                    alt="غرفة معيشة مشرقة بتصميم عصري دافئ"
                    className="w-full h-full object-cover"
                    fallbackTitle="منزل الأفكار"
                  />
                  <div
                    className="absolute inset-0"
                    style={{
                      background:
                        'linear-gradient(180deg, rgba(247, 243, 238, 0.90) 0%, rgba(247, 243, 238, 0.72) 48%, rgba(247, 243, 238, 0.98) 100%)',
                    }}
                  />
                </div>

                <div className="relative px-5 pt-4 pb-14">
                  <div className="flex items-center justify-between mb-1">
                    <button
                      type="button"
                      onClick={() => setSettingsOpen(true)}
                      aria-label="الإعدادات"
                      className="w-11 h-11 rounded-full bg-white/85 shadow-sm flex items-center justify-center text-[#2c1846] hover:bg-white transition-colors cursor-pointer"
                    >
                      <Settings className="w-5 h-5" />
                    </button>

                    <div className="w-10 h-10 flex items-center justify-center">
                      <SparkleEmblem className="w-8 h-8" />
                    </div>
                  </div>

                  <div className="text-center -mt-1">
                    <HouseBrandLogo className="w-20 h-14 mx-auto mb-0.5" />
                    <h1 className="text-[30px] font-extrabold text-[#3b1c5e] leading-tight">
                      منزل الأفكار
                    </h1>
                    <p className="text-sm font-bold text-[#3b1c5e]/90 mt-0.5">
                      حول غرفتك .. إلى مساحة أجمل
                    </p>
                  </div>
                </div>
              </section>

              {/* زر الكاميرا الرئيسي العائم */}
              <div className="px-4 lg:px-0 -mt-12 relative z-10">
                <div className="hidden sm:flex lg:flex flex-col gap-1.5 absolute left-2 top-3 pointer-events-none">
                  <span className="block w-3.5 h-1 rounded-full bg-[#e8b824] -rotate-16" />
                  <span className="block w-4.5 h-1 rounded-full bg-[#e8b824] -ml-1" />
                  <span className="block w-3 h-1 rounded-full bg-[#e8b824] rotate-16" />
                </div>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full rounded-[26px] border-2 border-white/85 bg-gradient-to-l from-[#4f148c] via-[#7d22c9] to-[#5b189e] shadow-[0_10px_24px_rgba(108,27,176,0.32)] px-4 py-3.5 flex items-center justify-between text-white active:scale-[0.985] transition-transform cursor-pointer"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-11 h-9 flex items-center justify-center shrink-0">
                      <svg width="42" height="36" viewBox="0 0 48 40" fill="none" aria-hidden="true">
                        <path
                          d="M14 9L17 4H31L34 9H40C42.8 9 45 11.2 45 14V32C45 34.8 42.8 37 40 37H8C5.2 37 3 34.8 3 32V14C3 11.2 5.2 9 8 9H14Z"
                          fill="#FFFFFF"
                        />
                        <circle cx="24" cy="23" r="9.5" fill="#6C1BB0" />
                        <circle cx="24" cy="23" r="5" fill="#FFFFFF" />
                      </svg>
                    </div>
                    <span className="w-px h-9 bg-white/40" aria-hidden="true" />
                    <div className="text-right">
                      <span className="block text-xl font-extrabold leading-tight">اقترح ديكور</span>
                      <span className="block text-xs font-semibold text-white/90 mt-0.5">
                        التقط صورة لغرفتك أو ارفعها من الجهاز
                      </span>
                    </div>
                  </div>

                  <span className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                    <ChevronLeft className="w-4 h-4 text-white" />
                  </span>
                </button>
              </div>

              {/* الأقسام الأربعة */}
              <section className="px-4 lg:px-0 pt-1" aria-label="أقسام الديكور">
                <div className="grid grid-cols-4 gap-2.5">
                  {CATEGORIES.map((cat) => {
                    const active = selectedCategory === cat;
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => handleCategoryClick(cat)}
                        className={`min-h-[82px] rounded-2xl p-2 bg-white shadow-[0_8px_22px_rgba(59,28,94,0.06)] border flex flex-col items-center justify-center gap-1.5 transition-all active:scale-96 cursor-pointer ${
                          active
                            ? 'border-[#6c1bb0] bg-[#fcf9ff] ring-2 ring-[#6c1bb0]/15'
                            : 'border-[#6c1bb0]/8 hover:border-[#6c1bb0]/30'
                        }`}
                      >
                        <CategoryIcon category={cat} />
                        <span className="text-[11.5px] font-bold text-[#2c1846] text-center leading-tight">
                          {cat}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* قسم أفكار مقترحة لك */}
              <section className="px-4 lg:px-0 pt-2" aria-label="أفكار مقترحة لك">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <h2 className="text-[17px] font-extrabold text-[#2c1846]">أفكار مقترحة لك</h2>
                    <svg width="20" height="20" viewBox="0 0 28 28" fill="none" aria-hidden="true">
                      <circle cx="14" cy="11" r="7" fill="#F7D86B" />
                      <path d="M11 18H17L16 22H12L11 18Z" fill="#9AA3B2" />
                    </svg>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowAllIdeas((prev) => !prev)}
                    className="min-h-[36px] px-3.5 rounded-xl bg-[#efe5f8] text-[#3b1c5e] text-xs font-bold inline-flex items-center gap-1.5 hover:bg-[#e3d1f5] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <span>{showAllIdeas ? 'عرض أقل' : 'عرض المزيد'}</span>
                    <ArrowLeft className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {visibleIdeas.map((idea) => {
                    const isIdeaFav = favoriteIdeaIds.includes(idea.id);
                    return (
                      <div
                        key={idea.id}
                        onClick={() => handleOpenIdea(idea)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleOpenIdea(idea);
                          }
                        }}
                        role="button"
                        tabIndex={0}
                        className="group relative bg-white rounded-2xl overflow-hidden shadow-[0_8px_22px_rgba(59,28,94,0.08)] cursor-pointer text-right focus-visible:outline-2 focus-visible:outline-[#6c1bb0]"
                      >
                        <div className="aspect-4/3 w-full overflow-hidden relative">
                          <ResilientImage
                            src={idea.imageSrc}
                            alt={idea.title}
                            fallbackTitle={idea.title}
                            className="w-full h-full object-cover group-hover:scale-103 transition-transform duration-200"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
                          <button
                            type="button"
                            onClick={(e) => toggleIdeaFavorite(idea.id, e)}
                            aria-label={isIdeaFav ? 'إزالة الفكرة من المفضلة' : 'حفظ الفكرة في المفضلة'}
                            className="absolute top-2 left-2 w-9 h-9 rounded-full bg-black/35 backdrop-blur-xs text-white flex items-center justify-center hover:bg-black/55 transition-colors cursor-pointer"
                          >
                            <Heart
                              className="w-4 h-4"
                              fill={isIdeaFav ? '#e8b824' : 'none'}
                              stroke={isIdeaFav ? '#e8b824' : 'currentColor'}
                            />
                          </button>
                          <div className="absolute bottom-2.5 right-2.5 left-2.5 text-white">
                            <p className="text-[11px] text-white/85 font-semibold truncate">
                              {idea.roomType} · {idea.styleName}
                            </p>
                            <h3 className="text-xs sm:text-sm font-extrabold leading-snug line-clamp-1">
                              {idea.title}
                            </h3>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-4">
                  <PWAInstallButton variant="card" />
                </div>
              </section>
            </div>

            {/* العمود الثاني: استوديو المعاينة واقتراحات الذكاء الاصطناعي */}
            <section
              ref={studioRef}
              className="lg:col-span-7 px-4 lg:px-0 mt-5 lg:mt-0"
              aria-label="استوديو تصميم الغرفة"
            >
              {errorMessage && (
                <div
                  role="alert"
                  className="mb-4 rounded-2xl bg-red-50 border border-red-200 p-4 flex items-start gap-3 text-red-900"
                >
                  <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                  <div className="flex-1 text-xs sm:text-sm leading-6">
                    <p className="font-bold">تعذر إتمام الطلب</p>
                    <p>{errorMessage}</p>
                  </div>
                </div>
              )}

              {activeImageSrc ? (
                <div className="bg-white rounded-3xl p-4 sm:p-6 shadow-[0_8px_22px_rgba(59,28,94,0.08)] space-y-5">
                  <VisualRedesignStudio
                    originalImageSrc={activeImageSrc}
                    options={visualOptions}
                    selectedOptionId={selectedVisualId}
                    providers={imageProviders}
                    selectedProvider={selectedProvider}
                    isGenerating={isVisualizing}
                    isEditingCustom={isEditingVisual}
                    visualError={visualError}
                    hasProposal={!!activeProposal}
                    onSelectProvider={(p) => {
                      setSelectedProvider(p);
                      setVisualError(null);
                    }}
                    onSelectOption={setSelectedVisualId}
                    onGenerateVariants={() =>
                      void generateVisualVariants(activeImageSrc, activeProposal, activeRecordId, false)
                    }
                    onCustomVisualEdit={handleCustomVisualEdit}
                  />

                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-[#6e6478]">
                      <span>
                        القسم المختار:{' '}
                        <strong className="text-[#6c1bb0]">{selectedCategory}</strong>
                      </span>
                      <span>
                        النمط المفضل: {preferences.preferredStyle} · الميزانية: {preferences.budgetLevel}
                      </span>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2.5">
                      <input
                        type="text"
                        value={roomNotes}
                        onChange={(e) => setRoomNotes(e.target.value)}
                        placeholder="أضف ملاحظة اختيارية (مثلاً: أريد إضاءة دافئة وألواناً فاتحة)"
                        className="flex-1 min-h-[44px] rounded-xl bg-[#f7f3ee] border border-[#3b1c5e]/15 px-3.5 text-sm text-[#2c1846] placeholder:text-[#6e6478]/70 focus:outline-none focus:border-[#6c1bb0]"
                      />
                      <button
                        type="button"
                        onClick={handleAnalyzeRoom}
                        disabled={isAnalyzing}
                        className="min-h-[44px] px-5 rounded-xl bg-[#6c1bb0] hover:bg-[#5b189e] text-white text-sm font-extrabold inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-60 cursor-pointer whitespace-nowrap shrink-0"
                      >
                        {isAnalyzing ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>جاري تحليل الغرفة...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4" />
                            <span>تطبيق اقتراح الديكور</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {activeProposal && (
                    <div className="pt-4 border-t border-[#3b1c5e]/10">
                      <ProposalView
                        proposal={activeProposal}
                        focusCategory={selectedCategory}
                        isFavorite={activeRecord?.isFavorite ?? false}
                        completedSteps={activeRecord?.completedSteps ?? []}
                        isRefining={isRefining}
                        onToggleFavorite={handleToggleActiveFavorite}
                        onToggleStep={handleToggleStep}
                        onRefine={handleRefineProposal}
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div className="hidden lg:flex flex-col items-center justify-center text-center bg-white rounded-3xl p-10 shadow-[0_8px_22px_rgba(59,28,94,0.08)] min-h-[440px]">
                  <div className="w-16 h-16 rounded-2xl bg-[#efe5f8] text-[#6c1bb0] flex items-center justify-center mb-4">
                    <Upload className="w-8 h-8" />
                  </div>
                  <h2 className="text-xl font-extrabold text-[#3b1c5e] mb-2">
                    استوديو التصميم الذكي جاهز لغرفتك
                  </h2>
                  <p className="text-sm text-[#6e6478] max-w-md leading-7 mb-6">
                    التقط صورة لغرفتك أو ارفعها من جهازك ليقوم المساعد الذكي بتحليل الإضاءة والأثاث
                    واقتراح لوحة ألوان وتوصيات تجديد مخصصة بالكامل، أو اختر إحدى الأفكار المقترحة.
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="min-h-[44px] px-5 rounded-xl bg-[#6c1bb0] hover:bg-[#5b189e] text-white text-sm font-bold inline-flex items-center gap-2 transition-colors cursor-pointer"
                    >
                      <Camera className="w-4 h-4" />
                      <span>رفع صورة الغرفة</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenIdea(CURATED_IDEAS[0])}
                      className="min-h-[44px] px-5 rounded-xl bg-[#f7f3ee] hover:bg-[#efe8df] text-[#3b1c5e] text-sm font-bold transition-colors cursor-pointer"
                    >
                      استكشاف نموذج جاهز
                    </button>
                  </div>
                </div>
              )}
            </section>
          </div>
        )}

        {activeTab === 'history' && (
          <section className="px-4 lg:px-0 pt-5 lg:pt-0 space-y-5" aria-label="سجل التصاميم">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h1 className="text-2xl font-extrabold text-[#3b1c5e]">سجل التصاميم</h1>
                <p className="text-xs sm:text-sm text-[#6e6478]">
                  جميع المقترحات التي أنشأتها محفوظة هنا لسهولة الرجوع والتعديل
                </p>
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                {(['الكل', 'عام', ...CATEGORIES] as const).map((cat) => {
                  const active = historyFilter === cat;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setHistoryFilter(cat)}
                      className={`min-h-[36px] px-3 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                        active
                          ? 'bg-[#6c1bb0] text-white'
                          : 'bg-white text-[#2c1846] hover:bg-[#efe5f8]'
                      }`}
                    >
                      {cat}
                    </button>
                  );
                })}
              </div>
            </div>

            {filteredHistory.length === 0 ? (
              <div className="bg-white rounded-3xl p-8 text-center shadow-[0_8px_22px_rgba(59,28,94,0.06)]">
                <Clock className="w-10 h-10 text-[#6c1bb0]/60 mx-auto mb-3" />
                <h2 className="text-base font-extrabold text-[#3b1c5e] mb-1">
                  لا توجد تصاميم محفوظة بعد
                </h2>
                <p className="text-xs sm:text-sm text-[#6e6478] mb-5">
                  التقط صورة لغرفتك واضغط «تطبيق اقتراح الديكور» ليتم حفظ التصميم هنا تلقائياً.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('home');
                    fileInputRef.current?.click();
                  }}
                  className="min-h-[44px] px-5 rounded-xl bg-[#6c1bb0] text-white text-sm font-bold inline-flex items-center gap-2 cursor-pointer"
                >
                  <Camera className="w-4 h-4" />
                  <span>ابدأ أول تصميم</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredHistory.map((record) => (
                  <article
                    key={record.id}
                    className="bg-white rounded-2xl overflow-hidden shadow-[0_8px_22px_rgba(59,28,94,0.08)] flex flex-col"
                  >
                    <button
                      type="button"
                      onClick={() => handleOpenRecord(record)}
                      className="text-right flex-1 cursor-pointer group"
                    >
                      <div className="aspect-16/10 w-full overflow-hidden">
                        <ResilientImage
                          src={record.imageSrc}
                          alt={record.proposal.title}
                          fallbackTitle={record.proposal.title}
                          className="w-full h-full object-cover group-hover:scale-103 transition-transform duration-200"
                        />
                      </div>
                      <div className="p-4 space-y-1.5">
                        <div className="flex items-center gap-2 text-xs text-[#6e6478] font-semibold">
                          <span>{record.category}</span>
                          <span aria-hidden="true">·</span>
                          <span>{record.proposal.roomType}</span>
                          <span aria-hidden="true">·</span>
                          <span className="tabular-nums">{formatDate(record.createdAt)}</span>
                        </div>
                        <h3 className="text-base font-extrabold text-[#2c1846] line-clamp-1">
                          {record.proposal.title}
                        </h3>
                        <p className="text-xs text-[#6e6478] line-clamp-2 leading-5">
                          {record.proposal.summary}
                        </p>
                      </div>
                    </button>

                    <div className="px-4 pb-3 pt-2 border-t border-[#3b1c5e]/8 flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        {record.proposal.colorPalette.slice(0, 4).map((swatch, idx) => (
                          <span
                            key={idx}
                            title={swatch.name}
                            className="w-5 h-5 rounded-full border border-black/10"
                            style={{ backgroundColor: swatch.hex }}
                          />
                        ))}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            setHistory((prev) =>
                              prev.map((r) =>
                                r.id === record.id ? { ...r, isFavorite: !r.isFavorite } : r
                              )
                            )
                          }
                          aria-label={record.isFavorite ? 'إزالة من المفضلة' : 'إضافة للمفضلة'}
                          className="min-h-[40px] min-w-[40px] rounded-xl flex items-center justify-center text-[#6c1bb0] hover:bg-[#efe5f8] transition-colors cursor-pointer"
                        >
                          <Heart className="w-4 h-4" fill={record.isFavorite ? 'currentColor' : 'none'} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteRecord(record.id)}
                          aria-label="حذف التصميم"
                          className="min-h-[40px] min-w-[40px] rounded-xl flex items-center justify-center text-[#6e6478] hover:text-red-700 hover:bg-red-50 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {activeTab === 'favorites' && (
          <section className="px-4 lg:px-0 pt-5 lg:pt-0 space-y-6" aria-label="المفضلة">
            <div>
              <h1 className="text-2xl font-extrabold text-[#3b1c5e]">المفضلة</h1>
              <p className="text-xs sm:text-sm text-[#6e6478]">
                تصاميمك المحفوظة والأفكار الملهمة التي اخترتها لغرفتك
              </p>
            </div>

            {favoriteRecords.length === 0 && favoriteIdeas.length === 0 ? (
              <div className="bg-white rounded-3xl p-8 text-center shadow-[0_8px_22px_rgba(59,28,94,0.06)]">
                <Heart className="w-10 h-10 text-[#6c1bb0]/60 mx-auto mb-3" />
                <h2 className="text-base font-extrabold text-[#3b1c5e] mb-1">
                  قائمة المفضلة فارغة حالياً
                </h2>
                <p className="text-xs sm:text-sm text-[#6e6478] mb-5">
                  اضغط على أيقونة القلب داخل أي مقترح أو فكرة مقترحة لحفظها هنا.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('home')}
                  className="min-h-[44px] px-5 rounded-xl bg-[#6c1bb0] text-white text-sm font-bold cursor-pointer"
                >
                  استعراض الأفكار
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {favoriteRecords.length > 0 && (
                  <div className="space-y-3">
                    <h2 className="text-base font-extrabold text-[#3b1c5e]">تصاميم غرفك المحفوظة</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {favoriteRecords.map((record) => (
                        <button
                          key={record.id}
                          type="button"
                          onClick={() => handleOpenRecord(record)}
                          className="bg-white rounded-2xl overflow-hidden shadow-[0_8px_22px_rgba(59,28,94,0.08)] text-right cursor-pointer group"
                        >
                          <div className="aspect-16/10 w-full overflow-hidden">
                            <ResilientImage
                              src={record.imageSrc}
                              alt={record.proposal.title}
                              fallbackTitle={record.proposal.title}
                              className="w-full h-full object-cover group-hover:scale-103 transition-transform"
                            />
                          </div>
                          <div className="p-4">
                            <p className="text-xs text-[#6e6478] font-semibold">
                              {record.proposal.roomType} · {record.proposal.styleName}
                            </p>
                            <h3 className="text-base font-extrabold text-[#2c1846] mt-1">
                              {record.proposal.title}
                            </h3>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {favoriteIdeas.length > 0 && (
                  <div className="space-y-3">
                    <h2 className="text-base font-extrabold text-[#3b1c5e]">أفكار ملهمة محفوظة</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      {favoriteIdeas.map((idea) => (
                        <button
                          key={idea.id}
                          type="button"
                          onClick={() => handleOpenIdea(idea)}
                          className="bg-white rounded-2xl overflow-hidden shadow-[0_8px_22px_rgba(59,28,94,0.08)] text-right cursor-pointer group"
                        >
                          <div className="aspect-4/3 w-full overflow-hidden">
                            <ResilientImage
                              src={idea.imageSrc}
                              alt={idea.title}
                              fallbackTitle={idea.title}
                              className="w-full h-full object-cover group-hover:scale-103 transition-transform"
                            />
                          </div>
                          <div className="p-3.5">
                            <p className="text-[11px] text-[#6e6478] font-semibold">
                              {idea.roomType} · {idea.styleName}
                            </p>
                            <h3 className="text-sm font-extrabold text-[#2c1846] mt-0.5">
                              {idea.title}
                            </h3>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {activeTab === 'profile' && (
          <section className="px-4 lg:px-0 pt-5 lg:pt-0 max-w-2xl mx-auto space-y-5" aria-label="حسابي">
            <div className="bg-white rounded-3xl p-6 shadow-[0_8px_22px_rgba(59,28,94,0.08)] flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-[#efe5f8] text-[#6c1bb0] flex items-center justify-center shrink-0">
                  <User className="w-7 h-7" />
                </div>
                <div>
                  <h1 className="text-xl font-extrabold text-[#3b1c5e]">
                    {preferences.displayName || 'عاشق التصميم'}
                  </h1>
                  <p className="text-xs sm:text-sm text-[#6e6478] mt-0.5">
                    {preferences.preferredStyle} · ميزانية {preferences.budgetLevel}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSettingsOpen(true)}
                className="min-h-[44px] px-4 rounded-xl bg-[#f7f3ee] hover:bg-[#efe8df] text-[#3b1c5e] text-xs font-bold inline-flex items-center gap-2 transition-colors cursor-pointer shrink-0"
              >
                <Settings className="w-4 h-4" />
                <span>تعديل التفضيلات</span>
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white rounded-2xl p-4 text-center shadow-[0_8px_22px_rgba(59,28,94,0.06)]">
                <div className="text-2xl font-extrabold text-[#6c1bb0] tabular-nums">
                  {history.length}
                </div>
                <div className="text-xs font-semibold text-[#6e6478] mt-1">تصاميم منشأة</div>
              </div>
              <div className="bg-white rounded-2xl p-4 text-center shadow-[0_8px_22px_rgba(59,28,94,0.06)]">
                <div className="text-2xl font-extrabold text-[#3b1c5e] tabular-nums">
                  {favoriteRecords.length + favoriteIdeas.length}
                </div>
                <div className="text-xs font-semibold text-[#6e6478] mt-1">في المفضلة</div>
              </div>
              <div className="bg-white rounded-2xl p-4 text-center shadow-[0_8px_22px_rgba(59,28,94,0.06)]">
                <div className="text-2xl font-extrabold text-[#e8b824] tabular-nums">
                  {history.reduce((sum, item) => sum + item.completedSteps.length, 0)}
                </div>
                <div className="text-xs font-semibold text-[#6e6478] mt-1">خطوات منفذة</div>
              </div>
            </div>

            <div className="bg-white rounded-3xl p-6 shadow-[0_8px_22px_rgba(59,28,94,0.08)] space-y-3">
              <h2 className="text-base font-extrabold text-[#3b1c5e]">إعدادات التصميم الافتراضية</h2>
              <div className="divide-y divide-[#3b1c5e]/8 text-sm">
                <div className="py-3 flex items-center justify-between">
                  <span className="text-[#6e6478]">النمط المفضل</span>
                  <span className="font-bold text-[#2c1846]">{preferences.preferredStyle}</span>
                </div>
                <div className="py-3 flex items-center justify-between">
                  <span className="text-[#6e6478]">الميزانية الافتراضية</span>
                  <span className="font-bold text-[#2c1846]">{preferences.budgetLevel}</span>
                </div>
                <div className="py-3 flex items-center justify-between">
                  <span className="text-[#6e6478]">درجة الإضاءة</span>
                  <span className="font-bold text-[#2c1846]">{preferences.lightingTone}</span>
                </div>
              </div>
              <div className="pt-2">
                <PWAInstallButton variant="card" />
              </div>
            </div>
          </section>
        )}
      </main>

      <OfflineIndicator />

      {/* شريط التنقل السفلي للجوال */}
      <nav
        className="lg:hidden fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md h-[68px] bg-white/95 backdrop-blur-md rounded-t-[22px] shadow-[0_-6px_24px_rgba(59,28,94,0.08)] grid grid-cols-4 items-center z-20"
        aria-label="التنقل السفلي"
      >
        {(
          [
            { id: 'home', label: 'الرئيسية', Icon: Home },
            { id: 'history', label: 'سجل التصاميم', Icon: Clock },
            { id: 'favorites', label: 'المفضلة', Icon: Heart },
            { id: 'profile', label: 'حسابي', Icon: User },
          ] as const
        ).map(({ id, label, Icon }) => {
          const active = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={`relative h-full flex flex-col items-center justify-center gap-0.5 transition-colors cursor-pointer ${
                active ? 'text-[#6c1bb0]' : 'text-[#4d4558]'
              }`}
            >
              <Icon className="w-[21px] h-[21px]" fill={active && id !== 'history' ? 'currentColor' : 'none'} />
              <span className="text-[11px] font-bold whitespace-nowrap">{label}</span>
              {active && (
                <span className="absolute bottom-1 w-12 h-[3px] rounded-full bg-[#6c1bb0]" aria-hidden="true" />
              )}
            </button>
          );
        })}
      </nav>

      <SettingsModal
        open={settingsOpen}
        preferences={preferences}
        historyCount={history.length}
        onClose={() => setSettingsOpen(false)}
        onSave={setPreferences}
        onClearHistory={() => {
          setHistory([]);
          setActiveRecordId(null);
          setSettingsOpen(false);
        }}
      />
    </div>
  );
}
