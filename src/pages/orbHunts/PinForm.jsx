import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { createPin, deletePin, updatePin } from '../../services/orbHuntApi'

import { ApiError, ConfirmModal } from './Modal'
import { PIN_NAME_MAX, PIN_RADIUS, fromLocalInput, toLocalInput } from './model'
import { Button, Field, NumberField, Toggle, inputClass } from './ui'

const COORD_DIGITS = 6
const round = value => Number(Number(value).toFixed(COORD_DIGITS))

/** Pin → PinInput (only fields the API accepts). */
const toPinInput = pin => ({
  name: pin.name.trim(),
  ...(pin.description?.trim() ? { description: pin.description.trim() } : {}),
  lat: round(pin.lat),
  lng: round(pin.lng),
  radiusM: pin.radiusM,
  activeFrom: pin.activeFrom || null,
  activeTo: pin.activeTo || null,
  isActive: Boolean(pin.isActive)
})

/**
 * Create / edit / delete one admin pin. `pin.id` null = new.
 * `onChange(pin)` updates the draft (the map circle follows it).
 */
const PinForm = ({
  campaignId,
  pin,
  onChange,
  onSaved,
  onDeleted,
  onCancel
}) => {
  const { t } = useTranslation()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const set = patch => onChange({ ...pin, ...patch })
  const radiusValid =
    pin.radiusM >= PIN_RADIUS[0] && pin.radiusM <= PIN_RADIUS[1]
  const valid =
    pin.name.trim() &&
    radiusValid &&
    Number.isFinite(pin.lat) &&
    Number.isFinite(pin.lng)

  const save = async event => {
    event.preventDefault()
    if (!valid) return
    setSaving(true)
    setError(null)
    try {
      const saved = pin.id
        ? await updatePin(pin.id, toPinInput(pin))
        : await createPin(campaignId, toPinInput(pin))
      onSaved(saved, pin.id ? 'updated' : 'created')
    } catch (err) {
      setError(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <form
        onSubmit={save}
        className="space-y-3"
        aria-label={
          pin.id
            ? t('admin.orbHunt.map.editPin')
            : t('admin.orbHunt.map.newPin')
        }
      >
        <h3 className="text-base font-semibold text-slate-900">
          {pin.id
            ? t('admin.orbHunt.map.editPin')
            : t('admin.orbHunt.map.newPin')}
        </h3>
        {pin.id && pin.catches ? (
          <p className="text-xs font-medium text-sky-800">
            {t('admin.orbHunt.map.catches', { count: pin.catches })}
          </p>
        ) : null}
        <Field label={`${t('admin.orbHunt.map.name')} *`}>
          <input
            data-autofocus
            value={pin.name}
            maxLength={PIN_NAME_MAX}
            required
            onChange={e => set({ name: e.target.value })}
            className={inputClass}
          />
        </Field>
        <Field label={t('admin.orbHunt.map.description')}>
          <textarea
            rows={2}
            value={pin.description || ''}
            onChange={e => set({ description: e.target.value })}
            className={inputClass}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <NumberField
            label={t('admin.orbHunt.map.lat')}
            value={pin.lat}
            step={0.000001}
            onChange={lat => set({ lat })}
          />
          <NumberField
            label={t('admin.orbHunt.map.lng')}
            value={pin.lng}
            step={0.000001}
            onChange={lng => set({ lng })}
          />
        </div>
        <NumberField
          label={t('admin.orbHunt.map.radius')}
          value={pin.radiusM}
          bounds={PIN_RADIUS}
          onChange={radiusM => set({ radiusM })}
        />
        <div className="grid grid-cols-2 gap-3">
          <Field
            label={t('admin.orbHunt.map.activeFrom')}
            hint={t('admin.orbHunt.common.optional')}
          >
            <input
              type="datetime-local"
              value={toLocalInput(pin.activeFrom)}
              onChange={e =>
                set({ activeFrom: fromLocalInput(e.target.value) })
              }
              className={inputClass}
            />
          </Field>
          <Field
            label={t('admin.orbHunt.map.activeTo')}
            hint={t('admin.orbHunt.common.optional')}
          >
            <input
              type="datetime-local"
              value={toLocalInput(pin.activeTo)}
              onChange={e => set({ activeTo: fromLocalInput(e.target.value) })}
              className={inputClass}
            />
          </Field>
        </div>
        <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
          <span className="text-sm text-slate-800">
            {t('admin.orbHunt.map.isActive')}
          </span>
          <Toggle
            checked={pin.isActive}
            label={t('admin.orbHunt.map.isActive')}
            onChange={isActive => set({ isActive })}
          />
        </div>

        <ApiError error={error} />

        <div className="flex flex-wrap justify-between gap-2 pt-1">
          <div className="flex gap-2">
            <Button
              type="submit"
              variant="primary"
              loading={saving}
              disabled={!valid}
            >
              {pin.id
                ? t('admin.orbHunt.editor.save')
                : t('admin.orbHunt.map.create')}
            </Button>
            <Button variant="ghost" onClick={onCancel}>
              {t('admin.orbHunt.common.cancel')}
            </Button>
          </div>
          {pin.id ? (
            <Button variant="danger" onClick={() => setConfirmDelete(true)}>
              {t('admin.orbHunt.map.delete')}
            </Button>
          ) : null}
        </div>
      </form>

      {confirmDelete ? (
        <ConfirmModal
          title={t('admin.orbHunt.map.confirmDelete.title')}
          message={t('admin.orbHunt.map.confirmDelete.message', {
            name: pin.name
          })}
          confirmLabel={t('admin.orbHunt.map.delete')}
          tone="danger"
          requireNote
          onConfirm={async note => {
            const result = await deletePin(pin.id, note)
            onDeleted(pin, result?.outcome)
          }}
          onClose={() => setConfirmDelete(false)}
        />
      ) : null}
    </>
  )
}

export default PinForm
