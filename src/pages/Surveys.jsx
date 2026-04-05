import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { getSurveys } from '../services/surveysApi'

const FIELD_LABELS = {
  age: 'Age',
  gender: 'Gender',
  location: 'Location',
  activity: 'Activity level',
  meals_per_day: 'Meals/day',
  snacks_per_day: 'Snacks/day',
  meal_times: 'Meal times',
  fruits: 'Fruits',
  vegetables: 'Vegetables',
  red_meat: 'Red meat',
  fish: 'Fish',
  dairy: 'Dairy',
  sweets: 'Sweets',
  sodas: 'Sodas',
  vegetarian: 'Vegetarian',
  allergies: 'Allergies',
  allergies_other_text: 'Allergies (other)',
  healthy_eating: 'Healthy eating importance',
  cooking: 'Cooks at home',
  motivation: 'Motivation',
  motivation_other_text: 'Motivation (other)',
  obstacles: 'Obstacles',
  caloric_deficit_used: 'Used caloric deficit',
  caloric_deficit_reason: 'Caloric deficit reason',
  userId: 'User ID',
  source: 'Source',
  timestamp: 'Submitted at',
}

function formatValue(value) {
  if (value === null || value === undefined || value === '') return '—'
  if (Array.isArray(value)) return value.length ? value.join(', ') : '—'
  return String(value)
}

function formatDate(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleString()
}

function SurveyDrawer({ survey, onClose }) {
  const { t } = useTranslation()
  if (!survey) return null

  const data = survey.surveyData || {}
  const metaKeys = ['userId', 'source', 'timestamp']
  const mainKeys = Object.keys(FIELD_LABELS).filter(k => !metaKeys.includes(k))

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/40" onClick={onClose} />
      <div className="w-full max-w-xl bg-white shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50 flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{t('pages.surveys.drawerTitle')}</h2>
            <p className="text-xs text-gray-500 mt-0.5">{formatDate(survey.dateTimeCreated)}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-200 rounded-lg transition-colors text-gray-500 hover:text-gray-900"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {/* Meta */}
          {metaKeys.filter(k => data[k]).map(k => (
            <div key={k} className="flex gap-3">
              <span className="text-xs font-semibold text-gray-500 w-36 flex-shrink-0 pt-0.5">{FIELD_LABELS[k] || k}</span>
              <span className="text-sm text-gray-800 break-all">{formatValue(data[k])}</span>
            </div>
          ))}

          <div className="border-t border-gray-100 pt-3" />

          {/* Survey fields */}
          {mainKeys.filter(k => data[k] !== undefined && data[k] !== '' && !(Array.isArray(data[k]) && data[k].length === 0)).map(k => (
            <div key={k} className="flex gap-3">
              <span className="text-xs font-semibold text-gray-500 w-36 flex-shrink-0 pt-0.5">{FIELD_LABELS[k] || k}</span>
              <span className="text-sm text-gray-800">{formatValue(data[k])}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function Surveys() {
  const { t } = useTranslation()
  const [surveys, setSurveys] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selected, setSelected] = useState(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    loadSurveys()
  }, [])

  const loadSurveys = async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await getSurveys()
      if (res.ok) {
        setSurveys(res.data || [])
      } else {
        setError(t('pages.surveys.loadError'))
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const filtered = surveys.filter(s => {
    if (!search.trim()) return true
    const data = s.surveyData || {}
    const haystack = [
      data.userId, data.age, data.gender, data.source,
      s.websiteUserId, s.dateTimeCreated
    ].filter(Boolean).join(' ').toLowerCase()
    return haystack.includes(search.toLowerCase())
  })

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 border-b border-gray-200 bg-white flex-shrink-0">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t('pages.surveys.title')}</h1>
            <p className="text-sm text-gray-500 mt-1">{t('pages.surveys.subtitle')}</p>
          </div>
          <button
            onClick={loadSurveys}
            disabled={loading}
            className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors shadow-sm"
          >
            {loading ? '...' : '↻ ' + t('common.Refresh')}
          </button>
        </div>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={t('pages.surveys.searchPlaceholder')}
          className="mt-3 w-full max-w-sm px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-red-600 text-sm">{error}</p>
            <button onClick={loadSurveys} className="mt-3 text-blue-600 text-sm underline">{t('common.tryAgain')}</button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-500 text-sm">
            {search ? t('pages.surveys.noResults') : t('pages.surveys.empty')}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">{t('pages.surveys.colDate')}</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">{t('pages.surveys.colSource')}</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">{t('pages.surveys.colAge')}</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">{t('pages.surveys.colGender')}</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">{t('pages.surveys.colActivity')}</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">{t('pages.surveys.colUserId')}</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(s => {
                  const data = s.surveyData || {}
                  return (
                    <tr
                      key={s.id}
                      className="hover:bg-blue-50 cursor-pointer transition-colors"
                      onClick={() => setSelected(s)}
                    >
                      <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{formatDate(s.dateTimeCreated)}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          data.source === 'native_app'
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}>
                          {data.source === 'native_app' ? 'App' : 'Web'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-700">{formatValue(data.age)}</td>
                      <td className="px-4 py-3 text-gray-700 capitalize">{formatValue(data.gender)}</td>
                      <td className="px-4 py-3 text-gray-700 capitalize">{formatValue(data.activity)}</td>
                      <td className="px-4 py-3 text-gray-500 font-mono text-xs truncate max-w-[140px]">
                        {data.userId || s.websiteUserId || '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-blue-600 text-xs font-medium hover:underline">
                          {t('pages.surveys.viewDetails')} →
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && (
        <SurveyDrawer survey={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  )
}

export default Surveys
