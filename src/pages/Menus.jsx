import { useEffect, useMemo, useState } from 'react'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import {
  MagnifyingGlassIcon,
  PlusIcon,
  TrashIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  PencilIcon,
  DocumentDuplicateIcon,
  SparklesIcon,
  XMarkIcon
} from '@heroicons/react/24/outline'
import {
  searchFoodItems,
  getItemsByIds,
  addMenuTemplate,
  updateMenuTemplate,
  getAllMenuTemplates,
  deleteMenuTemplateById,
  getUsers,
  assignMenuTemplateToUser,
  getUserMenus,
  removeMenuFromUser,
  copyMenuTemplateToCountry
} from '../services/api'
import { selectIsAdmin } from '../store/userSlice'
import { useAuth } from '../contexts/AuthContext'

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

const Menus = () => {
  const { t } = useTranslation()
  // Glass UI utility classes
  const glassCardClass =
    'relative rounded-2xl border border-white/20 bg-white/10 backdrop-blur-xl shadow-xl'
  const glassSurfaceClass =
    'relative rounded-2xl border border-white/15 bg-white/5 backdrop-blur-md'

  const [expanded, setExpanded] = useState(true)
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
  const [refreshing, setRefreshing] = useState(false)
  const [editingTemplateId, setEditingTemplateId] = useState(null)
  const [users, setUsers] = useState([])
  const isAdmin = useSelector(selectIsAdmin)
  const [selectedUserId, setSelectedUserId] = useState(null)
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [userMenus, setUserMenus] = useState([])
  const [loadingUserMenus, setLoadingUserMenus] = useState(false)
  const [assignmentDate, setAssignmentDate] = useState(
    new Date().toISOString().split('T')[0]
  )
  const [assigningMenu, setAssigningMenu] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [usersPerPage, setUsersPerPage] = useState(5)
  const [userSearchTerm, setUserSearchTerm] = useState('')
  const [userMenusSortField, setUserMenusSortField] = useState('dateApplied')
  const [userMenusSortDirection, setUserMenusSortDirection] = useState('desc')
  const [removingMenu, setRemovingMenu] = useState(false)
  const [viewingUserMenu, setViewingUserMenu] = useState(null)
  const [templateSearchTerm, setTemplateSearchTerm] = useState('')
  const [viewingCreator, setViewingCreator] = useState(null)
  // State to track display values for items (separate from original values)
  const [displayValues, setDisplayValues] = useState({})

  // Collapsible sections state
  const [templatesExpanded, setTemplatesExpanded] = useState(true)
  const [usersExpanded, setUsersExpanded] = useState(true)

  // Pagination for templates
  const [templatesPage, setTemplatesPage] = useState(1)
  const [templatesPerPage, setTemplatesPerPage] = useState(5)

  // Copy template modal state
  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false)
  const [selectedTemplateForCopy, setSelectedTemplateForCopy] = useState(null)
  const [copyCountryCode, setCopyCountryCode] = useState('RO')
  const [copyingTemplate, setCopyingTemplate] = useState(false)

  const loadTemplates = async () => {
    try {
      setLoadingTemplates(true)
      const data = await getAllMenuTemplates()
      setTemplates(
        Array.isArray(data?.data) ? data.data : data?.templates || []
      )
    } catch (e) {
      console.error('Failed to load menu templates', e)
    } finally {
      setLoadingTemplates(false)
    }
  }

  useEffect(() => {
    if (isAdmin) {
      loadTemplates()
      loadUsers()
    }
  }, [isAdmin])

  useEffect(() => {
    if (selectedUserId) {
      loadUserMenus(selectedUserId)
    } else {
      setUserMenus([])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUserId])

  const loadUsers = async () => {
    try {
      // Check if data exists in localStorage first
      const cachedData = localStorage.getItem('users')
      if (cachedData) {
        const data = JSON.parse(cachedData)
        setUsers(Array.isArray(data?.data) ? data.data : data?.users || [])
        return
      }

      setLoadingUsers(true)
      const data = await getUsers()
      data?.users?.sort(
        (a, b) => new Date(b.dateTimeUpdated) - new Date(a.dateTimeUpdated)
      )
      const usersArray = Array.isArray(data?.data)
        ? data.data
        : data?.users || []
      setUsers(usersArray)
      localStorage.setItem('users', JSON.stringify(data))
    } catch (e) {
      console.error('Failed to load users', e)
    } finally {
      setLoadingUsers(false)
    }
  }

  const refreshUsers = async () => {
    try {
      localStorage.removeItem('users')
      setLoadingUsers(true)
      const data = await getUsers()
      data?.users?.sort(
        (a, b) => new Date(b.dateTimeUpdated) - new Date(a.dateTimeUpdated)
      )

      const usersArray = Array.isArray(data?.data)
        ? data.data
        : data?.users || []
      setUsers(usersArray)
      localStorage.setItem('users', JSON.stringify(data))
      setCurrentPage(1) // Reset to first page after refresh
    } catch (e) {
      console.error('Failed to refresh users', e)
    } finally {
      setLoadingUsers(false)
    }
  }

  const loadUserMenus = async userId => {
    try {
      setLoadingUserMenus(true)
      const data = await getUserMenus({ userId })
      setUserMenus(Array.isArray(data?.data) ? data.data : data?.menus || [])
    } catch (e) {
      console.error('Failed to load user menus', e)
      setUserMenus([])
    } finally {
      setLoadingUserMenus(false)
    }
  }

  const handleAssignMenuTemplate = async () => {
    if (!editingTemplateId || !selectedUserId) {
      alert('Please select both a menu template and a user')
      return
    }

    try {
      setAssigningMenu(true)
      await assignMenuTemplateToUser({
        userId: selectedUserId,
        menuTemplateId: editingTemplateId,
        dateApplied: assignmentDate
      })
      alert('Menu template assigned successfully!')
      // Refresh user menus after assignment
      await loadUserMenus(selectedUserId)
    } catch (e) {
      console.error('Failed to assign menu template', e)
      alert('Failed to assign menu template')
    } finally {
      setAssigningMenu(false)
    }
  }

  const handleRemoveMenu = async menu => {
    if (!selectedUserId) {
      alert('Please select a user first')
      return
    }

    const confirmed = confirm(
      `Are you sure you want to remove this menu template from the user?`
    )
    if (!confirmed) {
      return
    }

    try {
      setRemovingMenu(true)
      const menuTemplateId = menu?.menuTemplateId || menu?.id
      const dateApplied = menu?.dateApplied

      if (!dateApplied) {
        alert('Date applied is missing for this menu')
        return
      }

      await removeMenuFromUser({
        userId: selectedUserId,
        dateApplied: dateApplied,
        menuTemplateId: menuTemplateId
      })
      alert('Menu removed successfully!')
      // wait 1.5 seconds
      await new Promise(resolve => setTimeout(resolve, 1500))
      // Refresh user menus after removal
      loadUserMenus(selectedUserId)
    } catch (e) {
      console.error('Failed to remove menu', e)
      alert('Failed to remove menu')
    } finally {
      setRemovingMenu(false)
    }
  }

  const handleSearch = async () => {
    if (!searchText.trim()) return
    try {
      setSearching(true)
      setError(null)
      // userId is not relevant for template authoring in backoffice; pass a static value
      const results = await searchFoodItems({
        searchText,
        userId: currentUser?.uid,
        onlyRecipes,
        countryCode
      })
      setSearchResults(Array.isArray(results) ? results : [])
    } catch (e) {
      console.error('Search failed', e)
      setError('Failed to search items')
    } finally {
      setSearching(false)
    }
  }

  const detectIsRecipe = item => {
    const type = (item?.itemType || item?.type || '').toString().toUpperCase()
    return type === 'RECIPE' || type === 'RECIPES'
  }

  // Get a unique identifier for a serving (id + name or just name if id is missing)
  const getServingIdentifier = serving => {
    if (serving?.id !== undefined && serving?.id !== null) {
      return `${serving.id}_${serving.name || serving.innerName || ''}`
    }
    return serving?.name || serving?.innerName || ''
  }

  // Find a serving by its identifier
  const findServingByIdentifier = (servingOptions, identifier) => {
    if (!identifier) return null
    return servingOptions.find(s => {
      const servingId = getServingIdentifier(s)
      return servingId === identifier
    })
  }

  // Find the appropriate serving item based on priority:
  // NOTE: totalCalories are calculated for profileId = 0 or name matching 'grame' etc.
  // 1. profileId = 0
  // 2. name.toLowerCase() = 'g', 'gram', 'grame', 'gramm', or 'ml'
  // 3. first item
  const findDefaultServing = servingArray => {
    if (
      !servingArray ||
      !Array.isArray(servingArray) ||
      servingArray.length === 0
    ) {
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

    // If still not found, take the first item
    if (!selectedServing) {
      selectedServing = servingArray[0]
    }

    return selectedServing
  }

  const addItemToPlan = async item => {
    try {
      let enriched = item
      // Store original serving info - try to get from serving array or default
      let originalServingAmount = 100 // Default to 100g if no serving info
      let originalServingId = null

      if (
        item?.serving &&
        Array.isArray(item.serving) &&
        item.serving.length > 0
      ) {
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
              if (
                detailed?.serving &&
                Array.isArray(detailed.serving) &&
                detailed.serving.length > 0
              ) {
                // First, try to find "Portion" (profileId=1) which represents 1 serving
                const portionServing = detailed.serving.find(
                  s => s.profileId === 1
                )
                if (portionServing) {
                  // Portion amount is per 1 serving, so multiply by numberOfServings for total
                  originalServingAmount =
                    portionServing.amount * originalServings
                  originalServingId = getServingIdentifier(portionServing)
                } else {
                  // Fall back to totalQuantity or weightAfterCooking if available
                  const totalWeight =
                    detailed?.totalNutrients?.totalQuantity ||
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
                    originalServingAmount =
                      (defaultServing?.amount || 100) * originalServings
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
              if (
                detailed?.ingredients &&
                Array.isArray(detailed.ingredients)
              ) {
                enrichedData.ingredients = detailed.ingredients.map(
                  ingredient => ({
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
                  })
                )
              }

              enriched = enrichedData
            } else {
              // For food items, get serving info from detailed item
              if (
                detailed?.serving &&
                Array.isArray(detailed.serving) &&
                detailed.serving.length > 0
              ) {
                // Use findDefaultServing to get the serving that matches totalCalories calculation
                const defaultServing = findDefaultServing(detailed.serving)
                originalServingAmount = defaultServing?.amount || 100
                originalServingId = getServingIdentifier(defaultServing)
              }

              enriched = {
                ...item,
                ...detailed,
                originalCalories:
                  detailed?.totalCalories || item?.totalCalories,
                originalNutrients:
                  detailed?.totalNutrients || item?.totalNutrients,
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

      if (
        detectIsRecipe(enriched) &&
        enriched?.serving &&
        Array.isArray(enriched.serving)
      ) {
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
    }
  }

  const removeItemFromPlan = (mealKey, index) => {
    // Remove display values for this item and reindex remaining items
    const itemKey = `${mealKey}-${index}`
    setDisplayValues(prev => {
      const newValues = { ...prev }
      delete newValues[itemKey]
      // Reindex items after the removed one
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

  const { currentUser } = useAuth()

  const totalItems = useMemo(
    () => Object.values(plans).reduce((acc, arr) => acc + arr.length, 0),
    [plans]
  )

  const handleCreateTemplate = async () => {
    if (!menuName.trim()) {
      setError('Please provide a template name')
      return
    }
    try {
      setSubmitting(true)
      setError(null)

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
            const servingOptions =
              item?.serving && Array.isArray(item.serving) ? item.serving : []
            const selectedServing = findServingByIdentifier(
              servingOptions,
              displayValue.selectedServingId
            )

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

      if (editingTemplateId) {
        // Update existing template
        const payload = {
          menuTemplateId: editingTemplateId,
          name: menuName.trim(),
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
          isAssignableByUser
        }
        await updateMenuTemplate(payload)
      } else {
        // Create new template
        const payload = {
          name: menuName.trim(),
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
          isAssignableByUser,
          createdByUserId: currentUser?.uid
        }
        await addMenuTemplate(payload)
      }

      // Reset form
      setMenuName('')
      setPlans(defaultPlans)
      setDisplayValues({})
      setEditingTemplateId(null)

      // refresh templates
      await new Promise(resolve => setTimeout(resolve, 1500))
      loadTemplates()
    } catch (e) {
      console.error('Failed to create/update menu template', e)
      setError(
        `Failed to ${editingTemplateId ? 'update' : 'create'} menu template`
      )
    } finally {
      setSubmitting(false)
    }
  }

  const handleLoadTemplateForEditing = template => {
    const id = template?.id || template?._id || template?.menuTemplateId

    // If clicking the same template that's already being edited, cancel editing
    if (editingTemplateId === id) {
      handleCancelEdit()
      return
    }

    setEditingTemplateId(id)
    setMenuName(template?.name || '')
    setIsAssignableByUser(template?.isAssignableByUser || false)

    const loadedPlans = {
      breakfastPlan: template?.breakfastPlan || [],
      lunchPlan: template?.lunchPlan || [],
      dinnerPlan: template?.dinnerPlan || [],
      snackPlan: template?.snackPlan || template?.snackPlan || []
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
            servingIdentifier = getServingIdentifier(
              item.changedServing.serving
            )
          } else {
            // Legacy support: if it has servingId instead of serving object, try to find it
            const servingOptions =
              item?.serving && Array.isArray(item.serving) ? item.serving : []
            if (servingOptions.length > 0) {
              const foundServing = servingOptions.find(s => {
                if (typeof item.changedServing.servingId === 'number') {
                  return s.id === item.changedServing.servingId
                } else {
                  return (
                    (s.name || s.innerName) === item.changedServing.servingId ||
                    getServingIdentifier(s) === item.changedServing.servingId
                  )
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
            servingAmount: item.changedServing.value
          }
        } else {
          // Use original serving info, or extract from serving array if not stored
          let originalServingAmount = item?.originalServingAmount
          let originalServingId = item?.originalServingId

          // If not stored, try to extract from serving array
          if (
            !originalServingAmount &&
            item?.serving &&
            Array.isArray(item.serving) &&
            item.serving.length > 0
          ) {
            const isRecipe = detectIsRecipe(item)
            if (isRecipe) {
              // For recipes, try to find "Portion" (profileId=1) first
              const portionServing = item.serving.find(s => s.profileId === 1)
              if (portionServing) {
                const numberOfServings =
                  item?.numberOfServings || item?.originalServings || 1
                originalServingAmount = portionServing.amount * numberOfServings
                originalServingId = getServingIdentifier(portionServing)
              } else {
                // Fall back to totalQuantity or weightAfterCooking if available
                const totalWeight =
                  item?.totalNutrients?.totalQuantity ||
                  item?.totalNutrients?.weightAfterCooking ||
                  null
                if (totalWeight) {
                  originalServingAmount = totalWeight
                  const defaultServing = findDefaultServing(item.serving)
                  originalServingId = getServingIdentifier(defaultServing)
                } else {
                  // Last resort: use default serving and multiply by numberOfServings
                  const defaultServing = findDefaultServing(item.serving)
                  const numberOfServings =
                    item?.numberOfServings || item?.originalServings || 1
                  originalServingAmount =
                    (defaultServing?.amount || 100) * numberOfServings
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
            originalServingAmount = 100 // Default fallback
            originalServingId = null
          }

          initialDisplayValues[itemKey] = {
            selectedServingId: originalServingId,
            servingAmount: originalServingAmount
          }
        }
      })
    })
    setDisplayValues(initialDisplayValues)

    setExpanded(true)
    setCurrentPage(1) // Reset to first page when selecting a template
    setSelectedUserId(null) // Clear selected user when switching templates
    setUserSearchTerm('') // Clear search term when selecting a template
  }

  const handleCancelEdit = () => {
    setEditingTemplateId(null)
    setMenuName('')
    setPlans(defaultPlans)
    setDisplayValues({})
    setCurrentPage(1) // Reset to first page
    setSelectedUserId(null) // Clear selected user
    setUserSearchTerm('') // Clear search term
  }

  const handleDeleteTemplate = async templateId => {
    const confirmed = confirm('Are you sure you want to delete this template?')
    if (!confirmed) {
      return
    }

    try {
      await deleteMenuTemplateById({ menuTemplateId: templateId })
      // wait 1.5 seconds
      await new Promise(resolve => setTimeout(resolve, 1500))
      loadTemplates()
    } catch (e) {
      console.error('Failed to delete template', e)
    }
  }

  const handleDuplicateTemplate = async template => {
    try {
      // Deep copy the template's plans to preserve all item data including changedServing
      const deepCopyPlan = planItems => {
        return planItems.map(item => {
          // Create a deep copy of the item
          const itemCopy = { ...item }

          // Deep copy nested objects if they exist
          if (item.changedServing) {
            itemCopy.changedServing = { ...item.changedServing }
            if (item.changedServing.serving) {
              itemCopy.changedServing.serving = {
                ...item.changedServing.serving
              }
            }
          }

          // Deep copy arrays if they exist
          if (item.serving && Array.isArray(item.serving)) {
            itemCopy.serving = item.serving.map(s => ({ ...s }))
          }

          if (item.ingredients && Array.isArray(item.ingredients)) {
            itemCopy.ingredients = item.ingredients.map(ing => ({ ...ing }))
          }

          if (item.totalNutrients) {
            itemCopy.totalNutrients = { ...item.totalNutrients }
          }

          return itemCopy
        })
      }

      // Get the original template's plans and deep copy them
      const originalPlans = {
        breakfastPlan: template?.breakfastPlan || [],
        lunchPlan: template?.lunchPlan || [],
        dinnerPlan: template?.dinnerPlan || [],
        snackPlan: template?.snackPlan || []
      }

      // Create a new name with "(Copy)" suffix
      const originalName = template?.name || 'Untitled'
      const newName = `${originalName} (Copy)`

      // Create the duplicate menu template with deep copied plans
      // Always set isAssignableByUser to false for copied menus
      const payload = {
        name: newName,
        breakfastPlan: deepCopyPlan(originalPlans.breakfastPlan),
        lunchPlan: deepCopyPlan(originalPlans.lunchPlan),
        dinnerPlan: deepCopyPlan(originalPlans.dinnerPlan),
        snackPlan: deepCopyPlan(originalPlans.snackPlan),
        isAssignableByUser: false,
        createdByUserId: currentUser?.uid
      }

      await addMenuTemplate(payload)

      // Wait a bit and refresh templates
      await new Promise(resolve => setTimeout(resolve, 1500))

      // Fetch updated templates to find the newly created one
      const data = await getAllMenuTemplates()
      const updatedTemplates = Array.isArray(data?.data)
        ? data.data
        : data?.templates || []

      // Update state with new templates
      setTemplates(updatedTemplates)

      // Find the newly created template and load it into edit mode
      const newTemplate = updatedTemplates.find(t => {
        const templateName = t?.name || 'Untitled'
        return templateName === newName
      })

      if (newTemplate) {
        handleLoadTemplateForEditing(newTemplate)
      }
    } catch (e) {
      console.error('Failed to duplicate template', e)
      alert('Failed to duplicate menu template')
    }
  }

  const handleOpenCopyModal = template => {
    setSelectedTemplateForCopy(template)
    setCopyCountryCode('RO')
    setIsCopyModalOpen(true)
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
      // userId is not relevant for template authoring in backoffice; pass a static value
      const result = await copyMenuTemplateToCountry({
        menuTemplate: selectedTemplateForCopy,
        countryCode: copyCountryCode,
        userId: currentUser?.uid,
        createdByUserId: currentUser?.uid || null
      })

      if (result?.ok && result?.data) {
        alert(
          t('pages.menus.copyTemplate.success') ||
            'Menu template copied successfully!'
        )
        setIsCopyModalOpen(false)
        setSelectedTemplateForCopy(null)
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

  const safeNutrients = nutrients => ({
    proteinsInGrams: Number(nutrients?.proteinsInGrams) || 0,
    carbohydratesInGrams: Number(nutrients?.carbohydratesInGrams) || 0,
    fatInGrams: Number(nutrients?.fatInGrams) || 0
  })

  // Calculate display values based on selected serving amount
  const calculateDisplayValues = (
    item,
    selectedServingAmount,
    originalServingAmount
  ) => {
    if (
      !originalServingAmount ||
      originalServingAmount <= 0 ||
      !selectedServingAmount ||
      selectedServingAmount <= 0
    ) {
      return {
        calories: item?.originalCalories || item?.totalCalories || 0,
        nutrients: item?.originalNutrients || item?.totalNutrients || {}
      }
    }

    const isRecipe = detectIsRecipe(item)
    const originalCalories = item?.originalCalories || item?.totalCalories || 0
    const originalNutrients =
      item?.originalNutrients || item?.totalNutrients || {}

    let scaleRatio

    if (isRecipe) {
      // For recipes: totalCalories is for numberOfServings servings
      // Each serving option in the array represents 1 serving
      // We need to calculate how many servings the selected amount represents
      const numberOfServings =
        item?.numberOfServings || item?.originalServings || 1

      // Find the per-serving weight from the serving array
      // Look for "Portion" (profileId=1) first, then fall back to other options
      let perServingWeight = null
      if (item?.serving && Array.isArray(item.serving)) {
        const portionServing = item.serving.find(s => s.profileId === 1)
        if (portionServing) {
          perServingWeight = portionServing.amount
        } else {
          // Fall back to first non-100g serving, or use originalServingAmount / numberOfServings
          const nonDefaultServing = item.serving.find(
            s =>
              s.profileId !== 0 &&
              s.name?.toLowerCase() !== 'grame' &&
              s.innerName?.toLowerCase() !== 'grame'
          )
          perServingWeight =
            nonDefaultServing?.amount ||
            originalServingAmount / numberOfServings
        }
      } else {
        // Fallback: calculate per-serving weight from originalServingAmount
        perServingWeight = originalServingAmount / numberOfServings
      }

      if (perServingWeight && perServingWeight > 0) {
        // Calculate how many servings the selected amount represents
        const selectedServings = selectedServingAmount / perServingWeight
        // Scale based on servings ratio
        scaleRatio = selectedServings / numberOfServings
      } else {
        // Fallback to weight ratio if we can't determine per-serving weight
        scaleRatio = selectedServingAmount / originalServingAmount
      }
    } else {
      // For foods: originalServingAmount is just the serving amount
      scaleRatio = selectedServingAmount / originalServingAmount
    }

    return {
      calories: Math.round(originalCalories * scaleRatio),
      nutrients: {
        proteinsInGrams: (originalNutrients?.proteinsInGrams || 0) * scaleRatio,
        carbohydratesInGrams:
          (originalNutrients?.carbohydratesInGrams || 0) * scaleRatio,
        fatInGrams: (originalNutrients?.fatInGrams || 0) * scaleRatio,
        // Include additional nutrients if present
        cholesterol: (originalNutrients?.cholesterol || 0) * scaleRatio,
        fibers: (originalNutrients?.fibers || 0) * scaleRatio,
        nonSaturatedFat: (originalNutrients?.nonSaturatedFat || 0) * scaleRatio,
        saturatedFat: (originalNutrients?.saturatedFat || 0) * scaleRatio,
        sodium: (originalNutrients?.sodium || 0) * scaleRatio,
        sugar: (originalNutrients?.sugar || 0) * scaleRatio
      }
    }
  }

  const computeMealTotals = (items, mealKey) => {
    return items.reduce(
      (acc, item, index) => {
        const itemKey = `${mealKey}-${index}`
        const displayValue = displayValues[itemKey]

        // Use display values if available, otherwise use original
        let calories = Number(item?.totalCalories) || 0
        let nutrients = item?.totalNutrients || {}

        if (
          displayValue &&
          displayValue.servingAmount !== undefined &&
          displayValue.servingAmount !== ''
        ) {
          const originalServingAmount = item?.originalServingAmount || 100
          const calculated = calculateDisplayValues(
            item,
            displayValue.servingAmount,
            originalServingAmount
          )
          calories = calculated.calories
          nutrients = calculated.nutrients
        }

        const n = safeNutrients(nutrients)
        return {
          calories: acc.calories + calories,
          proteinsInGrams: acc.proteinsInGrams + n.proteinsInGrams,
          carbohydratesInGrams:
            acc.carbohydratesInGrams + n.carbohydratesInGrams,
          fatInGrams: acc.fatInGrams + n.fatInGrams
        }
      },
      {
        calories: 0,
        proteinsInGrams: 0,
        carbohydratesInGrams: 0,
        fatInGrams: 0
      }
    )
  }

  const menuTotals = useMemo(() => {
    const bp = computeMealTotals(plans.breakfastPlan, 'breakfastPlan')
    const lp = computeMealTotals(plans.lunchPlan, 'lunchPlan')
    const dp = computeMealTotals(plans.dinnerPlan, 'dinnerPlan')
    const sp = computeMealTotals(plans.snackPlan, 'snackPlan')
    return {
      calories: bp.calories + lp.calories + dp.calories + sp.calories,
      proteinsInGrams:
        bp.proteinsInGrams +
        lp.proteinsInGrams +
        dp.proteinsInGrams +
        sp.proteinsInGrams,
      carbohydratesInGrams:
        bp.carbohydratesInGrams +
        lp.carbohydratesInGrams +
        dp.carbohydratesInGrams +
        sp.carbohydratesInGrams,
      fatInGrams: bp.fatInGrams + lp.fatInGrams + dp.fatInGrams + sp.fatInGrams,
      perMeal: { bp, lp, dp, sp }
    }
  }, [plans, displayValues])

  const formatUserData = user => {
    const userData = user?.userData || {}
    const loginDetails = user?.loginDetails || {}

    // Try to get name from multiple sources
    let name = 'Unknown'
    if (userData?.name) {
      name = userData.name
    } else if (user?.firstName && user?.lastName) {
      name = `${user.firstName} ${user.lastName}`.trim()
    } else if (loginDetails?.displayName) {
      name = loginDetails.displayName
    } else if (user?.firstName) {
      name = user.firstName
    } else if (user?.lastName) {
      name = user.lastName
    }

    // Get email
    const email =
      user?.email ||
      loginDetails?.providerData?.[0]?.email ||
      loginDetails?.email ||
      'N/A'

    // Determine status
    let status = 'Unknown'
    if (user?.subscriptionWhitelistDetails?.isPro === 'true') {
      status = 'Pro (Whitelist)'
    } else if (user?.subscriptionDetails?.Pro?.isActive) {
      status = 'Pro'
    } else {
      status = 'Free'
    }

    return { name, email, status }
  }

  // Sort user menus based on selected field and direction
  const sortedUserMenus = useMemo(() => {
    const menus = [...userMenus]
    return menus.sort((a, b) => {
      let factor = 1
      if (userMenusSortDirection === 'desc') {
        factor = -1
      }

      switch (userMenusSortField) {
        case 'dateApplied':
          const dateA = a?.dateApplied ? new Date(a.dateApplied).getTime() : 0
          const dateB = b?.dateApplied ? new Date(b.dateApplied).getTime() : 0
          return (dateA - dateB) * factor

        case 'templateName':
          const nameA = (() => {
            const templateId = a?.menuTemplateId || a?.id
            const template = templates.find(t => {
              const tId = t?.id || t?._id || t?.menuTemplateId
              return tId === templateId
            })
            return (template?.name || 'Unknown Template').toLowerCase()
          })()
          const nameB = (() => {
            const templateId = b?.menuTemplateId || b?.id
            const template = templates.find(t => {
              const tId = t?.id || t?._id || t?.menuTemplateId
              return tId === templateId
            })
            return (template?.name || 'Unknown Template').toLowerCase()
          })()
          return nameA.localeCompare(nameB) * factor

        case 'breakfast':
          return (
            ((a?.breakfastPlan || []).length -
              (b?.breakfastPlan || []).length) *
            factor
          )

        case 'lunch':
          return (
            ((a?.lunchPlan || []).length - (b?.lunchPlan || []).length) * factor
          )

        case 'dinner':
          return (
            ((a?.dinnerPlan || []).length - (b?.dinnerPlan || []).length) *
            factor
          )

        case 'snack':
          return (
            ((a?.snackPlan || []).length - (b?.snackPlan || []).length) * factor
          )

        default:
          return 0
      }
    })
  }, [userMenus, userMenusSortField, userMenusSortDirection, templates])

  const handleUserMenusSort = field => {
    if (userMenusSortField === field) {
      // Toggle direction if same field
      setUserMenusSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      // Set new field and default to ascending
      setUserMenusSortField(field)
      setUserMenusSortDirection('asc')
    }
  }

  // Filter users based on search term
  const filteredUsers = useMemo(() => {
    if (!userSearchTerm.trim()) {
      return users
    }
    const search = userSearchTerm.toLowerCase()
    return users.filter(user => {
      const { name, email } = formatUserData(user)
      const userId = (user?.userId || user?.id || '').toString().toLowerCase()
      return (
        name.toLowerCase().includes(search) ||
        email.toLowerCase().includes(search) ||
        userId.includes(search)
      )
    })
  }, [users, userSearchTerm])

  // Filter templates based on search term
  const filteredTemplates = useMemo(() => {
    if (!templateSearchTerm.trim()) {
      return templates
    }
    const search = templateSearchTerm.toLowerCase()
    return templates.filter(template => {
      const templateName = (template?.name || 'Untitled').toLowerCase()
      return templateName.includes(search)
    })
  }, [templates, templateSearchTerm])

  // Pagination logic for users
  const getCurrentUsers = () => {
    const startIndex = (currentPage - 1) * usersPerPage
    const endIndex = startIndex + usersPerPage
    return filteredUsers.slice(startIndex, endIndex)
  }

  const getTotalUserPages = () => {
    return Math.ceil(filteredUsers.length / usersPerPage)
  }

  // Reset to page 1 when search term or users per page changes
  useEffect(() => {
    setCurrentPage(1)
  }, [userSearchTerm, usersPerPage])

  // Pagination for templates
  const getCurrentTemplates = () => {
    const startIndex = (templatesPage - 1) * templatesPerPage
    const endIndex = startIndex + templatesPerPage
    return filteredTemplates.slice(startIndex, endIndex)
  }

  const getTotalTemplatesPages = () => {
    return Math.ceil(filteredTemplates.length / templatesPerPage)
  }

  // Reset to page 1 when template search term changes
  useEffect(() => {
    setTemplatesPage(1)
  }, [templateSearchTerm, templatesPerPage])

  return (
    <div className="space-y-6">
      {/* Header - Glass hero */}
      <div className={`p-6 sm:p-8 ${glassCardClass} overflow-hidden`}>
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-indigo-500/20 via-fuchsia-500/20 to-pink-500/20" />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <SparklesIcon className="w-7 h-7 text-indigo-400" />
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
                Menus
              </h1>
              <p className="text-gray-700 mt-1">
                Create and manage menu templates
              </p>
            </div>
          </div>
          <button
            onClick={loadTemplates}
            disabled={refreshing || loadingTemplates}
            className="btn-primary"
          >
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      <div className={`${glassCardClass} p-6`}>
        <div
          className="flex items-center justify-between cursor-pointer"
          onClick={() => setExpanded(!expanded)}
        >
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              {editingTemplateId
                ? 'Edit Menu Template'
                : 'Create Menu Template'}
            </h2>
            <p className="text-gray-500 text-sm">
              {t('pages.menus.buildMealPlans') || 'Build meal plans by searching foods or recipes'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {editingTemplateId && (
              <button
                onClick={e => {
                  e.stopPropagation()
                  handleCancelEdit()
                }}
                className="px-3 py-1 text-sm text-gray-600 hover:text-gray-900"
              >
                Cancel Edit
              </button>
            )}
            {expanded ? (
              <ChevronUpIcon className="w-5 h-5 text-gray-600" />
            ) : (
              <ChevronDownIcon className="w-5 h-5 text-gray-600" />
            )}
          </div>
        </div>

        {expanded && (
          <div className="mt-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <div className="flex items-center gap-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Is Assignable by User
                  </label>
                  <input
                    type="checkbox"
                    checked={isAssignableByUser}
                    className="w-5 h-5 border border-white/30 bg-white/40 backdrop-blur-sm rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    onChange={e => setIsAssignableByUser(e.target.checked)}
                  />
                </div>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Template Name
                </label>
                <input
                  type="text"
                  value={menuName}
                  onChange={e => setMenuName(e.target.value)}
                  className="w-full border border-white/30 bg-white/40 backdrop-blur-sm rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g., High Protein - Weekday"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Country Code
                </label>
                <select
                  value={countryCode}
                  onChange={e => setCountryCode(e.target.value)}
                  className="w-full border border-white/30 bg-white/40 backdrop-blur-sm rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Meal Type
                </label>
                <select
                  value={activeMealType}
                  onChange={e => setActiveMealType(e.target.value)}
                  className="w-full border border-white/30 bg-white/40 backdrop-blur-sm rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {mealTypeOptions.map(opt => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <h3 className="text-base font-semibold text-gray-900 mb-3">
                {t('pages.menus.searchItems') || 'Search Items'}
              </h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={searchText}
                  onChange={e => setSearchText(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleSearch()
                  }}
                  className="flex-1 border border-white/30 bg-white/40 backdrop-blur-sm rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder={t('pages.menus.searchFoodsOrRecipes') || 'Search foods or recipes...'}
                />
                <button
                  onClick={handleSearch}
                  disabled={searching || !searchText.trim()}
                  className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center"
                >
                  <MagnifyingGlassIcon className="w-4 h-4 mr-1" />
                  {searching ? t('pages.menus.searching') || 'Searching...' : t('pages.menus.search') || 'Search'}
                </button>
              </div>
              {searchResults.length > 0 && (
                <div className="mt-3 max-h-56 overflow-y-auto border border-white/20 bg-white/10 backdrop-blur-sm rounded-md divide-y divide-white/10">
                  {searchResults.map((item, idx) => {
                    const isRecipeItem = detectIsRecipe(item)
                    // Find the appropriate serving item based on priority:
                    // NOTE: totalCalories are calculated for profileId = 0 or name matching 'grame' etc.
                    const selectedServing = findDefaultServing(item?.serving)
                    const servingAmount = selectedServing?.amount || 0
                    const numberOfServings = isRecipeItem
                      ? item?.numberOfServings || item?.originalServings || 1
                      : 1
                    const newAmount = isRecipeItem
                      ? servingAmount * numberOfServings
                      : servingAmount

                    return (
                      <div
                        key={idx}
                        className="p-3 flex items-center justify-between hover:bg-white/40"
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-gray-900 truncate">
                            {item?.name || item?.title || 'Unnamed'}
                          </div>
                          <div className="text-xs text-gray-600">
                            {detectIsRecipe(item) ? 'Recipe' : 'Food'}
                            {typeof item?.totalCalories === 'number'
                              ? ` • ${item.totalCalories} cal/${newAmount}g`
                              : ''}
                          </div>
                        </div>
                        <button
                          onClick={() => addItemToPlan(item)}
                          className="bg-emerald-600 text-white px-3 py-1 rounded-md hover:bg-emerald-700 flex items-center"
                        >
                          <PlusIcon className="w-4 h-4 mr-1" /> Add
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="flex gap-8 mb-8">
              <div className="flex items-center gap-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Only Recipes
                </label>
                <input
                  type="checkbox"
                  checked={onlyRecipes}
                  className="w-5 h-5 border border-white/30 bg-white/40 backdrop-blur-sm rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  onChange={e => setOnlyRecipes(e.target.checked)}
                />
              </div>
            </div>

            <div>
              <h3 className="text-base font-semibold text-gray-900 mb-3">
                Selected Items
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {mealTypeOptions.map(opt => (
                  <div
                    key={opt.id}
                    className="rounded-lg border border-white/20 bg-white/10 backdrop-blur-sm"
                  >
                    <div className="px-3 py-2 bg-white/10 border-b border-white/15 text-sm font-medium text-gray-700">
                      {opt.label}
                    </div>
                    <div className="p-3 space-y-2 max-h-64 overflow-y-auto">
                      {plans[opt.id].length === 0 && (
                        <div className="text-sm text-gray-500">No items</div>
                      )}
                      {plans[opt.id].map((it, i) => {
                        const isRecipeItem = detectIsRecipe(it)
                        const itemKey = `${opt.id}-${i}`
                        const displayValue = displayValues[itemKey]

                        // Get serving options from item
                        const servingOptions =
                          it?.serving && Array.isArray(it.serving)
                            ? it.serving
                            : []
                        const hasServings = servingOptions.length > 0

                        // Get current serving amount and id
                        const currentServingAmount =
                          displayValue?.servingAmount !== undefined
                            ? displayValue.servingAmount
                            : it?.originalServingAmount || 100
                        const currentServingId =
                          displayValue?.selectedServingId ||
                          it?.originalServingId ||
                          null

                        // Calculate display values based on selected serving
                        // Ensure we use the correct serving that matches totalCalories calculation
                        let originalServingAmount = it?.originalServingAmount
                        if (
                          !originalServingAmount &&
                          servingOptions.length > 0
                        ) {
                          if (isRecipeItem) {
                            // For recipes, try to find "Portion" (profileId=1) first
                            const portionServing = servingOptions.find(
                              s => s.profileId === 1
                            )
                            if (portionServing) {
                              const numberOfServings =
                                it?.numberOfServings ||
                                it?.originalServings ||
                                1
                              originalServingAmount =
                                portionServing.amount * numberOfServings
                            } else {
                              // Fall back to totalQuantity or weightAfterCooking if available
                              const totalWeight =
                                it?.totalNutrients?.totalQuantity ||
                                it?.totalNutrients?.weightAfterCooking ||
                                null
                              if (totalWeight) {
                                originalServingAmount = totalWeight
                              } else {
                                // Last resort: use default serving and multiply by numberOfServings
                                const defaultServing =
                                  findDefaultServing(servingOptions)
                                const numberOfServings =
                                  it?.numberOfServings ||
                                  it?.originalServings ||
                                  1
                                originalServingAmount =
                                  (defaultServing?.amount || 100) *
                                  numberOfServings
                              }
                            }
                          } else {
                            // For foods, use default serving
                            const defaultServing =
                              findDefaultServing(servingOptions)
                            originalServingAmount =
                              defaultServing?.amount || 100
                          }
                        }
                        originalServingAmount = originalServingAmount || 100
                        // Only calculate if we have a valid serving amount
                        const servingAmountForCalc =
                          currentServingAmount === '' ||
                          currentServingAmount === undefined
                            ? originalServingAmount
                            : currentServingAmount
                        const calculated = calculateDisplayValues(
                          it,
                          servingAmountForCalc,
                          originalServingAmount
                        )
                        const adjustedCalories = calculated.calories
                        const adjustedNutrients = calculated.nutrients

                        return (
                          <div
                            key={i}
                            className="p-2 rounded bg-white/40 backdrop-blur-sm shadow-sm"
                          >
                            <div className="flex items-start justify-between">
                              <div className="min-w-0">
                                <div className="text-sm font-medium text-gray-900 truncate">
                                  {it?.name || it?.title || 'Unnamed'}
                                </div>
                                <div className="text-xs text-gray-500 truncate">
                                  {isRecipeItem ? 'Recipe' : 'Food'}
                                </div>
                              </div>
                              <button
                                onClick={() => removeItemFromPlan(opt.id, i)}
                                className="text-red-600 hover:text-red-800"
                              >
                                <TrashIcon className="w-4 h-4" />
                              </button>
                            </div>

                            {/* Serving dropdown and textinput for both foods and recipes */}
                            {hasServings && (
                              <div className="mt-2 mb-2 flex items-center gap-2">
                                <label className="text-xs text-gray-600 font-medium whitespace-nowrap">
                                  Serving:
                                </label>
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
                                    // For recipes, serving array values represent the weight for that serving option
                                    // For "Portion" (profileId=1), it's 1 serving; for "Grame" (profileId=0), it's per 100g
                                    // We use the amount directly - calculateDisplayValues will handle the scaling
                                    const servingAmount =
                                      selectedServing?.amount || 0

                                    setDisplayValues(prev => ({
                                      ...prev,
                                      [itemKey]: {
                                        selectedServingId: selectedIdentifier,
                                        servingAmount:
                                          servingAmount || currentServingAmount
                                      }
                                    }))
                                  }}
                                  className="flex-1 px-2 py-1 border border-white/30 bg-white/40 backdrop-blur-sm rounded text-xs"
                                >
                                  {servingOptions.map((serving, idx) => {
                                    const servingId =
                                      getServingIdentifier(serving)
                                    return (
                                      <option
                                        key={servingId || idx}
                                        value={servingId}
                                      >
                                        {serving.name || serving.innerName}
                                      </option>
                                    )
                                  })}
                                </select>
                                <input
                                  type="text"
                                  value={currentServingAmount}
                                  onChange={e => {
                                    const inputValue = e.target.value
                                    // Allow empty string, otherwise parse as number
                                    const newAmount =
                                      inputValue === '' ? '' : inputValue || 0

                                    setDisplayValues(prev => ({
                                      ...prev,
                                      [itemKey]: {
                                        selectedServingId: currentServingId,
                                        servingAmount:
                                          newAmount === '' ? '' : newAmount
                                      }
                                    }))
                                  }}
                                  onBlur={e => {
                                    // If empty on blur, restore to current value or original
                                    const inputValue = e.target.value
                                    if (inputValue === '') {
                                      const originalServingAmount =
                                        it?.originalServingAmount || 100
                                      setDisplayValues(prev => ({
                                        ...prev,
                                        [itemKey]: {
                                          selectedServingId: currentServingId,
                                          servingAmount: originalServingAmount
                                        }
                                      }))
                                    }
                                  }}
                                  className="w-24 px-2 py-1 border border-white/30 bg-white/40 backdrop-blur-sm rounded text-xs"
                                  placeholder="Amount"
                                />
                                <span className="text-xs text-gray-500 whitespace-nowrap">
                                  {findServingByIdentifier(
                                    servingOptions,
                                    currentServingId
                                  )?.unit || 'g'}
                                </span>
                              </div>
                            )}

                            {isRecipeItem && (
                              <div className="mt-1 mb-4 text-xs text-gray-600">
                                <span className="font-medium">
                                  Original Serving:
                                </span>{' '}
                                {it?.numberOfServings ||
                                  it?.originalServings ||
                                  1}
                              </div>
                            )}

                            <div className="mt-1 text-xs text-gray-600">
                              <span className="font-medium">Calories:</span>{' '}
                              {adjustedCalories}
                              <span className="mx-2">|</span>
                              <span className="font-medium">
                                Proteins:
                              </span>{' '}
                              {Math.round(
                                Number(adjustedNutrients?.proteinsInGrams) || 0
                              )}{' '}
                              g<span className="mx-2">|</span>
                              <span className="font-medium">Carbs:</span>{' '}
                              {Math.round(
                                Number(
                                  adjustedNutrients?.carbohydratesInGrams
                                ) || 0
                              )}{' '}
                              g<span className="mx-2">|</span>
                              <span className="font-medium">Fat:</span>{' '}
                              {Math.round(
                                Number(adjustedNutrients?.fatInGrams) || 0
                              )}{' '}
                              g
                            </div>
                          </div>
                        )
                      })}
                      {plans[opt.id].length > 0 &&
                        (() => {
                          const mealTotals = computeMealTotals(
                            plans[opt.id],
                            opt.id
                          )
                          return (
                            <div className="mt-2 p-2 bg-indigo-500/10 border border-indigo-300/30 rounded text-xs text-indigo-900">
                              <span className="font-medium">
                                {opt.label} subtotal:
                              </span>
                              <span className="ml-1">
                                {Math.round(mealTotals.calories)} cal
                              </span>
                              <span className="mx-2">|</span>
                              <span>
                                P {Math.round(mealTotals.proteinsInGrams)} g
                              </span>
                              <span className="mx-2">|</span>
                              <span>
                                C {Math.round(mealTotals.carbohydratesInGrams)}{' '}
                                g
                              </span>
                              <span className="mx-2">|</span>
                              <span>
                                F {Math.round(mealTotals.fatInGrams)} g
                              </span>
                            </div>
                          )
                        })()}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {error && (
              <div className="p-3 rounded border border-rose-300/30 bg-rose-500/10 text-rose-800 text-sm">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <div className="p-3 bg-emerald-500/10 border border-emerald-300/30 rounded text-sm text-emerald-900">
                <span className="font-semibold">Menu totals:</span>
                <span className="ml-2">
                  {Math.round(menuTotals.calories)} cal
                </span>
                <span className="mx-2">|</span>
                <span>P {Math.round(menuTotals.proteinsInGrams)} g</span>
                <span className="mx-2">|</span>
                <span>C {Math.round(menuTotals.carbohydratesInGrams)} g</span>
                <span className="mx-2">|</span>
                <span>F {Math.round(menuTotals.fatInGrams)} g</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  {t('pages.menus.totalItems') || 'Total items'}:{' '}
                  <span className="font-medium text-gray-900">
                    {totalItems}
                  </span>
                </div>
                <button
                  onClick={handleCreateTemplate}
                  disabled={submitting || !menuName.trim()}
                  className="bg-indigo-600 text-white px-5 py-2 rounded-md hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {submitting
                    ? editingTemplateId
                      ? t('pages.menus.updating') || 'Updating...'
                      : t('pages.menus.creating') || 'Creating...'
                    : editingTemplateId
                      ? t('pages.menus.updateTemplate') || 'Update Template'
                      : t('pages.menus.createTemplate') || 'Create Template'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className={`${glassSurfaceClass} p-6`}>
        <div
          className="flex items-center justify-between mb-4 cursor-pointer"
          onClick={() => setTemplatesExpanded(!templatesExpanded)}
        >
          <h2 className="text-lg font-semibold text-gray-900">
            Created Menu Templates
          </h2>
          <div className="flex items-center gap-2">
            {loadingTemplates && (
              <span className="text-sm text-gray-500">
                {t('common.loading')}
              </span>
            )}
            {templatesExpanded ? (
              <ChevronUpIcon className="w-5 h-5 text-gray-600" />
            ) : (
              <ChevronDownIcon className="w-5 h-5 text-gray-600" />
            )}
          </div>
        </div>

        {templatesExpanded && (
          <>
            {/* Search for templates */}
            <div className="mb-4">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder={t('pages.menus.searchTemplatesByName') || 'Search templates by name...'}
                  value={templateSearchTerm}
                  onChange={e => setTemplateSearchTerm(e.target.value)}
                  className="w-full border border-white/30 bg-white/40 backdrop-blur-sm rounded-md px-3 py-2 pl-10 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden grid gap-4 mb-4">
              {getCurrentTemplates().map(temp => {
                const id = temp?.id || temp?._id || temp?.menuTemplateId
                const bp = temp?.breakfastPlan || []
                const lp = temp?.lunchPlan || []
                const dp = temp?.dinnerPlan || []
                const sp = temp?.snackPlan || []
                const isCurrentlyEditing = editingTemplateId === id
                return (
                  <div
                    key={id}
                    className={`p-4 space-y-3 ${glassCardClass} ${isCurrentlyEditing ? 'ring-2 ring-indigo-500' : ''}`}
                    onClick={() => handleLoadTemplateForEditing(temp)}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="font-semibold text-gray-900">
                          {temp?.name || 'Untitled'}
                        </div>
                        <div className="text-sm text-gray-500 mt-1">
                          {temp?.createdByUserId ? (
                            <span
                              className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-400/15 text-purple-300 border border-purple-300/30"
                              onClick={e => {
                                e.stopPropagation()
                                setViewingCreator(temp)
                              }}
                            >
                              {temp.createdByUserId === currentUser?.uid
                                ? 'You'
                                : 'Nutritionist'}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-500">Admin</span>
                          )}
                        </div>
                      </div>
                      {isCurrentlyEditing && (
                        <span className="text-blue-600 text-xs">✓ Editing</span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-gray-500">Breakfast:</span>
                        <span className="ml-1 text-gray-900">
                          {bp.length} items
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">Lunch:</span>
                        <span className="ml-1 text-gray-900">
                          {lp.length} items
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">Dinner:</span>
                        <span className="ml-1 text-gray-900">
                          {dp.length} items
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">Snacks:</span>
                        <span className="ml-1 text-gray-900">
                          {sp.length} items
                        </span>
                      </div>
                    </div>

                    <div
                      className="flex gap-2 pt-2 border-t border-white/15"
                      onClick={e => e.stopPropagation()}
                    >
                      <button
                        onClick={() => handleDuplicateTemplate(temp)}
                        className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-sm text-indigo-600 hover:bg-white/40 rounded-md"
                      >
                        <DocumentDuplicateIcon className="w-4 h-4" />
                        {t('pages.menus.duplicate') || 'Duplicate'}
                      </button>
                      <button
                        onClick={() => handleOpenCopyModal(temp)}
                        className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-sm text-emerald-600 hover:bg-white/40 rounded-md"
                      >
                        <DocumentDuplicateIcon className="w-4 h-4" />
                        {t('pages.menus.copyToCountry') || 'Copy to Country'}
                      </button>
                      <button
                        onClick={() => handleDeleteTemplate(id)}
                        className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-sm text-rose-600 hover:bg-white/40 rounded-md"
                      >
                        <TrashIcon className="w-4 h-4" />
                        {t('pages.menus.delete') || 'Delete'}
                      </button>
                    </div>
                  </div>
                )
              })}
              {getCurrentTemplates().length === 0 && (
                <div className="text-center py-8 text-sm text-gray-500">
                  {loadingTemplates
                    ? t('pages.menus.loadingTemplates') || 'Loading templates...'
                    : templateSearchTerm
                      ? t('pages.menus.noTemplatesFoundMatching', { term: templateSearchTerm }) || `No templates found matching "${templateSearchTerm}"`
                      : t('pages.menus.noTemplatesFound') || 'No templates found'}
                </div>
              )}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full divide-y divide-white/10">
                <thead className="bg-white/10">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Creator
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Breakfast
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Lunch
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Dinner
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Snacks
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-transparent divide-y divide-white/10">
                  {getCurrentTemplates().map(temp => {
                    const id = temp?.id || temp?._id || temp?.menuTemplateId
                    const bp = temp?.breakfastPlan || []
                    const lp = temp?.lunchPlan || []
                    const dp = temp?.dinnerPlan || []
                    const sp = temp?.snackPlan || []
                    const isCurrentlyEditing = editingTemplateId === id
                    return (
                      <tr
                        key={id}
                        className={`hover:bg-white/5 ${isCurrentlyEditing ? 'bg-indigo-50' : ''} cursor-pointer`}
                        onClick={() => handleLoadTemplateForEditing(temp)}
                      >
                        <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-900">
                          {temp?.name || 'Untitled'}
                        </td>
                        <td
                          className="px-6 py-3 whitespace-nowrap text-sm text-gray-600"
                          onClick={e => e.stopPropagation()}
                        >
                          {temp?.createdByUserId ? (
                            <span
                              className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 cursor-pointer hover:bg-purple-200"
                              onClick={() => setViewingCreator(temp)}
                            >
                              {temp.createdByUserId === currentUser?.uid
                                ? 'You'
                                : 'Nutritionist'}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-500">Admin</span>
                          )}
                        </td>
                        <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-900">
                          {bp.length}
                        </td>
                        <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-900">
                          {lp.length}
                        </td>
                        <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-900">
                          {dp.length}
                        </td>
                        <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-900">
                          {sp.length}
                        </td>
                        <td
                          className="px-6 py-3 whitespace-nowrap text-sm flex items-center justify-evenly gap-2"
                          onClick={e => e.stopPropagation()}
                        >
                          {isCurrentlyEditing && (
                            <span className="text-blue-600 text-xs mr-2">
                              ✓ {t('pages.menus.editing') || 'Editing'}
                            </span>
                          )}
                          <button
                            onClick={() => handleDuplicateTemplate(temp)}
                            className="text-indigo-600 hover:text-indigo-800 cursor-pointer"
                            title={
                              t('pages.menus.duplicate') || 'Duplicate menu'
                            }
                          >
                            <DocumentDuplicateIcon className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleOpenCopyModal(temp)}
                            className="text-emerald-600 hover:text-emerald-800 cursor-pointer"
                            title={
                              t('pages.menus.copyToCountry') ||
                              'Copy menu to country'
                            }
                          >
                            <DocumentDuplicateIcon className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteTemplate(id)}
                            className="text-red-600 hover:text-red-800 cursor-pointer"
                            title={t('pages.menus.delete') || 'Delete menu'}
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                  {getCurrentTemplates().length === 0 && (
                    <tr>
                      <td
                        className="px-6 py-4 text-sm text-gray-500"
                        colSpan="7"
                      >
                        {loadingTemplates
                          ? t('pages.menus.loadingTemplates') || 'Loading templates...'
                          : templateSearchTerm
                            ? t('pages.menus.noTemplatesFoundMatching', { term: templateSearchTerm }) || `No templates found matching "${templateSearchTerm}"`
                            : t('pages.menus.noTemplatesFound') || 'No templates found'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {filteredTemplates.length > 0 && (
              <div
                className={`px-4 py-3 border-t border-white/15 mt-4 ${glassSurfaceClass}`}
              >
                {/* Mobile View */}
                <div className="md:hidden space-y-3">
                  <div className="flex items-center justify-between">
                    <select
                      value={templatesPerPage}
                      onChange={e => {
                        setTemplatesPerPage(Number(e.target.value))
                        setTemplatesPage(1)
                      }}
                      className="px-3 py-2 border border-white/30 bg-white/40 backdrop-blur-sm rounded-md text-sm"
                    >
                      <option value="5">5</option>
                      <option value="10">10</option>
                      <option value="20">20</option>
                    </select>

                    <span className="text-sm text-gray-700">
                      Page {templatesPage} of {getTotalTemplatesPages() || 1}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <button
                      onClick={() =>
                        setTemplatesPage(prev => Math.max(1, prev - 1))
                      }
                      disabled={templatesPage === 1}
                      className="px-4 py-2 border border-white/30 bg-white/40 backdrop-blur-sm rounded-md text-sm font-medium text-gray-800 hover:bg-white/60 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>

                    <button
                      onClick={() =>
                        setTemplatesPage(prev =>
                          Math.min(getTotalTemplatesPages(), prev + 1)
                        )
                      }
                      disabled={templatesPage >= getTotalTemplatesPages()}
                      className="px-4 py-2 border border-white/30 bg-white/40 backdrop-blur-sm rounded-md text-sm font-medium text-gray-800 hover:bg-white/60 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                </div>

                {/* Desktop View */}
                <div className="hidden md:flex flex-wrap items-center gap-4 md:gap-6">
                  <div className="flex items-center gap-3">
                    <label className="text-sm text-gray-700">
                      Items per page:
                    </label>
                    <select
                      value={templatesPerPage}
                      onChange={e => {
                        setTemplatesPerPage(Number(e.target.value))
                        setTemplatesPage(1)
                      }}
                      className="px-3 py-1 border border-white/30 bg-white/40 backdrop-blur-sm rounded-md text-sm"
                    >
                      <option value="5">5</option>
                      <option value="10">10</option>
                      <option value="20">20</option>
                    </select>
                  </div>

                  <div className="flex flex-col md:flex-row md:items-center md:gap-3 text-sm text-gray-700">
                    <span className="font-medium">
                      Page {templatesPage} of {getTotalTemplatesPages() || 1}
                    </span>
                    <span className="text-gray-600">
                      {filteredTemplates.length === 0
                        ? 'Showing 0 of 0 results'
                        : `Showing ${(templatesPage - 1) * templatesPerPage + 1} to ${Math.min(templatesPage * templatesPerPage, filteredTemplates.length)} of ${filteredTemplates.length} results`}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 ml-auto">
                    <button
                      onClick={() =>
                        setTemplatesPage(prev => Math.max(1, prev - 1))
                      }
                      disabled={templatesPage === 1}
                      className="px-3 py-2 border border-white/30 bg-white/40 backdrop-blur-sm rounded-md text-sm font-medium text-gray-800 hover:bg-white/60 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>

                    <button
                      onClick={() =>
                        setTemplatesPage(prev =>
                          Math.min(getTotalTemplatesPages(), prev + 1)
                        )
                      }
                      disabled={templatesPage >= getTotalTemplatesPages()}
                      className="px-3 py-2 border border-white/30 bg-white/40 backdrop-blur-sm rounded-md text-sm font-medium text-gray-800 hover:bg-white/60 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <div className={`${glassSurfaceClass} p-6`}>
        <div
          className="flex items-center justify-between mb-4 cursor-pointer"
          onClick={() => setUsersExpanded(!usersExpanded)}
        >
          <h2 className="text-lg font-semibold text-gray-900">Users</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={e => {
                e.stopPropagation()
                refreshUsers()
              }}
              disabled={loadingUsers}
              className="btn-secondary text-sm"
            >
              {loadingUsers ? 'Refreshing...' : 'Refresh Users'}
            </button>
            {usersExpanded ? (
              <ChevronUpIcon className="w-5 h-5 text-gray-600" />
            ) : (
              <ChevronDownIcon className="w-5 h-5 text-gray-600" />
            )}
          </div>
        </div>

        {usersExpanded && (
          <>
            {/* Search Controls */}
            <div className="mb-4">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder={t('pages.menus.searchByNameEmailOrUserId') || 'Search by name, email, or user ID...'}
                  value={userSearchTerm}
                  onChange={e => setUserSearchTerm(e.target.value)}
                  className="w-full border border-white/30 bg-white/40 backdrop-blur-sm rounded-md px-3 py-2 pl-10 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Assignment Date Picker */}
            <div className="mb-4 p-3 bg-white/10 border border-white/15 rounded-lg backdrop-blur-sm">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Assignment Date
              </label>
              <input
                type="date"
                value={assignmentDate}
                onChange={e => setAssignmentDate(e.target.value)}
                className="w-full border border-white/30 bg-white/40 backdrop-blur-sm rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden grid gap-4 mb-4">
              {getCurrentUsers().map(user => {
                const { name, email, status } = formatUserData(user)
                const userId = user?.userId || user?.id
                const isSelected = selectedUserId === userId
                return (
                  <div
                    key={userId}
                    className={`bg-white rounded-lg shadow p-4 space-y-3 ${isSelected ? 'ring-2 ring-blue-500' : ''}`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="font-semibold text-gray-900">
                          {name}
                        </div>
                        <div className="text-sm text-gray-500 mt-1 break-all">
                          {email}
                        </div>
                      </div>
                      {isSelected && (
                        <span className="text-blue-600 text-xs">
                          ✓ Selected
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 gap-2 text-sm">
                      <div>
                        <span className="text-gray-500">User ID:</span>
                        <span className="ml-1 text-gray-900 break-all">
                          {userId}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">Subscription:</span>
                        <span
                          className={`ml-2 px-2 py-1 text-xs font-medium rounded-full ${status.includes('Pro') ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'}`}
                        >
                          {status}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">Account:</span>
                        <span
                          className={`ml-2 px-2 py-1 text-xs font-medium rounded-full ${user?.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}
                        >
                          {user?.status}
                        </span>
                      </div>
                    </div>

                    <div className="pt-2 border-t">
                      <button
                        onClick={() => {
                          if (isSelected) {
                            setSelectedUserId(null)
                          } else {
                            setSelectedUserId(userId)
                          }
                        }}
                        className={`w-full ${
                          isSelected
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        } px-4 py-2 rounded-md text-sm transition-colors`}
                      >
                        {isSelected ? 'Selected' : 'Select'}
                      </button>
                    </div>
                  </div>
                )
              })}
              {getCurrentUsers().length === 0 && (
                <div className="text-center py-8 text-sm text-gray-500">
                  {loadingUsers
                    ? 'Loading users...'
                    : userSearchTerm
                      ? `No users found matching "${userSearchTerm}"`
                      : 'No users found'}
                </div>
              )}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full divide-y divide-white/10">
                <thead className="bg-white/10">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      User ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Subscrition Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Account Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-transparent divide-y divide-white/10">
                  {getCurrentUsers().map(user => {
                    const { name, email, status } = formatUserData(user)
                    const userId = user?.userId || user?.id
                    const isSelected = selectedUserId === userId
                    return (
                      <tr
                        key={userId}
                        className={`hover:bg-gray-50 ${isSelected ? 'bg-blue-50' : ''}`}
                      >
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {userId}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {email}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-2 py-1 text-xs font-medium rounded-full ${
                              status.includes('Pro')
                                ? 'bg-purple-100 text-purple-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <span
                            className={`px-2 py-1 text-xs font-medium rounded-full ${
                              user?.status === 'ACTIVE'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {user?.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button
                            onClick={() => {
                              if (isSelected) {
                                setSelectedUserId(null)
                              } else {
                                setSelectedUserId(userId)
                              }
                            }}
                            className={`${
                              isSelected
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                            } px-4 py-2 rounded-md text-sm transition-colors cursor-pointer`}
                          >
                            {isSelected ? 'Selected' : 'Select'}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                  {getCurrentUsers().length === 0 && users.length === 0 && (
                    <tr>
                      <td
                        className="px-6 py-4 text-sm text-gray-500 text-center"
                        colSpan="6"
                      >
                        {loadingUsers ? t('pages.menus.loadingUsers') || 'Loading users...' : t('pages.menus.noUsersFound') || 'No users found'}
                      </td>
                    </tr>
                  )}
                  {getCurrentUsers().length === 0 && users.length > 0 && (
                    <tr>
                      <td
                        className="px-6 py-4 text-sm text-gray-500 text-center"
                        colSpan="6"
                      >
                        {userSearchTerm
                          ? t('pages.menus.noUsersFoundMatching', { term: userSearchTerm }) || `No users found matching "${userSearchTerm}"`
                          : t('pages.menus.noUsersToDisplay') || 'No users to display'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {users.length > 0 && (
              <div
                className={`px-4 py-3 border-t border-white/15 mt-4 ${glassSurfaceClass}`}
              >
                {/* Mobile View */}
                <div className="md:hidden space-y-3">
                  <div className="flex items-center justify-between">
                    <select
                      value={usersPerPage}
                      onChange={e => {
                        setUsersPerPage(Number(e.target.value))
                        setCurrentPage(1)
                      }}
                      className="px-3 py-2 border border-white/30 bg-white/40 backdrop-blur-sm rounded-md text-sm"
                    >
                      <option value="5">5</option>
                      <option value="10">10</option>
                      <option value="20">20</option>
                    </select>

                    <span className="text-sm text-gray-700">
                      Page {currentPage} of {getTotalUserPages() || 1}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <button
                      onClick={() =>
                        setCurrentPage(prev => Math.max(1, prev - 1))
                      }
                      disabled={currentPage === 1}
                      className="px-4 py-2 border border-white/30 bg-white/40 backdrop-blur-sm rounded-md text-sm font-medium text-gray-800 hover:bg-white/60 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>

                    <button
                      onClick={() =>
                        setCurrentPage(prev =>
                          Math.min(getTotalUserPages(), prev + 1)
                        )
                      }
                      disabled={currentPage >= getTotalUserPages()}
                      className="px-4 py-2 border border-white/30 bg-white/40 backdrop-blur-sm rounded-md text-sm font-medium text-gray-800 hover:bg-white/60 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                </div>

                {/* Desktop View */}
                <div className="hidden md:flex flex-wrap items-center gap-4 md:gap-6">
                  <div className="flex items-center gap-3">
                    <label className="text-sm text-gray-700">
                      Items per page:
                    </label>
                    <select
                      value={usersPerPage}
                      onChange={e => {
                        setUsersPerPage(Number(e.target.value))
                        setCurrentPage(1)
                      }}
                      className="px-3 py-1 border border-white/30 bg-white/40 backdrop-blur-sm rounded-md text-sm"
                    >
                      <option value="5">5</option>
                      <option value="10">10</option>
                      <option value="20">20</option>
                    </select>
                  </div>

                  <div className="flex flex-col md:flex-row md:items-center md:gap-3 text-sm text-gray-700">
                    <span className="font-medium">
                      Page {currentPage} of {getTotalUserPages() || 1}
                    </span>
                    <span className="text-gray-600">
                      {filteredUsers.length === 0
                        ? 'Showing 0 of 0 results'
                        : `Showing ${(currentPage - 1) * usersPerPage + 1} to ${Math.min(currentPage * usersPerPage, filteredUsers.length)} of ${filteredUsers.length} results`}
                      {filteredUsers.length === 0 && userSearchTerm
                        ? ` (filtered from ${users.length} total)`
                        : userSearchTerm
                          ? ` (filtered from ${users.length} total)`
                          : ''}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 ml-auto">
                    <button
                      onClick={() =>
                        setCurrentPage(prev => Math.max(1, prev - 1))
                      }
                      disabled={currentPage === 1}
                      className="px-3 py-2 border border-white/30 bg-white/40 backdrop-blur-sm rounded-md text-sm font-medium text-gray-800 hover:bg-white/60 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                      Previous
                    </button>

                    <button
                      onClick={() =>
                        setCurrentPage(prev =>
                          Math.min(getTotalUserPages(), prev + 1)
                        )
                      }
                      disabled={currentPage >= getTotalUserPages()}
                      className="px-3 py-2 border border-white/30 bg-white/40 backdrop-blur-sm rounded-md text-sm font-medium text-gray-800 hover:bg-white/60 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Assign Button */}
            {selectedUserId && (
              <div
                className={`mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 ${glassCardClass}`}
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    Selected User: {selectedUserId}
                  </p>
                  <p className="text-xs text-gray-600 mt-1">
                    {users.find(
                      u => (u?.userId || u?.id) === selectedUserId
                    ) && (
                      <>
                        Name:{' '}
                        {
                          formatUserData(
                            users.find(
                              u => (u?.userId || u?.id) === selectedUserId
                            )
                          ).name
                        }
                      </>
                    )}
                  </p>
                </div>
                {editingTemplateId && (
                  <button
                    onClick={handleAssignMenuTemplate}
                    disabled={assigningMenu}
                    className="bg-emerald-600 text-white px-6 py-2 rounded-md hover:bg-emerald-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm font-medium w-full sm:w-auto"
                  >
                    {assigningMenu
                      ? 'Assigning...'
                      : 'Assign Menu Template to User'}
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* User Menus Table - Only show when a user is selected */}
      {selectedUserId && (
        <div className={`${glassSurfaceClass} p-6`}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">User Menus</h2>
            {loadingUserMenus && (
              <span className="text-sm text-gray-500">
                {t('common.loading')}
              </span>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/10">
              <thead className="bg-white/10">
                <tr>
                  <th
                    onClick={() => handleUserMenusSort('templateName')}
                    className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-white/20"
                  >
                    <div className="flex items-center gap-1">
                      Template Name
                      {userMenusSortField === 'templateName' &&
                        (userMenusSortDirection === 'asc' ? (
                          <ChevronUpIcon className="w-4 h-4" />
                        ) : (
                          <ChevronDownIcon className="w-4 h-4" />
                        ))}
                    </div>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Template ID
                  </th>
                  <th
                    onClick={() => handleUserMenusSort('dateApplied')}
                    className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-white/20"
                  >
                    <div className="flex items-center gap-1">
                      Date Applied
                      {userMenusSortField === 'dateApplied' &&
                        (userMenusSortDirection === 'asc' ? (
                          <ChevronUpIcon className="w-4 h-4" />
                        ) : (
                          <ChevronDownIcon className="w-4 h-4" />
                        ))}
                    </div>
                  </th>
                  <th
                    onClick={() => handleUserMenusSort('breakfast')}
                    className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-white/20"
                  >
                    <div className="flex items-center gap-1">
                      Breakfast
                      {userMenusSortField === 'breakfast' &&
                        (userMenusSortDirection === 'asc' ? (
                          <ChevronUpIcon className="w-4 h-4" />
                        ) : (
                          <ChevronDownIcon className="w-4 h-4" />
                        ))}
                    </div>
                  </th>
                  <th
                    onClick={() => handleUserMenusSort('lunch')}
                    className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-white/20"
                  >
                    <div className="flex items-center gap-1">
                      Lunch
                      {userMenusSortField === 'lunch' &&
                        (userMenusSortDirection === 'asc' ? (
                          <ChevronUpIcon className="w-4 h-4" />
                        ) : (
                          <ChevronDownIcon className="w-4 h-4" />
                        ))}
                    </div>
                  </th>
                  <th
                    onClick={() => handleUserMenusSort('dinner')}
                    className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-white/20"
                  >
                    <div className="flex items-center gap-1">
                      Dinner
                      {userMenusSortField === 'dinner' &&
                        (userMenusSortDirection === 'asc' ? (
                          <ChevronUpIcon className="w-4 h-4" />
                        ) : (
                          <ChevronDownIcon className="w-4 h-4" />
                        ))}
                    </div>
                  </th>
                  <th
                    onClick={() => handleUserMenusSort('snack')}
                    className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-white/20"
                  >
                    <div className="flex items-center gap-1">
                      Snack
                      {userMenusSortField === 'snack' &&
                        (userMenusSortDirection === 'asc' ? (
                          <ChevronUpIcon className="w-4 h-4" />
                        ) : (
                          <ChevronDownIcon className="w-4 h-4" />
                        ))}
                    </div>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-transparent divide-y divide-white/10">
                {sortedUserMenus.map(menu => {
                  const id = menu?.id || menu?._id || menu?.menuTemplateId
                  const templateId = menu?.menuTemplateId || id
                  const template = templates.find(t => {
                    const tId = t?.id || t?._id || t?.menuTemplateId
                    return tId === templateId
                  })
                  const templateName = template?.name || 'Unknown Template'

                  const isViewing = viewingUserMenu?.id === id
                  return (
                    <tr
                      key={id}
                      className={`hover:bg-white/5 cursor-pointer ${isViewing ? 'bg-indigo-50' : ''}`}
                      onClick={() => {
                        if (isViewing) {
                          setViewingUserMenu(null)
                        } else {
                          setViewingUserMenu(menu)
                        }
                      }}
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {templateName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {templateId}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {menu?.dateApplied
                          ? new Date(menu.dateApplied).toLocaleDateString()
                          : 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {(menu?.breakfastPlan || []).length} items
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {(menu?.lunchPlan || []).length} items
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {(menu?.dinnerPlan || []).length} items
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {(menu?.snackPlan || []).length} items
                      </td>
                      <td
                        className="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                        onClick={e => e.stopPropagation()}
                      >
                        <button
                          onClick={() => handleRemoveMenu(menu)}
                          disabled={removingMenu}
                          className="text-red-600 hover:text-red-800 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                          title="Remove menu"
                        >
                          <TrashIcon className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
                {userMenus.length === 0 && (
                  <tr>
                    <td
                      className="px-6 py-4 text-sm text-gray-500 text-center"
                      colSpan="8"
                    >
                      {loadingUserMenus
                        ? 'Loading user menus...'
                        : 'No menus assigned to this user'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* User Menu Viewer - Display selected menu details */}
      {viewingUserMenu && (
        <div className={`${glassSurfaceClass} p-6`}>
          <div
            className="flex items-center justify-between cursor-pointer mb-4"
            onClick={() => setViewingUserMenu(null)}
          >
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                User Menu Details
              </h2>
              <p className="text-gray-500 text-sm">
                {viewingUserMenu?.dateApplied
                  ? `Date Applied: ${new Date(viewingUserMenu.dateApplied).toLocaleDateString()}`
                  : 'Menu Template Details'}
              </p>
            </div>
            <ChevronUpIcon className="w-5 h-5 text-gray-600" />
          </div>

          <div className="mt-6 space-y-6">
            <div>
              <h3 className="text-base font-semibold text-gray-900 mb-3">
                Menu Items
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {mealTypeOptions.map(opt => {
                  const items = viewingUserMenu[opt.id] || []
                  return (
                    <div
                      key={opt.id}
                      className="rounded-lg border border-white/20 bg-white/10 backdrop-blur-sm"
                    >
                      <div className="px-3 py-2 bg-white/10 border-b border-white/15 text-sm font-medium text-gray-700">
                        {opt.label}
                      </div>
                      <div className="p-3 space-y-2 max-h-64 overflow-y-auto">
                        {items.length === 0 && (
                          <div className="text-sm text-gray-500">No items</div>
                        )}
                        {items.map((it, i) => {
                          const isRecipeItem = detectIsRecipe(it)
                          const servings = it?.numberOfServings || 1
                          const adjustedCalories =
                            Number(it?.totalCalories) || 0
                          const adjustedNutrients = it?.totalNutrients || {}

                          return (
                            <div
                              key={i}
                              className="p-2 rounded bg-white/40 backdrop-blur-sm shadow-sm"
                            >
                              <div className="min-w-0">
                                <div className="text-sm font-medium text-gray-900 truncate">
                                  {it?.name || it?.title || 'Unnamed'}
                                </div>
                                <div className="text-xs text-gray-500 truncate">
                                  {isRecipeItem ? 'Recipe' : 'Food'}
                                </div>
                              </div>
                              {isRecipeItem && (
                                <div className="mt-1 mb-1 text-xs text-gray-600">
                                  <span className="font-medium">Servings:</span>{' '}
                                  {servings}
                                </div>
                              )}
                              <div className="mt-1 text-xs text-gray-600">
                                <span className="font-medium">Calories:</span>{' '}
                                {adjustedCalories}
                                <span className="mx-2">|</span>
                                <span className="font-medium">
                                  Proteins:
                                </span>{' '}
                                {Math.round(
                                  Number(adjustedNutrients?.proteinsInGrams) ||
                                    0
                                )}{' '}
                                g<span className="mx-2">|</span>
                                <span className="font-medium">Carbs:</span>{' '}
                                {Math.round(
                                  Number(
                                    adjustedNutrients?.carbohydratesInGrams
                                  ) || 0
                                )}{' '}
                                g<span className="mx-2">|</span>
                                <span className="font-medium">Fat:</span>{' '}
                                {Math.round(
                                  Number(adjustedNutrients?.fatInGrams) || 0
                                )}{' '}
                                g
                              </div>
                            </div>
                          )
                        })}
                        {items.length > 0 &&
                          (() => {
                            const mealTotals = computeMealTotals(items)
                            return (
                              <div className="mt-2 p-2 bg-indigo-500/10 border border-indigo-300/30 rounded text-xs text-indigo-900">
                                <span className="font-medium">
                                  {opt.label} subtotal:
                                </span>
                                <span className="ml-1">
                                  {Math.round(mealTotals.calories)} cal
                                </span>
                                <span className="mx-2">|</span>
                                <span>
                                  P {Math.round(mealTotals.proteinsInGrams)} g
                                </span>
                                <span className="mx-2">|</span>
                                <span>
                                  C{' '}
                                  {Math.round(mealTotals.carbohydratesInGrams)}{' '}
                                  g
                                </span>
                                <span className="mx-2">|</span>
                                <span>
                                  F {Math.round(mealTotals.fatInGrams)} g
                                </span>
                              </div>
                            )
                          })()}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Creator Details Modal */}
      {viewingCreator && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={`${glassCardClass} max-w-md w-full p-6`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">
                Creator Details
              </h3>
              <button
                onClick={() => setViewingCreator(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                <span className="text-2xl">&times;</span>
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <span className="text-sm font-medium text-gray-700">
                  Menu Template:
                </span>
                <div className="mt-1 text-gray-900">
                  {viewingCreator?.name || 'Untitled'}
                </div>
              </div>

              <div>
                <span className="text-sm font-medium text-gray-700">
                  Creator ID:
                </span>
                <div className="mt-1 text-gray-900 font-mono text-xs break-all bg-white/40 border border-white/30 backdrop-blur-sm p-2 rounded">
                  {viewingCreator?.createdByUserId || 'Admin (no ID)'}
                </div>
              </div>

              {viewingCreator?.createdByUserId === currentUser?.uid && (
                <div className="mt-4 p-3 bg-indigo-500/10 border border-indigo-300/30 rounded">
                  <p className="text-sm text-indigo-900">
                    This is your menu template
                  </p>
                </div>
              )}

              <div className="pt-4 border-t">
                <span className="text-sm font-medium text-gray-700">
                  Template Stats:
                </span>
                <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                  <div className="bg-white/40 border border-white/30 backdrop-blur-sm p-2 rounded">
                    <div className="text-gray-600">Total Items</div>
                    <div className="font-semibold text-gray-900">
                      {(viewingCreator?.breakfastPlan?.length || 0) +
                        (viewingCreator?.lunchPlan?.length || 0) +
                        (viewingCreator?.dinnerPlan?.length || 0) +
                        (viewingCreator?.snackPlan?.length || 0)}
                    </div>
                  </div>
                  <div className="bg-white/40 border border-white/30 backdrop-blur-sm p-2 rounded">
                    <div className="text-gray-600">Total Calories</div>
                    <div className="font-semibold text-gray-900">
                      {viewingCreator?.totalCalories || 0}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={() => setViewingCreator(null)}
              className="mt-6 w-full btn-secondary"
            >
              {t('common.close') || 'Close'}
            </button>
          </div>
        </div>
      )}

      {/* Copy Template Modal */}
      {isCopyModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={`${glassCardClass} max-w-md w-full p-6`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white">
                {t('pages.menus.copyTemplate.title') || 'Copy Menu Template'}
              </h3>
              <button
                onClick={() => {
                  setIsCopyModalOpen(false)
                  setSelectedTemplateForCopy(null)
                  setCopyCountryCode('RO')
                }}
                className="text-white/80 hover:text-white"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  {t('pages.menus.copyTemplate.templateName') ||
                    'Template Name'}
                </label>
                <div className="p-3 bg-white/40 border border-white/30 rounded-md text-white">
                  {selectedTemplateForCopy?.name || 'Untitled'}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  {t('pages.menus.copyTemplate.selectCountry') ||
                    'Select Country'}
                </label>
                <select
                  value={copyCountryCode}
                  onChange={e => setCopyCountryCode(e.target.value)}
                  className="w-full border border-white/30 bg-white/20 backdrop-blur-sm rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 [&>option]:bg-gray-800 [&>option]:text-white"
                  style={{ color: 'white' }}
                >
                  <option
                    value="RO"
                    style={{ background: '#1f2937', color: 'white' }}
                  >
                    Romania (RO)
                  </option>
                  <option
                    value="US"
                    style={{ background: '#1f2937', color: 'white' }}
                  >
                    United States (US)
                  </option>
                  <option
                    value="IT"
                    style={{ background: '#1f2937', color: 'white' }}
                  >
                    Italy (IT)
                  </option>
                  <option
                    value="ES"
                    style={{ background: '#1f2937', color: 'white' }}
                  >
                    Spain (ES)
                  </option>
                  <option
                    value="UK"
                    style={{ background: '#1f2937', color: 'white' }}
                  >
                    United Kingdom (UK)
                  </option>
                  <option
                    value="DE"
                    style={{ background: '#1f2937', color: 'white' }}
                  >
                    Germany (DE)
                  </option>
                  <option
                    value="FR"
                    style={{ background: '#1f2937', color: 'white' }}
                  >
                    France (FR)
                  </option>
                  <option
                    value="HU"
                    style={{ background: '#1f2937', color: 'white' }}
                  >
                    Hungary (HU)
                  </option>
                </select>
              </div>

              <div className="p-3 bg-blue-500/20 border border-blue-300/30 rounded-md text-sm text-white">
                {t('pages.menus.copyTemplate.description') ||
                  'This will create a new menu template translated and adapted for the selected country.'}
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setIsCopyModalOpen(false)
                  setSelectedTemplateForCopy(null)
                  setCopyCountryCode('RO')
                }}
                className="flex-1 px-4 py-2 border border-white/30 bg-white/40 backdrop-blur-sm rounded-md text-white hover:bg-white/60"
                disabled={copyingTemplate}
              >
                {t('common.cancel') || 'Cancel'}
              </button>
              <button
                onClick={handleCopyTemplate}
                disabled={copyingTemplate || !copyCountryCode}
                className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {copyingTemplate
                  ? t('pages.menus.copyTemplate.copying') || 'Copying...'
                  : t('pages.menus.copyTemplate.copy') || 'Copy Template'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Menus
