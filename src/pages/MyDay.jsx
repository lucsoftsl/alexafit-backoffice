import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../contexts/AuthContext'
import {
  getDailyNutrition,
  getUserData,
  getUserMenuByDate
} from '../services/loggedinApi'
import {
  sumTotalsByMealsApplied,
  computeAppliedTotals,
  detectIsRecipe,
  findDefaultServing,
  findServingByIdentifier,
  getServingIdentifier,
  calculateDisplayValues,
  safeNutrients
} from '../util/menuDisplay'
import { getCategoryIcon } from '../util/categoryIcons'
import { ArrowPathIcon, SparklesIcon } from '@heroicons/react/24/outline'

// Simple date helpers
const todayISO = () => new Date().toISOString().slice(0, 10)
const toISO = d => new Date(d).toISOString().slice(0, 10)
const addDays = (dateStr, days) => {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

// Glass UI utility classes
const glassCardClass =
  'relative rounded-2xl border border-white/20 bg-white/10 backdrop-blur-xl shadow-xl'
const glassSurfaceClass =
  'relative rounded-2xl border border-white/15 bg-white/5 backdrop-blur-md'

const Progress = ({ percent }) => (
  <div className="w-full h-2 bg-white/20 rounded">
    <div
      className="h-2 bg-indigo-500 rounded"
      style={{ width: `${Math.max(0, Math.min(100, percent))}%` }}
    />
  </div>
)

const MacroCard = ({ label, value, unit = '', goal }) => {
  const pct = goal ? Math.round(((value || 0) / goal) * 100) : null
  return (
    <div className={`${glassSurfaceClass} p-4`}>
      <div className="flex justify-between items-baseline">
        <p className="text-sm text-gray-500">{label}</p>
        {goal ? (
          <p className="text-xs text-gray-400">
            Goal: {goal}
            {unit}
          </p>
        ) : null}
      </div>
      <p className="text-2xl font-semibold text-gray-900">
        {value}
        {unit}
      </p>
      {pct !== null && (
        <div className="mt-2">
          <Progress percent={pct} />
          <p className="text-xs text-gray-500 mt-1">{pct}%</p>
        </div>
      )}
    </div>
  )
}

const getItemDisplay = it => {
  // Prefer nested food/exercise names like RN data shape
  if (it?.food?.name) return it.food.name
  if (it?.exercise?.name) return it.exercise.name
  return it?.name || it?.foodName || 'Item'
}

const getItemCalories = it => {
  // For applied food items, scale calories based on quantity
  if (it?.food && it?.quantity !== undefined && it?.food?.serving) {
    const isRecipe = detectIsRecipe(it.food)
    const baseCalories = Number(it.food.totalCalories || 0)
    const baseNutrients = it.food.totalNutrients || {}
    const quantity = Number(it.quantity) || 0

    if (isRecipe) {
      // For recipes: totalCalories is for ALL numberOfServings servings
      const numberOfServings = it.food.numberOfServings || 1
      const totalQuantity =
        baseNutrients?.totalQuantity ||
        baseNutrients?.weightAfterCooking ||
        null

      if (totalQuantity && totalQuantity > 0 && quantity > 0) {
        // Scale recipe based on actual quantity vs total recipe weight
        const scaleRatio = quantity / totalQuantity
        return Math.round(baseCalories * scaleRatio)
      } else {
        // Fallback: use portion serving if available
        const portionServing = (it.food.serving || []).find(
          s => s.profileId === 1
        )
        const defaultServing =
          portionServing || findDefaultServing(it.food.serving || [])
        const defaultServingAmount = defaultServing?.amount || 100
        const perServingWeight =
          portionServing?.amount || defaultServingAmount / numberOfServings

        if (perServingWeight && perServingWeight > 0 && quantity > 0) {
          const selectedServings = quantity / perServingWeight
          const scaleRatio = selectedServings / numberOfServings
          return Math.round(baseCalories * scaleRatio)
        } else {
          const scaleRatio = quantity / defaultServingAmount
          return Math.round(baseCalories * scaleRatio)
        }
      }
    } else {
      // For foods: use default serving
      const servingArray = it.food.serving || []
      const defaultServing = findDefaultServing(servingArray)
      const defaultServingAmount = defaultServing?.amount || 100

      if (quantity > 0) {
        const scaleRatio = quantity / defaultServingAmount
        return Math.round(baseCalories * scaleRatio)
      } else {
        return Math.round(baseCalories)
      }
    }
  }
  // Fallback for other item types
  if (it?.food?.totalCalories) return Math.round(it.food.totalCalories)
  if (typeof it?.calories === 'number') return Math.round(it.calories)
  if (it?.exercise?.caloriesBurnt) return Math.round(it.exercise.caloriesBurnt)
  return Math.round(it?.totalCalories || 0)
}

const ItemCard = ({ it, onClick }) => {
  const name = getItemDisplay(it)
  const kcal = getItemCalories(it)
  const category =
    it?.food?.category ||
    it?.category ||
    (it?.exercise ? 'exerciseGeneral' : '')
  const fallbackImg = category ? getCategoryIcon(category) : null
  const img =
    it?.food?.photoUrl || it?.exercise?.photoUrl || it?.photoUrl || fallbackImg
  return (
    <button
      onClick={() => onClick?.(it)}
      className="w-full text-left flex justify-between items-center p-2 rounded hover:bg-white/40 transition-colors cursor-pointer"
    >
      <div className="flex items-center gap-3 overflow-hidden">
        <div className="w-8 h-8 rounded bg-white/40 backdrop-blur-sm flex items-center justify-center overflow-hidden">
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

const MealSection = ({ title, items = [], photoUrl, onItemClick, t }) => (
  <div className={`${glassCardClass} p-6`}>
    <div className="flex justify-between items-center mb-3">
      <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
      {photoUrl ? (
        <img
          src={photoUrl}
          alt={`${title} photo`}
          className="w-10 h-10 rounded object-cover"
        />
      ) : null}
    </div>
    {items && items.length > 0 ? (
      <div className="space-y-1">
        {items.map((it, idx) => (
          <ItemCard key={idx} it={it} onClick={onItemClick} />
        ))}
      </div>
    ) : (
      <p className="text-sm text-gray-500">{t('pages.myDay.noItems')}</p>
    )}
  </div>
)

const MyDay = () => {
  const { t } = useTranslation()
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
    menuForDay: null
  })
  const [macroTotals, setMacroTotals] = useState({
    calories: 0,
    proteinsInGrams: 0,
    carbohydratesInGrams: 0,
    fatInGrams: 0
  })
  const [activeSlide, setActiveSlide] = useState(0)
  const carouselRef = useRef(null)
  const [selectedItem, setSelectedItem] = useState(null)
  const [isItemModalOpen, setIsItemModalOpen] = useState(false)

  const selectedItemFallbackImg = selectedItem
    ? getCategoryIcon(
        selectedItem?.food?.category ||
          selectedItem?.category ||
          (selectedItem?.exercise ? 'exerciseGeneral' : '')
      )
    : null

  const lastFetchKeyRef = useRef('')
  const dateLabel = useMemo(() => {
    try {
      return new Date(selectedDate).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
    } catch {
      return selectedDate
    }
  }, [selectedDate])

  const loadDay = async (ignoreRefetchCheck = false) => {
    if (!currentUser?.uid) return
    const fetchKey = `${currentUser.uid}-${selectedDate}`
    if (!ignoreRefetchCheck && lastFetchKeyRef.current === fetchKey) {
      // Prevent duplicate requests (StrictMode/dev double-invoke)
      return
    }
    lastFetchKeyRef.current = fetchKey
    setLoading(true)
    setError(null)
    try {
      const [dailyRes, userRes, menuRes] = await Promise.all([
        getDailyNutrition({
          userId: currentUser.uid,
          dateApplied: toISO(selectedDate)
        }),
        getUserData({ userId: currentUser.uid, selectedDate }),
        getUserMenuByDate({
          userId: currentUser.uid,
          dateApplied: toISO(selectedDate)
        })
      ])
      const dWrap = dailyRes?.data || dailyRes || {}
      const uWrap = userRes?.data || userRes || {}
      const d = dWrap?.data || {}
      const u = uWrap?.data || {}
      const userGoals = u?.userGoals || {}
      const assignedMenu = menuRes?.data || menuRes || null
      const waterEntries = Array.isArray(d?.water) ? d.water : []
      const waterTotalMl = waterEntries.reduce(
        (acc, e) => acc + (Number(e?.quantity) || 0),
        0
      )

      setDaily({
        totalCalories: 0,
        totalProtein: 0,
        totalCarbs: 0,
        totalFat: 0,
        goals: {
          calories: userGoals?.totalCalories || 0,
          protein: userGoals?.proteinsInGrams || 0,
          carbs: userGoals?.carbohydratesInGrams || 0,
          fat: userGoals?.fatInGrams || 0
        },
        breakfast: d.breakfast || [],
        lunch: d.lunch || [],
        dinner: d.dinner || [],
        snack: d.snack || [],
        exercises: d.exercise || [],
        exerciseCalories: Array.isArray(d.exercise)
          ? d.exercise.reduce(
              (acc, e) => acc + (e?.exercise?.caloriesBurnt || 0),
              0
            )
          : 0,
        breakfastPhotoUrl: d.breakfastPhotoUrl || null,
        lunchPhotoUrl: d.lunchPhotoUrl || null,
        dinnerPhotoUrl: d.dinnerPhotoUrl || null,
        snackPhotoUrl: d.snackPhotoUrl || null,
        waterTotalMl,
        waterEntries,
        menuForDay: assignedMenu || null
      })
      const totals = sumTotalsByMealsApplied({
        breakfast: d?.breakfast || [],
        lunch: d?.lunch || [],
        dinner: d?.dinner || [],
        snack: d?.snack || []
      })
      setMacroTotals({
        calories: Math.round(totals.calories),
        proteinsInGrams: Math.round(totals.proteinsInGrams),
        carbohydratesInGrams: Math.round(totals.carbohydratesInGrams),
        fatInGrams: Math.round(totals.fatInGrams)
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
      {/* Header - Glass hero */}
      <div className={`p-6 sm:p-8 ${glassCardClass} overflow-hidden`}>
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-indigo-500/20 via-fuchsia-500/20 to-pink-500/20" />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <SparklesIcon className="w-7 h-7 text-indigo-400" />
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
                {t('pages.myDay.title')}
              </h1>
              <p className="text-gray-700 mt-1">
                {t('pages.myDay.mealAndMacros')} {t('common.for')} {dateLabel}.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              className="btn-secondary px-3 py-2"
              onClick={() => setSelectedDate(prev => addDays(prev, -1))}
            >
              {t('pages.myDay.prev')}
            </button>
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="border border-white/30 bg-white/40 backdrop-blur-sm rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              className="btn-secondary px-3 py-2"
              onClick={() => setSelectedDate(prev => addDays(prev, 1))}
            >
              {t('pages.myDay.next')}
            </button>
            <button
              onClick={() => loadDay(true)}
              disabled={loading}
              className="p-2 text-indigo-600 hover:text-indigo-900 hover:bg-white/50 rounded transition-colors"
              title={t('pages.myDay.refresh')}
            >
              <ArrowPathIcon
                className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`}
              />
            </button>
          </div>
        </div>
        {/* Quick stats */}
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className={`${glassSurfaceClass} p-4`}>
            <p className="text-sm text-gray-600">{t('pages.myDay.eaten')}</p>
            <p className="text-2xl font-semibold text-gray-900">
              {Math.round(macroTotals.calories || 0)} kcal
            </p>
          </div>
          <div className={`${glassSurfaceClass} p-4`}>
            <p className="text-sm text-gray-600">{t('pages.myDay.burned')}</p>
            <p className="text-2xl font-semibold text-gray-900">
              {Math.round(daily.exerciseCalories || 0)} kcal
            </p>
          </div>
          <div className={`${glassSurfaceClass} p-4`}>
            <p className="text-sm text-gray-600">{t('pages.myDay.water')}</p>
            <p className="text-2xl font-semibold text-gray-900">
              {Math.round(daily.waterTotalMl || 0)} ml
            </p>
          </div>
          <div className={`${glassSurfaceClass} p-4`}>
            <p className="text-sm text-gray-600">{t('pages.myDay.menu')}</p>
            <p className="text-sm font-medium text-gray-900 truncate">
              {daily.menuForDay?.name || t('pages.myDay.none')}
            </p>
          </div>
        </div>
      </div>

      {loading && (
        <div
          className={`${glassSurfaceClass} p-8 flex items-center justify-center`}
        >
          <div className="text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mx-auto" />
            <p className="mt-3 text-gray-700">{t('pages.myDay.loading')}</p>
          </div>
        </div>
      )}

      {error && (
        <div className={`${glassCardClass} p-4 border-rose-300/30`}>
          <p className="text-rose-800">{error}</p>
        </div>
      )}

      {!loading && !error && (
        <>
          {/* Top Carousel */}
          <div
            className={`relative rounded-2xl p-4 mx-auto ${glassCardClass}`}
            style={{
              paddingLeft: 32,
              paddingRight: 32
            }}
          >
            <div
              ref={carouselRef}
              className="overflow-x-auto snap-x snap-mandatory flex gap-4 no-scrollbar"
              onScroll={e => {
                const el = e.currentTarget
                const slide = Math.round(el.scrollLeft / el.clientWidth)
                if (slide !== activeSlide) setActiveSlide(slide)
              }}
            >
              {/* Slide 1: Calories circle */}
              <div className="min-w-full snap-center flex items-center justify-center">
                <div className="flex flex-col items-center gap-4 md:flex-row md:items-center md:justify-between">
                  <div className="flex-1 text-center">
                    <p className="text-2xl font-semibold text-gray-900">
                      {macroTotals.calories}
                    </p>
                    <p className="text-sm text-gray-600">
                      {t('pages.myDay.eaten')}
                    </p>
                  </div>
                  <div className="flex justify-center">
                    <CalorieCircle
                      totalGoal={Number(daily.goals.calories) || 0}
                      eaten={Number(macroTotals.calories) || 0}
                      burned={Number(daily.exerciseCalories) || 0}
                      t={t}
                    />
                  </div>
                  <div className="flex-1 text-center">
                    <p className="text-2xl font-semibold text-gray-900">
                      {Math.round(daily.exerciseCalories || 0)}
                    </p>
                    <p className="text-sm text-gray-600">
                      {t('pages.myDay.burned')}
                    </p>
                  </div>
                </div>
              </div>

              {/* Slide 2: Macros summary */}
              <div className="min-w-full snap-center">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <MacroCard
                    label={t('pages.myDay.protein')}
                    value={macroTotals.proteinsInGrams || 0}
                    unit=" g"
                    goal={Math.round(daily.goals.protein || 0)}
                  />
                  <MacroCard
                    label={t('pages.myDay.carbs')}
                    value={macroTotals.carbohydratesInGrams || 0}
                    unit=" g"
                    goal={Math.round(daily.goals.carbs || 0)}
                  />
                  <MacroCard
                    label={t('pages.myDay.fat')}
                    value={macroTotals.fatInGrams || 0}
                    unit=" g"
                    goal={Math.round(daily.goals.fat || 0)}
                  />
                  <MacroCard
                    label={t('pages.myDay.calories')}
                    value={macroTotals.calories || 0}
                    unit=" kcal"
                    goal={Math.round(daily.goals.calories || 0)}
                  />
                </div>
              </div>
            </div>
            {/* Dots */}
            <div className="flex justify-center gap-2 mt-3">
              {[0, 1].map(i => (
                <span
                  key={i}
                  className={`w-2 h-2 rounded-full ${activeSlide === i ? 'bg-blue-600 w-3' : 'bg-gray-300'}`}
                />
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
                  el.scrollTo({
                    left: nextSlide * el.clientWidth,
                    behavior: 'smooth'
                  })
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
                  el.scrollTo({
                    left: nextSlide * el.clientWidth,
                    behavior: 'smooth'
                  })
                }}
              >
                <span className="text-lg text-gray-700">→</span>
              </button>
            )}
          </div>

          {/* Meals */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <MealSection
              title={t('pages.myDay.breakfast')}
              items={daily.breakfast}
              photoUrl={daily.breakfastPhotoUrl}
              onItemClick={it => {
                setSelectedItem(it)
                setIsItemModalOpen(true)
              }}
              t={t}
            />
            <MealSection
              title={t('pages.myDay.lunch')}
              items={daily.lunch}
              photoUrl={daily.lunchPhotoUrl}
              onItemClick={it => {
                setSelectedItem(it)
                setIsItemModalOpen(true)
              }}
              t={t}
            />
            <MealSection
              title={t('pages.myDay.dinner')}
              items={daily.dinner}
              photoUrl={daily.dinnerPhotoUrl}
              onItemClick={it => {
                setSelectedItem(it)
                setIsItemModalOpen(true)
              }}
              t={t}
            />
            <MealSection
              title={t('pages.myDay.snack')}
              items={daily.snack}
              photoUrl={daily.snackPhotoUrl}
              onItemClick={it => {
                setSelectedItem(it)
                setIsItemModalOpen(true)
              }}
              t={t}
            />
          </div>

          {/* Exercises */}
          <div className={`${glassCardClass} p-6`}>
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg font-semibold text-gray-900">
                {t('pages.myDay.exercise')}
              </h3>
              {daily.exerciseCalories > 0 ? (
                <span className="text-sm text-gray-600">
                  {t('pages.myDay.total')}: {Math.round(daily.exerciseCalories)}{' '}
                  kcal
                </span>
              ) : null}
            </div>
            {Array.isArray(daily.exercises) && daily.exercises.length > 0 ? (
              <ul className="space-y-2">
                {daily.exercises.map((ex, idx) => (
                  <ItemCard
                    key={idx}
                    it={ex}
                    onClick={it => {
                      setSelectedItem(it)
                      setIsItemModalOpen(true)
                    }}
                  />
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500">
                {t('pages.myDay.noExercises')}
              </p>
            )}
          </div>

          {/* Water Intake */}
          <div className={`${glassCardClass} p-6`}>
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg font-semibold text-gray-900">
                {t('pages.myDay.waterIntake')}
              </h3>
              <span className="text-sm text-gray-600">
                {t('pages.myDay.total')}: {Math.round(daily.waterTotalMl || 0)}{' '}
                ml
              </span>
            </div>
            {Array.isArray(daily.waterEntries) &&
            daily.waterEntries.length > 0 ? (
              <ul className="space-y-2">
                {daily.waterEntries.map((we, idx) => (
                  <li key={idx} className="flex justify-between text-sm">
                    <span className="text-gray-800 truncate">
                      {we?.label || t('pages.myDay.water')}
                    </span>
                    <span className="text-gray-500">
                      {Math.round(we?.quantity || we?.ml || 0)} ml
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500">
                {t('pages.myDay.noWater')}
              </p>
            )}
          </div>

          {/* Assigned Menu */}
          <div className={`${glassCardClass} p-6`}>
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg font-semibold text-gray-900">
                {t('pages.myDay.assignedMenu')}
              </h3>
              {daily.menuForDay?.name ? (
                <span className="text-sm text-gray-600">
                  {daily.menuForDay.name}
                </span>
              ) : null}
            </div>
            {daily.menuForDay ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    'breakfastPlan',
                    'lunchPlan',
                    'dinnerPlan',
                    'snackPlan'
                  ].map(mealKey => {
                    const labelMap = {
                      breakfastPlan: t('pages.myDay.breakfastMenu'),
                      lunchPlan: t('pages.myDay.lunchMenu'),
                      dinnerPlan: t('pages.myDay.dinnerMenu'),
                      snackPlan: t('pages.myDay.snackMenu')
                    }
                    const items = daily.menuForDay?.[mealKey] || []
                    // Compute adjusted per-item display like Menus Selected Items
                    const renderedItems = items.map(it => {
                      const isRecipeItem = detectIsRecipe(it)
                      const servingOptions = Array.isArray(it?.serving)
                        ? it.serving
                        : []
                      // Determine originalServingAmount similar to Menus
                      let originalServingAmount = it?.originalServingAmount
                      if (!originalServingAmount && servingOptions.length > 0) {
                        if (isRecipeItem) {
                          const portionServing = servingOptions.find(
                            s => s.profileId === 1
                          )
                          if (portionServing) {
                            const numberOfServings =
                              it?.numberOfServings || it?.originalServings || 1
                            originalServingAmount =
                              portionServing.amount * numberOfServings
                          } else {
                            const totalWeight =
                              it?.totalNutrients?.totalQuantity ||
                              it?.totalNutrients?.weightAfterCooking ||
                              null
                            if (totalWeight) {
                              originalServingAmount = totalWeight
                            } else {
                              const def = findDefaultServing(servingOptions)
                              const numberOfServings =
                                it?.numberOfServings ||
                                it?.originalServings ||
                                1
                              originalServingAmount =
                                (def?.amount || 100) * numberOfServings
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

                      const calc = calculateDisplayValues(
                        it,
                        selectedAmount,
                        originalServingAmount
                      )
                      const adjCalories = calc.calories
                      const adjNutrients = calc.nutrients
                      return { it, adjCalories, adjNutrients }
                    })

                    const totals = renderedItems.reduce(
                      (acc, r) => {
                        const n = safeNutrients(r.adjNutrients)
                        return {
                          calories: acc.calories + (r.adjCalories || 0),
                          proteinsInGrams:
                            acc.proteinsInGrams + n.proteinsInGrams,
                          carbohydratesInGrams:
                            acc.carbohydratesInGrams + n.carbohydratesInGrams,
                          fatInGrams: acc.fatInGrams + n.fatInGrams
                        }
                      },
                      {
                        calories: 0,
                        proteinsInGrams: 0,
                        carbohydratesInGrams: 0,
                        fatInGrams: 0
                      }
                    )

                    return (
                      <div
                        key={mealKey}
                        className="rounded-lg border border-white/20 bg-white/10 backdrop-blur-sm"
                      >
                        <div className="px-3 py-2 bg-white/10 border-b border-white/15 text-sm font-medium text-gray-700">
                          {labelMap[mealKey]}
                        </div>
                        <div className="p-3 space-y-2">
                          {renderedItems.length === 0 && (
                            <div className="text-sm text-gray-500">
                              {t('pages.myDay.noItemsMenu')}
                            </div>
                          )}
                          {renderedItems.map((r, i) => (
                            <div
                              key={i}
                              className="p-2 rounded bg-white/40 backdrop-blur-sm shadow-sm"
                            >
                              <div className="flex items-start justify-between">
                                <div className="min-w-0">
                                  <div className="text-sm font-medium text-gray-900 truncate">
                                    {r.it?.name ||
                                      r.it?.title ||
                                      r.it?.food?.name ||
                                      t('pages.myDay.unnamed')}
                                  </div>
                                  <div className="text-xs text-gray-500 truncate">
                                    {detectIsRecipe(r.it)
                                      ? t('pages.myDay.recipe')
                                      : t('pages.myDay.food')}
                                  </div>
                                </div>
                              </div>
                              <div className="mt-1 text-xs text-gray-600">
                                <span className="font-medium">Calories:</span>{' '}
                                {Math.round(r.adjCalories || 0)}
                                <span className="mx-2">|</span>
                                <span className="font-medium">
                                  Proteins:
                                </span>{' '}
                                {Math.round(
                                  Number(r.adjNutrients?.proteinsInGrams) || 0
                                )}{' '}
                                g<span className="mx-2">|</span>
                                <span className="font-medium">Carbs:</span>{' '}
                                {Math.round(
                                  Number(
                                    r.adjNutrients?.carbohydratesInGrams
                                  ) || 0
                                )}{' '}
                                g<span className="mx-2">|</span>
                                <span className="font-medium">Fat:</span>{' '}
                                {Math.round(
                                  Number(r.adjNutrients?.fatInGrams) || 0
                                )}{' '}
                                g
                              </div>
                            </div>
                          ))}
                          {renderedItems.length > 0 && (
                            <div className="mt-2 p-2 bg-indigo-500/10 border border-indigo-300/30 rounded text-xs text-indigo-900">
                              <span className="font-medium">
                                {t('pages.myDay.subtotal')}:
                              </span>
                              <span className="ml-1">
                                {Math.round(totals.calories)} cal
                              </span>
                              <span className="mx-2">|</span>
                              <span>
                                P {Math.round(totals.proteinsInGrams)} g
                              </span>
                              <span className="mx-2">|</span>
                              <span>
                                C {Math.round(totals.carbohydratesInGrams)} g
                              </span>
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
                  const computeTotalsFor = items => {
                    const arr = items || []
                    return arr.reduce(
                      (acc, it) => {
                        const isRecipeItem = detectIsRecipe(it)
                        const servingOptions = Array.isArray(it?.serving)
                          ? it.serving
                          : []
                        let originalServingAmount = it?.originalServingAmount
                        if (
                          !originalServingAmount &&
                          servingOptions.length > 0
                        ) {
                          if (isRecipeItem) {
                            const portionServing = servingOptions.find(
                              s => s.profileId === 1
                            )
                            if (portionServing) {
                              const numberOfServings =
                                it?.numberOfServings ||
                                it?.originalServings ||
                                1
                              originalServingAmount =
                                portionServing.amount * numberOfServings
                            } else {
                              const totalWeight =
                                it?.totalNutrients?.totalQuantity ||
                                it?.totalNutrients?.weightAfterCooking ||
                                null
                              if (totalWeight)
                                originalServingAmount = totalWeight
                              else {
                                const def = findDefaultServing(servingOptions)
                                const numberOfServings =
                                  it?.numberOfServings ||
                                  it?.originalServings ||
                                  1
                                originalServingAmount =
                                  (def?.amount || 100) * numberOfServings
                              }
                            }
                          } else {
                            const def = findDefaultServing(servingOptions)
                            originalServingAmount = def?.amount || 100
                          }
                        }
                        originalServingAmount = originalServingAmount || 100
                        let selectedAmount = originalServingAmount
                        if (it?.changedServing?.value)
                          selectedAmount = it.changedServing.value
                        const calc = calculateDisplayValues(
                          it,
                          selectedAmount,
                          originalServingAmount
                        )
                        const n = safeNutrients(calc.nutrients)
                        return {
                          calories: acc.calories + (calc.calories || 0),
                          proteinsInGrams:
                            acc.proteinsInGrams + n.proteinsInGrams,
                          carbohydratesInGrams:
                            acc.carbohydratesInGrams + n.carbohydratesInGrams,
                          fatInGrams: acc.fatInGrams + n.fatInGrams
                        }
                      },
                      {
                        calories: 0,
                        proteinsInGrams: 0,
                        carbohydratesInGrams: 0,
                        fatInGrams: 0
                      }
                    )
                  }

                  const bp = computeTotalsFor(daily.menuForDay?.breakfastPlan)
                  const lp = computeTotalsFor(daily.menuForDay?.lunchPlan)
                  const dp = computeTotalsFor(daily.menuForDay?.dinnerPlan)
                  const sp = computeTotalsFor(daily.menuForDay?.snackPlan)
                  const total = {
                    calories:
                      bp.calories + lp.calories + dp.calories + sp.calories,
                    proteinsInGrams:
                      bp.proteinsInGrams +
                      lp.proteinsInGrams +
                      dp.proteinsInGrams +
                      sp.proteinsInGrams,
                    carbohydratesInGrams:
                      bp.carbohydratesInGrams +
                      lp.carbohydratesInGrams +
                      dp.carbohydratesInGrams +
                      sp.carbohydratesInGrams,
                    fatInGrams:
                      bp.fatInGrams +
                      lp.fatInGrams +
                      dp.fatInGrams +
                      sp.fatInGrams
                  }
                  return (
                    <div className="space-y-2">
                      <div className="p-3 bg-emerald-500/10 border border-emerald-300/30 rounded text-sm text-emerald-900">
                        <span className="font-semibold">
                          {t('pages.myDay.menuTotals')}:
                        </span>
                        <span className="ml-2">
                          {Math.round(total.calories)} cal
                        </span>
                        <span className="mx-2">|</span>
                        <span>P {Math.round(total.proteinsInGrams)} g</span>
                        <span className="mx-2">|</span>
                        <span>
                          C {Math.round(total.carbohydratesInGrams)} g
                        </span>
                        <span className="mx-2">|</span>
                        <span>F {Math.round(total.fatInGrams)} g</span>
                      </div>
                    </div>
                  )
                })()}
              </div>
            ) : (
              <p className="text-sm text-gray-500">
                {t('pages.myDay.noMenuAssigned')}
              </p>
            )}
          </div>
        </>
      )}

      {/* Item detail modal */}
      {isItemModalOpen && selectedItem && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className={`${glassCardClass} w-full max-w-md p-6`}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-white truncate">
                {getItemDisplay(selectedItem)}
              </h3>
              <button
                className="text-gray-300 hover:text-white cursor-pointer"
                onClick={() => setIsItemModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <div className="flex items-start gap-4 mb-4">
              <div className="w-16 h-16 rounded bg-white/40 backdrop-blur-sm flex items-center justify-center overflow-hidden">
                {selectedItem?.food?.photoUrl ||
                selectedItem?.exercise?.photoUrl ||
                selectedItem?.photoUrl ||
                selectedItemFallbackImg ? (
                  <img
                    src={
                      selectedItem?.food?.photoUrl ||
                      selectedItem?.exercise?.photoUrl ||
                      selectedItem?.photoUrl ||
                      selectedItemFallbackImg
                    }
                    alt="thumb"
                    className="w-16 h-16 object-cover"
                  />
                ) : (
                  <span className="text-xs text-gray-300">
                    {selectedItem?.food?.category ||
                      (selectedItem?.exercise ? 'exercise' : 'food')}
                  </span>
                )}
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-200 mb-1">
                  {t('pages.myDay.calories')}
                </p>
                <p className="text-xl font-semibold text-white">
                  {getItemCalories(selectedItem)} kcal
                </p>
                {selectedItem?.unit && (
                  <p className="text-xs text-gray-300 mt-1">
                    {t('pages.myDay.unit')}: {selectedItem.unit}
                  </p>
                )}
                {selectedItem?.quantity && (
                  <p className="text-xs text-gray-300">
                    {t('pages.myDay.quantity')}: {selectedItem.quantity}
                  </p>
                )}
              </div>
            </div>

            {/* Nutrients for food */}
            {selectedItem?.food?.totalNutrients && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-gray-300">
                    {t('pages.myDay.protein')}
                  </p>
                  <p className="text-sm font-medium text-white">
                    {selectedItem.food.totalNutrients.proteinsInGrams || 0} g
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-300">
                    {t('pages.myDay.carbs')}
                  </p>
                  <p className="text-sm font-medium text-white">
                    {selectedItem.food.totalNutrients.carbohydratesInGrams || 0}{' '}
                    g
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-300">
                    {t('pages.myDay.fat')}
                  </p>
                  <p className="text-sm font-medium text-white">
                    {selectedItem.food.totalNutrients.fatInGrams || 0} g
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-300">Fiber</p>
                  <p className="text-sm font-medium text-white">
                    {selectedItem.food.totalNutrients.fibreInGrams || 0} g
                  </p>
                </div>
              </div>
            )}

            {/* Exercise details */}
            {selectedItem?.exercise && (
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-gray-300">
                    {t('pages.myDay.duration')}
                  </p>
                  <p className="text-sm font-medium text-white">
                    {selectedItem.exercise.durationInMinutes ||
                      selectedItem.quantity ||
                      0}{' '}
                    {t('pages.myDay.min')}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-300">
                    {t('pages.myDay.burned')}
                  </p>
                  <p className="text-sm font-medium text-white">
                    {selectedItem.exercise.caloriesBurnt || 0} kcal
                  </p>
                </div>
              </div>
            )}

            <div className="mt-6 flex justify-end">
              <button
                className="btn-secondary px-4 py-2"
                onClick={() => setIsItemModalOpen(false)}
              >
                {t('pages.myDay.close')}
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
function CalorieCircle({ totalGoal, eaten, burned, t }) {
  const remaining = (totalGoal || 0) - (eaten || 0) + (burned || 0)
  const percentage =
    totalGoal > 0
      ? Math.max(
          0,
          Math.min(100, Math.round(100 - (remaining / totalGoal) * 100))
        )
      : 0
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
        <circle
          cx="50"
          cy="50"
          r="45"
          stroke="#e5e7eb"
          strokeWidth="8"
          fill="none"
        />
        <circle
          cx="50"
          cy="50"
          r="45"
          stroke={color}
          strokeWidth="8"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${Math.max(0, Math.min(100, percentage))} ${100 - Math.max(0, Math.min(100, percentage))}`}
          transform="rotate(-90 50 50)"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <p className="text-2xl font-semibold" style={{ color }}>
          {Math.round(remaining || 0)}
        </p>
        <p className="text-xs text-gray-600">
          {t('pages.myDay.kcalRemaining')}
        </p>
      </div>
    </div>
  )
}
