import { useEffect, useState } from 'react'

export const SELECTED_COUNTRY_STORAGE_KEY = 'backofficeSelectedCountry'
export const DEFAULT_SELECTED_COUNTRY = 'RO'
const SELECTED_COUNTRY_EVENT = 'backoffice:selected-country-changed'

const normalizeCountryCode = value => {
  const normalized = String(value || '')
    .trim()
    .toUpperCase()

  return normalized || DEFAULT_SELECTED_COUNTRY
}

export const getStoredSelectedCountry = () => {
  try {
    return normalizeCountryCode(localStorage.getItem(SELECTED_COUNTRY_STORAGE_KEY))
  } catch {
    return DEFAULT_SELECTED_COUNTRY
  }
}

export const setStoredSelectedCountry = value => {
  const nextValue = normalizeCountryCode(value)

  try {
    localStorage.setItem(SELECTED_COUNTRY_STORAGE_KEY, nextValue)
  } catch (error) {
    console.error('Failed to persist selected country', error)
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(SELECTED_COUNTRY_EVENT, {
        detail: nextValue
      })
    )
  }

  return nextValue
}

export const useSelectedCountry = () => {
  const [selectedCountry, setSelectedCountry] = useState(getStoredSelectedCountry)

  useEffect(() => {
    const handleStorage = event => {
      if (event.key === SELECTED_COUNTRY_STORAGE_KEY) {
        setSelectedCountry(normalizeCountryCode(event.newValue))
      }
    }

    const handleCustomEvent = event => {
      setSelectedCountry(normalizeCountryCode(event.detail))
    }

    window.addEventListener('storage', handleStorage)
    window.addEventListener(SELECTED_COUNTRY_EVENT, handleCustomEvent)

    return () => {
      window.removeEventListener('storage', handleStorage)
      window.removeEventListener(SELECTED_COUNTRY_EVENT, handleCustomEvent)
    }
  }, [])

  const updateSelectedCountry = value => {
    const nextValue = setStoredSelectedCountry(value)
    setSelectedCountry(nextValue)
    return nextValue
  }

  return [selectedCountry, updateSelectedCountry]
}
