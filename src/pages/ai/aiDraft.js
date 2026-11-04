/** Draft editing helpers for Admin › AI (pure, immutable). */

/** Same rule as the server's isValidModel for picked RapidAPI models. */
const RAPIDAPI_MODEL = /^rapidapi\/[A-Za-z0-9._-]{2,60}$/

export const EMPTY_FEATURE = {
  provider: '',
  model: '',
  fallbackProvider: '',
  fallbackModel: '',
  enabled: true,
  dailyCapPerUser: null
}

export const draftFromSettings = (settings, featureIds) => ({
  defaults: {
    models: { ...(settings?.defaults?.models || {}) },
    dailyCapPerUser: settings?.defaults?.dailyCapPerUser ?? null
  },
  features: Object.fromEntries(
    featureIds.map(id => [
      id,
      { ...EMPTY_FEATURE, ...(settings?.features?.[id] || {}) }
    ])
  ),
  pricing: {
    rapidapiCostPerCallUsd: settings?.pricing?.rapidapiCostPerCallUsd ?? 0
  }
})

export const updateFeature = (draft, id, patch) => ({
  ...draft,
  features: {
    ...draft.features,
    [id]: { ...draft.features[id], ...patch }
  }
})

export const updateDefaults = (draft, patch) => ({
  ...draft,
  defaults: { ...draft.defaults, ...patch }
})

export const updateDefaultModel = (draft, providerId, model) => ({
  ...draft,
  defaults: {
    ...draft.defaults,
    models: { ...draft.defaults.models, [providerId]: model }
  }
})

export const updatePricing = (draft, patch) => ({
  ...draft,
  pricing: { ...draft.pricing, ...patch }
})

/** Only features that differ from "inherit everything" are saved. */
export const payloadFromDraft = draft => ({
  defaults: draft.defaults,
  pricing: draft.pricing,
  features: Object.fromEntries(
    Object.entries(draft.features).filter(([, f]) =>
      Object.keys(EMPTY_FEATURE).some(key => f[key] !== EMPTY_FEATURE[key])
    )
  )
})

export const isSameDraft = (a, b) =>
  JSON.stringify(payloadFromDraft(a)) === JSON.stringify(payloadFromDraft(b))

/** Cap input text → integer or null (empty = inherit). */
export const parseCap = text => {
  if (text === '' || text === null || text === undefined) return null
  const n = Number(text)
  return Number.isInteger(n) && n >= 0 ? n : null
}

/**
 * What a feature would run on with this draft (mirrors the server's
 * resolveFeature, without env / client overrides).
 */
export const effectiveFor = (draft, feature, providersById) => {
  const own = draft.features[feature.id] || EMPTY_FEATURE
  const provider = own.provider || feature.builtIn.provider
  const modelFor = (providerId, ownModel) => {
    const p = providersById[providerId]
    const valid = m =>
      m &&
      (!p ||
        p.models.length === 0 ||
        p.models.some(x => x.id === m) ||
        providerId === 'gemini' ||
        (providerId === 'rapidapi-chatgpt' && RAPIDAPI_MODEL.test(m)))
    if (valid(ownModel)) return ownModel
    return draft.defaults.models[providerId] || p?.defaultModel || ''
  }
  let fallbackProvider =
    own.fallbackProvider === 'none'
      ? null
      : own.fallbackProvider ||
        feature.builtIn.fallbackProvider ||
        (provider !== feature.builtIn.provider
          ? feature.builtIn.provider
          : null)
  if (fallbackProvider === provider) fallbackProvider = null
  return {
    primary: { provider, model: modelFor(provider, own.model) },
    fallback: fallbackProvider
      ? {
          provider: fallbackProvider,
          model: modelFor(fallbackProvider, own.fallbackModel)
        }
      : null
  }
}
