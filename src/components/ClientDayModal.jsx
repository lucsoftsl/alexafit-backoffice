import { useEffect, useMemo, useRef, useState } from 'react'
import { getDailyNutrition, getUserData, getUserMenuByDate } from '../services/loggedinApi'
import { sumTotalsByMealsApplied, detectIsRecipe, findDefaultServing, calculateDisplayValues, safeNutrients } from '../util/menuDisplay'
import { getCategoryIcon } from '../util/categoryIcons'

const todayISO = () => new Date().toISOString().slice(0, 10)
const toISO = d => new Date(d).toISOString().slice(0, 10)
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
        {goal ? (
          <p className="text-xs text-gray-400">Goal: {goal}{unit}</p>
        ) : null}
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

const ItemCard = ({ it }) => {
  const name = getItemDisplay(it)
  const kcal = getItemCalories(it)
  const category = it?.food?.category || it?.category || (it?.exercise ? 'exerciseGeneral' : '')
  const fallbackImg = category ? getCategoryIcon(category) : null
  const img = it?.food?.photoUrl || it?.exercise?.photoUrl || it?.photoUrl || fallbackImg
  return (
    <div className="flex justify-between items-center p-2 rounded hover:bg-gray-50">
      <div className="flex items-center gap-2 overflow-hidden">
        <div className="w-6 h-6 rounded bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0">
          {img ? (
            <img src={img} alt={name} className="w-6 h-6 object-cover" />
          ) : (
            <span className="text-xs text-gray-400">{category || 'food'}</span>
          )}
        </div>
        <span className="text-sm text-gray-800 truncate">{name}</span>
      </div>
      <span className="text-sm text-gray-500 ml-2">{kcal} kcal</span>
    </div>
  )
}

const MealSection = ({ title, items = [], photoUrl }) => (
  <div className="border-b border-gray-200 pb-3 mb-3 last:border-b-0">
    <div className="flex justify-between items-center mb-2">
      <h4 className="text-sm font-semibold text-gray-900">{title}</h4>
      {photoUrl ? (
        <img src={photoUrl} alt={`${title} photo`} className="w-8 h-8 rounded object-cover" />
      ) : null}
    </div>
    {items && items.length > 0 ? (
      <div className="space-y-1">
        {items.map((it, idx) => (
          <ItemCard key={idx} it={it} />
        ))}
      </div>
    ) : (
      <p className="text-xs text-gray-500">No items added.</p>
    )}
  </div>
)

