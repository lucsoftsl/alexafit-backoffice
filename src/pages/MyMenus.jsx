import { useEffect, useMemo, useState } from 'react'
import { useSelector } from 'react-redux'
import {
  MagnifyingGlassIcon,
  PlusIcon,
  TrashIcon,
  PencilIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline'
import {
  searchFoodItems,
  getItemsByIds
} from '../services/api'
import {
  getAllMenuTemplatesByUser,
  addMenuTemplateBO,
  updateMenuTemplateBO,
  deleteMenuTemplateByIdBO,
  deleteMenuTemplateItemByIdBO,
  assignMenuTemplateToUserBO,
  removeMenuFromUserBO,
  getNutritionistClients,
  getUserMenusBO
} from '../services/loggedinApi'
import { selectUserData } from '../store/userSlice'
import { useAuth } from '../contexts/AuthContext'
import { calculateDisplayValues, findServingByIdentifier, getServingIdentifier } from '../util/menuDisplay'

const defaultPlans = { breakfastPlan: [], lunchPlan: [], dinnerPlan: [], snackPlan: [] }

const mealTypeOptions = [
  { id: 'breakfastPlan', label: 'Breakfast' },
  { id: 'lunchPlan', label: 'Lunch' },
  { id: 'dinnerPlan', label: 'Dinner' },
  { id: 'snackPlan', label: 'Snack' },
]

const MyMenus = () => {
  const [createMenuExpanded, setCreateMenuExpanded] = useState(true)
  const [menuName, setMenuName] = useState('')
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
  const [assignmentDate, setAssignmentDate] = useState(new Date().toISOString().split('T')[0])
  const [assigningMenu, setAssigningMenu] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)
  const [templateSearchTerm, setTemplateSearchTerm] = useState('')
  const [displayValues, setDisplayValues] = useState({})
  const [viewingItem, setViewingItem] = useState(null)
  const [templatesExpanded, setTemplatesExpanded] = useState(true)
  const [expandedClientMenus, setExpandedClientMenus] = useState({})
  const [clientMenusData, setClientMenusData] = useState({})
  const [loadingClientMenus, setLoadingClientMenus] = useState({})
  const userData = useSelector(selectUserData)
  const { currentUser } = useAuth()

  const nutritionistId = currentUser?.uid || userData?.userId

  const loadTemplates = async () => {
    try {
      setLoadingTemplates(true)
      const data = await getAllMenuTemplatesByUser({ createdByUserId: nutritionistId })
      setTemplates(Array.isArray(data?.data) ? data.data : (data?.templates || []))
    } catch (e) {
      console.error('Failed to load menu templates', e)
      setError('Failed to load menu templates')
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
      const menus = Array.isArray(response?.data) ? response.data : (response?.menus || [])
      
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
      setClients(Array.isArray(data?.data) ? data.data : (data?.clients || []))
    } catch (e) {
      console.error('Failed to load clients', e)
      setError('Failed to load clients')
    } finally {
      setLoadingClients(false)
    }
  }

  useEffect(() => {
    if (nutritionistId) {
      loadTemplates()
      loadClients()
    }
  }, [nutritionistId])

  const detectIsRecipe = (item) => {
    const type = (item?.itemType || item?.type || '').toString().toUpperCase()
    return type === 'RECIPE' || type === 'RECIPES'
  }

  // Find the appropriate serving item based on priority:
  // NOTE: totalCalories are calculated for profileId = 0 or name matching 'grame' etc.
  // 1. profileId = 0
  // 2. name.toLowerCase() = 'g', 'gram', 'grame', 'gramm', or 'ml'
  // 3. first item
  const findDefaultServing = (servingArray) => {
    if (!servingArray || !Array.isArray(servingArray) || servingArray.length === 0) {
      return null
    }

    // First, try to find item with profileId = 0
    let selectedServing = servingArray.find(s => s.profileId === 0)

    // If not found, try to find by name (exact match)
    if (!selectedServing) {
      const namePatterns = ['g', 'gram', 'grame', 'gramm', 'ml']
      selectedServing = servingArray.find(s => {
        const nameLower = (s.name || '').toLowerCase()
        return namePatterns.some(pattern => nameLower === pattern)
      })
    }

    // Fall back to first item
    if (!selectedServing) {
      selectedServing = servingArray[0]
    }

    return selectedServing
  }

  const handleSearch = async (e) => {
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
      setSearchResults(Array.isArray(data) ? data : [])
    } catch (e) {
      console.error('Search failed', e)
      setError('Search failed')
    } finally {
      setSearching(false)
    }
  }

  const addItemToPlan = async (item) => {
    try {
      let enriched = item
      // Store original serving info - try to get from serving array or default
      let originalServingAmount = 100 // Default to 100g if no serving info
      let originalServingId = null

      if (item?.serving && Array.isArray(item.serving) && item.serving.length > 0) {
        // Use findDefaultServing to get the serving that matches totalCalories calculation
        const defaultServing = findDefaultServing(item.serving)
        originalServingAmount = defaultServing?.amount || 100
        originalServingId = getServingIdentifier(defaultServing)
      }

      // Fetch detailed info for both recipes and foods to get complete serving array
      try {
        const id = item?.id || item?.itemId || item?._id
        if (id) {
          const resp = await getItemsByIds({ ids: [id] })
          const detailed = resp?.data?.[0] || resp?.items?.[0]
          if (detailed) {
            if (detectIsRecipe(item)) {
              // Store original values for scaling
              const originalServings = detailed?.numberOfServings || 1
              // Get original serving info from detailed item if available
              // For recipes, totalCalories is for all servings (numberOfServings)
              // We need to find the total weight for all servings
              if (detailed?.serving && Array.isArray(detailed.serving) && detailed.serving.length > 0) {
                // First, try to find "Portion" (profileId=1) which represents 1 serving
                const portionServing = detailed.serving.find(s => s.profileId === 1)
                if (portionServing) {
                  // Portion amount is per 1 serving, so multiply by numberOfServings for total
                  originalServingAmount = portionServing.amount * originalServings
                  originalServingId = getServingIdentifier(portionServing)
                } else {
                  // Fall back to totalQuantity or weightAfterCooking if available
                  const totalWeight = detailed?.totalNutrients?.totalQuantity ||
                    detailed?.totalNutrients?.weightAfterCooking ||
                    null
                  if (totalWeight) {
                    originalServingAmount = totalWeight
                    // Use default serving for ID
                    const defaultServing = findDefaultServing(detailed.serving)
                    originalServingId = getServingIdentifier(defaultServing)
                  } else {
                    // Last resort: use default serving and multiply by numberOfServings
                    const defaultServing = findDefaultServing(detailed.serving)
                    originalServingAmount = (defaultServing?.amount || 100) * originalServings
                    originalServingId = getServingIdentifier(defaultServing)
                  }
                }
              }

              const enrichedData = {
                ...item,
                ...detailed,
                originalServings,
                originalCalories: detailed?.totalCalories,
                originalNutrients: detailed?.totalNutrients,
                numberOfServings: originalServings,
                originalServingAmount,
                originalServingId
              }

              // Scale ingredients to match serving count
              if (detailed?.ingredients && Array.isArray(detailed.ingredients)) {
                enrichedData.ingredients = detailed.ingredients.map(ingredient => ({
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
                  macronutrientsEx: ingredient?.macronutrientsEx,
                }))
              }

              enriched = enrichedData
            } else {
              // For food items, get serving info from detailed item
              if (detailed?.serving && Array.isArray(detailed.serving) && detailed.serving.length > 0) {
                // Use findDefaultServing to get the serving that matches totalCalories calculation
                const defaultServing = findDefaultServing(detailed.serving)
                originalServingAmount = defaultServing?.amount || 100
                originalServingId = getServingIdentifier(defaultServing)
              }

              enriched = {
                ...item,
                ...detailed,
                originalCalories: detailed?.totalCalories || item?.totalCalories,
                originalNutrients: detailed?.totalNutrients || item?.totalNutrients,
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
            originalCalories: item?.totalCalories,
            originalNutrients: item?.totalNutrients,
            originalServingAmount,
            originalServingId
          }
        }
      }

      // Add item to plan
      const newIndex = plans[activeMealType].length
      const itemKey = `${activeMealType}-${newIndex}`

      // Initialize display values
      // For recipes, default to 1 serving (Portion) if available, otherwise use original
      let initialServingId = originalServingId
      let initialServingAmount = originalServingAmount

      if (detectIsRecipe(enriched) && enriched?.serving && Array.isArray(enriched.serving)) {
        const portionServing = enriched.serving.find(s => s.profileId === 1)
        if (portionServing) {
          // Default to 1 serving (Portion) for recipes
          initialServingId = getServingIdentifier(portionServing)
          initialServingAmount = portionServing.amount
        }
      }

      setDisplayValues(prev => ({
        ...prev,
        [itemKey]: {
          selectedServingId: initialServingId,
          servingAmount: initialServingAmount,
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
      setError('Failed to add item')
    }
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

  const handleSaveTemplate = async (e) => {
    e.preventDefault()
    if (!menuName.trim()) {
      setError('Please enter a menu name')
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
          if (displayValue &&
            displayValue.servingAmount !== undefined &&
            displayValue.servingAmount !== '' &&
            displayValue.selectedServingId !== null &&
            displayValue.selectedServingId !== undefined) {
            // Find the serving object using the identifier
            const servingOptions = item?.serving && Array.isArray(item.serving) ? item.serving : []
            const selectedServing = findServingByIdentifier(servingOptions, displayValue.selectedServingId)

            if (selectedServing) {
              // Store the entire serving object instead of just the ID
              itemCopy.changedServing = {
                value: displayValue.servingAmount,
                serving: selectedServing
              }
            }
          }

          return itemCopy
        })
      }

      const templateData = {
        name: menuName,
        breakfastPlan: preparePlanWithChangedServing(plans.breakfastPlan, 'breakfastPlan'),
        lunchPlan: preparePlanWithChangedServing(plans.lunchPlan, 'lunchPlan'),
        dinnerPlan: preparePlanWithChangedServing(plans.dinnerPlan, 'dinnerPlan'),
        snackPlan: preparePlanWithChangedServing(plans.snackPlan, 'snackPlan'),
        isAssignableByUser,
        createdByUserId: nutritionistId
      }

      if (editingTemplateId) {
        await updateMenuTemplateBO({ ...templateData, menuTemplateId: editingTemplateId })
      } else {
        await addMenuTemplateBO(templateData)
      }

      setMenuName('')
      setPlans(defaultPlans)
      setDisplayValues({})
      setEditingTemplateId(null)
      setError(null)
      await loadTemplates()
    } catch (e) {
      console.error('Failed to save template', e)
      setError(e?.message || 'Failed to save template')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteTemplate = async (templateId) => {
    if (!window.confirm('Are you sure you want to delete this menu template?')) return

    try {
      await deleteMenuTemplateByIdBO({ menuTemplateId: templateId, createdByUserId: nutritionistId })
      await loadTemplates()
    } catch (e) {
      console.error('Failed to delete template', e)
      setError('Failed to delete template')
    }
  }

  const handleDeleteItem = async (templateId, itemType, itemId) => {
    if (!window.confirm('Remove this item from the menu?')) return

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
      setError('Failed to delete item')
    }
  }

  const handleAssignMenu = async (templateId) => {
    if (!selectedClientId || !assignmentDate) {
      setError('Please select a client and date')
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
      alert('Menu assigned successfully')
      // Refresh templates after assignment
      await loadTemplates()
    } catch (e) {
      console.error('Failed to assign menu', e)
      setError('Failed to assign menu')
    } finally {
      setAssigningMenu(false)
    }
  }

  const handleUnassignMenu = async (templateId, clientId, dateApplied) => {
    if (!window.confirm('Are you sure you want to unassign this menu from the client?')) return

    try {
      await removeMenuFromUserBO({
        userId: clientId,
        menuTemplateId: templateId,
        dateApplied
      })
      setError(null)
      alert('Menu unassigned successfully')
      // Refresh templates after unassignment
      await loadTemplates()
    } catch (e) {
      console.error('Failed to unassign menu', e)
      setError('Failed to unassign menu')
    }
  }

  const handleLoadTemplateForEditing = (template) => {
    const id = template?.id || template?._id || template?.menuTemplateId

    setEditingTemplateId(id)
    setMenuName(template?.name || '')

    const loadedPlans = {
      breakfastPlan: template?.breakfastPlan || [],
      lunchPlan: template?.lunchPlan || [],
      dinnerPlan: template?.dinnerPlan || [],
      snackPlan: template?.snackPlan || [],
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
          // If changedServing has the serving object, use it directly
          let servingIdentifier = null
          if (item.changedServing.serving) {
            servingIdentifier = getServingIdentifier(item.changedServing.serving)
          } else {
            // Legacy support: if it has servingId instead of serving object, try to find it
            const servingOptions = item?.serving && Array.isArray(item.serving) ? item.serving : []
            if (servingOptions.length > 0) {
              const foundServing = servingOptions.find(s => {
                if (typeof item.changedServing.servingId === 'number') {
                  return s.profileId === item.changedServing.servingId
                } else {
                  return getServingIdentifier(s) === item.changedServing.servingId
                }
              })
              if (foundServing) {
                servingIdentifier = getServingIdentifier(foundServing)
              } else {
                servingIdentifier = item.changedServing.servingId
              }
            } else {
              servingIdentifier = item.changedServing.servingId
            }
          }

          initialDisplayValues[itemKey] = {
            selectedServingId: servingIdentifier,
            servingAmount: item.changedServing.value,
          }
        } else {
          // Use original serving info, or extract from serving array if not stored
          let originalServingAmount = item?.originalServingAmount
          let originalServingId = item?.originalServingId

          // If not stored, try to extract from serving array
          if (!originalServingAmount && item?.serving && Array.isArray(item.serving) && item.serving.length > 0) {
            const isRecipe = detectIsRecipe(item)
            if (isRecipe) {
              // For recipes, try to find "Portion" (profileId=1) first
              const portionServing = item.serving.find(s => s.profileId === 1)
              if (portionServing) {
                const numberOfServings = item?.numberOfServings || item?.originalServings || 1
                originalServingAmount = portionServing.amount * numberOfServings
                originalServingId = getServingIdentifier(portionServing)
              } else {
                // Fall back to totalQuantity or weightAfterCooking if available
                const totalWeight = item?.totalNutrients?.totalQuantity ||
                  item?.totalNutrients?.weightAfterCooking ||
                  null
                if (totalWeight) {
                  originalServingAmount = totalWeight
                  const defaultServing = findDefaultServing(item.serving)
                  originalServingId = getServingIdentifier(defaultServing)
                } else {
                  const defaultServing = findDefaultServing(item.serving)
                  const numberOfServings = item?.numberOfServings || item?.originalServings || 1
                  originalServingAmount = (defaultServing?.amount || 100) * numberOfServings
                  originalServingId = getServingIdentifier(defaultServing)
                }
              }
            } else {
              // For foods, use default serving
              const defaultServing = findDefaultServing(item.serving)
              originalServingAmount = defaultServing?.amount || 100
              originalServingId = getServingIdentifier(defaultServing)
            }
          } else if (!originalServingAmount) {
            originalServingAmount = 100
            originalServingId = null
          }

          initialDisplayValues[itemKey] = {
            selectedServingId: originalServingId,
            servingAmount: originalServingAmount,
          }
        }
      })
    })
    setDisplayValues(initialDisplayValues)
  }

  const filteredTemplates = useMemo(() => {
    return templates.filter(t =>
      t?.name?.toLowerCase().includes(templateSearchTerm.toLowerCase())
    )
  }, [templates, templateSearchTerm])

  useEffect(() => {
    const newTotalPages = Math.max(1, Math.ceil(filteredTemplates.length / itemsPerPage))
    if (currentPage > newTotalPages) {
      setCurrentPage(newTotalPages)
    }
  }, [filteredTemplates.length, itemsPerPage, currentPage])

  const totalPages = useMemo(() => Math.max(1, Math.ceil(filteredTemplates.length / itemsPerPage)), [filteredTemplates.length, itemsPerPage])

  const paginatedTemplates = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage
    return filteredTemplates.slice(startIndex, startIndex + itemsPerPage)
  }, [filteredTemplates, currentPage, itemsPerPage])

  if (loadingTemplates && templates.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
          <p className="mt-4 text-gray-600">Loading menus...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">My Menus</h1>
          <p className="text-gray-600 mt-2">Create and manage menu templates for your clients</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Create/Edit Menu Section */}
      <div className="card p-6">
        <div className="flex items-center justify-between cursor-pointer" onClick={() => setCreateMenuExpanded(!createMenuExpanded)}>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              {editingTemplateId ? 'Edit Menu Template' : 'Create Menu Template'}
            </h2>
            <p className="text-gray-500 text-sm">Build meal plans by searching foods or recipes</p>
          </div>
          <div className="flex items-center gap-2">
            {editingTemplateId && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setEditingTemplateId(null)
                  setMenuName('')
                  setPlans(defaultPlans)
                  setDisplayValues({})
                }}
                className="px-3 py-1 text-sm text-gray-600 hover:text-gray-900"
              >
                Cancel Edit
              </button>
            )}
            {createMenuExpanded ? <ChevronUpIcon className="w-5 h-5 text-gray-600" /> : <ChevronDownIcon className="w-5 h-5 text-gray-600" />}
          </div>
        </div>

        {createMenuExpanded && (
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Menu Name</label>
              <input
                type="text"
                value={menuName}
                onChange={e => setMenuName(e.target.value)}
                className="input w-full"
                placeholder="e.g., Keto Diet Plan, High Protein..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Country Code</label>
              <select
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="RO">RO</option>
                <option value="US">US</option>
                <option value="IT">IT</option>
                <option value="ES">ES</option>
                <option value="UK">UK</option>
                <option value="DE">DE</option>
                <option value="FR">FR</option>
                <option value="HU">HU</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={isAssignableByUser}
                onChange={e => setIsAssignableByUser(e.target.checked)}
                className="mr-2"
              />
              <span className="text-sm text-gray-700">Assignable by user</span>
            </label>
          </div>

          {/* Search for items */}
          <form onSubmit={handleSearch} className="space-y-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
                placeholder="Search foods or recipes..."
                className="input flex-1"
              />
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={onlyRecipes}
                  onChange={e => setOnlyRecipes(e.target.checked)}
                />
                <span className="text-sm">Recipes only</span>
              </label>
              <button type="submit" className="btn-secondary" disabled={searching}>
                {searching ? 'Searching...' : 'Search'}
              </button>
            </div>
          </form>

          {/* Meal type selector */}
          <div className="flex gap-2 border-b border-gray-200">
            {mealTypeOptions.map(meal => (
              <button
                key={meal.id}
                onClick={() => setActiveMealType(meal.id)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeMealType === meal.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                {meal.label}
              </button>
            ))}
          </div>

          {/* Search results */}
          {searchResults.length > 0 && (
            <div className="max-h-56 overflow-y-auto border border-gray-200 rounded-md divide-y">
              {searchResults.map((item, idx) => {
                const isRecipeItem = detectIsRecipe(item)
                const selectedServing = findDefaultServing(item?.serving)
                const servingAmount = selectedServing?.amount || 0
                const numberOfServings = isRecipeItem ? (item?.numberOfServings || item?.originalServings || 1) : 1
                const newAmount = isRecipeItem ? servingAmount * numberOfServings : servingAmount

                return (
                  <div key={idx} className="p-3 flex items-center justify-between hover:bg-gray-50">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">{item?.name || item?.title || 'Unnamed'}</div>
                      <div className="text-xs text-gray-600">
                        {(detectIsRecipe(item) ? 'Recipe' : 'Food')}
                        {typeof item?.totalCalories === 'number' ? ` • ${item.totalCalories} cal/${newAmount}g` : ''}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => addItemToPlan(item)}
                      className="bg-green-600 text-white px-3 py-1 rounded-md hover:bg-green-700 flex items-center"
                    >
                      <PlusIcon className="w-4 h-4 mr-1" /> Add
                    </button>
                  </div>
                )
              })}
            </div>
          )}

          {/* Current meal items */}
          {plans[activeMealType]?.length > 0 && (
            <div className="bg-gray-50 rounded p-3 space-y-2">
              <p className="text-sm font-medium text-gray-700">Items in {mealTypeOptions.find(m => m.id === activeMealType)?.label}</p>
              {plans[activeMealType].map((item, idx) => {
                const isRecipeItem = detectIsRecipe(item)
                const itemKey = `${activeMealType}-${idx}`
                const displayValue = displayValues[itemKey]

                const servingOptions = item?.serving && Array.isArray(item.serving) ? item.serving : []
                const hasServings = servingOptions.length > 0

                const currentServingAmount = displayValue?.servingAmount !== undefined ? displayValue.servingAmount : (item?.originalServingAmount || 100)
                const currentServingId = displayValue?.selectedServingId || item?.originalServingId || null

                let originalServingAmount = item?.originalServingAmount
                if (!originalServingAmount && servingOptions.length > 0) {
                  if (isRecipeItem) {
                    const portionServing = servingOptions.find(s => s.profileId === 1)
                    if (portionServing) {
                      const numberOfServings = item?.numberOfServings || item?.originalServings || 1
                      originalServingAmount = portionServing.amount * numberOfServings
                    } else {
                      const totalWeight = item?.totalNutrients?.totalQuantity ||
                        item?.totalNutrients?.weightAfterCooking ||
                        null
                      if (totalWeight) {
                        originalServingAmount = totalWeight
                      } else {
                        const defaultServing = findDefaultServing(servingOptions)
                        const numberOfServings = item?.numberOfServings || item?.originalServings || 1
                        originalServingAmount = (defaultServing?.amount || 100) * numberOfServings
                      }
                    }
                  } else {
                    const defaultServing = findDefaultServing(servingOptions)
                    originalServingAmount = defaultServing?.amount || 100
                  }
                }
                originalServingAmount = originalServingAmount || 100

                const servingAmountForCalc = currentServingAmount === '' || currentServingAmount === undefined ? originalServingAmount : currentServingAmount
                const calculated = calculateDisplayValues(item, servingAmountForCalc, originalServingAmount)
                const adjustedCalories = calculated.calories
                const adjustedNutrients = calculated.nutrients

                return (
                  <div key={idx} className="p-2 rounded bg-white shadow-sm">
                    <div className="flex items-start justify-between">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">{item?.name || item?.title || 'Unnamed'}</div>
                        <div className="text-xs text-gray-500 truncate">{isRecipeItem ? 'Recipe' : 'Food'}</div>
                      </div>
                      <button onClick={() => removeItemFromPlan(activeMealType, idx)} className="text-red-600 hover:text-red-800">
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Serving dropdown and textinput for both foods and recipes */}
                    {hasServings && (
                      <div className="mt-2 mb-2 flex items-center gap-2">
                        <label className="text-xs text-gray-600 font-medium whitespace-nowrap">Serving:</label>
                        <select
                          value={currentServingId || ''}
                          onChange={(e) => {
                            const selectedIdentifier = e.target.value || null
                            const selectedServing = findServingByIdentifier(servingOptions, selectedIdentifier)
                            const servingAmount = selectedServing?.amount || 0

                            setDisplayValues(prev => ({
                              ...prev,
                              [itemKey]: {
                                selectedServingId: selectedIdentifier,
                                servingAmount: servingAmount || currentServingAmount,
                              }
                            }))
                          }}
                          className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs"
                        >
                          {servingOptions.map((serving, sIdx) => {
                            const servingId = getServingIdentifier(serving)
                            return (
                              <option key={servingId || sIdx} value={servingId}>
                                {serving.name || serving.innerName}
                              </option>
                            )
                          })}
                        </select>
                        <input
                          type="text"
                          value={currentServingAmount}
                          onChange={(e) => {
                            const inputValue = e.target.value
                            const newAmount = inputValue === '' ? '' : inputValue || 0

                            setDisplayValues(prev => ({
                              ...prev,
                              [itemKey]: {
                                selectedServingId: currentServingId,
                                servingAmount: newAmount === '' ? '' : newAmount,
                              }
                            }))
                          }}
                          onBlur={(e) => {
                            const inputValue = e.target.value
                            if (inputValue === '') {
                              const originalServingAmount = item?.originalServingAmount || 100
                              setDisplayValues(prev => ({
                                ...prev,
                                [itemKey]: {
                                  selectedServingId: currentServingId,
                                  servingAmount: originalServingAmount,
                                }
                              }))
                            }
                          }}
                          className="w-24 px-2 py-1 border border-gray-300 rounded text-xs"
                          placeholder="Amount"
                        />
                        <span className="text-xs text-gray-500 whitespace-nowrap">
                          {findServingByIdentifier(servingOptions, currentServingId)?.unit || 'g'}
                        </span>
                      </div>
                    )}

                    {isRecipeItem && (
                      <div className="mt-1 mb-4 text-xs text-gray-600">
                        <span className="font-medium">Original Serving:</span> {item?.numberOfServings || item?.originalServings || 1}
                      </div>
                    )}

                    <div className="mt-1 text-xs text-gray-600">
                      <span className="font-medium">Calories:</span> {adjustedCalories}
                      <span className="mx-2">|</span>
                      <span className="font-medium">Proteins:</span> {Math.round(Number(adjustedNutrients?.proteinsInGrams) || 0)} g
                      <span className="mx-2">|</span>
                      <span className="font-medium">Carbs:</span> {Math.round(Number(adjustedNutrients?.carbohydratesInGrams) || 0)} g
                      <span className="mx-2">|</span>
                      <span className="font-medium">Fat:</span> {Math.round(Number(adjustedNutrients?.fatInGrams) || 0)} g
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <button
            onClick={handleSaveTemplate}
            disabled={submitting || !menuName.trim()}
            className="btn-primary w-full"
          >
            {submitting ? 'Saving...' : editingTemplateId ? 'Update Menu' : 'Create Menu'}
          </button>
        </div>
        )}
      </div>

      {/* Menu Templates List */}
      <div className="card p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Menu Templates ({filteredTemplates.length})</h2>
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search templates..."
                value={templateSearchTerm}
                onChange={e => setTemplateSearchTerm(e.target.value)}
                className="input pl-10 w-full"
              />
            </div>
            <button
              onClick={loadTemplates}
              disabled={loadingTemplates}
              className="p-2 text-blue-600 hover:text-blue-900 hover:bg-blue-100 rounded transition-colors"
              title="Refresh templates list"
            >
              <ArrowPathIcon className={`w-5 h-5 ${loadingTemplates ? 'animate-spin' : ''}`} />
            </button>

                        <button
              onClick={() => setTemplatesExpanded(!templatesExpanded)}
              className="p-2 text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
              title={templatesExpanded ? 'Collapse templates' : 'Expand templates'}
            >
              {templatesExpanded ? <ChevronUpIcon className="w-5 h-5" /> : <ChevronDownIcon className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {templatesExpanded && (
          <>
            {filteredTemplates.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500">No menu templates yet. Create one above!</p>
              </div>
            ) : (
              <>
                <div className="space-y-4">
            {paginatedTemplates.map(template => (
              <div key={template.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{template?.name}</h3>
                    <p className="text-xs text-gray-500">ID: {template?.id}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        handleLoadTemplateForEditing(template)
                      }}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      <PencilIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteTemplate(template.id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Meal preview */}
                <div className="grid grid-cols-4 gap-2 mb-4 text-xs">
                  {mealTypeOptions.map(meal => (
                    <div key={meal.id} className="bg-gray-50 p-2 rounded">
                      <p className="font-medium text-gray-700 mb-1">{meal.label}</p>
                      <p className="text-gray-500">
                        {template[meal.id]?.length || 0} items
                      </p>
                    </div>
                  ))}
                </div>

                {/* Clients with this template assigned */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-gray-900">Assigned to Clients:</p>
                    <button
                      onClick={loadClients}
                      disabled={loadingClients}
                      className="p-1 text-blue-600 hover:text-blue-900 hover:bg-blue-100 rounded transition-colors"
                      title="Refresh clients list"
                    >
                      <ArrowPathIcon className={`w-4 h-4 ${loadingClients ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
                  {clients.length === 0 ? (
                    <p className="text-xs text-gray-600">No clients</p>
                  ) : (
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {clients.map(client => {
                        const clientId = Array.isArray(client?.user?.userId) ? client.user.userId[0] : client?.user?.userId
                        const clientName = client?.user?.userData?.name || client?.user?.loginDetails?.displayName || 'Unknown'
                        const assignedUsers = template?.assignedUsers || []
                        const assignmentInfo = assignedUsers.find(au => au.userId === clientId)

                        // Only show clients that have this template assigned
                        if (!assignmentInfo) {
                          return null
                        }

                        const menuKey = `${template.id}-${clientId}`
                        const isExpanded = expandedClientMenus[menuKey]

                        return (
                          <div key={clientId}>
                            <button
                              onClick={() => setExpandedClientMenus(prev => ({
                                ...prev,
                                [menuKey]: !prev[menuKey]
                              }))}
                              className="text-left w-full px-2 py-1 rounded hover:bg-blue-100 flex items-center justify-between text-sm text-blue-900"
                            >
                              <div className="flex-1">
                                <span className="font-medium">{clientName}</span>
                                <span className="text-xs text-gray-600 ml-2">
                                  assigned {new Date(assignmentInfo.dateApplied).toLocaleDateString()}
                                </span>
                              </div>
                              {isExpanded ? <ChevronUpIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />}
                            </button>
                            {isExpanded && (
                              <div className="ml-4 mt-1 bg-white rounded border border-blue-100 p-2 text-xs text-gray-700 space-y-2">
                                <p>User ID: {clientId}</p>
                                <p>Assigned: {new Date(assignmentInfo.dateApplied).toLocaleDateString()}</p>
                                <button
                                  onClick={() => handleUnassignMenu(template.id, clientId, assignmentInfo.dateApplied)}
                                  className="text-red-600 hover:text-red-900 hover:bg-red-50 px-2 py-1 rounded text-xs font-medium"
                                >
                                  Unassign
                                </button>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* Assign to client */}
                <div className="border-t border-gray-200 pt-3 flex gap-2">
                  <select
                    value={selectedClientId || ''}
                    onChange={e => setSelectedClientId(e.target.value)}
                    className="input flex-1 text-sm"
                    disabled={loadingClients}
                  >
                    <option value="">Select client to assign...</option>
                    {clients.map(client => {
                      const clientName = client?.user?.userData?.name || client?.user?.loginDetails?.displayName || 'Unknown'
                      const clientId = Array.isArray(client?.user?.userId) ? client.user.userId[0] : client?.user?.userId
                      return (
                        <option key={clientId} value={clientId}>
                          {clientName}
                        </option>
                      )
                    })}
                  </select>
                  <input
                    type="date"
                    value={assignmentDate}
                    onChange={e => setAssignmentDate(e.target.value)}
                    className="input text-sm w-40"
                  />
                  <button
                    onClick={() => handleAssignMenu(template.id)}
                    disabled={assigningMenu || !selectedClientId}
                    className="btn-primary text-sm px-4"
                  >
                    {assigningMenu ? 'Assigning...' : 'Assign'}
                  </button>
                </div>
              </div>
            ))}
                </div>

                <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-700">Rows per page</span>
                      <select
                        value={itemsPerPage}
                        onChange={(e) => {
                          setItemsPerPage(Number(e.target.value))
                          setCurrentPage(1)
                        }}
                        className="border border-gray-300 rounded px-2 py-1 text-sm"
                      >
                        {[5, 10, 20].map(size => (
                          <option key={size} value={size}>{size}</option>
                        ))}
                      </select>
                    </div>
                    <span className="text-sm text-gray-700">
                      Showing {filteredTemplates.length === 0 ? 0 : ((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, filteredTemplates.length)} of {filteredTemplates.length}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50"
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                    >
                      Previous
                    </button>
                    <span className="text-sm text-gray-700">Page {currentPage} of {totalPages}</span>
                    <button
                      className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50"
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Next
                    </button>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default MyMenus
