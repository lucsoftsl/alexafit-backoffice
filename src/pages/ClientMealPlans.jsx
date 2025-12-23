import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getUserMenuByDate } from '../services/loggedinApi'
import { findDefaultServing, calculateDisplayValues, safeNutrients } from '../util/menuDisplay'

const todayISO = () => new Date().toISOString().slice(0, 10)
const toISO = (d) => new Date(d).toISOString().slice(0, 10)

const summarize = (items) => {
  return items.reduce((acc, it) => {
    const servingOptions = Array.isArray(it?.serving) ? it.serving : []
    let originalServingAmount = it?.originalServingAmount
    if (!originalServingAmount && servingOptions.length > 0) {
      const def = findDefaultServing(servingOptions)
      const numberOfServings = it?.numberOfServings || it?.originalServings || 1
      originalServingAmount = (def?.amount || 100) * numberOfServings
    }
    originalServingAmount = originalServingAmount || 100
    let selectedAmount = originalServingAmount
    if (it?.changedServing?.value) selectedAmount = it.changedServing.value
    const calc = calculateDisplayValues(it, selectedAmount, originalServingAmount)
    const n = safeNutrients(calc.nutrients)
    return {
      calories: acc.calories + (calc.calories || 0),
      proteinsInGrams: acc.proteinsInGrams + n.proteinsInGrams,
      carbohydratesInGrams: acc.carbohydratesInGrams + n.carbohydratesInGrams,
      fatInGrams: acc.fatInGrams + n.fatInGrams,
    }
  }, { calories: 0, proteinsInGrams: 0, carbohydratesInGrams: 0, fatInGrams: 0 })
}

const MealBlock = ({ label, items }) => {
  const totals = summarize(items)
  return (
    <div className="border border-gray-200 rounded p-3 bg-white shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-semibold text-gray-900">{label}</p>
        <p className="text-xs text-gray-600">
          {Math.round(totals.calories)} cal | P {Math.round(totals.proteinsInGrams)}g | C {Math.round(totals.carbohydratesInGrams)}g | F {Math.round(totals.fatInGrams)}g
        </p>
      </div>
      {items.length === 0 && <p className="text-xs text-gray-500">No items</p>}
      <div className="space-y-1">
        {items.map((it, i) => (
          <div key={i} className="text-sm text-gray-700 truncate">{it?.name || it?.title || 'Unnamed item'}</div>
        ))}
      </div>
    </div>
  )
}

const ClientMealPlans = ({ client }) => {
  const [selectedDate, setSelectedDate] = useState(todayISO())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [menu, setMenu] = useState(null)
  const { t } = useTranslation()

  const userId = useMemo(() => Array.isArray(client?.userId) ? client.userId[0] : client?.userId, [client])
  const userName = useMemo(() => client?.userData?.name || client?.loginDetails?.displayName || 'User', [client])

  useEffect(() => {
    const loadMenu = async () => {
      if (!userId) return
      setLoading(true)
      setError(null)
      try {
        const res = await getUserMenuByDate({ userId, dateApplied: toISO(selectedDate) })
        setMenu(res?.data || res || null)
      } catch (e) {
        setError(e?.message || 'Failed to load assigned menu')
      } finally {
        setLoading(false)
      }
    }
    loadMenu()
  }, [selectedDate, userId])

  if (!client) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">{t('pages.clientMealPlans.title')}</h2>
        <p className="text-gray-600">{t('pages.clientMealPlans.selectPrompt')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{t('pages.clientMealPlans.title')}</h1>
          <p className="text-gray-600 mt-1">{userName}</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-1 text-sm"
          />
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
        <div className="flex justify-between items-center mb-3">
          <div>
            <p className="text-xs text-gray-500">Selected Day</p>
            <p className="text-lg font-semibold text-gray-900">{new Date(selectedDate).toLocaleDateString()}</p>
          </div>
          {loading && <span className="text-sm text-gray-500">Loading...</span>}
          {error && <span className="text-sm text-red-600">{error}</span>}
        </div>
        {!loading && !error && !menu && (
          <p className="text-sm text-gray-600">No assigned menu for this day.</p>
        )}
        {!loading && !error && menu && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <MealBlock label={t('pages.clientJournal.breakfast')} items={menu.breakfastPlan || []} />
            <MealBlock label={t('pages.clientJournal.lunch')} items={menu.lunchPlan || []} />
            <MealBlock label={t('pages.clientJournal.dinner')} items={menu.dinnerPlan || []} />
            <MealBlock label={t('pages.clientJournal.snack')} items={menu.snackPlan || []} />
          </div>
        )}
      </div>
    </div>
  )
}

export default ClientMealPlans
