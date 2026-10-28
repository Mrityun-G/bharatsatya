import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import hi from './locales/hi.json';
import ta from './locales/ta.json';
import te from './locales/te.json';
import bn from './locales/bn.json';

const savedLang = (typeof window !== 'undefined' && localStorage.getItem('bharatsatya_language')) || 'en';

void i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      hi: { translation: hi },
      ta: { translation: ta },
      te: { translation: te },
      bn: { translation: bn },
    },
    lng: ['en', 'hi', 'ta', 'te', 'bn'].includes(savedLang) ? savedLang : 'en',
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false, // React already safeguards against XSS
    },
  });

i18n.on('languageChanged', (lng) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('bharatsatya_language', lng);
    document.documentElement.lang = lng;
  }
});

export default i18n;
