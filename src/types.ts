export type DecorCategory = 'عام' | 'ألوان الطلاء' | 'الأثاث' | 'الإضاءة' | 'الأرضيات';

export type NavTab = 'home' | 'history' | 'favorites' | 'profile';

export interface ColorSwatch {
  name: string;
  hex: string;
  usage: string;
}

export interface CategoryRecommendation {
  category: string;
  title: string;
  detail: string;
  priority: string;
}

export interface DecorProposal {
  title: string;
  roomType: string;
  styleName: string;
  summary: string;
  budgetEstimate: string;
  colorPalette: ColorSwatch[];
  recommendations: CategoryRecommendation[];
  quickSteps: string[];
}

export type ImageProviderId = 'icbinp' | 'dreamshaper' | 'deliberate' | 'flux-schnell';

export interface ImageProviderInfo {
  id: ImageProviderId;
  name: string;
  subtitle: string;
  supportsPhotoEdit: boolean;
  configured: boolean;
  secretName: string;
}

export interface VisualOption {
  id: string;
  label: string;
  description: string;
  imageDataUrl: string;
  provider?: ImageProviderId;
}

export interface DesignRecord {
  id: string;
  createdAt: string;
  imageSrc: string;
  category: DecorCategory;
  notes?: string;
  proposal: DecorProposal;
  visualOptions?: VisualOption[];
  isFavorite: boolean;
  completedSteps: number[];
}

export interface CuratedIdea {
  id: string;
  title: string;
  subtitle: string;
  roomType: string;
  styleName: string;
  focusCategory: DecorCategory;
  imageSrc: string;
  palette: ColorSwatch[];
  presetProposal: DecorProposal;
}

export interface UserPreferences {
  displayName: string;
  preferredStyle: string;
  budgetLevel: string;
  lightingTone: string;
}
