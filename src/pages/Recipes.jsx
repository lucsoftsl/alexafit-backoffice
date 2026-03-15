import { useState, useEffect, useMemo, useRef } from 'react'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import {
  MagnifyingGlassIcon,
  PlusIcon,
  XMarkIcon,
  PhotoIcon,
  PencilIcon,
  TrashIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  FunnelIcon,
  CheckBadgeIcon,
  GlobeAltIcon,
  DocumentTextIcon
} from '@heroicons/react/24/outline'
import {
  getRecipesByCountryCode,
  getNutritionistRecipesByCountryCode,
  searchFoodItems,
  getItemsByIds,
  addItem,
  addNutritionistRecipe,
  updateItem,
  updateNutritionistRecipe,
  deleteItem,
  deleteNutritionistRecipe,
  addPhotoToItem,
  saveImageToImgb,
  setItemVerifiedStatus
} from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import { selectIsAdmin } from '../store/userSlice'
import LZString from 'lz-string'
import { getImagePreviewDataUrl, resizeImageFile } from '../util/resizeImageFile'
import { useSelectedCountry } from '../util/useSelectedCountry'

const AVAILABLE_COUNTRY_CODES = {
  ES: 'ES',
  GB: 'GB',
  HU: 'HU',
  IT: 'IT',
  RO: 'RO',
  UK: 'UK',
  US: 'US'
}
const ADMIN_USER_ID = 'BACKOFFICE_ADMIN'
const DEFAULT_SERVING_OPTIONS = [
  { unitName: 'g', value: 100 },
  { unitName: 'oz', value: 28.34 },
  { unitName: 'ml', value: 100 },
  { unitName: 'fl oz', value: 29.57 }
]
const RECIPE_DRAFT_STORAGE_KEY = 'recipeDraft'
const OZ_TO_GRAMS = 28.34
const FL_OZ_TO_ML = 29.57
const parseNumber = value => {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}
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
const isTruthyFlag = value =>
  value === true || value === 1 || value === '1' || value === 'true'
const isFalsyFlag = value =>
  value === false || value === 0 || value === '0' || value === 'false'
const shouldHideLowQualitySearchItem = item =>
  isTruthyFlag(item?.isAIGenerated) && isFalsyFlag(item?.isVerified)
const normalizeUnitName = unit =>
  (unit || '')
    .toString()
    .trim()
    .toLowerCase()

const getIngredientUnitOptions = ingredient => {
  const isLiquid = ingredient?.isLiquid === true || ingredient?.isLiquid === '1'
  const customOptions = parseServingOptions(ingredient?.servingOptions)
  const defaults = DEFAULT_SERVING_OPTIONS.filter(option =>
    isLiquid
      ? option.unitName === 'ml' || option.unitName === 'fl oz'
      : option.unitName === 'g' || option.unitName === 'oz'
  )
  const baseOptions = [...customOptions, ...defaults]
  const options = []
  const seen = new Set()

  baseOptions.forEach(option => {
    const unitName = (option?.unitName || '').toString().trim()
    if (!unitName) return
    const key = normalizeUnitName(unitName)
    if (seen.has(key)) return
    seen.add(key)
    options.push(unitName)
  })

  const selectedUnit = (ingredient?.unit || '').toString().trim()
  if (selectedUnit) {
    const key = normalizeUnitName(selectedUnit)
    if (!seen.has(key)) options.unshift(selectedUnit)
  }

  return options
}

const getAmountFromBaseUnit = (item, baseAmount, unit) => {
  const normalizedUnit = (unit || 'g').toLowerCase().trim()
  const amount = parseNumber(baseAmount)
  const isLiquid = item?.isLiquid === true || item?.isLiquid === '1'

  if (normalizedUnit === 'g' || normalizedUnit === 'gram' || normalizedUnit === 'grams') {
    return amount
  }
  if (normalizedUnit === 'kg') return amount / 1000
  if (normalizedUnit === 'oz') return amount / OZ_TO_GRAMS
  if (normalizedUnit === 'ml' || normalizedUnit === 'milliliter' || normalizedUnit === 'millilitre') {
    return amount
  }
  if (normalizedUnit === 'fl oz') return amount / FL_OZ_TO_ML
  if (normalizedUnit === 'l') return amount / 1000

  const customOptions = Array.isArray(item?.servingOptions) ? item.servingOptions : []
  const defaults = DEFAULT_SERVING_OPTIONS.filter(option =>
    isLiquid
      ? option.unitName === 'ml' || option.unitName === 'fl oz'
      : option.unitName === 'g' || option.unitName === 'oz'
  )
  const allOptions = [...customOptions]
  defaults.forEach(defaultOption => {
    if (!allOptions.some(o => o?.unitName === defaultOption.unitName)) {
      allOptions.push(defaultOption)
    }
  })
  const selectedOption = allOptions.find(option => {
    const optionUnit = (option?.unitName || '').toLowerCase()
    return optionUnit === normalizedUnit || optionUnit.includes(normalizedUnit)
  })
  if (!selectedOption) return amount
  return amount / parseNumber(selectedOption.value || 1)
}

