import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import ImageUrlField from './ImageUrlField'
import { DESCRIPTION_MAX, LANGUAGES, TITLE_MAX, WISH_TEXT_MAX } from './model'
import { Card, Field, Tabs, inputClass } from './ui'

const HEX = /^#[0-9a-fA-F]{6}$/

const Counter = ({ value, max }) => (
  <span className="af-num">
    {(value || '').length}/{max}
  </span>
)

/** Title / description / wish text per language, plus theme colour + art. */
const ContentEditor = ({ content, theme, onContent, onTheme, disabled }) => {
  const { t } = useTranslation()
  const [lang, setLang] = useState('en')
  const entry = content[lang] || {}
  const setField = (key, value) =>
    onContent({ ...content, [lang]: { ...entry, [key]: value } })

  const filled = code =>
    Boolean(
      content[code] && Object.values(content[code]).some(v => v?.trim?.())
    )

  const tabs = LANGUAGES.map(code => ({
    id: code,
    label: `${code.toUpperCase()}${filled(code) ? ' ✓' : ''}`
  }))
  const colorValid = HEX.test(theme.color || '')

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <Card
        eyebrow={t('admin.orbHunt.editor.contentEyebrow')}
        title={t('admin.orbHunt.editor.content')}
      >
        <Tabs
          tabs={tabs}
          active={lang}
          onChange={setLang}
          size="sm"
          label={t('admin.orbHunt.editor.language')}
        />
        <p className="mt-2 text-xs text-slate-500">
          {lang === 'en'
            ? t('admin.orbHunt.editor.enRequired')
            : t('admin.orbHunt.editor.fallsBackToEn')}
        </p>
        <div className="mt-4 space-y-4">
          <Field
            label={`${t('admin.orbHunt.editor.title')}${lang === 'en' ? ' *' : ''}`}
            hint={<Counter value={entry.title} max={TITLE_MAX} />}
          >
            <input
              value={entry.title || ''}
              maxLength={TITLE_MAX}
              disabled={disabled}
              required={lang === 'en'}
              placeholder={lang === 'en' ? '' : content.en?.title || ''}
              onChange={e => setField('title', e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field
            label={t('admin.orbHunt.editor.description')}
            hint={<Counter value={entry.description} max={DESCRIPTION_MAX} />}
          >
            <textarea
              rows={4}
              value={entry.description || ''}
              maxLength={DESCRIPTION_MAX}
              disabled={disabled}
              placeholder={lang === 'en' ? '' : content.en?.description || ''}
              onChange={e => setField('description', e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field
            label={t('admin.orbHunt.editor.wishText')}
            hint={<Counter value={entry.wishText} max={WISH_TEXT_MAX} />}
          >
            <textarea
              rows={2}
              value={entry.wishText || ''}
              maxLength={WISH_TEXT_MAX}
              disabled={disabled}
              placeholder={lang === 'en' ? '' : content.en?.wishText || ''}
              onChange={e => setField('wishText', e.target.value)}
              className={inputClass}
            />
          </Field>
        </div>
      </Card>

      <Card
        eyebrow={t('admin.orbHunt.editor.themeEyebrow')}
        title={t('admin.orbHunt.editor.theme')}
      >
        <div className="space-y-4">
          <Field
            label={t('admin.orbHunt.editor.color')}
            hint={colorValid ? null : t('admin.orbHunt.editor.colorHint')}
          >
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={colorValid ? theme.color : '#7c5cff'}
                disabled={disabled}
                onChange={e => onTheme({ ...theme, color: e.target.value })}
                aria-label={t('admin.orbHunt.editor.color')}
                className="h-10 w-12 cursor-pointer rounded-xl border border-slate-300 bg-white p-1"
              />
              <input
                value={theme.color || ''}
                disabled={disabled}
                maxLength={7}
                onChange={e => onTheme({ ...theme, color: e.target.value })}
                className={`${inputClass} af-num uppercase`}
              />
            </div>
          </Field>
          <ImageUrlField
            label={t('admin.orbHunt.editor.orbArt')}
            value={theme.orbArtUrl}
            disabled={disabled}
            onChange={orbArtUrl => onTheme({ ...theme, orbArtUrl })}
          />
          <ImageUrlField
            label={t('admin.orbHunt.editor.spiritArt')}
            value={theme.spiritArtUrl}
            disabled={disabled}
            onChange={spiritArtUrl => onTheme({ ...theme, spiritArtUrl })}
          />
          <div
            className="flex h-24 items-center justify-center rounded-2xl text-sm font-semibold text-white shadow-inner"
            style={{
              background: colorValid
                ? `radial-gradient(circle at 30% 30%, ${theme.color}cc, ${theme.color} 60%, #0f172a)`
                : '#94a3b8'
            }}
            aria-hidden="true"
          >
            {content.en?.title || t('admin.orbHunt.editor.preview')}
          </div>
        </div>
      </Card>
    </div>
  )
}

export default ContentEditor
