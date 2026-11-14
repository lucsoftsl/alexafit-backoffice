import { CURATED_LANGS } from './model'
import { curatedState, fromForm, toForm } from './curatedForm'

/** Language versions of one curated post share a groupId (API: O_002). */
export const ANY_LANG = 'any'
export const PRIMARY_LANG = 'en'

const langKey = post => post.lang || ANY_LANG

/** Posts → groups `{ groupId, versions: { [lang]: post }, primary, sortOrder, state }`. */
export const groupPosts = posts => {
  const byGroup = new Map()
  for (const post of posts) {
    const key = post.groupId || post.id
    const group = byGroup.get(key) || {
      groupId: post.groupId || null,
      versions: {}
    }
    byGroup.set(key, {
      ...group,
      versions: { ...group.versions, [langKey(post)]: post }
    })
  }
  return [...byGroup.values()]
    .map(group => {
      const primary =
        group.versions[PRIMARY_LANG] ||
        group.versions[ANY_LANG] ||
        Object.values(group.versions)[0]
      return {
        ...group,
        key: group.groupId || primary.id,
        primary,
        sortOrder: primary.sortOrder ?? 0,
        state: curatedState(primary)
      }
    })
    .sort((a, b) => a.sortOrder - b.sortOrder)
}

/** Tabs shown in the editor: the app languages plus "any" when a group has one. */
export const editorLangs = versions =>
  versions[ANY_LANG] ? [...CURATED_LANGS, ANY_LANG] : CURATED_LANGS

const versionFields = form => ({
  title: form.title,
  body: form.body,
  ctaLabel: form.ctaLabel,
  payloadText: form.payloadText
})

/** Editor state: shared settings (from the primary) + one entry per existing language. */
export const groupToEditor = group => {
  const primaryForm = toForm(group?.primary || null)
  const shared = {
    type: primaryForm.type,
    ctaTarget: primaryForm.ctaTarget,
    photoUrl: primaryForm.photoUrl,
    startsAt: primaryForm.startsAt,
    endsAt: primaryForm.endsAt,
    sortOrder: primaryForm.sortOrder,
    isActive: primaryForm.isActive
  }
  const versions = Object.fromEntries(
    Object.entries(group?.versions || {}).map(([lang, post]) => [
      lang,
      { id: post.id, removed: false, ...versionFields(toForm(post)) }
    ])
  )
  return {
    shared,
    versions: group ? versions : { [PRIMARY_LANG]: newVersion(null) }
  }
}

/** A version not saved yet, optionally copied from another language. */
export const newVersion = from => ({
  id: null,
  removed: false,
  title: from?.title || '',
  body: from?.body || '',
  ctaLabel: from?.ctaLabel || '',
  payloadText: from?.payloadText || toForm(null).payloadText
})

/**
 * Validates every live version. Returns `{ errors: { [lang]: string[] }, inputs: { [lang]: body } }`;
 * each body is ready for POST/PUT /curated (shared settings applied, lang set).
 */
export const editorToInputs = ({ shared, versions }) => {
  const errors = {}
  const inputs = {}
  for (const [lang, version] of Object.entries(versions)) {
    if (version.removed) continue
    const result = fromForm({
      ...shared,
      ...version,
      lang: lang === ANY_LANG ? '' : lang
    })
    if (result.errors.length) errors[lang] = result.errors
    else inputs[lang] = result.input
  }
  return { errors, inputs }
}

/** Order of writes: the primary first, so a new group gets its id before the others join. */
export const saveOrder = langs =>
  [...langs].sort((a, b) =>
    a === PRIMARY_LANG ? -1 : b === PRIMARY_LANG ? 1 : 0
  )
