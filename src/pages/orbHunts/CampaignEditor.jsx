import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'

import {
  createCampaign,
  getCampaign,
  getCampaignTemplate,
  updateCampaign
} from '../../services/orbHuntApi'

import { clientProblems, toForm, toInput } from './campaignForm'
import ContentEditor from './ContentEditor'
import { ApiError } from './Modal'
import {
  CAMPAIGN_STATUS_STYLE,
  MAX_CAMPAIGN_DAYS,
  fromLocalInput,
  toLocalInput
} from './model'
import { SettingsEditor, WishOptionsEditor } from './SettingsEditor'
import SlotBuilder from './SlotBuilder'
import { Badge, Button, Card, Field, inputClass } from './ui'

/**
 * New campaign (prefilled from GET /template) or edit an existing one.
 * `campaignId` null = new. `onDone(detail|null)` returns to the list.
 */
const CampaignEditor = ({ campaignId, onDone }) => {
  const { t } = useTranslation()
  const [form, setForm] = useState(null)
  const [status, setStatus] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [saveError, setSaveError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [showProblems, setShowProblems] = useState(false)

  useEffect(() => {
    const controller = new window.AbortController()
    const load = async () => {
      try {
        const source = campaignId
          ? await getCampaign(campaignId, { signal: controller.signal })
          : await getCampaignTemplate({ signal: controller.signal })
        setForm(toForm(source))
        setStatus(source.status || 'DRAFT')
      } catch (error) {
        if (!controller.signal.aborted) setLoadError(error)
      }
    }
    load()
    return () => controller.abort()
  }, [campaignId])

  if (loadError) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => onDone(null)}>
          <ArrowLeftIcon className="h-4 w-4" />
          {t('admin.orbHunt.editor.back')}
        </Button>
        <ApiError error={loadError} />
      </div>
    )
  }
  if (!form) {
    return (
      <div className="space-y-4" aria-busy="true">
        <div className="af-skeleton h-24 w-full rounded-3xl" />
        <div className="af-skeleton h-96 w-full rounded-3xl" />
      </div>
    )
  }

  const readOnly = status === 'ARCHIVED'
  const problems = clientProblems(form)
  const patch = next => setForm(prev => ({ ...prev, ...next }))

  const save = async event => {
    event.preventDefault()
    if (problems.length) {
      setShowProblems(true)
      return
    }
    setSaving(true)
    setSaveError(null)
    try {
      const input = toInput(form)
      const detail = campaignId
        ? await updateCampaign(campaignId, input)
        : await createCampaign(input)
      onDone(detail)
    } catch (error) {
      setSaveError(error)
      setSaving(false)
    }
  }

  return (
    <form onSubmit={save} className="space-y-6" noValidate>
      <div className="sticky top-0 z-[500] -mx-1 flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur">
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={() => onDone(null)}>
            <ArrowLeftIcon className="h-4 w-4" />
            {t('admin.orbHunt.editor.back')}
          </Button>
          <h2 className="text-lg font-semibold text-slate-900">
            {campaignId
              ? t('admin.orbHunt.editor.editTitle')
              : t('admin.orbHunt.editor.newTitle')}
          </h2>
          <Badge className={CAMPAIGN_STATUS_STYLE[status]}>
            {t(`admin.orbHunt.status.${status}`)}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          {status === 'LIVE' ? (
            <span className="text-xs font-medium text-amber-700">
              {t('admin.orbHunt.editor.liveWarning')}
            </span>
          ) : null}
          <Button
            type="submit"
            variant="primary"
            loading={saving}
            disabled={readOnly}
          >
            {campaignId
              ? t('admin.orbHunt.editor.save')
              : t('admin.orbHunt.editor.create')}
          </Button>
        </div>
      </div>

      {readOnly ? (
        <p className="rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-700">
          {t('admin.orbHunt.editor.archivedReadOnly')}
        </p>
      ) : null}

      {showProblems && problems.length ? (
        <div
          role="alert"
          className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          <p className="font-semibold">{t('admin.orbHunt.editor.fixFirst')}</p>
          <ul className="mt-1 list-disc pl-5">
            {problems.map(p => (
              <li key={`${p.key}-${p.params?.slot || ''}`}>
                {t(`admin.orbHunt.editor.problems.${p.key}`, p.params)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <ApiError error={saveError} />

      <Card
        eyebrow={t('admin.orbHunt.editor.datesEyebrow')}
        title={t('admin.orbHunt.editor.dates')}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('admin.orbHunt.editor.startsAt')}>
            <input
              type="datetime-local"
              value={toLocalInput(form.startsAt)}
              disabled={readOnly}
              onChange={e =>
                patch({ startsAt: fromLocalInput(e.target.value) })
              }
              className={inputClass}
            />
          </Field>
          <Field
            label={t('admin.orbHunt.editor.endsAt')}
            hint={t('admin.orbHunt.editor.maxDays', {
              days: MAX_CAMPAIGN_DAYS
            })}
          >
            <input
              type="datetime-local"
              value={toLocalInput(form.endsAt)}
              disabled={readOnly}
              onChange={e => patch({ endsAt: fromLocalInput(e.target.value) })}
              className={inputClass}
            />
          </Field>
        </div>
      </Card>

      <ContentEditor
        content={form.content}
        theme={form.theme}
        disabled={readOnly}
        onContent={content => patch({ content })}
        onTheme={theme => patch({ theme })}
      />

      <SlotBuilder
        slots={form.orbs}
        disabled={readOnly}
        onChange={orbs => patch({ orbs })}
      />

      <WishOptionsEditor
        options={form.wishOptions}
        disabled={readOnly}
        onChange={wishOptions => patch({ wishOptions })}
      />

      <SettingsEditor
        settings={form.settings}
        disabled={readOnly}
        onChange={settings => patch({ settings })}
      />
    </form>
  )
}

export default CampaignEditor
