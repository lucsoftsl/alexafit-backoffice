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
  ArrowPathIcon,
  DocumentDuplicateIcon,
  GlobeAltIcon
} from '@heroicons/react/24/outline'
import {
  searchFoodItems,
  getItemsByIds,
  copyMenuTemplateToCountry
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
import {
  calculateDisplayValues,
  findServingByIdentifier,
  getServingIdentifier
} from '../util/menuDisplay'

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

const glassCardClass =
  'relative overflow-hidden rounded-3xl border border-white/40 bg-white/70 backdrop-blur-xl shadow-[0_20px_80px_rgba(15,23,42,0.08)]'
const glassSurfaceClass =
  'rounded-2xl border border-white/50 bg-white/60 backdrop-blur-lg shadow-[0_10px_40px_rgba(15,23,42,0.08)]'
const softBadgeClass =
  'inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-white/80 text-gray-800 shadow-inner'

const MyMenus = () => {
  const { t } = useTranslation()
  const [showBuilderModal, setShowBuilderModal] = useState(false)
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
  const [assignmentDate, setAssignmentDate] = useState(
    new Date().toISOString().split('T')[0]
  )
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
  // Copy template modal state
  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false)
  const [selectedTemplateForCopy, setSelectedTemplateForCopy] = useState(null)
  const [copyCountryCode, setCopyCountryCode] = useState('RO')
  const [copyingTemplate, setCopyingTemplate] = useState(false)
  const userData = useSelector(selectUserData)
  const { currentUser } = useAuth()

  const nutritionistId = currentUser?.uid || userData?.userId

  const loadTemplates = async () => {
    try {
      setLoadingTemplates(true)
      const data = await getAllMenuTemplatesByUser({
        createdByUserId: nutritionistId
      })
      setTemplates(
        Array.isArray(data?.data) ? data.data : data?.templates || []
      )
    } catch (e) {
      console.error('Failed to load menu templates', e)
      setError(t('pages.myMenus.failedLoadTemplates'))
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
    setMenuName('')
    setPlans(defaultPlans)
    setDisplayValues({})
    setEditingTemplateId(null)
  }

  const openBuilderForNew = () => {
    resetBuilder()
    setShowBuilderModal(true)
  }

  useEffect(() => {
    if (nutritionistId) {
      loadTemplates()
      loadClients()
    }
  }, [nutritionistId])

  const detectIsRecipe = item => {
    const type = (item?.itemType || item?.type || '').toString().toUpperCase()
    return type === 'RECIPE' || type === 'RECIPES'
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

    // Fall back to first item
    if (!selectedServing) {
      selectedServing = servingArray[0]
    }

    return selectedServing
  }

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
      setSearchResults(Array.isArray(data) ? data : [])
    } catch (e) {
      console.error('Search failed', e)
      setError(t('pages.myMenus.failedSearchFood'))
    } finally {
      setSearching(false)
    }
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
      setError(t('pages.myMenus.failedAddItem'))
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

  const handleSaveTemplate = async e => {
    e.preventDefault()
    if (!menuName.trim()) {
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

      const templateData = {
        name: menuName,
        breakfastPlan: preparePlanWithChangedServing(
          plans.breakfastPlan,
          'breakfastPlan'
        ),
        lunchPlan: preparePlanWithChangedServing(plans.lunchPlan, 'lunchPlan'),
        dinnerPlan: preparePlanWithChangedServing(
          plans.dinnerPlan,
          'dinnerPlan'
        ),
        snackPlan: preparePlanWithChangedServing(plans.snackPlan, 'snackPlan'),
        isAssignableByUser,
        createdByUserId: nutritionistId
      }

      if (editingTemplateId) {
        await updateMenuTemplateBO({
          ...templateData,
          menuTemplateId: editingTemplateId
        })
      } else {
        await addMenuTemplateBO(templateData)
      }

      setMenuName('')
      setPlans(defaultPlans)
      setDisplayValues({})
      setEditingTemplateId(null)
      setError(null)
      await loadTemplates()
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
      await deleteMenuTemplateByIdBO({
        menuTemplateId: templateId,
        createdByUserId: nutritionistId
      })
      await loadTemplates()
    } catch (e) {
      console.error('Failed to delete template', e)
      setError(t('pages.myMenus.failedDeleteTemplate'))
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

    setEditingTemplateId(id)
    setMenuName(template?.name || '')

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
                  return s.profileId === item.changedServing.servingId
                } else {
                  return (
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
            originalServingAmount = 100
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
    setShowBuilderModal(true)
  }

  const filteredTemplates = useMemo(() => {
    return templates.filter(t =>
      t?.name?.toLowerCase().includes(templateSearchTerm.toLowerCase())
    )
  }, [templates, templateSearchTerm])

  useEffect(() => {
    const newTotalPages = Math.max(
      1,
      Math.ceil(filteredTemplates.length / itemsPerPage)
    )
    if (currentPage > newTotalPages) {
      setCurrentPage(newTotalPages)
    }
  }, [filteredTemplates.length, itemsPerPage, currentPage])

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredTemplates.length / itemsPerPage)),
    [filteredTemplates.length, itemsPerPage]
  )

  const paginatedTemplates = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage
    return filteredTemplates.slice(startIndex, startIndex + itemsPerPage)
  }, [filteredTemplates, currentPage, itemsPerPage])

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
        <div className={`${glassCardClass} p-6 md:p-8 text-gray-900`}>
          <div className="absolute inset-0 bg-gradient-to-br from-white/70 via-white/30 to-white/10" />
          <div className="absolute inset-y-0 right-0 w-32 bg-gradient-to-b from-blue-500/20 to-purple-500/10 blur-3xl" />
          <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-gray-600">
                {t('pages.myMenus.menuStudio')}
              </p>
              <h1 className="mt-2 text-3xl font-bold md:text-4xl">
                {t('pages.myMenus.title')}
              </h1>
            </div>
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <button
                onClick={openBuilderForNew}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 px-5 py-3 text-sm font-semibold text-white shadow-lg transition hover:-translate-y-0.5 hover:shadow-2xl"
              >
                <PlusIcon className="h-4 w-4" />{' '}
                {t('pages.myMenus.addMenuTemplate')}
              </button>
              <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 md:w-auto">
                <div className={`${glassSurfaceClass} px-4 py-3`}>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                    {t('pages.myMenus.templates')}
                  </p>
                  <p className="text-2xl font-bold text-gray-900">
                    {templates.length}
                  </p>
                  <p className="text-xs text-gray-500">
                    {t('pages.myMenus.savedMenuBlueprints')}
                  </p>
                </div>
                <div className={`${glassSurfaceClass} px-4 py-3`}>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                    {t('pages.myMenus.clients')}
                  </p>
                  <p className="text-2xl font-bold text-gray-900">
                    {clients.length}
                  </p>
                  <p className="text-xs text-gray-500">
                    {t('pages.myMenus.assignableProfiles')}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {error && (
            <div className="rounded-2xl border border-red-200/60 bg-red-50/80 p-4 shadow-lg backdrop-blur">
              <p className="text-red-800">{error}</p>
            </div>
          )}

          {/* Menu Templates List */}

          {/* Menu Templates List */}
          <div className={`${glassCardClass} p-6 md:p-8 mt-6 text-gray-900`}>
            <div className="absolute inset-0 bg-gradient-to-br from-white/70 via-white/40 to-white/10" />
            <div className="relative">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                    {t('pages.myMenus.library')}
                  </p>
                  <h2 className="text-2xl font-semibold text-gray-900">
                    {t('pages.myMenus.menuTemplates')} (
                    {filteredTemplates.length})
                  </h2>
                </div>
                <div className="flex flex-col gap-2 w-full md:w-auto md:flex-row md:items-center">
                  <div className="relative flex-1 md:w-72">
                    <MagnifyingGlassIcon className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder={t('pages.myMenus.searchTemplates')}
                      value={templateSearchTerm}
                      onChange={e => setTemplateSearchTerm(e.target.value)}
                      className="w-full rounded-2xl border border-white/70 bg-white/90 py-3 pl-11 pr-4 text-sm text-gray-900 placeholder:text-gray-500 shadow-inner focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    />
                  </div>
                  <div className="flex items-center gap-2">
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

              {templatesExpanded && (
                <>
                  {filteredTemplates.length === 0 ? (
                    <div className="text-center py-12">
                      <p className="text-gray-600">
                        {t('pages.myMenus.noTemplates')}
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-4">
                        {paginatedTemplates.map(template => (
                          <div
                            key={template.id}
                            className={`${glassSurfaceClass} relative p-5`}
                          >
                            <div className="absolute inset-0 bg-gradient-to-br from-white/60 via-white/40 to-white/10" />
                            <div className="relative space-y-4">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <h3 className="text-lg font-semibold text-gray-900">
                                    {template?.name}
                                  </h3>
                                  <p className="text-xs text-gray-600">
                                    {t('pages.myMenus.id')}: {template?.id}
                                  </p>
                                </div>
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => {
                                      handleLoadTemplateForEditing(template)
                                    }}
                                    className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-blue-700 transition hover:bg-blue-100"
                                    title={t('pages.myMenus.edit') || 'Edit'}
                                  >
                                    <PencilIcon className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() =>
                                      handleOpenCopyModal(template)
                                    }
                                    className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 transition hover:bg-emerald-100"
                                    title={
                                      t('pages.menus.copyToCountry') ||
                                      'Copy to Country'
                                    }
                                  >
                                    <GlobeAltIcon className="w-4 h-4" />
                                    <DocumentDuplicateIcon className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() =>
                                      handleDeleteTemplate(template.id)
                                    }
                                    className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-red-50 text-red-600 transition hover:bg-red-100"
                                    title={
                                      t('pages.myMenus.delete') || 'Delete'
                                    }
                                  >
                                    <TrashIcon className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 text-xs">
                                {mealTypeOptions.map(meal => (
                                  <div
                                    key={meal.id}
                                    className="rounded-xl border border-white/60 bg-white/80 px-3 py-2 text-center font-semibold text-gray-800 shadow-inner"
                                  >
                                    <p className="text-[11px] uppercase tracking-wide text-gray-500">
                                      {meal.label}
                                    </p>
                                    <p className="text-sm text-gray-900">
                                      {template[meal.id]?.length || 0} items
                                    </p>
                                  </div>
                                ))}
                              </div>

                              <div className="rounded-xl border border-blue-200/60 bg-blue-50/70 p-4 text-sm text-gray-800">
                                <div className="mb-2 flex items-center justify-between">
                                  <p className="font-semibold text-gray-900">
                                    {t('pages.myMenus.assignedUsers')}
                                  </p>
                                  <button
                                    onClick={loadClients}
                                    disabled={loadingClients}
                                    className="inline-flex items-center justify-center rounded-full bg-white/90 p-2 text-blue-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-white"
                                    title={t(
                                      'pages.myMenus.refreshClientsList'
                                    )}
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
                                  <div className="space-y-1 max-h-44 overflow-y-auto">
                                    {clients.map(client => {
                                      const clientId = Array.isArray(
                                        client?.user?.userId
                                      )
                                        ? client.user.userId[0]
                                        : client?.user?.userId
                                      const clientName =
                                        client?.user?.userData?.name ||
                                        client?.user?.loginDetails
                                          ?.displayName ||
                                        'Unknown'
                                      const assignedUsers =
                                        template?.assignedUsers || []
                                      const assignmentInfo = assignedUsers.find(
                                        au => au.userId === clientId
                                      )

                                      if (!assignmentInfo) {
                                        return null
                                      }

                                      const menuKey = `${template.id}-${clientId}`
                                      const isExpanded =
                                        expandedClientMenus[menuKey]

                                      return (
                                        <div
                                          key={clientId}
                                          className="rounded-lg border border-white/70 bg-white/90 px-3 py-2"
                                        >
                                          <button
                                            onClick={() =>
                                              setExpandedClientMenus(prev => ({
                                                ...prev,
                                                [menuKey]: !prev[menuKey]
                                              }))
                                            }
                                            className="flex w-full items-center justify-between text-left text-sm font-semibold text-blue-900"
                                          >
                                            <div className="flex-1">
                                              <span>{clientName}</span>
                                              <span className="ml-2 text-xs text-gray-600">
                                                assigned{' '}
                                                {new Date(
                                                  assignmentInfo.dateApplied
                                                ).toLocaleDateString()}
                                              </span>
                                            </div>
                                            {isExpanded ? (
                                              <ChevronUpIcon className="h-4 w-4" />
                                            ) : (
                                              <ChevronDownIcon className="h-4 w-4" />
                                            )}
                                          </button>
                                          {isExpanded && (
                                            <div className="mt-2 space-y-2 text-xs text-gray-700">
                                              <p>
                                                {t('pages.myMenus.userId')}:{' '}
                                                {clientId}
                                              </p>
                                              <p>
                                                {t(
                                                  'pages.myMenus.assignedDate'
                                                )}
                                                :{' '}
                                                {new Date(
                                                  assignmentInfo.dateApplied
                                                ).toLocaleDateString()}
                                              </p>
                                              <button
                                                onClick={() =>
                                                  handleUnassignMenu(
                                                    template.id,
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

                              <div className="flex flex-col gap-2 border-t border-white/60 pt-3 sm:flex-row sm:items-center">
                                <select
                                  value={selectedClientId || ''}
                                  onChange={e =>
                                    setSelectedClientId(e.target.value)
                                  }
                                  className="w-full rounded-xl border border-white/70 bg-white/90 px-3 py-2 text-sm font-medium text-gray-800 shadow-inner focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200 sm:w-auto sm:flex-1"
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
                                    const clientId = Array.isArray(
                                      client?.user?.userId
                                    )
                                      ? client.user.userId[0]
                                      : client?.user?.userId
                                    return (
                                      <option key={clientId} value={clientId}>
                                        {clientName}
                                      </option>
                                    )
                                  })}
                                </select>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="date"
                                    value={assignmentDate}
                                    onChange={e =>
                                      setAssignmentDate(e.target.value)
                                    }
                                    className="w-36 rounded-xl border border-white/70 bg-white/90 px-3 py-2 text-sm font-medium text-gray-800 shadow-inner focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
                                  />
                                  <button
                                    onClick={() =>
                                      handleAssignMenu(template.id)
                                    }
                                    disabled={
                                      assigningMenu || !selectedClientId
                                    }
                                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 px-4 py-2 text-sm font-semibold text-white shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl disabled:opacity-60"
                                  >
                                    {assigningMenu
                                      ? t('pages.myMenus.assigning')
                                      : t('pages.myMenus.assign')}
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
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
                            {filteredTemplates.length === 0
                              ? 0
                              : (currentPage - 1) * itemsPerPage + 1}{' '}
                            -{' '}
                            {Math.min(
                              currentPage * itemsPerPage,
                              filteredTemplates.length
                            )}{' '}
                            {t('pages.myMenus.of')} {filteredTemplates.length}
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
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                        {t('pages.myMenus.menuBuilder')}
                      </p>
                      <h2 className="text-3xl font-bold text-gray-900">
                        {editingTemplateId
                          ? t('pages.myMenus.editMenuTemplate')
                          : t('pages.myMenus.createMenuTemplate')}
                      </h2>
                      <p className="mt-2 text-sm text-gray-600">
                        {t('pages.myMenus.curateMeals')}
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
                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600 mb-2">
                            {t('pages.myMenus.menuName')}
                          </label>
                          <input
                            type="text"
                            value={menuName}
                            onChange={e => setMenuName(e.target.value)}
                            className="w-full rounded-xl border border-white/60 bg-white/80 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-500 shadow-inner focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
                            placeholder={t('pages.myMenus.menuNamePlaceholder')}
                          />
                        </div>

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

                    {/* Search for items */}
                    <form onSubmit={handleSearch} className="space-y-3">
                      <div className="flex flex-col gap-3 md:flex-row md:items-center">
                        <div className="relative flex-1">
                          <MagnifyingGlassIcon className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                          <input
                            type="text"
                            value={searchText}
                            onChange={e => setSearchText(e.target.value)}
                            placeholder={t('pages.myMenus.searchFoodsRecipes')}
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

                    {/* Search results */}
                    {searchResults.length > 0 && (
                      <div className="max-h-64 overflow-y-auto rounded-2xl border border-white/70 bg-white/80 backdrop-blur divide-y divide-white/70">
                        {searchResults.map((item, idx) => {
                          const isRecipeItem = detectIsRecipe(item)
                          const selectedServing = findDefaultServing(
                            item?.serving
                          )
                          const servingAmount = selectedServing?.amount || 0
                          const numberOfServings = isRecipeItem
                            ? item?.numberOfServings ||
                              item?.originalServings ||
                              1
                            : 1
                          const newAmount = isRecipeItem
                            ? servingAmount * numberOfServings
                            : servingAmount

                          return (
                            <div
                              key={idx}
                              className="flex items-center justify-between px-4 py-3 transition hover:bg-white"
                            >
                              <div className="min-w-0">
                                <div className="text-sm font-semibold text-gray-900 truncate">
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
                                type="button"
                                onClick={() => addItemToPlan(item)}
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
                            item?.serving && Array.isArray(item.serving)
                              ? item.serving
                              : []
                          const hasServings = servingOptions.length > 0

                          const currentServingAmount =
                            displayValue?.servingAmount !== undefined
                              ? displayValue.servingAmount
                              : item?.originalServingAmount || 100
                          const currentServingId =
                            displayValue?.selectedServingId ||
                            item?.originalServingId ||
                            null

                          let originalServingAmount =
                            item?.originalServingAmount
                          if (
                            !originalServingAmount &&
                            servingOptions.length > 0
                          ) {
                            if (isRecipeItem) {
                              const portionServing = servingOptions.find(
                                s => s.profileId === 1
                              )
                              if (portionServing) {
                                const numberOfServings =
                                  item?.numberOfServings ||
                                  item?.originalServings ||
                                  1
                                originalServingAmount =
                                  portionServing.amount * numberOfServings
                              } else {
                                const totalWeight =
                                  item?.totalNutrients?.totalQuantity ||
                                  item?.totalNutrients?.weightAfterCooking ||
                                  null
                                if (totalWeight) {
                                  originalServingAmount = totalWeight
                                } else {
                                  const defaultServing =
                                    findDefaultServing(servingOptions)
                                  const numberOfServings =
                                    item?.numberOfServings ||
                                    item?.originalServings ||
                                    1
                                  originalServingAmount =
                                    (defaultServing?.amount || 100) *
                                    numberOfServings
                                }
                              }
                            } else {
                              const defaultServing =
                                findDefaultServing(servingOptions)
                              originalServingAmount =
                                defaultServing?.amount || 100
                            }
                          }
                          originalServingAmount = originalServingAmount || 100

                          const servingAmountForCalc =
                            currentServingAmount === '' ||
                            currentServingAmount === undefined
                              ? originalServingAmount
                              : currentServingAmount
                          const calculated = calculateDisplayValues(
                            item,
                            servingAmountForCalc,
                            originalServingAmount
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
                                <button
                                  onClick={() =>
                                    removeItemFromPlan(activeMealType, idx)
                                  }
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-red-50 text-red-600 transition hover:bg-red-100"
                                >
                                  <TrashIcon className="h-4 w-4" />
                                </button>
                              </div>

                              {hasServings && (
                                <div className="mt-3 flex flex-col gap-2 md:flex-row md:items-center">
                                  <label className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                                    {t('pages.myMenus.serving')}
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
                                          selectedServing?.amount || 0

                                        setDisplayValues(prev => ({
                                          ...prev,
                                          [itemKey]: {
                                            selectedServingId:
                                              selectedIdentifier,
                                            servingAmount:
                                              servingAmount ||
                                              currentServingAmount
                                          }
                                        }))
                                      }}
                                      className="w-full rounded-xl border border-white/80 bg-white/90 px-3 py-2 text-xs font-medium text-gray-800 shadow-inner focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200 md:w-48"
                                    >
                                      {servingOptions.map((serving, sIdx) => {
                                        const servingId =
                                          getServingIdentifier(serving)
                                        return (
                                          <option
                                            key={servingId || sIdx}
                                            value={servingId}
                                          >
                                            {serving.name || serving.innerName}
                                          </option>
                                        )
                                      })}
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
                                            const originalServingAmountValue =
                                              item?.originalServingAmount || 100
                                            setDisplayValues(prev => ({
                                              ...prev,
                                              [itemKey]: {
                                                selectedServingId:
                                                  currentServingId,
                                                servingAmount:
                                                  originalServingAmountValue
                                              }
                                            }))
                                          }
                                        }}
                                        className="w-24 rounded-xl border border-white/80 bg-white/90 px-3 py-2 text-xs font-semibold text-gray-900 shadow-inner focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
                                        placeholder={t('pages.myMenus.amount')}
                                      />
                                      <span className="text-xs font-medium text-gray-600">
                                        {findServingByIdentifier(
                                          servingOptions,
                                          currentServingId
                                        )?.unit || 'g'}
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
                                  {item?.numberOfServings ||
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
                                  {Math.round(
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
                                  {Math.round(
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
                                  {Math.round(
                                    Number(adjustedNutrients?.fatInGrams) || 0
                                  )}{' '}
                                  g
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}

                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                      <button
                        onClick={handleSaveTemplate}
                        disabled={submitting || !menuName.trim()}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-3 text-sm font-semibold text-white shadow-xl transition hover:-translate-y-0.5 hover:shadow-2xl disabled:opacity-60 sm:w-auto"
                      >
                        {submitting
                          ? t('pages.myMenus.saving')
                          : editingTemplateId
                            ? t('pages.myMenus.updateMenu')
                            : t('pages.myMenus.createMenu')}
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

        {/* Copy Template Modal */}
        {isCopyModalOpen && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className={`${glassCardClass} max-w-md w-full p-6`}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-900">
                  {t('pages.menus.copyTemplate.title') || 'Copy Menu Template'}
                </h3>
                <button
                  onClick={() => {
                    setIsCopyModalOpen(false)
                    setSelectedTemplateForCopy(null)
                    setCopyCountryCode('RO')
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('pages.menus.copyTemplate.templateName') ||
                      'Template Name'}
                  </label>
                  <div className="p-3 bg-white/40 border border-white/30 rounded-md text-gray-900">
                    {selectedTemplateForCopy?.name || 'Untitled'}
                  </div>
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
                  className="flex-1 px-4 py-2 border border-white/30 bg-white/40 backdrop-blur-sm rounded-md text-gray-800 hover:bg-white/60"
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
    </div>
  )
}

export default MyMenus
