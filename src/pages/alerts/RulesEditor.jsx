import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import useAdminResource from '../../components/admin/useAdminResource'
import { getAbuseRules, saveAbuseRules } from '../../services/adminApi'

import { parseRules } from './model'

function RulesForm({ initial, onSaved }) {
  const { t } = useTranslation()
  const [text, setText] = useState(JSON.stringify(initial, null, 2))
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const save = async event => {
    event.preventDefault()
    setMessage('')
    let rules
    try {
      rules = parseRules(text)
    } catch {
      setMessage('invalidRules')
      return
    }
    setBusy(true)
    try {
      await saveAbuseRules(rules)
      setMessage('saved')
      onSaved()
    } catch {
      setMessage('saveFailed')
    } finally {
      setBusy(false)
    }
  }
  return (
    <form onSubmit={save} className="space-y-3">
      <label htmlFor="abuse-rules" className="block text-sm text-slate-500">
        {t('admin.alerts.rulesHelp')}
      </label>
      <textarea
        id="abuse-rules"
        value={text}
        onChange={e => setText(e.target.value)}
        rows={20}
        spellCheck={false}
        className="w-full rounded-xl border border-slate-200 p-3 font-mono text-xs"
      />
      {message && (
        <p
          role="status"
          className={message === 'saved' ? 'text-emerald-700' : 'text-rose-700'}
        >
          {t(`admin.alerts.${message}`)}
        </p>
      )}
      <button
        disabled={busy}
        className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        {t('admin.alerts.save')}
      </button>
    </form>
  )
}

export default function RulesEditor() {
  const { t } = useTranslation()
  const resource = useAdminResource(getAbuseRules)
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5">
      <h2 className="mb-3 text-lg font-semibold">{t('admin.alerts.rules')}</h2>
      {resource.error ? (
        <p role="alert">{t('admin.alerts.loadFailed')}</p>
      ) : resource.data ? (
        <RulesForm
          key={resource.updatedAt}
          initial={resource.data}
          onSaved={resource.reload}
        />
      ) : (
        <p>{t('admin.alerts.loading')}</p>
      )}
    </section>
  )
}
