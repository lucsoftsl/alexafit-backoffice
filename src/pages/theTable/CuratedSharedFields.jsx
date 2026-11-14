import { useTranslation } from 'react-i18next'

import ImageUrlField from '../orbHunts/ImageUrlField'
import { Field, Toggle, inputClass } from '../orbHunts/ui'

import { CURATED_LIMITS, CURATED_TYPES } from './model'
import { TextField } from './CuratedLangPanel'

const PHOTO_MAX_PX = 1080

/** Settings every language version of a curated post shares. */
const CuratedSharedFields = ({ shared, isNew, onChange }) => {
  const { t } = useTranslation()
  const L = CURATED_LIMITS
  const isCurated = shared.type === 'CURATED'

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label={t('admin.theTable.curated.type')}
          hint={isNew ? null : t('admin.theTable.curated.typeLocked')}
        >
          <select
            value={shared.type}
            disabled={!isNew}
            onChange={e => onChange({ type: e.target.value })}
            className={inputClass}
          >
            {CURATED_TYPES.map(type => (
              <option key={type} value={type}>
                {t(`admin.theTable.types.${type}`)}
              </option>
            ))}
          </select>
        </Field>
        {isCurated ? (
          <TextField
            label={t('admin.theTable.curated.ctaTarget')}
            value={shared.ctaTarget}
            max={L.ctaTarget}
            hint={t('admin.theTable.curated.ctaTargetHint')}
            onChange={ctaTarget => onChange({ ctaTarget })}
          />
        ) : null}
      </div>

      <ImageUrlField
        label={t('admin.theTable.curated.photo')}
        value={shared.photoUrl}
        maxPx={PHOTO_MAX_PX}
        onChange={photoUrl => onChange({ photoUrl })}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label={t('admin.theTable.curated.startsAt')}>
          <input
            type="datetime-local"
            value={shared.startsAt}
            onChange={e => onChange({ startsAt: e.target.value })}
            className={inputClass}
          />
        </Field>
        <Field label={t('admin.theTable.curated.endsAt')}>
          <input
            type="datetime-local"
            value={shared.endsAt}
            onChange={e => onChange({ endsAt: e.target.value })}
            className={inputClass}
          />
        </Field>
        <Field
          label={t('admin.theTable.curated.sortOrder')}
          hint={t('admin.theTable.curated.sortOrderHint')}
        >
          <input
            type="number"
            min={L.sortOrder[0]}
            max={L.sortOrder[1]}
            step={1}
            value={shared.sortOrder}
            onChange={e => onChange({ sortOrder: e.target.value })}
            className={`${inputClass} af-num`}
          />
        </Field>
      </div>

      <div className="flex items-center justify-between gap-4 rounded-2xl bg-slate-50 px-4 py-3">
        <div>
          <p className="text-sm font-medium text-slate-900">
            {t('admin.theTable.curated.isActive')}
          </p>
          <p className="text-xs text-slate-500">
            {t('admin.theTable.curated.isActiveHint')}
          </p>
        </div>
        <Toggle
          checked={shared.isActive}
          onChange={isActive => onChange({ isActive })}
          label={t('admin.theTable.curated.isActive')}
        />
      </div>
    </div>
  )
}

export default CuratedSharedFields
