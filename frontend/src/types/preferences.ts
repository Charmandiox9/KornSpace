export type Language = 'es' | 'en';

export type Theme = 'light' | 'dark';

export interface DocumentPreferences {
  language: Language;
  theme: Theme;
}

export interface UserPreferences {
  language: Language;
  theme: Theme;
  toggleLanguage: () => void;
  toggleTheme: () => void;
}
