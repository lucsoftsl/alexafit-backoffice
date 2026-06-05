import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  getDailyNutrition,
  getUserData,
  getUserCaloriesHistory,
  addMenuTemplateBO
} from '../services/loggedinApi'
import LZString from 'lz-string'
import {
  sumTotalsByMealsApplied,
  computeAppliedItemTotals
} from '../util/menuDisplay'
import { getCategoryIcon } from '../util/categoryIcons'
import { useAuth } from '../contexts/AuthContext'
import { useSelector } from 'react-redux'
import { selectUserData } from '../store/userSlice'

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
  if (it?.food || it?.type) {
    const totals = computeAppliedItemTotals(it)
    return Math.round(totals.calories || 0)
  }
  if (it?.exercise?.caloriesBurnt) return Math.round(it.exercise.caloriesBurnt)
  return 0
}

const ItemRow = ({ it, onClick, t }) => {
  const name = getItemDisplay(it)
  const kcal = getItemCalories(it)
  const category =
    it?.food?.category ||
    it?.category ||
    (it?.exercise ? 'exerciseGeneral' : '')
  const fallbackImg = category ? getCategoryIcon(category) : null
  const img =
    it?.food?.photoUrl || it?.exercise?.photoUrl || it?.photoUrl || fallbackImg

  const qty = it?.quantity != null ? Number(it.quantity) : null
  const unit = it?.unit || ''
  const servingOption = (it?.food?.servingOptions || []).find(
    s => s.unitName === unit
  )
  const quantityLabel = (() => {
    if (qty === null) return null
    const qDisplay = Number.isFinite(qty) ? (qty % 1 === 0 ? qty : qty.toFixed(1)) : qty
    if (servingOption?.value && unit !== 'g' && unit !== 'ml') {
      return `${qDisplay} ${unit} · ${Math.round(servingOption.value * qty)}g`
    }
    return `${qDisplay} ${unit}`
  })()

  return (
    <button
      onClick={() => onClick?.(it)}
      className="w-full text-left flex justify-between items-center p-2 rounded hover:bg-gray-50 transition-colors cursor-pointer"
    >
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
        <div className="flex flex-col min-w-0">
          <span className="text-sm text-gray-800 truncate">{name}</span>
          {quantityLabel && (
            <span className="text-xs text-gray-400 truncate">{quantityLabel}</span>
          )}
        </div>
      </div>
      <span className="text-sm text-gray-500 ml-2 flex-shrink-0">
        {kcal} {t('pages.clientJournal.kcal')}
      </span>
    </button>
  )
}

const MealSection = ({
  title,
  items = [],
  photoUrl,
  onItemClick,
  onPhotoClick,
  t
}) => (
  <div className="border border-gray-200 rounded-lg p-3 bg-white shadow-sm">
    <div className="flex justify-between items-center mb-2">
      <h4 className="text-sm font-semibold text-gray-900">{title}</h4>
      {photoUrl ? (
        <button
          type="button"
          onClick={() => onPhotoClick?.({ url: photoUrl, title })}
          className="rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          aria-label={`${t('pages.clientJournal.viewPhoto') || 'View photo'}: ${title}`}
        >
          <img
            src={photoUrl}
            alt={`${title} photo`}
            className="w-10 h-10 rounded object-cover transition-opacity hover:opacity-85"
          />
        </button>
      ) : null}
    </div>
    {items && items.length > 0 ? (
      <div className="space-y-1">
        {items.map((it, idx) => (
          <ItemRow key={idx} it={it} onClick={onItemClick} t={t} />
        ))}
      </div>
    ) : (
      <p className="text-xs text-gray-500">
        {t('pages.clientJournal.noItems')}
      </p>
    )}
  </div>
)

const MENU_NAME_SEPARATOR = ':::'
const MENU_ORDER_SEPARATOR = '==='

function journalItemToTemplateItem(journalItem) {
  const food = journalItem?.food
  if (!food?.id) return null
  const servingOptions = Array.isArray(food.servingOptions) ? food.servingOptions : []
  const unit = journalItem.unit || 'g'
  const qty = Number(journalItem.quantity) || 1
  // originalServingAmount must be the quantity in the stated unit (not pre-converted to grams).
  // The API's normalizeChangedServing multiplies it by the serving value itself, so storing
  // grams here would cause e.g. 200 (grams) × 200 (g/serving) = 40,000g.
  return {
    id: food.id,
    name: food.name,
    type: food.type || 'food',
    caloriesPer100: food.caloriesPer100,
    nutrientsPer100: food.nutrientsPer100,
    servingOptions,
    originalServingAmount: qty,
    originalServingId: unit,
  }
}

