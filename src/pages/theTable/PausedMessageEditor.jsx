import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

// App languages (foodsync/translations). Must match TABLE_MESSAGE_LANGS in foodsync-api.
const LANGS = ['en', 'ro', 'hu', 'es', 'fr', 'pt', 'ja', 'th']
const TITLE_MAX = 80
const BODY_MAX = 400

const cleanMessages = draft =>
  Object.fromEntries(
    Object.entries(draft).flatMap(([lang, entry]) => {
      const title = (entry?.title || '').trim()
      const body = (entry?.body || '').trim()
      if (!title && !body) return []
      return [
        [lang, { ...(title ? { title } : {}), ...(body ? { body } : {}) }]
      ]
    })
  )

/**
 * Admin text the app shows while The Table is switched off, per language.
 * Saved with its own button so typing never toggles anything live.
 *
 * @param {{ value: Record<string, {title?: string, body?: string}>, disabled: boolean, onSave: (next: object) => void }} props
 */
const PausedMessageEditor = ({ value, disabled, onSave }) => {
  const { t } = useTranslation()
  const [lang, setLang] = useState('en')
  const [draft, setDraft] = useState(value || {})

  useEffect(() => {
    setDraft(value || {})
  }, [value])

  const isDirty = useMemo(
    () =>
      JSON.stringify(cleanMessages(draft)) !==
      JSON.stringify(cleanMessages(value || {})),
    [draft, value]
  )
  const entry = draft[lang] || {}
  const setField = (field, text) =>
    setDraft(prev => ({
      ...prev,
      [lang]: { ...(prev[lang] || {}), [field]: text }
    }))
  const filled = code =>
    !!(draft[code]?.title?.trim() || draft[code]?.body?.trim())

  return (
    <div className="border-t border-gray-100 py-4">
      <h3 className="text-sm font-semibold text-gray-900">
        {t('admin.appControls.theTable.messageTitle')}
      </h3>
      <p className="mt-1 text-sm text-gray-500">
        {t('admin.appControls.theTable.messageHint')}
      </p>

      <div className="mt-3 flex flex-wrap gap-1.5" role="tablist">
        {LANGS.map(code => (
          <button
            key={code}
            type="button"
            role="tab"
            aria-selected={lang === code}
            onClick={() => setLang(code)}
            className={`rounded-full px-3 py-1 text-xs font-semibold uppercase transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
              lang === code
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {code}
            {filled(code) ? ' •' : ''}
          </button>
        ))}
      </div>

      <label className="mt-3 block text-xs font-medium text-gray-700">
        {t('admin.appControls.theTable.messageHeading')}
        <input
          type="text"
          value={entry.title || ''}
          maxLength={TITLE_MAX}
          disabled={disabled}
          onChange={e => setField('title', e.target.value)}
          placeholder={t(
            'admin.appControls.theTable.messageHeadingPlaceholder'
          )}
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </label>
      <label className="mt-3 block text-xs font-medium text-gray-700">
        {t('admin.appControls.theTable.messageBody')}
        <textarea
          rows={3}
          value={entry.body || ''}
          maxLength={BODY_MAX}
          disabled={disabled}
          onChange={e => setField('body', e.target.value)}
          placeholder={t('admin.appControls.theTable.messageBodyPlaceholder')}
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
        <span className="mt-1 block text-right text-xs text-gray-400">
          {(entry.body || '').length}/{BODY_MAX}
        </span>
      </label>

      <div className="mt-2 flex items-center justify-end gap-2">
        {isDirty ? (
          <button
            type="button"
            onClick={() => setDraft(value || {})}
            disabled={disabled}
            className="rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
          >
            {t('admin.appControls.theTable.messageReset')}
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => onSave(cleanMessages(draft))}
          disabled={disabled || !isDirty}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-40"
        >
          {t('admin.appControls.theTable.messageSave')}
        </button>
      </div>
    </div>
  )
}

export default PausedMessageEditor
