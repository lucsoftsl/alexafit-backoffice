import { useEffect, useMemo, useState } from 'react'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import {
  MagnifyingGlassIcon,
  PlusIcon,
  TrashIcon,
  PencilIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  XMarkIcon,
  ArrowLeftIcon,
  ArrowPathIcon,
  DocumentDuplicateIcon,
  GlobeAltIcon,
  DocumentTextIcon,
  UserGroupIcon,
  SparklesIcon
} from '@heroicons/react/24/outline'
import {
  searchFoodItems,
  getItemsByIds,
  copyMenuTemplateToCountry,
  generateMenuFromText
} from '../services/api'
import {
  getAllMenuTemplatesByUser,
  addMenuTemplateBO,
  updateMenuTemplateBO,
  deleteMenuTemplateByIdBO,
  renameMenuContainerBO,
  copyMenuContainerBO,
  copyMenuContainerToCountryBO,
  deleteMenuContainerBO,
  deleteMenuTemplateItemByIdBO,
  assignMenuTemplateToUserBO,
  assignMenuContainerToUserBO,
  reorderMenuContainerBO,
  removeMenuFromUserBO,
  getNutritionistClients,
  getUserMenusBO
} from '../services/loggedinApi'
import { selectIsAdmin, selectUserData } from '../store/userSlice'
import { useAuth } from '../contexts/AuthContext'
import ControlsDropdown from '../components/ControlsDropdown'
import {
  calculateDisplayValues,
  buildServingOptionsForMenuItem,
  detectIsRecipe,
  findDefaultServing,
  findServingByIdentifier,
  getServingIdentifier,
  safeNutrients
} from '../util/menuDisplay'
import { isImperialFromUserData } from '../util/units'
import { exportMenuBuilderToPdf } from '../util/menuPdfExport'

const defaultPlans = {
  breakfastPlan: [],
  lunchPlan: [],
  dinnerPlan: [],
  snackPlan: []
}

const mealTypeOptions = [
  { id: 'breakfastPlan', label: 'Breakfast' },
  { id: 'lunchPlan', label: 'Lunch' },
  { id: 'dinnerPlan', label: 'Dinner' },
  { id: 'snackPlan', label: 'Snack' }
]
const MENU_NAME_SEPARATOR = ':::'
const MENU_ORDER_SEPARATOR = '==='
const MENU_STUDIO_DRAFTS_STORAGE_KEY = 'alexafit_menu_studio_drafts_v1'

const glassCardClass =
  'relative overflow-hidden rounded-3xl border border-white/40 bg-white/70 backdrop-blur-xl shadow-[0_20px_80px_rgba(15,23,42,0.08)]'
const glassSurfaceClass =
  'rounded-2xl border border-white/50 bg-white/60 backdrop-blur-lg shadow-[0_10px_40px_rgba(15,23,42,0.08)]'
const softBadgeClass =
  'inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-white/80 text-gray-800 shadow-inner'
const parseNumber = value => {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}
const parseOptionalNumber = value => {
  if (value === '' || value === null || value === undefined) return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}
