import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ArrowDownIcon,
  ArrowUpIcon,
  PlusIcon,
  TrashIcon
} from '@heroicons/react/24/outline'

import { moveItem, newSlot } from './campaignForm'
import ImageUrlField from './ImageUrlField'
import {
  DEFAULT_SLOT_CONFIG,
  LANGUAGES,
  SLOT_CONFIG_FIELDS,
  SLOT_LIMITS,
  SLOT_NAME_MAX,
  SOURCE_TYPES,
  fromLocalInput,
  toLocalInput
} from './model'
import { Badge, Button, Card, Field, NumberField, inputClass } from './ui'

const TYPE_STYLE = {
  STEPS: 'bg-blue-50 text-blue-800 ring-blue-600/20',
  ACTIVE_DAYS: 'bg-emerald-50 text-emerald-800 ring-emerald-600/20',
  STREAK: 'bg-orange-50 text-orange-800 ring-orange-600/20',
  EXPLORE: 'bg-violet-50 text-violet-800 ring-violet-600/20'
}

const SlotNames = ({ name, onChange, disabled }) => {
  const { t } = useTranslation()
  const [lang, setLang] = useState('en')
  return (
    <Field label={t('admin.orbHunt.slots.name')}>
      <div className="flex gap-2">
        <select
          value={lang}
          onChange={e => setLang(e.target.value)}
          aria-label={t('admin.orbHunt.editor.language')}
          className={`${inputClass} w-20 shrink-0`}
        >
          {LANGUAGES.map(code => (
            <option key={code} value={code}>
              {code.toUpperCase()}
              {name[code] ? ' ✓' : ''}
            </option>
          ))}
        </select>
        <input
          value={name[lang] || ''}
          maxLength={SLOT_NAME_MAX}
          disabled={disabled}
          placeholder={lang === 'en' ? '' : name.en || ''}
          onChange={e => onChange({ ...name, [lang]: e.target.value })}
          className={inputClass}
        />
      </div>
    </Field>
  )
}

const SlotRow = ({
  slot,
  index,
  count,
  onChange,
  onMove,
  onRemove,
  disabled
}) => {
  const { t } = useTranslation()
  const locked = slot.collected > 0
  const fields = SLOT_CONFIG_FIELDS[slot.sourceType] || []
  const set = patch => onChange({ ...slot, ...patch })
  return (
    <li className="rounded-2xl border border-slate-200 bg-white p-4 transition-colors hover:border-slate-300">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="af-num flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
            {index + 1}
          </span>
          <Badge className={TYPE_STYLE[slot.sourceType]}>
            {t(`admin.orbHunt.sourceTypes.${slot.sourceType}`)}
          </Badge>
          {slot.id ? (
            <span
              className={`text-xs ${locked ? 'font-semibold text-amber-700' : 'text-slate-500'}`}
            >
              {t('admin.orbHunt.slots.collectedBy', { count: slot.collected })}
            </span>
          ) : (
            <span className="text-xs font-semibold text-violet-700">
              {t('admin.orbHunt.slots.new')}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            disabled={disabled || index === 0}
            onClick={() => onMove(index, index - 1)}
            aria-label={t('admin.orbHunt.slots.moveUp', { slot: index + 1 })}
          >
            <ArrowUpIcon className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={disabled || index === count - 1}
            onClick={() => onMove(index, index + 1)}
            aria-label={t('admin.orbHunt.slots.moveDown', { slot: index + 1 })}
          >
            <ArrowDownIcon className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={disabled || locked || count <= SLOT_LIMITS.min}
            title={locked ? t('admin.orbHunt.slots.lockedRemove') : undefined}
            onClick={() => onRemove(index)}
            aria-label={t('admin.orbHunt.slots.remove', { slot: index + 1 })}
            className="hover:bg-rose-50! hover:text-rose-700!"
          >
            <TrashIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Field
          label={t('admin.orbHunt.slots.type')}
          hint={locked ? t('admin.orbHunt.slots.lockedType') : null}
        >
          <select
            value={slot.sourceType}
            disabled={disabled || locked}
            onChange={e =>
              set({
                sourceType: e.target.value,
                config: { ...DEFAULT_SLOT_CONFIG[e.target.value] }
              })
            }
            className={inputClass}
          >
            {SOURCE_TYPES.map(type => (
              <option key={type} value={type}>
                {t(`admin.orbHunt.sourceTypes.${type}`)}
              </option>
            ))}
          </select>
        </Field>
        {fields.map(field => (
          <NumberField
            key={field.key}
            label={t(`admin.orbHunt.slots.config.${field.key}`)}
            value={slot.config[field.key]}
            bounds={field.bounds}
            optional={!field.required}
            disabled={disabled}
            onChange={value =>
              set({ config: { ...slot.config, [field.key]: value } })
            }
          />
        ))}
        <SlotNames
          name={slot.name}
          disabled={disabled}
          onChange={name => set({ name })}
        />
        <ImageUrlField
          label={t('admin.orbHunt.slots.art')}
          value={slot.artUrl}
          disabled={disabled}
          onChange={artUrl => set({ artUrl })}
        />
        <Field
          label={t('admin.orbHunt.slots.unlocksAt')}
          hint={t('admin.orbHunt.common.optional')}
        >
          <input
            type="datetime-local"
            value={toLocalInput(slot.unlocksAt)}
            disabled={disabled}
            onChange={e => set({ unlocksAt: fromLocalInput(e.target.value) })}
            className={inputClass}
          />
        </Field>
      </div>
      <p className="mt-3 text-xs text-slate-500">
        {t(`admin.orbHunt.slots.help.${slot.sourceType}`)}
      </p>
    </li>
  )
}

/** Ordered list of slots (slot number = position). */
const SlotBuilder = ({ slots, onChange, disabled }) => {
  const { t } = useTranslation()
  const [newType, setNewType] = useState('STEPS')
  const update = (index, slot) =>
    onChange(slots.map((s, i) => (i === index ? slot : s)))
  const remove = index => onChange(slots.filter((_, i) => i !== index))
  const move = (from, to) => onChange(moveItem(slots, from, to))
  const full = slots.length >= SLOT_LIMITS.max

  return (
    <Card
      eyebrow={t('admin.orbHunt.slots.eyebrow')}
      title={t('admin.orbHunt.slots.title', {
        count: slots.length,
        max: SLOT_LIMITS.max
      })}
      actions={
        <div className="flex items-center gap-2">
          <select
            value={newType}
            onChange={e => setNewType(e.target.value)}
            disabled={disabled || full}
            aria-label={t('admin.orbHunt.slots.type')}
            className={`${inputClass} h-10 py-0`}
          >
            {SOURCE_TYPES.map(type => (
              <option key={type} value={type}>
                {t(`admin.orbHunt.sourceTypes.${type}`)}
              </option>
            ))}
          </select>
          <Button
            variant="primary"
            disabled={disabled || full}
            onClick={() => onChange([...slots, newSlot(newType)])}
          >
            <PlusIcon className="h-4 w-4" />
            {t('admin.orbHunt.slots.add')}
          </Button>
        </div>
      }
    >
      <p className="mb-4 text-sm text-slate-600">
        {t('admin.orbHunt.slots.intro')}
      </p>
      <ol className="space-y-3">
        {slots.map((slot, index) => (
          <SlotRow
            key={slot._key}
            slot={slot}
            index={index}
            count={slots.length}
            disabled={disabled}
            onChange={next => update(index, next)}
            onMove={move}
            onRemove={remove}
          />
        ))}
      </ol>
    </Card>
  )
}

export default SlotBuilder
