import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { getDailyNutrition, getUserData, getUserMenuByDate } from '../services/loggedinApi'
import { sumTotalsByMealsApplied, computeAppliedTotals, detectIsRecipe, findDefaultServing, findServingByIdentifier, getServingIdentifier, calculateDisplayValues, safeNutrients } from '../util/menuDisplay'
import { getCategoryIcon } from '../util/categoryIcons'

// Simple date helpers
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
    <div className="card p-4">
      <div className="flex justify-between items-baseline">
        <p className="text-sm text-gray-500">{label}</p>
        {goal ? (
          <p className="text-xs text-gray-400">Goal: {goal}{unit}</p>
        ) : null}
      </div>
      <p className="text-2xl font-semibold text-gray-900">{value}{unit}</p>
      {pct !== null && (
        <div className="mt-2">
          <Progress percent={pct} />
          <p className="text-xs text-gray-500 mt-1">{pct}%</p>
        </div>
      )}
    </div>
  )
}

const getItemDisplay = (it) => {
  // Prefer nested food/exercise names like RN data shape
  if (it?.food?.name) return it.food.name
  if (it?.exercise?.name) return it.exercise.name
  return it?.name || it?.foodName || 'Item'
}

const getItemCalories = (it) => {
  // Approximate calories: use food.totalCalories as already quantity-adjusted if backend returns so
  if (it?.food?.totalCalories) return Math.round(it.food.totalCalories)
  if (typeof it?.calories === 'number') return Math.round(it.calories)
  if (it?.exercise?.caloriesBurnt) return Math.round(it.exercise.caloriesBurnt)
  return Math.round(it?.totalCalories || 0)
}

const ItemCard = ({ it, onClick }) => {
  const name = getItemDisplay(it)
  const kcal = getItemCalories(it)
  const category = it?.food?.category || it?.category || (it?.exercise ? 'exerciseGeneral' : '')
  const fallbackImg = category ? getCategoryIcon(category) : null
  const img = it?.food?.photoUrl || it?.exercise?.photoUrl || it?.photoUrl || fallbackImg
  return (
    <button
      onClick={() => onClick?.(it)}
      className="w-full text-left flex justify-between items-center p-2 rounded hover:bg-gray-50 transition-colors cursor-pointer"
    >
      <div className="flex items-center gap-3 overflow-hidden">
        <div className="w-8 h-8 rounded bg-gray-100 flex items-center justify-center overflow-hidden">
          {img ? (
            <img src={img} alt={name} className="w-8 h-8 object-cover" />
          ) : (
            <span className="text-xs text-gray-400">{category || 'food'}</span>
          )}
        </div>
        <span className="text-gray-800 truncate max-w-[220px]">{name}</span>
      </div>
      <span className="text-gray-500">{kcal} kcal</span>
    </button>
  )
}

const MealSection = ({ title, items = [], photoUrl, onItemClick }) => (
  <div className="card p-6">
    <div className="flex justify-between items-center mb-3">
      <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
      {photoUrl ? (
        <img src={photoUrl} alt={`${title} photo`} className="w-10 h-10 rounded object-cover" />
      ) : null}
    </div>
    {items && items.length > 0 ? (
      <div className="space-y-1">
        {items.map((it, idx) => (
          <ItemCard key={idx} it={it} onClick={onItemClick} />
        ))}
      </div>
    ) : (
      <p className="text-sm text-gray-500">No items added.</p>
    )}
  </div>
)