function buildContainerName(clientName, dateStr) {
  return `Generated - ${clientName} (${dateStr})`
}

function buildTemplateName(containerName, dayIndex, total) {
  return `${containerName} ${MENU_NAME_SEPARATOR} Day ${dayIndex} ${MENU_ORDER_SEPARATOR} ${dayIndex}`
}

function scoreMacros(breakfastItems, lunchItems, dinnerItems, snackItems) {
  const all = [...breakfastItems, ...lunchItems, ...dinnerItems, ...snackItems]
  let protein = 0, carbs = 0, fat = 0, calories = 0
  for (const it of all) {
    const n100 = it?.nutrientsPer100 || {}
    const amount = (it?.originalServingAmount || 100) / 100
    protein += (n100.proteinsInGrams || 0) * amount
    carbs += (n100.carbohydratesInGrams || 0) * amount
    fat += (n100.fatInGrams || 0) * amount
    calories += (it?.caloriesPer100 || 0) * amount
  }
  if (calories === 0) return 0
  const pRatio = (protein * 4) / calories
  const cRatio = (carbs * 4) / calories
  const fRatio = (fat * 9) / calories
  return -(Math.abs(pRatio - 0.30) + Math.abs(cRatio - 0.40) + Math.abs(fRatio - 0.30))
}

