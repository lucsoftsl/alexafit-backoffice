import { useState, useRef, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useSelector } from 'react-redux'
import {
  MagnifyingGlassIcon,
  TrashIcon,
  DocumentDuplicateIcon,
  PencilIcon,
  PhotoIcon,
  XMarkIcon,
  DocumentTextIcon,
  ChevronUpDownIcon,
  ChevronUpIcon,
  ChevronDownIcon
} from '@heroicons/react/24/outline'
import {
  searchFoodItems,
  getItemsByIds,
  addItem,
  updateItem,
  deleteItem,
  saveImageToImgb
} from '../services/api'
import { getImagePreviewDataUrl, resizeImageFile } from '../util/resizeImageFile'
import { getCategoryIcon } from '../util/categoryIcons'
import { useSelectedCountry } from '../util/useSelectedCountry'
import { selectIsAdmin } from '../store/userSlice'
import { useAuth } from '../contexts/AuthContext'

const AVAILABLE_COUNTRY_CODES = { ES: 'ES', GB: 'GB', HU: 'HU', IT: 'IT', RO: 'RO', UK: 'UK', US: 'US' }

const FOOD_CATEGORY_OPTIONS = [
  'fruits', 'vegetables', 'bread', 'general', 'sugar', 'meat', 'dairy',
  'cheese', 'grains', 'nuts', 'fish', 'fastfood', 'beverages', 'sweets',
  'fats', 'sauces', 'legumes', 'snack', 'alcohol', 'condiments', 'eggs'
]

const DEFAULT_SERVING_OPTIONS = [
  { unitName: 'g', value: 100 },
  { unitName: 'oz', value: 28.34 },
  { unitName: 'ml', value: 100 },
  { unitName: 'fl oz', value: 29.57 }
]

const OZ_TO_GRAMS = 28.34
const FL_OZ_TO_ML = 29.57