const ClientDayModal = ({ isOpen, onClose, user }) => {
  const [selectedDate, setSelectedDate] = useState(todayISO())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [daily, setDaily] = useState({
    totalCalories: 0,
    totalProtein: 0,
    totalCarbs: 0,
    totalFat: 0,
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
    menuForDay: null,
  })
  const [macroTotals, setMacroTotals] = useState({ calories: 0, proteinsInGrams: 0, carbohydratesInGrams: 0, fatInGrams: 0 })
  const lastFetchKeyRef = useRef('')

  const dateLabel = useMemo(() => {
    try {
      return new Date(selectedDate).toLocaleDateString(undefined, {
        year: 'numeric', month: 'short', day: 'numeric'
      })
    } catch {
      return selectedDate
    }
  }, [selectedDate])

  const userId = useMemo(() => {
    return Array.isArray(user?.userId) ? user.userId[0] : user?.userId
  }, [user?.userId])

  const userName = useMemo(() => {
    return user?.userData?.name || user?.loginDetails?.displayName || 'User'
  }, [user])

  const loadDay = async () => {
    if (!userId) return
    const fetchKey = `${userId}-${selectedDate}`
    if (lastFetchKeyRef.current === fetchKey) {
      return
    }
    lastFetchKeyRef.current = fetchKey
    setLoading(true)
    setError(null)
    try {
      const [dailyRes, userRes, menuRes] = await Promise.all([
        getDailyNutrition({ userId, dateApplied: toISO(selectedDate) }),
        getUserData({ userId, selectedDate }),
        getUserMenuByDate({ userId, dateApplied: toISO(selectedDate) })
      ])
      const dWrap = dailyRes?.data || dailyRes || {}
      const uWrap = userRes?.data || userRes || {}
      const d = dWrap?.data || {}
      const u = uWrap?.data || {}
      const userGoals = u?.userGoals || {}
      const assignedMenu = menuRes?.data || menuRes || null
      const waterEntries = Array.isArray(d?.water) ? d.water : []
      const waterTotalMl = waterEntries.reduce((acc, e) => acc + (Number(e?.quantity) || 0), 0)

      setDaily({
        totalCalories: 0,
        totalProtein: 0,
        totalCarbs: 0,
        totalFat: 0,
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
        exerciseCalories:
          Array.isArray(d.exercise)
            ? d.exercise.reduce((acc, e) => acc + (e?.exercise?.caloriesBurnt || 0), 0)
            : 0,
        breakfastPhotoUrl: d.breakfastPhotoUrl || null,
        lunchPhotoUrl: d.lunchPhotoUrl || null,
        dinnerPhotoUrl: d.dinnerPhotoUrl || null,
        snackPhotoUrl: d.snackPhotoUrl || null,
        waterTotalMl,
        waterEntries,
        menuForDay: assignedMenu || null,
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

  useEffect(() => {
    if (isOpen && userId) {
      loadDay()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, userId, selectedDate])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{userName}'s Day</h3>
            <p className="text-sm text-gray-600">{dateLabel}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="px-2 py-1 text-sm text-gray-600 hover:text-gray-900"
              onClick={() => setSelectedDate(prev => addDays(prev, -1))}
            >
              ◀
            </button>
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="border border-gray-300 rounded px-2 py-1 text-sm"
            />
            <button
              className="px-2 py-1 text-sm text-gray-600 hover:text-gray-900"
              onClick={() => setSelectedDate(prev => addDays(prev, 1))}
            >
              ▶
            </button>
            <button
              className="ml-4 text-gray-500 hover:text-gray-700 cursor-pointer"
              onClick={onClose}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading && (
            <div className="flex items-center justify-center h-40">
              <div className="text-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto" />
                <p className="mt-3 text-gray-600 text-sm">Loading...</p>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}

          {!loading && !error && (
            <div className="space-y-4">
              {/* Macros Summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <MacroCard label="Calories" value={macroTotals.calories || 0} unit=" kcal" goal={Math.round(daily.goals.calories || 0)} />
                <MacroCard label="Protein" value={macroTotals.proteinsInGrams || 0} unit=" g" goal={Math.round(daily.goals.protein || 0)} />
                <MacroCard label="Carbs" value={macroTotals.carbohydratesInGrams || 0} unit=" g" goal={Math.round(daily.goals.carbs || 0)} />
                <MacroCard label="Fat" value={macroTotals.fatInGrams || 0} unit=" g" goal={Math.round(daily.goals.fat || 0)} />
              </div>

              {/* Meals */}
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Meals</h3>
                <MealSection
                  title="Breakfast"
                  items={daily.breakfast}
                  photoUrl={daily.breakfastPhotoUrl}
                />
                <MealSection
                  title="Lunch"
                  items={daily.lunch}
                  photoUrl={daily.lunchPhotoUrl}
                />
                <MealSection
                  title="Dinner"
                  items={daily.dinner}
                  photoUrl={daily.dinnerPhotoUrl}
                />
                <MealSection
                  title="Snack"
                  items={daily.snack}
                  photoUrl={daily.snackPhotoUrl}
                />
              </div>

              {/* Exercises */}
              {Array.isArray(daily.exercises) && daily.exercises.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-sm font-semibold text-gray-900">Exercise</h3>
                    <span className="text-xs text-gray-600">Total: {Math.round(daily.exerciseCalories)} kcal</span>
                  </div>
                  <div className="space-y-1">
                    {daily.exercises.map((ex, idx) => (
                      <ItemCard key={idx} it={ex} />
                    ))}
                  </div>
                </div>
              )}

              {/* Water Intake */}
              {Array.isArray(daily.waterEntries) && daily.waterEntries.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-lg p-4">
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

              {/* Assigned Menu */}
              {daily.menuForDay && (
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-sm font-semibold text-gray-900">Assigned Menu</h3>
                    {daily.menuForDay?.name && (
                      <span className="text-xs text-gray-600">{daily.menuForDay.name}</span>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {(['breakfastPlan','lunchPlan','dinnerPlan','snackPlan']).map((mealKey) => {
                      const labelMap = { breakfastPlan: 'Breakfast', lunchPlan: 'Lunch', dinnerPlan: 'Dinner', snackPlan: 'Snack' }
                      const items = daily.menuForDay?.[mealKey] || []
                      const totals = items.reduce((acc, it) => {
                        const isRecipeItem = detectIsRecipe(it)
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

                      return (
                        <div key={mealKey} className="border border-gray-200 rounded p-2">
                          <div className="text-xs font-medium text-gray-700 mb-2">{labelMap[mealKey]}</div>
                          <div className="space-y-1">
                            {items.length === 0 && <div className="text-xs text-gray-500">No items</div>}
                            {items.map((it, i) => (
                              <div key={i} className="text-xs text-gray-600">
                                {it?.name || it?.title || 'Unnamed'}
                              </div>
                            ))}
                          </div>
                          {items.length > 0 && (
                            <div className="mt-2 pt-2 border-t text-xs text-gray-600">
                              {Math.round(totals.calories)} cal | P {Math.round(totals.proteinsInGrams)}g | C {Math.round(totals.carbohydratesInGrams)}g | F {Math.round(totals.fatInGrams)}g
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ClientDayModal
