import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  createCurated,
  deleteCurated,
  updateCurated
} from '../../services/tableApi'
import { ApiError, Modal } from '../orbHunts/Modal'
import { Button } from '../orbHunts/ui'

import CuratedLangPanel from './CuratedLangPanel'
import CuratedSharedFields from './CuratedSharedFields'
import { withType } from './curatedForm'
import {
  ANY_LANG,
  PRIMARY_LANG,
  editorLangs,
  editorToInputs,
  groupToEditor,
  newVersion,
  saveOrder
} from './curatedGroups'

const tabStyle = (active, state) => {
  if (active) return 'bg-violet-600 text-white shadow-sm'
  if (state === 'error') return 'bg-rose-50 text-rose-800 ring-1 ring-rose-300'
  if (state === 'missing')
    return 'bg-white text-slate-400 ring-1 ring-dashed ring-slate-300'
  if (state === 'removed')
    return 'bg-white text-rose-400 line-through ring-1 ring-rose-200'
  return 'bg-violet-50 text-violet-900 ring-1 ring-violet-200 hover:bg-violet-100'
}

/** Writes every live version (primary first), then deletes removed ones. */
const persist = async ({ group, versions, inputs }) => {
  const groupId = group?.groupId || window.crypto.randomUUID()
  for (const lang of saveOrder(Object.keys(inputs))) {
    const body = { ...inputs[lang], groupId }
    const id = versions[lang].id
    if (id) await updateCurated(id, body)
    else await createCurated(body)
  }
  const removed = Object.values(versions).filter(v => v.removed && v.id)
  for (const version of removed) await deleteCurated(version.id)
}

/** Create / edit one curated post and all its language versions. `group` null = create. */
const CuratedGroupEditor = ({ group, onClose, onSaved }) => {
  const { t } = useTranslation()
  const [state, setState] = useState(() => groupToEditor(group))
  const [lang, setLang] = useState(PRIMARY_LANG)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [showErrors, setShowErrors] = useState(false)
  const { shared, versions } = state
  const { errors, inputs } = editorToInputs(state)
  const langs = editorLangs(versions)
  const liveCount = Object.values(versions).filter(v => !v.removed).length
  const labelOf = code =>
    code === ANY_LANG ? t('admin.theTable.curated.anyLang') : code.toUpperCase()

  const setShared = patch =>
    setState(prev => {
      if (!patch.type) return { ...prev, shared: { ...prev.shared, ...patch } }
      const reset = Object.fromEntries(
        Object.entries(prev.versions).map(([k, v]) => [
          k,
          { ...v, payloadText: withType(v, patch.type).payloadText }
        ])
      )
      return { shared: { ...prev.shared, ...patch }, versions: reset }
    })
  const setVersion = (code, patch) =>
    setState(prev => ({
      ...prev,
      versions: {
        ...prev.versions,
        [code]: { ...prev.versions[code], ...patch }
      }
    }))
  const createVersion = (code, copy) =>
    setVersion(code, newVersion(copy ? versions[PRIMARY_LANG] : null))
  const removeVersion = code => {
    if (versions[code].id) setVersion(code, { removed: true })
    else
      setState(prev => {
        const { [code]: _dropped, ...rest } = prev.versions
        return { ...prev, versions: rest }
      })
  }

  const tabState = code => {
    const version = versions[code]
    if (!version) return 'missing'
    if (version.removed) return 'removed'
    return showErrors && errors[code] ? 'error' : 'ok'
  }

  const save = async () => {
    const errorLangs = Object.keys(errors)
    if (errorLangs.length) {
      setShowErrors(true)
      setLang(errorLangs[0])
      return
    }
    if (!Object.keys(inputs).length) {
      setError({ message: t('admin.theTable.curated.errors.noLanguage') })
      return
    }
    setBusy(true)
    setError(null)
    try {
      await persist({ group, versions, inputs })
      onSaved()
    } catch (err) {
      setError(err)
      setBusy(false)
    }
  }

  return (
    <Modal
      size="lg"
      title={t(
        group
          ? 'admin.theTable.curated.editTitle'
          : 'admin.theTable.curated.newTitle'
      )}
      onClose={busy ? () => {} : onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {t('admin.orbHunt.common.cancel')}
          </Button>
          <Button variant="primary" loading={busy} onClick={save}>
            {t('admin.theTable.curated.saveAll', { count: liveCount })}
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        <section aria-labelledby="curated-langs">
          <h3
            id="curated-langs"
            className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500"
          >
            {t('admin.theTable.curated.languages')}
          </h3>
          <div className="mb-4 flex flex-wrap gap-1.5" role="tablist">
            {langs.map(code => (
              <button
                key={code}
                type="button"
                role="tab"
                aria-selected={lang === code}
                onClick={() => setLang(code)}
                className={`rounded-full px-3 py-1 text-xs font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${tabStyle(lang === code, tabState(code))}`}
              >
                {labelOf(code)}
              </button>
            ))}
          </div>
          <CuratedLangPanel
            langLabel={labelOf(lang)}
            version={versions[lang]}
            isCurated={shared.type === 'CURATED'}
            canCopy={lang !== PRIMARY_LANG && Boolean(versions[PRIMARY_LANG])}
            canRemove={liveCount > 1}
            errors={showErrors ? errors[lang] : null}
            onChange={patch => setVersion(lang, patch)}
            onCreate={copy => createVersion(lang, copy)}
            onRemove={() => removeVersion(lang)}
            onRestore={() => setVersion(lang, { removed: false })}
          />
        </section>

        <section
          aria-labelledby="curated-shared"
          className="border-t border-slate-100 pt-5"
        >
          <h3
            id="curated-shared"
            className="text-xs font-semibold uppercase tracking-wide text-slate-500"
          >
            {t('admin.theTable.curated.sharedSettings')}
          </h3>
          <p className="mb-3 text-xs text-slate-500">
            {t('admin.theTable.curated.sharedSettingsHint')}
          </p>
          <CuratedSharedFields
            shared={shared}
            isNew={!group}
            onChange={setShared}
          />
        </section>

        <ApiError error={error} />
      </div>
    </Modal>
  )
}

export default CuratedGroupEditor
