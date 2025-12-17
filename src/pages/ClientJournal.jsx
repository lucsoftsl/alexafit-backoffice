import { useEffect, useMemo, useRef, useState } from 'react'
import { getDailyNutrition, getUserData } from '../services/loggedinApi'
import { sumTotalsByMealsApplied } from '../util/menuDisplay'
import { getCategoryIcon } from '../util/categoryIcons'

const todayISO = () => new Date().toISOString().slice(0, 10)
const toISO = (d) => new Date(d).toISOString().slice(0, 10)
const addDays = (dateStr, days) => {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

const Progress = ({ percent }) => (
  <div className="w-full h-2 bg-gray-200 rounded">
    <div
      className="h-2 bg-blue-600 rounded"
      style={{ width: `${Math.max(0, Math.min(100, percent))}%` }}
    />
  </div>
)

const MacroCard = ({ label, value, unit = '', goal }) => {
  const pct = goal ? Math.round(((value || 0) / goal) * 100) : null
  return (
    <div className="p-3 bg-gray-50 rounded-lg">
      <div className="flex justify-between items-baseline">
        <p className="text-xs text-gray-500">{label}</p>
        {goal ? <p className="text-xs text-gray-400">Goal: {goal}{unit}</p> : null}
      </div>
      <p className="text-lg font-semibold text-gray-900">{value}{unit}</p>
      {pct !== null && (
        <div className="mt-1">
          <Progress percent={pct} />
          <p className="text-xs text-gray-500 mt-1">{pct}%</p>
        </div>
      )}
    </div>
  )
}

const getItemDisplay = (it) => {
  if (it?.food?.name) return it.food.name
  if (it?.exercise?.name) return it.exercise.name
  return it?.name || it?.foodName || 'Item'
}

const getItemCalories = (it) => {
  if (it?.food?.totalCalories) return Math.round(it.food.totalCalories)
  if (typeof it?.calories === 'number') return Math.round(it.calories)
  if (it?.exercise?.caloriesBurnt) return Math.round(it.exercise.caloriesBurnt)
  return Math.round(it?.totalCalories || 0)
}

const ItemRow = ({ it }) => {
  const name = getItemDisplay(it)
  const kcal = getItemCalories(it)
  const category = it?.food?.category || it?.category || (it?.exercise ? 'exerciseGeneral' : '')
  const fallbackImg = category ? getCategoryIcon(category) : null
  const img = it?.food?.photoUrl || it?.exercise?.photoUrl || it?.photoUrl || fallbackImg
  return (
    <div className="flex justify-between items-center p-2 rounded hover:bg-gray-50">
      <div className="flex items-center gap-2 overflow-hidden">
        <div className="w-8 h-8 rounded bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0">
          {img ? <img src={img} alt={name} className="w-8 h-8 object-cover" /> : <span className="text-xs text-gray-400">{category || 'item'}</span>}
        </div>
        <span className="text-sm text-gray-800 truncate">{name}</span>
      </div>
      <span className="text-sm text-gray-500 ml-2">{kcal} kcal</span>
    </div>
  )
}

const MealSection = ({ title, items = [], photoUrl }) => (
  <div className="border border-gray-200 rounded-lg p-3 bg-white shadow-sm">
    <div className="flex justify-between items-center mb-2">
      <h4 className="text-sm font-semibold text-gray-900">{title}</h4>
      {photoUrl ? <img src={photoUrl} alt={`${title} photo`} className="w-10 h-10 rounded object-cover" /> : null}
    </div>
    {items && items.length > 0 ? (
      <div className="space-y-1">
        {items.map((it, idx) => (
          <ItemRow key={idx} it={it} />
        ))}
      </div>
    ) : (
      <p className="text-xs text-gray-500">No items added.</p>
    )}
  </div>
)

const ClientJournal = ({ client }) => {
  const [selectedDate, setSelectedDate] = useState(todayISO())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [daily, setDaily] = useState({
    goals: { calories: 0, protein: 0, carbs: 0, fat: 0 },
    breakfast: [],
    lunch: [],
    dinner: [],
    snack: [],
    exercises: [],
    exerciseCalories: 0,
    breakfastPhotoUrl: null,
    lunchPhotoUrl: null,
    dinnerPhotoUrl: null,
    snackPhotoUrl: null,
    waterTotalMl: 0,
    waterEntries: [],
  })
  const [macroTotals, setMacroTotals] = useState({ calories: 0, proteinsInGrams: 0, carbohydratesInGrams: 0, fatInGrams: 0 })
  const lastFetchKeyRef = useRef('')

  const userId = useMemo(() => Array.isArray(client?.userId) ? client.userId[0] : client?.userId, [client])
  const userName = useMemo(() => client?.userData?.name || client?.loginDetails?.displayName || 'User', [client])

  const dateLabel = useMemo(() => {
    try {
      return new Date(selectedDate).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
    } catch {
      return selectedDate
    }
  }, [selectedDate])

  useEffect(() => {
    const loadDay = async () => {
      if (!userId) return
      const fetchKey = `${userId}-${selectedDate}`
      if (lastFetchKeyRef.current === fetchKey) return
      lastFetchKeyRef.current = fetchKey
      setLoading(true)
      setError(null)
      try {
        const [dailyRes, userRes] = await Promise.all([
          getDailyNutrition({ userId, dateApplied: toISO(selectedDate) }),
          getUserData({ userId, selectedDate })
        ])
        const dWrap = dailyRes?.data || dailyRes || {}
        const uWrap = userRes?.data || userRes || {}
        const d = dWrap?.data || {}
        const u = uWrap?.data || {}
        const userGoals = u?.userGoals || {}
        const waterEntries = Array.isArray(d?.water) ? d.water : []
        const waterTotalMl = waterEntries.reduce((acc, e) => acc + (Number(e?.quantity) || 0), 0)

        setDaily({
          goals: {
            calories: userGoals?.totalCalories || 0,
            protein: userGoals?.proteinsInGrams || 0,
            carbs: userGoals?.carbohydratesInGrams || 0,
            fat: userGoals?.fatInGrams || 0,
          },
          breakfast: d.breakfast || [],
          lunch: d.lunch || [],
          dinner: d.dinner || [],
          snack: d.snack || [],
          exercises: d.exercise || [],
          exerciseCalories: Array.isArray(d.exercise)
            ? d.exercise.reduce((acc, e) => acc + (e?.exercise?.caloriesBurnt || 0), 0)
            : 0,
          breakfastPhotoUrl: d.breakfastPhotoUrl || null,
          lunchPhotoUrl: d.lunchPhotoUrl || null,
          dinnerPhotoUrl: d.dinnerPhotoUrl || null,
          snackPhotoUrl: d.snackPhotoUrl || null,
          waterTotalMl,
          waterEntries,
        })

        const totals = sumTotalsByMealsApplied({
          breakfast: d?.breakfast || [],
          lunch: d?.lunch || [],
          dinner: d?.dinner || [],
          snack: d?.snack || [],
        })
        setMacroTotals({
          calories: Math.round(totals.calories),
          proteinsInGrams: Math.round(totals.proteinsInGrams),
          carbohydratesInGrams: Math.round(totals.carbohydratesInGrams),
          fatInGrams: Math.round(totals.fatInGrams),
        })
      } catch (e) {
        setError(e?.message || 'Failed to load daily nutrition')
      } finally {
        setLoading(false)
      }
    }

    loadDay()
  }, [selectedDate, userId])

  if (!client) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Client Journal</h2>
        <p className="text-gray-600">Select a client from the Clients list to view their journal.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Client Journal</h1>
          <p className="text-gray-600 mt-1">{userName}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="px-3 py-1 text-sm border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            onClick={() => setSelectedDate(prev => addDays(prev, -1))}
          >
            Previous
          </button>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-1 text-sm"
          />
          <button
            className="px-3 py-1 text-sm border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            onClick={() => setSelectedDate(prev => addDays(prev, 1))}
          >
            Next
          </button>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs text-gray-500">Selected Day</p>
            <p className="text-lg font-semibold text-gray-900">{dateLabel}</p>
          </div>
          {loading && <span className="text-sm text-gray-500">Loading...</span>}
          {error && <span className="text-sm text-red-600">{error}</span>}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MacroCard label="Calories" value={macroTotals.calories || 0} unit=" kcal" goal={Math.round(daily.goals.calories || 0)} />
          <MacroCard label="Protein" value={macroTotals.proteinsInGrams || 0} unit=" g" goal={Math.round(daily.goals.protein || 0)} />
          <MacroCard label="Carbs" value={macroTotals.carbohydratesInGrams || 0} unit=" g" goal={Math.round(daily.goals.carbs || 0)} />
          <MacroCard label="Fat" value={macroTotals.fatInGrams || 0} unit=" g" goal={Math.round(daily.goals.fat || 0)} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <MealSection title="Breakfast" items={daily.breakfast} photoUrl={daily.breakfastPhotoUrl} />
        <MealSection title="Lunch" items={daily.lunch} photoUrl={daily.lunchPhotoUrl} />
        <MealSection title="Dinner" items={daily.dinner} photoUrl={daily.dinnerPhotoUrl} />
        <MealSection title="Snack" items={daily.snack} photoUrl={daily.snackPhotoUrl} />
      </div>

      {Array.isArray(daily.exercises) && daily.exercises.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-semibold text-gray-900">Exercise</h3>
            <span className="text-xs text-gray-600">Total: {Math.round(daily.exerciseCalories)} kcal</span>
          </div>
          <div className="space-y-1">
            {daily.exercises.map((ex, idx) => (
              <ItemRow key={idx} it={ex} />
            ))}
          </div>
        </div>
      )}

      {Array.isArray(daily.waterEntries) && daily.waterEntries.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-semibold text-gray-900">Water Intake</h3>
            <span className="text-xs text-gray-600">Total: {Math.round(daily.waterTotalMl || 0)} ml</span>
          </div>
          <div className="space-y-1">
            {daily.waterEntries.map((we, idx) => (
              <div key={idx} className="flex justify-between text-sm p-2">
                <span className="text-gray-800">{we?.label || 'Water'}</span>
                <span className="text-gray-500">{Math.round(we?.quantity || we?.ml || 0)} ml</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default ClientJournal
