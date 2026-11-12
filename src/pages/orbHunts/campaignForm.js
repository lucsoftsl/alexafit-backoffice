import {
  DEFAULT_SLOT_CONFIG,
  LANGUAGES,
  MAX_CAMPAIGN_DAYS,
  SLOT_CONFIG_FIELDS
} from './model'

let keySeq = 0
const nextKey = () => `slot-${Date.now().toString(36)}-${(keySeq += 1)}`

const DAY_MS = 24 * 60 * 60 * 1000

/** Template or CampaignDetail → editable form state (all copies). */
export const toForm = source => ({
  startsAt: source?.startsAt || null,
  endsAt: source?.endsAt || null,
  content: Object.fromEntries(
    Object.entries(source?.content || {}).map(([lang, entry]) => [
      lang,
      { title: '', description: '', wishText: '', ...entry }
    ])
  ),
  theme: {
    color: '#7C5CFF',
    orbArtUrl: '',
    spiritArtUrl: '',
    ...(source?.theme || {})
  },
  settings: JSON.parse(JSON.stringify(source?.settings || {})),
  wishOptions: (source?.wishOptions || []).map(o => ({ ...o })),
  orbs: (source?.orbs || []).map(orb => ({
    _key: nextKey(),
    id: orb.id || null,
    sourceType: orb.sourceType,
    config: { ...(orb.config || {}) },
    name: { ...(orb.name || {}) },
    artUrl: orb.artUrl || '',
    unlocksAt: orb.unlocksAt || null,
    collected: orb.collected || 0,
    originalType: orb.id ? orb.sourceType : null
  }))
})

export const newSlot = (sourceType = 'STEPS') => ({
  _key: nextKey(),
  id: null,
  sourceType,
  config: { ...DEFAULT_SLOT_CONFIG[sourceType] },
  name: {},
  artUrl: '',
  unlocksAt: null,
  collected: 0,
  originalType: null
})

const nonEmpty = text => typeof text === 'string' && text.trim() !== ''

const compactEntry = entry =>
  Object.fromEntries(
    Object.entries(entry || {})
      .filter(([, value]) => nonEmpty(value))
      .map(([key, value]) => [key, value.trim()])
  )

/** Only languages with some text (en always, since its title is required). */
const compactContent = content =>
  Object.fromEntries(
    LANGUAGES.map(lang => [lang, compactEntry(content[lang])]).filter(
      ([lang, entry]) => lang === 'en' || Object.keys(entry).length
    )
  )

const compactConfig = (sourceType, config) =>
  Object.fromEntries(
    (SLOT_CONFIG_FIELDS[sourceType] || [])
      .map(({ key }) => [key, config?.[key]])
      .filter(
        ([, value]) => value !== null && value !== undefined && value !== ''
      )
  )

/** Form state → CampaignInput for POST/PUT /campaigns. */
export const toInput = form => ({
  startsAt: form.startsAt,
  endsAt: form.endsAt,
  content: compactContent(form.content),
  theme: Object.fromEntries(
    Object.entries(form.theme).filter(([, value]) => nonEmpty(value))
  ),
  // Empty number fields are left out so the server keeps the default.
  settings: Object.fromEntries(
    Object.entries(form.settings || {}).map(([group, values]) => [
      group,
      Object.fromEntries(
        Object.entries(values || {}).filter(
          ([, value]) => value !== null && value !== undefined
        )
      )
    ])
  ),
  wishOptions: form.wishOptions.map(({ id, type, amount }) => ({
    id: String(id || '').trim(),
    type,
    amount
  })),
  orbs: form.orbs.map(orb => {
    const name = compactEntry(orb.name)
    return {
      ...(orb.id ? { id: orb.id } : {}),
      sourceType: orb.sourceType,
      config: compactConfig(orb.sourceType, orb.config),
      ...(Object.keys(name).length ? { name } : {}),
      ...(nonEmpty(orb.artUrl) ? { artUrl: orb.artUrl.trim() } : {}),
      ...(orb.unlocksAt ? { unlocksAt: orb.unlocksAt } : {})
    }
  })
})

/**
 * Quick client checks so obvious mistakes don't need a round trip. The
 * server is the source of truth; its messages are shown as well.
 * Returns translation keys (with params) for the problems found.
 */
export const clientProblems = form => {
  const problems = []
  if (!nonEmpty(form.content?.en?.title)) {
    problems.push({ key: 'titleRequired' })
  }
  const start = form.startsAt ? new Date(form.startsAt).getTime() : NaN
  const end = form.endsAt ? new Date(form.endsAt).getTime() : NaN
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    problems.push({ key: 'datesRequired' })
  } else if (end <= start) {
    problems.push({ key: 'endBeforeStart' })
  } else if (end - start > MAX_CAMPAIGN_DAYS * DAY_MS) {
    problems.push({ key: 'tooLong', params: { days: MAX_CAMPAIGN_DAYS } })
  }
  if (!form.orbs.length) problems.push({ key: 'noSlots' })
  const optionIds = form.wishOptions.map(o => String(o.id || '').trim())
  if (optionIds.some(id => !/^[a-z0-9_-]{1,40}$/.test(id))) {
    problems.push({ key: 'optionId' })
  }
  if (new Set(optionIds).size !== optionIds.length) {
    problems.push({ key: 'optionDuplicate' })
  }
  form.orbs.forEach((orb, index) => {
    if (orb.sourceType === 'ACTIVE_DAYS') {
      const { days, windowDays } = orb.config
      if (days && windowDays && days > windowDays) {
        problems.push({ key: 'daysWindow', params: { slot: index + 1 } })
      }
    }
    if (orb.sourceType === 'EXPLORE') {
      const { minDistanceM, maxDistanceM } = orb.config
      if (minDistanceM && maxDistanceM && minDistanceM >= maxDistanceM) {
        problems.push({ key: 'distanceOrder', params: { slot: index + 1 } })
      }
    }
  })
  return problems
}

/** Immutable move of list[from] to list[to]. */
export const moveItem = (list, from, to) => {
  if (to < 0 || to >= list.length) return list
  const copy = [...list]
  const [item] = copy.splice(from, 1)
  copy.splice(to, 0, item)
  return copy
}

/** Immutable set of settings[group][key]. */
export const setSetting = (settings, group, key, value) => ({
  ...settings,
  [group]: { ...(settings[group] || {}), [key]: value }
})