const normalizeServingUnitKey = unitRaw => {
  const key = String(unitRaw || '')
    .trim()
    .toLowerCase()

  if (key === 'grams' || key === 'gram' || key === 'gr') return 'g'
  if (
    key === 'milliliter' ||
    key === 'milliliters' ||
    key === 'millilitre' ||
    key === 'mililitri'
  )
    return 'ml'
  if (key === 'floz' || key === 'fluid ounce' || key === 'fluid ounces')
    return 'fl oz'
  return key
}
const OZ_TO_GRAMS = 28.3495
const FL_OZ_TO_ML = 29.5735
const parseNutrients = nutrients => {
  if (!nutrients) return {}
  if (typeof nutrients === 'object') return nutrients
  if (typeof nutrients === 'string') {
    try {
      const parsed = JSON.parse(nutrients)
      return parsed && typeof parsed === 'object' ? parsed : {}
    } catch {
      return {}
    }
  }
  return {}
}
const parseServingOptions = servingOptions => {
  if (!servingOptions) return []
  if (Array.isArray(servingOptions)) return servingOptions
  if (typeof servingOptions === 'string') {
    try {
      const parsed = JSON.parse(servingOptions)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
  return []
}
const normalizeMenuItemShape = item => {
  const servingOptions = parseServingOptions(item?.servingOptions)
  const caloriesPer100 = parseNumber(item?.caloriesPer100)
  const nutrientsPer100 = parseNutrients(item?.nutrientsPer100)
  return {
    ...item,
    servingOptions,
    caloriesPer100,
    nutrientsPer100,
    numberOfRecipeServings: item?.numberOfRecipeServings || 1
  }
}
const getServingAmount = serving =>
  parseNumber(serving?.value ?? serving?.amount ?? 0)
const getChangedServingBaseValue = (
  quantity,
  unitRaw,
  servingOption,
  isLiquid
) => {
  const normalizedQuantity = parseNumber(quantity)
  if (normalizedQuantity <= 0) return 0

  const normalizedUnit = normalizeServingUnitKey(
    unitRaw || servingOption?.unitName || (isLiquid ? 'ml' : 'g')
  )

  if (normalizedUnit === 'g' || normalizedUnit === 'ml') {
    return normalizedQuantity
  }

  if (normalizedUnit === 'oz') {
    return normalizedQuantity * OZ_TO_GRAMS
  }

  if (normalizedUnit === 'fl oz') {
    return normalizedQuantity * FL_OZ_TO_ML
  }

  const servingValue = getServingAmount(servingOption)
  if (servingValue > 0) {
    return normalizedQuantity * servingValue
  }

  return normalizedQuantity
}
const STANDARD_INPUT_UNITS = new Set([
  'g',
  'gram',
  'grams',
  'ml',
  'milliliter',
  'milliliters',
  'millilitre',
  'oz',
  'ounce',
  'ounces',
  'fl oz',
  'fluid ounce',
  'fluid ounces',
  'floz'
])
const getDefaultAmountForSelectedServing = serving => {
  const rawUnit = (
    serving?.unitName ||
    serving?.unit ||
    serving?.name ||
    serving?.innerName ||
    ''
  )
    .toString()
    .trim()
    .toLowerCase()
  if (STANDARD_INPUT_UNITS.has(rawUnit)) {
    return getServingAmount(serving) || 100
  }
  // Custom units (e.g. "serving", "cup", "slice") should default to 1 unit.
  return 1
}
const isTruthyFlag = value =>
  value === true || value === 1 || value === '1' || value === 'true'
const isFalsyFlag = value =>
  value === false || value === 0 || value === '0' || value === 'false'
const shouldHideLowQualitySearchItem = item =>
  isTruthyFlag(item?.isAIGenerated) && isFalsyFlag(item?.isVerified)
const findPortionServing = servingArray =>
  (servingArray || []).find(s => {
    const name = (s?.unitName || s?.name || s?.innerName || '').toLowerCase()
    return (
      name.includes('portion') ||
      name.includes('serving') ||
      name.includes('portie')
    )
  }) || null

const MENU_MEAL_SECTIONS = [
  { id: 'breakfastPlan', labelKey: 'pages.myMenus.breakfast' },
  { id: 'lunchPlan', labelKey: 'pages.myMenus.lunch' },
  { id: 'dinnerPlan', labelKey: 'pages.myMenus.dinner' },
  { id: 'snackPlan', labelKey: 'pages.myMenus.snack' }
]

const roundMacro = value =>
  Math.round((parseNumber(value) + Number.EPSILON) * 10) / 10
const shouldShowRecipeDetailsInPdf = item =>
  detectIsRecipe(item) ? item?.showRecipeDetailsInPdf === true : false
const parseIngredientNutrients = nutrients => {
  if (!nutrients) return {}
  if (typeof nutrients === 'object') return nutrients
  if (typeof nutrients === 'string') {
    try {
      const parsed = JSON.parse(nutrients)
      return parsed && typeof parsed === 'object' ? parsed : {}
    } catch {
      return {}
    }
  }
  return {}
}
const getIngredientAmountInBaseUnit = ingredient => {
  const quantity = parseNumber(ingredient?.quantity ?? ingredient?.weight)
  const unit = normalizeServingUnitKey(ingredient?.unit || 'g')

  if (unit === 'g' || unit === 'ml') return quantity
  if (unit === 'oz') return quantity * OZ_TO_GRAMS
  if (unit === 'fl oz') return quantity * FL_OZ_TO_ML

  const servingValue = parseNumber(ingredient?.value ?? ingredient?.amount)
  return servingValue > 0 ? quantity * servingValue : quantity
}
const toEditableIngredientEntry = ingredient => {
  const fallbackPer100 = getPer100FromRecipeIngredientTotals(ingredient)

  return {
    id: ingredient?.id || null,
    name: String(ingredient?.name || '').trim(),
    quantity:
      ingredient?.quantity !== undefined && ingredient?.quantity !== null
        ? ingredient.quantity
        : (ingredient?.weight ?? ''),
    unit: String(ingredient?.unit || 'g').trim() || 'g',
    caloriesPer100:
      parseNumber(ingredient?.caloriesPer100) || fallbackPer100.caloriesPer100,
    nutrientsPer100:
      Object.keys(parseIngredientNutrients(ingredient?.nutrientsPer100))
        .length > 0
        ? parseIngredientNutrients(ingredient?.nutrientsPer100)
        : fallbackPer100.nutrientsPer100
  }
}
const createEmptyEditableIngredient = () => ({
  id: null,
  name: '',
  quantity: '',
  unit: 'g',
  caloriesPer100: 0,
  nutrientsPer100: {}
})
const getPer100FromRecipeIngredientTotals = ingredient => {
  const baseWeight = parseNumber(
    ingredient?.quantity ??
      ingredient?.weight ??
      ingredient?.originalWeight ??
      ingredient?.weightInGrams
  )
  if (baseWeight <= 0) {
    return {
      caloriesPer100: 0,
      nutrientsPer100: {}
    }
  }

  return {
    caloriesPer100:
      (parseNumber(
        ingredient?.calorieAmount ?? ingredient?.originalCalorieAmount
      ) *
        100) /
      baseWeight,
    nutrientsPer100: {
      proteinsInGrams:
        (parseNumber(
          ingredient?.proteinAmount ?? ingredient?.originalProteinAmount
        ) *
          100) /
        baseWeight,
      carbohydratesInGrams:
        (parseNumber(
          ingredient?.carbohydateAmount ??
            ingredient?.carbohydrateAmount ??
            ingredient?.originalCarbohydrateAmount
        ) *
          100) /
        baseWeight,
      fatInGrams:
        (parseNumber(ingredient?.fatAmount ?? ingredient?.originalFatAmount) *
          100) /
        baseWeight
    }
  }
}
const mapItemToEditableIngredients = item => {
  const ingredients = Array.isArray(item?.ingredients) ? item.ingredients : []
  if (ingredients.length > 0) {
    return ingredients
      .map(toEditableIngredientEntry)
      .filter(entry => entry.name)
  }

  return Array.isArray(item?.ingredientNames)
    ? item.ingredientNames
        .map(entry => ({
          id: null,
          name: String(entry || '').trim(),
          quantity: '',
          unit: 'g',
          caloriesPer100: 0,
          nutrientsPer100: {}
        }))
        .filter(entry => entry.name)
    : []
}
const enrichRecipeIngredientsWithDetails = async ingredients => {
  if (!Array.isArray(ingredients) || ingredients.length === 0) {
    return []
  }

  const ingredientIds = ingredients
    .map(ingredient => ingredient?.id)
    .filter(Boolean)
  let detailedMap = {}

  if (ingredientIds.length > 0) {
    try {
      const ingredientResp = await getItemsByIds({ ids: ingredientIds })
      const detailedItems = ingredientResp?.data || ingredientResp?.items || []
      detailedMap = detailedItems.reduce((acc, item) => {
        const id = item?.id || item?.itemId || item?._id
        if (id) {
          acc[id] = normalizeMenuItemShape(item)
        }
        return acc
      }, {})
    } catch (error) {
      console.warn('Failed to enrich recipe ingredients', error)
    }
  }

  return ingredients.map(ingredient => {
    const detailed = ingredient?.id ? detailedMap[ingredient.id] : null
    const selectedIngredientUnit = ingredient?.unit || 'g'
    const selectedIngredientQuantity = parseNumber(
      ingredient?.quantity ?? ingredient?.weight ?? 0
    )
    const fallbackPer100 = getPer100FromRecipeIngredientTotals(ingredient)

    return {
      ...ingredient,
      id: ingredient?.id || detailed?.id || null,
      name: ingredient?.name || detailed?.name || '',
      quantity: selectedIngredientQuantity,
      weight: selectedIngredientQuantity,
      unit: selectedIngredientUnit,
      caloriesPer100:
        parseNumber(detailed?.caloriesPer100) ||
        parseNumber(ingredient?.caloriesPer100) ||
        fallbackPer100.caloriesPer100,
      nutrientsPer100:
        (detailed?.nutrientsPer100 &&
        Object.keys(parseIngredientNutrients(detailed.nutrientsPer100)).length >
          0
          ? parseIngredientNutrients(detailed.nutrientsPer100)
          : null) ||
        (Object.keys(parseIngredientNutrients(ingredient?.nutrientsPer100))
          .length > 0
          ? parseIngredientNutrients(ingredient?.nutrientsPer100)
          : null) ||
        fallbackPer100.nutrientsPer100,
      isLiquid: detailed?.isLiquid ?? ingredient?.isLiquid,
      servingOptions:
        detailed?.servingOptions ||
        parseServingOptions(ingredient?.servingOptions)
    }
  })
}
const hasIngredientNutritionData = ingredient => {
  const nutrients = parseIngredientNutrients(ingredient?.nutrientsPer100)
  return (
    parseNumber(ingredient?.caloriesPer100) > 0 ||
    parseNumber(nutrients?.proteinsInGrams) > 0 ||
    parseNumber(nutrients?.carbohydratesInGrams) > 0 ||
    parseNumber(nutrients?.fatInGrams) > 0
  )
}
const calculateStructuredMealIngredientNutrition = ingredient => {
  const amountInBaseUnit = getIngredientAmountInBaseUnit(ingredient)
  const nutrientsPer100 = parseIngredientNutrients(ingredient?.nutrientsPer100)
  const ratio = amountInBaseUnit / 100

  return {
    calories: parseNumber(ingredient?.caloriesPer100) * ratio,
    proteinsInGrams: parseNumber(nutrientsPer100?.proteinsInGrams) * ratio,
    carbohydratesInGrams:
      parseNumber(nutrientsPer100?.carbohydratesInGrams) * ratio,
    fatInGrams: parseNumber(nutrientsPer100?.fatInGrams) * ratio
  }
}
const calculateStructuredMealDraftSummary = draft =>
  (draft?.ingredients || []).reduce(
    (acc, ingredient) => {
      const ingredientTotals =
        calculateStructuredMealIngredientNutrition(ingredient)
      return {
        calories: acc.calories + ingredientTotals.calories,
        proteinsInGrams: acc.proteinsInGrams + ingredientTotals.proteinsInGrams,
        carbohydratesInGrams:
          acc.carbohydratesInGrams + ingredientTotals.carbohydratesInGrams,
        fatInGrams: acc.fatInGrams + ingredientTotals.fatInGrams
      }
    },
    {
      calories: 0,
      proteinsInGrams: 0,
      carbohydratesInGrams: 0,
      fatInGrams: 0
    }
  )
const isStructuredMealRecipeItem = item =>
  detectIsRecipe(item) &&
  Array.isArray(item?.ingredients) &&
  item.ingredients.length > 0
const calculateStructuredMealItemSummary = item => {
  const ingredientSummary = calculateStructuredMealDraftSummary({
    ingredients: item?.ingredients || []
  })

  if (
    ingredientSummary.calories > 0 ||
    ingredientSummary.proteinsInGrams > 0 ||
    ingredientSummary.carbohydratesInGrams > 0 ||
    ingredientSummary.fatInGrams > 0
  ) {
    return ingredientSummary
  }

  const calculated = calculateDisplayValues(
    item,
    getItemSelectedAmount(item),
    parseNumber(item?.originalServingAmount) || 100,
    getItemDisplayUnit(item)
  )
  const nutrients = safeNutrients(calculated?.nutrients || {})

  return {
    calories: parseNumber(calculated?.calories),
    proteinsInGrams: parseNumber(nutrients?.proteinsInGrams),
    carbohydratesInGrams: parseNumber(nutrients?.carbohydratesInGrams),
    fatInGrams: parseNumber(nutrients?.fatInGrams)
  }
}

const mapItemToEditableSteps = item =>
  Array.isArray(item?.recipeSteps?.instructions)
    ? item.recipeSteps.instructions
        .map(step => String(step || '').trim())
        .filter(Boolean)
    : []

const createStructuredMealDraft = ({
  mode,
  mealKey,
  item = null,
  itemIndex = null
}) => ({
  mode,
  mealKey,
  itemIndex,
  baseItem: item ? normalizeMenuItemShape(item) : null,
  name: String(item?.name || '').trim(),
  photoUrl: String(item?.photoUrl || '').trim(),
  ingredients: mapItemToEditableIngredients(item),
  steps: mapItemToEditableSteps(item),
  showRecipeDetailsInPdf: shouldShowRecipeDetailsInPdf(item),
  recipeSearchText: '',
  recipeSearchResults: [],
  searchingRecipes: false,
  ingredientSearchText: '',
  ingredientSearchResults: [],
  searchingIngredients: false,
  numberOfRecipeServings:
    parseNumber(item?.numberOfRecipeServings || item?.originalServings) || 1
})

const applyRecipeToStructuredMealDraft = (draft, item) => {
  const normalizedItem = normalizeMenuItemShape(item)
  return {
    ...draft,
    baseItem: normalizedItem,
    name: String(normalizedItem?.name || draft?.name || '').trim(),
    photoUrl: String(normalizedItem?.photoUrl || '').trim(),
    ingredients: mapItemToEditableIngredients(normalizedItem),
    steps: mapItemToEditableSteps(normalizedItem),
    numberOfRecipeServings:
      parseNumber(
        normalizedItem?.numberOfRecipeServings ||
          normalizedItem?.originalServings
      ) ||
      draft?.numberOfRecipeServings ||
      1
  }
}

const buildStructuredMealItemFromDraft = draft => {
  const ingredients = (draft?.ingredients || [])
    .map(entry => ({
      id: entry?.id || null,
      name: String(entry?.name || '').trim(),
      quantity:
        entry?.quantity === '' ||
        entry?.quantity === null ||
        entry?.quantity === undefined
          ? ''
          : parseNumber(entry.quantity),
      weight:
        entry?.quantity === '' ||
        entry?.quantity === null ||
        entry?.quantity === undefined
          ? ''
          : parseNumber(entry.quantity),
      unit: String(entry?.unit || 'g').trim() || 'g',
      caloriesPer100: parseNumber(entry?.caloriesPer100),
      nutrientsPer100: parseIngredientNutrients(entry?.nutrientsPer100)
    }))
    .filter(entry => entry.name)
  const ingredientNames = ingredients.map(entry => entry.name)
  const instructions = (draft?.steps || [])
    .map(entry => String(entry || '').trim())
    .filter(Boolean)
  const baseItem = draft?.baseItem ? { ...draft.baseItem } : {}
  const servings = parseNumber(draft?.numberOfRecipeServings) || 1
  const recipeTotals = ingredients.reduce(
    (acc, ingredient) => {
      const amountInBaseUnit = getIngredientAmountInBaseUnit(ingredient)
      const nutrientsPer100 = parseIngredientNutrients(
        ingredient?.nutrientsPer100
      )
      return {
        calories:
          acc.calories +
          (parseNumber(ingredient?.caloriesPer100) * amountInBaseUnit) / 100,
        totalQuantity: acc.totalQuantity + amountInBaseUnit,
        proteinsInGrams:
          acc.proteinsInGrams +
          (amountInBaseUnit * parseNumber(nutrientsPer100?.proteinsInGrams)) /
            100,
        carbohydratesInGrams:
          acc.carbohydratesInGrams +
          (amountInBaseUnit *
            parseNumber(nutrientsPer100?.carbohydratesInGrams)) /
            100,
        fatInGrams:
          acc.fatInGrams +
          (amountInBaseUnit * parseNumber(nutrientsPer100?.fatInGrams)) / 100
      }
    },
    {
      calories: 0,
      totalQuantity: 0,
      proteinsInGrams: 0,
      carbohydratesInGrams: 0,
      fatInGrams: 0
    }
  )
  const recipeTotalQuantity = recipeTotals.totalQuantity || 100
  const caloriesPer100 = (recipeTotals.calories / recipeTotalQuantity) * 100
  const nutrientsPer100 = {
    proteinsInGrams: (recipeTotals.proteinsInGrams / recipeTotalQuantity) * 100,
    carbohydratesInGrams:
      (recipeTotals.carbohydratesInGrams / recipeTotalQuantity) * 100,
    fatInGrams: (recipeTotals.fatInGrams / recipeTotalQuantity) * 100
  }

  return {
    ...baseItem,
    type: 'recipe',
    name: String(draft?.name || '').trim(),
    photoUrl: String(draft?.photoUrl || '').trim(),
    ingredientNames,
    ingredients,
    recipeSteps: {
      ...(baseItem?.recipeSteps || {}),
      instructions
    },
    showRecipeDetailsInPdf:
      draft?.mealKey === 'snackPlan'
        ? true
        : draft?.showRecipeDetailsInPdf === true,
    numberOfRecipeServings: servings,
    originalServings: servings,
    caloriesPer100,
    nutrientsPer100,
    originalServingAmount: recipeTotalQuantity,
    originalServingId: null,
    servingOptions: [],
    quantity: recipeTotalQuantity,
    changedServing: null
  }
}
const getMenuItemTotalCalories = item => {
  const calculated = calculateDisplayValues(
    item,
    getItemSelectedAmount(item),
    parseNumber(item?.originalServingAmount) || 100,
    getItemDisplayUnit(item)
  )

  return parseNumber(calculated?.calories)
}
const getPreferredStructuredMealAmount = (item, selectedServing = null) => {
  if (selectedServing) {
    return getDefaultAmountForSelectedServing(selectedServing)
  }

  const changedQuantity = parseOptionalNumber(item?.changedServing?.quantity)
  if (changedQuantity !== null && changedQuantity > 0) {
    return changedQuantity
  }

  const changedValue = parseOptionalNumber(item?.changedServing?.value)
  if (changedValue !== null && changedValue > 0) {
    return changedValue
  }

  const quantity = parseOptionalNumber(item?.quantity)
  if (quantity !== null && quantity > 0) {
    return quantity
  }

  const originalServingAmount = parseOptionalNumber(item?.originalServingAmount)
  if (originalServingAmount !== null && originalServingAmount > 0) {
    return originalServingAmount
  }

  return 100
}
const parsePositiveOrder = value => {
  const parsed = Number.parseInt(String(value || '').trim(), 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

const splitMenuName = name => {
  const normalizedName = String(name || '').trim()
  const [containerPart, ...menuParts] =
    normalizedName.split(MENU_NAME_SEPARATOR)

  if (menuParts.length === 0) {
    return {
      containerName: '',
      menuName: normalizedName,
      order: null,
      hasContainer: false,
      hasExplicitOrder: false
    }
  }

  const joinedMenuName = menuParts.join(MENU_NAME_SEPARATOR).trim()
  const orderSeparatorIndex = joinedMenuName.lastIndexOf(MENU_ORDER_SEPARATOR)

  if (orderSeparatorIndex !== -1) {
    const maybeMenuName = joinedMenuName.slice(0, orderSeparatorIndex).trim()
    const maybeOrder = parsePositiveOrder(
      joinedMenuName.slice(orderSeparatorIndex + MENU_ORDER_SEPARATOR.length)
    )

    if (maybeOrder !== null) {
      return {
        containerName: containerPart.trim(),
        menuName: maybeMenuName || joinedMenuName,
        order: maybeOrder,
        hasContainer: true,
        hasExplicitOrder: true
      }
    }
  }

  return {
    containerName: containerPart.trim(),
    menuName: joinedMenuName,
    order: null,
    hasContainer: true,
    hasExplicitOrder: false
  }
}

const buildStoredMenuName = (containerName, menuName, order = null) => {
  const normalizedContainerName = String(containerName || '').trim()
  const normalizedMenuName = String(menuName || '').trim()
  const normalizedOrder = parsePositiveOrder(order)

  if (!normalizedContainerName) {
    return normalizedMenuName
  }

  const menuNameWithOrder =
    normalizedOrder !== null
      ? `${normalizedMenuName} ${MENU_ORDER_SEPARATOR} ${normalizedOrder}`
      : normalizedMenuName

  return `${normalizedContainerName} ${MENU_NAME_SEPARATOR} ${menuNameWithOrder}`
}

const getFallbackMenuOrder = (menu, fallbackIndex = 0) => {
  const parsed = splitMenuName(menu?.name || '')
  if (parsed.order !== null) {
    return parsed.order
  }

  const createdAt = menu?.dateTimeCreated
    ? new Date(menu.dateTimeCreated).getTime()
    : Number.NaN
  if (Number.isFinite(createdAt)) {
    return createdAt
  }

  return fallbackIndex + 1
}

const getNextContainerMenuOrder = container =>
  (container?.menus || []).reduce((maxOrder, menu, index) => {
    const parsedOrder = splitMenuName(menu?.name || '').order
    return Math.max(maxOrder, parsedOrder ?? index + 1)
  }, 0) + 1

const getNextContainerMenuLabel = (container, dayLabel = 'Day') => {
  const normalizedDayLabel = String(dayLabel || 'Day').trim() || 'Day'
  const existingMenuNames = new Set(
    (container?.menus || []).map(menu =>
      splitMenuName(menu?.name || '')
        .menuName.trim()
        .toLowerCase()
    )
  )

  let nextOrder = getNextContainerMenuOrder(container)
  let candidateName = `${normalizedDayLabel} ${nextOrder}`

  while (existingMenuNames.has(candidateName.toLowerCase())) {
    nextOrder += 1
    candidateName = `${normalizedDayLabel} ${nextOrder}`
  }

  return candidateName
}

const moveItemInArray = (items, fromIndex, toIndex) => {
  const nextItems = [...items]
  const [movedItem] = nextItems.splice(fromIndex, 1)
  nextItems.splice(toIndex, 0, movedItem)
  return nextItems
}

const addDaysToIsoDate = (dateString, dayOffset = 0) => {
  const [year, month, day] = String(dateString || '')
    .split('-')
    .map(value => Number.parseInt(value, 10))

  if (!year || !month || !day) {
    return dateString
  }

  const date = new Date(Date.UTC(year, month - 1, day + dayOffset))
  return date.toISOString().split('T')[0]
}

const formatAssignmentDate = (dateString, language = 'en') => {
  const [year, month, day] = String(dateString || '')
    .split('-')
    .map(value => Number.parseInt(value, 10))

  if (!year || !month || !day) {
    return String(dateString || '')
  }

  const date = new Date(Date.UTC(year, month - 1, day))
  const formatter = new Intl.DateTimeFormat(language, {
    year: 'numeric',
    month: 'long',
    day: '2-digit',
    timeZone: 'UTC'
  })
  const parts = formatter.formatToParts(date)
  const partMap = Object.fromEntries(
    parts
      .filter(part => part.type !== 'literal')
      .map(part => [part.type, part.value])
  )

  return `${partMap.year || String(year)} - ${partMap.month || ''} - ${partMap.day || String(day).padStart(2, '0')}`
}

const getItemDisplayUnit = item => {
  const changedServingUnit =
    item?.changedServing?.servingOption?.unitName || item?.changedServing?.unit

  if (changedServingUnit) {
    return changedServingUnit
  }

  if (item?.originalServingId) {
    const serving = findServingByIdentifier(
      item?.servingOptions,
      item.originalServingId
    )
    if (serving?.unitName || serving?.unit) {
      return serving?.unitName || serving?.unit
    }
  }

  return item?.unit || (item?.isLiquid ? 'ml' : 'g')
}

const getItemSelectedAmount = item => {
  const changedQuantity = parseNumber(item?.changedServing?.quantity)
  if (changedQuantity > 0) {
    return changedQuantity
  }

  const changedValue = parseNumber(item?.changedServing?.value)
  if (changedValue > 0) {
    return changedValue
  }

  const quantity = parseNumber(item?.quantity)
  if (quantity > 0) {
    return quantity
  }

  const originalServingAmount = parseNumber(item?.originalServingAmount)
  if (originalServingAmount > 0) {
    return originalServingAmount
  }

  return 100
}

const getTemplateMealTotals = items =>
  (items || []).reduce(
    (acc, item) => {
      const structuredMealSummary = isStructuredMealRecipeItem(item)
        ? calculateStructuredMealItemSummary(item)
        : null
      const calculated = structuredMealSummary
        ? {
            calories: structuredMealSummary.calories,
            nutrients: structuredMealSummary
          }
        : calculateDisplayValues(
            item,
            getItemSelectedAmount(item),
            parseNumber(item?.originalServingAmount) || 100,
            getItemDisplayUnit(item)
          )

      return {
        calories: acc.calories + parseNumber(calculated?.calories),
        proteinsInGrams:
          acc.proteinsInGrams +
          parseNumber(calculated?.nutrients?.proteinsInGrams),
        carbohydratesInGrams:
          acc.carbohydratesInGrams +
          parseNumber(calculated?.nutrients?.carbohydratesInGrams),
        fatInGrams:
          acc.fatInGrams + parseNumber(calculated?.nutrients?.fatInGrams)
      }
    },
    {
      calories: 0,
      proteinsInGrams: 0,
      carbohydratesInGrams: 0,
      fatInGrams: 0
    }
  )

const getTemplateNutritionSummary = template => {
  const perMeal = MENU_MEAL_SECTIONS.reduce((acc, section) => {
    acc[section.id] = getTemplateMealTotals(template?.[section.id] || [])
    return acc
  }, {})

  return {
    perMeal,
    total: Object.values(perMeal).reduce(
      (acc, totals) => ({
        calories: acc.calories + parseNumber(totals?.calories),
        proteinsInGrams:
          acc.proteinsInGrams + parseNumber(totals?.proteinsInGrams),
        carbohydratesInGrams:
          acc.carbohydratesInGrams + parseNumber(totals?.carbohydratesInGrams),
        fatInGrams: acc.fatInGrams + parseNumber(totals?.fatInGrams)
      }),
      {
        calories: 0,
        proteinsInGrams: 0,
        carbohydratesInGrams: 0,
        fatInGrams: 0
      }
    )
  }
}

const MyMenus = () => {
  const { t, i18n } = useTranslation()
  const [showBuilderModal, setShowBuilderModal] = useState(false)
  const [menuContainerName, setMenuContainerName] = useState('')
  const [menuName, setMenuName] = useState('')
  const [numberOfDays, setNumberOfDays] = useState('1')
  const [addingToExistingContainer, setAddingToExistingContainer] =
    useState(false)
  const [countryCode, setCountryCode] = useState('RO')
  const [activeMealType, setActiveMealType] = useState('breakfastPlan')
  const [plans, setPlans] = useState(defaultPlans)
  const [searchText, setSearchText] = useState('')
  const [onlyRecipes, setOnlyRecipes] = useState(false)
  const [isAssignableByUser, setIsAssignableByUser] = useState(false)
  const [searching, setSearching] = useState(false)
  const [searchResults, setSearchResults] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [templates, setTemplates] = useState([])
  const [loadingTemplates, setLoadingTemplates] = useState(false)
  const [editingTemplateId, setEditingTemplateId] = useState(null)
  const [clients, setClients] = useState([])

  const [loadingClients, setLoadingClients] = useState(false)
  const [selectedClientId, setSelectedClientId] = useState(null)
  const [assignmentDate, setAssignmentDate] = useState(
    new Date().toISOString().split('T')[0]
  )
  const [assigningMenu, setAssigningMenu] = useState(false)
  const [assigningContainer, setAssigningContainer] = useState(false)
  const [assignmentMode, setAssignmentMode] = useState('menu')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)
  const [templateSearchTerm, setTemplateSearchTerm] = useState('')
  const [templateFilter, setTemplateFilter] = useState('all')
  const [isTemplateFilterOpen, setIsTemplateFilterOpen] = useState(false)
  const [selectedContainerKey, setSelectedContainerKey] = useState(null)
  const [selectedContainerModalOpen, setSelectedContainerModalOpen] =
    useState(false)
  const [selectedContainerMenuId, setSelectedContainerMenuId] = useState(null)
  const [displayValues, setDisplayValues] = useState({})
  const [viewingItem, setViewingItem] = useState(null)
  const [templatesExpanded, setTemplatesExpanded] = useState(true)
  const [expandedClientMenus, setExpandedClientMenus] = useState({})
  const [clientMenusData, setClientMenusData] = useState({})
  const [loadingClientMenus, setLoadingClientMenus] = useState({})
  // Copy template modal state
  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false)
  const [selectedTemplateForCopy, setSelectedTemplateForCopy] = useState(null)
  const [copyCountryCode, setCopyCountryCode] = useState('RO')
  const [copyMenuName, setCopyMenuName] = useState('')
  const [copyingTemplate, setCopyingTemplate] = useState(false)

  // Text-to-menu modal state
  const [isTextToMenuOpen, setIsTextToMenuOpen] = useState(false)
  const [textToMenuInput, setTextToMenuInput] = useState('')
  const [textToMenuName, setTextToMenuName] = useState('')
  const [textToMenuCountry, setTextToMenuCountry] = useState('RO')
  const [generatingMenu, setGeneratingMenu] = useState(false)
  const [textToMenuContainerContext, setTextToMenuContainerContext] =
    useState(null)

  const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false)
  const [selectedTemplateForDuplicate, setSelectedTemplateForDuplicate] =
    useState(null)
  const [duplicateMenuName, setDuplicateMenuName] = useState('')
  const [duplicatingTemplate, setDuplicatingTemplate] = useState(false)
  const [isRenameContainerModalOpen, setIsRenameContainerModalOpen] =
    useState(false)
  const [selectedContainerForRename, setSelectedContainerForRename] =
    useState(null)
  const [renameContainerName, setRenameContainerName] = useState('')
  const [renamingContainer, setRenamingContainer] = useState(false)
  const [isCopyContainerModalOpen, setIsCopyContainerModalOpen] =
    useState(false)
  const [selectedContainerForCopy, setSelectedContainerForCopy] = useState(null)
  const [exportingContainerPdf, setExportingContainerPdf] = useState(false)
  const [copyContainerName, setCopyContainerName] = useState('')
  const [copyingContainer, setCopyingContainer] = useState(false)
  const [
    isCopyContainerToCountryModalOpen,
    setIsCopyContainerToCountryModalOpen
  ] = useState(false)
  const [selectedContainerForCountryCopy, setSelectedContainerForCountryCopy] =
    useState(null)
  const [copyContainerToCountryName, setCopyContainerToCountryName] =
    useState('')
  const [copyContainerToCountryCode, setCopyContainerToCountryCode] =
    useState('RO')
  const [copyingContainerToCountry, setCopyingContainerToCountry] =
    useState(false)
  const [deletingContainerKey, setDeletingContainerKey] = useState(null)
  const [deletingTemplateId, setDeletingTemplateId] = useState(null)
  const [draggedContainerMenuId, setDraggedContainerMenuId] = useState(null)
  const [reorderingContainer, setReorderingContainer] = useState(false)
  const [isAssignContainerPreviewOpen, setIsAssignContainerPreviewOpen] =
    useState(false)
  const [studioActiveMealType, setStudioActiveMealType] = useState(null)
  const [studioSearchText, setStudioSearchText] = useState('')
  const [studioSearchResults, setStudioSearchResults] = useState([])
  const [studioSearching, setStudioSearching] = useState(false)
  const [studioOnlyRecipes, setStudioOnlyRecipes] = useState(false)
  const [studioEditingItemKey, setStudioEditingItemKey] = useState(null)
  const [studioDraftValues, setStudioDraftValues] = useState({})
  const [structuredMealEditor, setStructuredMealEditor] = useState(null)
  const [savingStudioMenu, setSavingStudioMenu] = useState(false)
  const [viewingItemServingId, setViewingItemServingId] = useState('')
  const [viewingItemAmount, setViewingItemAmount] = useState('')
  const [menuStudioDrafts, setMenuStudioDrafts] = useState({})
  const userData = useSelector(selectUserData)
  const isAdmin = useSelector(selectIsAdmin)
  const { currentUser } = useAuth()
  const isEditingContainerMenu = Boolean(
    editingTemplateId && menuContainerName.trim()
  )
  const isContainerScopedBuilder =
    addingToExistingContainer || isEditingContainerMenu
  const isImperial = isImperialFromUserData(userData?.userData || userData)
  // Template builder should always expose both metric and imperial options.
  const includeImperialServingOptions = true
  const roundServingAmountByUnitSystem = value => {
    const n = parseNumber(value)
    const decimals = isImperial ? 2 : 1
    const factor = 10 ** decimals
    return Math.round(n * factor) / factor
  }

  const nutritionistId = currentUser?.uid || userData?.userId

  const updateTemplateInState = updatedMenu =>
    setTemplates(prevTemplates =>
      prevTemplates.map(template =>
        template?.id === updatedMenu?.id ? updatedMenu : template
      )
    )

  const openStructuredMealEditor = async ({
    mode,
    mealKey,
    item = null,
    itemIndex = null
  }) => {
    const initialDraft = createStructuredMealDraft({
      mode,
      mealKey,
      item,
      itemIndex
    })
    setStructuredMealEditor(initialDraft)

    if (
      detectIsRecipe(item) &&
      Array.isArray(item?.ingredients) &&
      item.ingredients.some(
        ingredient => ingredient?.id && !hasIngredientNutritionData(ingredient)
      )
    ) {
      const enrichedIngredients = await enrichRecipeIngredientsWithDetails(
        item.ingredients
      )
      setStructuredMealEditor(prev => {
        if (!prev) return prev
        const isSameTarget =
          prev.mode === mode &&
          prev.mealKey === mealKey &&
          prev.itemIndex === itemIndex &&
          prev.name === initialDraft.name
        if (!isSameTarget) return prev

        return {
          ...prev,
          ingredients: enrichedIngredients
            .map(toEditableIngredientEntry)
            .filter(entry => entry.name)
        }
      })
    }
  }

  const closeStructuredMealEditor = () => setStructuredMealEditor(null)

  const updateStructuredMealEditor = updater =>
    setStructuredMealEditor(prev =>
      typeof updater === 'function' ? updater(prev) : updater
    )

  const handleStructuredMealRecipeSearch = async query => {
    if (!query?.trim()) return []
    const data = await searchFoodItems({
      searchText: query.trim(),
      userId: nutritionistId,
      onlyRecipes: true,
      countryCode
    })
    return (Array.isArray(data) ? data : []).filter(
      item => !shouldHideLowQualitySearchItem(item)
    )
  }

  const handleStructuredMealIngredientSearch = async query => {
    if (!query?.trim()) return []
    const data = await searchFoodItems({
      searchText: query.trim(),
      userId: nutritionistId,
      onlyRecipes: false,
      countryCode
    })

    return (Array.isArray(data) ? data : [])
      .filter(item => !shouldHideLowQualitySearchItem(item))
      .filter(item => !detectIsRecipe(item))
  }

  const importIngredientIntoStructuredMeal = async ingredientItem => {
    const id =
      ingredientItem?.id || ingredientItem?.itemId || ingredientItem?._id
    let normalizedIngredient = normalizeMenuItemShape(ingredientItem)

    if (id) {
      try {
        const resp = await getItemsByIds({ ids: [id] })
        const detailed = resp?.data?.[0] || resp?.items?.[0]
        if (detailed) {
          normalizedIngredient = normalizeMenuItemShape(detailed)
        }
      } catch (error) {
        console.warn('Failed to load structured meal ingredient details', error)
      }
    }

    updateStructuredMealEditor(prev => ({
      ...prev,
      ingredientSearchText: '',
      ingredientSearchResults: [],
      searchingIngredients: false,
      ingredients: [
        ...prev.ingredients,
        {
          id:
            normalizedIngredient?.id ||
            normalizedIngredient?.itemId ||
            normalizedIngredient?._id ||
            null,
          name: String(normalizedIngredient?.name || '').trim(),
          quantity: 100,
          weight: 100,
          unit: normalizedIngredient?.isLiquid ? 'ml' : 'g',
          caloriesPer100: parseNumber(normalizedIngredient?.caloriesPer100),
          nutrientsPer100: parseIngredientNutrients(
            normalizedIngredient?.nutrientsPer100
          )
        }
      ]
    }))
  }

  const importRecipeIntoStructuredMeal = async item => {
    const enrichedItem = await prepareItemForMenuPlan(item)
    updateStructuredMealEditor(prev =>
      applyRecipeToStructuredMealDraft(prev, enrichedItem)
    )
  }

  const getInitialServingSelection = item => {
    const servingOptions = buildServingOptionsForMenuItem(
      item,
      includeImperialServingOptions
    )
    let selectedServing =
      findServingByIdentifier(
        servingOptions,
        item?.changedServing?.servingOption
          ? getServingIdentifier(item.changedServing.servingOption)
          : item?.originalServingId
      ) || null

    if (detectIsRecipe(item)) {
      const portionServing = findPortionServing(servingOptions)
      if (portionServing) selectedServing = portionServing
    }

    if (!selectedServing) {
      selectedServing = findDefaultServing(servingOptions) || servingOptions[0]
    }

    const changedQuantity = parseOptionalNumber(item?.changedServing?.quantity)
    const changedValue = parseOptionalNumber(item?.changedServing?.value)
    const initialAmount =
      changedQuantity ??
      changedValue ??
      getPreferredStructuredMealAmount(item, selectedServing)

    return {
      servingOptions,
      selectedServing,
      selectedServingId: getServingIdentifier(selectedServing) || '',
      amount: initialAmount
    }
  }

  const stageStudioMenuChanges = updatedMenu => {
    if (!updatedMenu?.id) return
    setMenuStudioDrafts(prev => ({
      ...prev,
      [updatedMenu.id]: updatedMenu
    }))
    setError(null)
  }

  const clearStudioMenuDraft = menuId => {
    if (!menuId) return
    setMenuStudioDrafts(prev => {
      const next = { ...prev }
      delete next[menuId]
      return next
    })
  }

  const persistStudioMenuChanges = async updatedMenu => {
    setSavingStudioMenu(true)
    try {
      await updateMenuTemplateBO({
        menuTemplateId: updatedMenu.id,
        name: updatedMenu.name,
        breakfastPlan: updatedMenu.breakfastPlan || [],
        lunchPlan: updatedMenu.lunchPlan || [],
        dinnerPlan: updatedMenu.dinnerPlan || [],
        snackPlan: updatedMenu.snackPlan || [],
        isAssignableByUser: isAdmin ? !!updatedMenu.isAssignableByUser : false,
        createdByUserId: nutritionistId
      })
      updateTemplateInState(updatedMenu)
      clearStudioMenuDraft(updatedMenu.id)
      setError(null)
    } catch (e) {
      console.error('Failed to update studio menu', e)
      setError(t('pages.myMenus.failedSaveTemplate'))
      throw e
    } finally {
      setSavingStudioMenu(false)
    }
  }

  const updateSelectedMenuInContainer = updater => {
    if (!selectedMenuInContainer) return null
    const updatedMenu =
      typeof updater === 'function' ? updater(selectedMenuInContainer) : updater

    if (!updatedMenu) return null

    updateTemplateInState(updatedMenu)
    return updatedMenu
  }

  const loadTemplates = async () => {
    try {
      setLoadingTemplates(true)
      const data = await getAllMenuTemplatesByUser({
        createdByUserId: nutritionistId
      })
      const nextTemplates = Array.isArray(data?.data)
        ? data.data
        : data?.templates || []
      setTemplates(nextTemplates)
      return nextTemplates
    } catch (e) {
      console.error('Failed to load menu templates', e)
      setError(t('pages.myMenus.failedLoadTemplates'))
      return []
    } finally {
      setLoadingTemplates(false)
    }
  }

  const loadClientMenus = async (clientId, templateId) => {
    if (clientMenusData[`${templateId}-${clientId}`]) {
      // Already loaded, just toggle
      return
    }

    try {
      setLoadingClientMenus(prev => ({
        ...prev,
        [`${templateId}-${clientId}`]: true
      }))

      const response = await getUserMenusBO({ userId: clientId })
      const menus = Array.isArray(response?.data)
        ? response.data
        : response?.menus || []

      // Filter menus for this specific template
      const filteredMenus = menus.filter(m => m.menuTemplateId === templateId)

      setClientMenusData(prev => ({
        ...prev,
        [`${templateId}-${clientId}`]: filteredMenus
      }))
    } catch (e) {
      console.error('Failed to load client menus', e)
      setClientMenusData(prev => ({
        ...prev,
        [`${templateId}-${clientId}`]: []
      }))
    } finally {
      setLoadingClientMenus(prev => ({
        ...prev,
        [`${templateId}-${clientId}`]: false
      }))
    }
  }

  const toggleClientMenus = async (templateId, clientId) => {
    const key = `${templateId}-${clientId}`
    if (!expandedClientMenus[key]) {
      // Loading for first time
      await loadClientMenus(clientId, templateId)
    }
    setExpandedClientMenus(prev => ({
      ...prev,
      [key]: !prev[key]
    }))
  }

  const loadClients = async () => {
    try {
      setLoadingClients(true)
      const data = await getNutritionistClients({ nutritionistId })
      setClients(Array.isArray(data?.data) ? data.data : data?.clients || [])
    } catch (e) {
      console.error('Failed to load clients', e)
      setError(t('pages.myMenus.failedLoadClients'))
    } finally {
      setLoadingClients(false)
    }
  }

  const resetBuilder = () => {
    setMenuContainerName('')
    setMenuName('')
    setNumberOfDays('1')
    setAddingToExistingContainer(false)
    setPlans(defaultPlans)
    setDisplayValues({})
    setEditingTemplateId(null)
    setIsAssignableByUser(false)
  }

  const openBuilderForNew = () => {
    resetBuilder()
    setAddingToExistingContainer(false)
    setShowBuilderModal(true)
  }

  const openBuilderForContainer = container => {
    resetBuilder()
    setMenuContainerName(container?.containerName || '')
    setMenuName(
      getNextContainerMenuLabel(container, t('pages.myMenus.dayLabel'))
    )
    setNumberOfDays('1')
    setAddingToExistingContainer(true)
    setShowBuilderModal(true)
  }

  useEffect(() => {
    if (nutritionistId) {
      loadTemplates()
      loadClients()
    }
  }, [nutritionistId])

  useEffect(() => {
    try {
      const rawDrafts = localStorage.getItem(MENU_STUDIO_DRAFTS_STORAGE_KEY)
      if (!rawDrafts) return
      const parsedDrafts = JSON.parse(rawDrafts)
      if (parsedDrafts && typeof parsedDrafts === 'object') {
        setMenuStudioDrafts(parsedDrafts)
      }
    } catch (error) {
      console.error('Failed to load menu studio drafts', error)
    }
  }, [])

  useEffect(() => {
    try {
      if (Object.keys(menuStudioDrafts).length === 0) {
        localStorage.removeItem(MENU_STUDIO_DRAFTS_STORAGE_KEY)
        return
      }
      localStorage.setItem(
        MENU_STUDIO_DRAFTS_STORAGE_KEY,
        JSON.stringify(menuStudioDrafts)
      )
    } catch (error) {
      console.error('Failed to persist menu studio drafts', error)
    }
  }, [menuStudioDrafts])

  useEffect(() => {
    if (!viewingItem) {
      setViewingItemServingId('')
      setViewingItemAmount('')
      return
    }

    const initialSelection = getInitialServingSelection(viewingItem)
    setViewingItemServingId(initialSelection.selectedServingId)
    setViewingItemAmount(String(initialSelection.amount || ''))
  }, [viewingItem])

  const handleSearch = async e => {
    e.preventDefault()
    if (!searchText.trim()) return
    setSearching(true)
    try {
      const data = await searchFoodItems({
        searchText,
        userId: nutritionistId,
        onlyRecipes,
        countryCode
      })
      const normalizedResults = Array.isArray(data) ? data : []
      setSearchResults(
        normalizedResults.filter(item => !shouldHideLowQualitySearchItem(item))
      )
    } catch (e) {
      console.error('Search failed', e)
      setError(t('pages.myMenus.failedSearchFood'))
    } finally {
      setSearching(false)
    }
  }

  const addItemToPlan = async (item, selectionOverride = null) => {
    try {
      let enriched = normalizeMenuItemShape(item)
      // Store original serving info - try to get from serving array or default
      let originalServingAmount = 100 // Default to 100g if no serving info
      let originalServingId = null

      if (
        Array.isArray(enriched?.servingOptions) &&
        enriched.servingOptions.length > 0
      ) {
        // Use findDefaultServing to get the default serving for per-100 calculations
        const defaultServing = findDefaultServing(enriched.servingOptions)
        originalServingAmount = getServingAmount(defaultServing) || 100
        originalServingId = getServingIdentifier(defaultServing)
      }

      // Fetch detailed info for both recipes and foods to get complete serving array
      try {
        const id = item?.id || item?.itemId || item?._id
        if (id) {
          const resp = await getItemsByIds({ ids: [id] })
          const detailed = resp?.data?.[0] || resp?.items?.[0]
          if (detailed) {
            const normalizedDetailed = normalizeMenuItemShape(detailed)
            if (detectIsRecipe(item)) {
              // Store original values for scaling
              const originalServings =
                normalizedDetailed?.numberOfRecipeServings || 1
              // Get original serving info from detailed item if available
              // For recipes, caloriesPer100 is scaled by selected serving
              // We need to find the total weight for all servings
              if (
                normalizedDetailed?.servingOptions &&
                Array.isArray(normalizedDetailed.servingOptions) &&
                normalizedDetailed.servingOptions.length > 0
              ) {
                const portionServing = findPortionServing(
                  normalizedDetailed.servingOptions
                )
                if (portionServing) {
                  // Portion amount is per 1 serving, so multiply by numberOfRecipeServings for total
                  originalServingAmount =
                    getServingAmount(portionServing) * originalServings
                  originalServingId = getServingIdentifier(portionServing)
                } else {
                  // Fall back to totalQuantity or weightAfterCooking if available
                  const totalWeight =
                    detailed?.weightAfterCooking ||
                    normalizedDetailed?.weightAfterCooking ||
                    null
                  if (totalWeight) {
                    originalServingAmount = totalWeight
                    // Use default serving for ID
                    const defaultServing = findDefaultServing(
                      normalizedDetailed.servingOptions
                    )
                    originalServingId = getServingIdentifier(defaultServing)
                  } else {
                    // Last resort: use default serving and multiply by numberOfRecipeServings
                    const defaultServing = findDefaultServing(
                      normalizedDetailed.servingOptions
                    )
                    originalServingAmount =
                      (getServingAmount(defaultServing) || 100) *
                      originalServings
                    originalServingId = getServingIdentifier(defaultServing)
                  }
                }
              }

              const enrichedData = {
                ...item,
                ...normalizedDetailed,
                originalServings,
                originalCalories: normalizedDetailed?.caloriesPer100,
                originalNutrients: normalizedDetailed?.nutrientsPer100,
                numberOfRecipeServings: originalServings,
                showRecipeDetailsInPdf: item?.showRecipeDetailsInPdf === true,
                originalServingAmount,
                originalServingId
              }

              // Scale ingredients to match serving count
              if (
                normalizedDetailed?.ingredients &&
                Array.isArray(normalizedDetailed.ingredients)
              ) {
                enrichedData.ingredients =
                  await enrichRecipeIngredientsWithDetails(
                    normalizedDetailed.ingredients.map(ingredient => ({
                      ...ingredient,
                      originalCalorieAmount: ingredient?.calorieAmount,
                      originalCarbohydrateAmount: ingredient?.carbohydateAmount,
                      originalFatAmount: ingredient?.fatAmount,
                      originalProteinAmount: ingredient?.proteinAmount,
                      originalWeight: ingredient?.weight,
                      originalMacronutrientsEx: ingredient?.macronutrientsEx,
                      calorieAmount: ingredient?.calorieAmount,
                      carbohydateAmount: ingredient?.carbohydateAmount,
                      fatAmount: ingredient?.fatAmount,
                      proteinAmount: ingredient?.proteinAmount,
                      weight: ingredient?.weight,
                      macronutrientsEx: ingredient?.macronutrientsEx
                    }))
                  )
              }

              enriched = enrichedData
            } else {
              // For food items, get serving info from detailed item
              if (
                normalizedDetailed?.servingOptions &&
                Array.isArray(normalizedDetailed.servingOptions) &&
                normalizedDetailed.servingOptions.length > 0
              ) {
                // Use findDefaultServing to get the default serving for per-100 calculations
                const defaultServing = findDefaultServing(
                  normalizedDetailed.servingOptions
                )
                originalServingAmount = getServingAmount(defaultServing) || 100
                originalServingId = getServingIdentifier(defaultServing)
              }

              enriched = {
                ...item,
                ...normalizedDetailed,
                originalCalories:
                  normalizedDetailed?.caloriesPer100 || item?.caloriesPer100,
                originalNutrients:
                  normalizedDetailed?.nutrientsPer100 || item?.nutrientsPer100,
                originalServingAmount,
                originalServingId
              }
            }
          }
        }
      } catch (e) {
        console.warn('Failed to enrich item, using elastic item', e)
        // Fallback to original logic if fetch fails
        if (!detectIsRecipe(item)) {
          enriched = {
            ...item,
            originalCalories: item?.caloriesPer100,
            originalNutrients: item?.nutrientsPer100,
            originalServingAmount,
            originalServingId
          }
        }
      }

      // Add item to plan
      const newIndex = plans[activeMealType].length
      const itemKey = `${activeMealType}-${newIndex}`

      // Initialize display values
      // For custom units (e.g. "serving"), default amount should be 1.
      let initialServingId = originalServingId
      let initialServingAmount = originalServingAmount

      if (
        enriched?.servingOptions &&
        Array.isArray(enriched.servingOptions) &&
        enriched.servingOptions.length > 0
      ) {
        let initialServing =
          findServingByIdentifier(enriched.servingOptions, initialServingId) ||
          null

        if (detectIsRecipe(enriched)) {
          const portionServing = findPortionServing(enriched.servingOptions)
          if (portionServing) initialServing = portionServing
        }

        if (!initialServing) {
          initialServing =
            findDefaultServing(enriched.servingOptions) ||
            enriched.servingOptions[0]
        }

        initialServingId =
          getServingIdentifier(initialServing) || initialServingId
        initialServingAmount =
          getDefaultAmountForSelectedServing(initialServing)
      }

      if (selectionOverride?.servingOption) {
        const normalizedServingOption = {
          unitName:
            selectionOverride.servingOption?.unitName ||
            selectionOverride.servingOption?.unit ||
            'g',
          value: parseNumber(
            selectionOverride.servingOption?.value ??
              selectionOverride.servingOption?.amount ??
              100
          )
        }
        const normalizedQuantity =
          parseOptionalNumber(selectionOverride.amount) ?? initialServingAmount
        enriched.changedServing = {
          value: String(
            getChangedServingBaseValue(
              normalizedQuantity,
              normalizedServingOption.unitName,
              normalizedServingOption,
              enriched?.isLiquid
            )
          ),
          quantity: normalizedQuantity,
          unit: normalizedServingOption.unitName,
          servingOption: normalizedServingOption
        }
        initialServingId =
          getServingIdentifier(selectionOverride.servingOption) ||
          initialServingId
        initialServingAmount =
          parseOptionalNumber(selectionOverride.amount) ?? initialServingAmount
      }

      if (detectIsRecipe(enriched) && activeMealType !== 'snackPlan') {
        openStructuredMealEditor({
          mode: 'builder',
          mealKey: activeMealType,
          item: enriched
        })
        setSearchText('')
        setSearchResults([])
        return
      }

      setDisplayValues(prev => ({
        ...prev,
        [itemKey]: {
          selectedServingId: initialServingId,
          servingAmount: initialServingAmount
        }
      }))

      setPlans(prev => ({
        ...prev,
        [activeMealType]: [...prev[activeMealType], enriched]
      }))
      setSearchText('')
      setSearchResults([])
    } catch (e) {
      console.error('Failed to add item', e)
      setError(t('pages.myMenus.failedAddItem'))
    }
  }

  const prepareItemForMenuPlan = async item => {
    let enriched = normalizeMenuItemShape(item)
    let originalServingAmount = 100
    let originalServingId = null

    if (
      Array.isArray(enriched?.servingOptions) &&
      enriched.servingOptions.length > 0
    ) {
      const defaultServing = findDefaultServing(enriched.servingOptions)
      originalServingAmount = getServingAmount(defaultServing) || 100
      originalServingId = getServingIdentifier(defaultServing)
    }

    try {
      const id = item?.id || item?.itemId || item?._id
      if (id) {
        const resp = await getItemsByIds({ ids: [id] })
        const detailed = resp?.data?.[0] || resp?.items?.[0]

        if (detailed) {
          const normalizedDetailed = normalizeMenuItemShape(detailed)

          if (detectIsRecipe(item)) {
            const originalServings =
              normalizedDetailed?.numberOfRecipeServings || 1
            if (
              normalizedDetailed?.servingOptions &&
              Array.isArray(normalizedDetailed.servingOptions) &&
              normalizedDetailed.servingOptions.length > 0
            ) {
              const portionServing = findPortionServing(
                normalizedDetailed.servingOptions
              )
              if (portionServing) {
                originalServingAmount =
                  getServingAmount(portionServing) * originalServings
                originalServingId = getServingIdentifier(portionServing)
              } else {
                const totalWeight =
                  detailed?.weightAfterCooking ||
                  normalizedDetailed?.weightAfterCooking ||
                  null
                if (totalWeight) {
                  originalServingAmount = totalWeight
                  const defaultServing = findDefaultServing(
                    normalizedDetailed.servingOptions
                  )
                  originalServingId = getServingIdentifier(defaultServing)
                } else {
                  const defaultServing = findDefaultServing(
                    normalizedDetailed.servingOptions
                  )
                  originalServingAmount =
                    (getServingAmount(defaultServing) || 100) * originalServings
                  originalServingId = getServingIdentifier(defaultServing)
                }
              }
            }

            const enrichedData = {
              ...item,
              ...normalizedDetailed,
              originalServings,
              originalCalories: normalizedDetailed?.caloriesPer100,
              originalNutrients: normalizedDetailed?.nutrientsPer100,
              numberOfRecipeServings: originalServings,
              showRecipeDetailsInPdf: item?.showRecipeDetailsInPdf === true,
              originalServingAmount,
              originalServingId
            }

            if (
              normalizedDetailed?.ingredients &&
              Array.isArray(normalizedDetailed.ingredients)
            ) {
              enrichedData.ingredients =
                await enrichRecipeIngredientsWithDetails(
                  normalizedDetailed.ingredients.map(ingredient => ({
                    ...ingredient,
                    originalCalorieAmount: ingredient?.calorieAmount,
                    originalCarbohydrateAmount: ingredient?.carbohydateAmount,
                    originalFatAmount: ingredient?.fatAmount,
                    originalProteinAmount: ingredient?.proteinAmount,
                    originalWeight: ingredient?.weight,
                    originalMacronutrientsEx: ingredient?.macronutrientsEx,
                    calorieAmount: ingredient?.calorieAmount,
                    carbohydateAmount: ingredient?.carbohydateAmount,
                    fatAmount: ingredient?.fatAmount,
                    proteinAmount: ingredient?.proteinAmount,
                    weight: ingredient?.weight,
                    macronutrientsEx: ingredient?.macronutrientsEx
                  }))
                )
            }

            enriched = enrichedData
          } else {
            if (
              normalizedDetailed?.servingOptions &&
              Array.isArray(normalizedDetailed.servingOptions) &&
              normalizedDetailed.servingOptions.length > 0
            ) {
              const defaultServing = findDefaultServing(
                normalizedDetailed.servingOptions
              )
              originalServingAmount = getServingAmount(defaultServing) || 100
              originalServingId = getServingIdentifier(defaultServing)
            }

            enriched = {
              ...item,
              ...normalizedDetailed,
              originalCalories:
                normalizedDetailed?.caloriesPer100 || item?.caloriesPer100,
              originalNutrients:
                normalizedDetailed?.nutrientsPer100 || item?.nutrientsPer100,
              originalServingAmount,
              originalServingId
            }
          }
        }
      }
    } catch (e) {
      console.warn('Failed to enrich item, using elastic item', e)
      if (!detectIsRecipe(item)) {
        enriched = {
          ...item,
          originalCalories: item?.caloriesPer100,
          originalNutrients: item?.nutrientsPer100,
          originalServingAmount,
          originalServingId
        }
      }
    }

    return enriched
  }

  const removeItemFromPlan = (mealKey, index) => {
    const itemKey = `${mealKey}-${index}`
    setDisplayValues(prev => {
      const newValues = { ...prev }
      delete newValues[itemKey]
      const reindexed = {}
      Object.keys(newValues).forEach(key => {
        const [mk, idx] = key.split('-')
        const idxNum = parseInt(idx)
        if (mk === mealKey && idxNum > index) {
          reindexed[`${mk}-${idxNum - 1}`] = newValues[key]
        } else {
          reindexed[key] = newValues[key]
        }
      })
      return reindexed
    })

    setPlans(prev => ({
      ...prev,
      [mealKey]: prev[mealKey].filter((_, i) => i !== index)
    }))
  }

  const getStudioItemKey = (mealKey, index) => `${mealKey}-${index}`

  const handleStudioSearch = async mealKey => {
    if (!studioSearchText.trim()) return
    setStudioSearching(true)
    setStudioActiveMealType(mealKey)
    try {
      const data = await searchFoodItems({
        searchText: studioSearchText,
        userId: nutritionistId,
        onlyRecipes: studioOnlyRecipes,
        countryCode
      })
      const normalizedResults = Array.isArray(data) ? data : []
      setStudioSearchResults(
        normalizedResults.filter(item => !shouldHideLowQualitySearchItem(item))
      )
    } catch (e) {
      console.error('Studio search failed', e)
      setError(t('pages.myMenus.failedSearchFood'))
    } finally {
      setStudioSearching(false)
    }
  }

  const handleStudioAddItem = async (
    mealKey,
    item,
    selectionOverride = null
  ) => {
    if (!selectedMenuInContainer) return

    try {
      const enrichedItem = await prepareItemForMenuPlan(item)
      if (selectionOverride?.servingOption) {
        const normalizedServingOption = {
          unitName:
            selectionOverride.servingOption?.unitName ||
            selectionOverride.servingOption?.unit ||
            'g',
          value: parseNumber(
            selectionOverride.servingOption?.value ??
              selectionOverride.servingOption?.amount ??
              100
          )
        }
        const normalizedQuantity =
          parseOptionalNumber(selectionOverride.amount) ??
          getDefaultAmountForSelectedServing(normalizedServingOption)

        enrichedItem.changedServing = {
          value: String(
            getChangedServingBaseValue(
              normalizedQuantity,
              normalizedServingOption.unitName,
              normalizedServingOption,
              enrichedItem?.isLiquid
            )
          ),
          quantity: normalizedQuantity,
          unit: normalizedServingOption.unitName,
          servingOption: normalizedServingOption
        }
      }

      if (detectIsRecipe(enrichedItem) && mealKey !== 'snackPlan') {
        openStructuredMealEditor({
          mode: 'studio',
          mealKey,
          item: enrichedItem
        })
        setStudioSearchResults([])
        setStudioSearchText('')
        setStudioActiveMealType(null)
        return
      }

      const updatedMenu = {
        ...selectedMenuInContainer,
        [mealKey]: [...(selectedMenuInContainer?.[mealKey] || []), enrichedItem]
      }

      stageStudioMenuChanges(updatedMenu)
      setStudioEditingItemKey(
        getStudioItemKey(mealKey, (updatedMenu?.[mealKey] || []).length - 1)
      )
      setStudioSearchResults([])
      setStudioSearchText('')
      setStudioActiveMealType(null)
    } catch (e) {
      console.error('Failed to add studio item', e)
    }
  }

  const handleStudioDeleteItem = (mealKey, index) => {
    if (!selectedMenuInContainer) return
    if (!window.confirm(t('pages.myMenus.confirmDeleteItem'))) return

    const updatedMenu = {
      ...selectedMenuInContainer,
      [mealKey]: (selectedMenuInContainer?.[mealKey] || []).filter(
        (_, itemIndex) => itemIndex !== index
      )
    }
    stageStudioMenuChanges(updatedMenu)
    if (studioEditingItemKey === getStudioItemKey(mealKey, index)) {
      setStudioEditingItemKey(null)
    }
  }

  const handleStudioItemChange = (mealKey, index, updater) => {
    if (!selectedMenuInContainer) return

    const currentItems = selectedMenuInContainer?.[mealKey] || []
    const updatedItems = currentItems.map((item, itemIndex) =>
      itemIndex === index
        ? typeof updater === 'function'
          ? updater(item)
          : updater
        : item
    )

    const updatedMenu = {
      ...selectedMenuInContainer,
      [mealKey]: updatedItems
    }

    stageStudioMenuChanges(updatedMenu)
  }

  const openStudioItemEditor = (
    mealKey,
    index,
    item,
    selectedServing,
    currentAmount
  ) => {
    const itemKey = getStudioItemKey(mealKey, index)
    setStudioEditingItemKey(itemKey)
    setStudioDraftValues(prev => ({
      ...prev,
      [itemKey]: {
        selectedServingId:
          getServingIdentifier(
            item?.changedServing?.servingOption || selectedServing
          ) || '',
        amount: currentAmount,
        showRecipeDetailsInPdf: shouldShowRecipeDetailsInPdf(item)
      }
    }))
  }

  const closeStudioItemEditor = itemKey => {
    setStudioEditingItemKey(null)
    setStudioDraftValues(prev => {
      const next = { ...prev }
      delete next[itemKey]
      return next
    })
  }

  const handleSaveStructuredMeal = () => {
    if (!structuredMealEditor?.mealKey || !structuredMealEditor?.name?.trim()) {
      return
    }

    const nextItem = buildStructuredMealItemFromDraft(structuredMealEditor)

    if (structuredMealEditor.mode === 'studio') {
      if (!selectedMenuInContainer) return

      const currentItems =
        selectedMenuInContainer?.[structuredMealEditor.mealKey] || []
      const updatedItems =
        structuredMealEditor.itemIndex === null
          ? [...currentItems, nextItem]
          : currentItems.map((item, index) =>
              index === structuredMealEditor.itemIndex ? nextItem : item
            )

      stageStudioMenuChanges({
        ...selectedMenuInContainer,
        [structuredMealEditor.mealKey]: updatedItems
      })
      closeStructuredMealEditor()
      return
    }

    if (structuredMealEditor.itemIndex === null) {
      const newIndex = plans[structuredMealEditor.mealKey].length
      const initialSelection = getInitialServingSelection(nextItem)
      setPlans(prev => ({
        ...prev,
        [structuredMealEditor.mealKey]: [
          ...prev[structuredMealEditor.mealKey],
          nextItem
        ]
      }))
      setDisplayValues(prev => ({
        ...prev,
        [`${structuredMealEditor.mealKey}-${newIndex}`]: {
          selectedServingId: initialSelection?.selectedServingId || '',
          servingAmount: initialSelection?.amount ?? 100
        }
      }))
    } else {
      const updatedDisplayValue = getInitialServingSelection(nextItem)
      setPlans(prev => ({
        ...prev,
        [structuredMealEditor.mealKey]: prev[structuredMealEditor.mealKey].map(
          (item, index) =>
            index === structuredMealEditor.itemIndex ? nextItem : item
        )
      }))
      setDisplayValues(prev => ({
        ...prev,
        [`${structuredMealEditor.mealKey}-${structuredMealEditor.itemIndex}`]: {
          selectedServingId: updatedDisplayValue?.selectedServingId || '',
          servingAmount: updatedDisplayValue?.amount ?? 100
        }
      }))
    }

    closeStructuredMealEditor()
  }

  const handleSaveTemplate = async e => {
    e.preventDefault()
    if (!menuContainerName.trim()) {
      setError(t('pages.myMenus.pleaseEnterMenuName'))
      return
    }

    if (editingTemplateId && !menuName.trim()) {
      setError(t('pages.myMenus.pleaseEnterMenuName'))
      return
    }

    setSubmitting(true)
    try {
      // Prepare plans with changedServing property added to each item
      const preparePlanWithChangedServing = (planItems, mealKey) => {
        return planItems.map((item, index) => {
          const itemKey = `${mealKey}-${index}`
          const displayValue = displayValues[itemKey]

          // Create a copy of the item without modifying the original
          const itemCopy = { ...item }

          // Add changedServing if display value exists and has a selected serving
          // Only add if servingAmount is a valid number (not empty string)
          if (
            displayValue &&
            displayValue.servingAmount !== undefined &&
            displayValue.servingAmount !== '' &&
            displayValue.selectedServingId !== null &&
            displayValue.selectedServingId !== undefined
          ) {
            // Find the serving object using the identifier
            const servingOptions = buildServingOptionsForMenuItem(
              item,
              includeImperialServingOptions
            )
            const selectedServing = findServingByIdentifier(
              servingOptions,
              displayValue.selectedServingId
            )

            if (selectedServing) {
              const servingOption = {
                unitName:
                  selectedServing?.unitName ||
                  selectedServing?.name ||
                  selectedServing?.innerName ||
                  selectedServing?.unit ||
                  'g',
                value: parseNumber(
                  selectedServing?.value ?? selectedServing?.amount ?? 100
                )
              }
              itemCopy.changedServing = {
                value: String(
                  getChangedServingBaseValue(
                    displayValue.servingAmount,
                    servingOption.unitName,
                    servingOption,
                    item?.isLiquid
                  )
                ),
                quantity: parseNumber(displayValue.servingAmount),
                unit: servingOption.unitName,
                servingOption
              }
            }
          }

          return itemCopy
        })
      }

      const editingTemplate = editingTemplateId
        ? templates.find(template => template?.id === editingTemplateId)
        : null
      const editingTemplateOrder = editingTemplate
        ? splitMenuName(editingTemplate?.name || '').order
        : null
      const trimmedContainerName = menuContainerName.trim()

      if (editingTemplateId) {
        const templateData = {
          name: buildStoredMenuName(
            trimmedContainerName,
            menuName,
            editingTemplateOrder
          ),
          breakfastPlan: preparePlanWithChangedServing(
            plans.breakfastPlan,
            'breakfastPlan'
          ),
          lunchPlan: preparePlanWithChangedServing(
            plans.lunchPlan,
            'lunchPlan'
          ),
          dinnerPlan: preparePlanWithChangedServing(
            plans.dinnerPlan,
            'dinnerPlan'
          ),
          snackPlan: preparePlanWithChangedServing(
            plans.snackPlan,
            'snackPlan'
          ),
          isAssignableByUser: isAdmin ? isAssignableByUser : false,
          createdByUserId: nutritionistId
        }

        await updateMenuTemplateBO({
          ...templateData,
          menuTemplateId: editingTemplateId
        })
      } else {
        const targetGroup = groupedTemplates.find(
          group =>
            group.containerName.toLowerCase() ===
            trimmedContainerName.toLowerCase()
        )
        const startingOrder = getNextContainerMenuOrder(targetGroup)
        const normalizedDays = addingToExistingContainer
          ? 1
          : Math.max(
              1,
              Math.min(14, Number.parseInt(String(numberOfDays || 1), 10) || 1)
            )

        for (let index = 0; index < normalizedDays; index += 1) {
          await addMenuTemplateBO({
            name: buildStoredMenuName(
              trimmedContainerName,
              addingToExistingContainer
                ? menuName.trim()
                : `${t('pages.myMenus.dayLabel')} ${index + 1}`,
              startingOrder + index
            ),
            breakfastPlan: [],
            lunchPlan: [],
            dinnerPlan: [],
            snackPlan: [],
            isAssignableByUser: isAdmin ? isAssignableByUser : false,
            createdByUserId: nutritionistId
          })
        }
      }

      resetBuilder()
      setError(null)
      const refreshedTemplates = await loadTemplates()
      if (!editingTemplateId) {
        const createdMenus = refreshedTemplates
          .filter(
            template =>
              splitMenuName(template?.name || '')
                .containerName.trim()
                .toLowerCase() === trimmedContainerName.toLowerCase()
          )
          .sort((left, right) => {
            const leftOrder = splitMenuName(left?.name || '').order ?? 0
            const rightOrder = splitMenuName(right?.name || '').order ?? 0
            return leftOrder - rightOrder
          })

        if (createdMenus.length > 0) {
          const selectedCreatedMenu = addingToExistingContainer
            ? createdMenus[createdMenus.length - 1]
            : createdMenus[0]

          setSelectedContainerKey(
            `container:${trimmedContainerName.toLowerCase()}`
          )
          setSelectedContainerMenuId(selectedCreatedMenu?.id || null)
          setSelectedContainerModalOpen(true)
        }
      }
      setShowBuilderModal(false)
    } catch (e) {
      console.error('Failed to save template', e)
      setError(e?.message || t('pages.myMenus.failedSaveTemplate'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteTemplate = async templateId => {
    if (!window.confirm(t('pages.myMenus.confirmDeleteTemplate'))) return

    try {
      setDeletingTemplateId(templateId)
      await deleteMenuTemplateByIdBO({
        menuTemplateId: templateId,
        createdByUserId: nutritionistId
      })
      await loadTemplates()
    } catch (e) {
      console.error('Failed to delete template', e)
      setError(t('pages.myMenus.failedDeleteTemplate'))
    } finally {
      setDeletingTemplateId(null)
    }
  }

  const handleOpenRenameContainerModal = container => {
    setSelectedContainerForRename(container)
    setRenameContainerName(container?.containerName || '')
    setIsRenameContainerModalOpen(true)
  }

  const handleRenameContainerConfirm = async () => {
    if (!selectedContainerForRename || !renameContainerName.trim()) {
      return
    }

    try {
      setRenamingContainer(true)
      await renameMenuContainerBO({
        menuTemplateIds: selectedContainerForRename.menus.map(menu => menu.id),
        newContainerName: renameContainerName.trim(),
        createdByUserId: nutritionistId
      })
      await loadTemplates()
      setSelectedContainerModalOpen(false)
      setIsRenameContainerModalOpen(false)
      setSelectedContainerForRename(null)
      setRenameContainerName('')
    } catch (e) {
      console.error('Failed to rename container', e)
      setError(e?.message || t('pages.myMenus.failedSaveTemplate'))
    } finally {
      setRenamingContainer(false)
    }
  }

  const handleOpenCopyContainerModal = container => {
    setSelectedContainerForCopy(container)
    setCopyContainerName(
      container?.containerName ? `${container.containerName} (Copy)` : ''
    )
    setIsCopyContainerModalOpen(true)
  }

  const handleCopyContainerConfirm = async () => {
    if (!selectedContainerForCopy || !copyContainerName.trim()) {
      return
    }

    try {
      setCopyingContainer(true)
      await copyMenuContainerBO({
        menuTemplateIds: selectedContainerForCopy.menus.map(menu => menu.id),
        newContainerName: copyContainerName.trim(),
        createdByUserId: nutritionistId
      })
      await loadTemplates()
      setSelectedContainerModalOpen(false)
      setIsCopyContainerModalOpen(false)
      setSelectedContainerForCopy(null)
      setCopyContainerName('')
    } catch (e) {
      console.error('Failed to copy container', e)
      setError(e?.message || t('pages.menus.duplicateFail'))
    } finally {
      setCopyingContainer(false)
    }
  }

  const handleOpenCopyContainerToCountryModal = container => {
    setSelectedContainerForCountryCopy(container)
    setCopyContainerToCountryName(container?.containerName || '')
    setCopyContainerToCountryCode('RO')
    setIsCopyContainerToCountryModalOpen(true)
  }

  const handleCopyContainerToCountryConfirm = async () => {
    if (
      !selectedContainerForCountryCopy ||
      !copyContainerToCountryName.trim()
    ) {
      return
    }

    if (!copyContainerToCountryCode) {
      alert(
        t('pages.menus.copyTemplate.selectCountry') || 'Please select a country'
      )
      return
    }

    try {
      setCopyingContainerToCountry(true)
      await copyMenuContainerToCountryBO({
        menuTemplateIds: selectedContainerForCountryCopy.menus.map(
          menu => menu.id
        ),
        newContainerName: copyContainerToCountryName.trim(),
        countryCode: copyContainerToCountryCode,
        userId: currentUser?.uid,
        createdByUserId: nutritionistId
      })
      await loadTemplates()
      setSelectedContainerModalOpen(false)
      setIsCopyContainerToCountryModalOpen(false)
      setSelectedContainerForCountryCopy(null)
      setCopyContainerToCountryName('')
      setCopyContainerToCountryCode('RO')
    } catch (e) {
      console.error('Failed to copy container to country', e)
      alert(
        t('pages.menus.copyTemplate.error') ||
          `Failed to copy container: ${e.message}`
      )
    } finally {
      setCopyingContainerToCountry(false)
    }
  }

  const handleDeleteContainer = async container => {
    if (!container) return
    if (!window.confirm(t('pages.myMenus.confirmDeleteTemplate'))) return

    try {
      setDeletingContainerKey(container.key)
      await deleteMenuContainerBO({
        menuTemplateIds: container.menus.map(menu => menu.id),
        createdByUserId: nutritionistId
      })
      await loadTemplates()
      setSelectedContainerModalOpen(false)
    } catch (e) {
      console.error('Failed to delete container', e)
      setError(t('pages.myMenus.failedDeleteTemplate'))
    } finally {
      setDeletingContainerKey(null)
    }
  }

  const handleExportContainerPdf = async container => {
    if (!container?.menus?.length) return

    try {
      setExportingContainerPdf(true)
      await exportMenuBuilderToPdf({
        container,
        t
      })
    } catch (error) {
      console.error('Failed to export container PDF', error)
      window.alert(t('pages.myMenus.exportPdfError'))
    } finally {
      setExportingContainerPdf(false)
    }
  }

  const handleDuplicateTemplate = async (template, menuNameOverride = null) => {
    try {
      const deepCopyPlan = planItems =>
        (planItems || []).map(item => {
          const itemCopy = { ...item }

          if (item.changedServing) {
            itemCopy.changedServing = { ...item.changedServing }
            if (item.changedServing.servingOption) {
              itemCopy.changedServing.servingOption = {
                ...item.changedServing.servingOption
              }
            }
          }

          if (Array.isArray(item.servingOptions)) {
            itemCopy.servingOptions = item.servingOptions.map(s => ({ ...s }))
          }

          if (Array.isArray(item.ingredients)) {
            itemCopy.ingredients = item.ingredients.map(ing => ({ ...ing }))
          }

          if (item.nutrientsPer100) {
            itemCopy.nutrientsPer100 = { ...item.nutrientsPer100 }
          }

          return itemCopy
        })

      const { containerName, menuName } = splitMenuName(template?.name || '')
      const originalName = menuName || template?.name || 'Untitled'
      const targetContainer = groupedTemplates.find(
        group =>
          group.containerName.toLowerCase() ===
          String(containerName || '')
            .trim()
            .toLowerCase()
      )
      const newName = buildStoredMenuName(
        containerName,
        menuNameOverride?.trim() || `${originalName} (Copy)`,
        containerName ? getNextContainerMenuOrder(targetContainer) : null
      )

      await addMenuTemplateBO({
        name: newName,
        breakfastPlan: deepCopyPlan(template?.breakfastPlan || []),
        lunchPlan: deepCopyPlan(template?.lunchPlan || []),
        dinnerPlan: deepCopyPlan(template?.dinnerPlan || []),
        snackPlan: deepCopyPlan(template?.snackPlan || []),
        isAssignableByUser: false,
        createdByUserId: nutritionistId
      })

      await loadTemplates()
    } catch (e) {
      console.error('Failed to duplicate template', e)
      setError(t('pages.menus.duplicateFail'))
    }
  }

  const handleOpenDuplicateModal = template => {
    const { menuName } = splitMenuName(template?.name || '')
    setSelectedTemplateForDuplicate(template)
    setDuplicateMenuName(menuName ? `${menuName} (Copy)` : 'Untitled (Copy)')
    setIsDuplicateModalOpen(true)
  }

  const handleDuplicateTemplateConfirm = async () => {
    if (!selectedTemplateForDuplicate || !duplicateMenuName.trim()) {
      return
    }

    try {
      setDuplicatingTemplate(true)
      await handleDuplicateTemplate(
        selectedTemplateForDuplicate,
        duplicateMenuName
      )
      setIsDuplicateModalOpen(false)
      setSelectedTemplateForDuplicate(null)
      setDuplicateMenuName('')
      setSelectedContainerModalOpen(false)
    } finally {
      setDuplicatingTemplate(false)
    }
  }

  const handleOpenCopyModal = template => {
    const { menuName } = splitMenuName(template?.name || '')
    setSelectedTemplateForCopy(template)
    setCopyCountryCode('RO')
    setCopyMenuName(menuName ? `${menuName} Copy` : '')
    setIsCopyModalOpen(true)
  }

  const openTextToMenu = (containerGroup = null) => {
    setTextToMenuContainerContext(containerGroup || null)
    setTextToMenuInput('')
    setTextToMenuName('')
    setTextToMenuCountry('RO')
    setIsTextToMenuOpen(true)
  }

  const resolveMenuName = () => {
    if (textToMenuName.trim()) return textToMenuName.trim()
    const dayLabel = t('pages.myMenus.dayLabel') || 'Day'
    if (textToMenuContainerContext) {
      const label = getNextContainerMenuLabel(
        textToMenuContainerContext,
        dayLabel
      )
      return buildStoredMenuName(
        textToMenuContainerContext.containerName,
        label,
        getNextContainerMenuOrder(textToMenuContainerContext)
      )
    }
    return null
  }

  const handleGenerateFromText = async () => {
    if (!textToMenuInput.trim()) {
      alert(
        t('pages.menus.textToMenu.emptyError') ||
          'Please enter a description for your menu'
      )
      return
    }
    try {
      setGeneratingMenu(true)
      const result = await generateMenuFromText({
        text: textToMenuInput.trim(),
        menuName: resolveMenuName(),
        countryCode: textToMenuCountry,
        createdByUserId: currentUser?.uid || null,
        dayLabel: t('pages.myMenus.dayLabel') || 'Day'
      })
      if (result?.ok && result?.data) {
        alert(
          t('pages.menus.textToMenu.success') || 'Menu generated successfully!'
        )
        setIsTextToMenuOpen(false)
        setTextToMenuInput('')
        setTextToMenuName('')
        setTextToMenuCountry('RO')
        setTextToMenuContainerContext(null)
        await loadTemplates()
      } else {
        throw new Error(result?.error || 'Failed to generate menu')
      }
    } catch (e) {
      console.error('Failed to generate menu from text', e)
      alert(
        `${t('pages.menus.textToMenu.error') || 'Failed to generate menu'}: ${e.message}`
      )
    } finally {
      setGeneratingMenu(false)
    }
  }

  const handleCopyTemplate = async () => {
    if (!selectedTemplateForCopy) {
      alert(
        t('pages.menus.copyTemplate.selectTemplate') ||
          'Please select a template'
      )
      return
    }

    if (!copyCountryCode) {
      alert(
        t('pages.menus.copyTemplate.selectCountry') || 'Please select a country'
      )
      return
    }

    try {
      setCopyingTemplate(true)
      const result = await copyMenuTemplateToCountry({
        menuTemplate: selectedTemplateForCopy,
        countryCode: copyCountryCode,
        userId: currentUser?.uid,
        createdByUserId: currentUser?.uid || null,
        menuName: buildStoredMenuName(
          splitMenuName(selectedTemplateForCopy?.name || '').containerName,
          copyMenuName?.trim() || '',
          splitMenuName(selectedTemplateForCopy?.name || '').order
        )
      })

      if (result?.ok && result?.data) {
        alert(
          t('pages.menus.copyTemplate.success') ||
            'Menu template copied successfully!'
        )
        setIsCopyModalOpen(false)
        setSelectedTemplateForCopy(null)
        setCopyMenuName('')
        // Refresh templates list
        await loadTemplates()
      } else {
        throw new Error(result?.error || 'Failed to copy template')
      }
    } catch (e) {
      console.error('Failed to copy template', e)
      alert(
        t('pages.menus.copyTemplate.error') ||
          `Failed to copy template: ${e.message}`
      )
    } finally {
      setCopyingTemplate(false)
    }
  }

  const handleDeleteItem = async (templateId, itemType, itemId) => {
    if (!window.confirm(t('pages.myMenus.confirmDeleteItem'))) return

    try {
      await deleteMenuTemplateItemByIdBO({
        menuTemplateId: templateId,
        itemType,
        itemId,
        createdByUserId: nutritionistId
      })
      await loadTemplates()
    } catch (e) {
      console.error('Failed to delete item', e)
      setError(t('pages.myMenus.failedDeleteItem'))
    }
  }

  const handleAssignMenu = async templateId => {
    if (!selectedClientId || !assignmentDate) {
      setError(t('pages.myMenus.pleaseSelectClientAndDate'))
      return
    }

    setAssigningMenu(true)
    try {
      await assignMenuTemplateToUserBO({
        userId: selectedClientId,
        dateApplied: assignmentDate,
        menuTemplateId: templateId,
        replaceExisting: true
      })
      setError(null)
      alert(t('pages.myMenus.menuAssignedSuccessfully'))
      // Refresh templates after assignment
      await loadTemplates()
    } catch (e) {
      console.error('Failed to assign menu', e)
      setError(t('pages.myMenus.failedAssignMenu'))
    } finally {
      setAssigningMenu(false)
    }
  }

  const handleAssignContainer = async container => {
    if (!selectedClientId || !assignmentDate) {
      setError(t('pages.myMenus.pleaseSelectClientAndDate'))
      return
    }

    const orderedMenuIds = (container?.menus || []).map(menu => menu.id)

    if (orderedMenuIds.length === 0) {
      return
    }

    setAssigningContainer(true)
    try {
      await assignMenuContainerToUserBO({
        userId: selectedClientId,
        startDate: assignmentDate,
        menuTemplateIds: orderedMenuIds,
        replaceExisting: true,
        createdByUserId: nutritionistId
      })
      setError(null)
      alert(t('pages.myMenus.menuAssignedSuccessfully'))
      await loadTemplates()
    } catch (e) {
      console.error('Failed to assign container', e)
      setError(t('pages.myMenus.failedAssignMenu'))
    } finally {
      setAssigningContainer(false)
    }
  }

  const handleOpenAssignContainerPreview = container => {
    if (!selectedClientId || !assignmentDate) {
      setError(t('pages.myMenus.pleaseSelectClientAndDate'))
      return
    }

    if (!(container?.menus || []).length) {
      return
    }

    setIsAssignContainerPreviewOpen(true)
  }

  const handleReorderContainerMenus = async (
    container,
    sourceMenuId,
    targetMenuId
  ) => {
    if (
      !container ||
      !sourceMenuId ||
      !targetMenuId ||
      sourceMenuId === targetMenuId
    ) {
      return
    }

    const currentMenus = container?.menus || []
    const sourceIndex = currentMenus.findIndex(menu => menu.id === sourceMenuId)
    const targetIndex = currentMenus.findIndex(menu => menu.id === targetMenuId)

    if (
      sourceIndex === -1 ||
      targetIndex === -1 ||
      sourceIndex === targetIndex
    ) {
      return
    }

    const reorderedMenus = moveItemInArray(
      currentMenus,
      sourceIndex,
      targetIndex
    )

    try {
      setReorderingContainer(true)
      await reorderMenuContainerBO({
        containerName: container.containerName,
        createdByUserId: nutritionistId,
        menuTemplateOrders: reorderedMenus.map((menu, index) => ({
          menuTemplateId: menu.id,
          menuName: menu.parsedMenuName,
          order: index + 1
        }))
      })
      await loadTemplates()
      setSelectedContainerMenuId(sourceMenuId)
    } catch (e) {
      console.error('Failed to reorder container menus', e)
      setError(t('pages.myMenus.failedSaveTemplate'))
    } finally {
      setReorderingContainer(false)
      setDraggedContainerMenuId(null)
    }
  }

  const handleUnassignMenu = async (templateId, clientId, dateApplied) => {
    if (!window.confirm(t('pages.myMenus.confirmUnassignMenu'))) return

    try {
      await removeMenuFromUserBO({
        userId: clientId,
        menuTemplateId: templateId,
        dateApplied
      })
      setError(null)
      alert(t('pages.myMenus.menuUnassignedSuccessfully'))
      // Refresh templates after unassignment
      await loadTemplates()
    } catch (e) {
      console.error('Failed to unassign menu', e)
      setError(t('pages.myMenus.failedUnassignMenu'))
    }
  }

  const handleLoadTemplateForEditing = template => {
    const id = template?.id || template?._id || template?.menuTemplateId
    const { containerName, menuName: parsedMenuName } = splitMenuName(
      template?.name || ''
    )

    setEditingTemplateId(id)
    setMenuContainerName(containerName)
    setMenuName(parsedMenuName || '')
    setNumberOfDays('1')
    setAddingToExistingContainer(false)
    setIsAssignableByUser(!!template?.isAssignableByUser && isAdmin)

    const loadedPlans = {
      breakfastPlan: template?.breakfastPlan || [],
      lunchPlan: template?.lunchPlan || [],
      dinnerPlan: template?.dinnerPlan || [],
      snackPlan: template?.snackPlan || []
    }
    setPlans(loadedPlans)

    // Initialize display values from loaded items, checking for changedServing or defaulting to original
    const initialDisplayValues = {}
    mealTypeOptions.forEach(opt => {
      const items = loadedPlans[opt.id] || []
      items.forEach((item, index) => {
        const itemKey = `${opt.id}-${index}`
        // If item has changedServing, use that; otherwise use original serving
        if (item?.changedServing) {
          let servingIdentifier = null
          if (item.changedServing.servingOption) {
            servingIdentifier = getServingIdentifier(
              item.changedServing.servingOption
            )
          }

          initialDisplayValues[itemKey] = {
            selectedServingId: servingIdentifier,
            servingAmount:
              parseOptionalNumber(item.changedServing.quantity) ??
              parseOptionalNumber(item.changedServing.value) ??
              ''
          }
        } else {
          // Use original serving info, or extract from serving array if not stored
          let originalServingAmount = item?.originalServingAmount
          let originalServingId = item?.originalServingId

          // If not stored, try to extract from serving array
          if (
            !originalServingAmount &&
            item?.servingOptions &&
            Array.isArray(item.servingOptions) &&
            item.servingOptions.length > 0
          ) {
            const isRecipe = detectIsRecipe(item)
            if (isRecipe) {
              const portionServing = findPortionServing(item.servingOptions)
              if (portionServing) {
                const numberOfRecipeServings =
                  item?.numberOfRecipeServings || item?.originalServings || 1
                originalServingAmount =
                  getServingAmount(portionServing) * numberOfRecipeServings
                originalServingId = getServingIdentifier(portionServing)
              } else {
                // Fall back to totalQuantity or weightAfterCooking if available
                const totalWeight =
                  item?.nutrientsPer100?.totalQuantity ||
                  item?.nutrientsPer100?.weightAfterCooking ||
                  null
                if (totalWeight) {
                  originalServingAmount = totalWeight
                  const defaultServing = findDefaultServing(item.servingOptions)
                  originalServingId = getServingIdentifier(defaultServing)
                } else {
                  const defaultServing = findDefaultServing(item.servingOptions)
                  const numberOfRecipeServings =
                    item?.numberOfRecipeServings || item?.originalServings || 1
                  originalServingAmount =
                    (getServingAmount(defaultServing) || 100) *
                    numberOfRecipeServings
                  originalServingId = getServingIdentifier(defaultServing)
                }
              }
            } else {
              // For foods, use default serving
              const defaultServing = findDefaultServing(item.servingOptions)
              originalServingAmount = getServingAmount(defaultServing) || 100
              originalServingId = getServingIdentifier(defaultServing)
            }
          } else if (!originalServingAmount) {
            originalServingAmount = 100
            originalServingId = null
          }

          const servingOptions = buildServingOptionsForMenuItem(
            item,
            includeImperialServingOptions
          )
          const selectedServing =
            findServingByIdentifier(servingOptions, originalServingId) ||
            findDefaultServing(servingOptions) ||
            servingOptions[0] ||
            null
          const selectedServingId =
            getServingIdentifier(selectedServing) || originalServingId || null
          const selectedServingAmount = selectedServing
            ? getDefaultAmountForSelectedServing(selectedServing)
            : originalServingAmount

          initialDisplayValues[itemKey] = {
            selectedServingId,
            servingAmount: selectedServingAmount
          }
        }
      })
    })
    setDisplayValues(initialDisplayValues)
    setShowBuilderModal(true)
  }

  const filteredTemplates = useMemo(() => {
    const normalizedSearchTerm = templateSearchTerm.trim().toLowerCase()

    return templates.filter(template => {
      const matchesSearch =
        normalizedSearchTerm.length === 0 ||
        template?.name?.toLowerCase().includes(normalizedSearchTerm) ||
        template?.id?.toLowerCase().includes(normalizedSearchTerm)

      if (!matchesSearch) {
        return false
      }

      const assignedUsersCount = template?.assignedUsers?.length || 0

      if (templateFilter === 'assigned') {
        return assignedUsersCount > 0
      }

      if (templateFilter === 'unassigned') {
        return assignedUsersCount === 0
      }

      return true
    })
  }, [templates, templateSearchTerm, templateFilter])

  const groupedTemplates = useMemo(() => {
    const groupsMap = new Map()

    filteredTemplates.forEach(template => {
      const { containerName, menuName, order } = splitMenuName(
        template?.name || ''
      )
      const hasContainer = Boolean(containerName)
      const groupKey = hasContainer
        ? `container:${containerName.toLowerCase()}`
        : `standalone:${template?.id}`
      const displayContainerName = hasContainer
        ? containerName
        : menuName || template?.name || 'Untitled'

      if (!groupsMap.has(groupKey)) {
        groupsMap.set(groupKey, {
          key: groupKey,
          containerName: displayContainerName,
          hasContainer,
          menus: []
        })
      }

      groupsMap.get(groupKey).menus.push({
        ...template,
        parsedContainerName: containerName,
        parsedMenuName: menuName || template?.name || 'Untitled',
        parsedMenuOrder: order
      })
    })

    return Array.from(groupsMap.values()).map(group => {
      const menus = [...group.menus].sort((left, right) => {
        const leftOrder = left?.parsedMenuOrder ?? getFallbackMenuOrder(left)
        const rightOrder = right?.parsedMenuOrder ?? getFallbackMenuOrder(right)

        if (leftOrder !== rightOrder) {
          return leftOrder - rightOrder
        }

        return (left?.parsedMenuName || '').localeCompare(
          right?.parsedMenuName || ''
        )
      })

      const assignedUsersMap = new Map()
      menus.forEach(menu => {
        ;(menu?.assignedUsers || []).forEach(assignment => {
          const assignmentKey = `${assignment?.userId}-${assignment?.dateApplied}`
          if (!assignedUsersMap.has(assignmentKey)) {
            assignedUsersMap.set(assignmentKey, assignment)
          }
        })
      })

      const aggregateSummary = menus.reduce(
        (acc, menu) => {
          const menuSummary = getTemplateNutritionSummary(menu)
          acc.total.calories += parseNumber(menuSummary?.total?.calories)
          acc.total.proteinsInGrams += parseNumber(
            menuSummary?.total?.proteinsInGrams
          )
          acc.total.carbohydratesInGrams += parseNumber(
            menuSummary?.total?.carbohydratesInGrams
          )
          acc.total.fatInGrams += parseNumber(menuSummary?.total?.fatInGrams)

          MENU_MEAL_SECTIONS.forEach(section => {
            const sectionSummary = menuSummary?.perMeal?.[section.id] || {}
            acc.perMeal[section.id].calories += parseNumber(
              sectionSummary?.calories
            )
            acc.perMeal[section.id].proteinsInGrams += parseNumber(
              sectionSummary?.proteinsInGrams
            )
            acc.perMeal[section.id].carbohydratesInGrams += parseNumber(
              sectionSummary?.carbohydratesInGrams
            )
            acc.perMeal[section.id].fatInGrams += parseNumber(
              sectionSummary?.fatInGrams
            )
          })

          return acc
        },
        {
          total: {
            calories: 0,
            proteinsInGrams: 0,
            carbohydratesInGrams: 0,
            fatInGrams: 0
          },
          perMeal: MENU_MEAL_SECTIONS.reduce((acc, section) => {
            acc[section.id] = {
              calories: 0,
              proteinsInGrams: 0,
              carbohydratesInGrams: 0,
              fatInGrams: 0
            }
            return acc
          }, {})
        }
      )

      return {
        ...group,
        menus,
        assignedUsers: Array.from(assignedUsersMap.values()),
        summary: aggregateSummary
      }
    })
  }, [filteredTemplates])

  useEffect(() => {
    setCurrentPage(1)
  }, [templateSearchTerm, templateFilter])

  useEffect(() => {
    const newTotalPages = Math.max(
      1,
      Math.ceil(groupedTemplates.length / itemsPerPage)
    )
    if (currentPage > newTotalPages) {
      setCurrentPage(newTotalPages)
    }
  }, [groupedTemplates.length, itemsPerPage, currentPage])

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(groupedTemplates.length / itemsPerPage)),
    [groupedTemplates.length, itemsPerPage]
  )

  const paginatedContainers = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage
    return groupedTemplates.slice(startIndex, startIndex + itemsPerPage)
  }, [groupedTemplates, currentPage, itemsPerPage])

  const selectedContainer = useMemo(
    () =>
      groupedTemplates.find(group => group.key === selectedContainerKey) ||
      null,
    [groupedTemplates, selectedContainerKey]
  )

  const selectedMenuInContainer = useMemo(() => {
    const currentMenus = selectedContainer?.menus || []
    const selectedMenu =
      currentMenus.find(menu => menu?.id === selectedContainerMenuId) ||
      currentMenus[0] ||
      null

    if (!selectedMenu?.id) return selectedMenu

    return menuStudioDrafts[selectedMenu.id] || selectedMenu
  }, [selectedContainer, selectedContainerMenuId, menuStudioDrafts])

  const selectedMenuHasDraft = Boolean(
    selectedMenuInContainer?.id && menuStudioDrafts[selectedMenuInContainer.id]
  )

  const totalAssignedClients = useMemo(() => {
    const uniqueClientIds = new Set()

    templates.forEach(template => {
      ;(template?.assignedUsers || []).forEach(assignment => {
        if (assignment?.userId) {
          uniqueClientIds.add(assignment.userId)
        }
      })
    })

    return uniqueClientIds.size
  }, [templates])

  useEffect(() => {
    if (
      selectedContainerKey &&
      !groupedTemplates.some(group => group.key === selectedContainerKey)
    ) {
      setSelectedContainerKey(null)
      setSelectedContainerModalOpen(false)
      setSelectedContainerMenuId(null)
    }
  }, [selectedContainerKey, groupedTemplates])

  useEffect(() => {
    if (selectedContainer?.menus?.length && !selectedMenuInContainer) {
      setSelectedContainerMenuId(selectedContainer.menus[0].id)
    }
  }, [selectedContainer, selectedMenuInContainer])

  useEffect(() => {
    setAssignmentMode('menu')
    setDraggedContainerMenuId(null)
  }, [selectedContainerKey])

  const templateFilterOptions = useMemo(
    () => [
      { id: 'all', label: t('pages.myMenus.filterAll') },
      { id: 'assigned', label: t('pages.myMenus.filterAssigned') },
      { id: 'unassigned', label: t('pages.myMenus.filterUnassigned') }
    ],
    [t]
  )

  const activeTemplateFilterLabel =
    templateFilterOptions.find(option => option.id === templateFilter)?.label ||
    t('pages.myMenus.filterAll')

  const selectedClientName = useMemo(() => {
    const selectedClient = clients.find(client => {
      const clientId = Array.isArray(client?.user?.userId)
        ? client.user.userId[0]
        : client?.user?.userId

      return clientId === selectedClientId
    })

    return (
      selectedClient?.user?.userData?.name ||
      selectedClient?.user?.loginDetails?.displayName ||
      ''
    )
  }, [clients, selectedClientId])

  const selectedContainerAssignmentPreview = useMemo(() => {
    if (!selectedContainer || !assignmentDate) {
      return []
    }

    return (selectedContainer?.menus || []).map((menu, index) => ({
      id: menu.id,
      menuName: menu.parsedMenuName,
      dateApplied: addDaysToIsoDate(assignmentDate, index)
    }))
  }, [selectedContainer, assignmentDate])

  const selectedMenuSummary = useMemo(
    () =>
      selectedMenuInContainer
        ? getTemplateNutritionSummary(selectedMenuInContainer)
        : {
            total: {
              calories: 0,
              proteinsInGrams: 0,
              carbohydratesInGrams: 0,
              fatInGrams: 0
            },
            perMeal: MENU_MEAL_SECTIONS.reduce((acc, section) => {
              acc[section.id] = {
                calories: 0,
                proteinsInGrams: 0,
                carbohydratesInGrams: 0,
                fatInGrams: 0
              }
              return acc
            }, {})
          },
    [selectedMenuInContainer]
  )

  const handleSaveSelectedMenuDraft = async () => {
    if (!selectedMenuInContainer?.id || !selectedMenuHasDraft) return
    await persistStudioMenuChanges(selectedMenuInContainer)
  }

  const builderTotals = useMemo(() => {
    const perMeal = mealTypeOptions.reduce((acc, meal) => {
      acc[meal.id] = (plans[meal.id] || []).reduce(
        (mealTotals, item, index) => {
          const itemKey = `${meal.id}-${index}`
          const displayValue = displayValues[itemKey]
          const servingOptions = buildServingOptionsForMenuItem(
            item,
            includeImperialServingOptions
          )
          const selectedServing =
            findServingByIdentifier(
              servingOptions,
              displayValue?.selectedServingId || item?.originalServingId
            ) ||
            findDefaultServing(servingOptions) ||
            servingOptions[0] ||
            null
          const selectedAmount =
            displayValue?.servingAmount !== undefined &&
            displayValue?.servingAmount !== ''
              ? displayValue.servingAmount
              : getPreferredStructuredMealAmount(item, selectedServing)
          const structuredMealSummary = isStructuredMealRecipeItem(item)
            ? calculateStructuredMealItemSummary(item)
            : null
          const calculated = structuredMealSummary
            ? {
                calories: structuredMealSummary.calories,
                nutrients: structuredMealSummary
              }
            : calculateDisplayValues(
                item,
                selectedAmount,
                item?.originalServingAmount || 100,
                selectedServing?.unitName ||
                  selectedServing?.unit ||
                  getItemDisplayUnit(item)
              )

          return {
            calories: mealTotals.calories + parseNumber(calculated?.calories),
            proteinsInGrams:
              mealTotals.proteinsInGrams +
              parseNumber(calculated?.nutrients?.proteinsInGrams),
            carbohydratesInGrams:
              mealTotals.carbohydratesInGrams +
              parseNumber(calculated?.nutrients?.carbohydratesInGrams),
            fatInGrams:
              mealTotals.fatInGrams +
              parseNumber(calculated?.nutrients?.fatInGrams)
          }
        },
        {
          calories: 0,
          proteinsInGrams: 0,
          carbohydratesInGrams: 0,
          fatInGrams: 0
        }
      )
      return acc
    }, {})

    return {
      perMeal,
      total: Object.values(perMeal).reduce(
        (acc, totals) => ({
          calories: acc.calories + parseNumber(totals?.calories),
          proteinsInGrams:
            acc.proteinsInGrams + parseNumber(totals?.proteinsInGrams),
          carbohydratesInGrams:
            acc.carbohydratesInGrams +
            parseNumber(totals?.carbohydratesInGrams),
          fatInGrams: acc.fatInGrams + parseNumber(totals?.fatInGrams)
        }),
        {
          calories: 0,
          proteinsInGrams: 0,
          carbohydratesInGrams: 0,
          fatInGrams: 0
        }
      )
    }
  }, [displayValues, plans, includeImperialServingOptions])

  const renderContainerStudioMealSection = (mealSection, title) => {
    const mealItems = selectedMenuInContainer?.[mealSection] || []

    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h4 className="text-xl font-semibold text-slate-900">{title}</h4>
            <span className="rounded-full bg-orange-50 px-3 py-1 text-sm font-semibold text-orange-600">
              {mealItems.length}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {mealSection !== 'snackPlan' ? (
              <button
                type="button"
                onClick={() =>
                  openStructuredMealEditor({
                    mode: 'studio',
                    mealKey: mealSection
                  })
                }
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                <PlusIcon className="h-4 w-4" />
                Create structured meal
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => {
                setStudioActiveMealType(
                  studioActiveMealType === mealSection ? null : mealSection
                )
                setStudioSearchText('')
                setStudioSearchResults([])
                setStudioOnlyRecipes(false)
              }}
              className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:-translate-y-0.5 hover:shadow-lg"
            >
              <PlusIcon className="h-4 w-4" />
              {t('pages.myMenus.addMeal')}
            </button>
          </div>
        </div>
        {studioActiveMealType === mealSection ? (
          <div className="mt-4 space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-col gap-3 lg:flex-row">
              <div className="relative flex-1">
                <MagnifyingGlassIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={studioSearchText}
                  onChange={event => setStudioSearchText(event.target.value)}
                  placeholder={t('pages.myMenus.searchFoodsRecipes')}
                  className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </div>
              <label className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={studioOnlyRecipes}
                  onChange={event => setStudioOnlyRecipes(event.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-400"
                />
                {t('pages.myMenus.recipesOnly')}
              </label>
              <button
                type="button"
                onClick={() => handleStudioSearch(mealSection)}
                disabled={studioSearching}
                className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
              >
                {studioSearching
                  ? t('pages.myMenus.searching')
                  : t('pages.myMenus.search')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setStudioActiveMealType(null)
                  setStudioSearchText('')
                  setStudioSearchResults([])
                  setStudioOnlyRecipes(false)
                }}
                className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                {t('pages.myMenus.cancel')}
              </button>
            </div>
            {studioSearchResults.length > 0 ? (
              <div className="max-h-72 overflow-y-auto rounded-2xl border border-slate-200 bg-white">
                {studioSearchResults.map((item, index) => {
                  const isRecipeItem = detectIsRecipe(item)

                  return (
                    <div
                      key={`${mealSection}-studio-result-${item?.id || item?.name || index}`}
                      onClick={() => setViewingItem(item)}
                      className="flex cursor-pointer items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 transition hover:bg-slate-50 last:border-b-0"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900">
                          {item?.name ||
                            item?.title ||
                            t('pages.myMenus.unnamedItem')}
                        </p>
                        <p className="text-xs text-slate-500">
                          {isRecipeItem
                            ? t('pages.myMenus.recipeType')
                            : t('pages.myMenus.foodType')}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={event => {
                          event.stopPropagation()
                          handleStudioAddItem(mealSection, item)
                        }}
                        disabled={savingStudioMenu}
                        className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-60"
                      >
                        <PlusIcon className="h-4 w-4" />
                        {t('pages.myMenus.addItem')}
                      </button>
                    </div>
                  )
                })}
              </div>
            ) : null}
          </div>
        ) : null}
        {mealItems.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
            {t('pages.myMenus.noItems')}
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-4">
            {mealItems.map((item, index) => {
              const itemKey = getStudioItemKey(mealSection, index)
              const isEditing = studioEditingItemKey === itemKey
              const draftValue = studioDraftValues[itemKey] || null
              const servingOptions = buildServingOptionsForMenuItem(
                item,
                includeImperialServingOptions
              )
              const selectedServing =
                findServingByIdentifier(
                  servingOptions,
                  item?.changedServing?.servingOption
                    ? getServingIdentifier(item.changedServing.servingOption)
                    : item?.originalServingId
                ) ||
                findDefaultServing(servingOptions) ||
                servingOptions[0] ||
                null
              const currentServingId =
                draftValue?.selectedServingId ??
                getServingIdentifier(
                  item?.changedServing?.servingOption || selectedServing
                ) ??
                null
              const currentAmount =
                draftValue?.amount ??
                parseOptionalNumber(item?.changedServing?.quantity) ??
                getPreferredStructuredMealAmount(item, selectedServing)
              const currentServingForEdit =
                findServingByIdentifier(servingOptions, currentServingId) ||
                selectedServing
              const calculated = isStructuredMealRecipeItem(item)
                ? {
                    calories: calculateStructuredMealItemSummary(item).calories,
                    nutrients: calculateStructuredMealItemSummary(item)
                  }
                : calculateDisplayValues(
                    item,
                    currentAmount,
                    parseNumber(item?.originalServingAmount) || 100,
                    item?.changedServing?.unit ||
                      currentServingForEdit?.unitName ||
                      currentServingForEdit?.unit ||
                      getItemDisplayUnit(item)
                  )

              if (isEditing) {
                return (
                  <div
                    key={`${mealSection}-${item?.id || item?.name || index}`}
                    className="rounded-2xl border border-slate-200 bg-slate-50/80 p-5 shadow-sm md:col-span-2 2xl:col-span-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-xl font-semibold text-slate-900">
                          {item?.name || t('pages.myMenus.unnamedItem')}
                        </p>
                        <p className="text-sm text-slate-500">
                          {detectIsRecipe(item)
                            ? t('pages.myMenus.recipeType')
                            : t('pages.myMenus.foodType')}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          handleStudioDeleteItem(mealSection, index)
                        }
                        className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-red-50 text-red-600 transition hover:bg-red-100"
                        title={t('pages.myMenus.delete')}
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>

                    {servingOptions.length > 0 ? (
                      <div className="mt-4 flex flex-col gap-3 xl:flex-row xl:items-center">
                        <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          {t('pages.myMenus.servingOptions')}
                        </label>
                        <div className="flex flex-1 flex-col gap-3 md:flex-row md:items-center">
                          <select
                            value={currentServingId || ''}
                            onChange={event => {
                              const nextServingId = event.target.value || null
                              const nextServing = findServingByIdentifier(
                                servingOptions,
                                nextServingId
                              )
                              const nextAmount = roundServingAmountByUnitSystem(
                                getDefaultAmountForSelectedServing(nextServing)
                              )
                              setStudioDraftValues(prev => ({
                                ...prev,
                                [itemKey]: {
                                  ...(prev[itemKey] || {}),
                                  selectedServingId: nextServingId || '',
                                  amount: nextAmount
                                }
                              }))
                            }}
                            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200 md:w-48"
                          >
                            {servingOptions.map((serving, servingIndex) => {
                              const servingId = getServingIdentifier(serving)
                              return (
                                <option
                                  key={servingId || servingIndex}
                                  value={servingId || ''}
                                >
                                  {serving?.name ||
                                    serving?.innerName ||
                                    serving?.unitName ||
                                    serving?.unit}
                                </option>
                              )
                            })}
                          </select>
                          <div className="flex items-center gap-3">
                            <input
                              type="number"
                              min="0"
                              step="0.1"
                              value={currentAmount}
                              onChange={event => {
                                const inputAmount = event.target.value
                                setStudioDraftValues(prev => ({
                                  ...prev,
                                  [itemKey]: {
                                    ...(prev[itemKey] || {}),
                                    selectedServingId: currentServingId || '',
                                    amount:
                                      inputAmount === '' ? '' : inputAmount
                                  }
                                }))
                              }}
                              className="w-24 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
                            />
                            <span className="text-sm font-medium text-slate-500">
                              {item?.changedServing?.unit ||
                                currentServingForEdit?.unitName ||
                                currentServingForEdit?.unit ||
                                getItemDisplayUnit(item)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : null}

                    {detectIsRecipe(item) ? (
                      <div className="mt-3 space-y-3">
                        <div className="text-sm text-slate-500">
                          <span className="font-semibold">
                            {t('pages.myMenus.originalServing')}:
                          </span>{' '}
                          {item?.numberOfRecipeServings ||
                            item?.originalServings ||
                            1}
                        </div>
                        <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                          <input
                            type="checkbox"
                            checked={
                              draftValue?.showRecipeDetailsInPdf ??
                              shouldShowRecipeDetailsInPdf(item)
                            }
                            onChange={event => {
                              setStudioDraftValues(prev => ({
                                ...prev,
                                [itemKey]: {
                                  ...(prev[itemKey] || {}),
                                  selectedServingId: currentServingId || '',
                                  amount: currentAmount,
                                  showRecipeDetailsInPdf: event.target.checked
                                }
                              }))
                            }}
                            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-400"
                          />
                          {t('pages.myMenus.showRecipeDetailsInPdf')}
                        </label>
                      </div>
                    ) : null}

                    <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                      <div
                        className={`${glassSurfaceClass} px-3 py-3 text-center text-sm font-semibold text-slate-900`}
                      >
                        {t('pages.myMenus.calories')}:{' '}
                        {Math.round(parseNumber(calculated?.calories))}
                      </div>
                      <div
                        className={`${glassSurfaceClass} px-3 py-3 text-center text-sm font-semibold text-slate-900`}
                      >
                        {t('pages.myMenus.proteins')}:{' '}
                        {Math.round(
                          parseNumber(calculated?.nutrients?.proteinsInGrams)
                        )}{' '}
                        g
                      </div>
                      <div
                        className={`${glassSurfaceClass} px-3 py-3 text-center text-sm font-semibold text-slate-900`}
                      >
                        {t('pages.myMenus.carbs')}:{' '}
                        {Math.round(
                          parseNumber(
                            calculated?.nutrients?.carbohydratesInGrams
                          )
                        )}{' '}
                        g
                      </div>
                      <div
                        className={`${glassSurfaceClass} px-3 py-3 text-center text-sm font-semibold text-slate-900`}
                      >
                        {t('pages.myMenus.fat')}:{' '}
                        {Math.round(
                          parseNumber(calculated?.nutrients?.fatInGrams)
                        )}{' '}
                        g
                      </div>
                    </div>
                    <div className="mt-4 flex justify-end gap-3">
                      <button
                        type="button"
                        onClick={async () => {
                          const servingForSave =
                            findServingByIdentifier(
                              servingOptions,
                              currentServingId
                            ) || currentServingForEdit
                          const parsedAmount =
                            currentAmount === ''
                              ? ''
                              : parseNumber(currentAmount)
                          await handleStudioItemChange(
                            mealSection,
                            index,
                            currentItem => ({
                              ...currentItem,
                              showRecipeDetailsInPdf:
                                draftValue?.showRecipeDetailsInPdf ??
                                shouldShowRecipeDetailsInPdf(currentItem),
                              changedServing: {
                                value:
                                  parsedAmount === ''
                                    ? ''
                                    : String(
                                        getChangedServingBaseValue(
                                          parsedAmount,
                                          currentItem?.changedServing?.unit ||
                                            servingForSave?.unitName,
                                          currentItem?.changedServing
                                            ?.servingOption ||
                                            (servingForSave
                                              ? {
                                                  unitName:
                                                    servingForSave?.unitName ||
                                                    servingForSave?.unit ||
                                                    'g',
                                                  value: parseNumber(
                                                    servingForSave?.value ??
                                                      servingForSave?.amount ??
                                                      100
                                                  )
                                                }
                                              : null),
                                          currentItem?.isLiquid
                                        )
                                      ),
                                quantity:
                                  parsedAmount === '' ? '' : parsedAmount,
                                unit:
                                  currentItem?.changedServing?.unit ||
                                  servingForSave?.unitName ||
                                  servingForSave?.unit ||
                                  getItemDisplayUnit(currentItem),
                                servingOption:
                                  currentItem?.changedServing?.servingOption ||
                                  (servingForSave
                                    ? {
                                        unitName:
                                          servingForSave?.unitName ||
                                          servingForSave?.unit ||
                                          'g',
                                        value: parseNumber(
                                          servingForSave?.value ??
                                            servingForSave?.amount ??
                                            100
                                        )
                                      }
                                    : null)
                              }
                            })
                          )
                          closeStudioItemEditor(itemKey)
                        }}
                        className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 px-4 py-2 text-sm font-semibold text-white transition hover:shadow-lg"
                      >
                        {t('pages.myMenus.save')}
                      </button>
                      <button
                        type="button"
                        onClick={() => closeStudioItemEditor(itemKey)}
                        className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        {t('pages.myMenus.cancel')}
                      </button>
                    </div>
                  </div>
                )
              }

              return (
                <div
                  key={`${mealSection}-${item?.id || item?.name || index}`}
                  onClick={() => setViewingItem(item)}
                  className="flex min-w-0 cursor-pointer items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-3 shadow-sm transition hover:border-slate-300 hover:bg-white"
                >
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-slate-200 text-xs font-semibold text-slate-500">
                    {item?.photoUrl ? (
                      <img
                        src={item.photoUrl}
                        alt={item?.name || t('pages.myMenus.menuItemAlt')}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span>{item?.type === 'recipe' ? 'R' : 'F'}</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-semibold text-slate-900">
                      {item?.name || t('pages.myMenus.unnamedItem')}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {Math.round(parseNumber(calculated?.calories))} kcal
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={event => {
                        event.stopPropagation()
                        if (detectIsRecipe(item)) {
                          openStructuredMealEditor({
                            mode: 'studio',
                            mealKey: mealSection,
                            item,
                            itemIndex: index
                          })
                        } else {
                          openStudioItemEditor(
                            mealSection,
                            index,
                            item,
                            selectedServing,
                            currentAmount
                          )
                        }
                      }}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-blue-700 transition hover:bg-blue-100"
                      title={t('pages.myMenus.edit')}
                    >
                      <PencilIcon className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={event => {
                        event.stopPropagation()
                        handleStudioDeleteItem(mealSection, index)
                      }}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-red-50 text-red-600 transition hover:bg-red-100"
                      title={t('pages.myMenus.delete')}
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  const renderItemPreviewModal = () => {
    if (!viewingItem) return null

    const previewServingOptions = buildServingOptionsForMenuItem(
      viewingItem,
      includeImperialServingOptions
    )
    const previewServing =
      findServingByIdentifier(previewServingOptions, viewingItemServingId) ||
      findDefaultServing(previewServingOptions) ||
      previewServingOptions[0] ||
      null
    const previewAmount =
      parseOptionalNumber(viewingItemAmount) ??
      getPreferredStructuredMealAmount(viewingItem, previewServing)
    const previewUnit =
      previewServing?.unitName ||
      previewServing?.unit ||
      (viewingItem?.isLiquid ? 'ml' : 'g')
    const structuredMealSummary = isStructuredMealRecipeItem(viewingItem)
      ? calculateStructuredMealItemSummary(viewingItem)
      : null
    const previewValues = structuredMealSummary
      ? {
          calories: structuredMealSummary.calories,
          nutrients: structuredMealSummary
        }
      : calculateDisplayValues(
          viewingItem,
          previewAmount,
          parseNumber(viewingItem?.originalServingAmount) || 100,
          previewUnit
        )
    const nutrients = safeNutrients(previewValues?.nutrients || {})
    const ingredients = Array.isArray(viewingItem?.ingredients)
      ? viewingItem.ingredients
      : []
    const ingredientNames = Array.isArray(viewingItem?.ingredientNames)
      ? viewingItem.ingredientNames.filter(Boolean)
      : []
    const previewAddMode = studioActiveMealType
      ? 'studio'
      : activeMealType
        ? 'builder'
        : null
    const instructions = Array.isArray(viewingItem?.recipeSteps?.instructions)
      ? viewingItem.recipeSteps.instructions
      : []

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6 backdrop-blur-sm">
        <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h3 className="truncate text-2xl font-bold text-slate-900">
                {viewingItem?.name || t('pages.myMenus.unnamedItem')}
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                {detectIsRecipe(viewingItem)
                  ? t('pages.myMenus.recipeType')
                  : t('pages.myMenus.foodType')}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setViewingItem(null)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-slate-200"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-5 grid gap-6 lg:grid-cols-[180px_minmax(0,1fr)]">
            <div className="overflow-hidden rounded-3xl bg-slate-100">
              {viewingItem?.photoUrl ? (
                <img
                  src={viewingItem.photoUrl}
                  alt={viewingItem?.name || t('pages.myMenus.menuItemAlt')}
                  className="h-44 w-full object-cover"
                />
              ) : (
                <div className="flex h-44 w-full items-center justify-center text-4xl font-bold text-slate-400">
                  {detectIsRecipe(viewingItem) ? 'R' : 'F'}
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <div
                  className={`${glassSurfaceClass} px-3 py-3 text-center text-sm font-semibold text-slate-900`}
                >
                  {t('pages.myMenus.calories')}:{' '}
                  {Math.round(parseNumber(previewValues?.calories))}
                </div>
                <div
                  className={`${glassSurfaceClass} px-3 py-3 text-center text-sm font-semibold text-slate-900`}
                >
                  {t('pages.myMenus.proteins')}:{' '}
                  {roundMacro(nutrients.proteinsInGrams)} g
                </div>
                <div
                  className={`${glassSurfaceClass} px-3 py-3 text-center text-sm font-semibold text-slate-900`}
                >
                  {t('pages.myMenus.carbs')}:{' '}
                  {roundMacro(nutrients.carbohydratesInGrams)} g
                </div>
                <div
                  className={`${glassSurfaceClass} px-3 py-3 text-center text-sm font-semibold text-slate-900`}
                >
                  {t('pages.myMenus.fat')}: {roundMacro(nutrients.fatInGrams)} g
                </div>
              </div>

              {previewServingOptions.length > 0 ? (
                <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-[minmax(0,1fr)_140px_auto] md:items-end">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {t('pages.myMenus.servingOptions')}
                    </label>
                    <select
                      value={viewingItemServingId}
                      onChange={event => {
                        const nextServing =
                          findServingByIdentifier(
                            previewServingOptions,
                            event.target.value
                          ) || previewServingOptions[0]
                        setViewingItemServingId(event.target.value)
                        setViewingItemAmount(
                          String(
                            getDefaultAmountForSelectedServing(nextServing) ||
                              ''
                          )
                        )
                      }}
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    >
                      {previewServingOptions.map(option => {
                        const optionId = getServingIdentifier(option)
                        return (
                          <option key={optionId} value={optionId}>
                            {option?.unitName ||
                              option?.unit ||
                              option?.name ||
                              'g'}
                          </option>
                        )
                      })}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {t('pages.myMenus.quantity')}
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={viewingItemAmount}
                      onChange={event =>
                        setViewingItemAmount(event.target.value)
                      }
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    />
                  </div>
                  <div className="pb-3 text-sm font-medium text-slate-600">
                    {previewUnit}
                  </div>
                </div>
              ) : null}

              {ingredients.length > 0 || ingredientNames.length > 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                    {t('pages.recipes.ingredients')}
                  </p>
                  <div className="mt-3 space-y-2">
                    {ingredients.length > 0
                      ? ingredients.map((ingredient, index) => (
                          <div
                            key={`${ingredient?.id || ingredient?.name || index}-ingredient`}
                            className="rounded-xl bg-white px-3 py-2 text-sm text-slate-700"
                          >
                            <span className="font-medium text-slate-900">
                              {ingredient?.name ||
                                t('pages.myMenus.unnamedItem')}
                            </span>
                            {ingredient?.quantity ? (
                              <span className="ml-2 text-slate-500">
                                {ingredient.quantity} {ingredient?.unit || 'g'}
                              </span>
                            ) : null}
                          </div>
                        ))
                      : ingredientNames.map((ingredientName, index) => (
                          <div
                            key={`${ingredientName}-${index}-ingredient-name`}
                            className="rounded-xl bg-white px-3 py-2 text-sm text-slate-700"
                          >
                            <span className="font-medium text-slate-900">
                              {ingredientName}
                            </span>
                          </div>
                        ))}
                  </div>
                </div>
              ) : null}

              {instructions.length > 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                    {t('pages.myMenus.instructions')}
                  </p>
                  <ol className="mt-3 space-y-2 text-sm text-slate-700">
                    {instructions.map((instruction, index) => (
                      <li
                        key={`${index}-${instruction}`}
                        className="rounded-xl bg-white px-3 py-2"
                      >
                        <span className="mr-2 font-semibold text-slate-900">
                          {index + 1}.
                        </span>
                        {instruction}
                      </li>
                    ))}
                  </ol>
                </div>
              ) : null}
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-3">
            {previewAddMode ? (
              <button
                type="button"
                onClick={async () => {
                  if (previewAddMode === 'studio' && studioActiveMealType) {
                    await handleStudioAddItem(
                      studioActiveMealType,
                      viewingItem,
                      {
                        servingOption: previewServing,
                        amount: previewAmount
                      }
                    )
                  } else if (previewAddMode === 'builder') {
                    await addItemToPlan(viewingItem, {
                      servingOption: previewServing,
                      amount: previewAmount
                    })
                  }
                  setViewingItem(null)
                }}
                className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 px-5 py-3 text-sm font-semibold text-white transition hover:shadow-lg"
              >
                {t('pages.myMenus.addItem')}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setViewingItem(null)}
              className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              {t('common.close')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  const renderStructuredMealEditorModal = () => {
    if (!structuredMealEditor) return null

    const isSnackMeal = structuredMealEditor.mealKey === 'snackPlan'
    const structuredMealTotals =
      calculateStructuredMealDraftSummary(structuredMealEditor)

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6 backdrop-blur-sm">
        <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-2xl font-bold text-slate-900">
                {structuredMealEditor.itemIndex === null
                  ? 'Create structured meal'
                  : 'Edit structured meal'}
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                Recipes prefill ingredients, steps, and photo, but remain fully
                editable.
              </p>
            </div>
            <button
              type="button"
              onClick={closeStructuredMealEditor}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-slate-200"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-6 space-y-5">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center">
                <div className="relative flex-1">
                  <MagnifyingGlassIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={structuredMealEditor.recipeSearchText}
                    onChange={event =>
                      updateStructuredMealEditor(prev => ({
                        ...prev,
                        recipeSearchText: event.target.value
                      }))
                    }
                    placeholder="Search recipe to import"
                    className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  />
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    updateStructuredMealEditor(prev => ({
                      ...prev,
                      searchingRecipes: true
                    }))
                    try {
                      const results = await handleStructuredMealRecipeSearch(
                        structuredMealEditor.recipeSearchText
                      )
                      updateStructuredMealEditor(prev => ({
                        ...prev,
                        recipeSearchResults: results,
                        searchingRecipes: false
                      }))
                    } catch (error) {
                      console.error(
                        'Failed to search recipes for structured meal',
                        error
                      )
                      updateStructuredMealEditor(prev => ({
                        ...prev,
                        recipeSearchResults: [],
                        searchingRecipes: false
                      }))
                    }
                  }}
                  className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
                  disabled={structuredMealEditor.searchingRecipes}
                >
                  {structuredMealEditor.searchingRecipes
                    ? 'Searching...'
                    : 'Import recipe'}
                </button>
              </div>

              {structuredMealEditor.recipeSearchResults.length > 0 ? (
                <div className="mt-3 max-h-56 overflow-y-auto rounded-2xl border border-slate-200 bg-white">
                  {structuredMealEditor.recipeSearchResults.map(
                    (item, index) => (
                      <div
                        key={`structured-recipe-${item?.id || item?.name || index}`}
                        className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900">
                            {item?.name ||
                              item?.title ||
                              t('pages.myMenus.unnamedItem')}
                          </p>
                          <p className="text-xs text-slate-500">
                            {t('pages.myMenus.recipeType')}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={async () => {
                            await importRecipeIntoStructuredMeal(item)
                          }}
                          className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-500"
                        >
                          <PlusIcon className="h-4 w-4" />
                          Use
                        </button>
                      </div>
                    )
                  )}
                </div>
              ) : null}
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                {t('pages.myMenus.name')}
              </label>
              <input
                type="text"
                value={structuredMealEditor.name}
                onChange={event =>
                  updateStructuredMealEditor(prev => ({
                    ...prev,
                    name: event.target.value
                  }))
                }
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Photo URL
                </label>
                <input
                  type="text"
                  value={structuredMealEditor.photoUrl}
                  onChange={event =>
                    updateStructuredMealEditor(prev => ({
                      ...prev,
                      photoUrl: event.target.value
                    }))
                  }
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  placeholder="https://..."
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Servings
                </label>
                <input
                  type="number"
                  min="1"
                  value={structuredMealEditor.numberOfRecipeServings}
                  onChange={event =>
                    updateStructuredMealEditor(prev => ({
                      ...prev,
                      numberOfRecipeServings: Math.max(
                        1,
                        parseNumber(event.target.value) || 1
                      )
                    }))
                  }
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </div>
            </div>

            {!isSnackMeal ? (
              <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={structuredMealEditor.showRecipeDetailsInPdf}
                  onChange={event =>
                    updateStructuredMealEditor(prev => ({
                      ...prev,
                      showRecipeDetailsInPdf: event.target.checked
                    }))
                  }
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-400"
                />
                {t('pages.myMenus.showRecipeDetailsInPdf')}
              </label>
            ) : null}

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <div
                className={`${glassSurfaceClass} px-3 py-3 text-center text-sm font-semibold text-slate-900`}
              >
                {t('pages.myMenus.calories')}:{' '}
                {Math.round(parseNumber(structuredMealTotals.calories))}
              </div>
              <div
                className={`${glassSurfaceClass} px-3 py-3 text-center text-sm font-semibold text-slate-900`}
              >
                {t('pages.myMenus.proteins')}:{' '}
                {roundMacro(structuredMealTotals.proteinsInGrams)} g
              </div>
              <div
                className={`${glassSurfaceClass} px-3 py-3 text-center text-sm font-semibold text-slate-900`}
              >
                {t('pages.myMenus.carbs')}:{' '}
                {roundMacro(structuredMealTotals.carbohydratesInGrams)} g
              </div>
              <div
                className={`${glassSurfaceClass} px-3 py-3 text-center text-sm font-semibold text-slate-900`}
              >
                {t('pages.myMenus.fat')}:{' '}
                {roundMacro(structuredMealTotals.fatInGrams)} g
              </div>
            </div>

            <div className="grid gap-5 xl:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                    {t('pages.recipes.ingredients')}
                  </p>
                </div>
                <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-3">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center">
                    <div className="relative flex-1">
                      <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={structuredMealEditor.ingredientSearchText}
                        onChange={event =>
                          updateStructuredMealEditor(prev => ({
                            ...prev,
                            ingredientSearchText: event.target.value
                          }))
                        }
                        placeholder="Search ingredient from database"
                        className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        updateStructuredMealEditor(prev => ({
                          ...prev,
                          searchingIngredients: true
                        }))
                        try {
                          const results =
                            await handleStructuredMealIngredientSearch(
                              structuredMealEditor.ingredientSearchText
                            )
                          updateStructuredMealEditor(prev => ({
                            ...prev,
                            ingredientSearchResults: results,
                            searchingIngredients: false
                          }))
                        } catch (error) {
                          console.error(
                            'Failed to search structured meal ingredients',
                            error
                          )
                          updateStructuredMealEditor(prev => ({
                            ...prev,
                            ingredientSearchResults: [],
                            searchingIngredients: false
                          }))
                        }
                      }}
                      className="rounded-full bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm"
                    >
                      {structuredMealEditor.searchingIngredients
                        ? 'Searching...'
                        : 'Add from DB'}
                    </button>
                  </div>
                  {structuredMealEditor.ingredientSearchResults.length > 0 ? (
                    <div className="mt-3 max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50">
                      {structuredMealEditor.ingredientSearchResults.map(
                        (ingredientItem, index) => (
                          <div
                            key={`structured-ingredient-${ingredientItem?.id || ingredientItem?.name || index}`}
                            className="flex items-center justify-between gap-3 border-b border-slate-200 px-3 py-2 last:border-b-0"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-slate-900">
                                {ingredientItem?.name ||
                                  t('pages.myMenus.unnamedItem')}
                              </p>
                              <p className="text-xs text-slate-500">
                                {Math.round(
                                  parseNumber(ingredientItem?.caloriesPer100)
                                )}{' '}
                                kcal / 100g
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={async () => {
                                await importIngredientIntoStructuredMeal(
                                  ingredientItem
                                )
                              }}
                              className="rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-500"
                            >
                              Use
                            </button>
                          </div>
                        )
                      )}
                    </div>
                  ) : null}
                </div>
                <div className="mt-3 space-y-2">
                  {structuredMealEditor.ingredients.map((ingredient, index) => (
                    <div
                      key={`ingredient-${index}`}
                      className="rounded-2xl border border-slate-200 bg-white p-3"
                    >
                      <div className="grid grid-cols-1 gap-2 md:grid-cols-[minmax(180px,1.8fr)_92px_72px_auto]">
                        <div className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-900">
                          <span className="block truncate">
                            {ingredient?.name || t('pages.myMenus.unnamedItem')}
                          </span>
                        </div>
                        <input
                          type="number"
                          min="0"
                          step="0.1"
                          value={ingredient?.quantity ?? ''}
                          onChange={event =>
                            updateStructuredMealEditor(prev => ({
                              ...prev,
                              ingredients: prev.ingredients.map(
                                (entry, entryIndex) =>
                                  entryIndex === index
                                    ? {
                                        ...entry,
                                        quantity:
                                          event.target.value === ''
                                            ? ''
                                            : event.target.value
                                      }
                                    : entry
                              )
                            }))
                          }
                          placeholder="0"
                          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
                        />
                        <input
                          type="text"
                          value={ingredient?.unit || 'g'}
                          onChange={event =>
                            updateStructuredMealEditor(prev => ({
                              ...prev,
                              ingredients: prev.ingredients.map(
                                (entry, entryIndex) =>
                                  entryIndex === index
                                    ? {
                                        ...entry,
                                        unit: event.target.value || 'g'
                                      }
                                    : entry
                              )
                            }))
                          }
                          placeholder="g"
                          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            updateStructuredMealEditor(prev => ({
                              ...prev,
                              ingredients: prev.ingredients.filter(
                                (_, entryIndex) => entryIndex !== index
                              )
                            }))
                          }
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-red-50 text-red-600 transition hover:bg-red-100"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="mt-2 text-xs text-slate-500">
                        {(() => {
                          const ingredientTotals =
                            calculateStructuredMealIngredientNutrition(
                              ingredient
                            )
                          return `${Math.round(ingredientTotals.calories)} kcal · P ${roundMacro(
                            ingredientTotals.proteinsInGrams
                          )}g · C ${roundMacro(
                            ingredientTotals.carbohydratesInGrams
                          )}g · F ${roundMacro(ingredientTotals.fatInGrams)}g`
                        })()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                    {t('pages.myMenus.instructions')}
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      updateStructuredMealEditor(prev => ({
                        ...prev,
                        steps: [...prev.steps, '']
                      }))
                    }
                    className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm"
                  >
                    Add
                  </button>
                </div>
                <div className="mt-3 space-y-2">
                  {structuredMealEditor.steps.map((step, index) => (
                    <div
                      key={`step-${index}`}
                      className="flex items-start gap-2"
                    >
                      <textarea
                        value={step}
                        onChange={event =>
                          updateStructuredMealEditor(prev => ({
                            ...prev,
                            steps: prev.steps.map((entry, entryIndex) =>
                              entryIndex === index ? event.target.value : entry
                            )
                          }))
                        }
                        rows={2}
                        className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          updateStructuredMealEditor(prev => ({
                            ...prev,
                            steps: prev.steps.filter(
                              (_, entryIndex) => entryIndex !== index
                            )
                          }))
                        }
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-red-50 text-red-600 transition hover:bg-red-100"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={closeStructuredMealEditor}
                className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                {t('pages.myMenus.cancel')}
              </button>
              <button
                type="button"
                onClick={handleSaveStructuredMeal}
                disabled={!structuredMealEditor.name.trim()}
                className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 px-5 py-3 text-sm font-semibold text-white transition hover:shadow-lg disabled:opacity-60"
              >
                {t('pages.myMenus.save')}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (loadingTemplates && templates.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
          <p className="mt-4 text-gray-600">{t('pages.myMenus.loading')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-8 text-gray-900">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 -left-10 h-64 w-64 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="absolute top-24 -right-10 h-72 w-72 rounded-full bg-purple-500/15 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-60 w-60 rounded-full bg-amber-400/10 blur-3xl" />
      </div>

      <div className="relative space-y-6">
        <div className="space-y-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h1 className="text-3xl font-black tracking-tight text-slate-950 md:text-4xl">
                {t('pages.myMenus.title')}
              </h1>
              <p className="mt-3 max-w-2xl text-base text-slate-500">
                {t('pages.myMenus.subtitle')}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => openTextToMenu()}
                className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-lg transition hover:-translate-y-0.5 hover:shadow-2xl"
                title={
                  t('pages.menus.generateFromText') || 'Generate from Text'
                }
              >
                <SparklesIcon className="h-4 w-4" />
                {t('pages.menus.generateFromText') || 'Generate from Text'}
              </button>
              <button
                onClick={openBuilderForNew}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 px-5 py-3 text-sm font-semibold text-white shadow-lg transition hover:-translate-y-0.5 hover:shadow-2xl"
              >
                <PlusIcon className="h-4 w-4" />
                {t('pages.myMenus.addMenu')}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:max-w-3xl">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-50 text-orange-600">
                  <DocumentTextIcon className="h-7 w-7" />
                </div>
                <p className="text-base font-medium text-slate-600">
                  {t('pages.myMenus.totalMenus')}
                </p>
              </div>
              <p className="mt-8 text-3xl font-black tracking-tight text-slate-950">
                {groupedTemplates.length}
              </p>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-50 text-orange-600">
                  <UserGroupIcon className="h-7 w-7" />
                </div>
                <p className="text-base font-medium text-slate-600">
                  {t('pages.myMenus.activeClients')}
                </p>
              </div>
              <p className="mt-8 text-3xl font-black tracking-tight text-slate-950">
                {totalAssignedClients}
              </p>
            </div>
          </div>

          {error && (
            <div className="rounded-2xl border border-red-200/60 bg-red-50/80 p-4 shadow-lg backdrop-blur">
              <p className="text-red-800">{error}</p>
            </div>
          )}

          <div className={`${glassCardClass} p-6 md:p-8 text-gray-900`}>
            <div className="absolute inset-0 bg-gradient-to-br from-white/70 via-white/40 to-white/10" />
            <div className="relative">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
                <div>
                  <h2 className="text-2xl font-semibold text-gray-900">
                    {t('pages.myMenus.menus')}
                  </h2>
                </div>
                <div className="flex flex-col gap-2 w-full md:w-auto md:flex-row md:items-center">
                  <div className="relative flex-1 md:w-72">
                    <MagnifyingGlassIcon className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder={t('pages.myMenus.searchMenus')}
                      value={templateSearchTerm}
                      onChange={e => setTemplateSearchTerm(e.target.value)}
                      className="w-full rounded-2xl border border-white/70 bg-white/90 py-3 pl-11 pr-4 text-sm text-gray-900 placeholder:text-gray-500 shadow-inner focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() =>
                          setIsTemplateFilterOpen(isOpen => !isOpen)
                        }
                        className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/70 bg-white/80 px-4 py-3 text-sm font-medium text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-200 hover:bg-white"
                      >
                        <ChevronDownIcon className="h-4 w-4 rotate-90" />
                        {t('pages.myMenus.filter')}
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">
                          {activeTemplateFilterLabel}
                        </span>
                      </button>
                      {isTemplateFilterOpen ? (
                        <div className="absolute right-0 z-20 mt-2 min-w-[220px] overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
                          {templateFilterOptions.map(option => {
                            const isActive = option.id === templateFilter

                            return (
                              <button
                                key={option.id}
                                type="button"
                                onClick={() => {
                                  setTemplateFilter(option.id)
                                  setIsTemplateFilterOpen(false)
                                }}
                                className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition ${
                                  isActive
                                    ? 'bg-blue-50 font-semibold text-blue-700'
                                    : 'text-slate-700 hover:bg-slate-50'
                                }`}
                              >
                                <span>{option.label}</span>
                                {isActive ? (
                                  <span className="text-xs uppercase tracking-wide text-blue-600">
                                    {t('pages.myMenus.selected')}
                                  </span>
                                ) : null}
                              </button>
                            )
                          })}
                        </div>
                      ) : null}
                    </div>
                    <button
                      onClick={() => openTextToMenu()}
                      className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl"
                      title={
                        t('pages.menus.generateFromText') ||
                        'Generate from Text'
                      }
                    >
                      <SparklesIcon className="w-4 h-4" />
                      {t('pages.menus.generateFromText') ||
                        'Generate from Text'}
                    </button>
                    <button
                      onClick={loadTemplates}
                      disabled={loadingTemplates}
                      className="inline-flex items-center justify-center rounded-full border border-white/70 bg-white/80 p-3 text-blue-600 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:bg-white"
                      title={t('pages.myMenus.refreshTemplatesList')}
                    >
                      <ArrowPathIcon
                        className={`w-5 h-5 ${loadingTemplates ? 'animate-spin' : ''}`}
                      />
                    </button>
                    <button
                      onClick={() => setTemplatesExpanded(!templatesExpanded)}
                      className="inline-flex items-center justify-center rounded-full border border-white/70 bg-white/80 p-3 text-gray-700 shadow-sm transition hover:-translate-y-0.5 hover:border-gray-200 hover:bg-white"
                      title={
                        templatesExpanded
                          ? t('pages.myMenus.collapseTemplates')
                          : t('pages.myMenus.expandTemplates')
                      }
                    >
                      {templatesExpanded ? (
                        <ChevronUpIcon className="w-5 h-5" />
                      ) : (
                        <ChevronDownIcon className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {!selectedContainerModalOpen && templatesExpanded && (
                <>
                  {groupedTemplates.length === 0 ? (
                    <div className="text-center py-12">
                      <p className="text-gray-600">
                        {t('pages.myMenus.noTemplates')}
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-6">
                        {paginatedContainers.map(container => {
                          const assignedUsers = container?.assignedUsers || []
                          const isContainerDeleting =
                            deletingContainerKey === container.key
                          const isContainerActionBusy =
                            isContainerDeleting ||
                            renamingContainer ||
                            copyingContainer

                          return (
                            <div
                              key={container.key}
                              className="relative overflow-visible rounded-3xl border border-slate-200 bg-white shadow-sm"
                            >
                              <div className="flex flex-col gap-4 border-b border-slate-200 px-6 py-5 md:flex-row md:items-center md:justify-between">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedContainerKey(container.key)
                                    setSelectedContainerMenuId(
                                      container?.menus?.[0]?.id || null
                                    )
                                    setSelectedContainerModalOpen(true)
                                  }}
                                  className="flex-1 rounded-2xl px-2 py-2 text-left transition hover:bg-slate-50 cursor-pointer"
                                >
                                  <h3 className="mt-2 text-2xl font-semibold text-slate-900">
                                    {container.containerName}
                                  </h3>
                                  <p className="mt-1 text-sm text-slate-500">
                                    {container.menus.length}{' '}
                                    {t('pages.myMenus.menus')}
                                  </p>
                                </button>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => openTextToMenu(container)}
                                    disabled={isContainerActionBusy}
                                    className="inline-flex items-center justify-center gap-1.5 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl"
                                    title={
                                      t('pages.menus.generateFromText') ||
                                      'Generate from Text'
                                    }
                                  >
                                    <SparklesIcon className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={() =>
                                      openBuilderForContainer(container)
                                    }
                                    disabled={isContainerActionBusy}
                                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 px-4 py-2 text-sm font-semibold text-white shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl"
                                    title={t('pages.myMenus.addDay')}
                                  >
                                    <PlusIcon className="h-4 w-4" />
                                    {t('pages.myMenus.addDay')}
                                  </button>
                                  <ControlsDropdown
                                    absolute
                                    actions={[
                                      {
                                        icon: PencilIcon,
                                        labelKey: 'common.controls.rename',
                                        colorClass: 'text-blue-700',
                                        disabled: isContainerActionBusy,
                                        onClick: () =>
                                          handleOpenRenameContainerModal(
                                            container
                                          )
                                      },
                                      {
                                        icon: DocumentDuplicateIcon,
                                        labelKey:
                                          'common.controls.copyContainer',
                                        colorClass: 'text-violet-700',
                                        disabled: isContainerActionBusy,
                                        onClick: () =>
                                          handleOpenCopyContainerModal(
                                            container
                                          )
                                      },
                                      ...(isAdmin
                                        ? [
                                            {
                                              icon: GlobeAltIcon,
                                              labelKey:
                                                'common.controls.copyToCountry',
                                              colorClass: 'text-emerald-700',
                                              disabled: isContainerActionBusy,
                                              onClick: () =>
                                                handleOpenCopyContainerToCountryModal(
                                                  container
                                                )
                                            }
                                          ]
                                        : []),
                                      {
                                        icon: TrashIcon,
                                        labelKey:
                                          'pages.myMenus.deleteContainer',
                                        colorClass: 'text-red-600',
                                        disabled: isContainerActionBusy,
                                        loading: isContainerDeleting,
                                        onClick: () =>
                                          handleDeleteContainer(container)
                                      }
                                    ]}
                                  />
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>

                      <div className="mt-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-700">
                              {t('pages.myMenus.rowsPerPage')}
                            </span>
                            <select
                              value={itemsPerPage}
                              onChange={e => {
                                setItemsPerPage(Number(e.target.value))
                                setCurrentPage(1)
                              }}
                              className="rounded-lg border border-white/70 bg-white/90 px-3 py-2 text-sm font-semibold text-gray-800 shadow-inner focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
                            >
                              {[5, 10, 20].map(size => (
                                <option key={size} value={size}>
                                  {size}
                                </option>
                              ))}
                            </select>
                          </div>
                          <span className="text-sm text-gray-700">
                            {t('pages.myMenus.showing')}{' '}
                            {groupedTemplates.length === 0
                              ? 0
                              : (currentPage - 1) * itemsPerPage + 1}{' '}
                            -{' '}
                            {Math.min(
                              currentPage * itemsPerPage,
                              groupedTemplates.length
                            )}{' '}
                            {t('pages.myMenus.of')} {groupedTemplates.length}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            className="rounded-full border border-white/70 bg-white/90 px-4 py-2 text-sm font-semibold text-gray-800 shadow-sm transition hover:-translate-y-0.5 hover:border-gray-200 hover:bg-white disabled:opacity-60"
                            onClick={() =>
                              setCurrentPage(prev => Math.max(1, prev - 1))
                            }
                            disabled={currentPage === 1}
                          >
                            {t('pages.myMenus.previous')}
                          </button>
                          <span className="text-sm text-gray-700">
                            {t('pages.myMenus.page')} {currentPage}{' '}
                            {t('pages.myMenus.of')} {totalPages}
                          </span>
                          <button
                            className="rounded-full border border-white/70 bg-white/90 px-4 py-2 text-sm font-semibold text-gray-800 shadow-sm transition hover:-translate-y-0.5 hover:border-gray-200 hover:bg-white disabled:opacity-60"
                            onClick={() =>
                              setCurrentPage(prev =>
                                Math.min(totalPages, prev + 1)
                              )
                            }
                            disabled={currentPage === totalPages}
                          >
                            {t('pages.myMenus.next')}
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Builder Modal */}
        {showBuilderModal && (
          <div className="fixed inset-0 z-40 flex items-start justify-center bg-slate-900/40 px-4 py-10 backdrop-blur-sm overflow-y-auto">
            <div className="relative w-full max-w-5xl">
              <div className={`${glassCardClass} p-6 md:p-8 relative`}>
                <div className="absolute inset-0 bg-gradient-to-br from-white/80 via-white/50 to-white/20" />
                <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-blue-500/10 blur-3xl" />
                <div className="absolute -left-16 top-1/2 h-48 w-48 -translate-y-1/2 rounded-full bg-purple-500/10 blur-3xl" />

                <div className="relative">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-3xl font-bold text-gray-900">
                        {editingTemplateId
                          ? t('pages.myMenus.editMenuTemplate')
                          : t('pages.myMenus.createMenuTemplate')}
                      </h2>
                      <p className="mt-2 text-sm text-gray-600">
                        {isEditingContainerMenu
                          ? t('pages.myMenus.editingMenuInContainer', {
                              containerName: menuContainerName
                            })
                          : addingToExistingContainer
                            ? t('pages.myMenus.addingMenuToContainer', {
                                containerName: menuContainerName
                              })
                            : editingTemplateId
                              ? t('pages.myMenus.curateMeals')
                              : t('pages.myMenus.numberOfDaysHelp')}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {editingTemplateId && (
                        <span className={softBadgeClass}>
                          {t('pages.myMenus.editingExisting')}
                        </span>
                      )}
                      <button
                        onClick={() => {
                          resetBuilder()
                          setShowBuilderModal(false)
                        }}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/80 text-gray-700 shadow-sm transition hover:-translate-y-0.5 hover:shadow"
                      >
                        <XMarkIcon className="h-5 w-5" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-6 space-y-6">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                      <div className="md:col-span-2 space-y-4">
                        {!isContainerScopedBuilder && (
                          <div>
                            <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600 mb-2">
                              {t('pages.myMenus.name')}
                            </label>
                            <input
                              type="text"
                              value={menuContainerName}
                              onChange={e =>
                                setMenuContainerName(e.target.value)
                              }
                              className="w-full rounded-xl border border-white/60 bg-white/80 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-500 shadow-inner focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
                              placeholder={t(
                                'pages.myMenus.menuContainerNamePlaceholder'
                              )}
                            />
                          </div>
                        )}
                        {isContainerScopedBuilder ? (
                          <div>
                            <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600 mb-2">
                              {t('pages.myMenus.dayMenuName')}
                            </label>
                            <input
                              type="text"
                              value={menuName}
                              onChange={e => setMenuName(e.target.value)}
                              className="w-full rounded-xl border border-white/60 bg-white/80 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-500 shadow-inner focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
                              placeholder={t(
                                'pages.myMenus.dayMenuNamePlaceholder'
                              )}
                            />
                          </div>
                        ) : (
                          <div>
                            <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600 mb-2">
                              {t('pages.myMenus.numberOfDays')}
                            </label>
                            <input
                              type="number"
                              min="1"
                              max="14"
                              value={numberOfDays}
                              onChange={e => {
                                const nextValue = e.target.value
                                if (nextValue === '') {
                                  setNumberOfDays('')
                                  return
                                }

                                const parsedValue = Number.parseInt(
                                  nextValue,
                                  10
                                )
                                if (!Number.isFinite(parsedValue)) {
                                  return
                                }

                                setNumberOfDays(
                                  String(Math.max(1, Math.min(14, parsedValue)))
                                )
                              }}
                              className="w-full rounded-xl border border-white/60 bg-white/80 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-500 shadow-inner focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
                            />
                            <p className="mt-2 text-xs text-gray-500">
                              {t('pages.myMenus.numberOfDaysHelp')}
                            </p>
                          </div>
                        )}

                        <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-white/60 bg-white/60 p-4 backdrop-blur-md">
                          <div className="flex-1 min-w-[180px]">
                            <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600 mb-1">
                              {t('pages.myMenus.country')}
                            </label>
                            <select
                              value={countryCode}
                              onChange={e => setCountryCode(e.target.value)}
                              className="w-full rounded-xl border border-white/70 bg-white/90 px-3 py-2 text-sm font-medium text-gray-800 shadow-inner focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
                            >
                              <option value="RO">Romania</option>
                              <option value="US">United States</option>
                              <option value="IT">Italy</option>
                              <option value="ES">Spain</option>
                              <option value="UK">United Kingdom</option>
                              <option value="DE">Germany</option>
                              <option value="FR">France</option>
                              <option value="HU">Hungary</option>
                            </select>
                          </div>
                          {isAdmin ? (
                            <label className="inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/80 px-4 py-2 text-sm font-medium text-gray-700 shadow-sm">
                              <input
                                type="checkbox"
                                checked={isAssignableByUser}
                                onChange={e =>
                                  setIsAssignableByUser(e.target.checked)
                                }
                                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-400"
                              />
                              {t('pages.myMenus.assignableByUser')}
                            </label>
                          ) : null}
                        </div>
                      </div>
                      <div className="space-y-3 rounded-2xl border border-white/60 bg-gradient-to-br from-blue-50/80 via-purple-50/70 to-white/70 p-4 shadow-inner backdrop-blur">
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                          {t('pages.myMenus.quickTips')}
                        </p>
                        <ul className="space-y-2 text-sm text-gray-700">
                          <li className="flex items-start gap-2">
                            <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-blue-500" />
                            {t('pages.myMenus.tip1')}
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-purple-500" />
                            {t('pages.myMenus.tip2')}
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-amber-500" />
                            {t('pages.myMenus.tip3')}
                          </li>
                        </ul>
                      </div>
                    </div>

                    {editingTemplateId ? (
                      <>
                        <div className="grid grid-cols-1 gap-3 rounded-2xl border border-white/70 bg-white/75 p-4 md:grid-cols-5">
                          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm md:col-span-1">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                              {t('pages.myMenus.totalMenu')}
                            </p>
                            <p className="mt-2 text-2xl font-bold text-slate-900">
                              {Math.round(builderTotals.total.calories)} kcal
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              P{' '}
                              {roundMacro(builderTotals.total.proteinsInGrams)}g
                              · C{' '}
                              {roundMacro(
                                builderTotals.total.carbohydratesInGrams
                              )}
                              g · F {roundMacro(builderTotals.total.fatInGrams)}
                              g
                            </p>
                          </div>
                          {mealTypeOptions.map(meal => {
                            const totals = builderTotals.perMeal[meal.id]
                            return (
                              <div
                                key={meal.id}
                                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
                              >
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                  {t(
                                    `pages.myMenus.${meal.id.replace('Plan', '')}`
                                  )}
                                </p>
                                <p className="mt-2 text-xl font-bold text-slate-900">
                                  {Math.round(totals?.calories || 0)} kcal
                                </p>
                                <p className="mt-1 text-xs text-slate-500">
                                  P {roundMacro(totals?.proteinsInGrams || 0)}g
                                  · C{' '}
                                  {roundMacro(
                                    totals?.carbohydratesInGrams || 0
                                  )}
                                  g · F {roundMacro(totals?.fatInGrams || 0)}g
                                </p>
                              </div>
                            )
                          })}
                        </div>

                        {/* Search for items */}
                        <form onSubmit={handleSearch} className="space-y-3">
                          <div className="flex flex-col gap-3 md:flex-row md:items-center">
                            <div className="relative flex-1">
                              <MagnifyingGlassIcon className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                              <input
                                type="text"
                                value={searchText}
                                onChange={e => setSearchText(e.target.value)}
                                placeholder={t(
                                  'pages.myMenus.searchFoodsRecipes'
                                )}
                                className="w-full rounded-2xl border border-white/70 bg-white/90 py-3 pl-11 pr-4 text-sm text-gray-900 placeholder:text-gray-500 shadow-inner focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
                              />
                            </div>
                            <label className="inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/80 px-4 py-2 text-sm font-medium text-gray-700 shadow-sm">
                              <input
                                type="checkbox"
                                checked={onlyRecipes}
                                onChange={e => setOnlyRecipes(e.target.checked)}
                                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-400"
                              />
                              {t('pages.myMenus.recipesOnly')}
                            </label>
                            <button
                              type="submit"
                              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 px-5 py-3 text-sm font-semibold text-white shadow-lg transition hover:shadow-xl disabled:opacity-60"
                              disabled={searching}
                            >
                              {searching
                                ? t('pages.myMenus.searching')
                                : t('pages.myMenus.search')}
                            </button>
                          </div>
                        </form>

                        {/* Meal type selector */}
                        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/70 bg-white/70 p-2 backdrop-blur">
                          {mealTypeOptions.map(meal => (
                            <button
                              key={meal.id}
                              onClick={() => setActiveMealType(meal.id)}
                              className={`group rounded-xl px-4 py-2 text-sm font-semibold transition ${
                                activeMealType === meal.id
                                  ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg'
                                  : 'text-gray-700 hover:bg-white hover:shadow'
                              }`}
                            >
                              {meal.label}
                            </button>
                          ))}
                        </div>

                        {activeMealType !== 'snackPlan' ? (
                          <div className="flex justify-end">
                            <button
                              type="button"
                              onClick={() =>
                                openStructuredMealEditor({
                                  mode: 'builder',
                                  mealKey: activeMealType
                                })
                              }
                              className="inline-flex items-center gap-2 rounded-2xl border border-white/80 bg-white/90 px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-white"
                            >
                              <PlusIcon className="h-4 w-4" />
                              Create structured meal
                            </button>
                          </div>
                        ) : null}

                        {/* Search results */}
                        {searchResults.length > 0 && (
                          <div className="max-h-64 overflow-y-auto rounded-2xl border border-white/70 bg-white/80 backdrop-blur divide-y divide-white/70">
                            {searchResults.map((item, idx) => {
                              const isRecipeItem = detectIsRecipe(item)
                              const servingOptions =
                                buildServingOptionsForMenuItem(
                                  item,
                                  includeImperialServingOptions
                                )
                              const selectedServing =
                                findDefaultServing(servingOptions)
                              const servingAmount =
                                getServingAmount(selectedServing) || 100
                              const servingUnit =
                                selectedServing?.unitName ||
                                selectedServing?.unit ||
                                (item?.isLiquid ? 'ml' : 'g')
                              const numberOfRecipeServings = isRecipeItem
                                ? item?.numberOfRecipeServings ||
                                  item?.originalServings ||
                                  1
                                : 1
                              const newAmount = isRecipeItem
                                ? servingAmount * numberOfRecipeServings
                                : servingAmount
                              const roundedAmount =
                                roundServingAmountByUnitSystem(newAmount)

                              return (
                                <div
                                  key={idx}
                                  onClick={() => setViewingItem(item)}
                                  className="flex cursor-pointer items-center justify-between px-4 py-3 transition hover:bg-white"
                                >
                                  <div className="min-w-0">
                                    <div className="text-sm font-semibold text-gray-900 truncate">
                                      {item?.name || item?.title || 'Unnamed'}
                                    </div>
                                    <div className="text-xs text-gray-600">
                                      {detectIsRecipe(item) ? 'Recipe' : 'Food'}
                                      {typeof item?.caloriesPer100 === 'number'
                                        ? ` • ${item.caloriesPer100} cal/${roundedAmount}${servingUnit}`
                                        : ''}
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={event => {
                                      event.stopPropagation()
                                      addItemToPlan(item)
                                    }}
                                    className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-500 to-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-md transition hover:shadow-lg"
                                  >
                                    <PlusIcon className="h-4 w-4" />{' '}
                                    {t('pages.myMenus.addItem')}
                                  </button>
                                </div>
                              )
                            })}
                          </div>
                        )}

                        {/* Current meal items */}
                        {plans[activeMealType]?.length > 0 && (
                          <div className="space-y-3 rounded-2xl border border-white/70 bg-white/80 p-4 backdrop-blur">
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-semibold text-gray-800">
                                {t('pages.myMenus.itemsIn', {
                                  mealType: mealTypeOptions.find(
                                    m => m.id === activeMealType
                                  )?.label
                                })}
                              </p>
                              <span className={softBadgeClass}>
                                {plans[activeMealType].length}{' '}
                                {t('pages.myMenus.items')}
                              </span>
                            </div>
                            {plans[activeMealType].map((item, idx) => {
                              const isRecipeItem = detectIsRecipe(item)
                              const itemKey = `${activeMealType}-${idx}`
                              const displayValue = displayValues[itemKey]

                              const servingOptions =
                                buildServingOptionsForMenuItem(
                                  item,
                                  includeImperialServingOptions
                                )
                              const hasServings = servingOptions.length > 0

                              const defaultServingIdentifier =
                                getServingIdentifier(servingOptions[0]) || null
                              const currentServingId =
                                displayValue?.selectedServingId ||
                                item?.originalServingId ||
                                defaultServingIdentifier
                              const selectedServingForCurrent =
                                findServingByIdentifier(
                                  servingOptions,
                                  currentServingId
                                ) ||
                                servingOptions[0] ||
                                null
                              const fallbackServingAmount =
                                getPreferredStructuredMealAmount(
                                  item,
                                  selectedServingForCurrent
                                )
                              const currentServingAmount =
                                displayValue?.servingAmount !== undefined
                                  ? displayValue.servingAmount
                                  : fallbackServingAmount

                              let originalServingAmount =
                                item?.originalServingAmount
                              if (
                                !originalServingAmount &&
                                servingOptions.length > 0
                              ) {
                                if (isRecipeItem) {
                                  const portionServing =
                                    findPortionServing(servingOptions)
                                  if (portionServing) {
                                    const numberOfRecipeServings =
                                      item?.numberOfRecipeServings ||
                                      item?.originalServings ||
                                      1
                                    originalServingAmount =
                                      getServingAmount(portionServing) *
                                      numberOfRecipeServings
                                  } else {
                                    const totalWeight =
                                      item?.nutrientsPer100?.totalQuantity ||
                                      item?.nutrientsPer100
                                        ?.weightAfterCooking ||
                                      null
                                    if (totalWeight) {
                                      originalServingAmount = totalWeight
                                    } else {
                                      const defaultServing =
                                        findDefaultServing(servingOptions)
                                      const numberOfRecipeServings =
                                        item?.numberOfRecipeServings ||
                                        item?.originalServings ||
                                        1
                                      originalServingAmount =
                                        (getServingAmount(defaultServing) ||
                                          100) * numberOfRecipeServings
                                    }
                                  }
                                } else {
                                  const defaultServing =
                                    findDefaultServing(servingOptions)
                                  originalServingAmount =
                                    getServingAmount(defaultServing) || 100
                                }
                              }
                              originalServingAmount =
                                originalServingAmount || 100

                              const servingAmountForCalc =
                                currentServingAmount === '' ||
                                currentServingAmount === undefined
                                  ? originalServingAmount
                                  : currentServingAmount
                              const structuredMealSummary =
                                isStructuredMealRecipeItem(item)
                                  ? calculateStructuredMealItemSummary(item)
                                  : null
                              const calculated = structuredMealSummary
                                ? {
                                    calories: structuredMealSummary.calories,
                                    nutrients: structuredMealSummary
                                  }
                                : calculateDisplayValues(
                                    item,
                                    servingAmountForCalc,
                                    originalServingAmount,
                                    findServingByIdentifier(
                                      servingOptions,
                                      currentServingId
                                    )?.unitName ||
                                      findServingByIdentifier(
                                        servingOptions,
                                        currentServingId
                                      )?.unit ||
                                      (item?.isLiquid ? 'ml' : 'g')
                                  )
                              const adjustedCalories = calculated.calories
                              const adjustedNutrients = calculated.nutrients

                              return (
                                <div
                                  key={idx}
                                  className="relative rounded-2xl border border-white/60 bg-white/90 p-4 shadow-sm"
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <div className="text-sm font-semibold text-gray-900 truncate">
                                        {item?.name || item?.title || 'Unnamed'}
                                      </div>
                                      <div className="text-xs text-gray-600 truncate">
                                        {isRecipeItem ? 'Recipe' : 'Food'}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      {isRecipeItem ? (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            openStructuredMealEditor({
                                              mode: 'builder',
                                              mealKey: activeMealType,
                                              item,
                                              itemIndex: idx
                                            })
                                          }
                                          className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-blue-700 transition hover:bg-blue-100"
                                        >
                                          <PencilIcon className="h-4 w-4" />
                                        </button>
                                      ) : null}
                                      <button
                                        onClick={() =>
                                          removeItemFromPlan(
                                            activeMealType,
                                            idx
                                          )
                                        }
                                        className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-red-50 text-red-600 transition hover:bg-red-100"
                                      >
                                        <TrashIcon className="h-4 w-4" />
                                      </button>
                                    </div>
                                  </div>

                                  {hasServings && (
                                    <div className="mt-3 flex flex-col gap-2 md:flex-row md:items-center">
                                      <label className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                                        {t('pages.myMenus.servingOptions')}
                                      </label>
                                      <div className="flex flex-1 flex-col gap-2 md:flex-row md:items-center">
                                        <select
                                          value={currentServingId || ''}
                                          onChange={e => {
                                            const selectedIdentifier =
                                              e.target.value || null
                                            const selectedServing =
                                              findServingByIdentifier(
                                                servingOptions,
                                                selectedIdentifier
                                              )
                                            const servingAmount =
                                              getDefaultAmountForSelectedServing(
                                                selectedServing
                                              )

                                            setDisplayValues(prev => ({
                                              ...prev,
                                              [itemKey]: {
                                                selectedServingId:
                                                  selectedIdentifier,
                                                servingAmount:
                                                  roundServingAmountByUnitSystem(
                                                    servingAmount
                                                  ) || currentServingAmount
                                              }
                                            }))
                                          }}
                                          className="w-full rounded-xl border border-white/80 bg-white/90 px-3 py-2 text-xs font-medium text-gray-800 shadow-inner focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200 md:w-48"
                                        >
                                          {servingOptions.map(
                                            (serving, sIdx) => {
                                              const servingId =
                                                getServingIdentifier(serving)
                                              return (
                                                <option
                                                  key={servingId || sIdx}
                                                  value={servingId}
                                                >
                                                  {serving.name ||
                                                    serving.innerName ||
                                                    serving.unitName ||
                                                    serving.unit}
                                                </option>
                                              )
                                            }
                                          )}
                                        </select>
                                        <div className="flex items-center gap-2">
                                          <input
                                            type="text"
                                            value={currentServingAmount}
                                            onChange={e => {
                                              const inputValue = e.target.value
                                              const newAmount =
                                                inputValue === ''
                                                  ? ''
                                                  : inputValue || 0

                                              setDisplayValues(prev => ({
                                                ...prev,
                                                [itemKey]: {
                                                  selectedServingId:
                                                    currentServingId,
                                                  servingAmount:
                                                    newAmount === ''
                                                      ? ''
                                                      : newAmount
                                                }
                                              }))
                                            }}
                                            onBlur={e => {
                                              const inputValue = e.target.value
                                              if (inputValue === '') {
                                                const selectedServingOnBlur =
                                                  findServingByIdentifier(
                                                    servingOptions,
                                                    currentServingId
                                                  )
                                                const fallbackAmount =
                                                  getDefaultAmountForSelectedServing(
                                                    selectedServingOnBlur
                                                  )
                                                setDisplayValues(prev => ({
                                                  ...prev,
                                                  [itemKey]: {
                                                    selectedServingId:
                                                      currentServingId,
                                                    servingAmount:
                                                      fallbackAmount
                                                  }
                                                }))
                                              }
                                            }}
                                            className="w-24 rounded-xl border border-white/80 bg-white/90 px-3 py-2 text-xs font-semibold text-gray-900 shadow-inner focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
                                            placeholder={t(
                                              'pages.myMenus.amount'
                                            )}
                                          />
                                          <span className="text-xs font-medium text-gray-600">
                                            {findServingByIdentifier(
                                              servingOptions,
                                              currentServingId
                                            )?.unitName ||
                                              findServingByIdentifier(
                                                servingOptions,
                                                currentServingId
                                              )?.unit ||
                                              (item?.isLiquid ? 'ml' : 'g')}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  )}

                                  {isRecipeItem && (
                                    <div className="mt-2 text-xs text-gray-600">
                                      <span className="font-semibold">
                                        {t('pages.myMenus.originalServing')}:
                                      </span>{' '}
                                      {item?.numberOfRecipeServings ||
                                        item?.originalServings ||
                                        1}
                                    </div>
                                  )}

                                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-700 sm:grid-cols-4">
                                    <div
                                      className={`${glassSurfaceClass} px-3 py-2 text-center font-semibold text-gray-900`}
                                    >
                                      {t('pages.myMenus.calories')}:{' '}
                                      {adjustedCalories}
                                    </div>
                                    <div
                                      className={`${glassSurfaceClass} px-3 py-2 text-center font-semibold text-gray-900`}
                                    >
                                      {t('pages.myMenus.proteins')}:{' '}
                                      {roundMacro(
                                        Number(
                                          adjustedNutrients?.proteinsInGrams
                                        ) || 0
                                      )}{' '}
                                      g
                                    </div>
                                    <div
                                      className={`${glassSurfaceClass} px-3 py-2 text-center font-semibold text-gray-900`}
                                    >
                                      {t('pages.myMenus.carbs')}:{' '}
                                      {roundMacro(
                                        Number(
                                          adjustedNutrients?.carbohydratesInGrams
                                        ) || 0
                                      )}{' '}
                                      g
                                    </div>
                                    <div
                                      className={`${glassSurfaceClass} px-3 py-2 text-center font-semibold text-gray-900`}
                                    >
                                      {t('pages.myMenus.fat')}:{' '}
                                      {roundMacro(
                                        Number(adjustedNutrients?.fatInGrams) ||
                                          0
                                      )}{' '}
                                      g
                                    </div>
                                  </div>

                                  {isRecipeItem ? (
                                    <label className="mt-3 inline-flex items-center gap-2 text-xs font-medium text-gray-700">
                                      <input
                                        type="checkbox"
                                        checked={shouldShowRecipeDetailsInPdf(
                                          item
                                        )}
                                        onChange={event => {
                                          setPlans(prev => ({
                                            ...prev,
                                            [activeMealType]: prev[
                                              activeMealType
                                            ].map((planItem, planIndex) =>
                                              planIndex === idx
                                                ? {
                                                    ...planItem,
                                                    showRecipeDetailsInPdf:
                                                      event.target.checked
                                                  }
                                                : planItem
                                            )
                                          }))
                                        }}
                                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-400"
                                      />
                                      {t(
                                        'pages.myMenus.showRecipeDetailsInPdf'
                                      )}
                                    </label>
                                  ) : null}
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </>
                    ) : null}

                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                      <button
                        onClick={handleSaveTemplate}
                        disabled={
                          submitting ||
                          (!isContainerScopedBuilder &&
                            !menuContainerName.trim()) ||
                          (isContainerScopedBuilder && !menuName.trim())
                        }
                        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-3 text-sm font-semibold text-white shadow-xl transition hover:-translate-y-0.5 hover:shadow-2xl disabled:opacity-60 sm:w-auto"
                      >
                        {submitting
                          ? t('pages.myMenus.saving')
                          : editingTemplateId
                            ? t('pages.myMenus.updateMenu')
                            : t('common.create')}
                      </button>
                      <button
                        onClick={() => {
                          resetBuilder()
                          setShowBuilderModal(false)
                        }}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/60 bg-white/80 px-6 py-3 text-sm font-semibold text-gray-800 shadow-sm transition hover:-translate-y-0.5 hover:shadow sm:w-auto"
                      >
                        {t('pages.myMenus.cancel')}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {renderItemPreviewModal()}
        {renderStructuredMealEditorModal()}

        {/* Text-to-Menu Modal */}
        {isTextToMenuOpen && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <SparklesIcon className="w-5 h-5 text-violet-500" />
                  <h3 className="text-xl font-bold text-gray-900">
                    {t('pages.menus.textToMenu.title') ||
                      'Generate Menu from Text'}
                  </h3>
                </div>
                <button
                  onClick={() => {
                    setIsTextToMenuOpen(false)
                    setTextToMenuInput('')
                    setTextToMenuName('')
                    setTextToMenuCountry('RO')
                    setTextToMenuContainerContext(null)
                  }}
                  className="text-gray-400 hover:text-gray-700"
                >
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    {t('pages.menus.textToMenu.describe') ||
                      'Describe the menu'}
                  </label>
                  <textarea
                    value={textToMenuInput}
                    onChange={e => setTextToMenuInput(e.target.value)}
                    rows={5}
                    placeholder={
                      t('pages.menus.textToMenu.placeholder') ||
                      'e.g. A 1800 calorie Mediterranean day: oatmeal and banana for breakfast, grilled chicken with salad for lunch, salmon with vegetables for dinner, Greek yogurt as snack.'
                    }
                    className="w-full border border-gray-300 bg-white rounded-lg px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 resize-none text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    {t('pages.menus.textToMenu.menuName') ||
                      'Menu name (optional)'}
                  </label>
                  <input
                    type="text"
                    value={textToMenuName}
                    onChange={e => setTextToMenuName(e.target.value)}
                    placeholder={
                      t('pages.menus.textToMenu.menuNamePlaceholder') ||
                      'Leave blank to auto-generate'
                    }
                    className="w-full border border-gray-300 bg-white rounded-lg px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    {t('pages.menus.textToMenu.country') || 'Country'}
                  </label>
                  <select
                    value={textToMenuCountry}
                    onChange={e => setTextToMenuCountry(e.target.value)}
                    className="w-full border border-gray-300 bg-white rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 text-sm"
                  >
                    <option value="RO">Romania (RO)</option>
                    <option value="US">United States (US)</option>
                    <option value="IT">Italy (IT)</option>
                    <option value="ES">Spain (ES)</option>
                    <option value="UK">United Kingdom (UK)</option>
                    <option value="DE">Germany (DE)</option>
                    <option value="FR">France (FR)</option>
                    <option value="HU">Hungary (HU)</option>
                  </select>
                </div>

                <div className="p-3 bg-violet-50 border border-violet-200 rounded-lg text-sm text-violet-800">
                  {t('pages.menus.textToMenu.hint') ||
                    'The AI will generate a menu from your description and match items against the existing food database. Items not found in the database will be skipped.'}
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setIsTextToMenuOpen(false)
                    setTextToMenuInput('')
                    setTextToMenuName('')
                    setTextToMenuCountry('RO')
                    setTextToMenuContainerContext(null)
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 bg-white rounded-lg text-gray-700 text-sm font-medium hover:bg-gray-50"
                  disabled={generatingMenu}
                >
                  {t('common.cancel') || 'Cancel'}
                </button>
                <button
                  onClick={handleGenerateFromText}
                  disabled={generatingMenu || !textToMenuInput.trim()}
                  className="flex-1 px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  {generatingMenu
                    ? t('pages.menus.textToMenu.generating') || 'Generating...'
                    : t('pages.menus.textToMenu.generate') || 'Generate Menu'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Copy Template Modal */}
        {isCopyModalOpen && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className={`${glassCardClass} max-w-md w-full p-6`}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-900">
                  {t('pages.menus.copyTemplate.title') || 'Copy Menu'}
                </h3>
                <button
                  onClick={() => {
                    setIsCopyModalOpen(false)
                    setSelectedTemplateForCopy(null)
                    setCopyCountryCode('RO')
                    setCopyMenuName('')
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('pages.myMenus.sourceMenu')}
                  </label>
                  <div className="p-3 bg-white/40 border border-white/30 rounded-md text-gray-900">
                    {splitMenuName(selectedTemplateForCopy?.name || '')
                      .menuName || 'Untitled'}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('pages.myMenus.newMenuName')}
                  </label>
                  <input
                    type="text"
                    value={copyMenuName}
                    onChange={event => setCopyMenuName(event.target.value)}
                    className="w-full rounded-xl border border-white/30 bg-white/70 px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder={
                      splitMenuName(selectedTemplateForCopy?.name || '')
                        .menuName || 'Untitled'
                    }
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('pages.menus.copyTemplate.selectCountry') ||
                      'Select Country'}
                  </label>
                  <select
                    value={copyCountryCode}
                    onChange={e => setCopyCountryCode(e.target.value)}
                    className="w-full border border-white/30 bg-white/40 backdrop-blur-sm rounded-md px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="RO">Romania (RO)</option>
                    <option value="US">United States (US)</option>
                    <option value="IT">Italy (IT)</option>
                    <option value="ES">Spain (ES)</option>
                    <option value="UK">United Kingdom (UK)</option>
                    <option value="DE">Germany (DE)</option>
                    <option value="FR">France (FR)</option>
                    <option value="HU">Hungary (HU)</option>
                  </select>
                </div>

                <div className="p-3 bg-blue-50/50 border border-blue-200/30 rounded-md text-sm text-blue-900">
                  {t('pages.menus.copyTemplate.description') ||
                    'This will create a new menu translated and adapted for the selected country.'}
                </div>
              </div>

              {copyingTemplate ? (
                <div className="mt-6 rounded-2xl border border-emerald-100 bg-emerald-50/80 px-4 py-5 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm">
                    <ArrowPathIcon className="h-6 w-6 animate-spin text-emerald-600" />
                  </div>
                  <p className="mt-3 text-sm font-semibold text-slate-900">
                    {t('pages.myMenus.copyingMenu')}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {t('pages.myMenus.copyingMenuHint')}
                  </p>
                </div>
              ) : null}

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setIsCopyModalOpen(false)
                    setSelectedTemplateForCopy(null)
                    setCopyCountryCode('RO')
                    setCopyMenuName('')
                  }}
                  className="flex-1 px-4 py-2 border border-white/30 bg-white/40 backdrop-blur-sm rounded-md text-gray-800 hover:bg-white/60"
                  disabled={copyingTemplate}
                >
                  {t('common.cancel') || 'Cancel'}
                </button>
                <button
                  onClick={handleCopyTemplate}
                  disabled={
                    copyingTemplate || !copyCountryCode || !copyMenuName.trim()
                  }
                  className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {copyingTemplate
                    ? t('pages.menus.copyTemplate.copying') || 'Copying...'
                    : t('pages.menus.copyTemplate.copy') || 'Copy Menu'}
                </button>
              </div>
            </div>
          </div>
        )}

        {isDuplicateModalOpen && selectedTemplateForDuplicate ? (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className={`${glassCardClass} max-w-md w-full p-6`}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-900">
                  {t('pages.menus.duplicate') || 'Duplicate Menu'}
                </h3>
                <button
                  onClick={() => {
                    setIsDuplicateModalOpen(false)
                    setSelectedTemplateForDuplicate(null)
                    setDuplicateMenuName('')
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('pages.myMenus.sourceMenu')}
                  </label>
                  <div className="p-3 bg-white/40 border border-white/30 rounded-md text-gray-900">
                    {splitMenuName(selectedTemplateForDuplicate?.name || '')
                      .menuName || 'Untitled'}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('pages.myMenus.newMenuName')}
                  </label>
                  <input
                    type="text"
                    value={duplicateMenuName}
                    onChange={event => setDuplicateMenuName(event.target.value)}
                    className="w-full rounded-xl border border-white/30 bg-white/70 px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder={
                      splitMenuName(selectedTemplateForDuplicate?.name || '')
                        .menuName || 'Untitled'
                    }
                  />
                </div>
              </div>

              {duplicatingTemplate ? (
                <div className="mt-6 rounded-2xl border border-violet-100 bg-violet-50/80 px-4 py-5 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm">
                    <ArrowPathIcon className="h-6 w-6 animate-spin text-violet-600" />
                  </div>
                  <p className="mt-3 text-sm font-semibold text-slate-900">
                    {t('pages.menus.copyTemplate.copying') || 'Copying...'}
                  </p>
                </div>
              ) : null}

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setIsDuplicateModalOpen(false)
                    setSelectedTemplateForDuplicate(null)
                    setDuplicateMenuName('')
                  }}
                  className="flex-1 px-4 py-2 border border-white/30 bg-white/40 backdrop-blur-sm rounded-md text-gray-800 hover:bg-white/60"
                  disabled={duplicatingTemplate}
                >
                  {t('common.cancel') || 'Cancel'}
                </button>
                <button
                  onClick={handleDuplicateTemplateConfirm}
                  disabled={duplicatingTemplate || !duplicateMenuName.trim()}
                  className="flex-1 px-4 py-2 bg-violet-600 text-white rounded-md hover:bg-violet-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {duplicatingTemplate
                    ? t('pages.menus.copyTemplate.copying') || 'Copying...'
                    : t('pages.menus.duplicate') || 'Duplicate'}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {isRenameContainerModalOpen && selectedContainerForRename ? (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className={`${glassCardClass} max-w-md w-full p-6`}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-900">
                  {t('pages.myMenus.editContainer') || 'Edit Container'}
                </h3>
                <button
                  onClick={() => {
                    setIsRenameContainerModalOpen(false)
                    setSelectedContainerForRename(null)
                    setRenameContainerName('')
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('pages.myMenus.sourceContainer') || 'Source Container'}
                  </label>
                  <div className="p-3 bg-white/40 border border-white/30 rounded-md text-gray-900">
                    {selectedContainerForRename.containerName}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('pages.myMenus.newContainerName') ||
                      'New Container Name'}
                  </label>
                  <input
                    type="text"
                    value={renameContainerName}
                    onChange={event =>
                      setRenameContainerName(event.target.value)
                    }
                    className="w-full rounded-xl border border-white/30 bg-white/70 px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setIsRenameContainerModalOpen(false)
                    setSelectedContainerForRename(null)
                    setRenameContainerName('')
                  }}
                  className="flex-1 px-4 py-2 border border-white/30 bg-white/40 backdrop-blur-sm rounded-md text-gray-800 hover:bg-white/60"
                  disabled={renamingContainer}
                >
                  {t('common.cancel') || 'Cancel'}
                </button>
                <button
                  onClick={handleRenameContainerConfirm}
                  disabled={renamingContainer || !renameContainerName.trim()}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {renamingContainer
                    ? t('pages.myMenus.saving')
                    : t('pages.myMenus.editContainer') || 'Save'}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {isCopyContainerModalOpen && selectedContainerForCopy ? (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className={`${glassCardClass} max-w-md w-full p-6`}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-900">
                  {t('pages.myMenus.copyContainer') || 'Copy Container'}
                </h3>
                <button
                  onClick={() => {
                    setIsCopyContainerModalOpen(false)
                    setSelectedContainerForCopy(null)
                    setCopyContainerName('')
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('pages.myMenus.sourceContainer') || 'Source Container'}
                  </label>
                  <div className="p-3 bg-white/40 border border-white/30 rounded-md text-gray-900">
                    {selectedContainerForCopy.containerName}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('pages.myMenus.newContainerName') ||
                      'New Container Name'}
                  </label>
                  <input
                    type="text"
                    value={copyContainerName}
                    onChange={event => setCopyContainerName(event.target.value)}
                    className="w-full rounded-xl border border-white/30 bg-white/70 px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setIsCopyContainerModalOpen(false)
                    setSelectedContainerForCopy(null)
                    setCopyContainerName('')
                  }}
                  className="flex-1 px-4 py-2 border border-white/30 bg-white/40 backdrop-blur-sm rounded-md text-gray-800 hover:bg-white/60"
                  disabled={copyingContainer}
                >
                  {t('common.cancel') || 'Cancel'}
                </button>
                <button
                  onClick={handleCopyContainerConfirm}
                  disabled={copyingContainer || !copyContainerName.trim()}
                  className="flex-1 px-4 py-2 bg-violet-600 text-white rounded-md hover:bg-violet-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {copyingContainer
                    ? t('pages.menus.copyTemplate.copying') || 'Copying...'
                    : t('pages.myMenus.copyContainer') || 'Copy Container'}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {isCopyContainerToCountryModalOpen &&
        selectedContainerForCountryCopy ? (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className={`${glassCardClass} max-w-md w-full p-6`}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-900">
                  {t('pages.myMenus.copyContainerToCountry') ||
                    'Copy Container to Country'}
                </h3>
                <button
                  onClick={() => {
                    setIsCopyContainerToCountryModalOpen(false)
                    setSelectedContainerForCountryCopy(null)
                    setCopyContainerToCountryName('')
                    setCopyContainerToCountryCode('RO')
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('pages.myMenus.sourceContainer') || 'Source Container'}
                  </label>
                  <div className="p-3 bg-white/40 border border-white/30 rounded-md text-gray-900">
                    {selectedContainerForCountryCopy.containerName}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('pages.myMenus.newContainerName') ||
                      'New Container Name'}
                  </label>
                  <input
                    type="text"
                    value={copyContainerToCountryName}
                    onChange={event =>
                      setCopyContainerToCountryName(event.target.value)
                    }
                    className="w-full rounded-xl border border-white/30 bg-white/70 px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('pages.menus.copyTemplate.selectCountry') ||
                      'Select Country'}
                  </label>
                  <select
                    value={copyContainerToCountryCode}
                    onChange={event =>
                      setCopyContainerToCountryCode(event.target.value)
                    }
                    className="w-full border border-white/30 bg-white/40 backdrop-blur-sm rounded-md px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="RO">Romania (RO)</option>
                    <option value="US">United States (US)</option>
                    <option value="IT">Italy (IT)</option>
                    <option value="ES">Spain (ES)</option>
                    <option value="UK">United Kingdom (UK)</option>
                    <option value="DE">Germany (DE)</option>
                    <option value="FR">France (FR)</option>
                    <option value="HU">Hungary (HU)</option>
                  </select>
                </div>

                <div className="p-3 bg-blue-50/50 border border-blue-200/30 rounded-md text-sm text-blue-900">
                  {t('pages.myMenus.copyingMenuHint')}
                </div>
              </div>

              {copyingContainerToCountry ? (
                <div className="mt-6 rounded-2xl border border-emerald-100 bg-emerald-50/80 px-4 py-5 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm">
                    <ArrowPathIcon className="h-6 w-6 animate-spin text-emerald-600" />
                  </div>
                  <p className="mt-3 text-sm font-semibold text-slate-900">
                    {t('pages.myMenus.copyingMenu')}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {t('pages.myMenus.copyingMenuHint')}
                  </p>
                </div>
              ) : null}

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setIsCopyContainerToCountryModalOpen(false)
                    setSelectedContainerForCountryCopy(null)
                    setCopyContainerToCountryName('')
                    setCopyContainerToCountryCode('RO')
                  }}
                  className="flex-1 px-4 py-2 border border-white/30 bg-white/40 backdrop-blur-sm rounded-md text-gray-800 hover:bg-white/60"
                  disabled={copyingContainerToCountry}
                >
                  {t('common.cancel') || 'Cancel'}
                </button>
                <button
                  onClick={handleCopyContainerToCountryConfirm}
                  disabled={
                    copyingContainerToCountry ||
                    !copyContainerToCountryName.trim() ||
                    !copyContainerToCountryCode
                  }
                  className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {copyingContainerToCountry
                    ? t('pages.menus.copyTemplate.copying') || 'Copying...'
                    : t('pages.myMenus.copyContainerToCountry') ||
                      'Copy Container to Country'}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {isAssignContainerPreviewOpen && selectedContainer ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <div
              className={`${glassCardClass} max-h-[90vh] w-full max-w-2xl overflow-hidden p-6`}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">
                    Assign Container
                  </h3>
                  <p className="mt-1 text-sm text-gray-600">
                    Review the proposed assignment dates before confirming.
                  </p>
                </div>
                <button
                  onClick={() => setIsAssignContainerPreviewOpen(false)}
                  className="text-gray-500 transition hover:text-gray-700"
                  disabled={assigningContainer}
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-white/70 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Container
                  </p>
                  <p className="mt-2 text-lg font-semibold text-slate-900">
                    {selectedContainer.containerName}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white/70 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Client
                  </p>
                  <p className="mt-2 text-lg font-semibold text-slate-900">
                    {selectedClientName || 'Selected client'}
                  </p>
                </div>
              </div>

              <div className="mt-5 rounded-2xl border border-slate-200 bg-white/70 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-900">
                    Proposed schedule
                  </p>
                  <p className="text-xs text-slate-500">
                    Start date:{' '}
                    {formatAssignmentDate(assignmentDate, i18n.language)}
                  </p>
                </div>
                <div className="mt-4 max-h-[320px] space-y-3 overflow-y-auto pr-1">
                  {selectedContainerAssignmentPreview.map((menu, index) => (
                    <div
                      key={menu.id}
                      className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900">
                          {menu.menuName}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Day {index + 1}
                        </p>
                      </div>
                      <div className="shrink-0 rounded-full bg-white px-3 py-1 text-sm font-semibold text-slate-700 shadow-sm">
                        {formatAssignmentDate(menu.dateApplied, i18n.language)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => setIsAssignContainerPreviewOpen(false)}
                  className="flex-1 rounded-2xl border border-white/30 bg-white/50 px-4 py-3 text-sm font-semibold text-gray-800 transition hover:bg-white/70"
                  disabled={assigningContainer}
                >
                  {t('common.cancel') || 'Cancel'}
                </button>
                <button
                  onClick={async () => {
                    await handleAssignContainer(selectedContainer)
                    setIsAssignContainerPreviewOpen(false)
                  }}
                  disabled={assigningContainer}
                  className="flex-1 rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 px-4 py-3 text-sm font-semibold text-white shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl disabled:opacity-60"
                >
                  {assigningContainer
                    ? t('pages.myMenus.assigning')
                    : 'Confirm Assignment'}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {selectedContainerModalOpen && selectedContainer ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            {(() => {
              const isSelectedContainerDeleting =
                deletingContainerKey === selectedContainer.key
              const isSelectedContainerActionBusy =
                isSelectedContainerDeleting ||
                renamingContainer ||
                copyingContainer ||
                exportingContainerPdf

              return (
                <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 md:flex-row md:items-start md:justify-between">
                  <div className="flex items-start gap-4">
                    <button
                      type="button"
                      onClick={() => setSelectedContainerModalOpen(false)}
                      className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-50"
                    >
                      <ArrowLeftIcon className="h-5 w-5" />
                    </button>
                    <div>
                      <h3 className="mt-2 text-2xl font-semibold text-slate-900">
                        {selectedContainer?.containerName}
                      </h3>
                      <p className="mt-1 text-sm text-slate-500">
                        {selectedContainer?.menus?.length || 0}{' '}
                        {t('pages.myMenus.menus')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openTextToMenu(selectedContainer)}
                      disabled={isSelectedContainerActionBusy}
                      className="inline-flex h-11 items-center justify-center gap-1.5 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 text-sm font-semibold text-white shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl"
                      title={
                        t('pages.menus.generateFromText') ||
                        'Generate from Text'
                      }
                    >
                      <SparklesIcon className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => openBuilderForContainer(selectedContainer)}
                      disabled={isSelectedContainerActionBusy}
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 px-5 text-sm font-semibold text-white shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl"
                    >
                      <PlusIcon className="h-4 w-4" />
                      {t('pages.myMenus.addDay')}
                    </button>
                    <ControlsDropdown
                      actions={[
                        {
                          icon: DocumentTextIcon,
                          labelKey: 'pages.myMenus.exportPdf',
                          disabled: isSelectedContainerActionBusy,
                          loading: exportingContainerPdf,
                          onClick: () =>
                            handleExportContainerPdf(selectedContainer)
                        },
                        {
                          icon: PencilIcon,
                          labelKey: 'common.controls.rename',
                          colorClass: 'text-blue-700',
                          disabled: isSelectedContainerActionBusy,
                          onClick: () =>
                            handleOpenRenameContainerModal(selectedContainer)
                        },
                        {
                          icon: DocumentDuplicateIcon,
                          labelKey: 'common.controls.copyContainer',
                          colorClass: 'text-violet-700',
                          disabled: isSelectedContainerActionBusy,
                          onClick: () =>
                            handleOpenCopyContainerModal(selectedContainer)
                        },
                        ...(isAdmin
                          ? [
                              {
                                icon: GlobeAltIcon,
                                labelKey: 'common.controls.copyToCountry',
                                colorClass: 'text-emerald-700',
                                disabled: isSelectedContainerActionBusy,
                                onClick: () =>
                                  handleOpenCopyContainerToCountryModal(
                                    selectedContainer
                                  )
                              }
                            ]
                          : []),
                        {
                          icon: TrashIcon,
                          labelKey: 'pages.myMenus.deleteContainer',
                          colorClass: 'text-red-600',
                          disabled: isSelectedContainerActionBusy,
                          loading: isSelectedContainerDeleting,
                          onClick: () =>
                            handleDeleteContainer(selectedContainer)
                        }
                      ]}
                    />
                  </div>
                </div>
              )
            })()}

            <div className="mt-5 flex flex-wrap gap-2 rounded-3xl border border-slate-200 bg-slate-50 p-2">
              {selectedContainer.menus.map(menu => (
                <div key={menu.id} className="relative">
                  <button
                    type="button"
                    draggable
                    onClick={() => setSelectedContainerMenuId(menu.id)}
                    onDragStart={() => setDraggedContainerMenuId(menu.id)}
                    onDragOver={event => event.preventDefault()}
                    onDrop={async event => {
                      event.preventDefault()
                      await handleReorderContainerMenus(
                        selectedContainer,
                        draggedContainerMenuId,
                        menu.id
                      )
                    }}
                    className={`rounded-2xl border px-4 py-2 text-sm font-medium transition ${
                      selectedMenuInContainer?.id === menu.id
                        ? 'border-blue-200 bg-white text-blue-700 shadow-sm'
                        : 'border-transparent bg-transparent text-slate-600 hover:border-slate-200 hover:bg-white'
                    } ${reorderingContainer ? 'opacity-60' : ''}`}
                    disabled={reorderingContainer}
                  >
                    {menu.parsedMenuName}
                  </button>
                  {menuStudioDrafts[menu.id] ? (
                    <span className="pointer-events-none absolute right-2 top-2 inline-flex h-2.5 w-2.5 rounded-full bg-amber-500 shadow-[0_0_0_4px_rgba(251,191,36,0.18)]" />
                  ) : null}
                </div>
              ))}
            </div>

            <div className="mt-8 overflow-x-auto pb-2">
              <div className="flex min-w-max gap-3 text-xs">
                <div className="w-[220px] shrink-0 rounded-3xl border border-slate-200 bg-slate-50 px-3 py-3 text-center shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    {t('pages.myMenus.totalMenu')}
                  </p>
                  <p className="mt-3 text-[1.75rem] font-black tracking-tight text-slate-950">
                    {Math.round(selectedMenuSummary.total.calories)}{' '}
                    <span className="text-sm font-bold">kcal</span>
                  </p>
                  <p className="mt-3 text-xs text-slate-500">
                    P {roundMacro(selectedMenuSummary.total.proteinsInGrams)}g
                    {' · '}C{' '}
                    {roundMacro(selectedMenuSummary.total.carbohydratesInGrams)}
                    g{' · '}F {roundMacro(selectedMenuSummary.total.fatInGrams)}
                    g
                  </p>
                </div>
                {MENU_MEAL_SECTIONS.map(meal => {
                  const mealTotals = selectedMenuSummary.perMeal[meal.id]

                  return (
                    <div
                      key={meal.id}
                      className="w-[220px] shrink-0 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-center font-semibold text-slate-800"
                    >
                      <p className="text-[11px] uppercase tracking-wide text-slate-500">
                        {t(meal.labelKey)}
                      </p>
                      <p className="mt-3 text-[1.75rem] font-black tracking-tight text-slate-950">
                        {Math.round(mealTotals.calories)} kcal
                      </p>
                      <p className="mt-3 text-xs font-medium text-slate-500">
                        P {roundMacro(mealTotals.proteinsInGrams)}g · C{' '}
                        {roundMacro(mealTotals.carbohydratesInGrams)}g · F{' '}
                        {roundMacro(mealTotals.fatInGrams)}g
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>
            <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
              <div className="space-y-5">
                {selectedMenuInContainer ? (
                  <>
                    {(() => {
                      const isSelectedMenuDeleting =
                        deletingTemplateId === selectedMenuInContainer.id
                      const isSelectedMenuActionBusy =
                        isSelectedMenuDeleting || savingStudioMenu

                      return (
<<<<<<< Updated upstream
                    <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-5 shadow-sm">
                      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                            {t('pages.myMenus.menuName')}
                          </p>
                          <p className="mt-2 text-2xl font-semibold text-slate-900">
                            {selectedMenuInContainer.parsedMenuName}
                          </p>
=======
                        <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-5 shadow-sm">
                          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                                {t('pages.myMenus.menuName')}
                              </p>
                              <p className="mt-2 text-2xl font-semibold text-slate-900">
                                {selectedMenuInContainer.parsedMenuName}
                              </p>
                              <p className="mt-1 text-sm text-slate-500">
                                {t('pages.myMenus.id')}:{' '}
                                {selectedMenuInContainer.id}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={handleSaveSelectedMenuDraft}
                                disabled={
                                  !selectedMenuHasDraft || savingStudioMenu
                                }
                                className={`inline-flex h-11 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-semibold text-white shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 disabled:shadow-none ${
                                  selectedMenuHasDraft
                                    ? 'animate-pulse bg-gradient-to-r from-amber-500 to-orange-500'
                                    : 'bg-slate-200'
                                }`}
                                title={t('common.save')}
                              >
                                <DocumentTextIcon className="h-4 w-4" />
                                {savingStudioMenu
                                  ? t('pages.myMenus.saving')
                                  : t('common.save')}
                              </button>
                              <ControlsDropdown
                                absolute
                                actions={[
                                  {
                                    icon: DocumentDuplicateIcon,
                                    labelKey: 'pages.menus.duplicate',
                                    colorClass: 'text-violet-700',
                                    disabled: isSelectedMenuActionBusy,
                                    onClick: () =>
                                      handleOpenDuplicateModal(
                                        selectedMenuInContainer
                                      )
                                  },
                                  {
                                    icon: PencilIcon,
                                    labelKey: 'common.edit',
                                    colorClass: 'text-blue-700',
                                    disabled: isSelectedMenuActionBusy,
                                    onClick: () =>
                                      handleLoadTemplateForEditing(
                                        selectedMenuInContainer
                                      )
                                  },
                                  ...(isAdmin
                                    ? [
                                        {
                                          icon: GlobeAltIcon,
                                          labelKey:
                                            'common.controls.copyToCountry',
                                          colorClass: 'text-emerald-700',
                                          disabled: isSelectedMenuActionBusy,
                                          onClick: () =>
                                            handleOpenCopyModal(
                                              selectedMenuInContainer
                                            )
                                        }
                                      ]
                                    : []),
                                  {
                                    icon: TrashIcon,
                                    labelKey: 'common.delete',
                                    colorClass: 'text-red-600',
                                    disabled: isSelectedMenuActionBusy,
                                    loading: isSelectedMenuDeleting,
                                    onClick: () =>
                                      handleDeleteTemplate(
                                        selectedMenuInContainer.id
                                      )
                                  }
                                ]}
                              />
                            </div>
                          </div>
>>>>>>> Stashed changes
                        </div>
                      )
                    })()}

                    {renderContainerStudioMealSection(
                      'breakfastPlan',
                      t('pages.myMenus.breakfast')
                    )}
                    {renderContainerStudioMealSection(
                      'lunchPlan',
                      t('pages.myMenus.lunch')
                    )}
                    {renderContainerStudioMealSection(
                      'dinnerPlan',
                      t('pages.myMenus.dinner')
                    )}
                    {renderContainerStudioMealSection(
                      'snackPlan',
                      t('pages.myMenus.snack')
                    )}
                  </>
                ) : null}
              </div>

              <div className="space-y-5">
                {selectedMenuInContainer ? (
                  <>
                    <div className="rounded-3xl border border-slate-200 bg-white p-5 text-sm text-gray-800 shadow-sm">
                      <div className="mb-2 flex items-center justify-between">
                        <p className="font-semibold text-gray-900">
                          {selectedMenuInContainer?.parsedMenuName} ·{' '}
                          {t('pages.myMenus.assignedUsers')}
                        </p>
                        <button
                          onClick={loadClients}
                          disabled={loadingClients}
                          className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-blue-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-50"
                          title={t('pages.myMenus.refreshClientsList')}
                        >
                          <ArrowPathIcon
                            className={`w-4 h-4 ${loadingClients ? 'animate-spin' : ''}`}
                          />
                        </button>
                      </div>
                      {clients.length === 0 ? (
                        <p className="text-xs text-gray-600">
                          {t('pages.myMenus.noClientsFound')}
                        </p>
                      ) : (
                        <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                          {clients.map(client => {
                            const clientId = Array.isArray(client?.user?.userId)
                              ? client.user.userId[0]
                              : client?.user?.userId
                            const clientName =
                              client?.user?.userData?.name ||
                              client?.user?.loginDetails?.displayName ||
                              'Unknown'
                            const assignedUsers =
                              selectedMenuInContainer?.assignedUsers || []
                            const assignmentInfo = assignedUsers.find(
                              au => au.userId === clientId
                            )

                            if (!assignmentInfo) {
                              return null
                            }

                            const menuKey = `${selectedMenuInContainer.id}-${clientId}`
                            const isExpanded = expandedClientMenus[menuKey]

                            return (
                              <div
                                key={clientId}
                                className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2"
                              >
                                <button
                                  onClick={() =>
                                    setExpandedClientMenus(prev => ({
                                      ...prev,
                                      [menuKey]: !prev[menuKey]
                                    }))
                                  }
                                  className="flex w-full items-center justify-between gap-3 text-left text-sm font-semibold text-slate-900"
                                >
                                  <div className="flex-1">
                                    <span>{clientName}</span>
                                    <span className="ml-2 text-xs text-slate-500">
                                      assigned{' '}
                                      {formatAssignmentDate(
                                        assignmentInfo.dateApplied,
                                        i18n.language
                                      )}
                                    </span>
                                  </div>
                                  {isExpanded ? (
                                    <ChevronUpIcon className="h-4 w-4" />
                                  ) : (
                                    <ChevronDownIcon className="h-4 w-4" />
                                  )}
                                </button>
                                {isExpanded && (
                                  <div className="mt-2 space-y-2 text-xs text-slate-600">
                                    <p>
                                      {t('pages.myMenus.userId')}: {clientId}
                                    </p>
                                    <p>
                                      {t('pages.myMenus.assignedDate')}:{' '}
                                      {formatAssignmentDate(
                                        assignmentInfo.dateApplied,
                                        i18n.language
                                      )}
                                    </p>
                                    <button
                                      onClick={() =>
                                        handleUnassignMenu(
                                          selectedMenuInContainer.id,
                                          clientId,
                                          assignmentInfo.dateApplied
                                        )
                                      }
                                      className="inline-flex items-center gap-1 rounded-full bg-red-50 px-3 py-1 text-[11px] font-semibold text-red-700 transition hover:bg-red-100"
                                    >
                                      <XMarkIcon className="h-3 w-3" />
                                      {t('pages.myMenus.unassign')}
                                    </button>
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>

                    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                      <div className="mb-4 flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-2">
                        <button
                          type="button"
                          onClick={() => setAssignmentMode('menu')}
                          className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
                            assignmentMode === 'menu'
                              ? 'bg-white text-blue-700 shadow-sm'
                              : 'text-slate-600 hover:bg-white'
                          }`}
                        >
                          {selectedMenuInContainer?.parsedMenuName ||
                            t('pages.myMenus.menuName')}
                        </button>
                        <button
                          type="button"
                          onClick={() => setAssignmentMode('container')}
                          className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
                            assignmentMode === 'container'
                              ? 'bg-white text-blue-700 shadow-sm'
                              : 'text-slate-600 hover:bg-white'
                          }`}
                        >
                          {selectedContainer?.containerName ||
                            t('pages.myMenus.menuContainerName')}
                        </button>
                      </div>
                      <p className="mb-4 text-xs text-slate-500">
                        {assignmentMode === 'container'
                          ? t('pages.myMenus.assignContainerHint')
                          : t('pages.myMenus.assignMenuHint')}
                      </p>
                      <div className="flex flex-col gap-3">
                        <select
                          value={selectedClientId || ''}
                          onChange={e => setSelectedClientId(e.target.value)}
                          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-gray-800 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200 sm:flex-1"
                          disabled={loadingClients}
                        >
                          <option value="">
                            {t('pages.myMenus.selectClientToAssign')}
                          </option>
                          {clients.map(client => {
                            const clientName =
                              client?.user?.userData?.name ||
                              client?.user?.loginDetails?.displayName ||
                              'Unknown'
                            const clientEmail =
                              client?.user?.userData?.email ||
                              client?.user?.loginDetails?.email ||
                              client?.user?.email ||
                              ''
                            const clientId = Array.isArray(client?.user?.userId)
                              ? client.user.userId[0]
                              : client?.user?.userId
                            return (
                              <option key={clientId} value={clientId}>
                                {clientName}
                                {clientEmail ? ` - ${clientEmail}` : ''}
                              </option>
                            )
                          })}
                        </select>
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                          <input
                            type="date"
                            value={assignmentDate}
                            onChange={e => setAssignmentDate(e.target.value)}
                            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-gray-800 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200 sm:flex-1"
                          />
                          <button
                            onClick={() =>
                              assignmentMode === 'container'
                                ? handleOpenAssignContainerPreview(
                                    selectedContainer
                                  )
                                : handleAssignMenu(selectedMenuInContainer.id)
                            }
                            disabled={
                              assigningMenu ||
                              assigningContainer ||
                              !selectedClientId
                            }
                            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 px-5 py-3 text-sm font-semibold text-white shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl disabled:opacity-60 sm:w-auto sm:min-w-28"
                          >
                            {assigningMenu || assigningContainer
                              ? t('pages.myMenus.assigning')
                              : assignmentMode === 'container'
                                ? t('pages.myMenus.reviewAssignment')
                                : t('pages.myMenus.assign')}
                          </button>
                        </div>
                      </div>
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default MyMenus
