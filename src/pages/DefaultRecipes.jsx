import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { fetchDefaultRecipes, setRecipeDefaultStatus } from '../services/api'
import { useSelectedCountry } from '../util/useSelectedCountry'

const AVAILABLE_COUNTRY_CODES = ['ES', 'GB', 'HU', 'IT', 'RO', 'UK', 'US']

const DefaultRecipes = ({ onEditRecipe }) => {
  const { t } = useTranslation()
  const [selectedCountry, setSelectedCountry] = useSelectedCountry()
  const [recipes, setRecipes] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')

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

  const filteredRecipes = useMemo(() => {
    const query = searchTerm.trim().toLowerCase()
    if (!query) return recipes
    return recipes.filter(recipe =>
      [recipe?.name, recipe?.category, recipe?.countryCode]
        .filter(Boolean)
        .some(value => String(value).toLowerCase().includes(query))
    )
  }, [recipes, searchTerm])

  const removeDefaultRecipe = async recipe => {
    const recipeId = recipe?.id
    if (!recipeId) return
    await setRecipeDefaultStatus({ recipeId, isDefaultRecipe: false })
    setRecipes(current => current.filter(item => item.id !== recipeId))
  }

  return (
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
              className="h-11 rounded-2xl bg-violet-600 px-4 text-sm font-semibold text-white"
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
        ) : filteredRecipes.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            {t('pages.recipes.noDefaultRecipes')}
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredRecipes.map(recipe => (
              <div
                key={recipe.id}
                className="flex cursor-pointer flex-col gap-4 p-4 transition hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between"
              >
                <button
                  type="button"
                  onClick={() => onEditRecipe?.(recipe)}
                  className="flex min-w-0 flex-1 items-center gap-4 text-left"
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
                    <h2 className="truncate text-base font-semibold text-slate-950">
                      {recipe.name || t('pages.recipes.unnamed')}
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      {recipe.category || t('pages.recipes.noCategory')} ·{' '}
                      {recipe.countryCode || '-'}
                    </p>
                  </div>
                </button>
                <div className="flex gap-2 sm:justify-end">
                  <button
                    type="button"
                    onClick={() => onEditRecipe?.(recipe)}
                    className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-white"
                  >
                    {t('pages.recipes.edit')}
                  </button>
                  <button
                    type="button"
                    onClick={() => removeDefaultRecipe(recipe)}
                    className="rounded-2xl border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50"
                  >
                    {t('pages.recipes.removeDefault')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default DefaultRecipes
