import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  cloneRecipeToCountry,
  fetchDefaultRecipes,
  setRecipeCategories,
  setRecipeDefaultStatus
} from '../services/api'
import { useSelectedCountry } from '../util/useSelectedCountry'

const AVAILABLE_COUNTRY_CODES = ['ES', 'GB', 'HU', 'IT', 'RO', 'UK', 'US']
const RECIPE_CATEGORIES = [
  { key: 'breakfast', label: 'Breakfast' },
  { key: 'brunch', label: 'Brunch' },
  { key: 'lunch', label: 'Lunch' },
  { key: 'dinner', label: 'Dinner' },
  { key: 'snack', label: 'Snack' },
  { key: 'dessert', label: 'Dessert' },
  { key: 'appetizer', label: 'Appetizer' },
  { key: 'side_dish', label: 'Side Dish' },
  { key: 'soup', label: 'Soup' },
  { key: 'salad', label: 'Salad' },
  { key: 'smoothie', label: 'Smoothie' },
  { key: 'drink', label: 'Drink' },
  { key: 'american', label: 'American' },
  { key: 'italian', label: 'Italian' },
  { key: 'asian', label: 'Asian' },
  { key: 'mexican', label: 'Mexican' },
  { key: 'mediterranean', label: 'Mediterranean' },
  { key: 'indian', label: 'Indian' },
  { key: 'french', label: 'French' },
  { key: 'japanese', label: 'Japanese' },
  { key: 'chinese', label: 'Chinese' },
  { key: 'thai', label: 'Thai' },
  { key: 'greek', label: 'Greek' },
  { key: 'middle_eastern', label: 'Middle Eastern' },
  { key: 'spanish', label: 'Spanish' },
  { key: 'korean', label: 'Korean' },
  { key: 'vietnamese', label: 'Vietnamese' },
  { key: 'vegetarian', label: 'Vegetarian' },
  { key: 'vegan', label: 'Vegan' },
  { key: 'keto', label: 'Keto' },
  { key: 'paleo', label: 'Paleo' },
  { key: 'gluten_free', label: 'Gluten-Free' },
  { key: 'low_carb', label: 'Low-Carb' },
  { key: 'high_protein', label: 'High-Protein' },
  { key: 'low_fat', label: 'Low-Fat' },
  { key: 'dairy_free', label: 'Dairy-Free' },
  { key: 'sugar_free', label: 'Sugar-Free' },
  { key: 'quick', label: 'Quick' },
  { key: 'meal_prep', label: 'Meal Prep' }
]
const CATEGORY_LABEL_BY_KEY = RECIPE_CATEGORIES.reduce(
  (acc, option) => ({ ...acc, [option.key]: option.label }),
  {}
)
const CATEGORY_KEY_BY_LABEL = RECIPE_CATEGORIES.reduce(
  (acc, option) => ({
    ...acc,
    [option.key.toLowerCase()]: option.key,
    [option.label.toLowerCase()]: option.key
  }),
  {}
)

const toRecipeCategoryKey = value =>
  (value || '')
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')

const normalizeRecipeCategoryKey = value => {
  const raw = (value || '').toString().trim()
  if (!raw) return ''
  return CATEGORY_KEY_BY_LABEL[raw.toLowerCase()] || toRecipeCategoryKey(raw)
}

