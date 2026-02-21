// src\theme\DocItem\Layout\index.tsx
import React, { useState, useCallback, useEffect, useContext, useRef } from 'react';
import DocItemLayout from '@theme-original/DocItem/Layout';
import TranslationControl, { clearSharedOriginalContent, setSharedOriginalContent, getSharedOriginalContent, formatMarkdownContent } from '../TranslationControl';
import Personalizer from '../Personalizer';
import type { Props } from '@theme/DocItem/Layout';
import styles from '../ContentControls.module.css';
import useIsBrowser from '@docusaurus/useIsBrowser';
import { useLocation } from '@docusaurus/router';
import { AuthContext } from '@site/src/components/AuthContext';
import { LANGUAGE_CHANGE_EVENT, getStoredLanguage, getCachedTranslation, setCachedTranslation } from '@site/src/components/LanguageContext';
import type { Language } from '@site/src/components/LanguageContext';

function AuthGate() {
  const { setShowAuthModal } = useContext(AuthContext);

  return (
    <div className={styles.authGate}>
      <div className={styles.authGateContent}>
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={styles.authGateIcon}>
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        <h2 className={styles.authGateTitle}>Sign in to access course content</h2>
        <p className={styles.authGateText}>
          Create a free account or sign in to access all modules, personalized learning, and AI-powered assistance.
        </p>
        <button
          className={styles.authGateButton}
          onClick={() => setShowAuthModal(true)}
        >
          Sign In to Continue
        </button>
      </div>
    </div>
  );
}

const TRANSLATE_API_URL = 'https://mrsasif-hackathon1-c.hf.space';
const TRANSLATE_API_KEY = 'password123';

