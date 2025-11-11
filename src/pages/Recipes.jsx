import { useState, useEffect, useMemo } from 'react'
import {
  MagnifyingGlassIcon,
  PlusIcon,
  XMarkIcon,
  PhotoIcon,
  PencilIcon,
  TrashIcon,
  ChevronUpIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline'
import { getRecipesByCountryCode, searchFoodItems, getItemsByIds, addItem, updateItem, deleteItem, addPhotoToItem, saveImageToImgb } from '../services/api'
import LZString from 'lz-string'

const AVAILABLE_COUNTRY_CODES = {
  es: 'es',
  gb: 'gb',
  hu: 'hu',
  it: 'it',
  ro: 'ro',
  uk: 'uk',
  us: 'us',
}

const Recipes = () => {
  const [recipeItems, setRecipeItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterCountryCode, setFilterCountryCode] = useState('RO')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(25)
  const [sortColumn, setSortColumn] = useState(null)
  const [sortDirection, setSortDirection] = useState('asc')

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
  const [numberOfServings, setNumberOfServings] = useState(2)
  const [selectedPhoto, setSelectedPhoto] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [existingPhotoUrl, setExistingPhotoUrl] = useState(null)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // For image modal
  const [selectedImage, setSelectedImage] = useState(null)
  const [isImageModalOpen, setIsImageModalOpen] = useState(false)

  // For ingredient detail modal
  const [selectedIngredientsView, setSelectedIngredientsView] = useState(null)
  const [isIngredientsModalOpen, setIsIngredientsModalOpen] = useState(false)

  useEffect(() => {
    const loadRecipes = async () => {
      try {
        setLoading(true)
        setError(null)

        // Check if data exists in localStorage first (cached by country code)
        const cacheKey = `recipes_${filterCountryCode}`
        const cachedData = LZString.decompressFromUTF16(localStorage.getItem(cacheKey)) || localStorage.getItem(cacheKey)

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
        setError('Failed to load recipes. Please try again.')
        setLoading(false)
      }
    }
    loadRecipes()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterCountryCode])

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

      const data = await getRecipesByCountryCode({ countryCode: filterCountryCode })
      const items = data || []

      // Cache the data by country code
      const compressed = LZString.compressToUTF16(JSON.stringify({ items }))
      localStorage.setItem(cacheKey, compressed)

      setLoading(false)
      setRecipeItems(items)

      console.log('Loaded from API and cached')
    } catch (err) {
      console.error('Error refreshing data:', err)
      setError('Failed to refresh data')
      setLoading(false)
    }
  }

  // Handle sorting
  const handleSort = (column) => {
    if (sortColumn === column) {
      // Toggle direction if same column
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
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
      filtered = recipeItems.filter(item =>
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
            aValue = parseFloat(a.totalCalories) || 0
            bValue = parseFloat(b.totalCalories) || 0
            return (aValue - bValue) * factor
          case 'isPublic':
            aValue = a.isPublic === true ? 1 : (a.isPublic === false ? 0 : -1)
            bValue = b.isPublic === true ? 1 : (b.isPublic === false ? 0 : -1)
            return (aValue - bValue) * factor
          case 'isVerified':
            aValue = a.isVerified === true ? 1 : (a.isVerified === false ? 0 : -1)
            bValue = b.isVerified === true ? 1 : (b.isVerified === false ? 0 : -1)
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

  const handleShowImage = (imageUrl) => {
    setSelectedImage(imageUrl)
    setIsImageModalOpen(true)
  }

  const handleShowIngredients = (ingredients) => {
    setSelectedIngredientsView(ingredients)
    setIsIngredientsModalOpen(true)
  }

  const handleSearch = async () => {
    if (!searchText.trim()) return
    try {
      setSearching(true)
      setError(null)
      // Search with onlyRecipes = false
      const results = await searchFoodItems({
        searchText,
        userId: 'BACKOFFICE_ADMIN',
        onlyRecipes: false,
        countryCode: selectedCountryCode
      })
      // Filter out type = 'recipes', keep only type = 'food'
      const foodItems = results.filter(item => {
        const itemType = (item?.itemType || item?.type || '').toString().toLowerCase()
        return itemType === 'food' && itemType !== 'recipe' && itemType !== 'recipes'
      })
      setSearchResults(foodItems)
    } catch (e) {
      console.error('Search failed', e)
      setError('Failed to search items')
    } finally {
      setSearching(false)
    }
  }

  const addIngredientToRecipe = (item) => {
    // Add ingredient with default quantity of 100g
    const ingredient = {
      id: item.id || item.itemId || item._id,
      name: item.name || item.title || 'Unnamed',
      quantity: '100',
      unit: 'g',
      category: item.category || null,
      servingDisplay: '100 g',
      servingAmount: '100',
      weight: '100',
      // Store full item data for nutrient calculation
      totalCalories: item.totalCalories || 0,
      totalNutrients: item.totalNutrients || {},
      cholesterol: item.cholesterol || 0,
      potassium: item.potassium || 0
    }
    setSelectedIngredients([...selectedIngredients, ingredient])
    setSearchText('')
    setSearchResults([])
  }

  const removeIngredient = (index) => {
    setSelectedIngredients(selectedIngredients.filter((_, i) => i !== index))
  }

  // Helper function to convert weight to grams based on unit
  const convertToGrams = (weight, unit) => {
    const weightNum = parseFloat(weight) || 0
    switch (unit) {
      case 'g':
        return weightNum
      case 'kg':
        return weightNum * 1000
      case 'ml':
        return weightNum // Approximate: 1ml ≈ 1g for liquids
      case 'l':
        return weightNum * 1000 // Approximate: 1l ≈ 1000g
      case 'oz':
        return weightNum * 28.3495 // 1 oz = 28.3495 g
      default:
        return weightNum
    }
  }

  // Helper function to convert grams to a specific unit
  const convertFromGrams = (grams, unit) => {
    const gramsNum = parseFloat(grams) || 0
    switch (unit) {
      case 'g':
        return gramsNum
      case 'kg':
        return gramsNum / 1000
      case 'ml':
        return gramsNum // Approximate
      case 'l':
        return gramsNum / 1000 // Approximate
      case 'oz':
        return gramsNum / 28.3495
      default:
        return gramsNum
    }
  }

  const updateIngredientWeight = (index, weight) => {
    const updated = [...selectedIngredients]
    const ingredient = updated[index]
    const weightStr = weight.toString().trim()
    const weightNum = parseFloat(weightStr) || 0

    // Update weight (keep as string for input field compatibility)
    ingredient.weight = weightStr

    // Update quantity and servingAmount to match weight
    ingredient.quantity = weightStr
    ingredient.servingAmount = weightStr

    // Update servingDisplay with formatted value
    const displayValue = weightNum > 0 ? weightNum : weightStr
    ingredient.servingDisplay = `${displayValue} ${ingredient.unit}`

    setSelectedIngredients(updated)
  }

  const updateIngredientUnit = (index, unit) => {
    const updated = [...selectedIngredients]
    const ingredient = updated[index]
    const oldUnit = ingredient.unit
    const oldWeight = parseFloat(ingredient.weight) || 0

    // Convert current weight to grams, then to new unit
    const weightInGrams = convertToGrams(oldWeight, oldUnit)
    const newWeight = convertFromGrams(weightInGrams, unit)

    // Format the new weight (round to reasonable precision)
    const formattedWeight = newWeight > 0
      ? (newWeight % 1 === 0 ? newWeight.toString() : newWeight.toFixed(2))
      : '0'

    // Update all fields
    ingredient.unit = unit
    ingredient.weight = formattedWeight
    ingredient.quantity = formattedWeight
    ingredient.servingAmount = formattedWeight
    ingredient.servingDisplay = `${formattedWeight} ${unit}`

    setSelectedIngredients(updated)
  }

  // Calculate nutrients based on ingredients
  const calculateNutrients = (ingredients, updateWeightAfterCooking = true) => {
    const totalNutrs = ingredients.reduce(
      (acc, ingredient) => {
        // Convert weight to grams for consistent calculation
        const amountInGrams = convertToGrams(ingredient.weight || 0, ingredient.unit || 'g')
        const totalCalories = acc.totalCalories + ((ingredient?.totalCalories || 0) * amountInGrams) / 100
        const totalQuantity = acc.totalQuantity + parseInt(amountInGrams, 10)

        const totalProtein =
          acc.totalProtein +
          (amountInGrams * (ingredient?.totalNutrients?.proteinsInGrams || 0)) / 100
        const totalCarbs =
          acc.totalCarbs +
          (amountInGrams * (ingredient?.totalNutrients?.carbohydratesInGrams || 0)) / 100
        const totalFat =
          acc.totalFat + (amountInGrams * (ingredient?.totalNutrients?.fatInGrams || 0)) / 100
        const totalFiber =
          acc.totalFiber +
          (amountInGrams * (ingredient?.totalNutrients?.fibreInGrams || 0)) / 100
        const totalSaturatedFat =
          acc.totalSaturatedFat +
          (amountInGrams * (ingredient?.totalNutrients?.fattyAcidsTotalSaturatedInGrams || 0)) / 100
        const totalUnSaturatedFat =
          acc.totalUnSaturatedFat +
          (amountInGrams * (ingredient?.totalNutrients?.fattyAcidsTotalUnSaturatedInGrams || 0)) / 100
        const totalSugar =
          acc.totalSugar +
          (amountInGrams * (ingredient?.totalNutrients?.sugarsInGrams || 0)) / 100

        const totalSalt =
          acc.totalSalt +
          (amountInGrams * (ingredient?.totalNutrients?.saltInGrams || 0)) / 100

        const totalCholesterol =
          acc.totalCholesterol + (amountInGrams * (ingredient.cholesterol || 0)) / 100

        const totalPotassium =
          acc.totalPotassium + (amountInGrams * (ingredient.potassium || 0)) / 100

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
          totalSalt,
          totalCholesterol,
          totalPotassium,
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
        totalSalt: 0,
        totalCholesterol: 0,
        totalPotassium: 0,
      },
    )
    return totalNutrs
  }

  // Generate default serving options based on recipe details
  const generateDefaultServings = (totalWeightInGrams, numServings) => {
    const totalWeight = totalWeightInGrams || 100
    const servings = numServings || numberOfServings || 2

    // Calculate per-serving weight
    const perServingWeight = totalWeight / servings

    const servingOptions = [
      {
        amount: 100,
        unit: 'grams',
        innerName: 'Grame',
        profileId: 0,
        name: 'Grame'
      }
    ]

    // Add portion serving (profileId: 1) - represents 1 serving
    if (perServingWeight > 0) {
      servingOptions.push({
        amount: Math.round(perServingWeight * 100) / 100, // Round to 2 decimal places
        unit: 'grams',
        innerName: 'Portion',
        profileId: 1,
        name: `Portion (${Math.round(perServingWeight * 100) / 100}g)`
      })

      // Add oz option for portion (optional)
      const perServingWeightOz = perServingWeight / 28.3495
      servingOptions.push({
        amount: Math.round(perServingWeightOz * 100) / 100,
        unit: 'oz',
        innerName: 'oz',
        profileId: 1,
        name: `Oz (${Math.round(perServingWeightOz * 100) / 100}oz)`
      })
    }

    return servingOptions
  }

  const handlePhotoSelect = (e) => {
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
    setNumberOfServings(2)
    setSelectedPhoto(null)
    setPhotoPreview(null)
    setExistingPhotoUrl(null)
    setEditingRecipeId(null)
    setEditingUserId(null)
    setSearchText('')
    setSearchResults([])
    setError(null)
  }

  const handleEditRecipe = async (recipe) => {
    try {
      // Fetch full recipe data by ID
      const recipeId = recipe.id || recipe.itemId || recipe._id
      if (!recipeId) {
        alert('Recipe ID not found')
        return
      }

      const resp = await getItemsByIds({ ids: [recipeId] })
      const fullRecipe = resp?.data?.[0] || resp?.items?.[0]

      if (!fullRecipe) {
        alert('Failed to load recipe data')
        return
      }

      setEditingRecipeId(recipeId)
      setEditingUserId(fullRecipe.createdByUserId || 'BACKOFFICE_ADMIN')
      setRecipeName(fullRecipe.name || '')
      setSelectedCountryCode(fullRecipe.countryCode || 'RO')
      setRecipeInstructions(fullRecipe.recipeSteps?.instructions?.join('\n') || '')
      setTotalTimeInMinutes(fullRecipe.totalTimeInMinutes?.toString() || '')
      setNumberOfServings(fullRecipe.numberOfServings || 2)
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
            const detailedItems = ingredientResp?.data || ingredientResp?.items || []

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
              if (detailed) {
                return {
                  ...ing,
                  // Store full item data for nutrient calculation
                  totalCalories: detailed.totalCalories || 0,
                  totalNutrients: detailed.totalNutrients || {},
                  cholesterol: detailed.cholesterol || 0,
                  potassium: detailed.potassium || 0
                }
              }
              // If detailed data not found, return original ingredient
              // but try to use any existing nutrient data
              return {
                ...ing,
                totalCalories: ing.totalCalories || 0,
                totalNutrients: ing.totalNutrients || {},
                cholesterol: ing.cholesterol || 0,
                potassium: ing.potassium || 0
              }
            })
            setSelectedIngredients(enrichedIngredients)
          } else {
            // No valid IDs, use ingredients as-is
            setSelectedIngredients(ingredients)
          }
        } catch (e) {
          console.warn('Failed to fetch ingredient details, using recipe ingredients as-is', e)
          // Fallback to original ingredients
          setSelectedIngredients(ingredients)
        }
      } else {
        setSelectedIngredients([])
      }

      setIsCreateModalOpen(true)
    } catch (e) {
      console.error('Failed to load recipe for editing', e)
      alert('Failed to load recipe data. Please try again.')
    }
  }

  const handleDeleteRecipe = async (recipe) => {
    const confirmed = confirm(`Are you sure you want to delete "${recipe.name}"?`)
    if (!confirmed) return

    try {
      setDeleting(true)
      await deleteItem({
        itemId: recipe.id,
        itemType: 'FOOD',
        userId: recipe.createdByUserId || 'BACKOFFICE_ADMIN'
      })
      alert('Recipe deleted successfully!')
      await new Promise(resolve => setTimeout(resolve, 1500))
      refreshData()
    } catch (e) {
      console.error('Failed to delete recipe', e)
      alert('Failed to delete recipe. Please try again.')
    } finally {
      setDeleting(false)
    }
  }

  const handleAddPhotoToRecipe = async (recipe) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = async (e) => {
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
            userId: recipe.createdByUserId || 'BACKOFFICE_ADMIN',
            photoUrl: photoUrl
          })
          alert('Photo added successfully!')
          await new Promise(resolve => setTimeout(resolve, 1500))
          refreshData()
        } else {
          alert('Failed to upload photo')
        }
      } catch (e) {
        console.error('Failed to add photo', e)
        alert('Failed to add photo. Please try again.')
      } finally {
        setUploadingPhoto(false)
      }
    }
    input.click()
  }

  const handleCreateRecipe = async () => {
    if (!recipeName.trim()) {
      alert('Please provide a recipe name')
      return
    }
    if (selectedIngredients.length === 0) {
      alert('Please add at least one ingredient')
      return
    }

    try {
      setSubmitting(true)
      setError(null)

      // Calculate nutrients
      const calculatedNutrients = calculateNutrients(selectedIngredients)
      const weightAfterCooking = calculatedNutrients.totalQuantity

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
      const serving = generateDefaultServings(calculatedNutrients.totalQuantity, parseInt(numberOfServings) || 2)

      // Prepare ingredients for API (without full item data)
      const ingredientsForAPI = selectedIngredients.map(ing => ({
        id: ing.id,
        name: ing.name,
        quantity: ing.quantity,
        unit: ing.unit,
        category: ing.category,
        servingDisplay: ing.servingDisplay,
        servingAmount: ing.servingAmount,
        weight: ing.weight
      }))

      // Prepare recipe data
      const recipeData = {
        type: 'recipe',
        countryCode: selectedCountryCode,
        serving: serving,
        ingredients: ingredientsForAPI,
        photoUrl: photoUrl,
        recipeSteps: {
          instructions: instructions
        },
        totalTimeInMinutes: parseInt(totalTimeInMinutes) || 0,
        totalCalories: calculatedNutrients.totalCalories,
        name: recipeName.trim(),
        isPublic: true,
        numberOfServings: parseInt(numberOfServings) || 2,
        totalNutrients: {
          vitaminAInGrams: 0,
          proteinsInGrams: calculatedNutrients.totalProtein,
          fatInGrams: calculatedNutrients.totalFat,
          fattyAcidsTotalSaturatedInGrams: calculatedNutrients.totalSaturatedFat,
          fattyAcidsTotalUnSaturatedInGrams: calculatedNutrients.totalUnSaturatedFat,
          carbohydratesInGrams: calculatedNutrients.totalCarbs,
          saltInGrams: calculatedNutrients.totalSalt,
          fibreInGrams: calculatedNutrients.totalFiber,
          sugarsInGrams: calculatedNutrients.totalSugar,
          totalQuantity: calculatedNutrients.totalQuantity,
          weightAfterCooking: weightAfterCooking
        }
      }

      if (editingRecipeId) {
        // Update existing recipe
        await updateItem({
          userId: editingUserId,
          itemId: editingRecipeId,
          itemType: 'FOOD',
          data: recipeData
        })
        alert('Recipe updated successfully!')
      } else {
        // Create new recipe
        await addItem({
          userId: 'BACKOFFICE_ADMIN',
          itemType: 'FOOD',
          data: recipeData,
          countryCode: selectedCountryCode
        })
        alert('Recipe created successfully!')
      }

      // Reset form
      resetForm()
      setIsCreateModalOpen(false)

      // Refresh recipes list
      await new Promise(resolve => setTimeout(resolve, 1500))
      refreshData()
    } catch (e) {
      console.error('Failed to save recipe', e)
      alert(`Failed to ${editingRecipeId ? 'update' : 'create'} recipe. Please try again.`)
    } finally {
      setSubmitting(false)
      setUploadingPhoto(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Recipes</h1>
            <p className="text-gray-600 mt-2">Manage recipes</p>
          </div>
        </div>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading recipes...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Recipes</h1>
          <p className="text-gray-600 mt-2">Manage recipes</p>
        </div>
        <div className="flex gap-2 items-center">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-700 whitespace-nowrap">Country:</label>
            <select
              value={filterCountryCode}
              onChange={(e) => {
                setFilterCountryCode(e.target.value)
              }}
              className="px-2 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {Object.entries(AVAILABLE_COUNTRY_CODES).map(([key, value]) => (
                <option key={key} value={value}>{value.toUpperCase()}</option>
              ))}
            </select>
          </div>
          <button
            onClick={refreshData}
            className="btn-secondary flex items-center"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh Data
          </button>
          <button
            onClick={() => {
              resetForm()
              setIsCreateModalOpen(true)
            }}
            className="btn-primary flex items-center"
          >
            <PlusIcon className="w-4 h-4 mr-2" />
            Create Recipe
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-1 gap-6">
        <div className="card p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-8 w-8 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total Recipes</p>
              <p className="text-2xl font-semibold text-gray-900">{recipeItems.length}</p>
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
            placeholder="Search recipes by name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input pl-10"
          />
        </div>
      </div>


      {/* Recipes Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                <th
                  onClick={() => handleSort('name')}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                >
                  <div className="flex items-center gap-1">
                    Name
                    {sortColumn === 'name' && (
                      sortDirection === 'asc' ? <ChevronUpIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />
                    )}
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Country</th>
                <th
                  onClick={() => handleSort('calories')}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                >
                  <div className="flex items-center gap-1">
                    Calories
                    {sortColumn === 'calories' && (
                      sortDirection === 'asc' ? <ChevronUpIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />
                    )}
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Servings</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Photo</th>
                <th
                  onClick={() => handleSort('isPublic')}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                >
                  <div className="flex items-center gap-1">
                    Public
                    {sortColumn === 'isPublic' && (
                      sortDirection === 'asc' ? <ChevronUpIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('isVerified')}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                >
                  <div className="flex items-center gap-1">
                    Verified
                    {sortColumn === 'isVerified' && (
                      sortDirection === 'asc' ? <ChevronUpIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />
                    )}
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {getCurrentItems().map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEditRecipe(item)}
                        className="text-blue-600 hover:text-blue-900"
                        title="Edit recipe"
                      >
                        <PencilIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteRecipe(item)}
                        disabled={deleting}
                        className="text-red-600 hover:text-red-900 disabled:opacity-50"
                        title="Delete recipe"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleAddPhotoToRecipe(item)}
                        disabled={uploadingPhoto}
                        className="text-green-600 hover:text-green-900 disabled:opacity-50"
                        title="Add photo"
                      >
                        <PhotoIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900 max-w-xs truncate" title={item.name}>
                      {item.name || 'N/A'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                      {item.type || 'N/A'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.countryCode || 'N/A'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.totalCalories || 'N/A'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.numberOfServings || 'N/A'}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {item.photoUrl ? (
                      <button
                        onClick={() => handleShowImage(item.photoUrl)}
                        className="text-blue-600 hover:text-blue-900 underline"
                      >
                        View
                      </button>
                    ) : (
                      'N/A'
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${item.isPublic !== null && item.isPublic !== undefined ? (item.isPublic ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800') : 'bg-gray-100 text-gray-800'}`}>
                      {item.isPublic !== null && item.isPublic !== undefined ? (item.isPublic ? 'Yes' : 'No') : 'N/A'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${item.isVerified ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {item.isVerified ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {item.dateTimeCreated ? new Date(item.dateTimeCreated).toLocaleDateString() : 'N/A'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200">
          <div className="flex items-center gap-4">
            <label className="text-sm text-gray-700">Items per page:</label>
            <select
              value={itemsPerPage}
              onChange={(e) => {
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

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>

            <span className="text-sm text-gray-700">
              Page {currentPage} of {getTotalPages() || 1}
            </span>

            <button
              onClick={() => setCurrentPage(prev => Math.min(getTotalPages(), prev + 1))}
              disabled={currentPage >= getTotalPages()}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>

          <div className="text-sm text-gray-700">
            Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredRecipes.length)} of{' '}
            {filteredRecipes.length} results
          </div>
        </div>
      </div>

      {/* Create Recipe Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto m-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-gray-900">
                {editingRecipeId ? 'Edit Recipe' : 'Create Recipe'}
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Recipe Name</label>
                <input
                  type="text"
                  value={recipeName}
                  onChange={(e) => setRecipeName(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  placeholder="Enter recipe name"
                />
              </div>

              {/* Country Code */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Country Code</label>
                <select
                  value={selectedCountryCode}
                  onChange={(e) => setSelectedCountryCode(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                >
                  {Object.entries(AVAILABLE_COUNTRY_CODES).map(([key, value]) => (
                    <option key={key} value={value}>{value.toUpperCase()}</option>
                  ))}
                </select>
              </div>

              {/* Number of Servings */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Number of Servings</label>
                <input
                  value={numberOfServings}
                  onChange={(e) => setNumberOfServings(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                />
              </div>

              {/* Total Time */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Total Time (minutes)</label>
                <input
                  value={totalTimeInMinutes}
                  onChange={(e) => setTotalTimeInMinutes(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                />
              </div>

              {/* Photo Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Recipe Photo</label>
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
                    {selectedPhoto ? 'Change Photo' : 'Upload Photo'}
                  </label>
                  {photoPreview && (
                    <img src={photoPreview} alt="Preview" className="w-24 h-24 object-cover rounded" />
                  )}
                  {uploadingPhoto && <span className="text-sm text-gray-500">Uploading...</span>}
                </div>
              </div>

              {/* Search Ingredients */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Search Ingredients</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSearch() }}
                    className="flex-1 border border-gray-300 rounded-md px-3 py-2"
                    placeholder="Search for food items..."
                  />
                  <button
                    onClick={handleSearch}
                    disabled={searching || !searchText.trim()}
                    className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    {searching ? 'Searching...' : 'Search'}
                  </button>
                </div>
                {searchResults.length > 0 && (
                  <div className="mt-2 max-h-40 overflow-y-auto border border-gray-200 rounded-md divide-y">
                    {searchResults.map((item, idx) => (
                      <div key={idx} className="p-2 flex items-center justify-between hover:bg-gray-50">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{item?.name || item?.title || 'Unnamed'}</div>
                          <div className="text-xs text-gray-600">
                            {item?.totalCalories ? `${item.totalCalories} cal/100g` : ''}
                          </div>
                        </div>
                        <button
                          onClick={() => addIngredientToRecipe(item)}
                          className="bg-green-600 text-white px-3 py-1 rounded-md hover:bg-green-700 text-sm"
                        >
                          Add
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Selected Ingredients */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Selected Ingredients</label>
                <div className="space-y-2 max-h-64 overflow-y-auto border border-gray-200 rounded-md p-3">
                  {selectedIngredients.length === 0 ? (
                    <div className="text-sm text-gray-500">No ingredients added yet</div>
                  ) : (
                    selectedIngredients.map((ing, index) => {
                      const calculatedNutrients = calculateNutrients([ing])
                      return (
                        <div key={index} className="p-3 bg-gray-50 rounded-md">
                          <div className="flex items-center justify-between mb-2">
                            <div className="font-medium text-gray-900">{ing.name}</div>
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
                              onChange={(e) => updateIngredientWeight(index, e.target.value)}
                              className="w-24 border border-gray-300 rounded-md px-2 py-1 text-sm"
                              placeholder="Quantity"
                            />
                            <select
                              value={ing.unit}
                              onChange={(e) => updateIngredientUnit(index, e.target.value)}
                              className="border border-gray-300 rounded-md px-2 py-1 text-sm"
                            >
                              <option value="g">g</option>
                              <option value="kg">kg</option>
                              <option value="ml">ml</option>
                              <option value="l">l</option>
                              <option value="oz">oz</option>
                            </select>
                            <div className="text-xs text-gray-600">
                              {Math.round(calculatedNutrients.totalCalories)} cal
                            </div>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
                {selectedIngredients.length > 0 && (
                  <div className="mt-2 p-2 bg-blue-50 rounded text-sm">
                    <div className="font-medium text-gray-900">Total Nutrients:</div>
                    {(() => {
                      const totals = calculateNutrients(selectedIngredients)
                      return (
                        <div className="text-gray-700">
                          Calories: {Math.round(totals.totalCalories)} |
                          Protein: {Math.round(totals.totalProtein)}g |
                          Carbs: {Math.round(totals.totalCarbs)}g |
                          Fat: {Math.round(totals.totalFat)}g
                        </div>
                      )
                    })()}
                  </div>
                )}
              </div>

              {/* Recipe Instructions */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Recipe Instructions (one per line)</label>
                <textarea
                  value={recipeInstructions}
                  onChange={(e) => setRecipeInstructions(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  rows="4"
                  placeholder="Enter recipe instructions, one per line..."
                />
              </div>

              {/* Error Message */}
              {error && (
                <div className="p-3 rounded border border-red-200 bg-red-50 text-red-800 text-sm">{error}</div>
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
                  Cancel
                </button>
                <button
                  onClick={handleCreateRecipe}
                  disabled={submitting || !recipeName.trim() || selectedIngredients.length === 0}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {submitting
                    ? (editingRecipeId ? 'Updating...' : 'Creating...')
                    : (editingRecipeId ? 'Update Recipe' : 'Create Recipe')
                  }
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
              alt="Preview"
              className="max-w-full max-h-[90vh] rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}

      {/* Ingredients Modal */}
      {isIngredientsModalOpen && selectedIngredientsView && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 shadow-lg rounded-md bg-white">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">Ingredients</h3>
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
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unit</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Weight</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {selectedIngredientsView.map((ing, index) => (
                    <tr key={index}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{ing.name || 'N/A'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{ing.quantity || 'N/A'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{ing.unit || 'N/A'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{ing.category || 'N/A'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{ing.weight || 'N/A'}</td>
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
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Recipes