const humanizeRecipeCategoryKey = key =>
  (key || '')
    .toString()
    .split('_')
    .filter(Boolean)
    .map(part => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ')

const parseRecipeCategoryKeys = value => {
  const values = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(',')
      : value && typeof value === 'object'
        ? [value.key || value.label || value.category || value.value]
        : []

  return values.map(normalizeRecipeCategoryKey).filter(Boolean)
}

const DefaultRecipes = ({ onEditRecipe }) => {
  const { t } = useTranslation()
  const [selectedCountry, setSelectedCountry] = useSelectedCountry()
  const [recipes, setRecipes] = useState([])
  const [loading, setLoading] = useState(false)
  const [submittingAction, setSubmittingAction] = useState(null)
  const [error, setError] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [cloneModalRecipe, setCloneModalRecipe] = useState(null)
  const [cloneCountryCode, setCloneCountryCode] = useState('')
  const [cloningRecipe, setCloningRecipe] = useState(false)

  const loadRecipes = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetchDefaultRecipes({ countryCode: selectedCountry })
      setRecipes(response || [])
    } catch (loadError) {
      console.error('Failed to load default recipes', loadError)
      setError(t('pages.recipes.loadDefaultRecipesFailed'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRecipes()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCountry])

  const getCategoryLabel = category =>
    CATEGORY_LABEL_BY_KEY[category] || humanizeRecipeCategoryKey(category)

  const filteredRecipes = useMemo(() => {
    const query = searchTerm.trim().toLowerCase()
    if (!query) return recipes
    return recipes.filter(recipe =>
      [
        recipe?.name,
        recipe?.category,
        recipe?.countryCode,
        ...parseRecipeCategoryKeys(recipe?.category).map(getCategoryLabel)
      ]
        .filter(Boolean)
        .some(value => String(value).toLowerCase().includes(query))
    )
  }, [recipes, searchTerm])

  const groupedRecipes = useMemo(() => {
    const groups = new Map()

    filteredRecipes.forEach(recipe => {
      const categories = parseRecipeCategoryKeys(recipe?.category)
      const categoryKeys = categories.length ? categories : ['uncategorized']

      categoryKeys.forEach(category => {
        if (!groups.has(category)) {
          groups.set(category, [])
        }
        groups.get(category).push(recipe)
      })
    })

    return Array.from(groups.entries()).sort(([left], [right]) =>
      getCategoryLabel(left).localeCompare(getCategoryLabel(right))
    )
  }, [filteredRecipes])

  const removeDefaultRecipe = async recipe => {
    const recipeId = recipe?.id
    if (!recipeId) return
    const actionKey = `default-${recipeId}`
    try {
      setSubmittingAction(actionKey)
      await setRecipeDefaultStatus({ recipeId, isDefaultRecipe: false })
      setRecipes(current => current.filter(item => item.id !== recipeId))
    } finally {
      setSubmittingAction(null)
    }
  }

  const removeRecipeFromCategory = async (recipe, category) => {
    const recipeId = recipe?.id
    if (!recipeId || category === 'uncategorized') return

    const nextCategories = parseRecipeCategoryKeys(recipe.category).filter(
      item => item !== category
    )

    const actionKey = `category-${recipeId}-${category}`
    try {
      setSubmittingAction(actionKey)
      await setRecipeCategories({ recipeId, categories: nextCategories })
      setRecipes(current =>
        current.map(item =>
          item.id === recipeId
            ? {
                ...item,
                category: nextCategories.join(',')
              }
            : item
        )
      )
    } finally {
      setSubmittingAction(null)
    }
  }

  const openCloneModal = recipe => {
    const otherCountries = AVAILABLE_COUNTRY_CODES.filter(
      c => c !== (recipe.countryCode || selectedCountry)
    )
    setCloneModalRecipe(recipe)
    setCloneCountryCode(otherCountries[0] || '')
  }

  const handleCloneRecipe = async () => {
    if (!cloneModalRecipe || !cloneCountryCode) return
    try {
      setCloningRecipe(true)
      const result = await cloneRecipeToCountry({
        recipeId: cloneModalRecipe.id,
        countryCode: cloneCountryCode
      })
      if (result?.ok) {
        alert(`Recipe cloned to ${cloneCountryCode} successfully!`)
        setCloneModalRecipe(null)
      } else {
        throw new Error(result?.error || 'Failed to clone recipe')
      }
    } catch (e) {
      console.error('Failed to clone recipe', e)
      alert(`Failed to clone recipe: ${e.message}`)
    } finally {
      setCloningRecipe(false)
    }
  }

  return (
    <>
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-950">
              {t('pages.recipes.defaultRecipesTitle')}
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              {t('pages.recipes.defaultRecipesSubtitle')}
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              type="text"
              value={searchTerm}
              onChange={event => setSearchTerm(event.target.value)}
              placeholder={t('pages.recipes.searchByName')}
              className="h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-violet-300"
            />
            <select
              value={selectedCountry}
              onChange={event => setSelectedCountry(event.target.value)}
              className="h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-violet-300"
            >
              {AVAILABLE_COUNTRY_CODES.map(country => (
                <option key={country} value={country}>
                  {country}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={loadRecipes}
              className="h-11 cursor-pointer rounded-2xl bg-violet-600 px-4 text-sm font-semibold text-white"
            >
              {t('pages.recipes.refreshData')}
            </button>
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">
            {t('pages.recipes.loading')}
          </div>
        ) : groupedRecipes.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            {t('pages.recipes.noDefaultRecipes')}
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {groupedRecipes.map(([category, items]) => (
              <section key={category}>
                <div className="bg-slate-50 px-5 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-slate-700">
                      {category === 'uncategorized'
                        ? t('pages.recipes.noCategory')
                        : getCategoryLabel(category)}
                    </h2>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-500">
                      {items.length}
                    </span>
                  </div>
                  {category !== 'uncategorized' ? (
                    <p className="mt-1 text-xs text-slate-400">{category}</p>
                  ) : null}
                </div>
                <div className="divide-y divide-slate-100">
                  {items.map(recipe => (
                    <div
                      key={`${category}-${recipe.id}`}
                      className="flex cursor-pointer flex-col gap-4 p-4 transition hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <button
                        type="button"
                        onClick={() => onEditRecipe?.(recipe)}
                        className="flex min-w-0 flex-1 cursor-pointer items-center gap-4 text-left"
                      >
                        {recipe.photoUrl ? (
                          <img
                            src={recipe.photoUrl}
                            alt={recipe.name}
                            className="h-14 w-14 rounded-2xl object-cover"
                          />
                        ) : (
                          <div className="h-14 w-14 rounded-2xl bg-slate-100" />
                        )}
                        <div className="min-w-0">
                          <h3 className="truncate text-base font-semibold text-slate-950">
                            {recipe.name || t('pages.recipes.unnamed')}
                          </h3>
                          <p className="mt-1 text-sm text-slate-500">
                            {parseRecipeCategoryKeys(recipe.category)
                              .map(getCategoryLabel)
                              .join(', ') || t('pages.recipes.noCategory')}{' '}
                            · {recipe.countryCode || '-'}
                          </p>
                        </div>
                      </button>
                      <div className="flex gap-2 sm:justify-end">
                        <button
                          type="button"
                          onClick={() => onEditRecipe?.(recipe)}
                          className="cursor-pointer rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-white"
                        >
                          {t('pages.recipes.edit')}
                        </button>
                        <button
                          type="button"
                          onClick={() => openCloneModal(recipe)}
                          className="cursor-pointer rounded-2xl border border-violet-200 px-4 py-2 text-sm font-semibold text-violet-700 transition hover:bg-violet-50"
                        >
                          Clone to Country
                        </button>
                        <button
                          type="button"
                          onClick={() => removeDefaultRecipe(recipe)}
                          disabled={submittingAction === `default-${recipe.id}`}
                          className="cursor-pointer rounded-2xl border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-wait disabled:opacity-60"
                        >
                          {submittingAction === `default-${recipe.id}`
                            ? t('pages.recipes.updating')
                            : t('pages.recipes.removeDefault')}
                        </button>
                        {category !== 'uncategorized' ? (
                          <button
                            type="button"
                            onClick={() =>
                              removeRecipeFromCategory(recipe, category)
                            }
                            disabled={
                              submittingAction ===
                              `category-${recipe.id}-${category}`
                            }
                            className="cursor-pointer rounded-2xl border border-amber-200 px-4 py-2 text-sm font-semibold text-amber-700 transition hover:bg-amber-50 disabled:cursor-wait disabled:opacity-60"
                          >
                            {submittingAction ===
                            `category-${recipe.id}-${category}`
                              ? t('pages.recipes.updating')
                              : t('pages.recipes.removeFromCategory')}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>

    {cloneModalRecipe && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
        <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-xl">
          <div className="mb-5 flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-950">Clone to Country</h3>
            <button
              type="button"
              onClick={() => setCloneModalRecipe(null)}
              className="cursor-pointer rounded-xl p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            >
              ✕
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Recipe</p>
              <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800">
                {cloneModalRecipe.name || 'Unnamed'}
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
                Target Country
              </label>
              <select
                value={cloneCountryCode}
                onChange={e => setCloneCountryCode(e.target.value)}
                className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:border-violet-300"
              >
                {AVAILABLE_COUNTRY_CODES.filter(
                  c => c !== (cloneModalRecipe.countryCode || selectedCountry)
                ).map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="rounded-2xl border border-violet-100 bg-violet-50 px-4 py-3 text-sm text-violet-700">
              Gemini will translate the recipe name, ingredients and steps to the target country language. The clone will be saved as a default recipe with <strong>isVerified = false</strong>.
            </div>
          </div>

          <div className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={() => setCloneModalRecipe(null)}
              disabled={cloningRecipe}
              className="flex-1 cursor-pointer rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCloneRecipe}
              disabled={cloningRecipe || !cloneCountryCode}
              className="flex-1 cursor-pointer rounded-2xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:cursor-wait disabled:opacity-60"
            >
              {cloningRecipe ? 'Cloning...' : 'Clone Recipe'}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  )
}

export default DefaultRecipes
