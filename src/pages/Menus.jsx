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
  GlobeAltIcon,
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
import {
  buildServingOptionsForMenuItem,
  detectIsRecipe,
  getServingIdentifier,
  findServingByIdentifier,
  findDefaultServing,
  calculateDisplayValues,
  safeNutrients
} from '../util/menuDisplay'
import { isImperialFromUserData } from '../util/units'

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
const parseNumber = value => {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}
const parsePositiveOrder = value => {
  const parsed = Number.parseInt(String(value || '').trim(), 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}
const splitMenuName = name => {
  const normalizedName = String(name || '').trim()
  const [containerPart, ...menuParts] = normalizedName.split(MENU_NAME_SEPARATOR)

  if (menuParts.length === 0) {
    return {
      containerName: '',
      menuName: normalizedName,
      order: null,
      hasContainer: false
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
        hasContainer: true
      }
    }
  }

  return {
    containerName: containerPart.trim(),
    menuName: joinedMenuName,
    order: null,
    hasContainer: true
  }
}
const getFallbackMenuOrder = (menu, fallbackIndex = 0) => {
  const parsed = splitMenuName(menu?.name || '')
  if (parsed.order !== null) {
    return parsed.order
  }

  const createdAt = menu?.dateTimeCreated ? new Date(menu.dateTimeCreated).getTime() : Number.NaN
  if (Number.isFinite(createdAt)) {
    return createdAt
  }

  return fallbackIndex + 1
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
const parseOptionalNumber = value => {
  if (value === '' || value === null || value === undefined) return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}
const getServingAmount = serving =>
  parseNumber(serving?.value ?? serving?.amount ?? 0)
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
    return name.includes('portion') || name.includes('serving') || name.includes('portie')
  }) || null

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
  const [templateCreatorFilter, setTemplateCreatorFilter] = useState('ALL')
  const [isTemplateFilterOpen, setIsTemplateFilterOpen] = useState(false)

  // Pagination for templates
  const [templatesPage, setTemplatesPage] = useState(1)
  const [templatesPerPage, setTemplatesPerPage] = useState(5)

  // Copy template modal state
  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false)
  const [selectedTemplateForCopy, setSelectedTemplateForCopy] = useState(null)
  const [copyCountryCode, setCopyCountryCode] = useState('RO')
  const [copyingTemplate, setCopyingTemplate] = useState(false)
  const [viewingItem, setViewingItem] = useState(null)
  const selectedUserForUnits = useMemo(
    () =>
      users.find(
        u => (u?.userId || u?.id || u?.user?.userId) === selectedUserId
      ) || null,
    [users, selectedUserId]
  )
  const isImperial = isImperialFromUserData(
    selectedUserForUnits?.userData ||
      selectedUserForUnits?.user?.userData ||
      selectedUserForUnits
  )
  // Template builder should always expose both metric and imperial options.
  const includeImperialServingOptions = true
  const roundServingAmountByUnitSystem = value => {
    const n = parseNumber(value)
    const decimals = isImperial ? 2 : 1
    const factor = 10 ** decimals
    return Math.round(n * factor) / factor
  }

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
      alert(t('pages.menus.selectTemplateAndUser'))
      return
    }

    try {
      setAssigningMenu(true)
      await assignMenuTemplateToUser({
        userId: selectedUserId,
        menuTemplateId: editingTemplateId,
        dateApplied: assignmentDate
      })
      alert(t('pages.menus.assignSuccess'))
      // Refresh user menus after assignment
      await loadUserMenus(selectedUserId)
    } catch (e) {
      console.error('Failed to assign menu template', e)
      alert(t('pages.menus.assignFail'))
    } finally {
      setAssigningMenu(false)
    }
  }

  const handleRemoveMenu = async menu => {
    if (!selectedUserId) {
      alert(t('pages.menus.selectUserFirst'))
      return
    }

    const confirmed = confirm(t('pages.menus.confirmRemoveFromUser'))
    if (!confirmed) {
      return
    }

    try {
      setRemovingMenu(true)
      const menuTemplateId = menu?.menuTemplateId || menu?.id
      const dateApplied = menu?.dateApplied

      if (!dateApplied) {
        alert(t('pages.menus.dateAppliedMissing'))
        return
      }

      await removeMenuFromUser({
        userId: selectedUserId,
        dateApplied: dateApplied,
        menuTemplateId: menuTemplateId
      })
      alert(t('pages.menus.removeSuccess'))
      // wait 1.5 seconds
      await new Promise(resolve => setTimeout(resolve, 1500))
      // Refresh user menus after removal
      loadUserMenus(selectedUserId)
    } catch (e) {
      console.error('Failed to remove menu', e)
      alert(t('pages.menus.removeFail'))
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
      const normalizedResults = Array.isArray(results) ? results : []
      setSearchResults(
        normalizedResults.filter(item => !shouldHideLowQualitySearchItem(item))
      )
    } catch (e) {
      console.error('Search failed', e)
      setError('Failed to search items')
    } finally {
      setSearching(false)
    }
  }

  const addItemToPlan = async item => {
    try {
      let enriched = normalizeMenuItemShape(item)
      // Store original serving info - try to get from serving array or default
      let originalServingAmount = 100 // Default to 100g if no serving info
      let originalServingId = null

      if (Array.isArray(enriched?.servingOptions) && enriched.servingOptions.length > 0) {
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
              const originalServings = normalizedDetailed?.numberOfRecipeServings || 1
              // Get original serving info from detailed item if available
              // For recipes, caloriesPer100 is scaled by selected serving
              // We need to find the total weight for all servings
              if (
                normalizedDetailed?.servingOptions &&
                Array.isArray(normalizedDetailed.servingOptions) &&
                normalizedDetailed.servingOptions.length > 0
              ) {
                const portionServing = findPortionServing(normalizedDetailed.servingOptions)
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
                    const defaultServing = findDefaultServing(normalizedDetailed.servingOptions)
                    originalServingId = getServingIdentifier(defaultServing)
                  } else {
                    // Last resort: use default serving and multiply by numberOfRecipeServings
                    const defaultServing = findDefaultServing(normalizedDetailed.servingOptions)
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
                originalServingAmount,
                originalServingId
              }

              // Scale ingredients to match serving count
              if (
                normalizedDetailed?.ingredients &&
                Array.isArray(normalizedDetailed.ingredients)
              ) {
                enrichedData.ingredients = normalizedDetailed.ingredients.map(
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
                normalizedDetailed?.servingOptions &&
                Array.isArray(normalizedDetailed.servingOptions) &&
                normalizedDetailed.servingOptions.length > 0
              ) {
                // Use findDefaultServing to get the default serving for per-100 calculations
                const defaultServing = findDefaultServing(normalizedDetailed.servingOptions)
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

        initialServingId = getServingIdentifier(initialServing) || initialServingId
        initialServingAmount = getDefaultAmountForSelectedServing(initialServing)
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
                value: String(displayValue.servingAmount),
                quantity: parseNumber(displayValue.servingAmount),
                unit: servingOption.unitName,
                servingOption
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
          let servingIdentifier = null
          if (item.changedServing.servingOption) {
            servingIdentifier = getServingIdentifier(item.changedServing.servingOption)
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
                  // Last resort: use default serving and multiply by numberOfRecipeServings
                  const defaultServing = findDefaultServing(item.servingOptions)
                  const numberOfRecipeServings =
                    item?.numberOfRecipeServings || item?.originalServings || 1
                  originalServingAmount =
                    (getServingAmount(defaultServing) || 100) * numberOfRecipeServings
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
            originalServingAmount = 100 // Default fallback
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
    const confirmed = confirm(t('pages.menus.confirmDeleteTemplate'))
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
            if (item.changedServing.servingOption) {
              itemCopy.changedServing.servingOption = {
                ...item.changedServing.servingOption
              }
            }
          }

          // Deep copy arrays if they exist
          if (item.servingOptions && Array.isArray(item.servingOptions)) {
            itemCopy.servingOptions = item.servingOptions.map(s => ({ ...s }))
          }

          if (item.ingredients && Array.isArray(item.ingredients)) {
            itemCopy.ingredients = item.ingredients.map(ing => ({ ...ing }))
          }

          if (item.nutrientsPer100) {
            itemCopy.nutrientsPer100 = { ...item.nutrientsPer100 }
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
      alert(t('pages.menus.duplicateFail'))
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

  const computeMealTotals = (items, mealKey) => {
    return items.reduce(
      (acc, item, index) => {
        const itemKey = `${mealKey}-${index}`
        const displayValue = displayValues[itemKey]

        // Use display values if available, otherwise use original
        let calories = Number(item?.caloriesPer100) || 0
        let nutrients = item?.nutrientsPer100 || {}

        if (
          displayValue &&
          displayValue.servingAmount !== undefined &&
          displayValue.servingAmount !== ''
        ) {
          const originalServingAmount = item?.originalServingAmount || 100
          const servingOptions = buildServingOptionsForMenuItem(
            item,
            includeImperialServingOptions
          )
          const selectedServing = findServingByIdentifier(
            servingOptions,
            displayValue.selectedServingId
          )
          const selectedServingUnit =
            selectedServing?.unitName ||
            selectedServing?.unit ||
            (item?.isLiquid ? 'ml' : 'g')
          const calculated = calculateDisplayValues(
            item,
            displayValue.servingAmount,
            originalServingAmount,
            selectedServingUnit
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
    const search = templateSearchTerm.trim().toLowerCase()

    return templates.filter(template => {
      const templateId = (template?.id || template?._id || template?.menuTemplateId || '')
        .toString()
        .toLowerCase()
      const templateName = (template?.name || 'Untitled').toLowerCase()

      const matchesSearch =
        !search || templateName.includes(search) || templateId.includes(search)

      const createdByUserId = template?.createdByUserId || null
      const matchesCreator =
        templateCreatorFilter === 'ALL' ||
        (templateCreatorFilter === 'MINE' && createdByUserId === currentUser?.uid) ||
        (templateCreatorFilter === 'ADMIN' && !createdByUserId) ||
        (templateCreatorFilter === 'NUTRITIONIST' && Boolean(createdByUserId))

      return matchesSearch && matchesCreator
    })
  }, [templates, templateSearchTerm, templateCreatorFilter, currentUser?.uid])

  const groupedTemplates = useMemo(() => {
    const grouped = new Map()

    filteredTemplates.forEach(template => {
      const { containerName, menuName } = splitMenuName(template?.name || '')
      const hasContainer = Boolean(containerName)
      const key = hasContainer
        ? `container:${containerName.toLowerCase()}`
        : `menu:${(template?.id || template?.menuTemplateId || template?.name || menuName).toString()}`

      if (!grouped.has(key)) {
        grouped.set(key, {
          key,
          containerName: hasContainer ? containerName : menuName || template?.name || 'Untitled',
          menus: []
        })
      }

      grouped.get(key).menus.push({
        ...template,
        parsedContainerName: containerName,
        parsedMenuName: menuName || template?.name || 'Untitled'
      })
    })

    return [...grouped.values()]
      .map(group => ({
        ...group,
        menus: [...group.menus].sort((a, b) => {
          const orderA = getFallbackMenuOrder(a)
          const orderB = getFallbackMenuOrder(b)
          if (orderA !== orderB) return orderA - orderB
          return String(a.parsedMenuName || a.name || '').localeCompare(
            String(b.parsedMenuName || b.name || '')
          )
        })
      }))
      .sort((a, b) => a.containerName.localeCompare(b.containerName))
  }, [filteredTemplates])

  const renderItemPreviewModal = () => {
    if (!viewingItem) return null

    const previewServingOptions = buildServingOptionsForMenuItem(
      viewingItem,
      includeImperialServingOptions
    )
    const previewServing =
      findDefaultServing(previewServingOptions) || previewServingOptions[0] || null
    const previewAmount =
      getDefaultAmountForSelectedServing(previewServing) ||
      viewingItem?.originalServingAmount ||
      100
    const previewUnit =
      previewServing?.unitName ||
      previewServing?.unit ||
      (viewingItem?.isLiquid ? 'ml' : 'g')
    const previewValues = calculateDisplayValues(
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
    const instructions = Array.isArray(viewingItem?.recipeSteps?.instructions)
      ? viewingItem.recipeSteps.instructions
      : []

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6 backdrop-blur-sm">
        <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h3 className="truncate text-2xl font-bold text-slate-900">
                {viewingItem?.name || 'Unnamed'}
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                {detectIsRecipe(viewingItem) ? 'Recipe' : 'Food'}
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
                  alt={viewingItem?.name || 'Menu item'}
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
                <div className={`${glassSurfaceClass} px-3 py-3 text-center text-sm font-semibold text-slate-900`}>
                  {t('pages.myMenus.calories')}: {Math.round(parseNumber(previewValues?.calories))}
                </div>
                <div className={`${glassSurfaceClass} px-3 py-3 text-center text-sm font-semibold text-slate-900`}>
                  {t('pages.myMenus.proteins')}: {Math.round(nutrients.proteinsInGrams)} g
                </div>
                <div className={`${glassSurfaceClass} px-3 py-3 text-center text-sm font-semibold text-slate-900`}>
                  {t('pages.myMenus.carbs')}: {Math.round(nutrients.carbohydratesInGrams)} g
                </div>
                <div className={`${glassSurfaceClass} px-3 py-3 text-center text-sm font-semibold text-slate-900`}>
                  {t('pages.myMenus.fat')}: {Math.round(nutrients.fatInGrams)} g
                </div>
              </div>

              {previewServing ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  <span className="font-semibold text-slate-800">
                    {t('pages.myMenus.servingOptions')}:
                  </span>{' '}
                  {previewAmount} {previewUnit}
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
                              {ingredient?.name || 'Unnamed'}
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
            <button
              type="button"
              onClick={async () => {
                await addItemToPlan(viewingItem)
                setViewingItem(null)
              }}
              className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 px-5 py-3 text-sm font-semibold text-white transition hover:shadow-lg"
            >
              {t('pages.myMenus.addItem')}
            </button>
            <button
              type="button"
              onClick={() => setViewingItem(null)}
              className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              {t('common.close') || 'Close'}
            </button>
          </div>
        </div>
      </div>
    )
  }

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
    return groupedTemplates.slice(startIndex, endIndex)
  }

  const getTotalTemplatesPages = () => {
    return Math.ceil(groupedTemplates.length / templatesPerPage)
  }

  // Reset to page 1 when template search term changes
  useEffect(() => {
    setTemplatesPage(1)
  }, [templateSearchTerm, templateCreatorFilter, templatesPerPage])

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
              {t('pages.menus.buildMealPlans') ||
                'Build meal plans by searching foods or recipes'}
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
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="md:col-span-2 space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600 mb-2">
                    Template Name
                  </label>
                  <input
                    type="text"
                    value={menuName}
                    onChange={e => setMenuName(e.target.value)}
                    className="w-full rounded-xl border border-white/60 bg-white/80 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-500 shadow-inner focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    placeholder="e.g., High Protein - Weekday"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-white/60 bg-white/60 p-4 backdrop-blur-md">
                  <div className="flex-1 min-w-[160px]">
                    <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600 mb-1">
                      Country Code
                    </label>
                    <select
                      value={countryCode}
                      onChange={e => setCountryCode(e.target.value)}
                      className="w-full rounded-xl border border-white/70 bg-white/90 px-3 py-2 text-sm font-medium text-gray-800 shadow-inner focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
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
                  <label className="inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/80 px-4 py-2 text-sm font-medium text-gray-700 shadow-sm">
                    <input
                      type="checkbox"
                      checked={isAssignableByUser}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-400"
                      onChange={e => setIsAssignableByUser(e.target.checked)}
                    />
                    Is Assignable by User
                  </label>
                </div>
              </div>
              <div className="space-y-3 rounded-2xl border border-white/60 bg-gradient-to-br from-blue-50/80 via-purple-50/70 to-white/70 p-4 shadow-inner backdrop-blur">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                  Quick Tips
                </p>
                <ul className="space-y-2 text-sm text-gray-700">
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-blue-500" />
                    Search foods or recipes and add them by meal.
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-purple-500" />
                    Adjust serving options for each item before saving.
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-amber-500" />
                    Review meal and menu totals before creating the template.
                  </li>
                </ul>
              </div>
            </div>

            <div>
              <h3 className="text-base font-semibold text-gray-900 mb-3">
                {t('pages.menus.searchItems') || 'Search Items'}
              </h3>
              <div className="flex flex-col gap-3 md:flex-row md:items-center">
                <div className="relative flex-1">
                  <MagnifyingGlassIcon className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={searchText}
                    onChange={e => setSearchText(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleSearch()
                    }}
                    className="w-full rounded-2xl border border-white/70 bg-white/90 py-3 pl-11 pr-4 text-sm text-gray-900 placeholder:text-gray-500 shadow-inner focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    placeholder={
                      t('pages.menus.searchFoodsOrRecipes') ||
                      'Search foods or recipes...'
                    }
                  />
                </div>
                <label className="inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/80 px-4 py-2 text-sm font-medium text-gray-700 shadow-sm">
                  <input
                    type="checkbox"
                    checked={onlyRecipes}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-400"
                    onChange={e => setOnlyRecipes(e.target.checked)}
                  />
                  Only Recipes
                </label>
                <button
                  onClick={handleSearch}
                  disabled={searching || !searchText.trim()}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 px-5 py-3 text-sm font-semibold text-white shadow-lg transition hover:shadow-xl disabled:opacity-60"
                >
                  {searching
                    ? t('pages.menus.searching') || 'Searching...'
                    : t('pages.menus.search') || 'Search'}
                </button>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl border border-white/70 bg-white/70 p-2 backdrop-blur">
                {mealTypeOptions.map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => setActiveMealType(opt.id)}
                    className={`group rounded-xl px-4 py-2 text-sm font-semibold transition ${
                      activeMealType === opt.id
                        ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg'
                        : 'text-gray-700 hover:bg-white hover:shadow'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {searchResults.length > 0 && (
                <div className="mt-3 max-h-56 overflow-y-auto rounded-2xl border border-white/70 bg-white/80 backdrop-blur divide-y divide-white/70">
                  {searchResults.map((item, idx) => {
                    const isRecipeItem = detectIsRecipe(item)
                    const servingOptions = buildServingOptionsForMenuItem(
                      item,
                      includeImperialServingOptions
                    )
                    const selectedServing = findDefaultServing(servingOptions)
                    const servingAmount = getServingAmount(selectedServing) || 100
                    const servingUnit =
                      selectedServing?.unitName ||
                      selectedServing?.unit ||
                      (item?.isLiquid ? 'ml' : 'g')
                    const numberOfRecipeServings = isRecipeItem
                      ? item?.numberOfRecipeServings || item?.originalServings || 1
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
                          <div className="text-sm font-medium text-gray-900 truncate">
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
                          onClick={event => {
                            event.stopPropagation()
                            addItemToPlan(item)
                          }}
                          className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-500 to-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-md transition hover:shadow-lg"
                        >
                          <PlusIcon className="h-4 w-4" /> Add
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div>
              <h3 className="text-base font-semibold text-gray-900 mb-3">
                Selected Items
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {mealTypeOptions.map(opt => (
                  <div
                    key={opt.id}
                    className="rounded-2xl border border-white/70 bg-white/80 p-4 backdrop-blur"
                  >
                    <div className="text-sm font-semibold text-gray-800 mb-3">
                      {opt.label}
                    </div>
                    <div className="space-y-3 max-h-64 overflow-y-auto">
                      {plans[opt.id].length === 0 && (
                        <div className="text-sm text-gray-500">No items</div>
                      )}
                      {plans[opt.id].map((it, i) => {
                        const isRecipeItem = detectIsRecipe(it)
                        const itemKey = `${opt.id}-${i}`
                        const displayValue = displayValues[itemKey]

                        // Build serving options like RN: base unit + custom + imperial (if applicable)
                        const servingOptions = buildServingOptionsForMenuItem(
                          it,
                          includeImperialServingOptions
                        )
                        const hasServings = servingOptions.length > 0

                        const defaultServingIdentifier =
                          getServingIdentifier(servingOptions[0]) || null
                        const currentServingId =
                          displayValue?.selectedServingId ||
                          it?.originalServingId ||
                          defaultServingIdentifier
                        const selectedServingForCurrent =
                          findServingByIdentifier(
                            servingOptions,
                            currentServingId
                          ) ||
                          servingOptions[0] ||
                          null
                        const fallbackServingAmount = selectedServingForCurrent
                          ? getDefaultAmountForSelectedServing(
                              selectedServingForCurrent
                            )
                          : it?.originalServingAmount || 100
                        const currentServingAmount =
                          displayValue?.servingAmount !== undefined
                            ? displayValue.servingAmount
                            : fallbackServingAmount

                        // Calculate display values based on selected serving
                        // Ensure we use the correct default serving for per-100 calculations
                        let originalServingAmount = it?.originalServingAmount
                        if (
                          !originalServingAmount &&
                          servingOptions.length > 0
                        ) {
                          if (isRecipeItem) {
                            const portionServing = findPortionServing(servingOptions)
                            if (portionServing) {
                              const numberOfRecipeServings =
                                it?.numberOfRecipeServings ||
                                it?.originalServings ||
                                1
                              originalServingAmount =
                                getServingAmount(portionServing) * numberOfRecipeServings
                            } else {
                              // Fall back to totalQuantity or weightAfterCooking if available
                              const totalWeight =
                                it?.weightAfterCooking ||
                                it?.weightAfterCooking ||
                                null
                              if (totalWeight) {
                                originalServingAmount = totalWeight
                              } else {
                                // Last resort: use default serving and multiply by numberOfRecipeServings
                                const defaultServing =
                                  findDefaultServing(servingOptions)
                                const numberOfRecipeServings =
                                  it?.numberOfRecipeServings ||
                                  it?.originalServings ||
                                  1
                                originalServingAmount =
                                  (getServingAmount(defaultServing) || 100) *
                                  numberOfRecipeServings
                              }
                            }
                          } else {
                            // For foods, use default serving
                            const defaultServing =
                              findDefaultServing(servingOptions)
                            originalServingAmount =
                              getServingAmount(defaultServing) || 100
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
                          originalServingAmount,
                          findServingByIdentifier(
                            servingOptions,
                            currentServingId
                          )?.unitName ||
                            findServingByIdentifier(
                              servingOptions,
                              currentServingId
                            )?.unit ||
                            (it?.isLiquid ? 'ml' : 'g')
                        )
                        const adjustedCalories = calculated.calories
                        const adjustedNutrients = calculated.nutrients

                        return (
                          <div
                            key={i}
                            className="relative rounded-2xl border border-white/60 bg-white/90 p-4 shadow-sm"
                          >
                            <div className="flex items-start justify-between">
                              <div className="min-w-0">
                                <div className="text-sm font-semibold text-gray-900 truncate">
                                  {it?.name || it?.title || 'Unnamed'}
                                </div>
                                <div className="text-xs text-gray-500 truncate">
                                  {isRecipeItem ? 'Recipe' : 'Food'}
                                </div>
                              </div>
                              <button
                                onClick={() => removeItemFromPlan(opt.id, i)}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-red-50 text-red-600 transition hover:bg-red-100"
                              >
                                <TrashIcon className="h-4 w-4" />
                              </button>
                            </div>

                            {/* Serving dropdown and textinput for both foods and recipes */}
                            {hasServings && (
                              <div className="mt-3 flex flex-col gap-2 md:flex-row md:items-center">
                                <label className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                                  Serving:
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
                                        selectedServingId: selectedIdentifier,
                                        servingAmount:
                                          roundServingAmountByUnitSystem(
                                            servingAmount
                                          ) || currentServingAmount
                                      }
                                    }))
                                  }}
                                  className="w-full rounded-xl border border-white/80 bg-white/90 px-3 py-2 text-xs font-medium text-gray-800 shadow-inner focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200 md:w-48"
                                >
                                  {servingOptions.map((serving, idx) => {
                                    const servingId =
                                      getServingIdentifier(serving)
                                    return (
                                      <option
                                        key={servingId || idx}
                                        value={servingId}
                                      >
                                        {serving.name ||
                                          serving.innerName ||
                                          serving.unitName ||
                                          serving.unit}
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
                                          selectedServingId: currentServingId,
                                          servingAmount: fallbackAmount
                                        }
                                      }))
                                    }
                                  }}
                                  className="w-24 rounded-xl border border-white/80 bg-white/90 px-3 py-2 text-xs font-semibold text-gray-900 shadow-inner focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
                                  placeholder="Amount"
                                />
                                <span className="text-xs text-gray-500 whitespace-nowrap">
                                  {findServingByIdentifier(
                                    servingOptions,
                                    currentServingId
                                  )?.unitName ||
                                    findServingByIdentifier(
                                      servingOptions,
                                      currentServingId
                                    )?.unit ||
                                    (it?.isLiquid ? 'ml' : 'g')}
                                </span>
                                </div>
                              </div>
                            )}

                            {isRecipeItem && (
                              <div className="mt-1 mb-4 text-xs text-gray-600">
                                <span className="font-medium">
                                  Original Serving:
                                </span>{' '}
                                {it?.numberOfRecipeServings ||
                                  it?.originalServings ||
                                  1}
                              </div>
                            )}

                            <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-700 sm:grid-cols-4">
                              <div className={`${glassSurfaceClass} px-3 py-2 text-center font-semibold text-gray-900`}>
                                Calories: {adjustedCalories}
                              </div>
                              <div className={`${glassSurfaceClass} px-3 py-2 text-center font-semibold text-gray-900`}>
                                Proteins: {Math.round(Number(adjustedNutrients?.proteinsInGrams) || 0)} g
                              </div>
                              <div className={`${glassSurfaceClass} px-3 py-2 text-center font-semibold text-gray-900`}>
                                Carbs: {Math.round(Number(adjustedNutrients?.carbohydratesInGrams) || 0)} g
                              </div>
                              <div className={`${glassSurfaceClass} px-3 py-2 text-center font-semibold text-gray-900`}>
                                Fat: {Math.round(Number(adjustedNutrients?.fatInGrams) || 0)} g
                              </div>
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

            <div className="space-y-3">
              <div className="p-3 bg-emerald-500/10 border border-emerald-300/30 rounded-2xl text-sm text-emerald-900">
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
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm text-gray-600">
                  {t('pages.menus.totalItems') || 'Total items'}:{' '}
                  <span className="font-medium text-gray-900">
                    {totalItems}
                  </span>
                </div>
                <button
                  onClick={handleCreateTemplate}
                  disabled={submitting || !menuName.trim()}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-3 text-sm font-semibold text-white shadow-xl transition hover:-translate-y-0.5 hover:shadow-2xl disabled:opacity-60 sm:w-auto"
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
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-col gap-2 w-full md:w-auto md:flex-row md:items-center">
                <div className="relative flex-1 md:w-80">
                  <MagnifyingGlassIcon className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder={
                      t('pages.menus.searchTemplatesByName') ||
                      'Search templates by name or ID...'
                    }
                    value={templateSearchTerm}
                    onChange={e => setTemplateSearchTerm(e.target.value)}
                    className="w-full rounded-2xl border border-white/70 bg-white/90 py-3 pl-11 pr-4 text-sm text-gray-900 placeholder:text-gray-500 shadow-inner focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  />
                </div>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsTemplateFilterOpen(open => !open)}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/70 bg-white/80 px-4 py-3 text-sm font-medium text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-200 hover:bg-white"
                  >
                    <ChevronDownIcon className="h-4 w-4 rotate-90" />
                    {t('pages.myMenus.filter')}
                  </button>
                  {isTemplateFilterOpen ? (
                    <div className="absolute right-0 z-20 mt-2 min-w-52 rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl">
                      {[
                        { id: 'ALL', label: t('pages.menus.filterAllCreators') || 'All creators' },
                        { id: 'MINE', label: t('pages.menus.filterMyMenus') || 'My menus' },
                        { id: 'ADMIN', label: t('pages.menus.filterAdminMenus') || 'Admin created' },
                        { id: 'NUTRITIONIST', label: t('pages.menus.filterNutritionistMenus') || 'Nutritionist created' }
                      ].map(option => (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => {
                            setTemplateCreatorFilter(option.id)
                            setIsTemplateFilterOpen(false)
                          }}
                          className={`flex w-full rounded-xl px-3 py-2 text-left text-sm transition ${
                            templateCreatorFilter === option.id
                              ? 'bg-slate-100 font-semibold text-slate-900'
                              : 'text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="text-sm text-gray-600">
                {groupedTemplates.length} {t('pages.myMenus.menus')}
              </div>
            </div>

            <div className="space-y-5">
              {getCurrentTemplates().length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-white/50 px-6 py-10 text-center text-sm text-gray-500">
                  {loadingTemplates
                    ? t('pages.menus.loadingTemplates') || 'Loading templates...'
                    : templateSearchTerm
                      ? t('pages.menus.noTemplatesFoundMatching', {
                          term: templateSearchTerm
                        }) ||
                        `No templates found matching "${templateSearchTerm}"`
                      : t('pages.menus.noTemplatesFound') ||
                        'No templates found'}
                </div>
              ) : (
                getCurrentTemplates().map(group => (
                  <div key={group.key} className={`${glassCardClass} p-5 md:p-6`}>
                    <div className="relative">
                      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                          <h3 className="text-2xl font-semibold text-gray-900">
                            {group.containerName}
                          </h3>
                          <p className="mt-1 text-sm text-gray-500">
                            {group.menus.length} {t('pages.myMenus.menus')}
                          </p>
                        </div>
                      </div>

                      <div className="relative overflow-visible rounded-3xl border border-slate-200/80 bg-white/85 shadow-sm">
                        <div className="overflow-x-auto rounded-3xl">
                          <table className="min-w-full table-fixed">
                          <thead className="bg-slate-50/90">
                            <tr>
                              <th className="px-4 py-4 text-center text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                                {t('pages.myMenus.menuName')}
                              </th>
                              <th className="w-[110px] px-4 py-4 text-center text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                                {t('pages.myMenus.id')}
                              </th>
                              <th className="px-4 py-4 text-center text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                                {t('pages.menus.creator') || 'Creator'}
                              </th>
                              <th className="px-4 py-4 text-center text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                                {t('pages.myMenus.breakfast')}
                              </th>
                              <th className="px-4 py-4 text-center text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                                {t('pages.myMenus.lunch')}
                              </th>
                              <th className="px-4 py-4 text-center text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                                {t('pages.myMenus.dinner')}
                              </th>
                              <th className="px-4 py-4 text-center text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                                {t('pages.myMenus.snack')}
                              </th>
                              <th className="px-4 py-4 text-center text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                                {t('pages.myMenus.actions')}
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {group.menus.map(menu => {
                              const id = menu?.id || menu?._id || menu?.menuTemplateId
                              const isCurrentlyEditing = editingTemplateId === id
                              const creatorLabel = !menu?.createdByUserId
                                ? t('pages.menus.creatorAdmin') || 'Admin'
                                : menu.createdByUserId === currentUser?.uid
                                  ? t('pages.menus.creatorYou') || 'You'
                                  : t('pages.menus.creatorNutritionist') || 'Nutritionist'
                              const creatorClass = !menu?.createdByUserId
                                ? 'bg-slate-100 text-slate-700'
                                : menu.createdByUserId === currentUser?.uid
                                  ? 'bg-blue-50 text-blue-700'
                                  : 'bg-violet-50 text-violet-700'

                              return (
                                <tr
                                  key={id}
                                  className={`cursor-pointer transition hover:bg-slate-50 ${
                                    isCurrentlyEditing ? 'bg-indigo-50/70' : 'bg-white'
                                  }`}
                                  onClick={() => handleLoadTemplateForEditing(menu)}
                                >
                                  <td className="px-4 py-4 text-center text-sm font-semibold text-slate-900">
                                    {menu.parsedMenuName || menu?.name || 'Untitled'}
                                  </td>
                                  <td className="w-[110px] max-w-[110px] px-4 py-4 text-center">
                                    <span className="inline-block max-w-[100px] truncate rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">
                                      {id}
                                    </span>
                                  </td>
                                  <td
                                    className="px-4 py-4 text-center"
                                    onClick={event => event.stopPropagation()}
                                  >
                                    <button
                                      type="button"
                                      onClick={() => setViewingCreator(menu)}
                                      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${creatorClass}`}
                                    >
                                      {creatorLabel}
                                    </button>
                                  </td>
                                  {[
                                    menu?.breakfastPlan || [],
                                    menu?.lunchPlan || [],
                                    menu?.dinnerPlan || [],
                                    menu?.snackPlan || []
                                  ].map((items, index) => (
                                    <td key={`${id}-${index}`} className="px-4 py-4 text-center">
                                      <div className="mx-auto inline-flex min-h-[42px] min-w-[42px] items-center justify-center rounded-full bg-orange-50 px-3 text-sm font-semibold text-orange-600">
                                        {items.length}
                                      </div>
                                    </td>
                                  ))}
                                  <td
                                    className="px-4 py-4"
                                    onClick={event => event.stopPropagation()}
                                  >
                                    <div className="flex items-center justify-center gap-2">
                                      <button
                                        onClick={() => handleDuplicateTemplate(menu)}
                                        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-indigo-600 transition hover:border-indigo-200 hover:bg-indigo-50"
                                        title={t('pages.menus.duplicate') || 'Duplicate menu'}
                                      >
                                        <DocumentDuplicateIcon className="h-4 w-4" />
                                      </button>
                                      <button
                                        onClick={() => handleOpenCopyModal(menu)}
                                        className="inline-flex h-10 w-12 items-center justify-center gap-0.5 rounded-full border border-slate-200 bg-white text-emerald-600 transition hover:border-emerald-200 hover:bg-emerald-50"
                                        title={t('pages.menus.copyToCountry') || 'Copy menu to country'}
                                      >
                                        <GlobeAltIcon className="h-4 w-4" />
                                        <DocumentDuplicateIcon className="h-3.5 w-3.5" />
                                      </button>
                                      <button
                                        onClick={() => handleDeleteTemplate(id)}
                                        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-rose-600 transition hover:border-rose-200 hover:bg-rose-50"
                                        title={t('pages.menus.delete') || 'Delete menu'}
                                      >
                                        <TrashIcon className="h-4 w-4" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Pagination */}
            {groupedTemplates.length > 0 && (
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
                      {groupedTemplates.length === 0
                        ? 'Showing 0 of 0 results'
                        : `Showing ${(templatesPage - 1) * templatesPerPage + 1} to ${Math.min(templatesPage * templatesPerPage, groupedTemplates.length)} of ${groupedTemplates.length} results`}
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
                  placeholder={
                    t('pages.menus.searchByNameEmailOrUserId') ||
                    'Search by name, email, or user ID...'
                  }
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
            <div className="hidden md:block relative overflow-visible rounded-3xl border border-slate-200/80 bg-white shadow-sm">
              <div className="overflow-x-auto rounded-3xl">
                <table className="min-w-full divide-y divide-slate-200/80">
                <thead className="bg-slate-50/90">
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
                <tbody className="divide-y divide-slate-100 bg-white">
                  {getCurrentUsers().map(user => {
                    const { name, email, status } = formatUserData(user)
                    const userId = user?.userId || user?.id
                    const isSelected = selectedUserId === userId
                    return (
                      <tr
                        key={userId}
                        className={`transition-colors hover:bg-slate-50 ${isSelected ? 'bg-blue-50/70' : ''}`}
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
                        {loadingUsers
                          ? t('pages.menus.loadingUsers') || 'Loading users...'
                          : t('pages.menus.noUsersFound') || 'No users found'}
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
                          ? t('pages.menus.noUsersFoundMatching', {
                              term: userSearchTerm
                            }) || `No users found matching "${userSearchTerm}"`
                          : t('pages.menus.noUsersToDisplay') ||
                            'No users to display'}
                      </td>
                    </tr>
                  )}
                </tbody>
                </table>
              </div>
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
                          const servings = it?.numberOfRecipeServings || 1
                          const adjustedCalories =
                            Number(it?.caloriesPer100) || 0
                          const adjustedNutrients = it?.nutrientsPer100 || {}

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
                      {viewingCreator?.caloriesPer100 || 0}
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

      {renderItemPreviewModal()}

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
