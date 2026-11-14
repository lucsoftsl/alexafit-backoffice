import { fromLocalInput, toLocalInput } from '../orbHunts/model'

import { CURATED_LIMITS, PAYLOAD_TEMPLATES, orNull } from './model'

const isHttps = value => /^https:\/\/\S{3,990}$/.test(value || '')

const prettyPayload = value => JSON.stringify(value || {}, null, 2)

/** Editor state for a new post, or for an existing CuratedPost. */
export const toForm = post => {
  const type = post?.type || 'CURATED'
  const p = post?.payload || {}
  return {
    type,
    title: type === 'CURATED' ? p.title || '' : '',
    body: type === 'CURATED' ? p.body || '' : '',
    ctaLabel: type === 'CURATED' ? p.ctaLabel || '' : '',
    ctaTarget: type === 'CURATED' ? p.ctaTarget || '' : '',
    payloadText:
      type === 'CURATED'
        ? prettyPayload(PAYLOAD_TEMPLATES.RECIPE_CREATED)
        : prettyPayload(post?.payload || PAYLOAD_TEMPLATES[type]),
    photoUrl: post?.photoUrl || '',
    lang: post?.lang || '',
    startsAt: toLocalInput(post?.startsAt),
    endsAt: toLocalInput(post?.endsAt),
    sortOrder: post?.sortOrder ?? 0,
    isActive: post ? post.isActive !== false : true
  }
}

/** New form state after the type select changes (fresh snapshot template). */
export const withType = (form, type) => ({
  ...form,
  type,
  payloadText:
    type === 'CURATED'
      ? form.payloadText
      : prettyPayload(PAYLOAD_TEMPLATES[type])
})

const parsePayload = text => {
  try {
    const value = JSON.parse(text)
    return value && typeof value === 'object' && !Array.isArray(value)
      ? value
      : null
  } catch {
    return null
  }
}

const curatedPayload = form => {
  const payload = { title: form.title.trim(), body: form.body.trim() }
  const ctaLabel = orNull(form.ctaLabel)
  const ctaTarget = orNull(form.ctaTarget)
  return {
    ...payload,
    ...(ctaLabel ? { ctaLabel } : {}),
    ...(ctaTarget ? { ctaTarget } : {})
  }
}

/**
 * Validates the form. Returns `{ errors: string[] (i18n keys), input }`;
 * `input` is the request body for POST/PUT /curated when there are no errors.
 */
export const fromForm = form => {
  const errors = []
  let payload = null
  if (form.type === 'CURATED') {
    payload = curatedPayload(form)
    if (!payload.title) errors.push('titleRequired')
    if (!payload.body) errors.push('bodyRequired')
    if (Boolean(payload.ctaLabel) !== Boolean(payload.ctaTarget)) {
      errors.push('ctaPair')
    }
  } else {
    payload = parsePayload(form.payloadText)
    if (!payload) errors.push('payloadJson')
    else if (!String(payload.name ?? payload.mealType ?? '').trim()) {
      errors.push('payloadName')
    }
  }
  const photoUrl = orNull(form.photoUrl)
  if (photoUrl && !isHttps(photoUrl)) errors.push('photoHttps')
  const startsAt = fromLocalInput(form.startsAt)
  const endsAt = fromLocalInput(form.endsAt)
  if (startsAt && endsAt && endsAt <= startsAt) errors.push('dateOrder')
  const sortOrder = Number(form.sortOrder ?? 0)
  const [min, max] = CURATED_LIMITS.sortOrder
  if (!Number.isInteger(sortOrder) || sortOrder < min || sortOrder > max) {
    errors.push('sortOrder')
  }
  return {
    errors,
    input: {
      type: form.type,
      payload,
      photoUrl,
      lang: orNull(form.lang),
      startsAt,
      endsAt,
      sortOrder,
      isActive: Boolean(form.isActive)
    }
  }
}

/** ACTIVE | SCHEDULED | EXPIRED | INACTIVE, for the list badge. */
export const curatedState = (post, now = Date.now()) => {
  if (post.isActive === false) return 'INACTIVE'
  const starts = post.startsAt ? new Date(post.startsAt).getTime() : null
  const ends = post.endsAt ? new Date(post.endsAt).getTime() : null
  if (starts && starts > now) return 'SCHEDULED'
  if (ends && ends <= now) return 'EXPIRED'
  return 'ACTIVE'
}

export const CURATED_STATE_STYLE = {
  ACTIVE: 'bg-emerald-50 text-emerald-800 ring-emerald-600/30',
  SCHEDULED: 'bg-sky-50 text-sky-800 ring-sky-600/30',
  EXPIRED: 'bg-slate-100 text-slate-600 ring-slate-500/30',
  INACTIVE: 'bg-slate-100 text-slate-600 ring-slate-500/30'
}