async function translateContent(pathname: string, contentElement: Element): Promise<string | null> {
  try {
    // Store original if not stored
    if (!getSharedOriginalContent()) {
      setSharedOriginalContent(contentElement.innerHTML);
    }

    // Check localStorage cache first
    const cached = getCachedTranslation(pathname);
    if (cached) return cached;

    // Get original text for API
    const originalContent = getSharedOriginalContent();
    const originalText = originalContent
      ? new DOMParser().parseFromString(originalContent, 'text/html').body.textContent
      : contentElement.textContent;

    // Try up to 2 times with generous timeout (HF spaces need cold-start time)
    let data: any = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000);

      try {
        const response = await fetch(`${TRANSLATE_API_URL}/api/translate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': TRANSLATE_API_KEY,
          },
          body: JSON.stringify({
            content: originalText || '',
            target_language: 'urdu',
          }),
          signal: controller.signal,
          mode: 'cors',
          credentials: 'omit',
        });

        clearTimeout(timeoutId);

        if (!response.ok) throw new Error('Translation failed');
        data = await response.json();
        break; // Success, exit retry loop
      } catch (retryErr) {
        clearTimeout(timeoutId);
        if (attempt === 1) throw retryErr; // Last attempt, throw
        // First attempt failed, wait 2s then retry
        await new Promise(r => setTimeout(r, 2000));
      }
    }

    if (!data) throw new Error('Translation failed');

    const translatedHTML = `
      <div class="${styles.translatedBanner}">
        🌐 اردو میں ترجمہ شدہ
      </div>
      <div class="${styles.translatedContent}" dir="rtl">
        ${formatMarkdownContent(data.translated_content)}
      </div>
    `;

    // Cache in localStorage
    setCachedTranslation(pathname, translatedHTML);

    return translatedHTML;
  } catch (err) {
    console.error('Translation error:', err);
    return null;
  }
}

export default function DocItemLayoutWrapper(props: Props): JSX.Element {
  const { isAuthenticated, isLoading } = useContext(AuthContext);
  const [isTranslationActive, setIsTranslationActive] = useState(false);
  const [isPersonalizationActive, setIsPersonalizationActive] = useState(false);
  const [isGlobalTranslating, setIsGlobalTranslating] = useState(false);
  const isBrowser = useIsBrowser();
  const location = useLocation();
  const autoTranslateAttempted = useRef(false);

  // Reset states when navigating to a new page
  useEffect(() => {
    setIsTranslationActive(false);
    setIsPersonalizationActive(false);
    clearSharedOriginalContent();
    autoTranslateAttempted.current = false;
  }, [location.pathname]);

  // Helper: apply translation to current page
  const applyTranslation = useCallback(async (lang: Language) => {
    const contentElement = document.querySelector('.theme-doc-markdown');
    if (!contentElement) return;

    if (lang === 'ur') {
      if (autoTranslateAttempted.current) return;
      autoTranslateAttempted.current = true;

      if (!getSharedOriginalContent()) {
        setSharedOriginalContent(contentElement.innerHTML);
      }

      // Check cache first (instant)
      const cached = getCachedTranslation(location.pathname);
      if (cached) {
        contentElement.innerHTML = cached;
        setIsTranslationActive(true);
        return;
      }

      // Call API
      setIsGlobalTranslating(true);
      const html = await translateContent(location.pathname, contentElement);
      setIsGlobalTranslating(false);

      if (html) {
        const el = document.querySelector('.theme-doc-markdown');
        if (el) {
          el.innerHTML = html;
          setIsTranslationActive(true);
        }
      } else {
        autoTranslateAttempted.current = false;
      }
    } else if (lang === 'en') {
      autoTranslateAttempted.current = false;
      const original = getSharedOriginalContent();
      if (original && contentElement) {
        contentElement.innerHTML = original;
      }
      setIsTranslationActive(false);
    }
  }, [location.pathname]);

  // Listen for global language change events (fired from LanguageToggle via window event)
  useEffect(() => {
    if (!isBrowser || !isAuthenticated) return;

    const handler = (e: Event) => {
      const lang = (e as CustomEvent).detail?.language as Language;
      if (lang) {
        applyTranslation(lang);
      }
    };

    window.addEventListener(LANGUAGE_CHANGE_EVENT, handler);
    return () => window.removeEventListener(LANGUAGE_CHANGE_EVENT, handler);
  }, [isBrowser, isAuthenticated, applyTranslation]);

  // On page navigation: if language is already UR, auto-translate the new page
  useEffect(() => {
    if (!isBrowser || !isAuthenticated) return;

    const lang = getStoredLanguage();
    if (lang === 'ur') {
      // Small delay to ensure DOM is rendered after navigation
      const timerId = setTimeout(() => applyTranslation('ur'), 300);
      return () => clearTimeout(timerId);
    }
  }, [location.pathname, isBrowser, isAuthenticated]);

  const handleTranslationStateChange = useCallback((isActive: boolean) => {
    setIsTranslationActive(isActive);
    if (isActive) {
      setIsPersonalizationActive(false);
    }
  }, []);

  const handlePersonalizationStateChange = useCallback((isActive: boolean) => {
    setIsPersonalizationActive(isActive);
    if (isActive) {
      setIsTranslationActive(false);
    }
  }, []);

  const resetTranslation = useCallback(() => {
    if (isBrowser && (window as any).__resetTranslation) {
      (window as any).__resetTranslation();
    }
    setIsTranslationActive(false);
  }, [isBrowser]);

  const resetPersonalization = useCallback(() => {
    if (isBrowser && (window as any).__resetPersonalization) {
      (window as any).__resetPersonalization();
    }
    setIsPersonalizationActive(false);
  }, [isBrowser]);

  // Show loading state while checking auth
  if (isLoading) {
    return <DocItemLayout {...props} />;
  }

  // Show auth gate if not authenticated
  if (!isAuthenticated) {
    return <AuthGate />;
  }

  return (
    <>
      <div className={styles.controlsBar}>
        <TranslationControl
          onStateChange={handleTranslationStateChange}
          otherTransformActive={isPersonalizationActive}
          onResetOther={resetPersonalization}
        />
        <Personalizer
          onStateChange={handlePersonalizationStateChange}
          otherTransformActive={isTranslationActive}
          onResetOther={resetTranslation}
        />
      </div>
      <DocItemLayout {...props} />
    </>
  );
}
