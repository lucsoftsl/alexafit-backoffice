import { useTranslation } from 'react-i18next'
import {
  ArrowUturnLeftIcon,
  DocumentDuplicateIcon,
  PlusIcon,
  TrashIcon
} from '@heroicons/react/24/outline'

import { Button, Field, inputClass } from '../orbHunts/ui'

import { CURATED_LIMITS } from './model'

export const TextField = ({ label, value, onChange, max, multiline, hint }) => {
  const Tag = multiline ? 'textarea' : 'input'
  return (
    <Field
      label={label}
      hint={
        <span className="flex justify-between gap-2">
          <span>{hint}</span>
          <span className="af-num">
            {value.length}/{max}
          </span>
        </span>
      }
    >
      <Tag
        value={value}
        maxLength={max}
        rows={multiline ? 5 : undefined}
        onChange={e => onChange(e.target.value)}
        className={inputClass}
      />
    </Field>
  )
}

const MissingVersion = ({ langLabel, canCopy, onCreate }) => {
  const { t } = useTranslation()
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
      <p className="font-semibold text-slate-900">
        {t('admin.theTable.curated.missingLang', { lang: langLabel })}
      </p>
      <p className="mt-1 text-sm text-slate-500">
        {t('admin.theTable.curated.missingLangHint')}
      </p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {canCopy ? (
          <Button variant="primary" onClick={() => onCreate(true)}>
            <DocumentDuplicateIcon className="h-4 w-4" aria-hidden="true" />
            {t('admin.theTable.curated.startFromEnglish')}
          </Button>
        ) : null}
        <Button onClick={() => onCreate(false)}>
          <PlusIcon className="h-4 w-4" aria-hidden="true" />
          {t('admin.theTable.curated.startEmpty')}
        </Button>
      </div>
    </div>
  )
}

/** One language tab of the group editor: its own text, or a "not translated yet" state. */
const CuratedLangPanel = ({
  langLabel,
  version,
  isCurated,
  canCopy,
  canRemove,
  errors,
  onChange,
  onCreate,
  onRemove,
  onRestore
}) => {
  const { t } = useTranslation()
  const L = CURATED_LIMITS

  if (!version) {
    return (
      <MissingVersion
        langLabel={langLabel}
        canCopy={canCopy}
        onCreate={onCreate}
      />
    )
  }
  if (version.removed) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 px-6 py-8 text-center">
        <p className="font-semibold text-rose-900">
          {t('admin.theTable.curated.langRemoved', { lang: langLabel })}
        </p>
        <Button className="mt-3" onClick={onRestore}>
          <ArrowUturnLeftIcon className="h-4 w-4" aria-hidden="true" />
          {t('admin.theTable.curated.restoreLang')}
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {isCurated ? (
        <>
          <TextField
            label={t('admin.theTable.curated.title')}
            value={version.title}
            max={L.title}
            onChange={title => onChange({ title })}
          />
          <TextField
            multiline
            label={t('admin.theTable.curated.body')}
            value={version.body}
            max={L.body}
            onChange={body => onChange({ body })}
          />
          <TextField
            label={t('admin.theTable.curated.ctaLabel')}
            value={version.ctaLabel}
            max={L.ctaLabel}
            hint={t('admin.theTable.curated.ctaLabelHint')}
            onChange={ctaLabel => onChange({ ctaLabel })}
          />
        </>
      ) : (
        <Field
          label={t('admin.theTable.curated.snapshot')}
          hint={t('admin.theTable.curated.snapshotHint')}
        >
          <textarea
            value={version.payloadText}
            onChange={e => onChange({ payloadText: e.target.value })}
            rows={12}
            spellCheck={false}
            className={`${inputClass} font-mono text-xs`}
          />
        </Field>
      )}

      {errors?.length ? (
        <ul className="list-disc space-y-0.5 rounded-2xl bg-rose-50 py-3 pl-9 pr-4 text-sm text-rose-800">
          {errors.map(key => (
            <li key={key}>{t(`admin.theTable.curated.errors.${key}`)}</li>
          ))}
        </ul>
      ) : null}

      {canRemove ? (
        <div className="flex justify-end">
          <Button size="sm" variant="ghost" onClick={onRemove}>
            <TrashIcon className="h-4 w-4" aria-hidden="true" />
            {t('admin.theTable.curated.removeLang', { lang: langLabel })}
          </Button>
        </div>
      ) : null}
    </div>
  )
}

export default CuratedLangPanel
