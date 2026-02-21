// src/components/LanguageContext.tsx
import React, { createContext, useState, useEffect, useCallback, ReactNode } from 'react';
import useIsBrowser from '@docusaurus/useIsBrowser';

export type Language = 'en' | 'ur';

const STORAGE_KEY = 'physicalai_language';
const CACHE_PREFIX = 'physicalai_translation_cache_';

// Custom event name for cross-component communication
export const LANGUAGE_CHANGE_EVENT = 'physicalai_language_change';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  isGlobalTranslating: boolean;
  setIsGlobalTranslating: (v: boolean) => void;
}

export const LanguageContext = createContext<LanguageContextType>({
  language: 'en',
  setLanguage: () => {},
  isGlobalTranslating: false,
  setIsGlobalTranslating: () => {},
});

// Standalone helpers that work without context (use localStorage directly)
export function getCachedTranslation(pathname: string): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(CACHE_PREFIX + pathname);
}

export function setCachedTranslation(pathname: string, html: string) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CACHE_PREFIX + pathname, html);
  } catch {
    // localStorage full — clear old caches and retry
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(CACHE_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
    try {
      localStorage.setItem(CACHE_PREFIX + pathname, html);
    } catch {
      // Give up silently
    }
  }
}

export function getStoredLanguage(): Language {
  if (typeof window === 'undefined') return 'en';
  const saved = localStorage.getItem(STORAGE_KEY);
  return (saved === 'ur') ? 'ur' : 'en';
}

interface LanguageProviderProps {
  children: ReactNode;
}

export function LanguageProvider({ children }: LanguageProviderProps) {
  const isBrowser = useIsBrowser();
  const [language, setLanguageState] = useState<Language>('en');
  const [isGlobalTranslating, setIsGlobalTranslating] = useState(false);

  // Load saved language preference on mount
  useEffect(() => {
    if (!isBrowser) return;
    setLanguageState(getStoredLanguage());
  }, [isBrowser]);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, lang);
      // Dispatch custom event so ANY component can listen (even outside React context)
      window.dispatchEvent(new CustomEvent(LANGUAGE_CHANGE_EVENT, { detail: { language: lang } }));
    }
  }, []);

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        isGlobalTranslating,
        setIsGlobalTranslating,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export default LanguageContext;
