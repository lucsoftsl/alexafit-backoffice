import { useEffect, useMemo, useState } from 'react'
import {
    MagnifyingGlassIcon,
    PlusIcon,
    TrashIcon,
    ChevronDownIcon,
    ChevronUpIcon,
    PencilIcon,
} from '@heroicons/react/24/outline'
import {
    searchFoodItems,
    getItemsByIds,
    addMenuTemplate,
    updateMenuTemplate,
    getAllMenuTemplates,
    deleteMenuTemplateById,
} from '../services/api'

const defaultPlans = { breakfastPlan: [], lunchPlan: [], dinnerPlan: [], snackPlan: [] }

const mealTypeOptions = [
    { id: 'breakfastPlan', label: 'Breakfast' },
    { id: 'lunchPlan', label: 'Lunch' },
    { id: 'dinnerPlan', label: 'Dinner' },
    { id: 'snackPlan', label: 'Snack' },
]

const Menus = () => {
    const [expanded, setExpanded] = useState(true)
    const [menuName, setMenuName] = useState('')
    const [countryCode, setCountryCode] = useState('RO')
    const [activeMealType, setActiveMealType] = useState('breakfastPlan')
    const [plans, setPlans] = useState(defaultPlans)
    const [searchText, setSearchText] = useState('')
    const [onlyRecipes, setOnlyRecipes] = useState(false)
    const [searching, setSearching] = useState(false)
    const [searchResults, setSearchResults] = useState([])
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState(null)
    const [templates, setTemplates] = useState([])
    const [loadingTemplates, setLoadingTemplates] = useState(false)
    const [refreshing, setRefreshing] = useState(false)
    const [editingTemplateId, setEditingTemplateId] = useState(null)

    const loadTemplates = async () => {
        try {
            setLoadingTemplates(true)
            const data = await getAllMenuTemplates()
            setTemplates(Array.isArray(data?.data) ? data.data : (data?.templates || []))
        } catch (e) {
            console.error('Failed to load menu templates', e)
        } finally {
            setLoadingTemplates(false)
        }
    }

    useEffect(() => {
        loadTemplates()
    }, [])

    const handleSearch = async () => {
        if (!searchText.trim()) return
        try {
            setSearching(true)
            setError(null)
            // userId is not relevant for template authoring in backoffice; pass a static value
            const results = await searchFoodItems({
                searchText,
                userId: 'BACKOFFICE_ADMIN',
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

    const detectIsRecipe = (item) => {
        const type = (item?.itemType || item?.type || '').toString().toUpperCase()
        return type === 'RECIPE' || type === 'RECIPES'
    }

    const addItemToPlan = async (item) => {
        try {
            let enriched = item
            if (detectIsRecipe(item)) {
                try {
                    const id = item?.id || item?.itemId || item?._id
                    if (id) {
                        const resp = await getItemsByIds({ ids: [id] })
                        const detailed = resp?.data?.[0] || resp?.items?.[0]
                        if (detailed) {
                            // Store original values for scaling
                            const originalServings = detailed?.numberOfServings || 1
                            const enrichedData = {
                                ...item,
                                ...detailed,
                                originalServings,
                                originalCalories: detailed?.totalCalories,
                                originalNutrients: detailed?.totalNutrients,
                                numberOfServings: originalServings
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
                        }
                    }
                } catch (e) {
                    console.warn('Failed to enrich recipe, using elastic item', e)
                }
            }

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
        setPlans(prev => ({
            ...prev,
            [mealKey]: prev[mealKey].filter((_, i) => i !== index)
        }))
    }

    const totalItems = useMemo(() => Object.values(plans).reduce((acc, arr) => acc + arr.length, 0), [plans])

    const handleCreateTemplate = async () => {
        if (!menuName.trim()) {
            setError('Please provide a template name')
            return
        }
        try {
            setSubmitting(true)
            setError(null)

            if (editingTemplateId) {
                // Update existing template
                const payload = {
                    menuTemplateId: editingTemplateId,
                    name: menuName.trim(),
                    breakfastPlan: plans.breakfastPlan,
                    lunchPlan: plans.lunchPlan,
                    dinnerPlan: plans.dinnerPlan,
                    snackPlan: plans.snackPlan,
                }
                await updateMenuTemplate(payload)
            } else {
                // Create new template
                const payload = {
                    name: menuName.trim(),
                    breakfastPlan: plans.breakfastPlan,
                    lunchPlan: plans.lunchPlan,
                    dinnerPlan: plans.dinnerPlan,
                    snackPlan: plans.snackPlan,
                }
                await addMenuTemplate(payload)
            }

            // Reset form
            setMenuName('')
            setPlans(defaultPlans)
            setEditingTemplateId(null)

            // refresh templates
            await new Promise(resolve => setTimeout(resolve, 1500))
            loadTemplates()
        } catch (e) {
            console.error('Failed to create/update menu template', e)
            setError(`Failed to ${editingTemplateId ? 'update' : 'create'} menu template`)
        } finally {
            setSubmitting(false)
        }
    }

    const handleLoadTemplateForEditing = (template) => {
        const id = template?.id || template?._id || template?.menuTemplateId

        // If clicking the same template that's already being edited, cancel editing
        if (editingTemplateId === id) {
            handleCancelEdit()
            return
        }

        setEditingTemplateId(id)
        setMenuName(template?.name || '')
        setPlans({
            breakfastPlan: template?.breakfastPlan || [],
            lunchPlan: template?.lunchPlan || [],
            dinnerPlan: template?.dinnerPlan || [],
            snackPlan: template?.snackPlan || template?.snackPlan || [],
        })
        setExpanded(true)
    }

    const handleCancelEdit = () => {
        setEditingTemplateId(null)
        setMenuName('')
        setPlans(defaultPlans)
    }

    const handleDeleteTemplate = async (templateId) => {
        try {
            await deleteMenuTemplateById({ menuTemplateId: templateId })
            // wait 1.5 seconds
            await new Promise(resolve => setTimeout(resolve, 1500))
            loadTemplates()
        } catch (e) {
            console.error('Failed to delete template', e)
        }
    }

    const safeNutrients = (nutrients) => ({
        proteinsInGrams: Number(nutrients?.proteinsInGrams) || 0,
        carbohydratesInGrams: Number(nutrients?.carbohydratesInGrams) || 0,
        fatInGrams: Number(nutrients?.fatInGrams) || 0,
    })

    const computeMealTotals = (items) => {
        return items.reduce((acc, item) => {
            const calories = Number(item?.totalCalories) || 0
            const n = safeNutrients(item?.totalNutrients)
            return {
                calories: acc.calories + calories,
                proteinsInGrams: acc.proteinsInGrams + n.proteinsInGrams,
                carbohydratesInGrams: acc.carbohydratesInGrams + n.carbohydratesInGrams,
                fatInGrams: acc.fatInGrams + n.fatInGrams,
            }
        }, { calories: 0, proteinsInGrams: 0, carbohydratesInGrams: 0, fatInGrams: 0 })
    }

    const menuTotals = useMemo(() => {
        const bp = computeMealTotals(plans.breakfastPlan)
        const lp = computeMealTotals(plans.lunchPlan)
        const dp = computeMealTotals(plans.dinnerPlan)
        const sp = computeMealTotals(plans.snackPlan)
        return {
            calories: bp.calories + lp.calories + dp.calories + sp.calories,
            proteinsInGrams: bp.proteinsInGrams + lp.proteinsInGrams + dp.proteinsInGrams + sp.proteinsInGrams,
            carbohydratesInGrams: bp.carbohydratesInGrams + lp.carbohydratesInGrams + dp.carbohydratesInGrams + sp.carbohydratesInGrams,
            fatInGrams: bp.fatInGrams + lp.fatInGrams + dp.fatInGrams + sp.fatInGrams,
            perMeal: { bp, lp, dp, sp }
        }
    }, [plans])

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Menus</h1>
                    <p className="text-gray-600 mt-2">Create and manage menu templates</p>
                </div>
                <button onClick={loadTemplates} disabled={refreshing || loadingTemplates} className="btn-primary">
                    {refreshing ? 'Refreshing...' : 'Refresh'}
                </button>
            </div>

            <div className="card p-6">
                <div className="flex items-center justify-between cursor-pointer" onClick={() => setExpanded(!expanded)}>
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
                                    handleCancelEdit()
                                }}
                                className="px-3 py-1 text-sm text-gray-600 hover:text-gray-900"
                            >
                                Cancel Edit
                            </button>
                        )}
                        {expanded ? <ChevronUpIcon className="w-5 h-5 text-gray-600" /> : <ChevronDownIcon className="w-5 h-5 text-gray-600" />}
                    </div>
                </div>

                {expanded && (
                    <div className="mt-6 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Template Name</label>
                                <input
                                    type="text"
                                    value={menuName}
                                    onChange={(e) => setMenuName(e.target.value)}
                                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="e.g., High Protein - Weekday"
                                />
                            </div>

                            <div className="md:col-span-2">
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
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Meal Type</label>
                                <select
                                    value={activeMealType}
                                    onChange={(e) => setActiveMealType(e.target.value)}
                                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    {mealTypeOptions.map(opt => (
                                        <option key={opt.id} value={opt.id}>{opt.label}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div>
                            <h3 className="text-base font-semibold text-gray-900 mb-3">Search Items</h3>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={searchText}
                                    onChange={(e) => setSearchText(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') handleSearch() }}
                                    className="flex-1 border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="Search foods or recipes..."
                                />
                                <button
                                    onClick={handleSearch}
                                    disabled={searching || !searchText.trim()}
                                    className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center"
                                >
                                    <MagnifyingGlassIcon className="w-4 h-4 mr-1" />
                                    {searching ? 'Searching...' : 'Search'}
                                </button>
                            </div>
                            {searchResults.length > 0 && (
                                <div className="mt-3 max-h-56 overflow-y-auto border border-gray-200 rounded-md divide-y">
                                    {searchResults.map((item, idx) => (
                                        <div key={idx} className="p-3 flex items-center justify-between hover:bg-gray-50">
                                            <div className="min-w-0">
                                                <div className="text-sm font-medium text-gray-900 truncate">{item?.name || item?.title || 'Unnamed'}</div>
                                                <div className="text-xs text-gray-600">
                                                    {(detectIsRecipe(item) ? 'Recipe' : 'Food')}
                                                    {typeof item?.totalCalories === 'number' ? ` • ${item.totalCalories} cal/100g` : ''}
                                                </div>
                                            </div>
                                            <button onClick={() => addItemToPlan(item)} className="bg-green-600 text-white px-3 py-1 rounded-md hover:bg-green-700 flex items-center">
                                                <PlusIcon className="w-4 h-4 mr-1" /> Add
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Only Recipes</label>
                            <input
                                type="checkbox"
                                checked={onlyRecipes}
                                className="w-5 h-5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                onChange={(e) => setOnlyRecipes(e.target.checked)}
                            />
                        </div>

                        <div>
                            <h3 className="text-base font-semibold text-gray-900 mb-3">Selected Items</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {mealTypeOptions.map(opt => (
                                    <div key={opt.id} className="border border-gray-200 rounded-lg">
                                        <div className="px-3 py-2 bg-gray-50 border-b text-sm font-medium text-gray-700">{opt.label}</div>
                                        <div className="p-3 space-y-2 max-h-64 overflow-y-auto">
                                            {plans[opt.id].length === 0 && (
                                                <div className="text-sm text-gray-500">No items</div>
                                            )}
                                            {plans[opt.id].map((it, i) => {
                                                const isRecipeItem = detectIsRecipe(it)
                                                const servings = it?.numberOfServings || 1
                                                const adjustedCalories = Number(it?.totalCalories) || 0
                                                const adjustedNutrients = it?.totalNutrients || {}

                                                return (
                                                    <div key={i} className="p-2 rounded bg-white shadow-sm">
                                                        <div className="flex items-start justify-between">
                                                            <div className="min-w-0">
                                                                <div className="text-sm font-medium text-gray-900 truncate">{it?.name || it?.title || 'Unnamed'}</div>
                                                                <div className="text-xs text-gray-500 truncate">{isRecipeItem ? 'Recipe' : 'Food'}</div>
                                                            </div>
                                                            <button onClick={() => removeItemFromPlan(opt.id, i)} className="text-red-600 hover:text-red-800">
                                                                <TrashIcon className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                        {isRecipeItem && (
                                                            <div className="mt-1 mb-1 flex items-center gap-2">
                                                                <label className="text-xs text-gray-600 font-medium">Servings:</label>
                                                                <input
                                                                    type="number"
                                                                    min="1"
                                                                    value={servings}
                                                                    onChange={(e) => {
                                                                        const newServings = parseInt(e.target.value) || 1
                                                                        const originalServings = it?.originalServings || 1
                                                                        const scaleRatio = newServings / originalServings

                                                                        // Update recipe with scaled values
                                                                        let updated = {
                                                                            ...it,
                                                                            numberOfServings: newServings,
                                                                            totalCalories: Math.round((it?.originalCalories || 0) * scaleRatio)
                                                                        }

                                                                        // Scale nutrients
                                                                        if (it?.originalNutrients) {
                                                                            updated.totalNutrients = {
                                                                                proteinsInGrams: (it.originalNutrients.proteinsInGrams || 0) * scaleRatio,
                                                                                carbohydratesInGrams: (it.originalNutrients.carbohydratesInGrams || 0) * scaleRatio,
                                                                                fatInGrams: (it.originalNutrients.fatInGrams || 0) * scaleRatio,
                                                                                // Scale additional nutrients if present
                                                                                cholesterol: (it.originalNutrients.cholesterol || 0) * scaleRatio,
                                                                                fibers: (it.originalNutrients.fibers || 0) * scaleRatio,
                                                                                nonSaturatedFat: (it.originalNutrients.nonSaturatedFat || 0) * scaleRatio,
                                                                                saturatedFat: (it.originalNutrients.saturatedFat || 0) * scaleRatio,
                                                                                sodium: (it.originalNutrients.sodium || 0) * scaleRatio,
                                                                                sugar: (it.originalNutrients.sugar || 0) * scaleRatio,
                                                                            }
                                                                        }

                                                                        // Scale ingredients
                                                                        if (it?.ingredients && Array.isArray(it.ingredients)) {
                                                                            updated.ingredients = it.ingredients.map(ingredient => ({
                                                                                ...ingredient,
                                                                                calorieAmount: (ingredient?.originalCalorieAmount || 0) * scaleRatio,
                                                                                carbohydateAmount: (ingredient?.originalCarbohydrateAmount || 0) * scaleRatio,
                                                                                fatAmount: (ingredient?.originalFatAmount || 0) * scaleRatio,
                                                                                proteinAmount: (ingredient?.originalProteinAmount || 0) * scaleRatio,
                                                                                weight: (ingredient?.originalWeight || 0) * scaleRatio,
                                                                                macronutrientsEx: ingredient?.originalMacronutrientsEx ? {
                                                                                    cholesterol: (ingredient.originalMacronutrientsEx.cholesterol || 0) * scaleRatio,
                                                                                    fibers: (ingredient.originalMacronutrientsEx.fibers || 0) * scaleRatio,
                                                                                    nonSaturatedFat: (ingredient.originalMacronutrientsEx.nonSaturatedFat || 0) * scaleRatio,
                                                                                    saturatedFat: (ingredient.originalMacronutrientsEx.saturatedFat || 0) * scaleRatio,
                                                                                    sodium: (ingredient.originalMacronutrientsEx.sodium || 0) * scaleRatio,
                                                                                    sugar: (ingredient.originalMacronutrientsEx.sugar || 0) * scaleRatio,
                                                                                } : ingredient?.macronutrientsEx,
                                                                            }))
                                                                        }

                                                                        setPlans(prev => ({
                                                                            ...prev,
                                                                            [opt.id]: prev[opt.id].map((item, idx) => idx === i ? updated : item)
                                                                        }))
                                                                    }}
                                                                    className="w-16 px-2 py-1 border border-gray-300 rounded text-xs"
                                                                />
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
                                            {plans[opt.id].length > 0 && (() => {
                                                const mealTotals = computeMealTotals(plans[opt.id])
                                                return (
                                                    <div className="mt-2 p-2 bg-blue-50 rounded text-xs text-blue-900">
                                                        <span className="font-medium">{opt.label} subtotal:</span>
                                                        <span className="ml-1">{Math.round(mealTotals.calories)} cal</span>
                                                        <span className="mx-2">|</span>
                                                        <span>P {Math.round(mealTotals.proteinsInGrams)} g</span>
                                                        <span className="mx-2">|</span>
                                                        <span>C {Math.round(mealTotals.carbohydratesInGrams)} g</span>
                                                        <span className="mx-2">|</span>
                                                        <span>F {Math.round(mealTotals.fatInGrams)} g</span>
                                                    </div>
                                                )
                                            })()}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {error && (
                            <div className="p-3 rounded border border-red-200 bg-red-50 text-red-800 text-sm">{error}</div>
                        )}

                        <div className="space-y-2">
                            <div className="p-3 bg-green-50 rounded text-sm text-green-900">
                                <span className="font-semibold">Menu totals:</span>
                                <span className="ml-2">{Math.round(menuTotals.calories)} cal</span>
                                <span className="mx-2">|</span>
                                <span>P {Math.round(menuTotals.proteinsInGrams)} g</span>
                                <span className="mx-2">|</span>
                                <span>C {Math.round(menuTotals.carbohydratesInGrams)} g</span>
                                <span className="mx-2">|</span>
                                <span>F {Math.round(menuTotals.fatInGrams)} g</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="text-sm text-gray-600">Total items: <span className="font-medium text-gray-900">{totalItems}</span></div>
                                <button
                                    onClick={handleCreateTemplate}
                                    disabled={submitting || !menuName.trim()}
                                    className="bg-blue-600 text-white px-5 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                                >
                                    {submitting
                                        ? (editingTemplateId ? 'Updating...' : 'Creating...')
                                        : (editingTemplateId ? 'Update Template' : 'Create Template')
                                    }
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <div className="card p-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-gray-900">Created Menu Templates</h2>
                    {loadingTemplates && (
                        <span className="text-sm text-gray-500">Loading...</span>
                    )}
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Breakfast</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lunch</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dinner</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Snacks</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {templates.map((t) => {
                                const id = t?.id || t?._id || t?.menuTemplateId
                                const bp = t?.breakfastPlan || []
                                const lp = t?.lunchPlan || []
                                const dp = t?.dinnerPlan || []
                                const sp = t?.snackPlan || []
                                const isCurrentlyEditing = editingTemplateId === id
                                return (
                                    <tr
                                        key={id}
                                        className={`hover:bg-gray-50 ${isCurrentlyEditing ? 'bg-blue-100' : ''} cursor-pointer`}
                                        onClick={() => handleLoadTemplateForEditing(t)}
                                    >
                                        <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-900">{t?.name || 'Untitled'}</td>
                                        <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-900">{bp.length}</td>
                                        <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-900">{lp.length}</td>
                                        <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-900">{dp.length}</td>
                                        <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-900">{sp.length}</td>
                                        <td className="px-6 py-3 whitespace-nowrap text-sm flex items-center justify-evenly" onClick={(e) => e.stopPropagation()}>
                                            {isCurrentlyEditing && (
                                                <span className="text-blue-600 text-xs mr-2">✓ Editing</span>
                                            )}
                                            <button onClick={() => handleDeleteTemplate(id)} className="text-red-600 hover:text-red-800">
                                                <TrashIcon className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                )
                            })}
                            {templates.length === 0 && (
                                <tr>
                                    <td className="px-6 py-4 text-sm text-gray-500" colSpan="6">No templates found</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}

export default Menus