const Recipes = ({ mode = 'admin' }) => {
  const { t } = useTranslation()
  const { currentUser } = useAuth()
  const [sharedCountry, setSharedCountry] = useSelectedCountry()
  const glassCardClass =
    'relative overflow-hidden rounded-3xl border border-white/40 bg-white/75 backdrop-blur-xl shadow-[0_20px_80px_rgba(15,23,42,0.08)]'
  const isNutritionistMode = mode === 'nutritionist'
  const [recipeItems, setRecipeItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterCountryCode, setFilterCountryCode] = useState(sharedCountry)
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(25)
  const [sortColumn, setSortColumn] = useState(null)
  const [sortDirection, setSortDirection] = useState('asc')
  const [columnFilters, setColumnFilters] = useState({
    name: '',
    type: 'all',
    country: 'all',
    caloriesMin: '',
    caloriesMax: '',
    servingsMin: '',
    servingsMax: '',
    public: 'all',
    verified: 'all'
  })
  const [openColumnFilter, setOpenColumnFilter] = useState(null)
  const columnFilterRef = useRef(null)
  const isAdmin = useSelector(selectIsAdmin)

  // For recipe creation/editing modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [editingRecipeId, setEditingRecipeId] = useState(null)
  const [editingUserId, setEditingUserId] = useState(null)
  const [recipeName, setRecipeName] = useState('')
  const [selectedCountryCode, setSelectedCountryCode] = useState(sharedCountry)
  const [isRecipePublic, setIsRecipePublic] = useState(true)

  const [searchText, setSearchText] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchResults, setSearchResults] = useState([])
  const [selectedIngredients, setSelectedIngredients] = useState([])
  const [recipeInstructions, setRecipeInstructions] = useState('')
  const [totalTimeInMinutes, setTotalTimeInMinutes] = useState('')
  const [numberOfRecipeServings, setNumberOfRecipeServings] = useState(1)
  const [selectedPhoto, setSelectedPhoto] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [existingPhotoUrl, setExistingPhotoUrl] = useState(null)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [loadingEdit, setLoadingEdit] = useState(false)

  // For image modal
  const [selectedImage, setSelectedImage] = useState(null)
  const [isImageModalOpen, setIsImageModalOpen] = useState(false)

  // For ingredient detail modal
  const [selectedIngredientsView, setSelectedIngredientsView] = useState(null)
  const [isIngredientsModalOpen, setIsIngredientsModalOpen] = useState(false)
  const [selectedServingsView, setSelectedServingsView] = useState([])
  const [isServingsModalOpen, setIsServingsModalOpen] = useState(false)

  const loadRecipeDraft = () => {
    try {
      const cachedDraft =
        LZString.decompressFromUTF16(
          localStorage.getItem(RECIPE_DRAFT_STORAGE_KEY)
        ) || localStorage.getItem(RECIPE_DRAFT_STORAGE_KEY)

      if (!cachedDraft) return false

      const draft = JSON.parse(cachedDraft)
      setRecipeName(draft.recipeName || '')
      setSelectedCountryCode(draft.selectedCountryCode || sharedCountry)
      setSelectedIngredients(
        Array.isArray(draft.selectedIngredients) ? draft.selectedIngredients : []
      )
      setRecipeInstructions(draft.recipeInstructions || '')
      setTotalTimeInMinutes(draft.totalTimeInMinutes || '')
      setNumberOfRecipeServings(draft.numberOfRecipeServings || 1)
      setIsRecipePublic(
        draft.isRecipePublic === undefined ? true : Boolean(draft.isRecipePublic)
      )
      setSelectedPhoto(null)
      setPhotoPreview(draft.photoPreview || null)
      setExistingPhotoUrl(draft.existingPhotoUrl || null)
      setSearchText('')
      setSearchResults([])
      return true
    } catch (draftError) {
      console.error('Failed to load recipe draft', draftError)
      return false
    }
  }

  const clearRecipeDraft = () => {
    localStorage.removeItem(RECIPE_DRAFT_STORAGE_KEY)
  }

  const handleSaveRecipeDraft = () => {
    try {
      const draft = {
        recipeName,
        selectedCountryCode,
        selectedIngredients,
        recipeInstructions,
        totalTimeInMinutes,
        numberOfRecipeServings,
        isRecipePublic,
        photoPreview,
        existingPhotoUrl
      }
      const compressed = LZString.compressToUTF16(JSON.stringify(draft))
      localStorage.setItem(RECIPE_DRAFT_STORAGE_KEY, compressed)
      alert(t('pages.recipes.draftSaved'))
    } catch (draftError) {
      console.error('Failed to save recipe draft', draftError)
      alert(t('pages.recipes.draftSaveFailed'))
    }
  }

  useEffect(() => {
    const loadRecipes = async () => {
      if (!isAdmin && !isNutritionistMode) {
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setError(null)

        // Check if data exists in localStorage first (cached by country code)
        const cacheKey = `recipes_${mode}_${filterCountryCode}`
        const cachedData =
          LZString.decompressFromUTF16(localStorage.getItem(cacheKey)) ||
          localStorage.getItem(cacheKey)

        if (cachedData) {
          const data = JSON.parse(cachedData)
          setRecipeItems(data.items || [])
          setLoading(false)
          console.log('Loaded from cache')
        } else {
          refreshData()
        }
      } catch (err) {
        console.error('Error loading recipes:', err)
        setError(t('pages.recipes.loadRecipesTryAgain'))
        setLoading(false)
      }
    }
    loadRecipes()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterCountryCode, isAdmin, isNutritionistMode, mode])

  useEffect(() => {
    setFilterCountryCode(sharedCountry)
    setSelectedCountryCode(sharedCountry)
  }, [sharedCountry])

  // Reset to page 1 when switching country code or changing search term
  useEffect(() => {
    setCurrentPage(1)
  }, [filterCountryCode, searchTerm])

  useEffect(() => {
    if (!openColumnFilter) return undefined

    const handleOutsideClick = event => {
      if (!columnFilterRef.current?.contains(event.target)) {
        setOpenColumnFilter(null)
      }
    }

    document.addEventListener('mousedown', handleOutsideClick)
    document.addEventListener('touchstart', handleOutsideClick)
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
      document.removeEventListener('touchstart', handleOutsideClick)
    }
  }, [openColumnFilter])

  const refreshData = async () => {
    setError(null)
    setRecipeItems([])

    // Clear cache for current country code
    const cacheKey = `recipes_${mode}_${filterCountryCode}`
    localStorage.removeItem(cacheKey)

    setLoading(true)
    try {
      console.log('Fetching from API...')

      const data = isNutritionistMode
        ? await getNutritionistRecipesByCountryCode({
            countryCode: filterCountryCode
          })
        : await getRecipesByCountryCode({
            countryCode: filterCountryCode
          })
      const items = data || []

      // Cache the data by country code
      const compressed = LZString.compressToUTF16(JSON.stringify({ items }))
      localStorage.setItem(cacheKey, compressed)

      setLoading(false)
      setRecipeItems(items)

      console.log('Loaded from API and cached')
    } catch (err) {
      console.error('Error refreshing data:', err)
      setError(t('pages.recipes.failedRefreshData'))
      setLoading(false)
    }
  }

  // Handle sorting
  const handleSort = column => {
    if (sortColumn === column) {
      // Toggle direction if same column
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      // Set new column and default to ascending
      setSortColumn(column)
      setSortDirection('asc')
    }
  }

  // Filter items based on search term (country code is already filtered by API)
  // Search only filters the current fetched list, no API calls
  const filteredRecipes = useMemo(() => {
    let filtered = recipeItems
    if (searchTerm.trim()) {
      filtered = recipeItems.filter(
        item =>
          item.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.category?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    filtered = filtered.filter(item => {
      const matchesName =
        !columnFilters.name.trim() ||
        String(item?.name || '')
          .toLowerCase()
          .includes(columnFilters.name.toLowerCase())
      const matchesType =
        columnFilters.type === 'all' ||
        String(item?.type || '').toLowerCase() === columnFilters.type.toLowerCase()
      const matchesCountry =
        columnFilters.country === 'all' ||
        String(item?.countryCode || '').toUpperCase() === columnFilters.country
      const calories = parseNumber(item?.caloriesPer100)
      const servings = parseNumber(item?.numberOfRecipeServings)
      const matchesCaloriesMin =
        columnFilters.caloriesMin === '' || calories >= parseNumber(columnFilters.caloriesMin)
      const matchesCaloriesMax =
        columnFilters.caloriesMax === '' || calories <= parseNumber(columnFilters.caloriesMax)
      const matchesServingsMin =
        columnFilters.servingsMin === '' || servings >= parseNumber(columnFilters.servingsMin)
      const matchesServingsMax =
        columnFilters.servingsMax === '' || servings <= parseNumber(columnFilters.servingsMax)
      const matchesPublic =
        columnFilters.public === 'all' ||
        String(Boolean(item?.isPublic)) === columnFilters.public
      const matchesVerified =
        columnFilters.verified === 'all' ||
        String(Boolean(item?.isVerified)) === columnFilters.verified

      return (
        matchesName &&
        matchesType &&
        matchesCountry &&
        matchesCaloriesMin &&
        matchesCaloriesMax &&
        matchesServingsMin &&
        matchesServingsMax &&
        matchesPublic &&
        matchesVerified
      )
    })

    // Apply sorting
    if (sortColumn) {
      const sorted = [...filtered].sort((a, b) => {
        let aValue, bValue
        const factor = sortDirection === 'asc' ? 1 : -1

        switch (sortColumn) {
          case 'name':
            aValue = (a.name || '').toLowerCase()
            bValue = (b.name || '').toLowerCase()
            return aValue.localeCompare(bValue) * factor
          case 'calories':
            aValue = parseFloat(a.caloriesPer100) || 0
            bValue = parseFloat(b.caloriesPer100) || 0
            return (aValue - bValue) * factor
          case 'type':
            aValue = (a.type || '').toLowerCase()
            bValue = (b.type || '').toLowerCase()
            return aValue.localeCompare(bValue) * factor
          case 'country':
            aValue = (a.countryCode || '').toLowerCase()
            bValue = (b.countryCode || '').toLowerCase()
            return aValue.localeCompare(bValue) * factor
          case 'servings':
            aValue = parseFloat(a.numberOfRecipeServings) || 0
            bValue = parseFloat(b.numberOfRecipeServings) || 0
            return (aValue - bValue) * factor
          case 'isPublic':
            aValue = a.isPublic === true ? 1 : a.isPublic === false ? 0 : -1
            bValue = b.isPublic === true ? 1 : b.isPublic === false ? 0 : -1
            return (aValue - bValue) * factor
          case 'isVerified':
            aValue = a.isVerified === true ? 1 : a.isVerified === false ? 0 : -1
            bValue = b.isVerified === true ? 1 : b.isVerified === false ? 0 : -1
            return (aValue - bValue) * factor
          case 'dateTimeUpdated':
            aValue = a.dateTimeUpdated ? new Date(a.dateTimeUpdated).getTime() : 0
            bValue = b.dateTimeUpdated ? new Date(b.dateTimeUpdated).getTime() : 0
            return (aValue - bValue) * factor
          default:
            return 0
        }
      })
      return sorted
    }

    return filtered
  }, [recipeItems, searchTerm, sortColumn, sortDirection, columnFilters])

  // Pagination logic
  const getCurrentItems = () => {
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    return filteredRecipes.slice(startIndex, endIndex)
  }

  const getTotalPages = () => {
    return Math.ceil(filteredRecipes.length / itemsPerPage)
  }

  const handleShowImage = imageUrl => {
    setSelectedImage(imageUrl)
    setIsImageModalOpen(true)
  }

  const handleShowIngredients = ingredients => {
    setSelectedIngredientsView(ingredients)
    setIsIngredientsModalOpen(true)
  }

  const handleShowServings = servingOptions => {
    setSelectedServingsView(parseServingOptions(servingOptions))
    setIsServingsModalOpen(true)
  }

  const handleSearch = async () => {
    if (!searchText.trim()) return
    try {
      setSearching(true)
      setError(null)
      // Search with onlyRecipes = false
      const results = await searchFoodItems({
        searchText,
        userId: currentUser?.uid || ADMIN_USER_ID,
        onlyRecipes: false,
        countryCode: selectedCountryCode
      })
      // Filter out type = 'recipes', keep only type = 'food'
      const foodItems = results.filter(item => {
        const itemType = (item?.itemType || item?.type || '')
          .toString()
          .toLowerCase()
        return (
          itemType === 'food' &&
          itemType !== 'recipe' &&
          itemType !== 'recipes' &&
          !shouldHideLowQualitySearchItem(item)
        )
      })
      setSearchResults(foodItems)
    } catch (e) {
      console.error('Search failed', e)
      setError(t('pages.recipes.failedSearchItems'))
    } finally {
      setSearching(false)
    }
  }

  const addIngredientToRecipe = item => {
    const servingOptions = parseServingOptions(item.servingOptions)
    const isLiquid = item?.isLiquid === true || item?.isLiquid === '1'
    const defaultUnit =
      servingOptions.find(option => option?.unitName)?.unitName ||
      (isLiquid ? 'ml' : 'g')
    const ingredient = {
      id: item.id || item.itemId || item._id,
      name: item.name || item.title || 'Unnamed',
      quantity: 100,
      weight: 100,
      unit: defaultUnit,
      category: item.category || null,
      caloriesPer100: parseNumber(item.caloriesPer100),
      nutrientsPer100: parseNutrients(item.nutrientsPer100),
      isLiquid,
      servingOptions
    }
    setSelectedIngredients([...selectedIngredients, ingredient])
    setSearchText('')
    setSearchResults([])
  }

  const removeIngredient = index => {
    setSelectedIngredients(selectedIngredients.filter((_, i) => i !== index))
  }

  const getAmountInBaseUnit = (item, quantity, unit) => {
    const qty = parseNumber(quantity)
    const normalizedUnit = (unit || 'g').toLowerCase().trim()
    const isLiquid = item?.isLiquid === true || item?.isLiquid === '1'

    if (normalizedUnit === 'g' || normalizedUnit === 'gram') return qty
    if (normalizedUnit === 'grams') return qty
    if (normalizedUnit === 'kg') return qty * 1000
    if (normalizedUnit === 'oz') return qty * OZ_TO_GRAMS
    if (normalizedUnit === 'ml' || normalizedUnit === 'milliliter') return qty
    if (normalizedUnit === 'millilitre') return qty
    if (normalizedUnit === 'fl oz') return qty * FL_OZ_TO_ML
    if (normalizedUnit === 'l') return qty * 1000

    const customOptions = Array.isArray(item?.servingOptions)
      ? item.servingOptions
      : []
    const defaults = DEFAULT_SERVING_OPTIONS.filter(option =>
      isLiquid
        ? option.unitName === 'ml' || option.unitName === 'fl oz'
        : option.unitName === 'g' || option.unitName === 'oz'
    )
    const allOptions = [...customOptions]
    defaults.forEach(defaultOption => {
      if (!allOptions.some(o => o?.unitName === defaultOption.unitName)) {
        allOptions.push(defaultOption)
      }
    })
    const selectedOption = allOptions.find(option => {
      const optionUnit = (option?.unitName || '').toLowerCase()
      return optionUnit === normalizedUnit || optionUnit.includes(normalizedUnit)
    })
    if (!selectedOption) return qty
    return qty * parseNumber(selectedOption.value || 1)
  }

  const updateIngredientWeight = (index, weight) => {
    const updated = [...selectedIngredients]
    const ingredient = updated[index]
    const nextValue = weight === '' ? '' : weight
    ingredient.weight = nextValue
    ingredient.quantity = nextValue

    setSelectedIngredients(updated)
  }

  const updateIngredientUnit = (index, unit) => {
    const updated = [...selectedIngredients]
    const ingredient = updated[index]
    const currentQuantity = ingredient.quantity ?? ingredient.weight
    const currentBaseAmount = getAmountInBaseUnit(
      ingredient,
      currentQuantity,
      ingredient.unit || 'g'
    )

    ingredient.unit = unit
    const nextQuantity = getAmountFromBaseUnit(ingredient, currentBaseAmount, unit)
    ingredient.quantity = Number(nextQuantity.toFixed(2))
    ingredient.weight = Number(nextQuantity.toFixed(2))
    setSelectedIngredients(updated)
  }

  const calculateNutrients = ingredients => {
    const totalNutrs = ingredients.reduce(
      (acc, ingredient) => {
        const amountInBaseUnit = getAmountInBaseUnit(
          ingredient,
          ingredient.quantity ?? ingredient.weight,
          ingredient.unit || 'g'
        )
        const nutrientsPer100 = parseNutrients(ingredient?.nutrientsPer100)
        const totalCalories =
          acc.totalCalories +
          (parseNumber(ingredient?.caloriesPer100) * amountInBaseUnit) / 100
        const totalQuantity = acc.totalQuantity + amountInBaseUnit

        const totalProtein =
          acc.totalProtein +
          (amountInBaseUnit * parseNumber(nutrientsPer100.proteinsInGrams)) /
            100
        const totalCarbs =
          acc.totalCarbs +
          (amountInBaseUnit *
            parseNumber(nutrientsPer100.carbohydratesInGrams)) /
            100
        const totalFat =
          acc.totalFat + (amountInBaseUnit * parseNumber(nutrientsPer100.fatInGrams)) / 100
        const totalFiber =
          acc.totalFiber +
          (amountInBaseUnit * parseNumber(nutrientsPer100.fibreInGrams)) / 100
        const totalSaturatedFat =
          acc.totalSaturatedFat +
          (amountInBaseUnit *
            parseNumber(nutrientsPer100.fattyAcidsTotalSaturatedInGrams)) /
            100
        const totalUnSaturatedFat =
          acc.totalUnSaturatedFat +
          (amountInBaseUnit *
            parseNumber(nutrientsPer100.fattyAcidsTotalUnSaturatedInGrams)) /
            100
        const totalSugar =
          acc.totalSugar +
          (amountInBaseUnit * parseNumber(nutrientsPer100.sugarsInGrams)) / 100

        const totalSalt =
          acc.totalSalt + (amountInBaseUnit * parseNumber(nutrientsPer100.saltInGrams)) / 100

        return {
          totalCalories,
          totalQuantity,
          totalProtein,
          totalCarbs,
          totalFat,
          totalFiber,
          totalSaturatedFat,
          totalUnSaturatedFat,
          totalSugar,
          totalSalt
        }
      },
      {
        totalCalories: 0,
        totalQuantity: 0,
        totalProtein: 0,
        totalCarbs: 0,
        totalFat: 0,
        totalFiber: 0,
        totalSaturatedFat: 0,
        totalUnSaturatedFat: 0,
        totalSugar: 0,
        totalSalt: 0
      }
    )
    return totalNutrs
  }

  const selectedIngredientsTotals = useMemo(
    () => calculateNutrients(selectedIngredients),
    [selectedIngredients]
  )

  const ingredientCalories = useMemo(
    () =>
      selectedIngredients.map(ingredient => {
        const amountInBaseUnit = getAmountInBaseUnit(
          ingredient,
          ingredient.quantity ?? ingredient.weight,
          ingredient.unit || 'g'
        )
        return Math.round(
          (parseNumber(ingredient?.caloriesPer100) * amountInBaseUnit) / 100
        )
      }),
    [selectedIngredients]
  )

  const generateDefaultServings = (totalWeightInGrams, numServings) => {
    const totalWeight = parseNumber(totalWeightInGrams) || 1
    const servings = parseNumber(numServings) || 1
    const value = totalWeight / servings
    return [{ unitName: 'serving', value }]
  }

  const handlePhotoSelect = async e => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const resizedFile = await resizeImageFile(file, {
        maxWidth: 300,
        maxHeight: 400
      })
      setSelectedPhoto(resizedFile)
      setPhotoPreview(await getImagePreviewDataUrl(resizedFile))
    } catch (photoError) {
      console.error('Failed to prepare recipe photo', photoError)
    } finally {
      e.target.value = ''
    }
  }

  const resetForm = () => {
    setRecipeName('')
    setSelectedCountryCode(sharedCountry)
    setIsRecipePublic(true)
    setSelectedIngredients([])
    setRecipeInstructions('')
    setTotalTimeInMinutes('')
    setNumberOfRecipeServings(1)
    setSelectedPhoto(null)
    setPhotoPreview(null)
    setExistingPhotoUrl(null)
    setEditingRecipeId(null)
    setEditingUserId(null)
    setSearchText('')
    setSearchResults([])
    setError(null)
  }

  const handleEditRecipe = async recipe => {
    try {
      setLoadingEdit(true)
      const recipeId = recipe.id || recipe.itemId || recipe._id
      if (!recipeId) {
        alert(t('pages.recipes.recipeIdNotFound'))
        setLoadingEdit(false)
        return
      }

      const fetchedRecipe = isNutritionistMode
        ? null
        : await getItemsByIds({ ids: [recipeId] })
      const resolvedRecipe =
        (isNutritionistMode ? recipe : null) ||
        fetchedRecipe?.data?.[0] ||
        fetchedRecipe?.items?.[0]

      if (!resolvedRecipe) {
        alert(t('pages.recipes.failedLoadRecipeData'))
        setLoadingEdit(false)
        return
      }

      setEditingRecipeId(recipeId)
      setEditingUserId(
        resolvedRecipe.createdByUserId || currentUser?.uid || ADMIN_USER_ID
      )
      setRecipeName(resolvedRecipe.name || '')
      setSelectedCountryCode(resolvedRecipe.countryCode || sharedCountry)
      setIsRecipePublic(Boolean(resolvedRecipe.isPublic))
      setRecipeInstructions(
        resolvedRecipe.recipeSteps?.instructions?.join('\n') || ''
      )
      setTotalTimeInMinutes(resolvedRecipe.totalTimeInMinutes?.toString() || '')
      setNumberOfRecipeServings(resolvedRecipe.numberOfRecipeServings || 1)
      setExistingPhotoUrl(resolvedRecipe.photoUrl || null)
      setPhotoPreview(resolvedRecipe.photoUrl || null)

      // Fetch full ingredient data for nutrient calculation
      const ingredients = resolvedRecipe.ingredients || []
      if (ingredients.length > 0) {
        try {
          const ingredientIds = ingredients.map(ing => ing.id).filter(id => id)
          if (ingredientIds.length > 0) {
            // wait 1.5 seconds
            await new Promise(resolve => setTimeout(resolve, 1500))
            const ingredientResp = await getItemsByIds({ ids: ingredientIds })
            const detailedItems =
              ingredientResp?.data || ingredientResp?.items || []

            // Create a map of detailed items by id
            const detailedMap = {}
            detailedItems.forEach(item => {
              const id = item.id || item.itemId || item._id
              if (id) {
                detailedMap[id] = item
              }
            })

            // Enrich ingredients with full nutrient data
            const enrichedIngredients = ingredients.map(ing => {
              const detailed = detailedMap[ing.id]
              const selectedIngredientUnit = ing.unit || 'g'
              const selectedIngredientQuantity = parseNumber(
                ing.quantity ?? ing.weight ?? 100
              )
              if (detailed) {
                return {
                  id: ing.id,
                  name: ing.name || detailed.name,
                  quantity: selectedIngredientQuantity,
                  weight: selectedIngredientQuantity,
                  unit: selectedIngredientUnit,
                  category: ing.category || detailed.category || null,
                  caloriesPer100: parseNumber(detailed.caloriesPer100),
                  nutrientsPer100: parseNutrients(detailed.nutrientsPer100),
                  isLiquid: detailed.isLiquid,
                  servingOptions: parseServingOptions(detailed.servingOptions)
                }
              }
              return {
                id: ing.id,
                name: ing.name,
                quantity: selectedIngredientQuantity,
                weight: selectedIngredientQuantity,
                unit: selectedIngredientUnit,
                category: ing.category || null,
                caloriesPer100: parseNumber(ing.caloriesPer100),
                nutrientsPer100: parseNutrients(ing.nutrientsPer100),
                isLiquid: ing.isLiquid,
                servingOptions: parseServingOptions(ing.servingOptions)
              }
            })
            setSelectedIngredients(enrichedIngredients)
          } else {
            // No valid IDs, use ingredients as-is
            setSelectedIngredients(ingredients)
          }
        } catch (e) {
          console.warn(
            'Failed to fetch ingredient details, using recipe ingredients as-is',
            e
          )
          // Fallback to original ingredients
          setSelectedIngredients(ingredients)
        }
      } else {
        setSelectedIngredients([])
      }

      setIsCreateModalOpen(true)
      setLoadingEdit(false)
    } catch (e) {
      console.error('Failed to load recipe for editing', e)
      alert(t('pages.recipes.failedLoadRecipeDataRetry'))
      setLoadingEdit(false)
    }
  }

  const handleDeleteRecipe = async recipe => {
    const confirmed = confirm(
      t('pages.recipes.confirmDeleteWithName', { name: recipe?.name || '' })
    )
    if (!confirmed) return

    try {
      setDeleting(true)
      if (isNutritionistMode) {
        await deleteNutritionistRecipe({
          itemId: recipe.id
        })
      } else {
        await deleteItem({
          itemId: recipe.id,
          itemType: 'FOOD',
          userId: recipe.createdByUserId || ADMIN_USER_ID
        })
      }
      alert(t('pages.recipes.deleteSuccess'))
      await new Promise(resolve => setTimeout(resolve, 1500))
      refreshData()
    } catch (e) {
      console.error('Failed to delete recipe', e)
      alert(t('pages.recipes.deleteFail'))
    } finally {
      setDeleting(false)
    }
  }

  const handleToggleRecipeVerification = async recipe => {
    const shouldVerify = !Boolean(recipe?.isVerified)
    try {
      await setItemVerifiedStatus({
        itemId: recipe.id,
        verified: shouldVerify,
        itemType: 'FOOD'
      })
      await refreshData()
    } catch (verifyError) {
      console.error('Failed to toggle recipe verification', verifyError)
      alert(
        shouldVerify
          ? t('pages.recipes.verifyFail')
          : t('pages.recipes.unverifyFail')
      )
    }
  }

  const handleAddPhotoToRecipe = async recipe => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = async e => {
      const file = e.target.files[0]
      if (!file) return

      try {
        setUploadingPhoto(true)
        const photoResult = await saveImageToImgb(file)
        let photoUrl = null
        if (photoResult?.url) {
          photoUrl = photoResult.url
        } else if (photoResult?.id) {
          photoUrl = `https://i.ibb.co/${photoResult.id}/${photoResult.id}.jpg`
        }

        if (photoUrl) {
          await addPhotoToItem({
            itemId: recipe.id,
            itemType: 'FOOD',
            userId: recipe.createdByUserId || ADMIN_USER_ID,
            photoUrl: photoUrl
          })
          alert(t('pages.recipes.photoAddedSuccess'))
          await new Promise(resolve => setTimeout(resolve, 1500))
          refreshData()
        } else {
          alert(t('pages.recipes.failedUploadPhoto'))
        }
      } catch (e) {
        console.error('Failed to add photo', e)
        alert(t('pages.recipes.failedAddPhotoRetry'))
      } finally {
        setUploadingPhoto(false)
      }
    }
    input.click()
  }

  const handleCreateRecipe = async () => {
    if (!recipeName.trim()) {
      alert(t('pages.recipes.provideRecipeName'))
      return
    }
    if (selectedIngredients.length === 0) {
      alert(t('pages.recipes.addAtLeastOneIngredient'))
      return
    }

    try {
      setSubmitting(true)
      setError(null)

      // Calculate nutrients
      const calculatedNutrients = calculateNutrients(selectedIngredients)
      const weightAfterCooking = parseNumber(calculatedNutrients.totalQuantity)

      // Upload photo if selected (only for new recipes or when changing photo)
      let photoUrl = existingPhotoUrl
      if (selectedPhoto) {
        setUploadingPhoto(true)
        const photoResult = await saveImageToImgb(selectedPhoto)
        if (photoResult?.url) {
          photoUrl = photoResult.url
        } else if (photoResult?.id) {
          // If API returns id, construct URL
          photoUrl = `https://i.ibb.co/${photoResult.id}/${photoResult.id}.jpg`
        }
        setUploadingPhoto(false)
      }

      // Parse instructions
      const instructions = recipeInstructions
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)

      // Generate serving options based on calculated total weight and number of servings
      const servingOptions = generateDefaultServings(
        calculatedNutrients.totalQuantity,
        parseInt(numberOfRecipeServings, 10) || 1
      )

      const ingredientsForAPI = selectedIngredients.map(ing => ({
        id: ing.id,
        name: ing.name,
        quantity: parseNumber(ing.quantity ?? ing.weight ?? 0),
        unit: ing.unit,
        category: ing.category
      }))

      const totalQtyForPer100 = weightAfterCooking || 1
      const caloriesPer100 =
        (parseNumber(calculatedNutrients.totalCalories) * 100) / totalQtyForPer100
      const recipeData = {
        type: 'recipe',
        countryCode: selectedCountryCode,
        servingOptions,
        ingredients: ingredientsForAPI,
        photoUrl: photoUrl,
        recipeSteps: {
          instructions: instructions
        },
        totalTimeInMinutes: parseInt(totalTimeInMinutes) || 0,
        caloriesPer100,
        name: recipeName.trim(),
        isPublic: isNutritionistMode ? isRecipePublic : true,
        numberOfRecipeServings: parseInt(numberOfRecipeServings, 10) || 1,
        nutrientsPer100: {
          proteinsInGrams:
            (parseNumber(calculatedNutrients.totalProtein) * 100) / totalQtyForPer100,
          fatInGrams:
            (parseNumber(calculatedNutrients.totalFat) * 100) / totalQtyForPer100,
          fattyAcidsTotalSaturatedInGrams:
            (parseNumber(calculatedNutrients.totalSaturatedFat) * 100) /
            totalQtyForPer100,
          fattyAcidsTotalUnSaturatedInGrams:
            (parseNumber(calculatedNutrients.totalUnSaturatedFat) * 100) /
            totalQtyForPer100,
          carbohydratesInGrams:
            (parseNumber(calculatedNutrients.totalCarbs) * 100) / totalQtyForPer100,
          saltInGrams:
            (parseNumber(calculatedNutrients.totalSalt) * 100) / totalQtyForPer100,
          fibreInGrams:
            (parseNumber(calculatedNutrients.totalFiber) * 100) / totalQtyForPer100,
          sugarsInGrams:
            (parseNumber(calculatedNutrients.totalSugar) * 100) / totalQtyForPer100
        },
        selectedUnit: 'serving',
        isLiquid: false,
        weightAfterCooking
      }

      if (editingRecipeId) {
        if (isNutritionistMode) {
          await updateNutritionistRecipe({
            itemId: editingRecipeId,
            data: recipeData
          })
        } else {
          await updateItem({
            userId: editingUserId,
            itemId: editingRecipeId,
            itemType: 'FOOD',
            data: recipeData
          })
        }
        alert(t('pages.recipes.updateSuccess'))
      } else {
        if (isNutritionistMode) {
          await addNutritionistRecipe({
            data: recipeData
          })
        } else {
          await addItem({
            userId: ADMIN_USER_ID,
            itemType: 'FOOD',
            data: recipeData,
            countryCode: selectedCountryCode
          })
        }
        alert(t('pages.recipes.createSuccess'))
      }

      // Reset form
      clearRecipeDraft()
      resetForm()
      setIsCreateModalOpen(false)

      // Refresh recipes list
      await new Promise(resolve => setTimeout(resolve, 1500))
      refreshData()
    } catch (e) {
      console.error('Failed to save recipe', e)
      alert(
        editingRecipeId
          ? t('pages.recipes.updateFail')
          : t('pages.recipes.createFail')
      )
    } finally {
      setSubmitting(false)
      setUploadingPhoto(false)
    }
  }

  const naText = t('pages.recipes.na')
  const yesText = t('pages.recipes.yes')
  const noText = t('pages.recipes.no')
  const pageTitle = isNutritionistMode
    ? t('sidebar.myRecipes')
    : t('pages.recipes.title')
  const getRecipeCreatorLabel = recipe =>
    recipe?.createdByUserId || t('sidebar.backofficeAdmin')
  const uniqueRecipeTypes = useMemo(
    () =>
      [...new Set(recipeItems.map(item => String(item?.type || '').trim()).filter(Boolean))].sort(
        (a, b) => a.localeCompare(b)
      ),
    [recipeItems]
  )
  const recipeStats = useMemo(
    () => [
      {
        title: t('pages.recipes.totalRecipes'),
        value: recipeItems.length,
        icon: DocumentTextIcon,
        iconClass: 'bg-rose-50 text-rose-600'
      },
      {
        title: t('pages.recipes.unverified'),
        value: recipeItems.filter(item => !Boolean(item?.isVerified)).length,
        icon: CheckBadgeIcon,
        iconClass: 'bg-amber-50 text-amber-600',
        onClick: () =>
          setColumnFilters(current => ({
            ...current,
            verified: current.verified === 'false' ? 'all' : 'false'
          })),
        isActive: columnFilters.verified === 'false'
      },
      {
        title: t('pages.recipes.publicLabel'),
        value: recipeItems.filter(item => Boolean(item?.isPublic)).length,
        icon: GlobeAltIcon,
        iconClass: 'bg-orange-50 text-orange-600'
      },
      {
        title: t('pages.recipes.country'),
        value: [...new Set(recipeItems.map(item => item?.countryCode).filter(Boolean))].length,
        icon: FunnelIcon,
        iconClass: 'bg-blue-50 text-blue-600'
      }
    ],
    [columnFilters.verified, recipeItems, t]
  )

  const renderColumnHeader = (column, label, filterContent = null) => (
    <div className="relative flex items-center gap-2" ref={openColumnFilter === column ? columnFilterRef : null}>
      <button
        type="button"
        onClick={() => handleSort(column)}
        className="inline-flex items-center gap-1 font-semibold text-slate-500"
      >
        <span>{label}</span>
        {sortColumn === column &&
          (sortDirection === 'asc' ? (
            <ChevronUpIcon className="h-4 w-4" />
          ) : (
            <ChevronDownIcon className="h-4 w-4" />
          ))}
      </button>
      {filterContent ? (
        <>
          <button
            type="button"
            onClick={() =>
              setOpenColumnFilter(current => (current === column ? null : column))
            }
            className={`rounded-full p-1 transition ${
              openColumnFilter === column || (columnFilters[column] && columnFilters[column] !== 'all')
                ? 'bg-slate-200 text-slate-700'
                : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'
            }`}
          >
            <FunnelIcon className="h-3.5 w-3.5" />
          </button>
          {openColumnFilter === column ? (
            <div className="absolute left-0 top-full z-20 mt-2 min-w-56 rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl">
              {filterContent}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  )

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {pageTitle}
            </h1>
            <p className="text-gray-600 mt-2">
              {t('pages.recipes.manageRecipes')}
            </p>
          </div>
        </div>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">{t('pages.recipes.loading')}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Loading overlay for edit */}
      {loadingEdit && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="text-gray-700 font-medium">
              {t('pages.recipes.loadingRecipeData')}
            </p>
          </div>
        </div>
      )}

      <div className={`p-6 sm:p-8 ${glassCardClass}`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-center sm:text-left">
            <h1 className="text-3xl font-bold text-gray-900">
              {pageTitle}
            </h1>
            <p className="text-gray-600 mt-2">{t('pages.recipes.manageRecipes')}</p>
          </div>
          <div className="flex flex-col items-end gap-2 self-stretch sm:self-auto">
            <div className="flex items-center justify-end gap-2 self-end">
              <label className="text-sm text-gray-700 whitespace-nowrap">
                {t('pages.recipes.country')}:
              </label>
              <select
                value={filterCountryCode}
                onChange={e => {
                  const nextCountry = setSharedCountry(e.target.value)
                  setFilterCountryCode(nextCountry)
                }}
                className="rounded-2xl border border-white/70 bg-white/90 px-3 py-2 text-sm font-medium text-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
              >
                {Object.entries(AVAILABLE_COUNTRY_CODES).map(([key, value]) => (
                  <option key={key} value={value}>
                    {value.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2 self-end">
              <button
                onClick={refreshData}
                className="inline-flex items-center rounded-2xl border border-white/70 bg-white/90 px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-white"
              >
                <svg
                  className="w-4 h-4 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                {t('pages.recipes.refreshData')}
              </button>
              <button
                onClick={() => {
                  resetForm()
                  loadRecipeDraft()
                  setIsCreateModalOpen(true)
                }}
                className="inline-flex items-center rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:shadow-xl"
              >
                <PlusIcon className="w-4 h-4 mr-2" />
                {t('pages.recipes.create')}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {recipeStats.map(stat => {
          const Icon = stat.icon
          return (
            <button
              key={stat.title}
              type="button"
              onClick={stat.onClick}
              className={`rounded-3xl border bg-white p-6 text-left shadow-sm transition ${
                stat.onClick
                  ? stat.isActive
                    ? 'border-amber-300 ring-2 ring-amber-100'
                    : 'border-slate-200 hover:border-slate-300'
                  : 'border-slate-200 cursor-default'
              }`}
            >
              <div className="flex items-center gap-4">
                <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${stat.iconClass}`}>
                  <Icon className="h-7 w-7" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    {stat.title}
                  </p>
                  <p className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
                    {stat.value}
                  </p>
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {/* Search */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative flex-1">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder={t('pages.recipes.searchByName')}
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm text-slate-900 outline-none transition focus:border-violet-400 focus:bg-white"
          />
        </div>
          <div className="text-sm text-slate-500">
            {filteredRecipes.length} {t('pages.recipes.totalRecipes').toLowerCase()}
          </div>
        </div>
      </div>

      {/* Recipes List & Table */}
      <div className="relative overflow-visible rounded-3xl border border-slate-200 bg-white shadow-sm">
        {/* Mobile card list */}
        <div className="md:hidden">
          <div className="space-y-4">
            {getCurrentItems().length === 0 && (
              <div className="text-center text-sm text-gray-600 py-6">
                {t('pages.recipes.noRecipesFound')}
              </div>
            )}
            {getCurrentItems().map(item => (
              <div
                key={item.id}
                className="cursor-pointer border border-gray-200 rounded-lg p-4 shadow-sm transition hover:border-violet-200 hover:bg-violet-50/30"
                onClick={() => handleEditRecipe(item)}
              >
                <div className="flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-semibold text-gray-900 break-words">
                          {item.name || naText}
                        </h3>
                        <span
                          className={`px-2 py-0.5 text-xs font-medium rounded-full ${item.isVerified ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}
                        >
                          {item.isVerified
                            ? t('pages.recipes.verified')
                            : t('pages.recipes.unverified')}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-600">
                        <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                          {item.type || naText}
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-800">
                          {item.countryCode || naText}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${item.isPublic !== null && item.isPublic !== undefined ? (item.isPublic ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-800') : 'bg-gray-100 text-gray-800'}`}
                        >
                          {item.isPublic !== null && item.isPublic !== undefined
                            ? item.isPublic
                              ? t('pages.recipes.public')
                              : t('pages.recipes.private')
                            : naText}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      {isAdmin && !isNutritionistMode ? (
                        <button
                          onClick={event => {
                            event.stopPropagation()
                            handleToggleRecipeVerification(item)
                          }}
                          className={
                            item.isVerified
                              ? 'text-amber-600 hover:text-amber-800'
                              : 'text-emerald-600 hover:text-emerald-800'
                          }
                          title={
                            item.isVerified
                              ? t('pages.recipes.unverify')
                              : t('pages.recipes.verify')
                          }
                        >
                          <CheckBadgeIcon className="w-5 h-5" />
                        </button>
                      ) : null}
                      <button
                        onClick={event => {
                          event.stopPropagation()
                          handleDeleteRecipe(item)
                        }}
                        disabled={deleting}
                        className="text-red-600 hover:text-red-800 disabled:opacity-50"
                        title={t('pages.recipes.deleteRecipe')}
                      >
                        <TrashIcon className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3 text-sm text-gray-700">
                    {isAdmin && !isNutritionistMode ? (
                      <div className="flex items-center gap-1">
                        <span className="font-medium">
                          {t('pages.recipes.createdBy')}:
                        </span>
                        <span>{getRecipeCreatorLabel(item)}</span>
                      </div>
                    ) : null}
                    <div className="flex items-center gap-1">
                      <span className="font-medium">
                        {t('pages.recipes.caloriesPer100g')}:
                      </span>
                      <span>
                        {item.caloriesPer100 || item.caloriesPer100 === 0
                          ? item.caloriesPer100
                          : naText}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="font-medium">{t('pages.recipes.servings')}:</span>
                      <span>{item.numberOfRecipeServings || naText}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="font-medium">{t('pages.recipes.created')}:</span>
                      <span>
                        {item.dateTimeCreated
                          ? new Date(item.dateTimeCreated).toLocaleDateString()
                          : naText}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="font-medium">{t('pages.recipes.updated')}:</span>
                      <span>
                        {item.dateTimeUpdated
                          ? new Date(item.dateTimeUpdated).toLocaleDateString()
                          : naText}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {item.photoUrl ? (
                      <button
                        onClick={event => {
                          event.stopPropagation()
                          handleShowImage(item.photoUrl)
                        }}
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium underline"
                      >
                        {t('pages.recipes.viewPhoto')}
                      </button>
                    ) : (
                      <span className="text-sm text-gray-500">
                        {t('pages.recipes.noPhoto')}
                      </span>
                    )}
                    <button
                      onClick={event => {
                        event.stopPropagation()
                        handleShowServings(item?.servingOptions)
                      }}
                      className="text-blue-600 hover:text-blue-800 text-sm font-medium underline"
                    >
                      {t('pages.recipes.viewServings')}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Mobile Pagination */}
          <div className="mt-4 bg-white border-t border-gray-200 px-4 py-3 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-700">
                  {t('pages.recipes.perPage')}
                </label>
                <select
                  value={itemsPerPage}
                  onChange={e => {
                    setItemsPerPage(Number(e.target.value))
                    setCurrentPage(1)
                  }}
                  className="px-2 py-1 border border-gray-300 rounded-md text-sm"
                >
                  <option value="10">10</option>
                  <option value="25">25</option>
                  <option value="50">50</option>
                </select>
              </div>
              <span className="text-xs text-gray-600">
                {t('pages.recipes.pageOf', {
                  current: currentPage,
                  total: getTotalPages() || 1
                })}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('pages.recipes.previous')}
              </button>
              <button
                onClick={() =>
                  setCurrentPage(prev => Math.min(getTotalPages(), prev + 1))
                }
                disabled={currentPage >= getTotalPages()}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('pages.recipes.next')}
              </button>
            </div>
            <div className="text-xs text-gray-600 text-center">
              {t('pages.recipes.showingRangeOfTotal', {
                start: (currentPage - 1) * itemsPerPage + 1,
                end: Math.min(currentPage * itemsPerPage, filteredRecipes.length),
                total: filteredRecipes.length
              })}
            </div>
          </div>
        </div>

        {/* Desktop table */}
        <div className="hidden md:block overflow-visible">
            <table className="w-full divide-y divide-gray-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('pages.recipes.photo')}
                  </th>
                  <th
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    {renderColumnHeader(
                      'name',
                      t('pages.recipes.name'),
                      <input
                        type="text"
                        value={columnFilters.name}
                        onChange={event =>
                          setColumnFilters(current => ({
                            ...current,
                            name: event.target.value
                          }))
                        }
                        placeholder={t('pages.recipes.searchByName')}
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-400"
                      />
                    )}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {renderColumnHeader(
                      'type',
                      t('pages.recipes.type'),
                      <select
                        value={columnFilters.type}
                        onChange={event =>
                          setColumnFilters(current => ({
                            ...current,
                            type: event.target.value
                          }))
                        }
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-400"
                      >
                        <option value="all">All</option>
                        {uniqueRecipeTypes.map(type => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </select>
                    )}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {renderColumnHeader(
                      'country',
                      t('pages.recipes.country'),
                      <select
                        value={columnFilters.country}
                        onChange={event =>
                          setColumnFilters(current => ({
                            ...current,
                            country: event.target.value
                          }))
                        }
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-400"
                      >
                        <option value="all">All</option>
                        {Object.values(AVAILABLE_COUNTRY_CODES).map(code => (
                          <option key={code} value={code}>
                            {code}
                          </option>
                        ))}
                      </select>
                    )}
                  </th>
                  {isAdmin && !isNutritionistMode ? (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('pages.recipes.createdBy')}
                    </th>
                  ) : null}
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {renderColumnHeader(
                      'calories',
                      t('pages.recipes.caloriesHeader'),
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="number"
                          value={columnFilters.caloriesMin}
                          onChange={event =>
                            setColumnFilters(current => ({
                              ...current,
                              caloriesMin: event.target.value
                            }))
                          }
                          placeholder="Min"
                          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-400"
                        />
                        <input
                          type="number"
                          value={columnFilters.caloriesMax}
                          onChange={event =>
                            setColumnFilters(current => ({
                              ...current,
                              caloriesMax: event.target.value
                            }))
                          }
                          placeholder="Max"
                          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-400"
                        />
                      </div>
                    )}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {renderColumnHeader(
                      'servings',
                      t('pages.recipes.servings'),
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="number"
                          value={columnFilters.servingsMin}
                          onChange={event =>
                            setColumnFilters(current => ({
                              ...current,
                              servingsMin: event.target.value
                            }))
                          }
                          placeholder="Min"
                          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-400"
                        />
                        <input
                          type="number"
                          value={columnFilters.servingsMax}
                          onChange={event =>
                            setColumnFilters(current => ({
                              ...current,
                              servingsMax: event.target.value
                            }))
                          }
                          placeholder="Max"
                          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-400"
                        />
                      </div>
                    )}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {renderColumnHeader(
                      'isPublic',
                      t('pages.recipes.publicLabel'),
                      <select
                        value={columnFilters.public}
                        onChange={event =>
                          setColumnFilters(current => ({
                            ...current,
                            public: event.target.value
                          }))
                        }
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-400"
                      >
                        <option value="all">All</option>
                        <option value="true">{yesText}</option>
                        <option value="false">{noText}</option>
                      </select>
                    )}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {renderColumnHeader(
                      'isVerified',
                      t('pages.recipes.verifiedLabel'),
                      <select
                        value={columnFilters.verified}
                        onChange={event =>
                          setColumnFilters(current => ({
                            ...current,
                            verified: event.target.value
                          }))
                        }
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-400"
                      >
                        <option value="all">All</option>
                        <option value="true">{yesText}</option>
                        <option value="false">{noText}</option>
                      </select>
                    )}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('pages.recipes.created')}
                  </th>
                  <th
                    onClick={() => handleSort('dateTimeUpdated')}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  >
                    <div className="flex items-center gap-1">
                      {t('pages.recipes.updated')}
                      {sortColumn === 'dateTimeUpdated' &&
                        (sortDirection === 'asc' ? (
                          <ChevronUpIcon className="w-4 h-4" />
                        ) : (
                          <ChevronDownIcon className="w-4 h-4" />
                      ))}
                    </div>
                  </th>
                  <th className="w-[1%] whitespace-nowrap px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('pages.recipes.actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {getCurrentItems().map(item => (
                  <tr
                    key={item.id}
                    className="cursor-pointer transition-colors hover:bg-violet-50/40"
                    onClick={() => handleEditRecipe(item)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      {item.photoUrl ? (
                        <button
                          onClick={event => {
                            event.stopPropagation()
                            handleShowImage(item.photoUrl)
                          }}
                          className="overflow-hidden rounded-2xl border border-slate-200 shadow-sm"
                        >
                          <img
                            src={item.photoUrl}
                            alt={item.name || naText}
                            className="h-14 w-14 object-cover"
                          />
                        </button>
                      ) : (
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                          <PhotoIcon className="h-6 w-6" />
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div
                        className="text-sm font-medium text-gray-900 max-w-xs truncate"
                        title={item.name}
                      >
                        {item.name || naText}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-emerald-50 text-emerald-700">
                        {item.type || naText}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {item.countryCode || naText}
                    </td>
                    {isAdmin && !isNutritionistMode ? (
                      <td className="px-6 py-4 text-sm text-gray-900">
                        <div
                          className="max-w-[220px] truncate"
                          title={getRecipeCreatorLabel(item)}
                        >
                          {getRecipeCreatorLabel(item)}
                        </div>
                      </td>
                    ) : null}
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {item.caloriesPer100 || item.caloriesPer100 === 0
                        ? `${item.caloriesPer100} cal/100g`
                        : naText}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="flex items-center gap-3">
                        <span>{item.numberOfRecipeServings || naText}</span>
                        <button
                          onClick={event => {
                            event.stopPropagation()
                            handleShowServings(item?.servingOptions)
                          }}
                          className="text-blue-600 hover:text-blue-900 underline cursor-pointer text-sm"
                        >
                          {t('pages.recipes.servings')}
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${item.isPublic !== null && item.isPublic !== undefined ? (item.isPublic ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800') : 'bg-gray-100 text-gray-800'}`}
                      >
                        {item.isPublic !== null && item.isPublic !== undefined
                          ? item.isPublic
                            ? yesText
                            : noText
                          : naText}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded-full ${item.isVerified ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}
                        >
                          {item.isVerified ? yesText : noText}
                        </span>
                        {isAdmin && !isNutritionistMode ? (
                          <button
                            onClick={event => {
                              event.stopPropagation()
                              handleToggleRecipeVerification(item)
                            }}
                            className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                              item.isVerified
                                ? 'border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
                                : 'border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                            }`}
                          >
                            <CheckBadgeIcon className="h-4 w-4" />
                            <span>
                              {item.isVerified
                                ? t('pages.recipes.unverify')
                                : t('pages.recipes.verify')}
                            </span>
                          </button>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {item.dateTimeCreated
                        ? new Date(item.dateTimeCreated).toLocaleDateString()
                        : naText}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {item.dateTimeUpdated
                        ? new Date(item.dateTimeUpdated).toLocaleDateString()
                        : naText}
                    </td>
                    <td className="w-[1%] px-3 py-4 whitespace-nowrap align-top">
                      <div className="ml-auto flex max-w-[220px] flex-wrap items-center justify-end gap-1.5">
                        <button
                          onClick={event => {
                            event.stopPropagation()
                            handleDeleteRecipe(item)
                          }}
                          disabled={deleting}
                          className="inline-flex items-center rounded-full border border-rose-200 bg-rose-50 p-2 text-rose-700 transition hover:bg-rose-100 disabled:opacity-50"
                          title={t('pages.recipes.deleteRecipe')}
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

          {/* Pagination Controls */}
          <div className="bg-white px-4 py-3 hidden md:flex flex-wrap items-center gap-4 md:gap-6 border-t border-gray-200">
            <div className="flex items-center gap-3">
              <label className="text-sm text-gray-700">
                {t('pages.recipes.itemsPerPage')}:
              </label>
              <select
                value={itemsPerPage}
                onChange={e => {
                  setItemsPerPage(Number(e.target.value))
                  setCurrentPage(1)
                }}
                className="px-3 py-1 border border-gray-300 rounded-md text-sm"
              >
                <option value="10">10</option>
                <option value="25">25</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </select>
            </div>

            <div className="flex flex-col md:flex-row md:items-center md:gap-3 text-sm text-gray-700">
              <span className="font-medium">
                {t('pages.recipes.pageOfWord', {
                  current: currentPage,
                  total: getTotalPages() || 1
                })}
              </span>
              <span className="text-gray-600">
                {filteredRecipes.length === 0
                  ? t('pages.recipes.showingZero')
                  : t('pages.recipes.showingToOfResults', {
                      start: (currentPage - 1) * itemsPerPage + 1,
                      end: Math.min(currentPage * itemsPerPage, filteredRecipes.length),
                      total: filteredRecipes.length
                    })}
              </span>
            </div>

            <div className="flex items-center gap-2 ml-auto">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('pages.recipes.previous')}
              </button>

              <button
                onClick={() =>
                  setCurrentPage(prev => Math.min(getTotalPages(), prev + 1))
                }
                disabled={currentPage >= getTotalPages()}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('pages.recipes.next')}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Create Recipe Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 px-4 py-6">
          <div className="mx-auto w-full max-w-7xl rounded-[32px] border border-slate-200 bg-[#fcfbff] p-6 shadow-2xl md:p-8">
            <div className="flex flex-col gap-4 border-b border-slate-200 pb-6 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">
                  {t('pages.recipes.title')}
                </p>
                <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
                  {editingRecipeId
                    ? t('pages.recipes.editRecipe')
                    : t('pages.recipes.create')}
                </h2>
                <p className="mt-2 max-w-2xl text-sm text-slate-500">
                  {t('pages.recipes.manageRecipes')}
                </p>
              </div>
              <div className="flex items-center gap-3 self-start">
                <button
                  onClick={() => {
                    resetForm()
                    setIsCreateModalOpen(false)
                  }}
                  className="rounded-2xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                >
                  {t('pages.recipes.cancel')}
                </button>
                <button
                  onClick={handleCreateRecipe}
                  disabled={
                    submitting ||
                    !recipeName.trim() ||
                    selectedIngredients.length === 0
                  }
                  className="rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting
                    ? editingRecipeId
                      ? t('pages.recipes.updating')
                      : t('pages.recipes.creating')
                    : editingRecipeId
                      ? t('pages.recipes.updateRecipe')
                      : t('pages.recipes.create')}
                </button>
                <button
                  onClick={() => {
                    resetForm()
                    setIsCreateModalOpen(false)
                  }}
                  className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                >
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1.8fr)_360px]">
              <div className="space-y-6">
                <div className="grid gap-6 lg:grid-cols-[minmax(0,1.55fr)_320px]">
                  <div className="space-y-6">
                    <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                      <div className="mb-4 flex items-center gap-2">
                        <PhotoIcon className="h-5 w-5 text-violet-500" />
                        <h3 className="text-lg font-semibold text-slate-950">
                          {t('pages.recipes.recipePhoto')}
                        </h3>
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handlePhotoSelect}
                        className="hidden"
                        id="photo-upload"
                      />
                      <label
                        htmlFor="photo-upload"
                        className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm font-semibold text-violet-700 transition hover:bg-violet-100"
                      >
                        <PhotoIcon className="w-5 h-5" />
                        {selectedPhoto || photoPreview || existingPhotoUrl
                          ? t('pages.recipes.change')
                          : t('pages.recipes.uploadPhoto')}
                      </label>
                      {uploadingPhoto ? (
                        <p className="mt-3 text-sm text-slate-500">
                          {t('pages.recipes.uploading')}
                        </p>
                      ) : null}
                      <label
                        htmlFor="photo-upload"
                        className="mt-4 block cursor-pointer overflow-hidden rounded-[28px] border border-slate-200 shadow-sm transition hover:border-violet-300"
                      >
                        {photoPreview ? (
                          <img
                            src={photoPreview}
                            alt={t('pages.recipes.preview')}
                            className="h-[320px] w-full bg-white object-contain"
                          />
                        ) : (
                          <div className="flex h-[320px] items-center justify-center bg-gradient-to-br from-slate-100 via-slate-200 to-slate-300 text-slate-400">
                            <PhotoIcon className="h-16 w-16" />
                          </div>
                        )}
                      </label>
                    </div>

                    {isNutritionistMode ? (
                      <label className="flex items-center gap-3 rounded-[28px] border border-slate-200 bg-white px-5 py-4 text-sm font-medium text-slate-700 shadow-sm">
                        <input
                          type="checkbox"
                          checked={isRecipePublic}
                          onChange={event =>
                            setIsRecipePublic(event.target.checked)
                          }
                          className="h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                        />
                        <span>{t('pages.recipes.publicLabel')}</span>
                      </label>
                    ) : null}
                  </div>

                  <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="mb-5 flex items-center gap-2">
                      <DocumentTextIcon className="h-5 w-5 text-violet-500" />
                      <h3 className="text-lg font-semibold text-slate-950">
                        {t('pages.recipes.recipeInformation')}
                      </h3>
                    </div>

                    <div className="space-y-5">
                      <div>
                        <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                          {t('pages.recipes.recipeName')}
                        </label>
                        <input
                          type="text"
                          value={recipeName}
                          onChange={e => setRecipeName(e.target.value)}
                          className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 outline-none transition focus:border-violet-300 focus:bg-white"
                          placeholder={t('pages.recipes.enterRecipeName')}
                        />
                      </div>

                      <div className="grid gap-4 sm:grid-cols-3">
                        <div className="flex flex-col">
                          <label className="mb-2 flex min-h-[2.75rem] items-end text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                            {t('pages.recipes.countryCode')}
                          </label>
                          <select
                            value={selectedCountryCode}
                            onChange={e => {
                              const nextCountry = setSharedCountry(e.target.value)
                              setSelectedCountryCode(nextCountry)
                            }}
                            className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 outline-none transition focus:border-violet-300 focus:bg-white"
                          >
                            {Object.entries(AVAILABLE_COUNTRY_CODES).map(
                              ([key, value]) => (
                                <option key={key} value={value}>
                                  {value.toUpperCase()}
                                </option>
                              )
                            )}
                          </select>
                        </div>
                        <div className="flex flex-col">
                          <label className="mb-2 flex min-h-[2.75rem] items-end text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                            {t('pages.recipes.numberOfServings')}
                          </label>
                          <input
                            type="number"
                            min="1"
                            value={numberOfRecipeServings}
                            onChange={e => setNumberOfRecipeServings(e.target.value)}
                            className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 outline-none transition focus:border-violet-300 focus:bg-white"
                          />
                        </div>
                        <div className="flex flex-col">
                          <label className="mb-2 flex min-h-[2.75rem] items-end text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                            {t('pages.recipes.totalTimeMinutes')}
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={totalTimeInMinutes}
                            onChange={e => setTotalTimeInMinutes(e.target.value)}
                            className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 outline-none transition focus:border-violet-300 focus:bg-white"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                          {t('pages.recipes.recipeInstructionsOnePerLine')}
                        </label>
                        <textarea
                          value={recipeInstructions}
                          onChange={e => setRecipeInstructions(e.target.value)}
                          className="min-h-[220px] w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-violet-300 focus:bg-white"
                          rows="8"
                          placeholder={t('pages.recipes.enterRecipeInstructions')}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="rounded-[28px] border border-violet-200 bg-violet-50/70 p-6 shadow-sm">
                      <div className="mb-4 flex items-center gap-2">
                        <DocumentTextIcon className="h-5 w-5 text-violet-500" />
                        <h3 className="text-lg font-semibold text-slate-950">
                          {t('pages.recipes.totalNutrients')}
                        </h3>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-2xl bg-white p-4 text-center shadow-sm">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                            {t('pages.recipes.calories')}
                          </div>
                          <div className="mt-2 text-3xl font-bold text-violet-600">
                            {Math.round(selectedIngredientsTotals.totalCalories)}
                          </div>
                        </div>
                        <div className="rounded-2xl bg-white p-4 text-center shadow-sm">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                            {t('pages.recipes.protein')}
                          </div>
                          <div className="mt-2 text-3xl font-bold text-slate-900">
                            {Math.round(selectedIngredientsTotals.totalProtein)}g
                          </div>
                        </div>
                        <div className="rounded-2xl bg-white p-4 text-center shadow-sm">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                            {t('pages.recipes.carbs')}
                          </div>
                          <div className="mt-2 text-3xl font-bold text-slate-900">
                            {Math.round(selectedIngredientsTotals.totalCarbs)}g
                          </div>
                        </div>
                        <div className="rounded-2xl bg-white p-4 text-center shadow-sm">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                            {t('pages.recipes.fat')}
                          </div>
                          <div className="mt-2 text-3xl font-bold text-slate-900">
                            {Math.round(selectedIngredientsTotals.totalFat)}g
                          </div>
                        </div>
                      </div>
                    </div>

                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <DocumentTextIcon className="h-5 w-5 text-violet-500" />
                      <h3 className="text-lg font-semibold text-slate-950">
                        {t('pages.recipes.selectedIngredients')}
                      </h3>
                    </div>
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                      {selectedIngredients.length}
                    </span>
                  </div>

                  <div className="mb-4 flex gap-2">
                    <input
                      type="text"
                      value={searchText}
                      onChange={e => setSearchText(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleSearch()
                      }}
                      className="flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-violet-300 focus:bg-white"
                      placeholder={t('pages.recipes.searchFoodItems')}
                    />
                    <button
                      onClick={handleSearch}
                      disabled={searching || !searchText.trim()}
                      className="rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm font-semibold text-violet-700 transition hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {searching
                        ? t('pages.recipes.searching')
                        : t('pages.recipes.search')}
                    </button>
                  </div>

                  {searchResults.length > 0 ? (
                    <div className="mb-5 max-h-56 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50/60">
                      {searchResults.map((item, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 last:border-b-0"
                        >
                          <div>
                            <div className="text-sm font-semibold text-slate-900">
                              {item?.name || item?.title || t('pages.recipes.unnamed')}
                            </div>
                            <div className="mt-1 text-xs text-slate-500">
                              {item?.caloriesPer100
                                ? `${item.caloriesPer100} cal/100g`
                                : ''}
                            </div>
                          </div>
                          <button
                            onClick={() => addIngredientToRecipe(item)}
                            className="rounded-full bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-violet-700"
                          >
                            {t('pages.recipes.add')}
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  <div className="space-y-3">
                    {selectedIngredients.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                        {t('pages.recipes.noIngredientsYet')}
                      </div>
                    ) : (
                      selectedIngredients.map((ing, index) => {
                        const unitOptions = getIngredientUnitOptions(ing)
                        return (
                          <div key={index} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                            <div className="mb-3 flex items-start justify-between gap-3">
                              <div>
                                <div className="text-sm font-semibold text-slate-900">
                                  {ing.name}
                                </div>
                                <div className="mt-1 text-xs text-slate-500">
                                  {Math.round(ingredientCalories[index] || 0)} cal
                                </div>
                              </div>
                              <button
                                onClick={() => removeIngredient(index)}
                                className="rounded-full p-1 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                              >
                                <XMarkIcon className="w-4 h-4" />
                              </button>
                            </div>
                            <div className="grid grid-cols-[minmax(0,1fr)_120px] gap-2">
                              <input
                                type="number"
                                step="any"
                                min="0"
                                value={ing.weight}
                                onChange={e =>
                                  updateIngredientWeight(index, e.target.value)
                                }
                                className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-violet-300"
                                placeholder={t('pages.recipes.quantity')}
                              />
                              <select
                                value={ing.unit}
                                onChange={e =>
                                  updateIngredientUnit(index, e.target.value)
                                }
                                className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-violet-300"
                              >
                                {unitOptions.length === 0 ? (
                                  <option value={ing.unit || 'g'}>
                                    {ing.unit || 'g'}
                                  </option>
                                ) : (
                                  unitOptions.map(unit => (
                                    <option key={unit} value={unit}>
                                      {unit}
                                    </option>
                                  ))
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

            {error && (
              <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                {error}
              </div>
            )}

            <div className="mt-8 flex flex-col gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-end">
              {!editingRecipeId ? (
                <button
                  onClick={handleSaveRecipeDraft}
                  className="rounded-2xl px-5 py-3 text-sm font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                >
                  {t('pages.recipes.saveAsDraft')}
                </button>
              ) : null}
              <button
                onClick={handleCreateRecipe}
                disabled={
                  submitting ||
                  !recipeName.trim() ||
                  selectedIngredients.length === 0
                }
                className="rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-6 py-3 text-sm font-semibold text-white shadow-lg transition hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting
                  ? editingRecipeId
                    ? t('pages.recipes.updating')
                    : t('pages.recipes.creating')
                  : editingRecipeId
                    ? t('pages.recipes.updateRecipe')
                    : t('pages.recipes.publishRecipe')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Modal */}
      {isImageModalOpen && selectedImage && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50"
          onClick={() => {
            setIsImageModalOpen(false)
            setSelectedImage(null)
          }}
        >
          <div className="relative max-w-4xl max-h-[90vh] p-4">
            <button
              onClick={() => {
                setIsImageModalOpen(false)
                setSelectedImage(null)
              }}
              className="absolute top-0 right-0 -mt-2 -mr-2 bg-white rounded-full p-2 hover:bg-gray-100"
            >
              <XMarkIcon className="w-6 h-6 text-gray-600" />
            </button>
            <img
              src={selectedImage}
              alt={t('pages.recipes.preview')}
              className="max-w-full max-h-[90vh] rounded-lg"
              onClick={e => e.stopPropagation()}
            />
          </div>
        </div>
      )}

      {/* Ingredients Modal */}
      {isIngredientsModalOpen && selectedIngredientsView && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 shadow-lg rounded-md bg-white">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                {t('pages.recipes.ingredients')}
              </h3>
              <button
                onClick={() => {
                  setIsIngredientsModalOpen(false)
                  setSelectedIngredientsView(null)
                }}
                className="text-gray-400 hover:text-gray-500"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('pages.recipes.name')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('pages.recipes.quantity')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('pages.recipes.unit')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('pages.recipes.category')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('pages.recipes.weight')}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {selectedIngredientsView.map((ing, index) => (
                    <tr key={index}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {ing.name || naText}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {ing.quantity || naText}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {ing.unit || naText}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {ing.category || naText}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {ing.weight || naText}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4">
              <button
                onClick={() => {
                  setIsIngredientsModalOpen(false)
                  setSelectedIngredientsView(null)
                }}
                className="btn-primary"
              >
                {t('pages.recipes.close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Servings Modal */}
      {isServingsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 py-6">
          <div className="w-full max-w-3xl rounded-[28px] border border-slate-200 bg-white p-6 shadow-2xl md:p-8">
            <div className="mb-6 flex items-start justify-between gap-4 border-b border-slate-200 pb-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  {t('pages.recipes.servings')}
                </p>
                <h3 className="mt-2 text-2xl font-bold text-slate-950">
                  {t('pages.recipes.servingOptions')}
                </h3>
                <p className="mt-2 text-sm text-slate-500">
                  {t('pages.recipes.viewServings')}
                </p>
              </div>
              <button
                onClick={() => {
                  setIsServingsModalOpen(false)
                  setSelectedServingsView([])
                }}
                className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>
            {selectedServingsView.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-sm text-slate-600">
                {t('pages.recipes.noServingOptions')}
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {selectedServingsView.map((serving, index) => (
                  <div
                    key={`${serving?.unitName || 'unit'}-${index}`}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-sm"
                  >
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                      {t('pages.recipes.unit')}
                    </div>
                    <div className="mt-2 text-lg font-semibold text-slate-950">
                      {serving?.unitName || naText}
                    </div>
                    <div className="mt-5 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                      {t('pages.recipes.value')}
                    </div>
                    <div className="mt-2 text-2xl font-bold text-slate-950">
                      {serving?.value || serving?.value === 0
                        ? serving.value
                        : naText}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => {
                  setIsServingsModalOpen(false)
                  setSelectedServingsView([])
                }}
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

export default Recipes
