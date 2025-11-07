import { useState, useEffect } from 'react'
import {
  MagnifyingGlassIcon,
  CheckIcon,
  ExclamationTriangleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import { getUnapprovedItems, getUserByUserId, setItemVerifiedStatus, formatUserData, formatSubscriptionStatus, formatPaymentData } from '../services/api'
import UserDetailModal from '../components/UserDetailModal'

import LZString from 'lz-string'

const UnapprovedItems = () => {
  const [foodItems, setFoodItems] = useState([])
  const [exerciseItems, setExerciseItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterCountryCode, setFilterCountryCode] = useState('')
  const [activeTab, setActiveTab] = useState('food') // 'food' or 'exercise'
  const [itemsPerPage, setItemsPerPage] = useState(25)
  const [currentPage, setCurrentPage] = useState(1)

  // For unverify item controls
  const [unverifyItemId, setUnverifyItemId] = useState('')
  const [unverifyItemType, setUnverifyItemType] = useState('')
  const [verifiedItems, setVerifiedItems] = useState([])

  // For ingredient detail modal
  const [selectedIngredients, setSelectedIngredients] = useState(null)
  const [isIngredientsModalOpen, setIsIngredientsModalOpen] = useState(false)

  // For image modal
  const [selectedImage, setSelectedImage] = useState(null)
  const [isImageModalOpen, setIsImageModalOpen] = useState(false)

  // For user detail modal
  const [selectedUser, setSelectedUser] = useState(null)
  const [isUserModalOpen, setIsUserModalOpen] = useState(false)

  useEffect(() => {
    const loadUnapprovedItems = async () => {
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

  // Filter items based on search term
  const filteredFoodItems = foodItems.filter(item =>
    (item.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.category?.toLowerCase().includes(searchTerm.toLowerCase())) &&
    (filterCountryCode ? item.countryCode?.toLowerCase().includes(filterCountryCode.toLowerCase()) : true)
  )

  const filteredExerciseItems = exerciseItems.filter(item =>
    item.name?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Pagination logic
  const getCurrentItems = () => {
    const items = activeTab === 'food' ? filteredFoodItems : filteredExerciseItems
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    return items.slice(startIndex, endIndex)
  }

  const getTotalPages = () => {
    const items = activeTab === 'food' ? filteredFoodItems : filteredExerciseItems
    return Math.ceil(items.length / itemsPerPage)
  }

  const handleShowImage = (imageUrl) => {
    setSelectedImage(imageUrl)
    setIsImageModalOpen(true)
  }

  // Reset to page 1 when switching tabs or changing filters
  useEffect(() => {
    setCurrentPage(1)
  }, [activeTab, searchTerm, filterCountryCode])

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

  const handleShowServings = (servings) => {
    if (!servings || !Array.isArray(servings) || servings.length === 0) {
      alert('No serving information available')
      return
    }
    const servingsText = servings.map((s, idx) => {
      return `${idx + 1}. ${s.name || s.innerName || 'Serving'}: ${s.amount} ${s.unit || 'unit'}${s.defaultWeight ? ` (default: ${s.defaultWeight})` : ''}`
    }).join('\n')
    alert(`Serving Options:\n\n${servingsText}`)
  }

  const handleShowNutrients = (nutrients) => {
    if (!nutrients) {
      alert('No nutrient information available')
      return
    }
    const nutrientsText = `
    Proteins: ${nutrients.proteinsInGrams || 0}g
    Fats: ${nutrients.fatInGrams || 0}g
    Carbohydrates: ${nutrients.carbohydratesInGrams || 0}g
    Fiber: ${nutrients.fibreInGrams || 0}g
    Sugar: ${nutrients.sugarsInGrams || 0}g
    Saturated Fat: ${nutrients.fattyAcidsTotalSaturatedInGrams || 0}g
    Unsaturated Fat: ${nutrients.fattyAcidsTotalUnSaturatedInGrams || 0}g
    Salt: ${nutrients.saltInGrams || 0}g
    Total Quantity: ${nutrients.totalQuantity || 0}
    Weight After Cooking: ${nutrients.weightAfterCooking || 0}
    `
    alert(`Nutrient Information:\n${nutrientsText}`)
  }

  const formatServings = (servings) => {
    if (!servings || !Array.isArray(servings) || servings.length === 0) return 'None'
    return `${servings.length} option(s)`
  }

  const refreshData = async () => {
    setError(null)
    setFoodItems([])
    setExerciseItems([])
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

  const handleApproveItem = async (itemId, itemType) => {
    const confirmed = confirm('Are you sure you want to approve this item?')
    if (confirmed) {
      try {
        await setItemVerifiedStatus({ itemId, verified: true, itemType })

        // Save to localStorage
        const verifiedItems = JSON.parse(localStorage.getItem('verifiedItems') || '[]')
        verifiedItems.push({ itemId, itemType })
        localStorage.setItem('verifiedItems', JSON.stringify(verifiedItems))

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

  const handleItemIdChange = (itemId) => {
    setUnverifyItemId(itemId)
    // Automatically set the itemType if found in verifiedItems
    const item = verifiedItems.find(v => v.itemId === itemId)
    if (item) {
      setUnverifyItemType(item.itemType)
    }
  }

  const handleUnverifyItem = async () => {
    if (!unverifyItemId || !unverifyItemType) {
      alert('Please fill in both itemId and itemType')
      return
    }

    const confirmed = confirm('Are you sure you want to unverify this item?')
    if (confirmed) {
      try {
        await setItemVerifiedStatus({
          itemId: unverifyItemId,
          verified: false,
          itemType: unverifyItemType
        })

        console.log(`Item ${unverifyItemId} unverified`)

        // Remove from localStorage verifiedItems
        const verifiedItemsData = JSON.parse(localStorage.getItem('verifiedItems') || '[]')
        const updatedVerifiedItems = verifiedItemsData.filter(
          item => !(item.itemId === unverifyItemId && item.itemType === unverifyItemType)
        )
        localStorage.setItem('verifiedItems', JSON.stringify(updatedVerifiedItems))
        setVerifiedItems(updatedVerifiedItems)

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
      <div className="flex justify-between items-center">
        <div>
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
          className="btn-secondary flex items-center"
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
            <input
              type="text"
              placeholder="Enter item ID"
              value={unverifyItemId}
              onChange={(e) => handleItemIdChange(e.target.value)}
              className="input"
              list={verifiedItems.length > 0 ? 'verifiedItemIds' : undefined}
            />
            {verifiedItems.length > 0 && (
              <datalist id="verifiedItemIds">
                {[...new Set(verifiedItems.map(v => v.itemId))].map((id) => (
                  <option key={id} value={id} />
                ))}
              </datalist>
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
            <button
              onClick={handleUnverifyItem}
              className="btn-primary whitespace-nowrap"
            >
              Unverify item
            </button>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="card p-6">
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search items..."
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
            placeholder="Filter by country code"
            value={filterCountryCode}
            onChange={(e) => setFilterCountryCode(e.target.value)}
            className="input pl-10"
          />
        </div>
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

        {/* Food Items Table */}
        {activeTab === 'food' && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Country</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Barcode</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ingredients</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Recipe Steps</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Verified</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Public</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Manual</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">AI Gen</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Brand</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Calories</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nutriscore</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nutrients</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Serving</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Photo</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Brand Photo</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Updated</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {getCurrentItems().map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-center space-x-2">
                        <button className="text-blue-600 hover:text-blue-900" onClick={() => handleApproveItem(item.id, 'FOOD')}>
                          <CheckIcon className="w-4 h-4" />
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
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 max-w-xs truncate" title={item.createdByUserId}>
                      {item.createdByUserId ? (
                        <button
                          onClick={() => handleShowUser(item.createdByUserId)}
                          className="text-blue-600 hover:text-blue-900 underline cursor-pointer"
                        >
                          {item.createdByUserId}
                        </button>
                      ) : 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.barcode || 'N/A'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {item.ingredients ? (
                        <button
                          onClick={() => handleShowIngredients(item.ingredients)}
                          className="text-blue-600 hover:text-blue-900 underline"
                        >
                          {item.ingredients.length} ingredients
                        </button>
                      ) : (
                        'N/A'
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
                        'N/A'
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.category || 'N/A'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${item.isVerified ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {item.isVerified ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${item.isPublic !== null && item.isPublic !== undefined ? (item.isPublic ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800') : 'bg-gray-100 text-gray-800'}`}>
                        {item.isPublic !== null && item.isPublic !== undefined ? (item.isPublic ? 'Yes' : 'No') : 'N/A'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${item.isManual ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}>
                        {item.isManual !== null && item.isManual !== undefined ? (item.isManual ? 'Yes' : 'No') : 'N/A'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${item.isAIGenerated ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'}`}>
                        {item.isAIGenerated !== null && item.isAIGenerated !== undefined ? (item.isAIGenerated ? 'Yes' : 'No') : 'N/A'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.brand || 'N/A'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.totalTimeInMinutes || 'N/A'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.totalCalories || 'N/A'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.nutriscore || 'N/A'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {item.totalNutrients ? (
                        <button
                          onClick={() => handleShowNutrients(item.totalNutrients)}
                          className="text-blue-600 hover:text-blue-900 underline"
                        >
                          View
                        </button>
                      ) : (
                        'N/A'
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {item.serving ? (
                        <button
                          onClick={() => handleShowServings(item.serving)}
                          className="text-blue-600 hover:text-blue-900 underline"
                        >
                          {formatServings(item.serving)}
                        </button>
                      ) : (
                        'N/A'
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
                        'N/A'
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
                        'N/A'
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {item.dateTimeCreated ? new Date(item.dateTimeCreated).toLocaleDateString() : 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {item.dateTimeUpdated ? new Date(item.dateTimeUpdated).toLocaleDateString() : 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Exercise Items Table */}
        {activeTab === 'exercise' && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Duration (min)</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Calories Burnt</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Verified</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Public</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Manual</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Photo</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Updated</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {getCurrentItems().map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex justify-center space-x-2">
                        <button className="text-blue-600 hover:text-blue-900" onClick={() => handleApproveItem(item.id, 'EXERCISE')}>
                          <CheckIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{item.name || 'N/A'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.durationInMinutes || 'N/A'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.caloriesBurnt || 'N/A'}</td>

                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.createdByUserId || 'N/A'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${item.isVerified ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {item.isVerified ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${item.isPublic !== null && item.isPublic !== undefined ? (item.isPublic ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800') : 'bg-gray-100 text-gray-800'}`}>
                        {item.isPublic !== null && item.isPublic !== undefined ? (item.isPublic ? 'Yes' : 'No') : 'N/A'}
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
                        'N/A'
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {item.dateTimeCreated ? new Date(item.dateTimeCreated).toLocaleDateString() : 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {item.dateTimeUpdated ? new Date(item.dateTimeUpdated).toLocaleDateString() : 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

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
            Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, activeTab === 'food' ? filteredFoodItems.length : filteredExerciseItems.length)} of{' '}
            {activeTab === 'food' ? filteredFoodItems.length : filteredExerciseItems.length} results
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
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Brand</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unit</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Serving Amount</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Weight</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {selectedIngredients.map((ing, index) => (
                    <tr key={index}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{ing.name || 'N/A'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{ing.brand || 'N/A'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{ing.quantity || 'N/A'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{ing.unit || 'N/A'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{ing.category || 'N/A'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{ing.servingAmount || 'N/A'}</td>
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

