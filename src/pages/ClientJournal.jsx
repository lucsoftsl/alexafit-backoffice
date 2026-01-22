import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  getDailyNutrition,
  getUserData,
  getUserCaloriesHistory
} from '../services/loggedinApi'
import LZString from 'lz-string'
import { sumTotalsByMealsApplied } from '../util/menuDisplay'
import { getCategoryIcon } from '../util/categoryIcons'

// Date helpers that operate in local time to avoid UTC shifts
const formatLocalISO = date => {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
const todayISO = () => formatLocalISO(new Date())
const toISO = d => {
  if (!d) return ''
  if (typeof d === 'string') return d.slice(0, 10)
  return formatLocalISO(d)
}
const addDays = (dateStr, days) => {
  const [y, m, d] = String(dateStr).split('-').map(Number)
  const dt = new Date(y, (m || 1) - 1, d || 1)
  dt.setDate(dt.getDate() + (Number(days) || 0))
  return formatLocalISO(dt)
}
const startOfWeekMonday = date => {
  const d = new Date(date)
  const day = (d.getDay() + 6) % 7 // Monday=0
  d.setDate(d.getDate() - day)
  d.setHours(0, 0, 0, 0)
  return d
}

const Progress = ({ percent }) => (
  <div className="w-full h-2 bg-gray-200 rounded">
    <div
      className="h-2 bg-blue-600 rounded"
      style={{ width: `${Math.max(0, Math.min(100, percent))}%` }}
    />
  </div>
)

const MacroCard = ({ label, value, unit = '', goal, t }) => {
  const pct = goal ? Math.round(((value || 0) / goal) * 100) : null
  return (
    <div className="p-3 bg-gray-50 rounded-lg">
      <div className="flex justify-between items-baseline">
        <p className="text-xs text-gray-500">{label}</p>
        {goal ? (
          <p className="text-xs text-gray-400">
            {t('pages.clientJournal.goal')}: {goal}
            {unit}
          </p>
        ) : null}
      </div>
      <p className="text-lg font-semibold text-gray-900">
        {value}
        {unit}
      </p>
      {pct !== null && (
        <div className="mt-1">
          <Progress percent={pct} />
          <p className="text-xs text-gray-500 mt-1">{pct}%</p>
        </div>
      )}
    </div>
  )
}

const getItemDisplay = it => {
  if (it?.food?.name) return it.food.name
  if (it?.exercise?.name) return it.exercise.name
  return it?.name || it?.foodName || 'Item'
}

const getItemCalories = it => {
  if (it?.food?.totalCalories) return Math.round(it.food.totalCalories)
  if (typeof it?.calories === 'number') return Math.round(it.calories)
  if (it?.exercise?.caloriesBurnt) return Math.round(it.exercise.caloriesBurnt)
  return Math.round(it?.totalCalories || 0)
}

const ItemRow = ({ it, t }) => {
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
    <div className="flex justify-between items-center p-2 rounded hover:bg-gray-50">
      <div className="flex items-center gap-2 overflow-hidden">
        <div className="w-8 h-8 rounded bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0">
          {img ? (
            <img src={img} alt={name} className="w-8 h-8 object-cover" />
          ) : (
            <span className="text-xs text-gray-400">
              {category || t('pages.clientJournal.item')}
            </span>
          )}
        </div>
        <span className="text-sm text-gray-800 truncate">{name}</span>
      </div>
      <span className="text-sm text-gray-500 ml-2">
        {kcal} {t('pages.clientJournal.kcal')}
      </span>
    </div>
  )
}

const MealSection = ({ title, items = [], photoUrl, t }) => (
  <div className="border border-gray-200 rounded-lg p-3 bg-white shadow-sm">
    <div className="flex justify-between items-center mb-2">
      <h4 className="text-sm font-semibold text-gray-900">{title}</h4>
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
          <ItemRow key={idx} it={it} t={t} />
        ))}
      </div>
    ) : (
      <p className="text-xs text-gray-500">
        {t('pages.clientJournal.noItems')}
      </p>
    )}
  </div>
)

