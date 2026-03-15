import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import LZString from 'lz-string'
import {
  MagnifyingGlassIcon,
  PlusIcon,
  XMarkIcon,
  PhotoIcon,
  PencilIcon,
  TrashIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  GlobeAltIcon,
  CheckBadgeIcon,
  DocumentTextIcon,
  ChevronUpDownIcon
} from '@heroicons/react/24/outline'
import {
  addNutritionistFoodItem,
  deleteNutritionistFoodItem,
  getNutritionistFoodItemsByCountryCode,
  saveImageToImgb,
  updateNutritionistFoodItem
} from '../services/api'
import { getImagePreviewDataUrl, resizeImageFile } from '../util/resizeImageFile'
import { getCategoryIcon } from '../util/categoryIcons'
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

const FOOD_CATEGORY_OPTIONS = [
  'fruits',
  'vegetables',
  'bread',
  'general',
  'sugar',
  'meat',
  'dairy',
  'cheese',
  'grains',
  'nuts',
  'fish',
  'fastfood',
  'beverages',
  'sweets',
  'fats',
  'sauces',
  'legumes',
  'snack',
  'alcohol',
  'condiments',
  'eggs'
]

const formatCategoryLabel = value =>
  String(value || '')
    .split(/[_-]/g)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')

const DEFAULT_SERVING_OPTIONS = [
  { unitName: 'g', value: 100 },
  { unitName: 'oz', value: 28.34 },
  { unitName: 'ml', value: 100 },
  { unitName: 'fl oz', value: 29.57 }
]

const OZ_TO_GRAMS = 28.34
const FL_OZ_TO_ML = 29.57
const LIQUID_UNITS = ['ml', 'fl oz']
const SOLID_UNITS = ['g', 'oz']

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
    } catch {
      return []
    }
  }
  return []
}

const getAmountInBaseUnit = (quantity, unit, isLiquid) => {
  const qty = parseNumber(quantity)
  const normalizedUnit = (unit || 'g').toLowerCase().trim()

  if (normalizedUnit === 'g' || normalizedUnit === 'gram' || normalizedUnit === 'grams') return qty
  if (normalizedUnit === 'kg') return qty * 1000
  if (normalizedUnit === 'oz') return qty * OZ_TO_GRAMS
  if (normalizedUnit === 'ml' || normalizedUnit === 'milliliter' || normalizedUnit === 'millilitre') return qty
  if (normalizedUnit === 'fl oz') return qty * FL_OZ_TO_ML
  if (normalizedUnit === 'l') return qty * 1000

  const defaultOption = DEFAULT_SERVING_OPTIONS.find(option =>
    isLiquid
      ? option.unitName === 'ml' || option.unitName === 'fl oz'
      : option.unitName === 'g' || option.unitName === 'oz'
  )
  return qty * parseNumber(defaultOption?.value || 1)
}

const convertBaseAmountToUnit = (baseAmount, unit) => {
  const normalizedUnit = (unit || 'g').toLowerCase().trim()
  const amount = parseNumber(baseAmount)
  if (normalizedUnit === 'g' || normalizedUnit === 'gram' || normalizedUnit === 'grams') return amount
  if (normalizedUnit === 'kg') return amount / 1000
  if (normalizedUnit === 'oz') return amount / OZ_TO_GRAMS
  if (normalizedUnit === 'ml' || normalizedUnit === 'milliliter' || normalizedUnit === 'millilitre') return amount
  if (normalizedUnit === 'fl oz') return amount / FL_OZ_TO_ML
  if (normalizedUnit === 'l') return amount / 1000
  return amount
}

const defaultServingValue = unit =>
  unit === 'g' || unit === 'ml' ? '100' : '1'

const getAllowedUnits = isLiquidValue =>
  isLiquidValue ? LIQUID_UNITS : SOLID_UNITS

const getFoodItemsCacheKey = countryCode => `foodItems_nutritionist_${countryCode}`

