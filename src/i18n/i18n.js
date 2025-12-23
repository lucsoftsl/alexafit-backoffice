import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from '../locales/en.json'
import fr from '../locales/fr.json'
import es from '../locales/es.json'
import ro from '../locales/ro.json'

const stored = typeof window !== 'undefined' ? localStorage.getItem('lang') : null
const initialLang = stored || (typeof navigator !== 'undefined' ? (navigator.language || 'en').split('-')[0] : 'en')

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      fr: { translation: fr },
      es: { translation: es },
      ro: { translation: ro }
    },
    lng: ['en', 'fr', 'es', 'ro'].includes(initialLang) ? initialLang : 'en',
    fallbackLng: 'en',
    interpolation: { escapeValue: false }
  })

export default i18n
