import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  getUserMenuByDate,
  getAllMenuTemplatesByUser,
  assignMenuTemplateToUserBO,
  deleteMenuTemplateByIdBO,
  deleteMenuContainerBO,
  updateMenuTemplateBO,
} from '../services/loggedinApi'
import { exportMenuBuilderToPdf } from '../util/menuPdfExport'
import { searchFoodItems, getItemsByIds } from '../services/api'
import {
  findDefaultServing,
  calculateDisplayValues,
  safeNutrients,
  buildServingOptionsForMenuItem,
  detectIsRecipe,
  getServingIdentifier,
  findServingByIdentifier,
} from '../util/menuDisplay'
import { useAuth } from '../contexts/AuthContext'
import { useSelector } from 'react-redux'
import { selectUserData } from '../store/userSlice'

const MENU_NAME_SEPARATOR = ':::'
const MENU_ORDER_SEPARATOR = '==='
const MEAL_TYPES = [
  { id: 'breakfastPlan', label: 'Breakfast' },
  { id: 'lunchPlan', label: 'Lunch' },
  { id: 'dinnerPlan', label: 'Dinner' },
  { id: 'snackPlan', label: 'Snack' },
]

const todayISO = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const offsetISO = (daysFromToday) => {
  const d = new Date()
  d.setDate(d.getDate() + daysFromToday)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const parseNumber = v => { const n = Number(v); return Number.isFinite(n) ? n : 0 }
const parseOptionalNumber = v => {
  if (v === '' || v === null || v === undefined) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}
const getServingAmount = s => parseNumber(s?.value ?? s?.amount ?? 0)
const STANDARD_UNITS = new Set(['g','gram','grams','ml','milliliter','milliliters','oz','ounce','ounces','fl oz'])
const getDefaultAmountForServing = s => {
  const unit = (s?.unitName || s?.unit || s?.name || '').toString().trim().toLowerCase()
  return STANDARD_UNITS.has(unit) ? (getServingAmount(s) || 100) : 1
}

const findPortionServing = arr =>
  (arr || []).find(s => {
    const n = (s?.unitName || s?.name || s?.innerName || '').toLowerCase()
    return n.includes('portion') || n.includes('serving') || n.includes('portie')
  }) || null

function splitMenuName(name) {
  const normalized = String(name || '').trim()
  const [containerPart, ...menuParts] = normalized.split(MENU_NAME_SEPARATOR)
  if (menuParts.length === 0) return { containerName: '', menuName: normalized, order: null, hasContainer: false }
  const joined = menuParts.join(MENU_NAME_SEPARATOR).trim()
  const orderIdx = joined.lastIndexOf(MENU_ORDER_SEPARATOR)
  if (orderIdx !== -1) {
    const maybeMenuName = joined.slice(0, orderIdx).trim()
    const maybeOrder = Number.parseInt(joined.slice(orderIdx + MENU_ORDER_SEPARATOR.length).trim(), 10)
    if (Number.isFinite(maybeOrder) && maybeOrder > 0)
      return { containerName: containerPart.trim(), menuName: maybeMenuName || joined, order: maybeOrder, hasContainer: true }
  }
  return { containerName: containerPart.trim(), menuName: joined, order: null, hasContainer: true }
}

function buildStoredMenuName(containerName, menuName, order) {
  const cn = String(containerName || '').trim()
  const mn = String(menuName || '').trim()
  const ord = Number.isFinite(order) && order > 0 ? order : null
  if (!cn) return mn
  return ord !== null ? `${cn} ${MENU_NAME_SEPARATOR} ${mn} ${MENU_ORDER_SEPARATOR} ${ord}` : `${cn} ${MENU_NAME_SEPARATOR} ${mn}`
}

function groupTemplatesByContainer(templates) {
  const containers = {}
  for (const tpl of templates) {
    const { containerName, menuName, order } = splitMenuName(tpl.name)
    const key = containerName || '__no_container__'
    if (!containers[key]) containers[key] = { containerName: containerName || '', menus: [] }
    containers[key].menus.push({ ...tpl, parsedMenuName: menuName, parsedOrder: order })
  }
  for (const key of Object.keys(containers)) {
    containers[key].menus.sort((a, b) => {
      const oa = a.parsedOrder ?? Infinity, ob = b.parsedOrder ?? Infinity
      return oa !== ob ? oa - ob : (a.parsedMenuName || '').localeCompare(b.parsedMenuName || '')
    })
  }
  return Object.values(containers).sort((a, b) => {
    if (!a.containerName) return 1
    if (!b.containerName) return -1
    return a.containerName.localeCompare(b.containerName)
  })
}

const summarizeItems = (items) => (items || []).reduce((acc, it) => {
  const servingOptions = Array.isArray(it?.serving) ? it.serving : (Array.isArray(it?.servingOptions) ? it.servingOptions : [])
  let originalServingAmount = it?.originalServingAmount
  if (!originalServingAmount && servingOptions.length > 0) {
    const def = findDefaultServing(servingOptions)
    originalServingAmount = (def?.amount || 100) * (it?.numberOfServings || it?.originalServings || 1)
  }
  originalServingAmount = originalServingAmount || 100
  const selectedAmount = it?.changedServing?.value ? it.changedServing.value : originalServingAmount
  const calc = calculateDisplayValues(it, selectedAmount, originalServingAmount)
  const n = safeNutrients(calc.nutrients)
  return {
    calories: acc.calories + (calc.calories || 0),
    proteinsInGrams: acc.proteinsInGrams + n.proteinsInGrams,
    carbohydratesInGrams: acc.carbohydratesInGrams + n.carbohydratesInGrams,
    fatInGrams: acc.fatInGrams + n.fatInGrams,
  }
}, { calories: 0, proteinsInGrams: 0, carbohydratesInGrams: 0, fatInGrams: 0 })

function deriveDisplayValues(plans) {
  const vals = {}
  for (const { id: mealKey } of MEAL_TYPES) {
    const items = plans[mealKey] || []
    items.forEach((item, index) => {
      const key = `${mealKey}-${index}`
      if (item?.changedServing) {
        const servingId = item.changedServing.servingOption
          ? getServingIdentifier(item.changedServing.servingOption)
          : null
        vals[key] = {
          selectedServingId: servingId,
          servingAmount: parseOptionalNumber(item.changedServing.quantity) ?? parseOptionalNumber(item.changedServing.value) ?? '',
        }
      } else {
        const servingOptions = buildServingOptionsForMenuItem(item, true)
        let selectedServing = findDefaultServing(servingOptions) || servingOptions[0] || null
        if (detectIsRecipe(item)) { const p = findPortionServing(servingOptions); if (p) selectedServing = p }
        vals[key] = {
          selectedServingId: getServingIdentifier(selectedServing) || item?.originalServingId || null,
          servingAmount: selectedServing ? getDefaultAmountForServing(selectedServing) : (item?.originalServingAmount || 100),
        }
      }
    })
  }
  return vals
}

function preparePlanWithChangedServing(items, mealKey, displayValues) {
  return items.map((item, index) => {
    const key = `${mealKey}-${index}`
    const dv = displayValues[key]
    const copy = { ...item }
    if (dv && dv.servingAmount !== undefined && dv.servingAmount !== '' && dv.selectedServingId != null) {
      const servingOptions = buildServingOptionsForMenuItem(item, true)
      const selected = findServingByIdentifier(servingOptions, dv.selectedServingId)
      if (selected) {
        copy.changedServing = {
          value: String(dv.servingAmount),
          quantity: parseNumber(dv.servingAmount),
          unit: selected?.unitName || selected?.unit || 'g',
          servingOption: {
            unitName: selected?.unitName || selected?.unit || selected?.name || 'g',
            value: parseNumber(selected?.value ?? selected?.amount ?? 100),
          },
        }
      }
    }
    return copy
  })
}

// ─── Edit Template Modal ───────────────────────────────────────────────────────

const EditTemplateModal = ({ template, nutritionistId, onSaved, onClose }) => {
  const { currentUser } = useAuth()
  const [plans, setPlans] = useState(() => ({
    breakfastPlan: template.breakfastPlan || [],
    lunchPlan: template.lunchPlan || [],
    dinnerPlan: template.dinnerPlan || [],
    snackPlan: template.snackPlan || [],
  }))
  const [displayValues, setDisplayValues] = useState(() => deriveDisplayValues({
    breakfastPlan: template.breakfastPlan || [],
    lunchPlan: template.lunchPlan || [],
    dinnerPlan: template.dinnerPlan || [],
    snackPlan: template.snackPlan || [],
  }))
  const [activeMealType, setActiveMealType] = useState('breakfastPlan')
  const [searchText, setSearchText] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const { containerName, menuName, order } = splitMenuName(template.name)
  const [editMenuName, setEditMenuName] = useState(menuName)

  const handleSearch = async () => {
    if (!searchText.trim()) return
    setSearching(true)
    try {
      const results = await searchFoodItems({ searchText, userId: currentUser?.uid, countryCode: 'RO' })
      setSearchResults(Array.isArray(results) ? results : [])
    } catch { setSearchResults([]) }
    finally { setSearching(false) }
  }

  const addItem = async (item) => {
    let enriched = { ...item }
    let originalServingAmount = 100
    let originalServingId = null
    try {
      const id = item?.id || item?.itemId || item?._id
      if (id) {
        const resp = await getItemsByIds({ ids: [id] })
        const detailed = resp?.data?.[0] || resp?.items?.[0]
        if (detailed) {
          const servingOpts = Array.isArray(detailed.servingOptions) ? detailed.servingOptions : []
          if (detectIsRecipe(item)) {
            const originalServings = detailed?.numberOfRecipeServings || 1
            const portion = findPortionServing(servingOpts)
            const def = findDefaultServing(servingOpts)
            originalServingAmount = portion ? getServingAmount(portion) * originalServings : (getServingAmount(def) || 100) * originalServings
            originalServingId = getServingIdentifier(portion || def)
          } else {
            const def = findDefaultServing(servingOpts)
            originalServingAmount = getServingAmount(def) || 100
            originalServingId = getServingIdentifier(def)
          }
          enriched = { ...item, ...detailed, originalServingAmount, originalServingId }
        }
      }
    } catch { /* fallback to item as-is */ }

    const newIndex = plans[activeMealType].length
    const key = `${activeMealType}-${newIndex}`
    const servingOptions = buildServingOptionsForMenuItem(enriched, true)
    let initServing = findDefaultServing(servingOptions) || servingOptions[0] || null
    if (detectIsRecipe(enriched)) { const p = findPortionServing(servingOptions); if (p) initServing = p }
    setDisplayValues(prev => ({
      ...prev,
      [key]: {
        selectedServingId: getServingIdentifier(initServing) || originalServingId,
        servingAmount: initServing ? getDefaultAmountForServing(initServing) : originalServingAmount,
      },
    }))
    setPlans(prev => ({ ...prev, [activeMealType]: [...prev[activeMealType], enriched] }))
    setSearchText('')
    setSearchResults([])
  }

  const removeItem = (mealKey, index) => {
    setDisplayValues(prev => {
      const next = { ...prev }
      delete next[`${mealKey}-${index}`]
      const reindexed = {}
      Object.keys(next).forEach(k => {
        const [mk, idx] = k.split('-')
        const n = parseInt(idx)
        if (mk === mealKey && n > index) reindexed[`${mk}-${n - 1}`] = next[k]
        else reindexed[k] = next[k]
      })
      return reindexed
    })
    setPlans(prev => ({ ...prev, [mealKey]: prev[mealKey].filter((_, i) => i !== index) }))
  }

  const handleSave = async () => {
    setSaving(true)
    setSaveError(null)
    try {
      const storedName = buildStoredMenuName(containerName, editMenuName.trim() || menuName, order)
      const payload = {
        menuTemplateId: template.id,
        name: storedName,
        breakfastPlan: preparePlanWithChangedServing(plans.breakfastPlan, 'breakfastPlan', displayValues),
        lunchPlan: preparePlanWithChangedServing(plans.lunchPlan, 'lunchPlan', displayValues),
        dinnerPlan: preparePlanWithChangedServing(plans.dinnerPlan, 'dinnerPlan', displayValues),
        snackPlan: preparePlanWithChangedServing(plans.snackPlan, 'snackPlan', displayValues),
        isAssignableByUser: template.isAssignableByUser || false,
        createdByUserId: nutritionistId,
      }
      await updateMenuTemplateBO(payload)
      onSaved({ ...template, ...payload })
    } catch (e) {
      setSaveError(e?.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const activeItems = plans[activeMealType] || []

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-3xl max-h-[90vh] flex flex-col bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 flex-shrink-0">
          <div className="min-w-0 flex-1 mr-4">
            <p className="text-xs text-gray-500 mb-1">{containerName}</p>
            <input
              type="text"
              value={editMenuName}
              onChange={e => setEditMenuName(e.target.value)}
              className="w-full text-lg font-semibold text-gray-900 border-0 border-b border-transparent focus:border-indigo-400 focus:outline-none bg-transparent pb-0.5"
            />
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 flex-shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Meal type tabs */}
        <div className="flex gap-1 px-4 pt-3 border-b border-gray-100 flex-shrink-0">
          {MEAL_TYPES.map(({ id, label }) => {
            const count = plans[id]?.length || 0
            return (
              <button
                key={id}
                onClick={() => setActiveMealType(id)}
                className={`px-3 py-1.5 text-sm font-medium rounded-t transition-colors ${activeMealType === id ? 'bg-indigo-50 text-indigo-700 border-b-2 border-indigo-500' : 'text-gray-500 hover:text-gray-700'}`}
              >
                {label}{count > 0 && <span className="ml-1 text-xs text-gray-400">({count})</span>}
              </button>
            )
          })}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Search */}
          <div className="flex gap-2">
            <input
              type="text"
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSearch() }}
              placeholder="Search foods or recipes..."
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
            <button
              onClick={handleSearch}
              disabled={searching || !searchText.trim()}
              className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-60 transition"
            >
              {searching ? '…' : 'Search'}
            </button>
          </div>

          {/* Search results */}
          {searchResults.length > 0 && (
            <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-48 overflow-y-auto bg-white shadow-sm">
              {searchResults.map((item, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-2 hover:bg-gray-50">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{item?.name || 'Unnamed'}</p>
                    <p className="text-xs text-gray-500">{detectIsRecipe(item) ? 'Recipe' : 'Food'}</p>
                  </div>
                  <button
                    onClick={() => addItem(item)}
                    className="px-3 py-1 bg-emerald-500 text-white text-xs rounded-full hover:bg-emerald-600 transition"
                  >
                    + Add
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Items */}
          <div className="space-y-2">
            {activeItems.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">
                No items in {MEAL_TYPES.find(m => m.id === activeMealType)?.label}. Search above to add.
              </p>
            )}
            {activeItems.map((item, index) => {
              const key = `${activeMealType}-${index}`
              const dv = displayValues[key] || {}
              const servingOptions = buildServingOptionsForMenuItem(item, true)
              const currentServingId = dv.selectedServingId || item?.originalServingId || getServingIdentifier(servingOptions[0])
              const selectedServing = findServingByIdentifier(servingOptions, currentServingId) || servingOptions[0] || null
              const currentAmount = dv.servingAmount !== undefined ? dv.servingAmount : getDefaultAmountForServing(selectedServing)
              const originalServingAmount = item?.originalServingAmount || getServingAmount(selectedServing) || 100
              const calc = calculateDisplayValues(item, currentAmount, originalServingAmount, selectedServing?.unitName || 'g')
              const n = safeNutrients(calc.nutrients)

              return (
                <div key={key} className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg bg-white">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{item?.name || 'Unnamed'}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {Math.round(calc.calories)} cal | P {Math.round(n.proteinsInGrams)}g | C {Math.round(n.carbohydratesInGrams)}g | F {Math.round(n.fatInGrams)}g
                    </p>
                    {servingOptions.length > 0 && (
                      <div className="flex items-center gap-2 mt-2">
                        <select
                          value={currentServingId || ''}
                          onChange={e => {
                            const nextServing = findServingByIdentifier(servingOptions, e.target.value) || servingOptions[0]
                            setDisplayValues(prev => ({
                              ...prev,
                              [key]: { selectedServingId: e.target.value, servingAmount: getDefaultAmountForServing(nextServing) },
                            }))
                          }}
                          className="border border-gray-200 rounded px-2 py-1 text-xs text-gray-700 bg-gray-50"
                        >
                          {servingOptions.map(opt => {
                            const id = getServingIdentifier(opt)
                            return <option key={id} value={id}>{opt?.unitName || opt?.unit || opt?.name || 'g'}</option>
                          })}
                        </select>
                        <input
                          type="number"
                          min="0.1"
                          step="0.1"
                          value={currentAmount}
                          onChange={e => setDisplayValues(prev => ({ ...prev, [key]: { ...prev[key], servingAmount: e.target.value } }))}
                          className="border border-gray-200 rounded px-2 py-1 text-xs w-20 text-gray-700"
                        />
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => removeItem(activeMealType, index)}
                    className="p-1.5 text-gray-300 hover:text-red-500 rounded hover:bg-red-50 transition flex-shrink-0"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-gray-200 flex-shrink-0">
          <div className="text-xs text-gray-500">
            {MEAL_TYPES.map(({ id, label }) => `${label}: ${plans[id]?.length || 0}`).join(' · ')}
          </div>
          <div className="flex items-center gap-3">
            {saveError && <span className="text-xs text-red-600">{saveError}</span>}
            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-200 rounded-lg hover:bg-gray-50 transition">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-60 transition"
            >
              {saving ? (
                <>
                  <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Saving...
                </>
              ) : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── MealBlock ─────────────────────────────────────────────────────────────────

const MealBlock = ({ label, items }) => {
  const totals = summarizeItems(items)
  return (
    <div className="border border-gray-200 rounded p-3 bg-white shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-semibold text-gray-900">{label}</p>
        <p className="text-xs text-gray-600">
          {Math.round(totals.calories)} cal | P {Math.round(totals.proteinsInGrams)}g | C {Math.round(totals.carbohydratesInGrams)}g | F {Math.round(totals.fatInGrams)}g
        </p>
      </div>
      {(!items || items.length === 0) && <p className="text-xs text-gray-500">No items</p>}
      <div className="space-y-1">
        {(items || []).map((it, i) => (
          <div key={i} className="text-sm text-gray-700 truncate">{it?.name || it?.title || 'Unnamed item'}</div>
        ))}
      </div>
    </div>
  )
}

// ─── TemplateCard ──────────────────────────────────────────────────────────────

const TemplateCard = ({ template, userId, nutritionistId, onDeleted, onEdited, t }) => {
  const [localTemplate, setLocalTemplate] = useState(template)
  const [assignDate, setAssignDate] = useState(() => offsetISO(template.parsedOrder ?? 1))
  const [assigning, setAssigning] = useState(false)
  const [assignError, setAssignError] = useState(null)
  const [assignSuccess, setAssignSuccess] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState(null)
  const [editOpen, setEditOpen] = useState(false)

  const totalCalories = Math.round(
    summarizeItems(localTemplate.breakfastPlan).calories +
    summarizeItems(localTemplate.lunchPlan).calories +
    summarizeItems(localTemplate.dinnerPlan).calories +
    summarizeItems(localTemplate.snackPlan).calories
  )

  const handleAssign = async () => {
    setAssigning(true)
    setAssignError(null)
    setAssignSuccess(false)
    try {
      await assignMenuTemplateToUserBO({ userId, dateApplied: assignDate, menuTemplateId: localTemplate.id, replaceExisting: true })
      setAssignSuccess(true)
      setTimeout(() => setAssignSuccess(false), 3000)
    } catch (e) { setAssignError(e?.message || 'Failed to assign') }
    finally { setAssigning(false) }
  }

  const handleDelete = async () => {
    setDeleting(true)
    setDeleteError(null)
    try {
      await deleteMenuTemplateByIdBO({ menuTemplateId: localTemplate.id, createdByUserId: nutritionistId })
      onDeleted(localTemplate.id)
    } catch (e) { setDeleteError(e?.message || 'Failed to delete'); setConfirmingDelete(false) }
    finally { setDeleting(false) }
  }

  const handleSaved = (updatedTemplate) => {
    const { menuName, order } = splitMenuName(updatedTemplate.name)
    setLocalTemplate({ ...updatedTemplate, parsedMenuName: menuName, parsedOrder: order })
    setEditOpen(false)
    onEdited(updatedTemplate)
  }

  return (
    <>
      <div className="border border-gray-200 rounded-lg bg-white shadow-sm overflow-hidden">
        <div className="flex items-center">
          <button
            onClick={() => setExpanded(v => !v)}
            className="flex-1 flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors text-left"
          >
            <div>
              <p className="text-sm font-semibold text-gray-900">{localTemplate.parsedMenuName || localTemplate.name}</p>
              <p className="text-xs text-gray-500 mt-0.5">{totalCalories} kcal total</p>
            </div>
            <svg className={`w-4 h-4 text-gray-400 transition-transform mr-2 ${expanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Action buttons */}
          <div className="flex items-center gap-1 pr-3 flex-shrink-0">
            <button
              onClick={() => setEditOpen(true)}
              className="p-1.5 text-gray-400 hover:text-indigo-600 rounded hover:bg-indigo-50 transition-colors"
              title="Edit this plan"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>

            {confirmingDelete ? (
              <>
                <span className="text-xs text-gray-500 mr-1">Delete?</span>
                <button onClick={handleDelete} disabled={deleting} className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-60 transition">
                  {deleting ? '…' : 'Yes'}
                </button>
                <button onClick={() => { setConfirmingDelete(false); setDeleteError(null) }} className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition">
                  No
                </button>
              </>
            ) : (
              <button onClick={() => setConfirmingDelete(true)} className="p-1.5 text-gray-400 hover:text-red-500 rounded hover:bg-red-50 transition-colors" title="Delete this plan">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {deleteError && <p className="px-4 pb-2 text-xs text-red-600">{deleteError}</p>}

        {expanded && (
          <div className="px-4 pb-4 space-y-3 border-t border-gray-100">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-3">
              <MealBlock label={t('pages.clientJournal.breakfast')} items={localTemplate.breakfastPlan} />
              <MealBlock label={t('pages.clientJournal.lunch')} items={localTemplate.lunchPlan} />
              <MealBlock label={t('pages.clientJournal.dinner')} items={localTemplate.dinnerPlan} />
              <MealBlock label={t('pages.clientJournal.snack')} items={localTemplate.snackPlan} />
            </div>
            <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-gray-100">
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-gray-600 whitespace-nowrap">Assign for date:</label>
                <input type="date" value={assignDate} onChange={e => setAssignDate(e.target.value)} className="border border-gray-300 rounded px-2 py-1 text-sm" />
              </div>
              <button
                onClick={handleAssign}
                disabled={assigning}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700 disabled:opacity-60 transition"
              >
                {assigning ? (
                  <>
                    <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Assigning...
                  </>
                ) : 'Assign to Client'}
              </button>
              {assignSuccess && <span className="text-xs text-emerald-600 font-medium">Assigned!</span>}
              {assignError && <span className="text-xs text-red-600">{assignError}</span>}
            </div>
          </div>
        )}
      </div>

      {editOpen && (
        <EditTemplateModal
          template={localTemplate}
          nutritionistId={nutritionistId}
          onSaved={handleSaved}
          onClose={() => setEditOpen(false)}
        />
      )}
    </>
  )
}

// ─── ContainerSection ─────────────────────────────────────────────────────────

const ContainerSection = ({ container, userId, nutritionistId, isHighlighted, scrollRef, onDeleteTemplate, onDeleteContainer, onEditTemplate, t }) => {
  const [expanded, setExpanded] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState(null)
  const [exportingPdf, setExportingPdf] = useState(false)

  useEffect(() => {
    if (isHighlighted) {
      setExpanded(true)
      scrollRef?.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [isHighlighted, scrollRef])

  const handleDeleteContainer = async () => {
    setDeleting(true)
    setDeleteError(null)
    const ids = container.menus.map(m => m.id)
    try {
      await deleteMenuContainerBO({ menuTemplateIds: ids, createdByUserId: nutritionistId })
      onDeleteContainer(ids)
    } catch (e) { setDeleteError(e?.message || 'Failed to delete group'); setConfirmingDelete(false) }
    finally { setDeleting(false) }
  }

  const handleExportPdf = async () => {
    if (!container?.menus?.length) return
    try {
      setExportingPdf(true)
      await exportMenuBuilderToPdf({ container, t })
    } catch (e) {
      window.alert('Failed to export PDF')
    } finally {
      setExportingPdf(false)
    }
  }

  return (
    <div
      ref={scrollRef || null}
      className={`border rounded-lg overflow-hidden shadow-sm transition-all ${isHighlighted ? 'border-indigo-300 ring-2 ring-indigo-100' : 'border-gray-200'}`}
    >
      <div className="flex items-center bg-gray-50">
        <button
          onClick={() => setExpanded(v => !v)}
          className="flex-1 flex items-center justify-between px-4 py-3 hover:bg-gray-100 transition-colors text-left"
        >
          <div>
            <p className="text-sm font-semibold text-gray-900">{container.containerName || 'Ungrouped'}</p>
            <p className="text-xs text-gray-500 mt-0.5">{container.menus.length} meal plan{container.menus.length !== 1 ? 's' : ''}</p>
          </div>
          <svg className={`w-4 h-4 text-gray-500 transition-transform mr-2 ${expanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        <div className="flex items-center gap-1 pr-3 flex-shrink-0">
          {confirmingDelete ? (
            <>
              <span className="text-xs text-gray-500 mr-1">Delete all {container.menus.length}?</span>
              <button onClick={handleDeleteContainer} disabled={deleting} className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-60 transition">
                {deleting ? '…' : 'Yes'}
              </button>
              <button onClick={() => { setConfirmingDelete(false); setDeleteError(null) }} className="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition">
                No
              </button>
            </>
          ) : (
            <>
              <button onClick={handleExportPdf} disabled={exportingPdf} className="p-1.5 text-gray-400 hover:text-indigo-600 rounded hover:bg-indigo-50 transition-colors disabled:opacity-40" title="Export PDF">
                {exportingPdf ? (
                  <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                )}
              </button>
              <button onClick={() => setConfirmingDelete(true)} className="p-1.5 text-gray-400 hover:text-red-500 rounded hover:bg-red-50 transition-colors" title="Delete entire group">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </>
          )}
        </div>
      </div>

      {deleteError && <p className="px-4 py-1 text-xs text-red-600 bg-gray-50 border-t border-gray-200">{deleteError}</p>}

      {expanded && (
        <div className="p-3 space-y-2 bg-white">
          {container.menus.map(tpl => (
            <TemplateCard
              key={tpl.id}
              template={tpl}
              userId={userId}
              nutritionistId={nutritionistId}
              onDeleted={onDeleteTemplate}
              onEdited={onEditTemplate}
              t={t}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

const ClientMealPlans = ({ client, newlyGeneratedContainer, onContainerViewed }) => {
  const [activeTab, setActiveTab] = useState('assigned')
  const [selectedDate, setSelectedDate] = useState(todayISO())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [menu, setMenu] = useState(null)
  const [templates, setTemplates] = useState([])
  const [templatesLoading, setTemplatesLoading] = useState(false)
  const [templatesError, setTemplatesError] = useState(null)
  const { t } = useTranslation()
  const { currentUser } = useAuth()
  const userData = useSelector(selectUserData)
  const nutritionistId = currentUser?.uid || userData?.userId
  const highlightedContainerName = useRef(null)
  const highlightScrollRef = useRef(null)

  const userId = useMemo(() => Array.isArray(client?.userId) ? client.userId[0] : client?.userId, [client])
  const userName = useMemo(() => client?.userData?.name || client?.loginDetails?.displayName || 'User', [client])

  useEffect(() => {
    if (newlyGeneratedContainer) {
      setActiveTab('templates')
      highlightedContainerName.current = newlyGeneratedContainer
    }
  }, [newlyGeneratedContainer])

  useEffect(() => {
    if (activeTab !== 'assigned') return
    const load = async () => {
      if (!userId) return
      setLoading(true)
      setError(null)
      try {
        const res = await getUserMenuByDate({ userId, dateApplied: selectedDate })
        setMenu(res?.data || res || null)
      } catch (e) { setError(e?.message || 'Failed to load assigned menu') }
      finally { setLoading(false) }
    }
    load()
  }, [selectedDate, userId, activeTab])

  useEffect(() => {
    if (activeTab !== 'templates' || !nutritionistId) return
    const load = async () => {
      setTemplatesLoading(true)
      setTemplatesError(null)
      try {
        const res = await getAllMenuTemplatesByUser({ createdByUserId: nutritionistId })
        const list = res?.data?.data || res?.data || res || []
        setTemplates(Array.isArray(list) ? list : [])
      } catch (e) { setTemplatesError(e?.message || 'Failed to load templates') }
      finally { setTemplatesLoading(false) }
    }
    load()
  }, [activeTab, nutritionistId])

  const groupedContainers = useMemo(() => groupTemplatesByContainer(templates), [templates])

  const handleDeleteTemplate = (templateId) => setTemplates(prev => prev.filter(t => t.id !== templateId))
  const handleDeleteContainer = (templateIds) => { const s = new Set(templateIds); setTemplates(prev => prev.filter(t => !s.has(t.id))) }
  const handleEditTemplate = (updated) => setTemplates(prev => prev.map(t => t.id === updated.id ? { ...t, ...updated } : t))

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
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('assigned')}
          className={`px-4 py-2 text-sm font-medium rounded-t-md transition-colors ${activeTab === 'assigned' ? 'bg-white border border-b-white border-gray-200 text-indigo-600 -mb-px' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Assigned Menu
        </button>
        <button
          onClick={() => { setActiveTab('templates'); onContainerViewed?.() }}
          className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-t-md transition-colors ${activeTab === 'templates' ? 'bg-white border border-b-white border-gray-200 text-indigo-600 -mb-px' : 'text-gray-500 hover:text-gray-700'}`}
        >
          All Templates
          {newlyGeneratedContainer && activeTab !== 'templates' && (
            <span className="w-2 h-2 rounded-full bg-indigo-500 inline-block" />
          )}
        </button>
      </div>

      {activeTab === 'assigned' && (
        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-500">Date</label>
              <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="border border-gray-300 rounded-md px-3 py-1 text-sm" />
            </div>
            {loading && <span className="text-sm text-gray-500">Loading...</span>}
            {error && <span className="text-sm text-red-600">{error}</span>}
          </div>
          {!loading && !error && !menu && <p className="text-sm text-gray-600">No assigned menu for this day.</p>}
          {!loading && !error && menu && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <MealBlock label={t('pages.clientJournal.breakfast')} items={menu.breakfastPlan || []} />
              <MealBlock label={t('pages.clientJournal.lunch')} items={menu.lunchPlan || []} />
              <MealBlock label={t('pages.clientJournal.dinner')} items={menu.dinnerPlan || []} />
              <MealBlock label={t('pages.clientJournal.snack')} items={menu.snackPlan || []} />
            </div>
          )}
        </div>
      )}

      {activeTab === 'templates' && (
        <div className="space-y-3">
          {templatesLoading && (
            <div className="flex items-center justify-center py-12">
              <svg className="animate-spin h-6 w-6 text-indigo-600" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          )}
          {templatesError && <p className="text-sm text-red-600">{templatesError}</p>}
          {!templatesLoading && !templatesError && groupedContainers.length === 0 && (
            <div className="bg-white border border-gray-200 rounded-lg p-6 text-center">
              <p className="text-sm text-gray-500">No meal plan templates found. Generate a meal plan from the Journal view.</p>
            </div>
          )}
          {!templatesLoading && !templatesError && groupedContainers.map(container => {
            const isHighlighted = highlightedContainerName.current === container.containerName
            return (
              <ContainerSection
                key={container.containerName || '__no_container__'}
                container={container}
                userId={userId}
                nutritionistId={nutritionistId}
                isHighlighted={isHighlighted}
                scrollRef={isHighlighted ? highlightScrollRef : null}
                onDeleteTemplate={handleDeleteTemplate}
                onDeleteContainer={handleDeleteContainer}
                onEditTemplate={handleEditTemplate}
                t={t}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

export default ClientMealPlans