const ClientJournal = ({ client }) => {
  const { t } = useTranslation()
  const [showCalendar, setShowCalendar] = useState(true)
  const [selectedDate, setSelectedDate] = useState(null)
  const [markedDates, setMarkedDates] = useState({})
  const [currentMonth, setCurrentMonth] = useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })
  const [currentWeekStart, setCurrentWeekStart] = useState(() =>
    startOfWeekMonday(new Date())
  )
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
    waterEntries: []
  })
  const [macroTotals, setMacroTotals] = useState({
    calories: 0,
    proteinsInGrams: 0,
    carbohydratesInGrams: 0,
    fatInGrams: 0
  })
  const lastFetchKeyRef = useRef('')
  const caloriesHistoryLoadedRef = useRef(new Set())

  const userId = useMemo(
    () => (Array.isArray(client?.userId) ? client.userId[0] : client?.userId),
    [client]
  )
  const userName = useMemo(
    () => client?.userData?.name || client?.loginDetails?.displayName || 'User',
    [client]
  )

  const dateLabel = useMemo(() => {
    try {
      if (!selectedDate) return ''
      const [y, m, d] = String(selectedDate).split('-').map(Number)
      const dt = new Date(y, (m || 1) - 1, d || 1)
      return dt.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
    } catch {
      return selectedDate || ''
    }
  }, [selectedDate])

  // Fetch calendar marked dates (days with data) with localStorage cache
  useEffect(() => {
    if (!userId) return

    // Bump cache key to v2 after fixing local/UTC date shift
    const cacheKey = `userCaloriesHistory_v2_${userId}`

    const transform = (list = []) => {
      const map = {}
      list.forEach(item => {
        const dateApplied = item?.dateApplied
        const consumed = Number(
          item?.caloriesConsumed || item?.totalCalories || 0
        )
        const goal = Number(item?.caloriesGoal || item?.goalCalories || 0)
        const color = getColor(consumed, goal)
        if (dateApplied) {
          map[dateApplied] = {
            color,
            hasData: true,
            caloriesConsumed: consumed,
            caloriesGoal: goal
          }
        }
      })
      const today = todayISO()
      if (!map[today]) {
        map[today] = { color: '#6366F1', hasData: false }
      }
      return map
    }

    // 1) Load from cache immediately to avoid flicker
    try {
      const cached =
        LZString.decompressFromUTF16(localStorage.getItem(cacheKey)) ||
        localStorage.getItem(cacheKey)
      if (cached) {
        const parsed = JSON.parse(cached)
        if (parsed && typeof parsed === 'object') {
          setMarkedDates(parsed)
        }
      }
    } catch (err) {
      // noop: cache read failure shouldn't block
      console.warn('Calories history cache read failed', err)
    }

    // 2) Update cache and UI in background
    ;(async () => {
      try {
        // Avoid duplicate requests in React 18 StrictMode/dev double-effect
        if (caloriesHistoryLoadedRef.current.has(userId)) {
          return
        }
        caloriesHistoryLoadedRef.current.add(userId)
        const res = await getUserCaloriesHistory({ userId })
        const list = res?.data?.data || res?.data || res || []
        const map = transform(list)
        try {
          const compressed = LZString.compressToUTF16(JSON.stringify(map))
          localStorage.setItem(cacheKey, compressed)
        } catch (_) {
          /* ignore quota errors */
        }
        setMarkedDates(map)
      } catch (e) {
        console.error('Failed to update calories history', e)
      }
    })()
  }, [userId])

  useEffect(() => {
    const loadDay = async () => {
      if (!userId) return
      if (!selectedDate || showCalendar) return
      const fetchKey = `${userId}-${selectedDate}`
      if (lastFetchKeyRef.current === fetchKey) return
      lastFetchKeyRef.current = fetchKey
      setLoading(true)
      setError(null)
      try {
        const [dailyRes, userRes] = await Promise.all([
          // Pass the selectedDate string directly; it's already local ISO (YYYY-MM-DD)
          getDailyNutrition({ userId, dateApplied: selectedDate }),
          getUserData({ userId, selectedDate })
        ])
        const dWrap = dailyRes?.data || dailyRes || {}
        const uWrap = userRes?.data || userRes || {}
        const d = dWrap?.data || {}
        const u = uWrap?.data || {}
        const userGoals = u?.userGoals || {}
        const waterEntries = Array.isArray(d?.water) ? d.water : []
        const waterTotalMl = waterEntries.reduce(
          (acc, e) => acc + (Number(e?.quantity) || 0),
          0
        )

        setDaily({
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
          waterEntries
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
      } catch (e) {
        setError(e?.message || 'Failed to load daily nutrition')
      } finally {
        setLoading(false)
      }
    }

    loadDay()
  }, [selectedDate, userId, showCalendar])

  // Keep week view aligned with selected date
  useEffect(() => {
    if (!selectedDate) return
    setCurrentWeekStart(startOfWeekMonday(selectedDate))
  }, [selectedDate])

  const prevMonth = () => {
    setCurrentMonth(prev => {
      const y = prev.getFullYear()
      const m = prev.getMonth()
      return new Date(y, m - 1, 1)
    })
  }
  const nextMonth = () => {
    setCurrentMonth(prev => {
      const y = prev.getFullYear()
      const m = prev.getMonth()
      return new Date(y, m + 1, 1)
    })
  }
  const prevWeek = () => {
    setCurrentWeekStart(prev => {
      const d = new Date(prev)
      d.setDate(d.getDate() - 7)
      return startOfWeekMonday(d)
    })
  }
  const nextWeek = () => {
    setCurrentWeekStart(prev => {
      const d = new Date(prev)
      d.setDate(d.getDate() + 7)
      return startOfWeekMonday(d)
    })
  }

  const CalendarGrid = ({ month, marked, onSelect }) => {
    const year = month.getFullYear()
    const mon = month.getMonth()
    const start = new Date(year, mon, 1)
    const daysInMonth = new Date(year, mon + 1, 0).getDate()
    // Shift so Monday=0, Sunday=6
    const firstWeekday = (start.getDay() + 6) % 7
    const weeks = []
    let dayNum = 1
    for (let w = 0; w < 6; w++) {
      const days = []
      for (let d = 0; d < 7; d++) {
        const cellIndex = w * 7 + d
        if (cellIndex < firstWeekday || dayNum > daysInMonth) {
          days.push(null)
        } else {
          const iso = formatLocalISO(new Date(year, mon, dayNum))
          const isToday = iso === todayISO()
          const isMarked = !!marked[iso]
          const markColor = marked[iso]?.color || '#10B981'
          days.push({ num: dayNum, iso, isToday, isMarked, markColor })
          dayNum++
        }
      }
      weeks.push(days)
    }
    const monthLabel = month.toLocaleDateString(undefined, {
      month: 'long',
      year: 'numeric'
    })
    return (
      <div className="w-full">
        <div className="flex items-center justify-between mb-4">
          <button
            className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
            onClick={prevMonth}
          >
            {t('pages.clientJournal.prev')}
          </button>
          <h2 className="text-xl font-semibold text-gray-900">{monthLabel}</h2>
          <button
            className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
            onClick={nextMonth}
          >
            {t('pages.clientJournal.next')}
          </button>
        </div>
        <div className="grid grid-cols-7 gap-2 text-xs text-gray-500 mb-2">
          {[
            t('pages.clientJournal.mon'),
            t('pages.clientJournal.tue'),
            t('pages.clientJournal.wed'),
            t('pages.clientJournal.thu'),
            t('pages.clientJournal.fri'),
            t('pages.clientJournal.sat'),
            t('pages.clientJournal.sun')
          ].map((d, idx) => (
            <div key={idx} className="text-center">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-2">
          {weeks.map((row, ri) => (
            <>
              {row.map((cell, ci) =>
                cell ? (
                  <button
                    key={`${ri}-${ci}`}
                    onClick={() => {
                      onSelect(cell.iso)
                      setShowCalendar(false)
                    }}
                    className={`relative aspect-square rounded-md border ${cell.isToday ? 'border-indigo-400' : 'border-gray-200'} hover:bg-gray-50 flex items-center justify-center`}
                  >
                    <span className="text-sm text-gray-800">{cell.num}</span>
                    {cell.isMarked &&
                      (() => {
                        const consumed = marked[cell.iso]?.caloriesConsumed || 0
                        const goal = marked[cell.iso]?.caloriesGoal || 0
                        const color = cell.markColor
                        const pillClasses =
                          color === '#EF4444'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : color === '#10B981'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : color === '#F59E0B'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                        return (
                          <div className="absolute inset-x-1 bottom-1">
                            <div
                              className={`w-full rounded-full px-1.5 py-1 shadow-sm border text-center flex items-center justify-center gap-1 ${pillClasses}`}
                            >
                              <span
                                className="w-1.5 h-1.5 rounded-full"
                                style={{ backgroundColor: color }}
                              ></span>
                              <span className="text-[10px] font-semibold leading-tight">
                                {consumed} / {goal || '-'}{' '}
                                {t('pages.clientJournal.kcal')}
                              </span>
                            </div>
                          </div>
                        )
                      })()}
                  </button>
                ) : (
                  <div
                    key={`${ri}-${ci}`}
                    className="aspect-square rounded-md border border-transparent"
                  />
                )
              )}
            </>
          ))}
        </div>
      </div>
    )
  }

  const WeekGrid = ({ weekStart, marked, onSelect }) => {
    const days = Array.from({ length: 7 }).map((_, idx) => {
      const date = new Date(weekStart)
      date.setDate(date.getDate() + idx)
      const iso = formatLocalISO(date)
      const isToday = iso === todayISO()
      const isMarked = !!marked[iso]
      const markColor = marked[iso]?.color || '#10B981'
      return {
        iso,
        isToday,
        isMarked,
        markColor,
        num: date.getDate(),
        label: date.toLocaleDateString(undefined, { weekday: 'short' })
      }
    })
    const weekLabel = `${weekStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - ${addDays(formatLocalISO(weekStart), 6)}`
    return (
      <div className="w-full">
        <div className="flex items-center justify-between mb-3">
          <button
            className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
            onClick={prevWeek}
          >
            {t('pages.clientJournal.prev')}
          </button>
          <div className="text-center">
            <p className="text-xs text-gray-500">
              {t('pages.clientJournal.week')}
            </p>
            <h2 className="text-lg font-semibold text-gray-900">{weekLabel}</h2>
          </div>
          <button
            className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
            onClick={nextWeek}
          >
            {t('pages.clientJournal.next')}
          </button>
        </div>
        <div className="grid grid-cols-3 gap-3 justify-items-center">
          {days.map((day, idx) => (
            <button
              key={idx}
              onClick={() => {
                onSelect(day.iso)
                setShowCalendar(false)
              }}
              className={`relative w-full max-w-[110px] aspect-square rounded-lg border ${day.isToday ? 'border-indigo-400' : 'border-gray-200'} bg-white hover:bg-gray-50 flex flex-col items-center justify-center gap-1 shadow-sm`}
            >
              <span className="text-xs text-gray-500">{day.label}</span>
              <span className="text-base font-semibold text-gray-800">
                {day.num}
              </span>
              {day.isMarked &&
                (() => {
                  const consumed = marked[day.iso]?.caloriesConsumed || 0
                  const goal = marked[day.iso]?.caloriesGoal || 0
                  const color = day.markColor
                  const pillClasses =
                    color === '#EF4444'
                      ? 'bg-rose-50 text-rose-700 border border-rose-200'
                      : color === '#10B981'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : color === '#F59E0B'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                  return (
                    <div
                      className={`w-full rounded-full px-1.5 py-1 shadow-sm border text-center flex items-center justify-center gap-1 ${pillClasses}`}
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: color }}
                      ></span>
                      <span className="text-[10px] font-semibold leading-tight">
                        {consumed} / {goal || '-'}{' '}
                        {t('pages.clientJournal.kcal')}
                      </span>
                    </div>
                  )
                })()}
            </button>
          ))}
        </div>
      </div>
    )
  }

  function getColor(consumed, goal) {
    if (!goal || goal <= 0) return '#6366F1' // indigo for unknown goal
    const pct = consumed / goal
    if (pct >= 1.1) return '#EF4444' // red: exceeded by >10%
    if (pct >= 0.9 && pct <= 1.1) return '#10B981' // green: within ±10%
    return '#F59E0B' // amber: under goal
  }

  if (!client) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          {t('pages.clientJournal.title')}
        </h2>
        <p className="text-gray-600">{t('pages.clientJournal.selectPrompt')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {t('pages.clientJournal.title')}
          </h1>
          <p className="text-gray-600 mt-1">{userName}</p>
        </div>
        {!showCalendar ? (
          <div className="flex items-center gap-2">
            <button
              className="px-3 py-1.5 text-sm rounded-md bg-indigo-600 text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 transition"
              onClick={() => setShowCalendar(true)}
            >
              {t('pages.clientJournal.backToCalendar')}
            </button>
          </div>
        ) : null}
      </div>

      {showCalendar ? (
        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm min-h-[60vh] flex items-center justify-center">
          <div className="w-full max-w-3xl hidden md:block">
            <CalendarGrid
              month={currentMonth}
              marked={markedDates}
              onSelect={iso => setSelectedDate(iso)}
            />
          </div>
          <div className="w-full max-w-xl md:hidden">
            <WeekGrid
              weekStart={currentWeekStart}
              marked={markedDates}
              onSelect={iso => setSelectedDate(iso)}
            />
          </div>
        </div>
      ) : (
        <>
          <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs text-gray-500">
                  {t('pages.clientJournal.selectedDay')}
                </p>
                <p className="text-lg font-semibold text-gray-900">
                  {dateLabel}
                </p>
              </div>
              {loading && (
                <span className="text-sm text-gray-500">
                  {t('pages.clientJournal.loading')}
                </span>
              )}
              {error && <span className="text-sm text-red-600">{error}</span>}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <MacroCard
                t={t}
                label="Calories"
                value={macroTotals.calories || 0}
                unit=" kcal"
                goal={Math.round(daily.goals.calories || 0)}
              />
              <MacroCard
                t={t}
                label="Protein"
                value={macroTotals.proteinsInGrams || 0}
                unit=" g"
                goal={Math.round(daily.goals.protein || 0)}
              />
              <MacroCard
                t={t}
                label="Carbs"
                value={macroTotals.carbohydratesInGrams || 0}
                unit=" g"
                goal={Math.round(daily.goals.carbs || 0)}
              />
              <MacroCard
                t={t}
                label="Fat"
                value={macroTotals.fatInGrams || 0}
                unit=" g"
                goal={Math.round(daily.goals.fat || 0)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <MealSection
              t={t}
              title={t('pages.clientJournal.breakfast')}
              items={daily.breakfast}
              photoUrl={daily.breakfastPhotoUrl}
            />
            <MealSection
              t={t}
              title={t('pages.clientJournal.lunch')}
              items={daily.lunch}
              photoUrl={daily.lunchPhotoUrl}
            />
            <MealSection
              t={t}
              title={t('pages.clientJournal.dinner')}
              items={daily.dinner}
              photoUrl={daily.dinnerPhotoUrl}
            />
            <MealSection
              t={t}
              title={t('pages.clientJournal.snack')}
              items={daily.snack}
              photoUrl={daily.snackPhotoUrl}
            />
          </div>

          {Array.isArray(daily.exercises) && daily.exercises.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-sm font-semibold text-gray-900">
                  {t('pages.clientJournal.exercise')}
                </h3>
                <span className="text-xs text-gray-600">
                  Total: {Math.round(daily.exerciseCalories)}{' '}
                  {t('pages.clientJournal.kcal')}
                </span>
              </div>
              <div className="space-y-1">
                {daily.exercises.map((ex, idx) => (
                  <ItemRow key={idx} it={ex} t={t} />
                ))}
              </div>
            </div>
          )}

          {Array.isArray(daily.waterEntries) &&
            daily.waterEntries.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-sm font-semibold text-gray-900">
                    {t('pages.clientJournal.waterIntake')}
                  </h3>
                  <span className="text-xs text-gray-600">
                    Total: {Math.round(daily.waterTotalMl || 0)} ml
                  </span>
                </div>
                <div className="space-y-1">
                  {daily.waterEntries.map((we, idx) => (
                    <div key={idx} className="flex justify-between text-sm p-2">
                      <span className="text-gray-800">
                        {we?.label || t('pages.clientJournal.water')}
                      </span>
                      <span className="text-gray-500">
                        {Math.round(we?.quantity || we?.ml || 0)} ml
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

          {/* Shareable Summary */}
          {(() => {
            // Build a copy-ready summary text
            const lines = []
            lines.push(`📅 Date: ${dateLabel || selectedDate}`)
            lines.push(`👤 User: ${userName}`)
            lines.push('')

            // User Goals
            lines.push('🎯 Daily Goals:')
            lines.push(
              `  • Calories: ${Math.round(daily.goals.calories || 0)} kcal`
            )
            lines.push(`  • Protein: ${Math.round(daily.goals.protein || 0)}g`)
            lines.push(`  • Carbs: ${Math.round(daily.goals.carbs || 0)}g`)
            lines.push(`  • Fat: ${Math.round(daily.goals.fat || 0)}g`)
            lines.push('')

            // Actual Intake
            lines.push('📊 Actual Intake:')
            lines.push(`  • Calories: ${macroTotals.calories || 0} kcal`)
            lines.push(`  • Protein: ${macroTotals.proteinsInGrams || 0}g`)
            lines.push(`  • Carbs: ${macroTotals.carbohydratesInGrams || 0}g`)
            lines.push(`  • Fat: ${macroTotals.fatInGrams || 0}g`)
            lines.push('')

            // Progress percentages
            const caloriesPct =
              daily.goals.calories > 0
                ? Math.round(
                    (macroTotals.calories / daily.goals.calories) * 100
                  )
                : 0
            const proteinPct =
              daily.goals.protein > 0
                ? Math.round(
                    (macroTotals.proteinsInGrams / daily.goals.protein) * 100
                  )
                : 0
            const carbsPct =
              daily.goals.carbs > 0
                ? Math.round(
                    (macroTotals.carbohydratesInGrams / daily.goals.carbs) * 100
                  )
                : 0
            const fatPct =
              daily.goals.fat > 0
                ? Math.round((macroTotals.fatInGrams / daily.goals.fat) * 100)
                : 0

            lines.push('📈 Goal Progress:')
            lines.push(`  • Calories: ${caloriesPct}%`)
            lines.push(`  • Protein: ${proteinPct}%`)
            lines.push(`  • Carbs: ${carbsPct}%`)
            lines.push(`  • Fat: ${fatPct}%`)
            lines.push('')

            // Meals breakdown
            if (daily.breakfast?.length > 0) {
              lines.push('🍳 BREAKFAST:')
              daily.breakfast.forEach(item => {
                const name = getItemDisplay(item)
                const kcal = getItemCalories(item)
                lines.push(`  • ${name}: ${kcal} kcal`)
              })
              lines.push('')
            }

            if (daily.lunch?.length > 0) {
              lines.push('🍱 LUNCH:')
              daily.lunch.forEach(item => {
                const name = getItemDisplay(item)
                const kcal = getItemCalories(item)
                lines.push(`  • ${name}: ${kcal} kcal`)
              })
              lines.push('')
            }

            if (daily.dinner?.length > 0) {
              lines.push('🍽️ DINNER:')
              daily.dinner.forEach(item => {
                const name = getItemDisplay(item)
                const kcal = getItemCalories(item)
                lines.push(`  • ${name}: ${kcal} kcal`)
              })
              lines.push('')
            }

            if (daily.snack?.length > 0) {
              lines.push('🍿 SNACKS:')
              daily.snack.forEach(item => {
                const name = getItemDisplay(item)
                const kcal = getItemCalories(item)
                lines.push(`  • ${name}: ${kcal} kcal`)
              })
              lines.push('')
            }

            // Exercise
            if (daily.exercises?.length > 0) {
              lines.push('💪 EXERCISE:')
              lines.push(
                `  Total Calories Burned: ${Math.round(daily.exerciseCalories)} kcal`
              )
              daily.exercises.forEach(ex => {
                const name = getItemDisplay(ex)
                const kcal = getItemCalories(ex)
                lines.push(`  • ${name}: ${kcal} kcal`)
              })
              lines.push('')
            }

            // Water intake
            if (daily.waterTotalMl > 0) {
              lines.push('💧 WATER INTAKE:')
              lines.push(`  Total: ${Math.round(daily.waterTotalMl)} ml`)
              lines.push('')
            }

            const summaryText = lines.join('\n')

            return (
              <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  {t('common.Shareable Summary') || 'Shareable Summary'}
                </h3>
                <div className="mb-3 flex gap-2">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(summaryText)
                      alert('Summary copied to clipboard!')
                    }}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                      />
                    </svg>
                    {t('common.Copy Summary') || 'Copy Summary'}
                  </button>
                  <button
                    onClick={() => {
                      const whatsappMessage = encodeURIComponent(summaryText)
                      const whatsappUrl = `https://wa.me/?text=${whatsappMessage}`
                      window.open(whatsappUrl, '_blank')
                    }}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.488" />
                    </svg>
                    {t('common.Send to WhatsApp') || 'Send to WhatsApp'}
                  </button>
                </div>
                <textarea
                  readOnly
                  value={summaryText}
                  className="w-full h-64 border border-gray-300 rounded-md p-3 text-sm font-mono bg-gray-50 resize-none"
                />
              </div>
            )
          })()}
        </>
      )}
    </div>
  )
}

export default ClientJournal
