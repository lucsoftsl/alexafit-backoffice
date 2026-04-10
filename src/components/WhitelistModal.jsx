import { useState } from 'react'
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline'
import { useTranslation } from 'react-i18next'

// ─── helpers ────────────────────────────────────────────────────────────────

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

const detectType = value => {
  if (value === 'true' || value === 'false') return 'toggle'
  if (typeof value === 'boolean') return 'toggle'
  if (typeof value === 'number') return 'number'
  if (typeof value === 'string' && DATE_RE.test(value.trim())) return 'date'
  if (typeof value === 'string' && !Number.isNaN(Number(value)) && value.trim() !== '') return 'number'
  return 'text'
}

const toDisplayValue = value => {
  if (value === null || value === undefined) return ''
  return String(value)
}

const parseDetails = raw => {
  if (!raw) return []
  const obj = typeof raw === 'string' ? JSON.parse(raw) : raw
  return Object.entries(obj).map(([key, value]) => ({
    id: crypto.randomUUID(),
    key,
    value: toDisplayValue(value),
    type: detectType(value)
  }))
}

const fieldsToObject = fields => {
  const obj = {}
  for (const field of fields) {
    if (!field.key.trim()) continue
    obj[field.key] = field.value
  }
  return obj
}

// ─── sub-components ─────────────────────────────────────────────────────────

const TypeBadge = ({ type, onChange }) => {
  const { t } = useTranslation()
  const wm = 'common.whitelistModal'
  const labels = {
    toggle: t(`${wm}.typeBool`),
    date:   t(`${wm}.typeDate`),
    number: t(`${wm}.typeNum`),
    text:   t(`${wm}.typeText`)
  }
  const colors = {
    toggle: 'bg-violet-100 text-violet-700',
    date:   'bg-blue-100 text-blue-700',
    number: 'bg-amber-100 text-amber-700',
    text:   'bg-slate-100 text-slate-600'
  }
  const cycle = { toggle: 'text', text: 'number', number: 'date', date: 'toggle' }
  return (
    <button
      type="button"
      onClick={() => onChange(cycle[type])}
      title={t(`${wm}.typeHint`)}
      className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${colors[type]} hover:opacity-80`}
    >
      {labels[type]}
    </button>
  )
}

const ValueInput = ({ field, onChange }) => {
  const { t } = useTranslation()
  const placeholder = t('common.whitelistModal.valuePlaceholder')

  if (field.type === 'toggle') {
    const checked = field.value === 'true'
    return (
      <button
        type="button"
        onClick={() => onChange(checked ? 'false' : 'true')}
        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ${
          checked ? 'bg-violet-600' : 'bg-slate-200'
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ${
            checked ? 'translate-x-4' : 'translate-x-0'
          }`}
        />
      </button>
    )
  }
  if (field.type === 'date') {
    return (
      <input
        type="date"
        value={field.value}
        onChange={e => onChange(e.target.value)}
        className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-400"
      />
    )
  }
  if (field.type === 'number') {
    return (
      <input
        type="number"
        value={field.value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-400"
      />
    )
  }
  return (
    <input
      type="text"
      value={field.value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-400"
    />
  )
}

// ─── main component ──────────────────────────────────────────────────────────

/**
 * @param {{ name: string, email: string }} userMeta
 * @param {object|string|null} currentDetails  — raw subscriptionWhitelistDetails
 * @param {(parsed: object) => Promise<void>} onSave
 * @param {() => void} onClose
 */
const WhitelistModal = ({ userMeta, currentDetails, onSave, onClose }) => {
  const { t } = useTranslation()
  const wm = 'common.whitelistModal'

  const [fields, setFields] = useState(() => {
    try { return parseDetails(currentDetails) } catch { return [] }
  })
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState(null)
  const [keyError, setKeyError] = useState(null)

  const updateField = (id, patch) => {
    setResult(null)
    setKeyError(null)
    setFields(prev => prev.map(f => f.id === id ? { ...f, ...patch } : f))
  }

  const removeField = id => {
    setResult(null)
    setFields(prev => prev.filter(f => f.id !== id))
  }

  const addField = () => {
    setFields(prev => [...prev, { id: crypto.randomUUID(), key: '', value: '', type: 'text' }])
  }

  const handleSave = async () => {
    const keys = fields.map(f => f.key.trim()).filter(Boolean)
    if (new Set(keys).size !== keys.length) {
      setKeyError(t(`${wm}.duplicateKeys`))
      return
    }
    setSaving(true)
    setResult(null)
    try {
      await onSave(fieldsToObject(fields))
      setResult({ ok: true, message: t(`${wm}.saveSuccess`) })
    } catch (err) {
      setResult({ ok: false, message: err?.message || t(`${wm}.saveFailed`) })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/45 p-4">
      <div className="flex w-full max-w-lg flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        {/* header */}
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <h3 className="text-xl font-bold text-slate-900">{t(`${wm}.title`)}</h3>
            <p className="mt-0.5 text-sm text-slate-500">
              {userMeta.name} &mdash; {userMeta.email}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            {t('common.close')}
          </button>
        </div>

        {/* body */}
        <div className="max-h-[60vh] overflow-y-auto px-6 py-4">
          {fields.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">
              {t(`${wm}.noFields`)}
            </p>
          ) : (
            <div className="space-y-2">
              {/* column headers */}
              <div className="grid grid-cols-[1fr_auto_1fr_auto] items-center gap-2 px-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                <span>{t(`${wm}.colKey`)}</span>
                <span>{t(`${wm}.colType`)}</span>
                <span>{t(`${wm}.colValue`)}</span>
                <span />
              </div>

              {fields.map(field => (
                <div
                  key={field.id}
                  className="grid grid-cols-[1fr_auto_1fr_auto] items-center gap-2"
                >
                  {/* key */}
                  <input
                    type="text"
                    value={field.key}
                    onChange={e => updateField(field.id, { key: e.target.value })}
                    placeholder={t(`${wm}.keyPlaceholder`)}
                    className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 font-mono text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-400"
                  />

                  {/* type badge — click to cycle */}
                  <TypeBadge
                    type={field.type}
                    onChange={newType => updateField(field.id, {
                      type: newType,
                      value: newType === 'toggle' ? 'false' : ''
                    })}
                  />

                  {/* value */}
                  <ValueInput
                    field={field}
                    onChange={value => updateField(field.id, { value })}
                  />

                  {/* remove */}
                  <button
                    type="button"
                    onClick={() => removeField(field.id)}
                    className="rounded-lg p-1 text-slate-400 hover:bg-red-50 hover:text-red-500"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* add field */}
          <button
            type="button"
            onClick={addField}
            className="mt-4 flex items-center gap-1.5 text-sm font-medium text-violet-600 hover:text-violet-800"
          >
            <PlusIcon className="h-4 w-4" />
            {t(`${wm}.addField`)}
          </button>
        </div>

        {/* feedback */}
        {keyError && (
          <div className="mx-6 mb-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
            {keyError}
          </div>
        )}
        {result && (
          <div className={`mx-6 mb-2 rounded-xl border px-4 py-2 text-sm ${result.ok ? 'border-green-200 bg-green-50 text-green-700' : 'border-red-200 bg-red-50 text-red-700'}`}>
            {result.message}
          </div>
        )}

        {/* footer */}
        <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-200 px-5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="rounded-full bg-violet-600 px-5 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
          >
            {saving ? t('common.loading') : t('common.save')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default WhitelistModal