const parseNumber = value => {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

const parseServingOptions = servingOptions => {
  if (!servingOptions) return []
  if (Array.isArray(servingOptions)) return servingOptions
  if (typeof servingOptions === 'string') {
    try {
      const parsed = JSON.parse(servingOptions)
      return Array.isArray(parsed) ? parsed : []
    } catch { return [] }
  }
  return []
}

const parseNutrients = nutrients => {
  if (!nutrients) return {}
  if (typeof nutrients === 'object') return nutrients
  if (typeof nutrients === 'string') {
    try {
      const parsed = JSON.parse(nutrients)
      return parsed && typeof parsed === 'object' ? parsed : {}
    } catch { return {} }
  }
  return {}
}

// Food item form helpers
const getAmountInBaseUnit = (quantity, unit, isLiquidVal) => {
  const qty = parseNumber(quantity)
  const u = (unit || 'g').toLowerCase().trim()
  if (u === 'g' || u === 'gram' || u === 'grams') return qty
  if (u === 'kg') return qty * 1000
  if (u === 'oz') return qty * OZ_TO_GRAMS
  if (u === 'ml' || u === 'milliliter' || u === 'millilitre') return qty
  if (u === 'fl oz') return qty * FL_OZ_TO_ML
  if (u === 'l') return qty * 1000
  const defaultOption = DEFAULT_SERVING_OPTIONS.find(o =>
    isLiquidVal ? o.unitName === 'ml' || o.unitName === 'fl oz' : o.unitName === 'g' || o.unitName === 'oz'
  )
  return qty * parseNumber(defaultOption?.value || 1)
}

const convertBaseAmountToUnit = (baseAmount, unit) => {
  const u = (unit || 'g').toLowerCase().trim()
  const amount = parseNumber(baseAmount)
  if (u === 'g' || u === 'gram' || u === 'grams') return amount
  if (u === 'kg') return amount / 1000
  if (u === 'oz') return amount / OZ_TO_GRAMS
  if (u === 'ml' || u === 'milliliter' || u === 'millilitre') return amount
  if (u === 'fl oz') return amount / FL_OZ_TO_ML
  if (u === 'l') return amount / 1000
  return amount
}

const defaultServingValue = unit => (unit === 'g' || unit === 'ml' ? '100' : '1')
const getAllowedUnits = isLiquidVal => (isLiquidVal ? ['ml', 'fl oz'] : ['g', 'oz'])

const formatCategoryLabel = value =>
  String(value || '').split(/[_-]/g).filter(Boolean)
    .map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ')

// Recipe ingredient helpers
const getIngredientBaseAmount = (item, quantity, unit) => {
  const qty = parseNumber(quantity)
  const u = (unit || 'g').toLowerCase().trim()
  const isLiquid = item?.isLiquid === true || item?.isLiquid === '1'
  if (u === 'g' || u === 'gram' || u === 'grams') return qty
  if (u === 'kg') return qty * 1000
  if (u === 'oz') return qty * OZ_TO_GRAMS
  if (u === 'ml' || u === 'milliliter' || u === 'millilitre') return qty
  if (u === 'fl oz') return qty * FL_OZ_TO_ML
  if (u === 'l') return qty * 1000
  const customOptions = Array.isArray(item?.servingOptions) ? item.servingOptions : []
  const defaults = DEFAULT_SERVING_OPTIONS.filter(o =>
    isLiquid ? o.unitName === 'ml' || o.unitName === 'fl oz' : o.unitName === 'g' || o.unitName === 'oz'
  )
  const allOptions = [...customOptions]
  defaults.forEach(d => { if (!allOptions.some(o => o?.unitName === d.unitName)) allOptions.push(d) })
  const selected = allOptions.find(o => {
    const ou = (o?.unitName || '').toLowerCase()
    return ou === u || ou.includes(u)
  })
  if (!selected) return qty
  return qty * parseNumber(selected.value || 1)
}

const getIngredientFromBaseUnit = (item, baseAmount, unit) => {
  const u = (unit || 'g').toLowerCase().trim()
  const amount = parseNumber(baseAmount)
  const isLiquid = item?.isLiquid === true || item?.isLiquid === '1'
  if (u === 'g' || u === 'gram' || u === 'grams') return amount
  if (u === 'kg') return amount / 1000
  if (u === 'oz') return amount / OZ_TO_GRAMS
  if (u === 'ml' || u === 'milliliter' || u === 'millilitre') return amount
  if (u === 'fl oz') return amount / FL_OZ_TO_ML
  if (u === 'l') return amount / 1000
  const customOptions = Array.isArray(item?.servingOptions) ? item.servingOptions : []
  const defaults = DEFAULT_SERVING_OPTIONS.filter(o =>
    isLiquid ? o.unitName === 'ml' || o.unitName === 'fl oz' : o.unitName === 'g' || o.unitName === 'oz'
  )
  const allOptions = [...customOptions]
  defaults.forEach(d => { if (!allOptions.some(o => o?.unitName === d.unitName)) allOptions.push(d) })
  const selected = allOptions.find(o => {
    const ou = (o?.unitName || '').toLowerCase()
    return ou === u || ou.includes(u)
  })
  if (!selected) return amount
  return amount / parseNumber(selected.value || 1)
}

const getIngredientUnitOptions = ingredient => {
  const isLiquid = ingredient?.isLiquid === true || ingredient?.isLiquid === '1'
  const customOptions = parseServingOptions(ingredient?.servingOptions)
  const defaults = DEFAULT_SERVING_OPTIONS.filter(o =>
    isLiquid ? o.unitName === 'ml' || o.unitName === 'fl oz' : o.unitName === 'g' || o.unitName === 'oz'
  )
  const baseOptions = [...customOptions, ...defaults]
  const options = []
  const seen = new Set()
  baseOptions.forEach(option => {
    const unitName = (option?.unitName || '').toString().trim()
    if (!unitName) return
    const key = unitName.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    options.push(unitName)
  })
  const selectedUnit = (ingredient?.unit || '').toString().trim()
  if (selectedUnit) {
    const key = selectedUnit.toLowerCase()
    if (!seen.has(key)) options.unshift(selectedUnit)
  }
  return options
}

const calculateRecipeNutrients = ingredients => {
  return ingredients.reduce(
    (acc, ing) => {
      const amt = getIngredientBaseAmount(ing, ing.quantity ?? ing.weight, ing.unit || 'g')
      const n = parseNutrients(ing?.nutrientsPer100)
      return {
        totalCalories: acc.totalCalories + (parseNumber(ing?.caloriesPer100) * amt) / 100,
        totalQuantity: acc.totalQuantity + amt,
        totalProtein: acc.totalProtein + (amt * parseNumber(n.proteinsInGrams)) / 100,
        totalCarbs: acc.totalCarbs + (amt * parseNumber(n.carbohydratesInGrams)) / 100,
        totalFat: acc.totalFat + (amt * parseNumber(n.fatInGrams)) / 100,
        totalFiber: acc.totalFiber + (amt * parseNumber(n.fibreInGrams)) / 100,
        totalSaturatedFat: acc.totalSaturatedFat + (amt * parseNumber(n.fattyAcidsTotalSaturatedInGrams)) / 100,
        totalUnSaturatedFat: acc.totalUnSaturatedFat + (amt * parseNumber(n.fattyAcidsTotalUnSaturatedInGrams)) / 100,
        totalSugar: acc.totalSugar + (amt * parseNumber(n.sugarsInGrams)) / 100,
        totalSalt: acc.totalSalt + (amt * parseNumber(n.saltInGrams)) / 100
      }
    },
    {
      totalCalories: 0, totalQuantity: 0, totalProtein: 0, totalCarbs: 0,
      totalFat: 0, totalFiber: 0, totalSaturatedFat: 0, totalUnSaturatedFat: 0,
      totalSugar: 0, totalSalt: 0
    }
  )
}

const isRecipeItem = item => {
  const type = (item?.type || item?.itemType || '').toString().toLowerCase()
  return type === 'recipe' || type === 'recipes'
}

const SearchItems = () => {
  const { t } = useTranslation()
  const { currentUser } = useAuth()
  const isAdmin = useSelector(selectIsAdmin)
  const [sharedCountry, setSharedCountry] = useSelectedCountry()

  // Search state
  const [searchText, setSearchText] = useState('')
  const [filterCountryCode, setFilterCountryCode] = useState(sharedCountry)
  const [itemTypeFilter, setItemTypeFilter] = useState('food') // 'food' | 'recipe' | 'all'
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [loadingEdit, setLoadingEdit] = useState(false)

  // Table sort + filter
  const [tableSearch, setTableSearch] = useState('')
  const [sortColumn, setSortColumn] = useState(null)
  const [sortDirection, setSortDirection] = useState('asc')
  const [filterType, setFilterType] = useState('all')
  const [filterCountry, setFilterCountry] = useState('all')
  const [filterPublic, setFilterPublic] = useState('all')
  const [filterVerified, setFilterVerified] = useState('all')

  // ─── Food item modal state ───────────────────────────────────────────
  const [isFoodModalOpen, setIsFoodModalOpen] = useState(false)
  const [editingFoodItemId, setEditingFoodItemId] = useState(null)
  const [editingFoodCreatorId, setEditingFoodCreatorId] = useState(null)
  const [foodSubmitting, setFoodSubmitting] = useState(false)
  const [foodName, setFoodName] = useState('')
  const [foodBrand, setFoodBrand] = useState('')
  const [foodBarcode, setFoodBarcode] = useState('')
  const [foodCategory, setFoodCategory] = useState('')
  const [foodCountryCode, setFoodCountryCode] = useState(sharedCountry)
  const [foodUnit, setFoodUnit] = useState('g')
  const [foodIsLiquid, setFoodIsLiquid] = useState(false)
  const [foodServingName, setFoodServingName] = useState('')
  const [foodServingValue, setFoodServingValue] = useState('100')
  const [foodIsPublic, setFoodIsPublic] = useState(true)
  const [foodCalories, setFoodCalories] = useState('')
  const [foodProtein, setFoodProtein] = useState('')
  const [foodCarbs, setFoodCarbs] = useState('')
  const [foodFat, setFoodFat] = useState('')
  const [foodSugar, setFoodSugar] = useState('')
  const [foodFiber, setFoodFiber] = useState('')
  const [foodSalt, setFoodSalt] = useState('')
  const [foodSaturatedFat, setFoodSaturatedFat] = useState('')
  const [foodUnsaturatedFat, setFoodUnsaturatedFat] = useState('')
  const [foodPhoto, setFoodPhoto] = useState(null)
  const [foodPhotoPreview, setFoodPhotoPreview] = useState(null)
  const [foodExistingPhotoUrl, setFoodExistingPhotoUrl] = useState(null)
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false)
  const categoryDropdownRef = useRef(null)

  // ─── Recipe modal state ──────────────────────────────────────────────
  const [isRecipeModalOpen, setIsRecipeModalOpen] = useState(false)
  const [editingRecipeId, setEditingRecipeId] = useState(null)
  const [editingRecipeUserId, setEditingRecipeUserId] = useState(null)
  const [recipeSubmitting, setRecipeSubmitting] = useState(false)
  const [recipeUploadingPhoto, setRecipeUploadingPhoto] = useState(false)
  const [recipeName, setRecipeName] = useState('')
  const [recipeCountryCode, setRecipeCountryCode] = useState(sharedCountry)
  const [recipeIsPublic, setRecipeIsPublic] = useState(true)
  const [recipeInstructions, setRecipeInstructions] = useState('')
  const [recipeTotalTime, setRecipeTotalTime] = useState('')
  const [recipeServings, setRecipeServings] = useState(1)
  const [recipePhoto, setRecipePhoto] = useState(null)
  const [recipePhotoPreview, setRecipePhotoPreview] = useState(null)
  const [recipeExistingPhotoUrl, setRecipeExistingPhotoUrl] = useState(null)
  const [ingredients, setIngredients] = useState([])
  const [ingredientSearch, setIngredientSearch] = useState('')
  const [ingredientResults, setIngredientResults] = useState([])
  const [ingredientSearching, setIngredientSearching] = useState(false)

  // ─── Detail view modal state ─────────────────────────────────────────
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
  const [detailItem, setDetailItem] = useState(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  // ─── Click outside for category dropdown ────────────────────────────
  useEffect(() => {
    if (!isCategoryDropdownOpen) return undefined
    const handleOutsideClick = event => {
      if (!categoryDropdownRef.current?.contains(event.target)) {
        setIsCategoryDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [isCategoryDropdownOpen])

  // ─── Computed ────────────────────────────────────────────────────────
  const foodAvailableUnits = useMemo(() => getAllowedUnits(foodIsLiquid), [foodIsLiquid])

  const recipeTotals = useMemo(() => calculateRecipeNutrients(ingredients), [ingredients])

  const ingredientCalories = useMemo(
    () => ingredients.map(ing => {
      const amt = getIngredientBaseAmount(ing, ing.quantity ?? ing.weight, ing.unit || 'g')
      return Math.round((parseNumber(ing?.caloriesPer100) * amt) / 100)
    }),
    [ingredients]
  )

  // ─── Table sort handler ───────────────────────────────────────────────
  const handleSort = column => {
    if (sortColumn === column) {
      if (sortDirection === 'asc') {
        setSortDirection('desc')
      } else {
        setSortColumn(null)
        setSortDirection('asc')
      }
    } else {
      setSortColumn(column)
      setSortDirection('asc')
    }
  }

  // ─── Derived result set (filter + sort) ──────────────────────────────
  const uniqueCountries = useMemo(
    () => ['all', ...new Set(searchResults.map(i => i.countryCode).filter(Boolean)).values()],
    [searchResults]
  )

  const displayedResults = useMemo(() => {
    let items = searchResults

    if (tableSearch.trim()) {
      const q = tableSearch.toLowerCase()
      items = items.filter(i =>
        [i.name, i.brand, i.category].some(v => String(v || '').toLowerCase().includes(q))
      )
    }
    if (filterType !== 'all') {
      items = items.filter(i => (filterType === 'recipe') === isRecipeItem(i))
    }
    if (filterCountry !== 'all') {
      items = items.filter(i => i.countryCode === filterCountry)
    }
    if (filterPublic !== 'all') {
      const want = filterPublic === 'true'
      items = items.filter(i => Boolean(i.isPublic) === want)
    }
    if (filterVerified !== 'all') {
      const want = filterVerified === 'true'
      items = items.filter(i => Boolean(i.isVerified) === want)
    }

    if (sortColumn) {
      const factor = sortDirection === 'asc' ? 1 : -1
      items = [...items].sort((a, b) => {
        switch (sortColumn) {
          case 'name':
            return String(a.name || '').toLowerCase().localeCompare(String(b.name || '').toLowerCase()) * factor
          case 'brand':
            return String(a.brand || '').toLowerCase().localeCompare(String(b.brand || '').toLowerCase()) * factor
          case 'type':
            return String(a.type || '').localeCompare(String(b.type || '')) * factor
          case 'category':
            return String(a.category || '').toLowerCase().localeCompare(String(b.category || '').toLowerCase()) * factor
          case 'country':
            return String(a.countryCode || '').localeCompare(String(b.countryCode || '')) * factor
          case 'calories':
            return (parseNumber(a.caloriesPer100) - parseNumber(b.caloriesPer100)) * factor
          case 'public':
            return (Number(Boolean(a.isPublic)) - Number(Boolean(b.isPublic))) * factor
          case 'verified':
            return (Number(Boolean(a.isVerified)) - Number(Boolean(b.isVerified))) * factor
          default:
            return 0
        }
      })
    }

    return items
  }, [searchResults, tableSearch, sortColumn, sortDirection, filterType, filterCountry, filterPublic, filterVerified])

  // ─── Search ──────────────────────────────────────────────────────────
  const handleSearch = async () => {
    if (!searchText.trim()) return
    setSearching(true)
    setHasSearched(true)
    setTableSearch('')
    setSortColumn(null)
    setSortDirection('asc')
    setFilterType('all')
    setFilterCountry('all')
    setFilterPublic('all')
    setFilterVerified('all')
    try {
      if (itemTypeFilter === 'all') {
        const [foodRes, recipeRes] = await Promise.all([
          searchFoodItems({ searchText, userId: currentUser?.uid, onlyRecipes: false, countryCode: filterCountryCode }),
          searchFoodItems({ searchText, userId: currentUser?.uid, onlyRecipes: true, countryCode: filterCountryCode })
        ])
        const combined = [...(foodRes || []), ...(recipeRes || [])]
        const seen = new Set()
        setSearchResults(combined.filter(i => {
          const id = i?.id || i?.itemId || i?._id
          if (!id || seen.has(id)) return false
          seen.add(id)
          return true
        }))
      } else {
        const onlyRecipes = itemTypeFilter === 'recipe'
        const results = await searchFoodItems({
          searchText, userId: currentUser?.uid, onlyRecipes, countryCode: filterCountryCode
        })
        if (onlyRecipes) {
          setSearchResults(results || [])
        } else {
          setSearchResults((results || []).filter(i => {
            const type = (i?.type || i?.itemType || '').toString().toLowerCase()
            return type !== 'recipe' && type !== 'recipes'
          }))
        }
      }
    } catch (e) {
      console.error('Search failed', e)
    } finally {
      setSearching(false)
    }
  }

  // ─── Delete ──────────────────────────────────────────────────────────
  const handleDelete = async item => {
    if (!confirm(t('pages.searchItems.confirmDelete', { name: item?.name || '' }))) return
    try {
      setDeleting(true)
      await deleteItem({
        itemId: item.id || item.itemId || item._id,
        itemType: 'FOOD',
        userId: item.createdByUserId || currentUser?.uid
      })
      setSearchResults(prev => prev.filter(r => (r.id || r.itemId || r._id) !== (item.id || item.itemId || item._id)))
    } catch (e) {
      console.error('Delete failed', e)
      alert(t('pages.searchItems.deleteFail'))
    } finally {
      setDeleting(false)
    }
  }

  // ─── Food item modal ─────────────────────────────────────────────────
  const resetFoodForm = () => {
    setEditingFoodItemId(null)
    setEditingFoodCreatorId(null)
    setFoodName('')
    setFoodBrand('')
    setFoodBarcode('')
    setFoodCategory('')
    setFoodCountryCode(sharedCountry)
    setFoodUnit('g')
    setFoodIsLiquid(false)
    setFoodServingName('')
    setFoodServingValue('100')
    setFoodIsPublic(true)
    setFoodCalories('')
    setFoodProtein('')
    setFoodCarbs('')
    setFoodFat('')
    setFoodSugar('')
    setFoodFiber('')
    setFoodSalt('')
    setFoodSaturatedFat('')
    setFoodUnsaturatedFat('')
    setFoodPhoto(null)
    setFoodPhotoPreview(null)
    setFoodExistingPhotoUrl(null)
    setIsCategoryDropdownOpen(false)
  }

  const populateFoodForm = item => {
    resetFoodForm()
    setFoodName(item.name || '')
    setFoodBrand(item.brand || '')
    setFoodBarcode(item.barcode || '')
    setFoodCategory(item.category || '')
    setFoodCountryCode(item.countryCode || sharedCountry)
    setFoodIsPublic(Boolean(item.isPublic))
    setFoodExistingPhotoUrl(item.brandPhotoUrl || item.photoUrl || null)
    setFoodPhotoPreview(item.brandPhotoUrl || item.photoUrl || null)
    const nextUnit = item.selectedUnit || (item.isLiquid ? 'ml' : 'g')
    setFoodUnit(nextUnit)
    setFoodIsLiquid(Boolean(item.isLiquid))
    const servingOptions = parseServingOptions(item.servingOptions)
    const servingOption = servingOptions[0]
    if (servingOption) {
      const baseAmount = parseNumber(servingOption.value || 100)
      const displayValue = convertBaseAmountToUnit(baseAmount, nextUnit)
      const multiplier = baseAmount / 100
      setFoodServingName(servingOption.unitName === 'serving' ? '' : servingOption.unitName || '')
      setFoodServingValue(String(Number(displayValue.toFixed(2))))
      setFoodCalories(String(Number((parseNumber(item.caloriesPer100) * multiplier).toFixed(2))))
      const n = item.nutrientsPer100 || {}
      setFoodProtein(String(Number((parseNumber(n.proteinsInGrams) * multiplier).toFixed(2))))
      setFoodCarbs(String(Number((parseNumber(n.carbohydratesInGrams) * multiplier).toFixed(2))))
      setFoodFat(String(Number((parseNumber(n.fatInGrams) * multiplier).toFixed(2))))
      setFoodSugar(String(Number((parseNumber(n.sugarsInGrams) * multiplier).toFixed(2))))
      setFoodFiber(String(Number((parseNumber(n.fibreInGrams) * multiplier).toFixed(2))))
      setFoodSalt(String(Number((parseNumber(n.saltInGrams) * multiplier).toFixed(2))))
      setFoodSaturatedFat(String(Number((parseNumber(n.fattyAcidsTotalSaturatedInGrams) * multiplier).toFixed(2))))
      setFoodUnsaturatedFat(String(Number((parseNumber(n.fattyAcidsTotalUnSaturatedInGrams) * multiplier).toFixed(2))))
    } else {
      setFoodServingValue(defaultServingValue(nextUnit))
      const n = item.nutrientsPer100 || {}
      setFoodCalories(String(parseNumber(item.caloriesPer100)))
      setFoodProtein(String(parseNumber(n.proteinsInGrams)))
      setFoodCarbs(String(parseNumber(n.carbohydratesInGrams)))
      setFoodFat(String(parseNumber(n.fatInGrams)))
      setFoodSugar(String(parseNumber(n.sugarsInGrams)))
      setFoodFiber(String(parseNumber(n.fibreInGrams)))
      setFoodSalt(String(parseNumber(n.saltInGrams)))
      setFoodSaturatedFat(String(parseNumber(n.fattyAcidsTotalSaturatedInGrams)))
      setFoodUnsaturatedFat(String(parseNumber(n.fattyAcidsTotalUnSaturatedInGrams)))
    }
  }

  const handleEditFood = item => {
    populateFoodForm(item)
    setEditingFoodItemId(item.id || item.itemId || item._id)
    setEditingFoodCreatorId(item.createdByUserId || null)
    setIsFoodModalOpen(true)
  }

  const handleDuplicateFood = item => {
    populateFoodForm(item)
    setIsFoodModalOpen(true)
  }

  const handleFoodUnitChange = unit => {
    const baseAmount = getAmountInBaseUnit(foodServingValue, foodUnit, foodIsLiquid)
    const nextIsLiquid = unit === 'ml' || unit === 'fl oz'
    setFoodUnit(unit)
    setFoodIsLiquid(nextIsLiquid)
    const converted = convertBaseAmountToUnit(baseAmount, unit)
    setFoodServingValue(String(Number(converted.toFixed(2))))
  }

  const handleFoodPhotoSelect = async event => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const resized = await resizeImageFile(file, { maxWidth: 300, maxHeight: 400 })
      setFoodPhoto(resized)
      setFoodPhotoPreview(await getImagePreviewDataUrl(resized))
    } catch (e) {
      console.error('Failed to prepare photo', e)
    } finally {
      event.target.value = ''
    }
  }

  const handleFoodSubmit = async () => {
    if (!foodName.trim() || !foodCalories || !foodProtein || !foodCarbs || !foodFat) {
      alert(t('pages.foodItems.requiredFields'))
      return
    }
    try {
      setFoodSubmitting(true)
      let photoUrl = foodExistingPhotoUrl
      if (foodPhoto) {
        const photoResult = await saveImageToImgb(foodPhoto)
        photoUrl = photoResult?.url
          ? photoResult.url
          : photoResult?.id
            ? `https://i.ibb.co/${photoResult.id}/${photoResult.id}.jpg`
            : foodExistingPhotoUrl
      }
      const baseAmount = getAmountInBaseUnit(foodServingValue, foodUnit, foodIsLiquid) || 100
      const toPer100 = 100 / baseAmount
      const hasCustomServing =
        foodServingName.trim() !== '' ||
        ((foodUnit === 'g' || foodUnit === 'ml')
          ? parseNumber(foodServingValue) !== 100
          : parseNumber(foodServingValue) !== 1)
      const servingOptions = hasCustomServing
        ? [{ unitName: foodServingName.trim() || 'serving', value: baseAmount }]
        : []
      const data = {
        type: 'food',
        name: foodName.trim(),
        category: foodCategory || null,
        barcode: foodBarcode || null,
        brand: foodBrand || null,
        brandPhotoUrl: photoUrl || '',
        caloriesPer100: parseNumber(foodCalories) * toPer100,
        nutrientsPer100: {
          proteinsInGrams: parseNumber(foodProtein) * toPer100,
          carbohydratesInGrams: parseNumber(foodCarbs) * toPer100,
          fatInGrams: parseNumber(foodFat) * toPer100,
          sugarsInGrams: parseNumber(foodSugar) * toPer100,
          fibreInGrams: parseNumber(foodFiber) * toPer100,
          saltInGrams: parseNumber(foodSalt) * toPer100,
          fattyAcidsTotalSaturatedInGrams: parseNumber(foodSaturatedFat) * toPer100,
          fattyAcidsTotalUnSaturatedInGrams: parseNumber(foodUnsaturatedFat) * toPer100
        },
        servingOptions,
        selectedUnit: foodUnit,
        isLiquid: foodIsLiquid,
        isPublic: foodIsPublic,
        countryCode: foodCountryCode
      }
      if (editingFoodItemId) {
        await updateItem({
          userId: editingFoodCreatorId || currentUser?.uid,
          itemId: editingFoodItemId,
          itemType: 'FOOD',
          data
        })
        setSearchResults(prev =>
          prev.map(r => {
            const rid = r.id || r.itemId || r._id
            if (rid === editingFoodItemId) {
              return { ...r, name: data.name, brand: data.brand, category: data.category, countryCode: data.countryCode, caloriesPer100: data.caloriesPer100, isPublic: data.isPublic }
            }
            return r
          })
        )
      } else {
        await addItem({ userId: currentUser?.uid, itemType: 'FOOD', data, countryCode: foodCountryCode })
      }
      setIsFoodModalOpen(false)
      resetFoodForm()
    } catch (e) {
      console.error('Failed to save food item', e)
      alert(editingFoodItemId ? t('pages.foodItems.updateFail') : t('pages.foodItems.createFail'))
    } finally {
      setFoodSubmitting(false)
    }
  }

  // ─── Recipe modal ────────────────────────────────────────────────────
  const resetRecipeForm = () => {
    setEditingRecipeId(null)
    setEditingRecipeUserId(null)
    setRecipeName('')
    setRecipeCountryCode(sharedCountry)
    setRecipeIsPublic(true)
    setRecipeInstructions('')
    setRecipeTotalTime('')
    setRecipeServings(1)
    setRecipePhoto(null)
    setRecipePhotoPreview(null)
    setRecipeExistingPhotoUrl(null)
    setIngredients([])
    setIngredientSearch('')
    setIngredientResults([])
  }

  const populateRecipeForm = async (item, isDuplicate = false) => {
    setLoadingEdit(true)
    try {
      const recipeId = item.id || item.itemId || item._id
      const fetchedRecipe = await getItemsByIds({ ids: [recipeId] })
      const resolved = fetchedRecipe?.data?.[0] || fetchedRecipe?.items?.[0] || item

      if (!isDuplicate) {
        setEditingRecipeId(recipeId)
        setEditingRecipeUserId(resolved.createdByUserId || currentUser?.uid)
      }
      setRecipeName(resolved.name || '')
      setRecipeCountryCode(resolved.countryCode || sharedCountry)
      setRecipeIsPublic(Boolean(resolved.isPublic))
      setRecipeInstructions(resolved.recipeSteps?.instructions?.join('\n') || '')
      setRecipeTotalTime(resolved.totalTimeInMinutes?.toString() || '')
      setRecipeServings(resolved.numberOfRecipeServings || 1)
      setRecipeExistingPhotoUrl(resolved.photoUrl || null)
      setRecipePhotoPreview(resolved.photoUrl || null)

      const ingList = resolved.ingredients || []
      if (ingList.length > 0) {
        try {
          const ids = ingList.map(i => i.id).filter(Boolean)
          if (ids.length > 0) {
            await new Promise(r => setTimeout(r, 1000))
            const ingResp = await getItemsByIds({ ids })
            const detailed = ingResp?.data || ingResp?.items || []
            const detailMap = {}
            detailed.forEach(d => {
              const id = d.id || d.itemId || d._id
              if (id) detailMap[id] = d
            })
            setIngredients(ingList.map(ing => {
              const d = detailMap[ing.id]
              const qty = parseNumber(ing.quantity ?? ing.weight ?? 100)
              if (d) {
                return {
                  id: ing.id, name: ing.name || d.name, quantity: qty, weight: qty,
                  unit: ing.unit || 'g', category: ing.category || d.category || null,
                  caloriesPer100: parseNumber(d.caloriesPer100),
                  nutrientsPer100: parseNutrients(d.nutrientsPer100),
                  isLiquid: d.isLiquid, servingOptions: parseServingOptions(d.servingOptions)
                }
              }
              return {
                id: ing.id, name: ing.name, quantity: qty, weight: qty,
                unit: ing.unit || 'g', category: ing.category || null,
                caloriesPer100: parseNumber(ing.caloriesPer100),
                nutrientsPer100: parseNutrients(ing.nutrientsPer100),
                isLiquid: ing.isLiquid, servingOptions: parseServingOptions(ing.servingOptions)
              }
            }))
          } else {
            setIngredients(ingList)
          }
        } catch (e) {
          console.warn('Failed to enrich ingredient data', e)
          setIngredients(ingList)
        }
      } else {
        setIngredients([])
      }
    } catch (e) {
      console.error('Failed to load recipe', e)
      alert(t('pages.recipes.failedLoadRecipeDataRetry'))
    } finally {
      setLoadingEdit(false)
    }
  }

  const handleEditRecipe = async item => {
    resetRecipeForm()
    await populateRecipeForm(item, false)
    setIsRecipeModalOpen(true)
  }

  const handleDuplicateRecipe = async item => {
    resetRecipeForm()
    await populateRecipeForm(item, true)
    setIsRecipeModalOpen(true)
  }

  const handleRecipePhotoSelect = async e => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const resized = await resizeImageFile(file, { maxWidth: 300, maxHeight: 400 })
      setRecipePhoto(resized)
      setRecipePhotoPreview(await getImagePreviewDataUrl(resized))
    } catch (e) {
      console.error('Failed to prepare recipe photo', e)
    } finally {
      e.target.value = ''
    }
  }

  const handleIngredientSearch = async () => {
    if (!ingredientSearch.trim()) return
    setIngredientSearching(true)
    try {
      const results = await searchFoodItems({
        searchText: ingredientSearch, userId: currentUser?.uid,
        onlyRecipes: false, countryCode: recipeCountryCode
      })
      const foodOnly = (results || []).filter(i => {
        const type = (i?.type || i?.itemType || '').toString().toLowerCase()
        return type !== 'recipe' && type !== 'recipes'
      })
      setIngredientResults(foodOnly)
    } catch (e) {
      console.error('Ingredient search failed', e)
    } finally {
      setIngredientSearching(false)
    }
  }

  const addIngredient = item => {
    const servOpts = parseServingOptions(item.servingOptions)
    const isLiquid = item?.isLiquid === true || item?.isLiquid === '1'
    const defaultUnit = servOpts.find(o => o?.unitName)?.unitName || (isLiquid ? 'ml' : 'g')
    setIngredients(prev => [...prev, {
      id: item.id || item.itemId || item._id,
      name: item.name || item.title || 'Unnamed',
      quantity: 100, weight: 100, unit: defaultUnit,
      category: item.category || null,
      caloriesPer100: parseNumber(item.caloriesPer100),
      nutrientsPer100: parseNutrients(item.nutrientsPer100),
      isLiquid, servingOptions: servOpts
    }])
    setIngredientSearch('')
    setIngredientResults([])
  }

  const removeIngredient = index => setIngredients(prev => prev.filter((_, i) => i !== index))

  const updateIngredientWeight = (index, weight) => {
    setIngredients(prev => prev.map((ing, i) => i === index ? { ...ing, weight, quantity: weight } : ing))
  }

  const updateIngredientUnit = (index, unit) => {
    setIngredients(prev => prev.map((ing, i) => {
      if (i !== index) return ing
      const currentQty = ing.quantity ?? ing.weight
      const base = getIngredientBaseAmount(ing, currentQty, ing.unit || 'g')
      const nextQty = Number(getIngredientFromBaseUnit(ing, base, unit).toFixed(2))
      return { ...ing, unit, quantity: nextQty, weight: nextQty }
    }))
  }

  const handleRecipeSubmit = async () => {
    if (!recipeName.trim()) { alert(t('pages.recipes.provideRecipeName')); return }
    if (ingredients.length === 0) { alert(t('pages.recipes.addAtLeastOneIngredient')); return }
    try {
      setRecipeSubmitting(true)
      const totals = calculateRecipeNutrients(ingredients)
      let photoUrl = recipeExistingPhotoUrl
      if (recipePhoto) {
        setRecipeUploadingPhoto(true)
        const photoResult = await saveImageToImgb(recipePhoto)
        photoUrl = photoResult?.url
          ? photoResult.url
          : photoResult?.id
            ? `https://i.ibb.co/${photoResult.id}/${photoResult.id}.jpg`
            : recipeExistingPhotoUrl
        setRecipeUploadingPhoto(false)
      }
      const instructions = recipeInstructions.split('\n').map(l => l.trim()).filter(l => l.length > 0)
      const totalQty = totals.totalQuantity || 1
      const servingValue = totalQty / (parseInt(recipeServings, 10) || 1)
      const recipeData = {
        type: 'recipe',
        countryCode: recipeCountryCode,
        servingOptions: [{ unitName: 'serving', value: servingValue }],
        ingredients: ingredients.map(ing => ({
          id: ing.id, name: ing.name,
          quantity: parseNumber(ing.quantity ?? ing.weight ?? 0),
          unit: ing.unit, category: ing.category
        })),
        photoUrl,
        recipeSteps: { instructions },
        totalTimeInMinutes: parseInt(recipeTotalTime) || 0,
        caloriesPer100: (totals.totalCalories * 100) / totalQty,
        name: recipeName.trim(),
        isPublic: recipeIsPublic,
        numberOfRecipeServings: parseInt(recipeServings, 10) || 1,
        nutrientsPer100: {
          proteinsInGrams: (totals.totalProtein * 100) / totalQty,
          fatInGrams: (totals.totalFat * 100) / totalQty,
          fattyAcidsTotalSaturatedInGrams: (totals.totalSaturatedFat * 100) / totalQty,
          fattyAcidsTotalUnSaturatedInGrams: (totals.totalUnSaturatedFat * 100) / totalQty,
          carbohydratesInGrams: (totals.totalCarbs * 100) / totalQty,
          saltInGrams: (totals.totalSalt * 100) / totalQty,
          fibreInGrams: (totals.totalFiber * 100) / totalQty,
          sugarsInGrams: (totals.totalSugar * 100) / totalQty
        },
        selectedUnit: 'serving',
        isLiquid: false,
        weightAfterCooking: totals.totalQuantity
      }
      if (editingRecipeId) {
        await updateItem({
          userId: editingRecipeUserId || currentUser?.uid,
          itemId: editingRecipeId,
          itemType: 'FOOD',
          data: recipeData
        })
        setSearchResults(prev =>
          prev.map(r => {
            const rid = r.id || r.itemId || r._id
            if (rid === editingRecipeId) {
              return { ...r, name: recipeData.name, countryCode: recipeData.countryCode, isPublic: recipeData.isPublic, caloriesPer100: recipeData.caloriesPer100 }
            }
            return r
          })
        )
      } else {
        await addItem({ userId: currentUser?.uid, itemType: 'FOOD', data: recipeData, countryCode: recipeCountryCode })
      }
      setIsRecipeModalOpen(false)
      resetRecipeForm()
    } catch (e) {
      console.error('Failed to save recipe', e)
      alert(editingRecipeId ? t('pages.recipes.updateFail') : t('pages.recipes.createFail'))
    } finally {
      setRecipeSubmitting(false)
      setRecipeUploadingPhoto(false)
    }
  }

  // ─── Edit / Duplicate dispatch ────────────────────────────────────────
  const handleEdit = item => {
    if (isRecipeItem(item)) {
      handleEditRecipe(item)
    } else {
      handleEditFood(item)
    }
  }

  const handleDuplicate = item => {
    if (isRecipeItem(item)) {
      handleDuplicateRecipe(item)
    } else {
      handleDuplicateFood(item)
    }
  }

  const handleViewDetails = async item => {
    const basicItem = { ...item }
    setDetailItem(basicItem)
    setIsDetailModalOpen(true)
    setLoadingDetail(true)
    try {
      const itemId = item.id || item.itemId || item._id
      const fetched = await getItemsByIds({ ids: [itemId] })
      const resolved = fetched?.data?.[0] || fetched?.items?.[0] || item

      if (isRecipeItem(item)) {
        const ingList = resolved.ingredients || []
        if (ingList.length > 0) {
          try {
            const ids = ingList.map(i => i.id).filter(Boolean)
            if (ids.length > 0) {
              await new Promise(r => setTimeout(r, 1000))
              const ingResp = await getItemsByIds({ ids })
              const detailed = ingResp?.data || ingResp?.items || []
              const detailMap = {}
              detailed.forEach(d => {
                const did = d.id || d.itemId || d._id
                if (did) detailMap[did] = d
              })
              const enriched = ingList.map(ing => {
                const d = detailMap[ing.id]
                const qty = parseNumber(ing.quantity ?? ing.weight ?? 100)
                if (d) {
                  return {
                    id: ing.id, name: ing.name || d.name, quantity: qty, weight: qty,
                    unit: ing.unit || 'g', category: ing.category || d.category || null,
                    caloriesPer100: parseNumber(d.caloriesPer100),
                    nutrientsPer100: parseNutrients(d.nutrientsPer100),
                    isLiquid: d.isLiquid, servingOptions: parseServingOptions(d.servingOptions)
                  }
                }
                return {
                  id: ing.id, name: ing.name, quantity: qty, weight: qty,
                  unit: ing.unit || 'g', category: ing.category || null,
                  caloriesPer100: parseNumber(ing.caloriesPer100),
                  nutrientsPer100: parseNutrients(ing.nutrientsPer100),
                  isLiquid: ing.isLiquid, servingOptions: parseServingOptions(ing.servingOptions)
                }
              })
              setDetailItem({ ...resolved, ingredients: enriched })
              return
            }
          } catch (e) {
            console.warn('Failed to enrich ingredient data', e)
          }
        }
      }
      setDetailItem(resolved)
    } catch (e) {
      console.error('Failed to load item details', e)
    } finally {
      setLoadingDetail(false)
    }
  }

  if (!isAdmin) {
    return (
      <div className="flex h-64 items-center justify-center text-gray-600">
        {t('pages.searchItems.adminOnly')}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Loading overlay */}
      {loadingEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="rounded-2xl bg-white px-8 py-6 text-sm font-medium text-slate-700 shadow-xl">
            {t('pages.searchItems.loadingItem')}
          </div>
        </div>
      )}

      {/* Page header + search form */}
      <div className="rounded-3xl border border-white/40 bg-white/75 p-6 shadow-[0_20px_80px_rgba(15,23,42,0.08)] backdrop-blur-xl sm:p-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">{t('pages.searchItems.title')}</h1>
          <p className="mt-2 text-gray-600">{t('pages.searchItems.subtitle')}</p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              {t('pages.searchItems.searchText')}
            </label>
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSearch() }}
                placeholder={t('pages.searchItems.searchPlaceholder')}
                className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm text-slate-900 outline-none transition focus:border-violet-300 focus:bg-white"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              {t('pages.searchItems.country')}
            </label>
            <select
              value={filterCountryCode}
              onChange={e => {
                const next = setSharedCountry(e.target.value)
                setFilterCountryCode(next)
              }}
              className="h-12 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-violet-300"
            >
              {Object.entries(AVAILABLE_COUNTRY_CODES).map(([k, v]) => (
                <option key={k} value={v}>{v}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              {t('pages.searchItems.itemType')}
            </label>
            <div className="flex h-12 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
              {['food', 'recipe', 'all'].map(type => (
                <button
                  key={type}
                  onClick={() => setItemTypeFilter(type)}
                  className={`px-4 text-sm font-semibold transition ${
                    itemTypeFilter === type
                      ? 'bg-violet-600 text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {t(`pages.searchItems.type_${type}`)}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleSearch}
            disabled={searching || !searchText.trim()}
            className="inline-flex h-12 items-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-6 text-sm font-semibold text-white shadow-lg transition hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50"
          >
            <MagnifyingGlassIcon className="h-4 w-4" />
            {searching ? t('pages.recipes.searching') : t('pages.recipes.search')}
          </button>
        </div>
      </div>

      {/* Results */}
      {hasSearched && (
        <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
          {searchResults.length === 0 ? (
            <div className="py-16 text-center text-sm text-slate-500">
              {searching ? t('pages.recipes.searching') : t('pages.searchItems.noResults')}
            </div>
          ) : (
            <>
              {/* Filter toolbar */}
              <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-6 py-4">
                <div className="relative flex-1 min-w-[160px]">
                  <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={tableSearch}
                    onChange={e => setTableSearch(e.target.value)}
                    placeholder={t('pages.searchItems.filterResults')}
                    className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none focus:border-violet-300"
                  />
                </div>
                <select value={filterType} onChange={e => setFilterType(e.target.value)} className="h-9 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-violet-300">
                  <option value="all">{t('pages.searchItems.type')}: {t('pages.searchItems.type_all')}</option>
                  <option value="food">{t('pages.searchItems.typeFood')}</option>
                  <option value="recipe">{t('pages.searchItems.typeRecipe')}</option>
                </select>
                <select value={filterCountry} onChange={e => setFilterCountry(e.target.value)} className="h-9 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-violet-300">
                  {uniqueCountries.map(c => (
                    <option key={c} value={c}>{c === 'all' ? `${t('pages.searchItems.country')}: ${t('pages.searchItems.type_all')}` : c}</option>
                  ))}
                </select>
                <select value={filterPublic} onChange={e => setFilterPublic(e.target.value)} className="h-9 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-violet-300">
                  <option value="all">{t('pages.recipes.publicLabel')}: {t('pages.searchItems.type_all')}</option>
                  <option value="true">{t('pages.recipes.public')}</option>
                  <option value="false">{t('pages.recipes.private')}</option>
                </select>
                <select value={filterVerified} onChange={e => setFilterVerified(e.target.value)} className="h-9 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-violet-300">
                  <option value="all">{t('pages.recipes.verified')}: {t('pages.searchItems.type_all')}</option>
                  <option value="true">{t('pages.recipes.verified')}</option>
                  <option value="false">{t('pages.recipes.unverified')}</option>
                </select>
                <span className="ml-auto text-sm font-semibold text-slate-500">
                  {displayedResults.length !== searchResults.length
                    ? t('pages.searchItems.filteredCount', { shown: displayedResults.length, total: searchResults.length })
                    : t('pages.searchItems.resultsCount', { count: searchResults.length })}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      {[
                        { col: 'name', label: t('pages.foodItems.name') },
                        { col: 'brand', label: t('pages.foodItems.brand') },
                        { col: 'type', label: t('pages.searchItems.type') },
                        { col: 'category', label: t('pages.foodItems.category') },
                        { col: 'country', label: t('pages.recipes.country') },
                        { col: 'calories', label: t('pages.recipes.caloriesPer100g') },
                        { col: 'public', label: t('pages.recipes.publicLabel') },
                        { col: 'verified', label: t('pages.recipes.verified') }
                      ].map(({ col, label }) => (
                        <th key={col} className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => handleSort(col)}
                            className="inline-flex items-center gap-1 font-semibold text-slate-500 hover:text-slate-800 transition"
                          >
                            {label}
                            {sortColumn === col
                              ? sortDirection === 'asc'
                                ? <ChevronUpIcon className="h-3.5 w-3.5" />
                                : <ChevronDownIcon className="h-3.5 w-3.5" />
                              : <ChevronUpDownIcon className="h-3.5 w-3.5 opacity-40" />}
                          </button>
                        </th>
                      ))}
                      <th className="px-4 py-3 font-semibold text-slate-500">{t('pages.searchItems.createdBy')}</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {displayedResults.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="py-10 text-center text-sm text-slate-400">
                          {t('pages.searchItems.noFilterResults')}
                        </td>
                      </tr>
                    ) : null}
                    {displayedResults.map((item, idx) => (
                      <tr key={item.id || item.itemId || item._id || idx} className="cursor-pointer transition hover:bg-violet-50/30" onClick={() => handleViewDetails(item)}>
                        <td className="px-4 py-3 font-medium text-slate-900">
                          <div className="flex items-center gap-2">
                            {(item.brandPhotoUrl || item.photoUrl) && (
                              <img
                                src={item.brandPhotoUrl || item.photoUrl}
                                alt={item.name}
                                className="h-8 w-8 rounded-lg object-cover"
                              />
                            )}
                            <span className="max-w-[180px] truncate">{item.name || '-'}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-600">{item.brand || '-'}</td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            isRecipeItem(item) ? 'bg-fuchsia-50 text-fuchsia-700' : 'bg-blue-50 text-blue-700'
                          }`}>
                            {isRecipeItem(item) ? t('pages.searchItems.typeRecipe') : t('pages.searchItems.typeFood')}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600">{item.category || '-'}</td>
                        <td className="px-4 py-3 text-slate-600">{item.countryCode || '-'}</td>
                        <td className="px-4 py-3 text-slate-600">{item.caloriesPer100 != null ? Math.round(parseNumber(item.caloriesPer100)) : '-'}</td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${item.isPublic ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'}`}>
                            {item.isPublic ? t('pages.recipes.public') : t('pages.recipes.private')}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${item.isVerified ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-700'}`}>
                            {item.isVerified ? t('pages.recipes.verified') : t('pages.recipes.unverified')}
                          </span>
                        </td>
                        <td className="max-w-[140px] truncate px-4 py-3 text-xs text-slate-500">
                          {item.createdByUserId || t('sidebar.backofficeAdmin')}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={e => { e.stopPropagation(); handleEdit(item) }}
                              disabled={loadingEdit}
                              className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 p-2 text-slate-600 transition hover:bg-slate-100 disabled:opacity-50"
                              title={t('pages.foodItems.edit')}
                            >
                              <PencilIcon className="h-4 w-4" />
                            </button>
                            <button
                              onClick={e => { e.stopPropagation(); handleDuplicate(item) }}
                              disabled={loadingEdit}
                              className="inline-flex items-center rounded-full border border-violet-200 bg-violet-50 p-2 text-violet-700 transition hover:bg-violet-100 disabled:opacity-50"
                              title={isRecipeItem(item) ? t('pages.recipes.duplicateRecipe') : t('pages.foodItems.duplicate')}
                            >
                              <DocumentDuplicateIcon className="h-4 w-4" />
                            </button>
                            <button
                              onClick={e => { e.stopPropagation(); handleDelete(item) }}
                              disabled={deleting}
                              className="inline-flex items-center rounded-full border border-rose-200 bg-rose-50 p-2 text-rose-700 transition hover:bg-rose-100 disabled:opacity-50"
                              title={t('pages.searchItems.delete')}
                            >
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* ─── Food Item Modal ─────────────────────────────────────────── */}
      {isFoodModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 px-4 py-6">
          <div className="mx-auto w-full max-w-6xl rounded-[32px] border border-slate-200 bg-[#fcfbff] p-6 shadow-2xl md:p-8">
            <div className="flex flex-col gap-4 border-b border-slate-200 pb-6 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">
                  {t('pages.searchItems.title')}
                </p>
                <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
                  {editingFoodItemId ? t('pages.foodItems.edit') : t('pages.foodItems.create')}
                </h2>
              </div>
              <div className="flex items-center gap-3 self-start">
                <button
                  onClick={() => { resetFoodForm(); setIsFoodModalOpen(false) }}
                  className="rounded-2xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                >
                  {t('pages.recipes.cancel')}
                </button>
                <button
                  onClick={handleFoodSubmit}
                  disabled={foodSubmitting}
                  className="rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:shadow-xl disabled:opacity-50"
                >
                  {foodSubmitting ? t('pages.foodItems.saving') : t('pages.foodItems.save')}
                </button>
                <button
                  onClick={() => { resetFoodForm(); setIsFoodModalOpen(false) }}
                  className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>
            </div>

            <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_360px]">
              <div className="space-y-6">
                {/* Photo */}
                <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="mb-3 flex items-center gap-2">
                    <PhotoIcon className="h-5 w-5 text-violet-500" />
                    <h3 className="text-lg font-semibold text-slate-950">{t('pages.foodItems.photo')}</h3>
                  </div>
                  <input type="file" accept="image/*" onChange={handleFoodPhotoSelect} className="hidden" id="search-food-photo" />
                  <label htmlFor="search-food-photo" className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm font-semibold text-violet-700 transition hover:bg-violet-100">
                    <PhotoIcon className="h-5 w-5" />
                    {foodPhoto || foodPhotoPreview || foodExistingPhotoUrl ? t('pages.recipes.change') : t('pages.foodItems.uploadPhoto')}
                  </label>
                  {foodPhotoPreview && (
                    <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
                      <img src={foodPhotoPreview} alt={foodName || '-'} className="h-52 w-full bg-white object-contain" />
                    </div>
                  )}
                </div>

                {/* Food information */}
                <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="mb-5 flex items-center gap-2">
                    <DocumentTextIcon className="h-5 w-5 text-violet-500" />
                    <h3 className="text-lg font-semibold text-slate-950">{t('pages.foodItems.foodInformation')}</h3>
                  </div>
                  <div className="space-y-5">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <input value={foodName} onChange={e => setFoodName(e.target.value)} placeholder={t('pages.foodItems.name')} className="h-12 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-violet-300" />
                      <input value={foodBrand} onChange={e => setFoodBrand(e.target.value)} placeholder={t('pages.foodItems.brand')} className="h-12 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-violet-300" />
                      <input value={foodBarcode} onChange={e => setFoodBarcode(e.target.value)} placeholder={t('pages.foodItems.barcode')} className="h-12 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-violet-300" />
                      <div className="relative" ref={categoryDropdownRef}>
                        <button
                          type="button"
                          onClick={() => setIsCategoryDropdownOpen(c => !c)}
                          className="flex h-12 w-full items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 outline-none transition hover:border-violet-300 focus:border-violet-300"
                        >
                          <span className="flex min-w-0 items-center gap-3">
                            {foodCategory ? <img src={getCategoryIcon(foodCategory)} alt={formatCategoryLabel(foodCategory)} className="h-6 w-6 shrink-0 object-contain" /> : null}
                            <span className={foodCategory ? 'truncate' : 'truncate text-slate-400'}>
                              {foodCategory ? formatCategoryLabel(foodCategory) : t('pages.foodItems.category')}
                            </span>
                          </span>
                          <ChevronUpDownIcon className="h-5 w-5 shrink-0 text-slate-400" />
                        </button>
                        {isCategoryDropdownOpen && (
                          <div className="absolute left-0 top-full z-20 mt-2 max-h-72 w-full overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
                            <button type="button" onClick={() => { setFoodCategory(''); setIsCategoryDropdownOpen(false) }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-slate-500 transition hover:bg-slate-50">
                              <span>{t('pages.foodItems.category')}</span>
                            </button>
                            {FOOD_CATEGORY_OPTIONS.map(opt => (
                              <button
                                key={opt}
                                type="button"
                                onClick={() => { setFoodCategory(opt); setIsCategoryDropdownOpen(false) }}
                                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition ${foodCategory === opt ? 'bg-violet-50 text-violet-700' : 'text-slate-700 hover:bg-slate-50'}`}
                              >
                                <img src={getCategoryIcon(opt)} alt={formatCategoryLabel(opt)} className="h-6 w-6 shrink-0 object-contain" />
                                <span>{formatCategoryLabel(opt)}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-3">
                      <select value={foodCountryCode} onChange={e => setFoodCountryCode(e.target.value)} className="h-12 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-violet-300">
                        {Object.entries(AVAILABLE_COUNTRY_CODES).map(([k, v]) => (
                          <option key={k} value={v}>{v}</option>
                        ))}
                      </select>
                      <select value={foodUnit} onChange={e => handleFoodUnitChange(e.target.value)} className="h-12 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-violet-300">
                        {foodAvailableUnits.map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                      <input value={foodServingValue} onChange={e => setFoodServingValue(e.target.value)} placeholder={t('pages.foodItems.servingValue')} className="h-12 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-violet-300" />
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <input value={foodServingName} onChange={e => setFoodServingName(e.target.value)} placeholder={t('pages.foodItems.servingName')} className="h-12 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-violet-300" />
                      <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                        <input type="checkbox" checked={foodIsLiquid} onChange={e => setFoodIsLiquid(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500" />
                        <span className="text-sm text-slate-700">{t('pages.foodItems.isLiquid')}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <input type="checkbox" checked={foodIsPublic} onChange={e => setFoodIsPublic(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500" />
                      <span className="text-sm text-slate-700">{t('pages.recipes.publicLabel')}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Nutrition */}
              <div className="space-y-6">
                <div className="rounded-[28px] border border-violet-200 bg-violet-50/70 p-6 shadow-sm">
                  <div className="mb-4 flex items-center gap-2">
                    <DocumentTextIcon className="h-5 w-5 text-violet-500" />
                    <h3 className="text-lg font-semibold text-slate-950">{t('pages.foodItems.nutrition')}</h3>
                  </div>
                  <p className="mb-4 text-sm text-slate-500">
                    {t(foodIsLiquid ? 'pages.foodItems.nutritionPer100ml' : 'pages.foodItems.nutritionPer100g')}
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <input value={foodCalories} onChange={e => setFoodCalories(e.target.value)} placeholder={t('pages.recipes.calories')} className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-violet-300" />
                    <input value={foodProtein} onChange={e => setFoodProtein(e.target.value)} placeholder={t('pages.recipes.protein')} className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-violet-300" />
                    <input value={foodCarbs} onChange={e => setFoodCarbs(e.target.value)} placeholder={t('pages.recipes.carbs')} className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-violet-300" />
                    <input value={foodFat} onChange={e => setFoodFat(e.target.value)} placeholder={t('pages.recipes.fat')} className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-violet-300" />
                    <input value={foodSugar} onChange={e => setFoodSugar(e.target.value)} placeholder={t('pages.foodItems.sugar')} className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-violet-300" />
                    <input value={foodFiber} onChange={e => setFoodFiber(e.target.value)} placeholder={t('pages.foodItems.fiber')} className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-violet-300" />
                    <input value={foodSalt} onChange={e => setFoodSalt(e.target.value)} placeholder={t('pages.foodItems.salt')} className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-violet-300" />
                    <input value={foodSaturatedFat} onChange={e => setFoodSaturatedFat(e.target.value)} placeholder={t('pages.foodItems.saturatedFat')} className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-violet-300" />
                    <input value={foodUnsaturatedFat} onChange={e => setFoodUnsaturatedFat(e.target.value)} placeholder={t('pages.foodItems.unsaturatedFat')} className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-violet-300 sm:col-span-2" />
                  </div>
                  <div className="mt-4 rounded-2xl bg-white p-4 text-sm text-slate-700 shadow-sm">
                    {t('pages.foodItems.displaySummary', {
                      calories: parseNumber(foodCalories),
                      protein: parseNumber(foodProtein),
                      carbs: parseNumber(foodCarbs),
                      fat: parseNumber(foodFat)
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Recipe Modal ────────────────────────────────────────────── */}
      {isRecipeModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 px-4 py-6">
          <div className="mx-auto w-full max-w-7xl rounded-[32px] border border-slate-200 bg-[#fcfbff] p-6 shadow-2xl md:p-8">
            <div className="flex flex-col gap-4 border-b border-slate-200 pb-6 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">
                  {t('pages.searchItems.title')}
                </p>
                <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
                  {editingRecipeId ? t('pages.recipes.editRecipe') : t('pages.recipes.create')}
                </h2>
              </div>
              <div className="flex items-center gap-3 self-start">
                <button
                  onClick={() => { resetRecipeForm(); setIsRecipeModalOpen(false) }}
                  className="rounded-2xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                >
                  {t('pages.recipes.cancel')}
                </button>
                <button
                  onClick={handleRecipeSubmit}
                  disabled={recipeSubmitting || !recipeName.trim() || ingredients.length === 0}
                  className="rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {recipeSubmitting
                    ? (editingRecipeId ? t('pages.recipes.updating') : t('pages.recipes.creating'))
                    : (editingRecipeId ? t('pages.recipes.updateRecipe') : t('pages.recipes.create'))}
                </button>
                <button
                  onClick={() => { resetRecipeForm(); setIsRecipeModalOpen(false) }}
                  className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                >
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1.8fr)_360px]">
              <div className="space-y-6">
                <div className="grid gap-6 lg:grid-cols-[minmax(0,1.55fr)_320px]">

                  {/* Left: photo + recipe info */}
                  <div className="space-y-6">
                    <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                      <div className="mb-4 flex items-center gap-2">
                        <PhotoIcon className="h-5 w-5 text-violet-500" />
                        <h3 className="text-lg font-semibold text-slate-950">{t('pages.recipes.recipePhoto')}</h3>
                      </div>
                      <input type="file" accept="image/*" onChange={handleRecipePhotoSelect} className="hidden" id="search-recipe-photo" />
                      <label htmlFor="search-recipe-photo" className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm font-semibold text-violet-700 transition hover:bg-violet-100">
                        <PhotoIcon className="w-5 h-5" />
                        {recipePhoto || recipePhotoPreview || recipeExistingPhotoUrl ? t('pages.recipes.change') : t('pages.recipes.uploadPhoto')}
                      </label>
                      {recipeUploadingPhoto && <p className="mt-3 text-sm text-slate-500">{t('pages.recipes.uploading')}</p>}
                      <label htmlFor="search-recipe-photo" className="mt-4 block cursor-pointer overflow-hidden rounded-[28px] border border-slate-200 shadow-sm transition hover:border-violet-300">
                        {recipePhotoPreview ? (
                          <img src={recipePhotoPreview} alt={t('pages.recipes.preview')} className="h-[280px] w-full bg-white object-contain" />
                        ) : (
                          <div className="flex h-[280px] items-center justify-center bg-gradient-to-br from-slate-100 via-slate-200 to-slate-300 text-slate-400">
                            <PhotoIcon className="h-16 w-16" />
                          </div>
                        )}
                      </label>
                    </div>

                    <label className="flex items-center gap-3 rounded-[28px] border border-slate-200 bg-white px-5 py-4 text-sm font-medium text-slate-700 shadow-sm">
                      <input type="checkbox" checked={recipeIsPublic} onChange={e => setRecipeIsPublic(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500" />
                      <span>{t('pages.recipes.publicLabel')}</span>
                    </label>
                  </div>

                  {/* Right: details */}
                  <div className="space-y-6">
                    <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                      <div className="mb-5 flex items-center gap-2">
                        <DocumentTextIcon className="h-5 w-5 text-violet-500" />
                        <h3 className="text-lg font-semibold text-slate-950">{t('pages.recipes.recipeInformation')}</h3>
                      </div>
                      <div className="space-y-5">
                        <div>
                          <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{t('pages.recipes.recipeName')}</label>
                          <input type="text" value={recipeName} onChange={e => setRecipeName(e.target.value)} className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 outline-none transition focus:border-violet-300 focus:bg-white" placeholder={t('pages.recipes.enterRecipeName')} />
                        </div>
                        <div className="grid gap-4 sm:grid-cols-3">
                          <div className="flex flex-col">
                            <label className="mb-2 flex min-h-[2.75rem] items-end text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{t('pages.recipes.countryCode')}</label>
                            <select value={recipeCountryCode} onChange={e => setRecipeCountryCode(e.target.value)} className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none transition focus:border-violet-300 focus:bg-white">
                              {Object.entries(AVAILABLE_COUNTRY_CODES).map(([k, v]) => <option key={k} value={v}>{v}</option>)}
                            </select>
                          </div>
                          <div className="flex flex-col">
                            <label className="mb-2 flex min-h-[2.75rem] items-end text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{t('pages.recipes.numberOfServings')}</label>
                            <input type="number" min="1" value={recipeServings} onChange={e => setRecipeServings(e.target.value)} className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none transition focus:border-violet-300 focus:bg-white" />
                          </div>
                          <div className="flex flex-col">
                            <label className="mb-2 flex min-h-[2.75rem] items-end text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{t('pages.recipes.totalTimeMinutes')}</label>
                            <input type="number" min="0" value={recipeTotalTime} onChange={e => setRecipeTotalTime(e.target.value)} className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none transition focus:border-violet-300 focus:bg-white" />
                          </div>
                        </div>
                        <div>
                          <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{t('pages.recipes.recipeInstructionsOnePerLine')}</label>
                          <textarea value={recipeInstructions} onChange={e => setRecipeInstructions(e.target.value)} className="min-h-[200px] w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-violet-300 focus:bg-white" rows="8" placeholder={t('pages.recipes.enterRecipeInstructions')} />
                        </div>
                      </div>
                    </div>

                    {/* Nutrition summary */}
                    <div className="rounded-[28px] border border-violet-200 bg-violet-50/70 p-6 shadow-sm">
                      <div className="mb-4 flex items-center gap-2">
                        <DocumentTextIcon className="h-5 w-5 text-violet-500" />
                        <h3 className="text-lg font-semibold text-slate-950">{t('pages.recipes.totalNutrients')}</h3>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { label: t('pages.recipes.calories'), value: Math.round(recipeTotals.totalCalories), color: 'text-violet-600' },
                          { label: t('pages.recipes.protein'), value: `${recipeTotals.totalProtein.toFixed(1)}g`, color: 'text-slate-900' },
                          { label: t('pages.recipes.carbs'), value: `${recipeTotals.totalCarbs.toFixed(1)}g`, color: 'text-slate-900' },
                          { label: t('pages.recipes.fat'), value: `${recipeTotals.totalFat.toFixed(1)}g`, color: 'text-slate-900' }
                        ].map(({ label, value, color }) => (
                          <div key={label} className="rounded-2xl bg-white p-4 text-center shadow-sm">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</div>
                            <div className={`mt-2 text-3xl font-bold ${color}`}>{value}</div>
                          </div>
                        ))}
                      </div>
                      <div className="mt-4 space-y-2.5">
                        {[
                          { label: t('pages.foodItems.sugar'), value: recipeTotals.totalSugar },
                          { label: t('pages.foodItems.fiber'), value: recipeTotals.totalFiber },
                          { label: t('pages.foodItems.salt'), value: recipeTotals.totalSalt },
                          { label: t('pages.foodItems.saturatedFat'), value: recipeTotals.totalSaturatedFat },
                          { label: t('pages.foodItems.unsaturatedFat'), value: recipeTotals.totalUnSaturatedFat }
                        ].map(({ label, value }) => (
                          <div key={label} className="flex items-center justify-between text-sm">
                            <span className="text-slate-500">{label}</span>
                            <span className="font-semibold text-slate-900">{value.toFixed(1)}g</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Ingredients sidebar */}
              <div className="space-y-6">
                <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <DocumentTextIcon className="h-5 w-5 text-violet-500" />
                      <h3 className="text-lg font-semibold text-slate-950">{t('pages.recipes.selectedIngredients')}</h3>
                    </div>
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">{ingredients.length}</span>
                  </div>

                  {/* Ingredient search */}
                  <div className="mb-4 flex gap-2">
                    <input
                      type="text"
                      value={ingredientSearch}
                      onChange={e => setIngredientSearch(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleIngredientSearch() }}
                      className="flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-violet-300 focus:bg-white"
                      placeholder={t('pages.recipes.searchFoodItems')}
                    />
                    <button
                      onClick={handleIngredientSearch}
                      disabled={ingredientSearching || !ingredientSearch.trim()}
                      className="rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm font-semibold text-violet-700 transition hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {ingredientSearching ? t('pages.recipes.searching') : t('pages.recipes.search')}
                    </button>
                  </div>

                  {ingredientResults.length > 0 && (
                    <div className="mb-5 max-h-56 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50/60">
                      {ingredientResults.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 last:border-b-0">
                          <div>
                            <div className="text-sm font-semibold text-slate-900">{item?.name || item?.title || t('pages.recipes.unnamed')}</div>
                            <div className="mt-1 text-xs text-slate-500">{item?.caloriesPer100 ? `${item.caloriesPer100} cal/100g` : ''}</div>
                          </div>
                          <button onClick={() => addIngredient(item)} className="rounded-full bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-violet-700">
                            {t('pages.recipes.add')}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="space-y-3">
                    {ingredients.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                        {t('pages.recipes.noIngredientsYet')}
                      </div>
                    ) : (
                      ingredients.map((ing, index) => {
                        const unitOptions = getIngredientUnitOptions(ing)
                        return (
                          <div key={index} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                            <div className="mb-3 flex items-start justify-between gap-3">
                              <div>
                                <div className="text-sm font-semibold text-slate-900">{ing.name}</div>
                                <div className="mt-1 text-xs text-slate-500">{ingredientCalories[index] || 0} cal</div>
                              </div>
                              <button onClick={() => removeIngredient(index)} className="rounded-full p-1 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600">
                                <XMarkIcon className="w-4 h-4" />
                              </button>
                            </div>
                            <div className="grid grid-cols-[minmax(0,1fr)_120px] gap-2">
                              <input
                                type="number" step="any" min="0"
                                value={ing.weight}
                                onChange={e => updateIngredientWeight(index, e.target.value)}
                                className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-violet-300"
                                placeholder={t('pages.recipes.quantity')}
                              />
                              <select
                                value={ing.unit}
                                onChange={e => updateIngredientUnit(index, e.target.value)}
                                className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-violet-300"
                              >
                                {unitOptions.length === 0 ? (
                                  <option value={ing.unit || 'g'}>{ing.unit || 'g'}</option>
                                ) : (
                                  unitOptions.map(u => <option key={u} value={u}>{u}</option>)
                                )}
                              </select>
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* ─── Detail View Modal ──────────────────────────────────────── */}
      {isDetailModalOpen && detailItem && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 px-4 py-6"
          onClick={() => { setIsDetailModalOpen(false); setDetailItem(null) }}
        >
          <div
            className="mx-auto w-full max-w-4xl rounded-[32px] border border-slate-200 bg-[#fcfbff] p-6 shadow-2xl md:p-8"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="mb-6 flex items-start justify-between gap-4 border-b border-slate-200 pb-5">
              <div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${isRecipeItem(detailItem) ? 'bg-fuchsia-50 text-fuchsia-700' : 'bg-blue-50 text-blue-700'}`}>
                  {isRecipeItem(detailItem) ? t('pages.searchItems.typeRecipe') : t('pages.searchItems.typeFood')}
                </span>
                <h2 className="mt-3 text-2xl font-bold text-slate-950">{detailItem.name}</h2>
                {detailItem.brand && <p className="mt-1 text-sm text-slate-500">{detailItem.brand}</p>}
              </div>
              <button
                onClick={() => { setIsDetailModalOpen(false); setDetailItem(null) }}
                className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            {loadingDetail && (
              <div className="mb-6 rounded-2xl bg-violet-50 px-5 py-3 text-center text-sm text-violet-700">
                {t('pages.searchItems.loadingItem')}
              </div>
            )}

            <div className="grid gap-6 md:grid-cols-[260px_minmax(0,1fr)]">
              {/* Left: photo + meta */}
              <div className="space-y-4">
                {(detailItem.brandPhotoUrl || detailItem.photoUrl) && (
                  <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white">
                    <img
                      src={detailItem.brandPhotoUrl || detailItem.photoUrl}
                      alt={detailItem.name}
                      className="h-56 w-full object-contain"
                    />
                  </div>
                )}
                <div className="rounded-[24px] border border-slate-200 bg-white p-4 text-sm space-y-3">
                  {detailItem.countryCode && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">{t('pages.recipes.country')}</span>
                      <span className="font-semibold text-slate-900">{detailItem.countryCode}</span>
                    </div>
                  )}
                  {!isRecipeItem(detailItem) && detailItem.category && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">{t('pages.foodItems.category')}</span>
                      <span className="font-semibold text-slate-900">{formatCategoryLabel(detailItem.category)}</span>
                    </div>
                  )}
                  {!isRecipeItem(detailItem) && detailItem.barcode && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">{t('pages.foodItems.barcode')}</span>
                      <span className="font-mono text-xs font-semibold text-slate-900">{detailItem.barcode}</span>
                    </div>
                  )}
                  {isRecipeItem(detailItem) && detailItem.totalTimeInMinutes > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">{t('pages.recipes.totalTimeMinutes')}</span>
                      <span className="font-semibold text-slate-900">{detailItem.totalTimeInMinutes} min</span>
                    </div>
                  )}
                  {isRecipeItem(detailItem) && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">{t('pages.recipes.numberOfServings')}</span>
                      <span className="font-semibold text-slate-900">{detailItem.numberOfRecipeServings || 1}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">{t('pages.recipes.publicLabel')}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${detailItem.isPublic ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'}`}>
                      {detailItem.isPublic ? t('pages.recipes.public') : t('pages.recipes.private')}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">{t('pages.recipes.verified')}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${detailItem.isVerified ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-700'}`}>
                      {detailItem.isVerified ? t('pages.recipes.verified') : t('pages.recipes.unverified')}
                    </span>
                  </div>
                  {detailItem.createdByUserId && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">{t('pages.searchItems.createdBy')}</span>
                      <span className="max-w-[140px] truncate text-slate-600">{detailItem.createdByUserId}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Right: main content */}
              <div className="space-y-4">
                {isRecipeItem(detailItem) ? (
                  <>
                    {/* Ingredients */}
                    <div className="rounded-[24px] border border-slate-200 bg-white p-5">
                      <h3 className="mb-4 text-base font-semibold text-slate-900">
                        {t('pages.recipes.ingredients')} ({(detailItem.ingredients || []).length})
                      </h3>
                      {(detailItem.ingredients || []).length === 0 ? (
                        <p className="text-sm text-slate-400">{t('pages.searchItems.noIngredients')}</p>
                      ) : (
                        <div className="divide-y divide-slate-100">
                          {(detailItem.ingredients || []).map((ing, idx) => {
                            const cal = Math.round((parseNumber(ing.caloriesPer100) * parseNumber(ing.quantity ?? ing.weight ?? 100)) / 100)
                            return (
                              <div key={idx} className="flex items-center justify-between py-2.5">
                                <div>
                                  <div className="text-sm font-medium text-slate-900">{ing.name}</div>
                                  {ing.category && <div className="mt-0.5 text-xs text-slate-400">{ing.category}</div>}
                                </div>
                                <div className="text-right">
                                  <div className="text-sm text-slate-700">{ing.quantity ?? ing.weight ?? 0} {ing.unit || 'g'}</div>
                                  <div className="text-xs text-slate-400">{cal} cal</div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>

                    {/* Instructions */}
                    {detailItem.recipeSteps?.instructions?.length > 0 && (
                      <div className="rounded-[24px] border border-slate-200 bg-white p-5">
                        <h3 className="mb-4 text-base font-semibold text-slate-900">{t('pages.searchItems.instructions')}</h3>
                        <ol className="space-y-3">
                          {detailItem.recipeSteps.instructions.map((step, idx) => (
                            <li key={idx} className="flex gap-3 text-sm">
                              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs font-semibold text-violet-700">
                                {idx + 1}
                              </span>
                              <span className="text-slate-700">{step}</span>
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}

                    {/* Recipe nutrition totals */}
                    {(() => {
                      const totals = calculateRecipeNutrients(detailItem.ingredients || [])
                      return (
                        <div className="rounded-[24px] border border-violet-200 bg-violet-50/70 p-5">
                          <h3 className="mb-4 text-base font-semibold text-slate-900">{t('pages.recipes.totalNutrients')}</h3>
                          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                            {[
                              { label: t('pages.recipes.calories'), value: `${Math.round(totals.totalCalories)} kcal`, color: 'text-violet-700' },
                              { label: t('pages.recipes.protein'), value: `${totals.totalProtein.toFixed(1)}g` },
                              { label: t('pages.recipes.carbs'), value: `${totals.totalCarbs.toFixed(1)}g` },
                              { label: t('pages.recipes.fat'), value: `${totals.totalFat.toFixed(1)}g` }
                            ].map(({ label, value, color }) => (
                              <div key={label} className="rounded-2xl bg-white p-3 text-center shadow-sm">
                                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</div>
                                <div className={`mt-1.5 text-lg font-bold ${color || 'text-slate-900'}`}>{value}</div>
                              </div>
                            ))}
                          </div>
                          <div className="mt-3 space-y-2">
                            {[
                              { label: t('pages.foodItems.sugar'), value: totals.totalSugar },
                              { label: t('pages.foodItems.fiber'), value: totals.totalFiber },
                              { label: t('pages.foodItems.salt'), value: totals.totalSalt },
                              { label: t('pages.foodItems.saturatedFat'), value: totals.totalSaturatedFat },
                              { label: t('pages.foodItems.unsaturatedFat'), value: totals.totalUnSaturatedFat }
                            ].map(({ label, value }) => (
                              <div key={label} className="flex items-center justify-between text-sm">
                                <span className="text-slate-500">{label}</span>
                                <span className="font-semibold text-slate-900">{value.toFixed(1)}g</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    })()}
                  </>
                ) : (
                  <>
                    {/* Food nutrition */}
                    {(() => {
                      const n = parseNutrients(detailItem.nutrientsPer100)
                      const cal = parseNumber(detailItem.caloriesPer100)
                      const isLiquid = Boolean(detailItem.isLiquid)
                      return (
                        <div className="rounded-[24px] border border-violet-200 bg-violet-50/70 p-5">
                          <h3 className="mb-1 text-base font-semibold text-slate-900">{t('pages.foodItems.nutrition')}</h3>
                          <p className="mb-4 text-xs text-slate-500">
                            {t(isLiquid ? 'pages.foodItems.nutritionPer100ml' : 'pages.foodItems.nutritionPer100g')}
                          </p>
                          <div className="space-y-2.5">
                            {[
                              { label: t('pages.recipes.calories'), value: `${Math.round(cal)} kcal` },
                              { label: t('pages.recipes.protein'), value: `${parseNumber(n.proteinsInGrams).toFixed(1)}g` },
                              { label: t('pages.recipes.carbs'), value: `${parseNumber(n.carbohydratesInGrams).toFixed(1)}g` },
                              { label: t('pages.recipes.fat'), value: `${parseNumber(n.fatInGrams).toFixed(1)}g` },
                              n.sugarsInGrams != null ? { label: t('pages.foodItems.sugar'), value: `${parseNumber(n.sugarsInGrams).toFixed(1)}g` } : null,
                              n.fibreInGrams != null ? { label: t('pages.foodItems.fiber'), value: `${parseNumber(n.fibreInGrams).toFixed(1)}g` } : null,
                              n.saltInGrams != null ? { label: t('pages.foodItems.salt'), value: `${parseNumber(n.saltInGrams).toFixed(1)}g` } : null,
                              n.fattyAcidsTotalSaturatedInGrams != null ? { label: t('pages.foodItems.saturatedFat'), value: `${parseNumber(n.fattyAcidsTotalSaturatedInGrams).toFixed(1)}g` } : null,
                              n.fattyAcidsTotalUnSaturatedInGrams != null ? { label: t('pages.foodItems.unsaturatedFat'), value: `${parseNumber(n.fattyAcidsTotalUnSaturatedInGrams).toFixed(1)}g` } : null,
                            ].filter(Boolean).map(({ label, value }) => (
                              <div key={label} className="flex items-center justify-between text-sm">
                                <span className="text-slate-500">{label}</span>
                                <span className="font-semibold text-slate-900">{value}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    })()}

                    {/* Serving options */}
                    {(() => {
                      const servingOptions = parseServingOptions(detailItem.servingOptions)
                      if (servingOptions.length === 0) return null
                      return (
                        <div className="rounded-[24px] border border-slate-200 bg-white p-5">
                          <h3 className="mb-4 text-base font-semibold text-slate-900">{t('pages.recipes.servingOptions')}</h3>
                          <div className="grid grid-cols-2 gap-3">
                            {servingOptions.map((s, idx) => (
                              <div key={idx} className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-center">
                                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">{t('pages.recipes.unit')}</div>
                                <div className="mt-1 text-sm font-semibold text-slate-900">{s.unitName}</div>
                                <div className="mt-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">{t('pages.recipes.value')}</div>
                                <div className="mt-1 text-lg font-bold text-slate-900">{s.value}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    })()}
                  </>
                )}
              </div>
            </div>

            <div className="mt-6 flex justify-end border-t border-slate-200 pt-5">
              <button
                onClick={() => { setIsDetailModalOpen(false); setDetailItem(null) }}
                className="rounded-2xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                {t('pages.recipes.close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default SearchItems