function shuffleArray(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const ClientJournal = ({ client, onGenerationComplete }) => {
  const { t } = useTranslation()
  const { currentUser } = useAuth()
  const userData = useSelector(selectUserData)
  const nutritionistId = currentUser?.uid || userData?.userId
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
  const [selectedPhoto, setSelectedPhoto] = useState(null)
  const [selectedItem, setSelectedItem] = useState(null)
  const [isItemModalOpen, setIsItemModalOpen] = useState(false)
  const lastFetchKeyRef = useRef('')
  const caloriesHistoryLoadedRef = useRef(new Set())
  const [daysToConsider, setDaysToConsider] = useState(7)
  const [numMealPlans, setNumMealPlans] = useState(7)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generateError, setGenerateError] = useState(null)

  const selectedItemFallbackImg = selectedItem
    ? getCategoryIcon(
        selectedItem?.food?.category ||
          selectedItem?.category ||
          (selectedItem?.exercise ? 'exerciseGeneral' : '')
      )
    : null

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
        const consumed = Number(item?.caloriesConsumed || 0)
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
        // Don't cache today — the snapshot can be stale and we always refetch
        // live data for it, so storing it would cause a stale flash on re-open.
        const today = todayISO()
        const cacheMap = { ...map }
        delete cacheMap[today]
        try {
          const compressed = LZString.compressToUTF16(JSON.stringify(cacheMap))
          localStorage.setItem(cacheKey, compressed)
        } catch (_) {
          /* ignore quota errors */
        }
        setMarkedDates(map)

        // Always fetch today's live nutrition — the snapshot table can be stale
        // even when it has an entry, so we never rely on it for today.
        try {
          const [todayRes, todayUserRes] = await Promise.all([
            getDailyNutrition({ userId, dateApplied: today }),
            getUserData({ userId, selectedDate: today })
          ])
          const todayDWrap = todayRes?.data || todayRes || {}
          const todayD = todayDWrap?.data || {}
          const todayUWrap = todayUserRes?.data || todayUserRes || {}
          const todayU = todayUWrap?.data || {}
          const todayGoal = todayU?.userGoals?.totalCalories || 0
          const todayTotals = sumTotalsByMealsApplied({
            breakfast: todayD?.breakfast || [],
            lunch: todayD?.lunch || [],
            dinner: todayD?.dinner || [],
            snack: todayD?.snack || []
          })
          const todayConsumed = Math.round(todayTotals.calories)
          setMarkedDates(prev => ({
            ...prev,
            [today]: {
              color: getColor(todayConsumed, todayGoal),
              hasData: todayConsumed > 0,
              caloriesConsumed: todayConsumed,
              caloriesGoal: todayGoal
            }
          }))
        } catch (_) {
          // non-blocking: calendar still shows the history snapshot
        }
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
        // Sync calendar marker with live nutrition data for this day so the
        // calendar cell stays accurate even when the snapshot table is stale.
        const liveConsumed = Math.round(totals.calories)
        const liveGoal = userGoals?.totalCalories || 0
        setMarkedDates(prev => ({
          ...prev,
          [selectedDate]: {
            ...prev[selectedDate],
            color: getColor(liveConsumed, liveGoal),
            hasData: liveConsumed > 0,
            caloriesConsumed: liveConsumed,
            caloriesGoal: liveGoal
          }
        }))
        setSelectedPhoto(null)
        setSelectedItem(null)
        setIsItemModalOpen(false)
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

  const handleGenerateMealPlans = async () => {
    if (!userId || !nutritionistId) return
    setIsGenerating(true)
    setGenerateError(null)
    try {
      const n = Math.max(1, Math.min(30, Number(daysToConsider) || 7))
      const m = Math.max(1, Math.min(30, Number(numMealPlans) || n))

      // Fetch past N days (excluding today)
      const today = new Date()
      const datesToFetch = Array.from({ length: n }, (_, i) => {
        const d = new Date(today)
        d.setDate(d.getDate() - (i + 1))
        return formatLocalISO(d)
      })

      const dayDataResults = await Promise.all(
        datesToFetch.map(async dateStr => {
          try {
            const res = await getDailyNutrition({ userId, dateApplied: dateStr })
            const d = res?.data?.data || res?.data || {}
            return {
              date: dateStr,
              breakfast: (d.breakfast || []).map(journalItemToTemplateItem).filter(Boolean),
              lunch: (d.lunch || []).map(journalItemToTemplateItem).filter(Boolean),
              dinner: (d.dinner || []).map(journalItemToTemplateItem).filter(Boolean),
              snack: (d.snack || []).map(journalItemToTemplateItem).filter(Boolean),
            }
          } catch {
            return { date: dateStr, breakfast: [], lunch: [], dinner: [], snack: [] }
          }
        })
      )

      // Filter to days that have at least one meal with items
      const daysWithData = dayDataResults.filter(
        d => d.breakfast.length > 0 || d.lunch.length > 0 || d.dinner.length > 0 || d.snack.length > 0
      )

      const breakfastPool = shuffleArray(daysWithData.filter(d => d.breakfast.length > 0))
      const lunchPool = shuffleArray(daysWithData.filter(d => d.lunch.length > 0))
      const dinnerPool = shuffleArray(daysWithData.filter(d => d.dinner.length > 0))
      const snackPool = shuffleArray(daysWithData.filter(d => d.snack.length > 0))

      if (breakfastPool.length === 0 && lunchPool.length === 0 && dinnerPool.length === 0 && snackPool.length === 0) {
        setGenerateError('No food data found in the selected period. Please make sure the client has logged meals.')
        setIsGenerating(false)
        return
      }

      const containerName = buildContainerName(userName, todayISO())

      const createdTemplates = []
      for (let i = 0; i < m; i++) {
        const bf = breakfastPool.length > 0 ? breakfastPool[i % breakfastPool.length].breakfast : []
        const lu = lunchPool.length > 0 ? lunchPool[i % lunchPool.length].lunch : []
        const di = dinnerPool.length > 0 ? dinnerPool[i % dinnerPool.length].dinner : []
        const sn = snackPool.length > 0 ? snackPool[i % snackPool.length].snack : []

        const templateName = buildTemplateName(containerName, i + 1, m)
        const res = await addMenuTemplateBO({
          name: templateName,
          breakfastPlan: bf,
          lunchPlan: lu,
          dinnerPlan: di,
          snackPlan: sn,
          isAssignableByUser: false,
          createdByUserId: nutritionistId,
        })
        if (res?.data || res?.ok) {
          createdTemplates.push(templateName)
        }
      }

      if (createdTemplates.length === 0) {
        setGenerateError('Failed to create meal plan templates. Please try again.')
        setIsGenerating(false)
        return
      }

      onGenerationComplete?.(containerName)
    } catch (e) {
      setGenerateError(e?.message || 'Failed to generate meal plans')
    } finally {
      setIsGenerating(false)
    }
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
        <div className="space-y-4">
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

          {/* Generate Meal Plan Panel */}
          <div className="bg-white border border-indigo-100 rounded-lg p-5 shadow-sm">
            <h3 className="text-base font-semibold text-gray-900 mb-4">Generate Meal Plan</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Number of days to consider
                </label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={daysToConsider}
                  onChange={e => {
                    const v = Math.max(1, Math.min(30, Number(e.target.value) || 1))
                    setDaysToConsider(v)
                    setNumMealPlans(v)
                  }}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Number of meal plans
                </label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={numMealPlans}
                  onChange={e => setNumMealPlans(Math.max(1, Math.min(30, Number(e.target.value) || 1)))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
            {generateError && (
              <p className="text-sm text-red-600 mb-3">{generateError}</p>
            )}
            <button
              onClick={handleGenerateMealPlans}
              disabled={isGenerating}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition"
            >
              {isGenerating ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Generating...
                </>
              ) : (
                'Generate Meal Plan'
              )}
            </button>
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
              onPhotoClick={setSelectedPhoto}
              onItemClick={it => {
                setSelectedItem(it)
                setIsItemModalOpen(true)
              }}
            />
            <MealSection
              t={t}
              title={t('pages.clientJournal.lunch')}
              items={daily.lunch}
              photoUrl={daily.lunchPhotoUrl}
              onPhotoClick={setSelectedPhoto}
              onItemClick={it => {
                setSelectedItem(it)
                setIsItemModalOpen(true)
              }}
            />
            <MealSection
              t={t}
              title={t('pages.clientJournal.dinner')}
              items={daily.dinner}
              photoUrl={daily.dinnerPhotoUrl}
              onPhotoClick={setSelectedPhoto}
              onItemClick={it => {
                setSelectedItem(it)
                setIsItemModalOpen(true)
              }}
            />
            <MealSection
              t={t}
              title={t('pages.clientJournal.snack')}
              items={daily.snack}
              photoUrl={daily.snackPhotoUrl}
              onPhotoClick={setSelectedPhoto}
              onItemClick={it => {
                setSelectedItem(it)
                setIsItemModalOpen(true)
              }}
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
                  <ItemRow
                    key={idx}
                    it={ex}
                    onClick={it => {
                      setSelectedItem(it)
                      setIsItemModalOpen(true)
                    }}
                    t={t}
                  />
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
            lines.push(
              `📅 ${t('pages.clientJournal.date') || 'Date'}: ${dateLabel || selectedDate}`
            )
            lines.push(
              `👤 ${t('pages.clientJournal.user') || 'User'}: ${userName}`
            )
            lines.push('')

            // User Goals
            lines.push(
              `🎯 ${t('pages.clientJournal.dailyGoals') || 'Daily Goals'}:`
            )
            lines.push(
              `  • ${t('pages.clientJournal.calories') || 'Calories'}: ${Math.round(daily.goals.calories || 0)} ${t('pages.clientJournal.kcal') || 'kcal'}`
            )
            lines.push(
              `  • ${t('pages.clientJournal.protein') || 'Protein'}: ${Math.round(daily.goals.protein || 0)}g`
            )
            lines.push(
              `  • ${t('pages.clientJournal.carbs') || 'Carbs'}: ${Math.round(daily.goals.carbs || 0)}g`
            )
            lines.push(
              `  • ${t('pages.clientJournal.fat') || 'Fat'}: ${Math.round(daily.goals.fat || 0)}g`
            )
            lines.push('')

            // Actual Intake
            lines.push(
              `📊 ${t('pages.clientJournal.actualIntake') || 'Actual Intake'}:`
            )
            lines.push(
              `  • ${t('pages.clientJournal.calories') || 'Calories'}: ${macroTotals.calories || 0} ${t('pages.clientJournal.kcal') || 'kcal'}`
            )
            lines.push(
              `  • ${t('pages.clientJournal.protein') || 'Protein'}: ${macroTotals.proteinsInGrams || 0}g`
            )
            lines.push(
              `  • ${t('pages.clientJournal.carbs') || 'Carbs'}: ${macroTotals.carbohydratesInGrams || 0}g`
            )
            lines.push(
              `  • ${t('pages.clientJournal.fat') || 'Fat'}: ${macroTotals.fatInGrams || 0}g`
            )
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

            lines.push(
              `📈 ${t('pages.clientJournal.goalProgress') || 'Goal Progress'}:`
            )
            lines.push(
              `  • ${t('pages.clientJournal.calories') || 'Calories'}: ${caloriesPct}%`
            )
            lines.push(
              `  • ${t('pages.clientJournal.protein') || 'Protein'}: ${proteinPct}%`
            )
            lines.push(
              `  • ${t('pages.clientJournal.carbs') || 'Carbs'}: ${carbsPct}%`
            )
            lines.push(
              `  • ${t('pages.clientJournal.fat') || 'Fat'}: ${fatPct}%`
            )
            lines.push('')

            // Meals breakdown
            if (daily.breakfast?.length > 0) {
              lines.push(
                `🍳 ${t('pages.clientJournal.breakfast')?.toUpperCase() || 'BREAKFAST'}:`
              )
              daily.breakfast.forEach(item => {
                const name = getItemDisplay(item)
                const kcal = getItemCalories(item)
                lines.push(
                  `  • ${name}: ${kcal} ${t('pages.clientJournal.kcal') || 'kcal'}`
                )
              })
              lines.push('')
            }

            if (daily.lunch?.length > 0) {
              lines.push(
                `🍱 ${t('pages.clientJournal.lunch')?.toUpperCase() || 'LUNCH'}:`
              )
              daily.lunch.forEach(item => {
                const name = getItemDisplay(item)
                const kcal = getItemCalories(item)
                lines.push(
                  `  • ${name}: ${kcal} ${t('pages.clientJournal.kcal') || 'kcal'}`
                )
              })
              lines.push('')
            }

            if (daily.dinner?.length > 0) {
              lines.push(
                `🍽️ ${t('pages.clientJournal.dinner')?.toUpperCase() || 'DINNER'}:`
              )
              daily.dinner.forEach(item => {
                const name = getItemDisplay(item)
                const kcal = getItemCalories(item)
                lines.push(
                  `  • ${name}: ${kcal} ${t('pages.clientJournal.kcal') || 'kcal'}`
                )
              })
              lines.push('')
            }

            if (daily.snack?.length > 0) {
              lines.push(
                `🍿 ${t('pages.clientJournal.snack')?.toUpperCase() || 'SNACKS'}:`
              )
              daily.snack.forEach(item => {
                const name = getItemDisplay(item)
                const kcal = getItemCalories(item)
                lines.push(
                  `  • ${name}: ${kcal} ${t('pages.clientJournal.kcal') || 'kcal'}`
                )
              })
              lines.push('')
            }

            // Exercise
            if (daily.exercises?.length > 0) {
              lines.push(
                `💪 ${t('pages.clientJournal.exercise')?.toUpperCase() || 'EXERCISE'}:`
              )
              lines.push(
                `  ${t('pages.clientJournal.total') || 'Total'} ${t('pages.clientJournal.caloriesBurned') || 'Calories Burned'}: ${Math.round(daily.exerciseCalories)} ${t('pages.clientJournal.kcal') || 'kcal'}`
              )
              daily.exercises.forEach(ex => {
                const name = getItemDisplay(ex)
                const kcal = getItemCalories(ex)
                lines.push(
                  `  • ${name}: ${kcal} ${t('pages.clientJournal.kcal') || 'kcal'}`
                )
              })
              lines.push('')
            }

            // Water intake
            if (daily.waterTotalMl > 0) {
              lines.push(
                `💧 ${t('pages.clientJournal.waterIntake')?.toUpperCase() || 'WATER INTAKE'}:`
              )
              lines.push(
                `  ${t('pages.clientJournal.total') || 'Total'}: ${Math.round(daily.waterTotalMl)} ml`
              )
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

      {/* Meal photo modal */}
      {selectedPhoto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={() => setSelectedPhoto(null)}
        >
          <div
            className="relative max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-lg bg-white shadow-2xl"
            onClick={event => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
              <h3 className="truncate text-base font-semibold text-gray-900">
                {selectedPhoto.title}
              </h3>
              <button
                type="button"
                className="rounded-md px-2 py-1 text-xl leading-none text-gray-500 hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                onClick={() => setSelectedPhoto(null)}
                aria-label={t('pages.clientJournal.close') || 'Close'}
              >
                ×
              </button>
            </div>
            <div className="flex max-h-[calc(90vh-56px)] items-center justify-center bg-gray-950">
              <img
                src={selectedPhoto.url}
                alt={`${selectedPhoto.title} photo`}
                className="max-h-[calc(90vh-56px)] w-full object-contain"
              />
            </div>
          </div>
        </div>
      )}

      {/* Item detail modal */}
      {isItemModalOpen && selectedItem && (() => {
        const food = selectedItem?.food
        const exercise = selectedItem?.exercise
        const totals = computeAppliedItemTotals(selectedItem)
        const n100 = food?.nutrientsPer100 || {}
        const isRecipe = food?.type === 'recipe'
        const ingredients = food?.ingredients || []
        const instructions = food?.recipeSteps?.instructions || []
        const servingOption = (food?.servingOptions || []).find(
          s => s.unitName === (selectedItem.unit || 'serving')
        ) || food?.servingOptions?.[0]
        const photoSrc =
          food?.photoUrl || exercise?.photoUrl || selectedItem?.photoUrl || selectedItemFallbackImg

        const NutrientRow = ({ label, value, unit: u = 'g' }) =>
          value > 0 ? (
            <div className="flex justify-between py-1.5 border-b border-gray-100 last:border-0">
              <span className="text-sm text-gray-600">{label}</span>
              <span className="text-sm font-medium text-gray-900">
                {Math.round(value * 10) / 10} {u}
              </span>
            </div>
          ) : null

        return (
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setIsItemModalOpen(false)}
          >
            <div
              className="bg-white rounded-xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-start justify-between px-5 pt-5 pb-3 border-b border-gray-100 flex-shrink-0">
                <div className="flex-1 min-w-0 pr-3">
                  <h3 className="text-base font-semibold text-gray-900 leading-snug">
                    {getItemDisplay(selectedItem)}
                  </h3>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {isRecipe && (
                      <span className="text-[11px] bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-full font-medium">
                        {t('pages.clientJournal.recipe')}
                      </span>
                    )}
                    {exercise && (
                      <span className="text-[11px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-medium">
                        {t('pages.clientJournal.exercise')}
                      </span>
                    )}
                    {servingOption && (
                      <span className="text-[11px] text-gray-500">
                        {selectedItem.quantity} {selectedItem.unit} · {servingOption.value}g
                      </span>
                    )}
                  </div>
                </div>
                <button
                  className="text-gray-400 hover:text-gray-700 flex-shrink-0 p-1 rounded-md hover:bg-gray-100 transition-colors"
                  onClick={() => setIsItemModalOpen(false)}
                  aria-label={t('pages.clientJournal.close') || 'Close'}
                >
                  ✕
                </button>
              </div>

              {/* Scrollable body */}
              <div className="overflow-y-auto flex-1 min-h-0 px-5 py-4 space-y-5">

                {/* Photo */}
                {photoSrc && (
                  <button
                    type="button"
                    className="w-full rounded-lg overflow-hidden focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    onClick={() => {
                      setIsItemModalOpen(false)
                      setSelectedPhoto({ url: photoSrc, title: getItemDisplay(selectedItem) })
                    }}
                  >
                    <img
                      src={photoSrc}
                      alt={getItemDisplay(selectedItem)}
                      className="w-full h-44 object-cover"
                    />
                    <p className="text-[11px] text-gray-400 text-right mt-1 pr-0.5">
                      {t('pages.clientJournal.viewPhoto') || 'Tap to view full photo'}
                    </p>
                  </button>
                )}

                {/* Calorie highlight */}
                <div className="bg-indigo-50 border border-indigo-100 rounded-lg px-4 py-3 flex items-center justify-between">
                  <span className="text-sm font-medium text-indigo-800">
                    {t('pages.clientJournal.calories') || 'Calories'}
                  </span>
                  <span className="text-2xl font-bold text-indigo-900">
                    {Math.round(totals.calories)} <span className="text-sm font-normal">kcal</span>
                  </span>
                </div>

                {/* Macros */}
                {food && (
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                      {t('pages.clientJournal.macros')}
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { label: t('pages.clientJournal.protein') || 'Protein', value: totals.proteinsInGrams, color: 'bg-blue-50 border-blue-100 text-blue-800' },
                        { label: t('pages.clientJournal.carbs') || 'Carbs', value: totals.carbohydratesInGrams, color: 'bg-amber-50 border-amber-100 text-amber-800' },
                        { label: t('pages.clientJournal.fat') || 'Fat', value: totals.fatInGrams, color: 'bg-rose-50 border-rose-100 text-rose-800' }
                      ].map(m => (
                        <div key={m.label} className={`rounded-lg border px-3 py-2 text-center ${m.color}`}>
                          <p className="text-[11px] font-medium opacity-75">{m.label}</p>
                          <p className="text-base font-bold leading-tight mt-0.5">
                            {Math.round(m.value * 10) / 10}g
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Additional nutrients */}
                {food && (n100.fibreInGrams > 0 || n100.sugarsInGrams > 0 || n100.saltInGrams > 0 || n100.fattyAcidsTotalSaturatedInGrams > 0) && (() => {
                  const ratio = food.caloriesPer100 > 0 ? totals.calories / food.caloriesPer100 : 0
                  return (
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
                        {t('pages.clientJournal.additionalNutrients')}
                      </p>
                      <div className="bg-gray-50 rounded-lg px-3 py-1">
                        <NutrientRow label={t('pages.clientJournal.fibre')} value={(n100.fibreInGrams || 0) * ratio} />
                        <NutrientRow label={t('pages.clientJournal.sugars')} value={(n100.sugarsInGrams || 0) * ratio} />
                        <NutrientRow label={t('pages.clientJournal.saturatedFat')} value={(n100.fattyAcidsTotalSaturatedInGrams || 0) * ratio} />
                        <NutrientRow label={t('pages.clientJournal.salt')} value={(n100.saltInGrams || 0) * ratio} />
                      </div>
                    </div>
                  )
                })()}

                {/* Ingredients */}
                {isRecipe && ingredients.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                      {t('pages.clientJournal.ingredients')} ({ingredients.length})
                    </p>
                    <div className="bg-gray-50 rounded-lg divide-y divide-gray-100">
                      {ingredients.map((ing, idx) => (
                        <div key={idx} className="flex justify-between items-center px-3 py-2">
                          <span className="text-sm text-gray-800 flex-1 min-w-0 truncate pr-3">
                            {ing.name}
                          </span>
                          <span className="text-sm text-gray-500 flex-shrink-0">
                            {ing.quantity} {ing.unit}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recipe instructions */}
                {isRecipe && instructions.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                      {t('pages.clientJournal.preparation')}
                    </p>
                    <ol className="space-y-2">
                      {instructions.map((step, idx) => (
                        <li key={idx} className="flex gap-3">
                          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-[11px] font-bold flex items-center justify-center mt-0.5">
                            {idx + 1}
                          </span>
                          <span className="text-sm text-gray-700 leading-relaxed">{step}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}

                {/* Exercise details */}
                {exercise && (
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                      {t('pages.clientJournal.exerciseDetails')}
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-gray-50 rounded-lg px-3 py-2">
                        <p className="text-xs text-gray-500">
                          {t('pages.clientJournal.duration') || 'Duration'}
                        </p>
                        <p className="text-sm font-semibold text-gray-900">
                          {exercise.durationInMinutes || selectedItem.quantity || 0} {t('pages.clientJournal.min') || 'min'}
                        </p>
                      </div>
                      <div className="bg-gray-50 rounded-lg px-3 py-2">
                        <p className="text-xs text-gray-500">
                          {t('pages.clientJournal.burned') || 'Burned'}
                        </p>
                        <p className="text-sm font-semibold text-gray-900">
                          {exercise.caloriesBurnt || 0} kcal
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-5 py-3 border-t border-gray-100 flex justify-end flex-shrink-0">
                <button
                  className="px-4 py-2 text-sm rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                  onClick={() => setIsItemModalOpen(false)}
                >
                  {t('pages.clientJournal.close') || 'Close'}
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}

export default ClientJournal
