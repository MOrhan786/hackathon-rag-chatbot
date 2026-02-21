// src/theme/Navbar/LanguageToggle.tsx
import React, { useContext, useState, useEffect } from 'react';
import useIsBrowser from '@docusaurus/useIsBrowser';
import { AuthContext } from '@site/src/components/AuthContext';
import { LanguageContext, getStoredLanguage } from '@site/src/components/LanguageContext';
import type { Language } from '@site/src/components/LanguageContext';
import styles from './LanguageToggle.module.css';

export default function LanguageToggle(): JSX.Element | null {
  const { isAuthenticated } = useContext(AuthContext);
  const { language, setLanguage } = useContext(LanguageContext);
  const isBrowser = useIsBrowser();

  // Also read from localStorage directly as fallback
  const [displayLang, setDisplayLang] = useState<Language>('en');

  useEffect(() => {
    if (isBrowser) {
      setDisplayLang(getStoredLanguage());
    }
  }, [isBrowser, language]);

  if (!isAuthenticated) return null;

  const currentLang = language || displayLang;

  const handleSwitch = (lang: Language) => {
    setLanguage(lang);
    setDisplayLang(lang);
  };

  return (
    <div className={styles.toggleWrapper}>
      <div className={styles.toggle}>
        <button
          className={`${styles.toggleButton} ${currentLang === 'en' ? styles.active : ''}`}
          onClick={() => handleSwitch('en')}
          aria-label="Switch to English"
        >
          EN
        </button>
        <button
          className={`${styles.toggleButton} ${currentLang === 'ur' ? styles.active : ''}`}
          onClick={() => handleSwitch('ur')}
          aria-label="Switch to Urdu"
        >
          UR
        </button>
      </div>
    </div>
  );
}