const FoodItems = () => {
  const { t } = useTranslation()
  const [sharedCountry, setSharedCountry] = useSelectedCountry()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterCountryCode, setFilterCountryCode] = useState(sharedCountry)
  const [sortColumn, setSortColumn] = useState(null)
  const [sortDirection, setSortDirection] = useState('asc')
  const [selectedImage, setSelectedImage] = useState(null)
  const [isImageModalOpen, setIsImageModalOpen] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingItemId, setEditingItemId] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const [name, setName] = useState('')
  const [brand, setBrand] = useState('')
  const [barcode, setBarcode] = useState('')
  const [category, setCategory] = useState('')
  const [selectedCountryCode, setSelectedCountryCode] = useState(sharedCountry)
  const [selectedUnit, setSelectedUnit] = useState('g')
  const [isLiquid, setIsLiquid] = useState(false)
  const [servingName, setServingName] = useState('')
  const [servingValue, setServingValue] = useState('100')
  const [isPublic, setIsPublic] = useState(true)
  const [calories, setCalories] = useState('')
  const [protein, setProtein] = useState('')
  const [carbs, setCarbs] = useState('')
  const [fat, setFat] = useState('')
  const [sugar, setSugar] = useState('')
  const [fiber, setFiber] = useState('')
  const [salt, setSalt] = useState('')
  const [saturatedFat, setSaturatedFat] = useState('')
  const [unsaturatedFat, setUnsaturatedFat] = useState('')
  const [photoPreview, setPhotoPreview] = useState(null)
  const [selectedPhoto, setSelectedPhoto] = useState(null)
  const [existingPhotoUrl, setExistingPhotoUrl] = useState(null)
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false)
  const categoryDropdownRef = useRef(null)

  const pageTitle = t('sidebar.foodItems')

  const writeItemsCache = (countryCode, nextItems) => {
    try {
      const compressed = LZString.compressToUTF16(JSON.stringify({ items: nextItems || [] }))
      localStorage.setItem(getFoodItemsCacheKey(countryCode), compressed)
    } catch (cacheError) {
      console.error('Failed to write food items cache', cacheError)
    }
  }

  const clearItemsCache = countryCode => {
    try {
      localStorage.removeItem(getFoodItemsCacheKey(countryCode))
    } catch (cacheError) {
      console.error('Failed to clear food items cache', cacheError)
    }
  }

  const resetForm = () => {
    setEditingItemId(null)
    setName('')
    setBrand('')
    setBarcode('')
    setCategory('')
    setSelectedCountryCode(sharedCountry)
    setSelectedUnit('g')
    setIsLiquid(false)
    setServingName('')
    setServingValue('100')
    setIsPublic(true)
    setCalories('')
    setProtein('')
    setCarbs('')
    setFat('')
    setSugar('')
    setFiber('')
    setSalt('')
    setSaturatedFat('')
    setUnsaturatedFat('')
    setPhotoPreview(null)
    setSelectedPhoto(null)
    setExistingPhotoUrl(null)
    setError(null)
  }

  const refreshData = async () => {
    setLoading(true)
    setError(null)
    clearItemsCache(filterCountryCode)
    try {
      const response = await getNutritionistFoodItemsByCountryCode({
        countryCode: filterCountryCode
      })
      const nextItems = response || []
      setItems(nextItems)
      writeItemsCache(filterCountryCode, nextItems)
    } catch (fetchError) {
      console.error('Failed to load food items', fetchError)
      setError(t('pages.foodItems.loadFail'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const loadFoodItems = async () => {
      try {
        setLoading(true)
        setError(null)
        const cacheKey = getFoodItemsCacheKey(filterCountryCode)
        const cachedData =
          LZString.decompressFromUTF16(localStorage.getItem(cacheKey)) ||
          localStorage.getItem(cacheKey)

        if (cachedData) {
          const data = JSON.parse(cachedData)
          setItems(data.items || [])
          setLoading(false)
          return
        }

        await refreshData()
      } catch (loadError) {
        console.error('Error loading food items:', loadError)
        setError(t('pages.foodItems.loadFail'))
        setLoading(false)
      }
    }

    loadFoodItems()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterCountryCode])

  useEffect(() => {
    setFilterCountryCode(sharedCountry)
    setSelectedCountryCode(sharedCountry)
  }, [sharedCountry])

  useEffect(() => {
    if (!isCategoryDropdownOpen) return undefined

    const handleOutsideClick = event => {
      if (!categoryDropdownRef.current?.contains(event.target)) {
        setIsCategoryDropdownOpen(false)
      }
    }

    document.addEventListener('mousedown', handleOutsideClick)
    document.addEventListener('touchstart', handleOutsideClick)

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
      document.removeEventListener('touchstart', handleOutsideClick)
    }
  }, [isCategoryDropdownOpen])

  useEffect(() => {
    const allowedUnits = getAllowedUnits(isLiquid)
    if (!allowedUnits.includes(selectedUnit)) {
      const nextUnit = allowedUnits[0]
      const baseAmount = getAmountInBaseUnit(servingValue, selectedUnit, isLiquid)
      setSelectedUnit(nextUnit)
      setServingValue(String(Number(convertBaseAmountToUnit(baseAmount, nextUnit).toFixed(2))))
    }
  }, [isLiquid, selectedUnit, servingValue])

  const filteredItems = useMemo(() => {
    let nextItems = [...items]
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase()
      nextItems = nextItems.filter(item =>
        [item?.name, item?.brand, item?.category, item?.barcode]
          .map(value => String(value || '').toLowerCase())
          .some(value => value.includes(q))
      )
    }

    if (sortColumn) {
      const factor = sortDirection === 'asc' ? 1 : -1
      nextItems.sort((a, b) => {
        let aValue = ''
        let bValue = ''
        switch (sortColumn) {
          case 'name':
            aValue = String(a?.name || '').toLowerCase()
            bValue = String(b?.name || '').toLowerCase()
            return aValue.localeCompare(bValue) * factor
          case 'brand':
            aValue = String(a?.brand || '').toLowerCase()
            bValue = String(b?.brand || '').toLowerCase()
            return aValue.localeCompare(bValue) * factor
          case 'country':
            aValue = String(a?.countryCode || '').toLowerCase()
            bValue = String(b?.countryCode || '').toLowerCase()
            return aValue.localeCompare(bValue) * factor
          case 'calories':
            return (parseNumber(a?.caloriesPer100) - parseNumber(b?.caloriesPer100)) * factor
          case 'updated':
            return (
              (a?.dateTimeUpdated ? new Date(a.dateTimeUpdated).getTime() : 0) -
              (b?.dateTimeUpdated ? new Date(b.dateTimeUpdated).getTime() : 0)
            ) * factor
          default:
            return 0
        }
      })
    }
    return nextItems
  }, [items, searchTerm, sortColumn, sortDirection])

  const stats = useMemo(
    () => [
      {
        title: t('pages.foodItems.totalItems'),
        value: items.length,
        icon: DocumentTextIcon,
        iconClass: 'bg-rose-50 text-rose-600'
      },
      {
        title: t('pages.recipes.publicLabel'),
        value: items.filter(item => Boolean(item?.isPublic)).length,
        icon: GlobeAltIcon,
        iconClass: 'bg-violet-50 text-violet-600'
      },
      {
        title: t('pages.recipes.unverified'),
        value: items.filter(item => !Boolean(item?.isVerified)).length,
        icon: CheckBadgeIcon,
        iconClass: 'bg-amber-50 text-amber-600'
      },
      {
        title: t('pages.recipes.country'),
        value: [...new Set(items.map(item => item?.countryCode).filter(Boolean))].length,
        icon: DocumentTextIcon,
        iconClass: 'bg-blue-50 text-blue-600'
      }
    ],
    [items, t]
  )

  const displayTotals = useMemo(() => ({
    calories: parseNumber(calories),
    protein: parseNumber(protein),
    carbs: parseNumber(carbs),
    fat: parseNumber(fat)
  }), [calories, protein, carbs, fat])

  const availableUnitOptions = useMemo(
    () => getAllowedUnits(isLiquid),
    [isLiquid]
  )

  const openCreate = () => {
    resetForm()
    setIsModalOpen(true)
  }

  const handleEdit = item => {
    resetForm()
    setEditingItemId(item.id)
    setName(item.name || '')
    setBrand(item.brand || '')
    setBarcode(item.barcode || '')
    setCategory(item.category || '')
    setSelectedCountryCode(item.countryCode || sharedCountry)
    setIsPublic(Boolean(item.isPublic))
    setExistingPhotoUrl(item.brandPhotoUrl || item.photoUrl || null)
    setPhotoPreview(item.brandPhotoUrl || item.photoUrl || null)
    setIsCategoryDropdownOpen(false)

    const nextUnit = item.selectedUnit || (item.isLiquid ? 'ml' : 'g')
    setSelectedUnit(nextUnit)
    setIsLiquid(Boolean(item.isLiquid))

    const servingOptions = parseServingOptions(item.servingOptions)
    const servingOption = servingOptions[0]
    if (servingOption) {
      const baseAmount = parseNumber(servingOption.value || 100)
      const displayValue = convertBaseAmountToUnit(baseAmount, nextUnit)
      const multiplier = baseAmount / 100
      setServingName(servingOption.unitName === 'serving' ? '' : servingOption.unitName || '')
      setServingValue(String(Number(displayValue.toFixed(2))))
      setCalories(String(Number((parseNumber(item.caloriesPer100) * multiplier).toFixed(2))))
      const nutrients = item.nutrientsPer100 || {}
      setProtein(String(Number((parseNumber(nutrients.proteinsInGrams) * multiplier).toFixed(2))))
      setCarbs(String(Number((parseNumber(nutrients.carbohydratesInGrams) * multiplier).toFixed(2))))
      setFat(String(Number((parseNumber(nutrients.fatInGrams) * multiplier).toFixed(2))))
      setSugar(String(Number((parseNumber(nutrients.sugarsInGrams) * multiplier).toFixed(2))))
      setFiber(String(Number((parseNumber(nutrients.fibreInGrams) * multiplier).toFixed(2))))
      setSalt(String(Number((parseNumber(nutrients.saltInGrams) * multiplier).toFixed(2))))
      setSaturatedFat(String(Number((parseNumber(nutrients.fattyAcidsTotalSaturatedInGrams) * multiplier).toFixed(2))))
      setUnsaturatedFat(String(Number((parseNumber(nutrients.fattyAcidsTotalUnSaturatedInGrams) * multiplier).toFixed(2))))
    } else {
      setServingValue(defaultServingValue(nextUnit))
      const nutrients = item.nutrientsPer100 || {}
      setCalories(String(parseNumber(item.caloriesPer100)))
      setProtein(String(parseNumber(nutrients.proteinsInGrams)))
      setCarbs(String(parseNumber(nutrients.carbohydratesInGrams)))
      setFat(String(parseNumber(nutrients.fatInGrams)))
      setSugar(String(parseNumber(nutrients.sugarsInGrams)))
      setFiber(String(parseNumber(nutrients.fibreInGrams)))
      setSalt(String(parseNumber(nutrients.saltInGrams)))
      setSaturatedFat(String(parseNumber(nutrients.fattyAcidsTotalSaturatedInGrams)))
      setUnsaturatedFat(String(parseNumber(nutrients.fattyAcidsTotalUnSaturatedInGrams)))
    }

    setIsModalOpen(true)
  }

  const handleDelete = async item => {
    if (!confirm(t('pages.foodItems.confirmDeleteWithName', { name: item?.name || '' }))) {
      return
    }
    try {
      setDeleting(true)
      await deleteNutritionistFoodItem({ itemId: item.id })
      clearItemsCache(filterCountryCode)
      await refreshData()
    } catch (deleteError) {
      console.error('Failed deleting food item', deleteError)
      alert(t('pages.foodItems.deleteFail'))
    } finally {
      setDeleting(false)
    }
  }

  const handlePhotoSelect = async event => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const resizedFile = await resizeImageFile(file, {
        maxWidth: 300,
        maxHeight: 400
      })
      setSelectedPhoto(resizedFile)
      setPhotoPreview(await getImagePreviewDataUrl(resizedFile))
    } catch (photoError) {
      console.error('Failed to prepare food photo', photoError)
    } finally {
      event.target.value = ''
    }
  }

  const handleUnitChange = unit => {
    const baseAmount = getAmountInBaseUnit(servingValue, selectedUnit, isLiquid)
    const nextIsLiquid = unit === 'ml' || unit === 'fl oz'
    setSelectedUnit(unit)
    setIsLiquid(nextIsLiquid)
    const converted = convertBaseAmountToUnit(baseAmount, unit)
    setServingValue(String(Number(converted.toFixed(2))))
  }

  const handleSubmit = async () => {
    if (!name.trim() || !calories || !protein || !carbs || !fat) {
      alert(t('pages.foodItems.requiredFields'))
      return
    }

    try {
      setSubmitting(true)
      let photoUrl = existingPhotoUrl
      if (selectedPhoto) {
        setUploadingPhoto(true)
        const photoResult = await saveImageToImgb(selectedPhoto)
        photoUrl = photoResult?.url
          ? photoResult.url
          : photoResult?.id
            ? `https://i.ibb.co/${photoResult.id}/${photoResult.id}.jpg`
            : existingPhotoUrl
      }

      const baseAmount = getAmountInBaseUnit(servingValue, selectedUnit, isLiquid) || 100
      const toPer100 = 100 / baseAmount
      const hasCustomServing =
        servingName.trim() !== '' ||
        ((selectedUnit === 'g' || selectedUnit === 'ml')
          ? parseNumber(servingValue) !== 100
          : parseNumber(servingValue) !== 1)
      const servingOptions = hasCustomServing
        ? [{ unitName: servingName.trim() || 'serving', value: baseAmount }]
        : []

      const data = {
        type: 'food',
        name: name.trim(),
        category: category || null,
        barcode: barcode || null,
        brand: brand || null,
        brandPhotoUrl: photoUrl || '',
        caloriesPer100: parseNumber(calories) * toPer100,
        nutrientsPer100: {
          proteinsInGrams: parseNumber(protein) * toPer100,
          carbohydratesInGrams: parseNumber(carbs) * toPer100,
          fatInGrams: parseNumber(fat) * toPer100,
          sugarsInGrams: parseNumber(sugar) * toPer100,
          fibreInGrams: parseNumber(fiber) * toPer100,
          saltInGrams: parseNumber(salt) * toPer100,
          fattyAcidsTotalSaturatedInGrams: parseNumber(saturatedFat) * toPer100,
          fattyAcidsTotalUnSaturatedInGrams: parseNumber(unsaturatedFat) * toPer100
        },
        servingOptions,
        selectedUnit,
        isLiquid,
        isPublic,
        isVerified: false,
        countryCode: selectedCountryCode
      }

      if (editingItemId) {
        await updateNutritionistFoodItem({ itemId: editingItemId, data })
      } else {
        await addNutritionistFoodItem({ data })
      }

      setIsModalOpen(false)
      resetForm()
      clearItemsCache(filterCountryCode)
      await refreshData()
    } catch (submitError) {
      console.error('Failed saving food item', submitError)
      alert(editingItemId ? t('pages.foodItems.updateFail') : t('pages.foodItems.createFail'))
    } finally {
      setSubmitting(false)
      setUploadingPhoto(false)
    }
  }

  const handleSort = column => {
    if (sortColumn === column) {
      setSortDirection(current => (current === 'asc' ? 'desc' : 'asc'))
      return
    }
    setSortColumn(column)
    setSortDirection('asc')
  }

  const renderSortHeader = (column, label) => (
    <button
      type="button"
      onClick={() => handleSort(column)}
      className="inline-flex items-center gap-1 font-semibold text-slate-500"
    >
      <span>{label}</span>
      {sortColumn === column
        ? sortDirection === 'asc'
          ? <ChevronUpIcon className="h-4 w-4" />
          : <ChevronDownIcon className="h-4 w-4" />
        : null}
    </button>
  )

  if (loading) {
    return <div className="flex h-64 items-center justify-center text-gray-600">{t('pages.foodItems.loading')}</div>
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-white/40 bg-white/75 p-6 shadow-[0_20px_80px_rgba(15,23,42,0.08)] backdrop-blur-xl sm:p-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{pageTitle}</h1>
            <p className="mt-2 text-gray-600">{t('pages.foodItems.manageFoodItems')}</p>
          </div>
          <div className="flex flex-col items-end gap-2 self-stretch sm:self-auto">
            <div className="flex items-center justify-end gap-2 self-end">
              <label className="text-sm text-gray-700 whitespace-nowrap">
                {t('pages.recipes.country')}:
              </label>
              <select
                value={filterCountryCode}
                onChange={event => {
                  const nextCountry = setSharedCountry(event.target.value)
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
                {t('pages.recipes.refreshData')}
              </button>
              <button
                onClick={openCreate}
                className="inline-flex items-center rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:shadow-xl"
              >
                <PlusIcon className="mr-2 h-4 w-4" />
                {t('pages.foodItems.create')}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.map(stat => {
          const Icon = stat.icon
          return (
            <div key={stat.title} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
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
            </div>
          )
        })}
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={event => setSearchTerm(event.target.value)}
            placeholder={t('pages.foodItems.searchByName')}
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm text-slate-900 outline-none transition focus:border-violet-400 focus:bg-white"
          />
        </div>
      </div>

      <div className="relative overflow-visible rounded-3xl border border-slate-200 bg-white shadow-sm">
        {error ? (
          <div className="p-6 text-sm text-red-700">{error}</div>
        ) : null}
        <div className="hidden md:block">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">{t('pages.recipes.photo')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">{renderSortHeader('name', t('pages.recipes.name'))}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">{renderSortHeader('brand', t('pages.foodItems.brand'))}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">{t('pages.foodItems.category')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">{renderSortHeader('country', t('pages.recipes.country'))}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">{renderSortHeader('calories', t('pages.recipes.caloriesHeader'))}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">{t('pages.recipes.publicLabel')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">{t('pages.recipes.verifiedLabel')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">{renderSortHeader('updated', t('pages.recipes.updated'))}</th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">{t('pages.recipes.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {filteredItems.map(item => (
                  <tr
                    key={item.id}
                    onClick={() => handleEdit(item)}
                    className="cursor-pointer transition-colors hover:bg-violet-50/40"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      {item.brandPhotoUrl || item.photoUrl ? (
                        <button
                          onClick={event => {
                            event.stopPropagation()
                            setSelectedImage(item.brandPhotoUrl || item.photoUrl)
                            setIsImageModalOpen(true)
                          }}
                          className="overflow-hidden rounded-2xl border border-slate-200 shadow-sm"
                        >
                          <img
                            src={item.brandPhotoUrl || item.photoUrl}
                            alt={item.name || '-'}
                            className="h-14 w-14 object-cover"
                          />
                        </button>
                      ) : (
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                          <PhotoIcon className="h-6 w-6" />
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{item.name || '-'}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{item.brand || '-'}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{item.category || '-'}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{item.countryCode || '-'}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {item.caloriesPer100 || item.caloriesPer100 === 0
                        ? `${item.caloriesPer100} cal/100g`
                        : '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <span className={`rounded-full px-2 py-1 text-xs font-medium ${item.isPublic ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                        {item.isPublic ? t('pages.recipes.yes') : t('pages.recipes.no')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <span className={`rounded-full px-2 py-1 text-xs font-medium ${item.isVerified ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {item.isVerified ? t('pages.recipes.yes') : t('pages.recipes.no')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {item.dateTimeUpdated ? new Date(item.dateTimeUpdated).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={event => {
                            event.stopPropagation()
                            handleDelete(item)
                          }}
                          disabled={deleting}
                          className="inline-flex items-center rounded-full border border-rose-200 bg-rose-50 p-2 text-rose-700 transition hover:bg-rose-100 disabled:opacity-50"
                          title={t('pages.recipes.deleteRecipe')}
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
        </div>

        <div className="space-y-4 p-4 md:hidden">
          {filteredItems.map(item => (
            <div
              key={item.id}
              onClick={() => handleEdit(item)}
              className="cursor-pointer rounded-2xl border border-slate-200 p-4 shadow-sm transition hover:border-violet-200 hover:bg-violet-50/30"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-base font-semibold text-slate-900">{item.name || '-'}</div>
                  <div className="mt-1 text-sm text-slate-500">{item.brand || '-'}</div>
                  <div className="mt-1 text-sm text-slate-500">{item.caloriesPer100 || 0} cal/100g</div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={event => {
                      event.stopPropagation()
                      handleDelete(item)
                    }}
                    className="text-rose-600"
                  >
                    <TrashIcon className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {isModalOpen ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 px-4 py-6">
          <div className="mx-auto w-full max-w-6xl rounded-[32px] border border-slate-200 bg-[#fcfbff] p-6 shadow-2xl md:p-8">
            <div className="flex flex-col gap-4 border-b border-slate-200 pb-6 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">
                  {pageTitle}
                </p>
                <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
                  {editingItemId ? t('pages.foodItems.edit') : t('pages.foodItems.create')}
                </h2>
              </div>
              <div className="flex items-center gap-3 self-start">
                <button
                  onClick={() => {
                    resetForm()
                    setIsModalOpen(false)
                  }}
                  className="rounded-2xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                >
                  {t('pages.recipes.cancel')}
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:shadow-xl disabled:opacity-50"
                >
                  {submitting ? t('pages.foodItems.saving') : t('pages.foodItems.save')}
                </button>
                <button
                  onClick={() => {
                    resetForm()
                    setIsModalOpen(false)
                  }}
                  className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>
            </div>

            <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_360px]">
              <div className="space-y-6">
                <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="mb-3 flex items-center gap-2">
                    <PhotoIcon className="h-5 w-5 text-violet-500" />
                    <h3 className="text-lg font-semibold text-slate-950">
                      {t('pages.foodItems.photo')}
                    </h3>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoSelect}
                    className="hidden"
                    id="food-photo-upload"
                  />
                  <label
                    htmlFor="food-photo-upload"
                    className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm font-semibold text-violet-700 transition hover:bg-violet-100"
                  >
                    <PhotoIcon className="h-5 w-5" />
                    {selectedPhoto || photoPreview || existingPhotoUrl
                      ? t('pages.recipes.change')
                      : t('pages.foodItems.uploadPhoto')}
                  </label>
                  {photoPreview ? (
                    <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
                      <img src={photoPreview} alt={name || '-'} className="h-52 w-full bg-white object-contain" />
                    </div>
                  ) : null}
                </div>

                <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="mb-5 flex items-center gap-2">
                    <DocumentTextIcon className="h-5 w-5 text-violet-500" />
                    <h3 className="text-lg font-semibold text-slate-950">
                      {t('pages.foodItems.foodInformation')}
                    </h3>
                  </div>

                  <div className="space-y-5">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <input value={name} onChange={e => setName(e.target.value)} placeholder={t('pages.foodItems.name')} className="h-12 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-violet-300" />
                      <input value={brand} onChange={e => setBrand(e.target.value)} placeholder={t('pages.foodItems.brand')} className="h-12 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-violet-300" />
                      <input value={barcode} onChange={e => setBarcode(e.target.value)} placeholder={t('pages.foodItems.barcode')} className="h-12 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-violet-300" />
                      <div className="relative" ref={categoryDropdownRef}>
                        <button
                          type="button"
                          onClick={() => setIsCategoryDropdownOpen(current => !current)}
                          className="flex h-12 w-full items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 outline-none transition hover:border-violet-300 focus:border-violet-300"
                        >
                          <span className="flex min-w-0 items-center gap-3">
                            {category ? (
                                <img
                                src={getCategoryIcon(category)}
                                alt={formatCategoryLabel(category)}
                                className="h-6 w-6 shrink-0 object-contain"
                              />
                            ) : null}
                            <span className={category ? 'truncate' : 'truncate text-slate-400'}>
                              {category
                                ? formatCategoryLabel(category)
                                : t('pages.foodItems.category')}
                            </span>
                          </span>
                          <ChevronUpDownIcon className="h-5 w-5 shrink-0 text-slate-400" />
                        </button>

                        {isCategoryDropdownOpen ? (
                          <div className="absolute left-0 top-full z-20 mt-2 max-h-72 w-full overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
                            <button
                              type="button"
                              onClick={() => {
                                setCategory('')
                                setIsCategoryDropdownOpen(false)
                              }}
                              className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-slate-500 transition hover:bg-slate-50"
                            >
                              <span>{t('pages.foodItems.category')}</span>
                            </button>
                            {FOOD_CATEGORY_OPTIONS.map(option => (
                              <button
                                key={option}
                                type="button"
                                onClick={() => {
                                  setCategory(option)
                                  setIsCategoryDropdownOpen(false)
                                }}
                                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition ${
                                  category === option
                                    ? 'bg-violet-50 text-violet-700'
                                    : 'text-slate-700 hover:bg-slate-50'
                                }`}
                              >
                                <img
                                  src={getCategoryIcon(option)}
                                  alt={formatCategoryLabel(option)}
                                  className="h-6 w-6 shrink-0 object-contain"
                                />
                                <span>{formatCategoryLabel(option)}</span>
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-3">
                      <select value={selectedCountryCode} onChange={e => {
                        const nextCountry = setSharedCountry(e.target.value)
                        setSelectedCountryCode(nextCountry)
                      }} className="h-12 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-violet-300">
                        {Object.entries(AVAILABLE_COUNTRY_CODES).map(([key, value]) => (
                          <option key={key} value={value}>{value.toUpperCase()}</option>
                        ))}
                      </select>
                      <select value={selectedUnit} onChange={e => handleUnitChange(e.target.value)} className="h-12 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-violet-300">
                        {availableUnitOptions.map(unit => (
                          <option key={unit} value={unit}>
                            {unit}
                          </option>
                        ))}
                      </select>
                      <input value={servingValue} onChange={e => setServingValue(e.target.value)} placeholder={t('pages.foodItems.servingValue')} className="h-12 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-violet-300" />
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <input value={servingName} onChange={e => setServingName(e.target.value)} placeholder={t('pages.foodItems.servingName')} className="h-12 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-violet-300" />
                      <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                        <input type="checkbox" checked={isLiquid} onChange={e => setIsLiquid(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500" />
                        <span className="text-sm text-slate-700">{t('pages.foodItems.isLiquid')}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <input type="checkbox" checked={isPublic} onChange={e => setIsPublic(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500" />
                      <span className="text-sm text-slate-700">{t('pages.recipes.publicLabel')}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="rounded-[28px] border border-violet-200 bg-violet-50/70 p-6 shadow-sm">
                  <div className="mb-4 flex items-center gap-2">
                    <DocumentTextIcon className="h-5 w-5 text-violet-500" />
                    <h3 className="text-lg font-semibold text-slate-950">
                      {t('pages.foodItems.nutrition')}
                    </h3>
                  </div>
                  <p className="mb-4 text-sm text-slate-500">
                    {t(
                      isLiquid
                        ? 'pages.foodItems.nutritionPer100ml'
                        : 'pages.foodItems.nutritionPer100g'
                    )}
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <input value={calories} onChange={e => setCalories(e.target.value)} placeholder={t('pages.recipes.calories')} className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-violet-300" />
                    <input value={protein} onChange={e => setProtein(e.target.value)} placeholder={t('pages.recipes.protein')} className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-violet-300" />
                    <input value={carbs} onChange={e => setCarbs(e.target.value)} placeholder={t('pages.recipes.carbs')} className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-violet-300" />
                    <input value={fat} onChange={e => setFat(e.target.value)} placeholder={t('pages.recipes.fat')} className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-violet-300" />
                    <input value={sugar} onChange={e => setSugar(e.target.value)} placeholder={t('pages.foodItems.sugar')} className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-violet-300" />
                    <input value={fiber} onChange={e => setFiber(e.target.value)} placeholder={t('pages.foodItems.fiber')} className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-violet-300" />
                    <input value={salt} onChange={e => setSalt(e.target.value)} placeholder={t('pages.foodItems.salt')} className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-violet-300" />
                    <input value={saturatedFat} onChange={e => setSaturatedFat(e.target.value)} placeholder={t('pages.foodItems.saturatedFat')} className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-violet-300" />
                    <input value={unsaturatedFat} onChange={e => setUnsaturatedFat(e.target.value)} placeholder={t('pages.foodItems.unsaturatedFat')} className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-violet-300 sm:col-span-2" />
                  </div>
                  <div className="mt-4 rounded-2xl bg-white p-4 text-sm text-slate-700 shadow-sm">
                    {t('pages.foodItems.displaySummary', {
                      calories: displayTotals.calories,
                      protein: displayTotals.protein,
                      carbs: displayTotals.carbs,
                      fat: displayTotals.fat
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {isImageModalOpen && selectedImage ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75"
          onClick={() => {
            setIsImageModalOpen(false)
            setSelectedImage(null)
          }}
        >
          <div className="relative max-h-[90vh] max-w-4xl p-4">
            <button
              onClick={() => {
                setIsImageModalOpen(false)
                setSelectedImage(null)
              }}
              className="absolute -right-2 -top-2 rounded-full bg-white p-2 hover:bg-gray-100"
            >
              <XMarkIcon className="h-6 w-6 text-gray-600" />
            </button>
            <img src={selectedImage} alt={t('pages.recipes.preview')} className="max-h-[90vh] max-w-full rounded-lg" />
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default FoodItems