const MyDay = () => {
  const { currentUser } = useAuth()
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
  const [activeSlide, setActiveSlide] = useState(0)
  const carouselRef = useRef(null)
  const [selectedItem, setSelectedItem] = useState(null)
  const [isItemModalOpen, setIsItemModalOpen] = useState(false)

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

  const loadDay = async () => {
    if (!currentUser?.uid) return
    const fetchKey = `${currentUser.uid}-${selectedDate}`
    if (lastFetchKeyRef.current === fetchKey) {
      // Prevent duplicate requests (StrictMode/dev double-invoke)
      return
    }
    lastFetchKeyRef.current = fetchKey
    setLoading(true)
    setError(null)
    try {
      const [dailyRes, userRes, menuRes] = await Promise.all([
        getDailyNutrition({ userId: currentUser.uid, dateApplied: toISO(selectedDate) }),
        getUserData({ userId: currentUser.uid, selectedDate }),
        getUserMenuByDate({ userId: currentUser.uid, dateApplied: toISO(selectedDate) })
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
      setSelectedItem(null)
      setIsItemModalOpen(false)
    } catch (e) {
      setError(e?.message || 'Failed to load daily nutrition')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDay()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.uid, selectedDate])

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">My Day</h1>
          <p className="text-gray-600 mt-2">Your meals and macros for {dateLabel}.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="btn-secondary px-3 py-2"
            onClick={() => setSelectedDate(prev => addDays(prev, -1))}
          >
            ◀ Prev
          </button>
          <input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            className="btn-secondary px-3 py-2"
            onClick={() => setSelectedDate(prev => addDays(prev, 1))}
          >
            Next ▶
          </button>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center h-40">
          <div className="text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto" />
            <p className="mt-3 text-gray-600">Loading your day...</p>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {!loading && !error && (
        <>
          {/* Top Carousel inspired by RN Dashboard */}
          <div className="relative rounded-2xl p-4" style={{
            background: 'rgba(255, 255, 255, 0.25)',
            boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.15)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.18)',
            paddingLeft: 40,
            paddingRight: 40
          }}>
            <div ref={carouselRef} className="overflow-x-auto snap-x snap-mandatory flex gap-4 no-scrollbar" onScroll={(e) => {
              const el = e.currentTarget
              const slide = Math.round(el.scrollLeft / el.clientWidth)
              if (slide !== activeSlide) setActiveSlide(slide)
            }}>
              {/* Slide 1: Calories circle */}
              <div className="min-w-full snap-center">
                <div className="flex items-center justify-between">
                  <div className="flex-1 text-center">
                    <p className="text-2xl font-semibold text-gray-900">{macroTotals.calories}</p>
                    <p className="text-sm text-gray-600">Eaten</p>
                  </div>
                  <CalorieCircle
                    totalGoal={Number(daily.goals.calories) || 0}
                    eaten={Number(macroTotals.calories) || 0}
                    burned={Number(daily.exerciseCalories) || 0}
                  />
                  <div className="flex-1 text-center">
                    <p className="text-2xl font-semibold text-gray-900">{Math.round(daily.exerciseCalories || 0)}</p>
                    <p className="text-sm text-gray-600">Burned</p>
                  </div>
                </div>
              </div>

              {/* Slide 2: Macros summary */}
              <div className="min-w-full snap-center">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <MacroCard label="Protein" value={macroTotals.proteinsInGrams || 0} unit=" g" goal={Math.round(daily.goals.protein || 0)} />
                  <MacroCard label="Carbs" value={macroTotals.carbohydratesInGrams || 0} unit=" g" goal={Math.round(daily.goals.carbs || 0)} />
                  <MacroCard label="Fat" value={macroTotals.fatInGrams || 0} unit=" g" goal={Math.round(daily.goals.fat || 0)} />
                  <MacroCard label="Calories" value={macroTotals.calories || 0} unit=" kcal" goal={Math.round(daily.goals.calories || 0)} />
                </div>
              </div>
            </div>
            {/* Dots */}
            <div className="flex justify-center gap-2 mt-3">
              {[0,1].map(i => (
                <span key={i} className={`w-2 h-2 rounded-full ${activeSlide===i ? 'bg-blue-600 w-3' : 'bg-gray-300'}`} />
              ))}
            </div>
            {/* Left/Right scroll buttons */}
            {activeSlide > 0 && (
              <button
                type="button"
                className="absolute inset-y-0 left-2 flex items-center px-2 py-1 rounded-full hover:bg-white/50 transition shadow-sm"
                style={{
                  background: 'rgba(255,255,255,0.35)',
                  backdropFilter: 'blur(6px)',
                  WebkitBackdropFilter: 'blur(6px)',
                  border: '1px solid rgba(255,255,255,0.2)'
                }}
                onClick={() => {
                  const el = carouselRef.current
                  if (!el) return
                  const nextSlide = Math.max(0, activeSlide - 1)
                  el.scrollTo({ left: nextSlide * el.clientWidth, behavior: 'smooth' })
                }}
              >
                <span className="text-lg text-gray-700">←</span>
              </button>
            )}
            {activeSlide < 1 && (
              <button
                type="button"
                className="absolute inset-y-0 right-2 flex items-center px-2 py-1 rounded-full hover:bg-white/50 transition shadow-sm"
                style={{
                  background: 'rgba(255,255,255,0.35)',
                  backdropFilter: 'blur(6px)',
                WebkitBackdropFilter: 'blur(6px)',
                border: '1px solid rgba(255,255,255,0.2)'
              }}
              onClick={() => {
                const el = carouselRef.current
                if (!el) return
                const maxSlides = 2 // number of slides
                const nextSlide = Math.min(maxSlides - 1, activeSlide + 1)
                el.scrollTo({ left: nextSlide * el.clientWidth, behavior: 'smooth' })
              }}
            >
              <span className="text-lg text-gray-700">→</span>
            </button>
            )}
          </div>

          {/* Meals */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <MealSection
              title="Breakfast"
              items={daily.breakfast}
              photoUrl={daily.breakfastPhotoUrl}
              onItemClick={(it) => { setSelectedItem(it); setIsItemModalOpen(true) }}
            />
            <MealSection
              title="Lunch"
              items={daily.lunch}
              photoUrl={daily.lunchPhotoUrl}
              onItemClick={(it) => { setSelectedItem(it); setIsItemModalOpen(true) }}
            />
            <MealSection
              title="Dinner"
              items={daily.dinner}
              photoUrl={daily.dinnerPhotoUrl}
              onItemClick={(it) => { setSelectedItem(it); setIsItemModalOpen(true) }}
            />
            <MealSection
              title="Snack"
              items={daily.snack}
              photoUrl={daily.snackPhotoUrl}
              onItemClick={(it) => { setSelectedItem(it); setIsItemModalOpen(true) }}
            />
          </div>

          {/* Exercises */}
          <div className="card p-6">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg font-semibold text-gray-900">Exercise</h3>
              {daily.exerciseCalories > 0 ? (
                <span className="text-sm text-gray-600">Total: {Math.round(daily.exerciseCalories)} kcal</span>
              ) : null}
            </div>
            {Array.isArray(daily.exercises) && daily.exercises.length > 0 ? (
              <ul className="space-y-2">
                {daily.exercises.map((ex, idx) => (
                  <ItemCard key={idx} it={ex} onClick={(it) => { setSelectedItem(it); setIsItemModalOpen(true) }} />
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500">No exercises logged.</p>
            )}
          </div>

          {/* Water Intake */}
          <div className="card p-6">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg font-semibold text-gray-900">Water Intake</h3>
              <span className="text-sm text-gray-600">Total: {Math.round(daily.waterTotalMl || 0)} ml</span>
            </div>
            {Array.isArray(daily.waterEntries) && daily.waterEntries.length > 0 ? (
              <ul className="space-y-2">
                {daily.waterEntries.map((we, idx) => (
                  <li key={idx} className="flex justify-between text-sm">
                    <span className="text-gray-800 truncate">{we?.label || 'Water'}</span>
                    <span className="text-gray-500">{Math.round(we?.quantity || we?.ml || 0)} ml</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500">No water logged.</p>
            )}
          </div>

          {/* Assigned Menu */}
          <div className="card p-6">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg font-semibold text-gray-900">Assigned Menu</h3>
              {daily.menuForDay?.name ? (
                <span className="text-sm text-gray-600">{daily.menuForDay.name}</span>
              ) : null}
            </div>
            {daily.menuForDay ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(['breakfastPlan','lunchPlan','dinnerPlan','snackPlan']).map((mealKey) => {
                    const labelMap = { breakfastPlan: 'Breakfast (Menu)', lunchPlan: 'Lunch (Menu)', dinnerPlan: 'Dinner (Menu)', snackPlan: 'Snack (Menu)' }
                    const items = daily.menuForDay?.[mealKey] || []
                    // Compute adjusted per-item display like Menus Selected Items
                    const renderedItems = items.map((it) => {
                      const isRecipeItem = detectIsRecipe(it)
                      const servingOptions = Array.isArray(it?.serving) ? it.serving : []
                      // Determine originalServingAmount similar to Menus
                      let originalServingAmount = it?.originalServingAmount
                      if (!originalServingAmount && servingOptions.length > 0) {
                        if (isRecipeItem) {
                          const portionServing = servingOptions.find(s => s.profileId === 1)
                          if (portionServing) {
                            const numberOfServings = it?.numberOfServings || it?.originalServings || 1
                            originalServingAmount = portionServing.amount * numberOfServings
                          } else {
                            const totalWeight = it?.totalNutrients?.totalQuantity || it?.totalNutrients?.weightAfterCooking || null
                            if (totalWeight) {
                              originalServingAmount = totalWeight
                            } else {
                              const def = findDefaultServing(servingOptions)
                              const numberOfServings = it?.numberOfServings || it?.originalServings || 1
                              originalServingAmount = (def?.amount || 100) * numberOfServings
                            }
                          }
                        } else {
                          const def = findDefaultServing(servingOptions)
                          originalServingAmount = def?.amount || 100
                        }
                      }
                      originalServingAmount = originalServingAmount || 100

                      // If item has changedServing from template, use that amount and serving
                      let selectedAmount = originalServingAmount
                      if (it?.changedServing?.value) {
                        selectedAmount = it.changedServing.value
                      }

                      const calc = calculateDisplayValues(it, selectedAmount, originalServingAmount)
                      const adjCalories = calc.calories
                      const adjNutrients = calc.nutrients
                      return { it, adjCalories, adjNutrients }
                    })

                    const totals = renderedItems.reduce((acc, r) => {
                      const n = safeNutrients(r.adjNutrients)
                      return {
                        calories: acc.calories + (r.adjCalories || 0),
                        proteinsInGrams: acc.proteinsInGrams + n.proteinsInGrams,
                        carbohydratesInGrams: acc.carbohydratesInGrams + n.carbohydratesInGrams,
                        fatInGrams: acc.fatInGrams + n.fatInGrams,
                      }
                    }, { calories: 0, proteinsInGrams: 0, carbohydratesInGrams: 0, fatInGrams: 0 })

                    return (
                      <div key={mealKey} className="border border-gray-200 rounded-lg">
                        <div className="px-3 py-2 bg-gray-50 border-b text-sm font-medium text-gray-700">{labelMap[mealKey]}</div>
                        <div className="p-3 space-y-2">
                          {renderedItems.length === 0 && <div className="text-sm text-gray-500">No items</div>}
                          {renderedItems.map((r, i) => (
                            <div key={i} className="p-2 rounded bg-white shadow-sm">
                              <div className="flex items-start justify-between">
                                <div className="min-w-0">
                                  <div className="text-sm font-medium text-gray-900 truncate">{r.it?.name || r.it?.title || r.it?.food?.name || 'Unnamed'}</div>
                                  <div className="text-xs text-gray-500 truncate">{detectIsRecipe(r.it) ? 'Recipe' : 'Food'}</div>
                                </div>
                              </div>
                              <div className="mt-1 text-xs text-gray-600">
                                <span className="font-medium">Calories:</span> {Math.round(r.adjCalories || 0)}
                                <span className="mx-2">|</span>
                                <span className="font-medium">Proteins:</span> {Math.round(Number(r.adjNutrients?.proteinsInGrams) || 0)} g
                                <span className="mx-2">|</span>
                                <span className="font-medium">Carbs:</span> {Math.round(Number(r.adjNutrients?.carbohydratesInGrams) || 0)} g
                                <span className="mx-2">|</span>
                                <span className="font-medium">Fat:</span> {Math.round(Number(r.adjNutrients?.fatInGrams) || 0)} g
                              </div>
                            </div>
                          ))}
                          {renderedItems.length > 0 && (
                            <div className="mt-2 p-2 bg-blue-50 rounded text-xs text-blue-900">
                              <span className="font-medium">Subtotal:</span>
                              <span className="ml-1">{Math.round(totals.calories)} cal</span>
                              <span className="mx-2">|</span>
                              <span>P {Math.round(totals.proteinsInGrams)} g</span>
                              <span className="mx-2">|</span>
                              <span>C {Math.round(totals.carbohydratesInGrams)} g</span>
                              <span className="mx-2">|</span>
                              <span>F {Math.round(totals.fatInGrams)} g</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
                {/* Subtotals like Menus Selected Items */}
                {(() => {
                  const computeTotalsFor = (items) => {
                    const arr = items || []
                    return arr.reduce((acc, it) => {
                      const isRecipeItem = detectIsRecipe(it)
                      const servingOptions = Array.isArray(it?.serving) ? it.serving : []
                      let originalServingAmount = it?.originalServingAmount
                      if (!originalServingAmount && servingOptions.length > 0) {
                        if (isRecipeItem) {
                          const portionServing = servingOptions.find(s => s.profileId === 1)
                          if (portionServing) {
                            const numberOfServings = it?.numberOfServings || it?.originalServings || 1
                            originalServingAmount = portionServing.amount * numberOfServings
                          } else {
                            const totalWeight = it?.totalNutrients?.totalQuantity || it?.totalNutrients?.weightAfterCooking || null
                            if (totalWeight) originalServingAmount = totalWeight
                            else {
                              const def = findDefaultServing(servingOptions)
                              const numberOfServings = it?.numberOfServings || it?.originalServings || 1
                              originalServingAmount = (def?.amount || 100) * numberOfServings
                            }
                          }
                        } else {
                          const def = findDefaultServing(servingOptions)
                          originalServingAmount = def?.amount || 100
                        }
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

                  const bp = computeTotalsFor(daily.menuForDay?.breakfastPlan)
                  const lp = computeTotalsFor(daily.menuForDay?.lunchPlan)
                  const dp = computeTotalsFor(daily.menuForDay?.dinnerPlan)
                  const sp = computeTotalsFor(daily.menuForDay?.snackPlan)
                  const total = {
                    calories: bp.calories + lp.calories + dp.calories + sp.calories,
                    proteinsInGrams: bp.proteinsInGrams + lp.proteinsInGrams + dp.proteinsInGrams + sp.proteinsInGrams,
                    carbohydratesInGrams: bp.carbohydratesInGrams + lp.carbohydratesInGrams + dp.carbohydratesInGrams + sp.carbohydratesInGrams,
                    fatInGrams: bp.fatInGrams + lp.fatInGrams + dp.fatInGrams + sp.fatInGrams,
                  }
                  return (
                    <div className="space-y-2">
                      <div className="p-3 bg-green-50 rounded text-sm text-green-900">
                        <span className="font-semibold">Menu totals:</span>
                        <span className="ml-2">{Math.round(total.calories)} cal</span>
                        <span className="mx-2">|</span>
                        <span>P {Math.round(total.proteinsInGrams)} g</span>
                        <span className="mx-2">|</span>
                        <span>C {Math.round(total.carbohydratesInGrams)} g</span>
                        <span className="mx-2">|</span>
                        <span>F {Math.round(total.fatInGrams)} g</span>
                      </div>
                    </div>
                  )
                })()}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No menu assigned for this day.</p>
            )}
          </div>
        </>
      )}

      {/* Item detail modal */}
      {isItemModalOpen && selectedItem && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900 truncate">
                {getItemDisplay(selectedItem)}
              </h3>
              <button
                className="text-gray-500 hover:text-gray-700 cursor-pointer"
                onClick={() => setIsItemModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <div className="flex items-start gap-4 mb-4">
              <div className="w-16 h-16 rounded bg-gray-100 flex items-center justify-center overflow-hidden">
                {selectedItem?.food?.photoUrl || selectedItem?.exercise?.photoUrl ? (
                  <img
                    src={selectedItem?.food?.photoUrl || selectedItem?.exercise?.photoUrl}
                    alt="thumb"
                    className="w-16 h-16 object-cover"
                  />
                ) : (
                  <span className="text-xs text-gray-400">
                    {(selectedItem?.food?.category || (selectedItem?.exercise ? 'exercise' : 'food'))}
                  </span>
                )}
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-600 mb-1">Calories</p>
                <p className="text-xl font-semibold text-gray-900">{getItemCalories(selectedItem)} kcal</p>
                {selectedItem?.unit && (
                  <p className="text-xs text-gray-500 mt-1">Unit: {selectedItem.unit}</p>
                )}
                {selectedItem?.quantity && (
                  <p className="text-xs text-gray-500">Quantity: {selectedItem.quantity}</p>
                )}
              </div>
            </div>

            {/* Nutrients for food */}
            {selectedItem?.food?.totalNutrients && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-gray-500">Protein</p>
                  <p className="text-sm font-medium text-gray-900">{selectedItem.food.totalNutrients.proteinsInGrams || 0} g</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Carbs</p>
                  <p className="text-sm font-medium text-gray-900">{selectedItem.food.totalNutrients.carbohydratesInGrams || 0} g</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Fat</p>
                  <p className="text-sm font-medium text-gray-900">{selectedItem.food.totalNutrients.fatInGrams || 0} g</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Fiber</p>
                  <p className="text-sm font-medium text-gray-900">{selectedItem.food.totalNutrients.fibreInGrams || 0} g</p>
                </div>
              </div>
            )}

            {/* Exercise details */}
            {selectedItem?.exercise && (
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-gray-500">Duration</p>
                  <p className="text-sm font-medium text-gray-900">{selectedItem.exercise.durationInMinutes || selectedItem.quantity || 0} min</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Burnt</p>
                  <p className="text-sm font-medium text-gray-900">{selectedItem.exercise.caloriesBurnt || 0} kcal</p>
                </div>
              </div>
            )}

            <div className="mt-6 flex justify-end">
              <button
                className="btn-secondary px-4 py-2"
                onClick={() => setIsItemModalOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default MyDay

// Local circular progress for calories remaining
function CalorieCircle({ totalGoal, eaten, burned }) {
  const remaining = (totalGoal || 0) - (eaten || 0) + (burned || 0)
  const percentage = totalGoal > 0 ? Math.max(0, Math.min(100, Math.round(100 - (remaining / totalGoal) * 100))) : 0
  const color = (() => {
    if (!totalGoal || percentage === 0) return '#9CA3AF' // gray
    if (percentage <= 25) return '#16A34A' // green
    if (percentage <= 50) return '#16A34A'
    if (percentage <= 100) return '#16A34A'
    return '#DC2626' // red when over
  })()

  return (
    <div className="relative w-36 h-36">
      <svg className="w-36 h-36" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="45" stroke="#e5e7eb" strokeWidth="8" fill="none" />
        <circle
          cx="50" cy="50" r="45"
          stroke={color}
          strokeWidth="8"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${Math.max(0, Math.min(100, percentage))} ${100 - Math.max(0, Math.min(100, percentage))}`}
          transform="rotate(-90 50 50)"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <p className="text-2xl font-semibold" style={{ color }}>{Math.round(remaining || 0)}</p>
        <p className="text-xs text-gray-600">kcal remaining</p>
      </div>
    </div>
  )
}
