import { useState, useEffect, useMemo } from 'react'
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
  ChevronDownIcon
} from '@heroicons/react/24/outline'
import {
  getRecipesByCountryCode,
  searchFoodItems,
  getItemsByIds,
  addItem,
  updateItem,
  deleteItem,
  addPhotoToItem,
  saveImageToImgb
} from '../services/api'
import { selectIsAdmin } from '../store/userSlice'
import LZString from 'lz-string'

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

const Recipes = () => {
  const { t } = useTranslation()
  const [recipeItems, setRecipeItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterCountryCode, setFilterCountryCode] = useState('RO')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(25)
  const [sortColumn, setSortColumn] = useState(null)
  const [sortDirection, setSortDirection] = useState('asc')
  const isAdmin = useSelector(selectIsAdmin)

  // For recipe creation/editing modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [editingRecipeId, setEditingRecipeId] = useState(null)
  const [editingUserId, setEditingUserId] = useState(null)
  const [recipeName, setRecipeName] = useState('')
  const [selectedCountryCode, setSelectedCountryCode] = useState('RO')

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

  useEffect(() => {
    const loadRecipes = async () => {
      // Only load if admin
      if (!isAdmin) {
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setError(null)

        // Check if data exists in localStorage first (cached by country code)
        const cacheKey = `recipes_${filterCountryCode}`
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
  }, [filterCountryCode, isAdmin])

  // Reset to page 1 when switching country code or changing search term
  useEffect(() => {
    setCurrentPage(1)
  }, [filterCountryCode, searchTerm])

  const refreshData = async () => {
    setError(null)
    setRecipeItems([])

    // Clear cache for current country code
    const cacheKey = `recipes_${filterCountryCode}`
    localStorage.removeItem(cacheKey)

    setLoading(true)
    try {
      console.log('Fetching from API...')

      const data = await getRecipesByCountryCode({
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
  }, [recipeItems, searchTerm, sortColumn, sortDirection])

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
        userId: ADMIN_USER_ID,
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
    const nextValue = weight === '' ? '' : parseNumber(weight)
    ingredient.weight = nextValue
    ingredient.quantity = nextValue

    setSelectedIngredients(updated)
  }

  const updateIngredientUnit = (index, unit) => {
    const updated = [...selectedIngredients]
    updated[index].unit = unit
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

  const handlePhotoSelect = e => {
    const file = e.target.files[0]
    if (file) {
      setSelectedPhoto(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setPhotoPreview(reader.result)
      }
      reader.readAsDataURL(file)
    }
  }

  const resetForm = () => {
    setRecipeName('')
    setSelectedCountryCode('RO')
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
      // Fetch full recipe data by ID
      const recipeId = recipe.id || recipe.itemId || recipe._id
      if (!recipeId) {
        alert(t('pages.recipes.recipeIdNotFound'))
        setLoadingEdit(false)
        return
      }

      const resp = await getItemsByIds({ ids: [recipeId] })
      const fullRecipe = resp?.data?.[0] || resp?.items?.[0]

      if (!fullRecipe) {
        alert(t('pages.recipes.failedLoadRecipeData'))
        setLoadingEdit(false)
        return
      }

      setEditingRecipeId(recipeId)
      setEditingUserId(fullRecipe.createdByUserId || ADMIN_USER_ID)
      setRecipeName(fullRecipe.name || '')
      setSelectedCountryCode(fullRecipe.countryCode || 'RO')
      setRecipeInstructions(
        fullRecipe.recipeSteps?.instructions?.join('\n') || ''
      )
      setTotalTimeInMinutes(fullRecipe.totalTimeInMinutes?.toString() || '')
      setNumberOfRecipeServings(fullRecipe.numberOfRecipeServings || 1)
      setExistingPhotoUrl(fullRecipe.photoUrl || null)
      setPhotoPreview(fullRecipe.photoUrl || null)

      // Fetch full ingredient data for nutrient calculation
      const ingredients = fullRecipe.ingredients || []
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
      await deleteItem({
        itemId: recipe.id,
        itemType: 'FOOD',
        userId: recipe.createdByUserId || ADMIN_USER_ID
      })
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
        isPublic: true,
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
        // Update existing recipe
        await updateItem({
          userId: editingUserId,
          itemId: editingRecipeId,
          itemType: 'FOOD',
          data: recipeData
        })
        alert(t('pages.recipes.updateSuccess'))
      } else {
        // Create new recipe
        await addItem({
          userId: ADMIN_USER_ID,
          itemType: 'FOOD',
          data: recipeData,
          countryCode: selectedCountryCode
        })
        alert(t('pages.recipes.createSuccess'))
      }

      // Reset form
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

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {t('pages.recipes.title')}
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

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-center sm:text-left">
          <h1 className="text-3xl font-bold text-gray-900">
            {t('pages.recipes.title')}
          </h1>
          <p className="text-gray-600 mt-2">{t('pages.recipes.manageRecipes')}</p>
        </div>
        <div className="flex flex-col gap-2 items-center justify-center sm:justify-end">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-700 whitespace-nowrap">
              {t('pages.recipes.country')}:
            </label>
            <select
              value={filterCountryCode}
              onChange={e => {
                setFilterCountryCode(e.target.value)
              }}
              className="px-2 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {Object.entries(AVAILABLE_COUNTRY_CODES).map(([key, value]) => (
                <option key={key} value={value}>
                  {value.toUpperCase()}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <button
              onClick={refreshData}
              className="btn-secondary flex items-center"
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
                setIsCreateModalOpen(true)
              }}
              className="btn-primary flex items-center"
            >
              <PlusIcon className="w-4 h-4 mr-2" />
              {t('pages.recipes.create')}
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-1 gap-6">
        <div className="card p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg
                className="h-8 w-8 text-orange-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
                />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">
                {t('pages.recipes.totalRecipes')}
              </p>
              <p className="text-2xl font-semibold text-gray-900">
                {recipeItems.length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="card p-6">
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder={t('pages.recipes.searchByName')}
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="input pl-10"
          />
        </div>
      </div>

      {/* Recipes List & Table */}
      <div className="card overflow-hidden">
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
                className="border border-gray-200 rounded-lg p-4 shadow-sm"
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
                      <button
                        onClick={() => handleEditRecipe(item)}
                        disabled={loadingEdit}
                        className="text-blue-600 hover:text-blue-800 disabled:opacity-50"
                        title={t('pages.recipes.editRecipe')}
                      >
                        <PencilIcon className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleDeleteRecipe(item)}
                        disabled={deleting}
                        className="text-red-600 hover:text-red-800 disabled:opacity-50"
                        title={t('pages.recipes.deleteRecipe')}
                      >
                        <TrashIcon className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleAddPhotoToRecipe(item)}
                        disabled={uploadingPhoto}
                        className="text-green-600 hover:text-green-800 disabled:opacity-50"
                        title={t('pages.recipes.addPhoto')}
                      >
                        <PhotoIcon className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3 text-sm text-gray-700">
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
                        onClick={() => handleShowImage(item.photoUrl)}
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
                      onClick={() => handleShowServings(item?.servingOptions)}
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
        <div className="hidden md:block">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('pages.recipes.actions')}
                  </th>
                  <th
                    onClick={() => handleSort('name')}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  >
                    <div className="flex items-center gap-1">
                      {t('pages.recipes.name')}
                      {sortColumn === 'name' &&
                        (sortDirection === 'asc' ? (
                          <ChevronUpIcon className="w-4 h-4" />
                        ) : (
                          <ChevronDownIcon className="w-4 h-4" />
                        ))}
                    </div>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('pages.recipes.type')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('pages.recipes.country')}
                  </th>
                  <th
                    onClick={() => handleSort('calories')}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  >
                    <div className="flex items-center gap-1">
                      {t('pages.recipes.caloriesHeader')}
                      {sortColumn === 'calories' &&
                        (sortDirection === 'asc' ? (
                          <ChevronUpIcon className="w-4 h-4" />
                        ) : (
                          <ChevronDownIcon className="w-4 h-4" />
                        ))}
                    </div>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('pages.recipes.servings')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('pages.recipes.photo')}
                  </th>
                  <th
                    onClick={() => handleSort('isPublic')}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  >
                    <div className="flex items-center gap-1">
                      {t('pages.recipes.publicLabel')}
                      {sortColumn === 'isPublic' &&
                        (sortDirection === 'asc' ? (
                          <ChevronUpIcon className="w-4 h-4" />
                        ) : (
                          <ChevronDownIcon className="w-4 h-4" />
                        ))}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('isVerified')}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  >
                    <div className="flex items-center gap-1">
                      {t('pages.recipes.verifiedLabel')}
                      {sortColumn === 'isVerified' &&
                        (sortDirection === 'asc' ? (
                          <ChevronUpIcon className="w-4 h-4" />
                        ) : (
                          <ChevronDownIcon className="w-4 h-4" />
                        ))}
                    </div>
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
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {getCurrentItems().map(item => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEditRecipe(item)}
                        disabled={loadingEdit}
                        className="text-blue-600 hover:text-blue-900 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                        title={t('pages.recipes.editRecipe')}
                      >
                          <PencilIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteRecipe(item)}
                        disabled={deleting}
                        className="text-red-600 hover:text-red-900 disabled:opacity-50 cursor-pointer"
                        title={t('pages.recipes.deleteRecipe')}
                      >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleAddPhotoToRecipe(item)}
                        disabled={uploadingPhoto}
                        className="text-green-600 hover:text-green-900 disabled:opacity-50 cursor-pointer"
                        title={t('pages.recipes.addPhoto')}
                      >
                          <PhotoIcon className="w-4 h-4" />
                        </button>
                      </div>
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
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                        {item.type || naText}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {item.countryCode || naText}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {item.caloriesPer100 || item.caloriesPer100 === 0
                        ? `${item.caloriesPer100} cal/100g`
                        : naText}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="flex items-center gap-3">
                        <span>{item.numberOfRecipeServings || naText}</span>
                        <button
                          onClick={() => handleShowServings(item?.servingOptions)}
                          className="text-blue-600 hover:text-blue-900 underline cursor-pointer text-sm"
                        >
                          {t('pages.recipes.servings')}
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        {item.photoUrl ? (
                          <button
                            onClick={() => handleShowImage(item.photoUrl)}
                            className="text-blue-600 hover:text-blue-900 underline cursor-pointer"
                          >
                            {t('pages.recipes.view')}
                          </button>
                        ) : (
                          <span className="text-sm text-gray-500">{naText}</span>
                        )}
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
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${item.isVerified ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}
                      >
                        {item.isVerified ? yesText : noText}
                      </span>
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

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
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto m-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-gray-900">
                {editingRecipeId
                  ? t('pages.recipes.editRecipe')
                  : t('pages.recipes.create')}
              </h2>
              <button
                onClick={() => {
                  resetForm()
                  setIsCreateModalOpen(false)
                }}
                className="text-gray-400 hover:text-gray-500"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Recipe Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('pages.recipes.recipeName')}
                </label>
                <input
                  type="text"
                  value={recipeName}
                  onChange={e => setRecipeName(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  placeholder={t('pages.recipes.enterRecipeName')}
                />
              </div>

              {/* Country Code */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('pages.recipes.countryCode')}
                </label>
                <select
                  value={selectedCountryCode}
                  onChange={e => setSelectedCountryCode(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
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

              {/* Number of Servings */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('pages.recipes.numberOfServings')}
                </label>
                <input
                  type="number"
                  min="1"
                  value={numberOfRecipeServings}
                  onChange={e => setNumberOfRecipeServings(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                />
              </div>

              {/* Total Time */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('pages.recipes.totalTimeMinutes')}
                </label>
                <input
                  value={totalTimeInMinutes}
                  onChange={e => setTotalTimeInMinutes(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                />
              </div>

              {/* Photo Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('pages.recipes.recipePhoto')}
                </label>
                <div className="flex items-center gap-4">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoSelect}
                    className="hidden"
                    id="photo-upload"
                  />
                  <label
                    htmlFor="photo-upload"
                    className="cursor-pointer bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-md flex items-center gap-2"
                  >
                    <PhotoIcon className="w-5 h-5" />
                    {selectedPhoto
                      ? t('pages.recipes.changePhoto')
                      : t('pages.recipes.uploadPhoto')}
                  </label>
                  {photoPreview && (
                    <img
                      src={photoPreview}
                      alt={t('pages.recipes.preview')}
                      className="w-24 h-24 object-cover rounded"
                    />
                  )}
                  {uploadingPhoto && (
                    <span className="text-sm text-gray-500">
                      {t('pages.recipes.uploading')}
                    </span>
                  )}
                </div>
              </div>

              {/* Search Ingredients */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('pages.recipes.searchIngredients')}
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={searchText}
                    onChange={e => setSearchText(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleSearch()
                    }}
                    className="flex-1 border border-gray-300 rounded-md px-3 py-2"
                    placeholder={t('pages.recipes.searchFoodItems')}
                  />
                  <button
                    onClick={handleSearch}
                    disabled={searching || !searchText.trim()}
                    className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    {searching
                      ? t('pages.recipes.searching')
                      : t('pages.recipes.search')}
                  </button>
                </div>
                {searchResults.length > 0 && (
                  <div className="mt-2 max-h-40 overflow-y-auto border border-gray-200 rounded-md divide-y">
                    {searchResults.map((item, idx) => (
                      <div
                        key={idx}
                        className="p-2 flex items-center justify-between hover:bg-gray-50"
                      >
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {item?.name || item?.title || t('pages.recipes.unnamed')}
                          </div>
                          <div className="text-xs text-gray-600">
                            {item?.caloriesPer100
                              ? `${item.caloriesPer100} cal/100g`
                              : ''}
                          </div>
                        </div>
                        <button
                          onClick={() => addIngredientToRecipe(item)}
                          className="bg-green-600 text-white px-3 py-1 rounded-md hover:bg-green-700 text-sm"
                        >
                          {t('pages.recipes.add')}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Selected Ingredients */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('pages.recipes.selectedIngredients')}
                </label>
                <div className="space-y-2 max-h-64 overflow-y-auto border border-gray-200 rounded-md p-3">
                  {selectedIngredients.length === 0 ? (
                    <div className="text-sm text-gray-500">
                      {t('pages.recipes.noIngredientsYet')}
                    </div>
                  ) : (
                    selectedIngredients.map((ing, index) => {
                      const unitOptions = getIngredientUnitOptions(ing)
                      return (
                        <div key={index} className="p-3 bg-gray-50 rounded-md">
                          <div className="flex items-center justify-between mb-2">
                            <div className="font-medium text-gray-900">
                              {ing.name}
                            </div>
                            <button
                              onClick={() => removeIngredient(index)}
                              className="text-red-600 hover:text-red-800"
                            >
                              <XMarkIcon className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              step="any"
                              min="0"
                              value={ing.weight}
                              onChange={e =>
                                updateIngredientWeight(index, e.target.value)
                              }
                              className="w-24 border border-gray-300 rounded-md px-2 py-1 text-sm"
                              placeholder={t('pages.recipes.quantity')}
                            />
                            <select
                              value={ing.unit}
                              onChange={e =>
                                updateIngredientUnit(index, e.target.value)
                              }
                              className="border border-gray-300 rounded-md px-2 py-1 text-sm"
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
                            <div className="text-xs text-gray-600">
                              {ingredientCalories[index] || 0} cal
                            </div>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
                {selectedIngredients.length > 0 && (
                  <div className="mt-2 p-2 bg-blue-50 rounded text-sm">
                    <div className="font-medium text-gray-900">
                      {t('pages.recipes.totalNutrients')}:
                    </div>
                    <div className="text-gray-700">
                      {t('pages.recipes.calories')}: {Math.round(selectedIngredientsTotals.totalCalories)} |
                      {' '}{t('pages.recipes.protein')}: {Math.round(selectedIngredientsTotals.totalProtein)}g
                      {' '}| {t('pages.recipes.carbs')}: {Math.round(selectedIngredientsTotals.totalCarbs)}
                      g | {t('pages.recipes.fat')}: {Math.round(selectedIngredientsTotals.totalFat)}g
                    </div>
                  </div>
                )}
              </div>

              {/* Recipe Instructions */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('pages.recipes.recipeInstructionsOnePerLine')}
                </label>
                <textarea
                  value={recipeInstructions}
                  onChange={e => setRecipeInstructions(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  rows="4"
                  placeholder={t('pages.recipes.enterRecipeInstructions')}
                />
              </div>

              {/* Error Message */}
              {error && (
                <div className="p-3 rounded border border-red-200 bg-red-50 text-red-800 text-sm">
                  {error}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end gap-2 pt-4 border-t">
                <button
                  onClick={() => {
                    resetForm()
                    setIsCreateModalOpen(false)
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
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
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {submitting
                    ? editingRecipeId
                      ? t('pages.recipes.updating')
                      : t('pages.recipes.creating')
                    : editingRecipeId
                      ? t('pages.recipes.updateRecipe')
                      : t('pages.recipes.create')}
                </button>
              </div>
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
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-2/3 shadow-lg rounded-md bg-white">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                {t('pages.recipes.servingOptions')}
              </h3>
              <button
                onClick={() => {
                  setIsServingsModalOpen(false)
                  setSelectedServingsView([])
                }}
                className="text-gray-400 hover:text-gray-500"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>
            {selectedServingsView.length === 0 ? (
              <div className="text-sm text-gray-600">
                {t('pages.recipes.noServingOptions')}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {t('pages.recipes.unit')}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {t('pages.recipes.value')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {selectedServingsView.map((serving, index) => (
                      <tr key={`${serving?.unitName || 'unit'}-${index}`}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {serving?.unitName || naText}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {serving?.value || serving?.value === 0
                            ? serving.value
                            : naText}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="mt-4">
              <button
                onClick={() => {
                  setIsServingsModalOpen(false)
                  setSelectedServingsView([])
                }}
                className="btn-primary"
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
