import { useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowUpTrayIcon } from '@heroicons/react/24/outline'

import { saveImageToImgb } from '../../services/api'
import { resizeImageFile } from '../../util/resizeImageFile'

import { Field, inputClass } from './ui'

const ART_MAX_PX = 512
const isHttps = value => /^https:\/\/\S{3,990}$/.test(value || '')

/**
 * https URL field with an "Upload" shortcut through the existing
 * /backoffice/images/upload helper (the same one the food photos use).
 */
const ImageUrlField = ({ label, value, onChange, disabled }) => {
  const { t } = useTranslation()
  const fileRef = useRef(null)
  const inputId = useId()
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)
  const invalid = Boolean(value) && !isHttps(value)

  const onFile = async event => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setUploading(true)
    setError(null)
    try {
      const resized = await resizeImageFile(file, {
        maxWidth: ART_MAX_PX,
        maxHeight: ART_MAX_PX
      })
      const result = await saveImageToImgb(resized)
      // Same fallback as SearchItems when imgbb returns only an id.
      const url =
        result?.url ||
        (result?.id ? `https://i.ibb.co/${result.id}/${result.id}.jpg` : null)
      if (!isHttps(url)) throw new Error('upload failed')
      onChange(url)
    } catch {
      setError(t('admin.orbHunt.editor.uploadFailed'))
    } finally {
      setUploading(false)
    }
  }

  return (
    <Field
      label={label}
      hint={error || (invalid ? t('admin.orbHunt.editor.httpsOnly') : null)}
    >
      <div className="flex items-center gap-2">
        {isHttps(value) ? (
          <img
            src={value}
            alt=""
            width={40}
            height={40}
            loading="lazy"
            className="h-10 w-10 shrink-0 rounded-xl border border-slate-200 object-cover"
          />
        ) : (
          <span
            className="h-10 w-10 shrink-0 rounded-xl border border-dashed border-slate-300 bg-slate-50"
            aria-hidden="true"
          />
        )}
        <input
          id={inputId}
          type="url"
          inputMode="url"
          placeholder="https://…"
          value={value || ''}
          disabled={disabled}
          aria-invalid={invalid || undefined}
          onChange={e => onChange(e.target.value)}
          className={`${inputClass} ${invalid ? 'border-rose-400' : ''}`}
        />
        <button
          type="button"
          disabled={disabled || uploading}
          onClick={() => fileRef.current?.click()}
          className="af-focus af-press inline-flex h-10 shrink-0 items-center gap-1 rounded-xl border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:border-violet-400 hover:text-violet-800 disabled:opacity-50"
        >
          <ArrowUpTrayIcon
            className={`h-4 w-4 ${uploading ? 'animate-pulse' : ''}`}
          />
          {uploading
            ? t('admin.orbHunt.editor.uploading')
            : t('admin.orbHunt.editor.upload')}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          tabIndex={-1}
          onChange={onFile}
        />
      </div>
    </Field>
  )
}

export default ImageUrlField
