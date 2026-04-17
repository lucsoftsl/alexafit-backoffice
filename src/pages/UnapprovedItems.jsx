import { useState, useEffect } from 'react'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import {
  MagnifyingGlassIcon,
  CheckIcon,
  ExclamationTriangleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import { getUnapprovedItems, getUserByUserId, setItemVerifiedStatus, setItemsVerifiedStatus, deleteItem, deleteItems, formatUserData, formatSubscriptionStatus, formatPaymentData } from '../services/api'
import UserDetailModal from '../components/UserDetailModal'
import { selectIsAdmin } from '../store/userSlice'
import { useSelectedCountry } from '../util/useSelectedCountry'

import LZString from 'lz-string'

const UnapprovedItems = () => {
  const { t } = useTranslation()
  const [sharedCountry, setSharedCountry] = useSelectedCountry()
  const [foodItems, setFoodItems] = useState([])
  const [exerciseItems, setExerciseItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterCountryCode, setFilterCountryCode] = useState(sharedCountry)
  const [showOnlyAIGenerated, setShowOnlyAIGenerated] = useState(false)
  const [selectedFoodItemIds, setSelectedFoodItemIds] = useState([])
  const [selectedExerciseItemIds, setSelectedExerciseItemIds] = useState([])
  const [sortConfig, setSortConfig] = useState({
    food: { key: 'dateTimeCreated', direction: 'desc' },
    exercise: { key: 'dateTimeCreated', direction: 'desc' }
  })
  const [activeTab, setActiveTab] = useState('food') // 'food' or 'exercise'
  const [itemsPerPage, setItemsPerPage] = useState(25)
  const [currentPage, setCurrentPage] = useState(1)
  const isAdmin = useSelector(selectIsAdmin)

  // For unverify item controls
  const [unverifyItemId, setUnverifyItemId] = useState('')
  const [unverifyItemType, setUnverifyItemType] = useState('')
  const [verifiedItems, setVerifiedItems] = useState([])

  // For ingredient detail modal
  const [selectedIngredients, setSelectedIngredients] = useState(null)
  const [isIngredientsModalOpen, setIsIngredientsModalOpen] = useState(false)
  const [selectedServings, setSelectedServings] = useState(null)
  const [isServingsModalOpen, setIsServingsModalOpen] = useState(false)
  const [selectedNutritionData, setSelectedNutritionData] = useState(null)
  const [isNutritionModalOpen, setIsNutritionModalOpen] = useState(false)

  // For image modal
  const [selectedImage, setSelectedImage] = useState(null)
  const [isImageModalOpen, setIsImageModalOpen] = useState(false)

  // For user detail modal
  const [selectedUser, setSelectedUser] = useState(null)
  const [isUserModalOpen, setIsUserModalOpen] = useState(false)

  useEffect(() => {
    const loadUnapprovedItems = async () => {
      // Only fetch if admin
      if (!isAdmin) {
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setError(null)

        // Check if data exists in localStorage first
        const cachedData = LZString.decompressFromUTF16(localStorage.getItem('unapprovedItems')) || localStorage.getItem('unapprovedItems')

        if (cachedData) {
          const data = JSON.parse(cachedData)
          setFoodItems(data.foodItems?.items || [])
          setExerciseItems(data.exerciseItems?.items || [])
          setLoading(false)
          console.log('Loaded from cache')
        } else {
          refreshData()
        }
      } catch (err) {
        console.error('Error loading unapproved items:', err)
        setError('Failed to load unapproved items. Please try again.')
        setLoading(false)
      }
    }
    loadUnapprovedItems()
  }, [])

  useEffect(() => {
    setFilterCountryCode(sharedCountry)
  }, [sharedCountry])

  // Load verifiedItems from localStorage
  useEffect(() => {
    const loadVerifiedItems = () => {
      try {
        const verifiedItemsData = localStorage.getItem('verifiedItems')
        if (verifiedItemsData) {
          const items = JSON.parse(verifiedItemsData)
          setVerifiedItems(items)
        }
      } catch (err) {
        console.error('Error loading verified items:', err)
      }
    }
    loadVerifiedItems()
  }, [])

  const hasValue = (value) => value !== null && value !== undefined && value !== ''

  const getDisplayValue = (value) => (hasValue(value) ? value : '')

  const getBooleanLabel = (value) => {
    if (value === true) return 'Yes'
    if (value === false) return 'No'
    return ''
  }

  const getCaloriesValue = (item) => item.totalCalories ?? item.caloriesPer100 ?? ''

  const getFoodTimeValue = (item) => {
    if (!hasValue(item.totalTimeInMinutes)) return ''
    return `${item.totalTimeInMinutes}m`
  }

  const matchesAIGeneratedFilter = (item) => !showOnlyAIGenerated || item?.isAIGenerated === true

  const getFoodSortValue = (item, key) => {
    switch (key) {
      case 'name':
      case 'type':
      case 'countryCode':
      case 'createdByUserId':
      case 'barcode':
      case 'category':
      case 'brand':
      case 'nutriscore':
        return item[key] ?? ''
      case 'ingredients':
        return item.ingredients?.length ?? 0
      case 'recipeSteps':
        return item.recipeSteps?.instructions?.length ?? 0
      case 'isVerified':
      case 'isPublic':
      case 'isManual':
      case 'isAIGenerated':
        return item[key] ? 1 : 0
      case 'time':
        return Number(item.totalTimeInMinutes) || 0
      case 'calories':
        return Number(getCaloriesValue(item)) || 0
      case 'nutrients':
        return item.totalNutrients || item.nutrientsPer100 ? 1 : 0
      case 'serving': {
        const servings = item.servingOptions || item.serving
        if (!servings) return 0
        if (Array.isArray(servings)) return servings.length
        if (typeof servings === 'string') {
          try {
            const parsed = JSON.parse(servings)
            return Array.isArray(parsed) ? parsed.length : 0
          } catch {
            return 0
          }
        }
        return 0
      }
      case 'photo':
        return item.photoUrl ? 1 : 0
      case 'brandPhoto':
        return item.brandPhotoUrl ? 1 : 0
      case 'dateTimeCreated':
      case 'dateTimeUpdated':
        return item[key] ? new Date(item[key]).getTime() : 0
      default:
        return item[key] ?? ''
    }
  }

  const getExerciseSortValue = (item, key) => {
    switch (key) {
      case 'name':
      case 'createdByUserId':
        return item[key] ?? ''
      case 'durationInMinutes':
      case 'caloriesBurnt':
        return Number(item[key]) || 0
      case 'isVerified':
      case 'isPublic':
      case 'isManual':
        return item[key] ? 1 : 0
      case 'photo':
        return item.photoUrl ? 1 : 0
      case 'dateTimeCreated':
      case 'dateTimeUpdated':
        return item[key] ? new Date(item[key]).getTime() : 0
      default:
        return item[key] ?? ''
    }
  }

  const sortItems = (items, tab) => {
    const currentSort = sortConfig[tab]
    if (!currentSort?.key) return items

    const getValue = tab === 'food' ? getFoodSortValue : getExerciseSortValue
    return [...items].sort((a, b) => {
      const aValue = getValue(a, currentSort.key)
      const bValue = getValue(b, currentSort.key)

      if (typeof aValue === 'string' || typeof bValue === 'string') {
        const result = String(aValue).localeCompare(String(bValue), undefined, { sensitivity: 'base' })
        return currentSort.direction === 'asc' ? result : -result
      }

      const result = aValue > bValue ? 1 : aValue < bValue ? -1 : 0
      return currentSort.direction === 'asc' ? result : -result
    })
  }

  const handleSort = (tab, key) => {
    setSortConfig((currentConfig) => {
      const existingSort = currentConfig[tab]
      const direction = existingSort?.key === key && existingSort.direction === 'asc' ? 'desc' : 'asc'
      return {
        ...currentConfig,
        [tab]: { key, direction }
      }
    })
  }

  const renderSortableHeader = (tab, key, label) => {
    const currentSort = sortConfig[tab]
    const isActive = currentSort?.key === key
    const sortIndicator = isActive ? (currentSort.direction === 'asc' ? ' ↑' : ' ↓') : ''

    return (
      <button
        type="button"
        onClick={() => handleSort(tab, key)}
        className="flex items-center gap-1 text-left uppercase tracking-wider hover:text-gray-700"
      >
        <span>{label}</span>
        <span>{sortIndicator}</span>
      </button>
    )
  }

  // Filter items based on search term
  const filteredFoodItems = foodItems.filter(item =>
    (item.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.category?.toLowerCase().includes(searchTerm.toLowerCase())) &&
    (filterCountryCode ? item.countryCode?.toLowerCase().includes(filterCountryCode.toLowerCase()) : true) &&
    matchesAIGeneratedFilter(item)
  )

  const filteredExerciseItems = exerciseItems.filter(item =>
    item.name?.toLowerCase().includes(searchTerm.toLowerCase()) &&
    matchesAIGeneratedFilter(item)
  )

  const sortedFoodItems = sortItems(filteredFoodItems, 'food')
  const sortedExerciseItems = sortItems(filteredExerciseItems, 'exercise')

  // Pagination logic
  const getCurrentItems = () => {
    const items = activeTab === 'food' ? sortedFoodItems : sortedExerciseItems
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    return items.slice(startIndex, endIndex)
  }

  const getTotalPages = () => {
    const items = activeTab === 'food' ? sortedFoodItems : sortedExerciseItems
    return Math.ceil(items.length / itemsPerPage)
  }

  const getSelectedItemIds = () => (
    activeTab === 'food' ? selectedFoodItemIds : selectedExerciseItemIds
  )

  const setSelectedItemIds = (updater) => {
    if (activeTab === 'food') {
      setSelectedFoodItemIds(updater)
      return
    }
    setSelectedExerciseItemIds(updater)
  }

  const toggleItemSelection = (itemId, itemType) => {
    const setSelection = itemType === 'FOOD' ? setSelectedFoodItemIds : setSelectedExerciseItemIds
    setSelection((currentIds) => (
      currentIds.includes(itemId)
        ? currentIds.filter((id) => id !== itemId)
        : [...currentIds, itemId]
    ))
  }

  const isInteractiveElement = (target) => (
    target instanceof Element &&
    Boolean(target.closest('button, a, input, textarea, select, label'))
  )

  const handleRowSelection = (event, itemId, itemType) => {
    if (isInteractiveElement(event.target)) return
    toggleItemSelection(itemId, itemType)
  }

  const toggleCurrentPageSelection = () => {
    const currentItemIds = getCurrentItems().map((item) => item.id)
    const selectedIds = getSelectedItemIds()
    const allCurrentItemsSelected = currentItemIds.length > 0 && currentItemIds.every((id) => selectedIds.includes(id))

    setSelectedItemIds((currentIds) => (
      allCurrentItemsSelected
        ? currentIds.filter((id) => !currentItemIds.includes(id))
        : [...new Set([...currentIds, ...currentItemIds])]
    ))
  }

  const handleShowImage = (imageUrl) => {
    setSelectedImage(imageUrl)
    setIsImageModalOpen(true)
  }

  // Reset to page 1 when switching tabs or changing filters
  useEffect(() => {
    setCurrentPage(1)
  }, [activeTab, searchTerm, filterCountryCode, showOnlyAIGenerated])

  useEffect(() => {
    setSelectedFoodItemIds((currentIds) => currentIds.filter((id) => foodItems.some((item) => item.id === id)))
  }, [foodItems])

  useEffect(() => {
    setSelectedExerciseItemIds((currentIds) => currentIds.filter((id) => exerciseItems.some((item) => item.id === id)))
  }, [exerciseItems])

  const handleShowIngredients = (ingredients) => {
    setSelectedIngredients(ingredients)
    setIsIngredientsModalOpen(true)
  }

  const handleShowRecipeSteps = (steps) => {
    console.log(steps)
    if (steps?.instructions && Array.isArray(steps.instructions) && steps.instructions.length > 0) {
      const stepsText = steps.instructions.map((step, idx) => `${idx + 1}. ${step}`).join('\n\n')
      alert(`Recipe Steps:\n\n${stepsText}`)
    } else {
      alert('No recipe steps available')
    }
  }

  const normalizeServingOptions = servings => {
    if (!servings) return []
    if (Array.isArray(servings)) return servings
    if (typeof servings === 'string') {
      try {
        const parsed = JSON.parse(servings)
        return Array.isArray(parsed) ? parsed : []
      } catch {
        return []
      }
    }
    return []
  }

  const handleShowServings = servings => {
    const normalized = normalizeServingOptions(servings)
    if (!normalized.length) {
      alert('No serving information available')
      return
    }
    setSelectedServings(normalized)
    setIsServingsModalOpen(true)
  }

  const handleShowNutrientsAndCalories = item => {
    const nutrients = item?.totalNutrients || item?.nutrientsPer100 || null
    const calories = item?.totalCalories ?? item?.caloriesPer100 ?? null

    if (!nutrients && (calories === null || calories === undefined)) {
      alert('No nutrient information available')
      return
    }

    setSelectedNutritionData({
      calories,
      nutrients,
      isPer100: typeof item?.caloriesPer100 === 'number'
    })
    setIsNutritionModalOpen(true)
  }

  const formatServings = servings => {
    const normalized = normalizeServingOptions(servings)
    if (!normalized.length) return 'None'
    return `${normalized.length} option(s)`
  }

  const parseItemIds = (value) => (
    value
      .split(/[\n,]+/)
      .map((itemId) => itemId.trim())
      .filter(Boolean)
  )

  const refreshData = async () => {
    setError(null)
    setFoodItems([])
    setExerciseItems([])
    setSelectedFoodItemIds([])
    setSelectedExerciseItemIds([])
    localStorage.removeItem('unapprovedItems')
    setLoading(true)
    try {
      console.log('Fetching from API...')

      const data = await getUnapprovedItems()

      const compressed = LZString.compressToUTF16(JSON.stringify(data));
      localStorage.setItem('unapprovedItems', compressed);

      setLoading(false)
      setFoodItems(data.foodItems?.items || [])
      setExerciseItems(data.exerciseItems?.items || [])

      console.log('Loaded from API and cached')
    } catch (err) {
      console.error('Error refreshing data:', err)
      setError('Failed to refresh data')
      setLoading(false)
    }
  }

  const approveItems = async (itemIds, itemType) => {
    if (itemIds.length === 1) {
      await setItemVerifiedStatus({ itemId: itemIds[0], verified: true, itemType })
    } else {
      await setItemsVerifiedStatus({
        items: itemIds.map((itemId) => ({ itemId, itemType })),
        verified: true
      })
    }

    const verifiedItems = JSON.parse(localStorage.getItem('verifiedItems') || '[]')
    const newVerifiedItems = itemIds.map((itemId) => ({ itemId, itemType }))
    const deduplicatedVerifiedItems = [
      ...verifiedItems.filter(
        (item) => !newVerifiedItems.some(
          (newItem) => newItem.itemId === item.itemId && newItem.itemType === item.itemType
        )
      ),
      ...newVerifiedItems
    ]
    localStorage.setItem('verifiedItems', JSON.stringify(deduplicatedVerifiedItems))
    setVerifiedItems(deduplicatedVerifiedItems)
  }

  const handleApproveItem = async (itemId, itemType) => {
    const confirmed = confirm('Are you sure you want to approve this item?')
    if (confirmed) {
      try {
        await approveItems([itemId], itemType)
        setSelectedFoodItemIds((currentIds) => currentIds.filter((id) => id !== itemId))
        setSelectedExerciseItemIds((currentIds) => currentIds.filter((id) => id !== itemId))
        console.log(`Item ${itemId} approved and saved to localStorage`)

        localStorage.removeItem('unapprovedItems')

        setLoading(true)
        try {
          // wait 1.5 seconds
          await new Promise(resolve => setTimeout(resolve, 1500))
          refreshData()
        } catch (err) {
          console.error('Error refreshing data:', err)
          setError('Failed to refresh data')
          setLoading(false)
        }
      } catch (err) {
        console.error('Error approving item:', err)
        alert('Failed to approve item. Please try again.')
      }
    }
  }

  const handleBulkApprove = async () => {
    const selectedItemIds = getSelectedItemIds()
    const itemType = activeTab === 'food' ? 'FOOD' : 'EXERCISE'

    if (!selectedItemIds.length) {
      alert('Select at least one item to approve')
      return
    }

    const confirmed = confirm(`Are you sure you want to approve ${selectedItemIds.length} item(s)?`)
    if (!confirmed) return

    try {
      await approveItems(selectedItemIds, itemType)
      if (itemType === 'FOOD') {
        setSelectedFoodItemIds([])
      } else {
        setSelectedExerciseItemIds([])
      }
      localStorage.removeItem('unapprovedItems')
      setLoading(true)
      await new Promise(resolve => setTimeout(resolve, 1500))
      refreshData()
    } catch (err) {
      console.error('Error bulk approving items:', err)
      alert('Failed to bulk approve items. Please try again.')
    }
  }

  const handleDeleteUnapprovedItem = async (itemId, itemType, userId) => {
    const confirmed = confirm('Are you sure you want to delete this item?')
    if (!confirmed) return

    try {
      await deleteItem({
        itemId,
        itemType,
        userId
      })

      localStorage.removeItem('unapprovedItems')
      await new Promise(resolve => setTimeout(resolve, 1500))
      refreshData()
    } catch (err) {
      console.error('Error deleting item:', err)
      alert('Failed to delete item. Please try again.')
    }
  }

  const handleBulkDelete = async () => {
    const selectedItemIds = getSelectedItemIds()
    const itemType = activeTab === 'food' ? 'FOOD' : 'EXERCISE'
    const currentItems = activeTab === 'food' ? foodItems : exerciseItems
    const selectedItems = currentItems.filter((item) => selectedItemIds.includes(item.id))
    const selectedUserIds = [...new Set(selectedItems.map((item) => item.createdByUserId).filter(Boolean))]
    const bulkDeleteUserId = selectedUserIds.length === 1 ? selectedUserIds[0] : null

    if (!selectedItemIds.length) {
      alert('Select at least one item to delete')
      return
    }

    const confirmed = confirm(`Are you sure you want to delete ${selectedItemIds.length} item(s)?`)
    if (!confirmed) return

    try {
      await deleteItems({
        items: selectedItemIds.map((itemId) => ({
          itemId,
          itemType
        })),
        userId: bulkDeleteUserId
      })

      if (itemType === 'FOOD') {
        setSelectedFoodItemIds([])
      } else {
        setSelectedExerciseItemIds([])
      }

      localStorage.removeItem('unapprovedItems')
      setLoading(true)
      await new Promise(resolve => setTimeout(resolve, 1500))
      refreshData()
    } catch (err) {
      console.error('Error bulk deleting items:', err)
      alert('Failed to bulk delete items. Please try again.')
    }
  }

  const handleItemIdChange = (itemId) => {
    setUnverifyItemId(itemId)
    // Automatically set the itemType if found in verifiedItems
    const parsedItemIds = parseItemIds(itemId)
    if (parsedItemIds.length !== 1) return
    const item = verifiedItems.find(v => v.itemId === parsedItemIds[0])
    if (item) {
      setUnverifyItemType(item.itemType)
    }
  }

  const unverifyItems = async (itemIds, itemType) => {
    if (itemIds.length === 1) {
      await setItemVerifiedStatus({
        itemId: itemIds[0],
        verified: false,
        itemType
      })
    } else {
      await setItemsVerifiedStatus({
        items: itemIds.map((itemId) => ({ itemId, itemType })),
        verified: false
      })
    }

    const verifiedItemsData = JSON.parse(localStorage.getItem('verifiedItems') || '[]')
    const updatedVerifiedItems = verifiedItemsData.filter(
      item => !(item.itemType === itemType && itemIds.includes(item.itemId))
    )
    localStorage.setItem('verifiedItems', JSON.stringify(updatedVerifiedItems))
    setVerifiedItems(updatedVerifiedItems)
  }

  const handleUnverifyItem = async () => {
    const parsedItemIds = parseItemIds(unverifyItemId)

    if (!parsedItemIds.length || !unverifyItemType) {
      alert('Please fill in both itemId and itemType')
      return
    }

    if (parsedItemIds.length > 1) {
      alert('Use the bulk unverify button for multiple item IDs')
      return
    }

    const confirmed = confirm('Are you sure you want to unverify this item?')
    if (confirmed) {
      try {
        await unverifyItems(parsedItemIds, unverifyItemType)

        console.log(`Item ${parsedItemIds[0]} unverified`)

        // Clear the input fields
        setUnverifyItemId('')
        setUnverifyItemType('')

        // Refresh the list
        // wait 1.5 seconds
        await new Promise(resolve => setTimeout(resolve, 1500))
        refreshData()
      } catch (err) {
        console.error('Error unverifying item:', err)
        alert('Failed to unverify item. Please try again.')
      }
    }
  }

  const handleBulkUnverify = async () => {
    const parsedItemIds = parseItemIds(unverifyItemId)

    if (!parsedItemIds.length || !unverifyItemType) {
      alert('Please fill in both itemId and itemType')
      return
    }

    if (parsedItemIds.length === 1) {
      alert('Use the single unverify button for one item ID')
      return
    }

    const confirmed = confirm(`Are you sure you want to unverify ${parsedItemIds.length} item(s)?`)
    if (!confirmed) return

    try {
      await unverifyItems(parsedItemIds, unverifyItemType)
      setUnverifyItemId('')
      setUnverifyItemType('')
      await new Promise(resolve => setTimeout(resolve, 1500))
      refreshData()
    } catch (err) {
      console.error('Error bulk unverifying items:', err)
      alert('Failed to bulk unverify items. Please try again.')
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Unapproved Items</h1>
            <p className="text-gray-600 mt-2">Manage items pending approval</p>
          </div>
        </div>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading unapproved items...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Unapproved Items</h1>
            <p className="text-gray-600 mt-2">Manage items pending approval</p>
          </div>
        </div>
        <div className="card p-6">
          <div className="flex items-center">
            <ExclamationTriangleIcon className="h-8 w-8 text-red-600 mr-4" />
            <div>
              <h3 className="text-lg font-medium text-gray-900">Error Loading Data</h3>
              <p className="text-gray-600 mt-1">{error}</p>
            </div>
          </div>
        </div>

        <button
          onClick={async () => {
            localStorage.removeItem('unapprovedItems')

            setLoading(true)
            try {
              refreshData()
            } catch (err) {
              console.error('Error refreshing data:', err)
              setError('Failed to refresh data')
              setLoading(false)
            }
          }}
          className="btn-secondary flex items-center"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh Data
        </button>
      </div>
    )
  }

  const handleShowUser = async (userId) => {
    try {
      const data = await getUserByUserId({ userId })
      const user = data?.data || data
      setSelectedUser(user)
      setIsUserModalOpen(true)
    } catch (error) {
      console.error('Error loading user data:', error)
      alert('Failed to load user data')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-center sm:text-left">
          <h1 className="text-3xl font-bold text-gray-900">Unapproved Items</h1>
          <p className="text-gray-600 mt-2">Manage items pending approval</p>
        </div>
        <button
          onClick={async () => {
            localStorage.removeItem('unapprovedItems')

            setLoading(true)
            try {
              refreshData()
            } catch (err) {
              console.error('Error refreshing data:', err)
              setError('Failed to refresh data')
              setLoading(false)
            }
          }}
          className="btn-secondary flex items-center justify-center sm:justify-start"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh Data
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-8 w-8 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total Food Items</p>
              <p className="text-2xl font-semibold text-gray-900">{foodItems.length}</p>
            </div>
          </div>
        </div>
        <div className="card p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-8 w-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total Exercise Items</p>
              <p className="text-2xl font-semibold text-gray-900">{exerciseItems.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Unverify Item Controls */}
      <div className="card p-6">
        <div className="flex items-end gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Item ID
            </label>
            <textarea
              placeholder="Enter one or more item IDs, separated by commas or new lines"
              value={unverifyItemId}
              onChange={(e) => handleItemIdChange(e.target.value)}
              className="input min-h-24"
            />
            {verifiedItems.length > 0 && (
              <p className="mt-2 text-xs text-gray-500">
                {t('pages.unapprovedItems.bulkUnverifyHint')}
              </p>
            )}
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Item Type
            </label>
            <input
              type="text"
              placeholder="Enter item type (FOOD or EXERCISE)"
              value={unverifyItemType}
              onChange={(e) => setUnverifyItemType(e.target.value)}
              className="input"
              list={verifiedItems.length > 0 ? 'verifiedItemTypes' : undefined}
            />
            {verifiedItems.length > 0 && (
              <datalist id="verifiedItemTypes">
                {(
                  unverifyItemId
                    ? [...new Set(verifiedItems.filter(v => v.itemId === unverifyItemId).map(v => v.itemType))]
                    : [...new Set(verifiedItems.map(v => v.itemType))]
                ).map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            )}
          </div>
          <div>
            <div className="flex gap-3">
              <button
                onClick={handleUnverifyItem}
                className="btn-primary whitespace-nowrap"
              >
                {t('pages.unapprovedItems.unverifyItem')}
              </button>
              <button
                onClick={handleBulkUnverify}
                className="btn-secondary whitespace-nowrap"
              >
                {t('pages.unapprovedItems.bulkUnverify')}
              </button>
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
            placeholder={t('pages.unapprovedItems.searchPlaceholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input pl-10"
          />
        </div>
      </div>
      {/* Filter by country code textinput */}
      <div className="card p-6">
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder={t('pages.unapprovedItems.filterCountryPlaceholder')}
            value={filterCountryCode}
            onChange={(e) => {
              const nextCountry = setSharedCountry(e.target.value)
              setFilterCountryCode(nextCountry)
            }}
            className="input pl-10"
          />
        </div>
      </div>

      <div className="card p-6">
        <label className="flex items-center gap-3 text-sm font-medium text-gray-700">
          <input
            type="checkbox"
            checked={showOnlyAIGenerated}
            onChange={(e) => setShowOnlyAIGenerated(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          {t('pages.unapprovedItems.showOnlyAIGenerated')}
        </label>
      </div>

      {/* Tabs */}
      <div className="card overflow-hidden">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            <button
              onClick={() => setActiveTab('food')}
              className={`py-4 px-6 text-sm font-medium border-b-2 ${activeTab === 'food'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              Food Items ({filteredFoodItems.length})
            </button>
            <button
              onClick={() => setActiveTab('exercise')}
              className={`py-4 px-6 text-sm font-medium border-b-2 ${activeTab === 'exercise'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              Exercise Items ({filteredExerciseItems.length})
            </button>
          </nav>
        </div>
        <div className="flex flex-col gap-3 border-b border-gray-200 bg-gray-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <label className="flex items-center gap-3 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={getCurrentItems().length > 0 && getCurrentItems().every((item) => getSelectedItemIds().includes(item.id))}
              onChange={toggleCurrentPageSelection}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            {t('pages.unapprovedItems.selectAllOnPage')}
          </label>
          <div className="flex gap-3">
            <button
              onClick={handleBulkApprove}
              disabled={getSelectedItemIds().length === 0}
              className="btn-primary disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t('pages.unapprovedItems.bulkApproveWithCount', { count: getSelectedItemIds().length })}
            </button>
            <button
              onClick={handleBulkDelete}
              disabled={getSelectedItemIds().length === 0}
              className="btn-secondary disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t('pages.unapprovedItems.bulkDeleteWithCount', { count: getSelectedItemIds().length })}
            </button>
          </div>
        </div>

        {/* Food Items Table */}
        {activeTab === 'food' && (
          <>
            {/* Mobile Card View */}
            <div className="md:hidden grid gap-4 p-4">
              {getCurrentItems().map((item) => (
                <div
                  key={item.id}
                  className={`rounded-lg shadow p-4 space-y-3 cursor-pointer border ${
                    selectedFoodItemIds.includes(item.id)
                      ? 'bg-blue-50 border-blue-300 ring-1 ring-blue-200'
                      : 'bg-white border-transparent'
                  }`}
                  onClick={(event) => handleRowSelection(event, item.id, 'FOOD')}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex items-start gap-3 flex-1">
                      <input
                        type="checkbox"
                        checked={selectedFoodItemIds.includes(item.id)}
                        onChange={() => toggleItemSelection(item.id, 'FOOD')}
                        className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <div className="flex-1">
                        <div className="font-semibold text-gray-900">{getDisplayValue(item.name)}</div>
                        <div className="text-sm text-gray-500 mt-1">
                          {item.type && (
                            <span className="inline-block px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800 mr-2">
                              {item.type}
                            </span>
                          )}
                          {item.category && (
                            <span className="text-gray-600">{item.category}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleApproveItem(item.id, 'FOOD')}
                      className="text-blue-600 hover:text-blue-900 p-2"
                    >
                      <CheckIcon className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() =>
                        handleDeleteUnapprovedItem(
                          item.id,
                          'FOOD',
                          item.createdByUserId
                        )
                      }
                      className="text-red-600 hover:text-red-900 p-2"
                    >
                      <XMarkIcon className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-gray-500">Country:</span>
                      <span className="ml-1 text-gray-900">{getDisplayValue(item.countryCode)}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Calories:</span>
                      <span className="ml-1 text-gray-900">{getCaloriesValue(item)}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Brand:</span>
                      <span className="ml-1 text-gray-900">{getDisplayValue(item.brand)}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Time:</span>
                      <span className="ml-1 text-gray-900">{getFoodTimeValue(item)}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Barcode:</span>
                      <span className="ml-1 text-gray-900">{getDisplayValue(item.barcode)}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Nutriscore:</span>
                      <span className="ml-1 text-gray-900">{getDisplayValue(item.nutriscore)}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${item.isVerified ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {item.isVerified ? 'Verified' : 'Not Verified'}
                    </span>
                    {item.isPublic !== null && item.isPublic !== undefined && (
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${item.isPublic ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                        {item.isPublic ? 'Public' : 'Private'}
                      </span>
                    )}
                    {item.isManual !== null && item.isManual !== undefined && item.isManual && (
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">Manual</span>
                    )}
                    {item.isAIGenerated && (
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-800">AI Generated</span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2 text-sm">
                    {item.createdByUserId && (
                      <button
                        onClick={() => handleShowUser(item.createdByUserId)}
                        className="text-blue-600 hover:text-blue-900 underline"
                      >
                        View User
                      </button>
                    )}
                    {item.ingredients && (
                      <button
                        onClick={() => handleShowIngredients(item.ingredients)}
                        className="text-blue-600 hover:text-blue-900 underline"
                      >
                        {item.ingredients.length} Ingredients
                      </button>
                    )}
                    {item.recipeSteps && (
                      <button
                        onClick={() => handleShowRecipeSteps(item.recipeSteps)}
                        className="text-blue-600 hover:text-blue-900 underline"
                      >
                        Recipe Steps
                      </button>
                    )}
                    {(item.totalNutrients || item.nutrientsPer100 || typeof item.caloriesPer100 === 'number') && (
                      <button
                        onClick={() => handleShowNutrientsAndCalories(item)}
                        className="text-blue-600 hover:text-blue-900 underline"
                      >
                        Nutrients & Calories
                      </button>
                    )}
                    {(item.servingOptions || item.serving) && (
                      <button
                        onClick={() => handleShowServings(item.servingOptions || item.serving)}
                        className="text-blue-600 hover:text-blue-900 underline"
                      >
                        {formatServings(item.servingOptions || item.serving)}
                      </button>
                    )}
                    {item.photoUrl && (
                      <button
                        onClick={() => handleShowImage(item.photoUrl)}
                        className="text-blue-600 hover:text-blue-900 underline"
                      >
                        View Photo
                      </button>
                    )}
                    {item.brandPhotoUrl && (
                      <button
                        onClick={() => handleShowImage(item.brandPhotoUrl)}
                        className="text-blue-600 hover:text-blue-900 underline"
                      >
                        Brand Photo
                      </button>
                    )}
                  </div>

                  {item.dateTimeCreated && (
                    <div className="text-xs text-gray-500">
                      Created: {new Date(item.dateTimeCreated).toLocaleDateString()}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Select
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">{renderSortableHeader('food', 'name', 'Name')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">{renderSortableHeader('food', 'type', 'Type')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">{renderSortableHeader('food', 'countryCode', 'Country')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">{renderSortableHeader('food', 'createdByUserId', 'User ID')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">{renderSortableHeader('food', 'barcode', 'Barcode')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">{renderSortableHeader('food', 'ingredients', 'Ingredients')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">{renderSortableHeader('food', 'recipeSteps', 'Recipe Steps')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">{renderSortableHeader('food', 'category', 'Category')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">{renderSortableHeader('food', 'isVerified', 'Verified')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">{renderSortableHeader('food', 'isPublic', 'Public')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">{renderSortableHeader('food', 'isManual', 'Manual')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">{renderSortableHeader('food', 'isAIGenerated', 'AI Gen')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">{renderSortableHeader('food', 'brand', 'Brand')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">{renderSortableHeader('food', 'time', 'Time')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">{renderSortableHeader('food', 'calories', 'Calories')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">{renderSortableHeader('food', 'nutriscore', 'Nutriscore')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">{renderSortableHeader('food', 'nutrients', 'Nutrients')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">{renderSortableHeader('food', 'serving', 'Serving')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">{renderSortableHeader('food', 'photo', 'Photo')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">{renderSortableHeader('food', 'brandPhoto', 'Brand Photo')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">{renderSortableHeader('food', 'dateTimeCreated', 'Created')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">{renderSortableHeader('food', 'dateTimeUpdated', 'Updated')}</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {getCurrentItems().map((item) => (
                  <tr
                    key={item.id}
                    className={`cursor-pointer ${
                      selectedFoodItemIds.includes(item.id)
                        ? 'bg-blue-50'
                        : 'hover:bg-gray-50'
                    }`}
                    onClick={(event) => handleRowSelection(event, item.id, 'FOOD')}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={selectedFoodItemIds.includes(item.id)}
                        onChange={() => toggleItemSelection(item.id, 'FOOD')}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-center space-x-2">
                        <button className="text-blue-600 hover:text-blue-900 cursor-pointer" onClick={() => handleApproveItem(item.id, 'FOOD')}>
                          <CheckIcon className="w-4 h-4" />
                        </button>
                        <button
                          className="text-red-600 hover:text-red-900 cursor-pointer"
                          onClick={() =>
                            handleDeleteUnapprovedItem(
                              item.id,
                              'FOOD',
                              item.createdByUserId
                            )
                          }
                        >
                          <XMarkIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 max-w-xs truncate" title={item.name}>
                        {getDisplayValue(item.name)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                        {getDisplayValue(item.type)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{getDisplayValue(item.countryCode)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 max-w-xs truncate" title={item.createdByUserId}>
                      {item.createdByUserId ? (
                        <button
                          onClick={() => handleShowUser(item.createdByUserId)}
                          className="text-blue-600 hover:text-blue-900 underline cursor-pointer"
                        >
                          {item.createdByUserId}
                        </button>
                      ) : ''}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{getDisplayValue(item.barcode)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {item.ingredients ? (
                        <button
                          onClick={() => handleShowIngredients(item.ingredients)}
                          className="text-blue-600 hover:text-blue-900 underline"
                        >
                          {item.ingredients.length} ingredients
                        </button>
                      ) : (
                        ''
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {item.recipeSteps ? (
                        <button
                          onClick={() => handleShowRecipeSteps(item.recipeSteps)}
                          className="text-blue-600 hover:text-blue-900 underline"
                        >
                          View
                        </button>
                      ) : (
                        ''
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{getDisplayValue(item.category)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${item.isVerified ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {item.isVerified ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${item.isPublic !== null && item.isPublic !== undefined ? (item.isPublic ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800') : 'bg-gray-100 text-gray-800'}`}>
                        {getBooleanLabel(item.isPublic)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${item.isManual ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}>
                        {getBooleanLabel(item.isManual)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${item.isAIGenerated ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'}`}>
                        {getBooleanLabel(item.isAIGenerated)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{getDisplayValue(item.brand)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{getFoodTimeValue(item)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{getCaloriesValue(item)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{getDisplayValue(item.nutriscore)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {(item.totalNutrients || item.nutrientsPer100 || typeof item.caloriesPer100 === 'number') ? (
                        <button
                          onClick={() => handleShowNutrientsAndCalories(item)}
                          className="text-blue-600 hover:text-blue-900 underline"
                        >
                          View
                        </button>
                      ) : (
                        ''
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {(item.servingOptions || item.serving) ? (
                        <button
                          onClick={() => handleShowServings(item.servingOptions || item.serving)}
                          className="text-blue-600 hover:text-blue-900 underline"
                        >
                          {formatServings(item.servingOptions || item.serving)}
                        </button>
                      ) : (
                        ''
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {item.photoUrl ? (
                        <button
                          onClick={() => handleShowImage(item.photoUrl)}
                          className="text-blue-600 hover:text-blue-900 underline"
                        >
                          View
                        </button>
                      ) : (
                        ''
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {item.brandPhotoUrl ? (
                        <button
                          onClick={() => handleShowImage(item.brandPhotoUrl)}
                          className="text-blue-600 hover:text-blue-900 underline"
                        >
                          View
                        </button>
                      ) : (
                        ''
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {item.dateTimeCreated ? new Date(item.dateTimeCreated).toLocaleDateString() : ''}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {item.dateTimeUpdated ? new Date(item.dateTimeUpdated).toLocaleDateString() : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}

        {/* Exercise Items Table */}
        {activeTab === 'exercise' && (
          <>
            {/* Mobile Card View */}
            <div className="md:hidden grid gap-4 p-4">
              {getCurrentItems().map((item) => (
                <div
                  key={item.id}
                  className={`rounded-lg shadow p-4 space-y-3 cursor-pointer border ${
                    selectedExerciseItemIds.includes(item.id)
                      ? 'bg-blue-50 border-blue-300 ring-1 ring-blue-200'
                      : 'bg-white border-transparent'
                  }`}
                  onClick={(event) => handleRowSelection(event, item.id, 'EXERCISE')}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex items-start gap-3 flex-1">
                      <input
                        type="checkbox"
                        checked={selectedExerciseItemIds.includes(item.id)}
                        onChange={() => toggleItemSelection(item.id, 'EXERCISE')}
                        className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <div className="flex-1">
                        <div className="font-semibold text-gray-900">{getDisplayValue(item.name)}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleApproveItem(item.id, 'EXERCISE')}
                      className="text-blue-600 hover:text-blue-900 p-2"
                    >
                      <CheckIcon className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() =>
                        handleDeleteUnapprovedItem(
                          item.id,
                          'EXERCISE',
                          item.createdByUserId
                        )
                      }
                      className="text-red-600 hover:text-red-900 p-2"
                    >
                      <XMarkIcon className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-gray-500">Duration:</span>
                      <span className="ml-1 text-gray-900">{hasValue(item.durationInMinutes) ? `${item.durationInMinutes} min` : ''}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Calories Burnt:</span>
                      <span className="ml-1 text-gray-900">{getDisplayValue(item.caloriesBurnt)}</span>
                    </div>
                    {item.createdByUserId && (
                      <div className="col-span-2">
                        <span className="text-gray-500">User ID:</span>
                        <span className="ml-1 text-gray-900">{item.createdByUserId}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-1">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${item.isVerified ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {item.isVerified ? 'Verified' : 'Not Verified'}
                    </span>
                    {item.isPublic !== null && item.isPublic !== undefined && (
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${item.isPublic ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                        {item.isPublic ? 'Public' : 'Private'}
                      </span>
                    )}
                    {item.isManual && (
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">Manual</span>
                    )}
                  </div>

                  {item.photoUrl && (
                    <div>
                      <button
                        onClick={() => handleShowImage(item.photoUrl)}
                        className="text-blue-600 hover:text-blue-900 underline text-sm"
                      >
                        View Photo
                      </button>
                    </div>
                  )}

                  {item.dateTimeCreated && (
                    <div className="text-xs text-gray-500">
                      Created: {new Date(item.dateTimeCreated).toLocaleDateString()}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Select</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">{renderSortableHeader('exercise', 'name', 'Name')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">{renderSortableHeader('exercise', 'durationInMinutes', 'Duration (min)')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">{renderSortableHeader('exercise', 'caloriesBurnt', 'Calories Burnt')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">{renderSortableHeader('exercise', 'createdByUserId', 'User ID')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">{renderSortableHeader('exercise', 'isVerified', 'Verified')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">{renderSortableHeader('exercise', 'isPublic', 'Public')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">{renderSortableHeader('exercise', 'isManual', 'Manual')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">{renderSortableHeader('exercise', 'photo', 'Photo')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">{renderSortableHeader('exercise', 'dateTimeCreated', 'Created')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">{renderSortableHeader('exercise', 'dateTimeUpdated', 'Updated')}</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {getCurrentItems().map((item) => (
                  <tr
                    key={item.id}
                    className={`cursor-pointer ${
                      selectedExerciseItemIds.includes(item.id)
                        ? 'bg-blue-50'
                        : 'hover:bg-gray-50'
                    }`}
                    onClick={(event) => handleRowSelection(event, item.id, 'EXERCISE')}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={selectedExerciseItemIds.includes(item.id)}
                        onChange={() => toggleItemSelection(item.id, 'EXERCISE')}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex justify-center space-x-2">
                        <button className="text-blue-600 hover:text-blue-900 cursor-pointer" onClick={() => handleApproveItem(item.id, 'EXERCISE')}>
                          <CheckIcon className="w-4 h-4" />
                        </button>
                        <button
                          className="text-red-600 hover:text-red-900 cursor-pointer"
                          onClick={() =>
                            handleDeleteUnapprovedItem(
                              item.id,
                              'EXERCISE',
                              item.createdByUserId
                            )
                          }
                        >
                          <XMarkIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{getDisplayValue(item.name)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{getDisplayValue(item.durationInMinutes)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{getDisplayValue(item.caloriesBurnt)}</td>

                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{getDisplayValue(item.createdByUserId)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${item.isVerified ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {item.isVerified ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${item.isPublic !== null && item.isPublic !== undefined ? (item.isPublic ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800') : 'bg-gray-100 text-gray-800'}`}>
                        {getBooleanLabel(item.isPublic)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${item.isManual ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}>
                        {item.isManual ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {item.photoUrl ? (
                        <button
                          onClick={() => handleShowImage(item.photoUrl)}
                          className="text-blue-600 hover:text-blue-900 underline"
                        >
                          View
                        </button>
                      ) : (
                        ''
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {item.dateTimeCreated ? new Date(item.dateTimeCreated).toLocaleDateString() : ''}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {item.dateTimeUpdated ? new Date(item.dateTimeUpdated).toLocaleDateString() : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}

        {/* Pagination Controls */}
        <div className="bg-white px-4 py-3 border-t border-gray-200">
          {/* Mobile View */}
          <div className="md:hidden space-y-3">
            <div className="flex items-center justify-between">
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value))
                  setCurrentPage(1)
                }}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                <option value="10">10</option>
                <option value="25">25</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </select>
              
              <span className="text-sm text-gray-700">
                Page {currentPage} of {getTotalPages() || 1}
              </span>
            </div>
            
            <div className="flex items-center justify-between">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>

              <button
                onClick={() => setCurrentPage(prev => Math.min(getTotalPages(), prev + 1))}
                disabled={currentPage >= getTotalPages()}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>

          {/* Desktop View */}
          <div className="hidden md:flex flex-wrap items-center gap-4 md:gap-6">
            <div className="flex items-center gap-3">
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

            <div className="flex flex-col md:flex-row md:items-center md:gap-3 text-sm text-gray-700">
              <span className="font-medium">Page {currentPage} of {getTotalPages() || 1}</span>
              <span className="text-gray-600">
                {(() => {
                  const total = activeTab === 'food' ? filteredFoodItems.length : filteredExerciseItems.length
                  if (total === 0) return 'Showing 0 of 0 results'
                  return `Showing ${((currentPage - 1) * itemsPerPage) + 1} to ${Math.min(currentPage * itemsPerPage, total)} of ${total} results`
                })()}
              </span>
            </div>

            <div className="flex items-center gap-2 ml-auto">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>

              <button
                onClick={() => setCurrentPage(prev => Math.min(getTotalPages(), prev + 1))}
                disabled={currentPage >= getTotalPages()}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>

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
      {isIngredientsModalOpen && selectedIngredients && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 shadow-lg rounded-md bg-white">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">Ingredients</h3>
              <button
                onClick={() => {
                  setIsIngredientsModalOpen(false)
                  setSelectedIngredients(null)
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
                  {selectedIngredients.map((ing, index) => (
                    <tr key={index}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{getDisplayValue(ing.name)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{getDisplayValue(ing.quantity ?? ing.servingAmount)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{getDisplayValue(ing.unit)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{getDisplayValue(ing.category)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{getDisplayValue(ing.weight ?? ing.quantity)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4">
              <button
                onClick={() => {
                  setIsIngredientsModalOpen(false)
                  setSelectedIngredients(null)
                }}
                className="btn-primary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Servings Modal */}
      {isServingsModalOpen && selectedServings && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-2/3 shadow-lg rounded-md bg-white">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">Serving Options</h3>
              <button
                onClick={() => {
                  setIsServingsModalOpen(false)
                  setSelectedServings(null)
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
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unit</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Value</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {selectedServings.map((serving, index) => (
                    <tr key={index}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {getDisplayValue(serving?.unitName || serving?.unit || serving?.name || serving?.innerName)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {getDisplayValue(serving?.value ?? serving?.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4">
              <button
                onClick={() => {
                  setIsServingsModalOpen(false)
                  setSelectedServings(null)
                }}
                className="btn-primary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Nutrition Modal */}
      {isNutritionModalOpen && selectedNutritionData && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-2/3 shadow-lg rounded-md bg-white">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">Nutrition</h3>
              <button
                onClick={() => {
                  setIsNutritionModalOpen(false)
                  setSelectedNutritionData(null)
                }}
                className="text-gray-400 hover:text-gray-500"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>

            <div className="mb-4 p-3 bg-blue-50 rounded text-sm text-gray-800">
              Calories{selectedNutritionData.isPer100 ? ' (per 100g)' : ''}: {' '}
              {getDisplayValue(selectedNutritionData.calories)}
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nutrient</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Value</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {Object.entries(selectedNutritionData.nutrients || {}).map(([key, value]) => (
                    <tr key={key}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{key}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {getDisplayValue(value)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4">
              <button
                onClick={() => {
                  setIsNutritionModalOpen(false)
                  setSelectedNutritionData(null)
                }}
                className="btn-primary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User Detail Modal */}
      <UserDetailModal
        isOpen={isUserModalOpen}
        onClose={() => {
          setIsUserModalOpen(false)
          setSelectedUser(null)
        }}
        user={selectedUser}
        fromPage="unapprovedItems"
      />
    </div>
  )
}

export default UnapprovedItems
