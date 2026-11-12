import { useTranslation } from 'react-i18next'
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline'

import { setSetting } from './campaignForm'
import {
  SETTINGS_GROUPS,
  WISH_AMOUNT_BOUNDS,
  WISH_OPTION_LIMITS,
  WISH_TYPES,
  clamp
} from './model'
import { Button, Card, Field, NumberField, Toggle, inputClass } from './ui'

/** Grouped campaign settings (superOrb, activity, steps, explore, pins, wish). */
export const SettingsEditor = ({ settings, onChange, disabled }) => {
  const { t } = useTranslation()
  return (
    <Card
      eyebrow={t('admin.orbHunt.settings.eyebrow')}
      title={t('admin.orbHunt.settings.title')}
    >
      <div className="grid gap-4 lg:grid-cols-2">
        {SETTINGS_GROUPS.map(group => (
          <fieldset
            key={group.key}
            className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4"
          >
            <legend className="px-1 text-sm font-semibold text-slate-900">
              {t(`admin.orbHunt.settings.groups.${group.key}`)}
            </legend>
            <p className="mb-3 text-xs text-slate-500">
              {t(`admin.orbHunt.settings.groupHelp.${group.key}`)}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {group.fields.map(field => {
                const label = t(
                  `admin.orbHunt.settings.fields.${group.key}.${field.key}`
                )
                const value = settings?.[group.key]?.[field.key]
                const set = next =>
                  onChange(setSetting(settings, group.key, field.key, next))
                return field.type === 'bool' ? (
                  <div
                    key={field.key}
                    className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2 ring-1 ring-slate-200"
                  >
                    <span className="text-sm text-slate-800">{label}</span>
                    <Toggle
                      checked={Boolean(value)}
                      disabled={disabled}
                      label={label}
                      onChange={set}
                    />
                  </div>
                ) : (
                  <NumberField
                    key={field.key}
                    label={label}
                    value={value}
                    bounds={field.bounds}
                    step={field.step || 1}
                    disabled={disabled}
                    onChange={set}
                  />
                )
              })}
            </div>
          </fieldset>
        ))}
      </div>
    </Card>
  )
}

/** 1–4 wish options: slug id, type and amount. */
export const WishOptionsEditor = ({ options, onChange, disabled }) => {
  const { t } = useTranslation()
  const update = (index, patch) =>
    onChange(options.map((o, i) => (i === index ? { ...o, ...patch } : o)))
  const add = () =>
    onChange([
      ...options,
      { id: `option-${options.length + 1}`, type: 'COINS', amount: 50 }
    ])
  return (
    <Card
      eyebrow={t('admin.orbHunt.wishOptions.eyebrow')}
      title={t('admin.orbHunt.wishOptions.title')}
      actions={
        <Button
          variant="secondary"
          disabled={disabled || options.length >= WISH_OPTION_LIMITS.max}
          onClick={add}
        >
          <PlusIcon className="h-4 w-4" />
          {t('admin.orbHunt.wishOptions.add')}
        </Button>
      }
    >
      <p className="mb-3 text-sm text-slate-600">
        {t('admin.orbHunt.wishOptions.intro', {
          min: WISH_OPTION_LIMITS.min,
          max: WISH_OPTION_LIMITS.max
        })}
      </p>
      <ul className="space-y-3">
        {options.map((option, index) => (
          <li
            key={index}
            className="grid items-end gap-3 rounded-2xl border border-slate-200 p-3 sm:grid-cols-[1fr_1fr_1fr_auto]"
          >
            <Field
              label={t('admin.orbHunt.wishOptions.id')}
              hint={t('admin.orbHunt.wishOptions.idHint')}
            >
              <input
                value={option.id}
                disabled={disabled}
                maxLength={40}
                onChange={e =>
                  update(index, { id: e.target.value.toLowerCase() })
                }
                className={`${inputClass} font-mono`}
              />
            </Field>
            <Field label={t('admin.orbHunt.wishOptions.type')}>
              <select
                value={option.type}
                disabled={disabled}
                onChange={e =>
                  update(index, {
                    type: e.target.value,
                    amount: clamp(
                      option.amount || 1,
                      WISH_AMOUNT_BOUNDS[e.target.value]
                    )
                  })
                }
                className={inputClass}
              >
                {WISH_TYPES.map(type => (
                  <option key={type} value={type}>
                    {t(`admin.orbHunt.wishTypes.${type}`)}
                  </option>
                ))}
              </select>
            </Field>
            <NumberField
              label={t('admin.orbHunt.wishOptions.amount')}
              value={option.amount}
              bounds={WISH_AMOUNT_BOUNDS[option.type]}
              disabled={disabled}
              onChange={amount => update(index, { amount })}
            />
            <Button
              variant="ghost"
              disabled={disabled || options.length <= WISH_OPTION_LIMITS.min}
              onClick={() => onChange(options.filter((_, i) => i !== index))}
              aria-label={t('admin.orbHunt.wishOptions.remove')}
              className="mb-5"
            >
              <TrashIcon className="h-4 w-4" />
            </Button>
          </li>
        ))}
      </ul>
    </Card>
  )
}
