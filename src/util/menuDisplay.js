const OZ_TO_GRAMS = 28.3495
const FL_OZ_TO_ML = 29.5735
const STANDARD_UNITS = new Set(['g', 'ml', 'oz', 'fl oz'])
const UNIT_ALIASES = {
  grams: 'g',
  gram: 'g',
  g: 'g',
  ounces: 'oz',
  ounce: 'oz',
  oz: 'oz',
  milliliters: 'ml',
  milliliter: 'ml',
  millilitre: 'ml',
  ml: 'ml',
  floz: 'fl oz',
  'fluid ounces': 'fl oz',
  'fluid ounce': 'fl oz',
  'fl oz': 'fl oz'
}

const parseNumber = value => {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

const parseJsonObject = value => {
  if (!value) return {}
  if (typeof value === 'object') return value
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return parsed && typeof parsed === 'object' ? parsed : {}
    } catch {
      return {}
    }
  }
  return {}
}

const parseJsonArray = value => {
  if (!value) return []
  if (Array.isArray(value)) return value
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
  return []
}

const normalizeServingOptions = item => {
  const servingOptions = parseJsonArray(item?.servingOptions)
  return servingOptions
}

const toUnitKey = unitRaw => {
  const key = String(unitRaw || '').trim().toLowerCase()
  return UNIT_ALIASES[key] || key
}

const isLiquidItem = item =>
  item?.isLiquid === true || item?.isLiquid === '1' || item?.selectedUnit === 'ml'

const getAmountInBaseUnit = (item, quantity, unit) => {
  const qty = parseNumber(quantity)
  const normalizedUnit = (unit || 'g').toLowerCase().trim()

  if (normalizedUnit === 'g' || normalizedUnit === 'gram') return qty
  if (normalizedUnit === 'grams') return qty
  if (normalizedUnit === 'kg') return qty * 1000
  if (normalizedUnit === 'oz') return qty * OZ_TO_GRAMS
  if (normalizedUnit === 'ml' || normalizedUnit === 'milliliter') return qty
  if (normalizedUnit === 'millilitre') return qty
  if (normalizedUnit === 'fl oz') return qty * FL_OZ_TO_ML
  if (normalizedUnit === 'l') return qty * 1000

  const options = normalizeServingOptions(item)
  const servingOption = options.find(option => {
    const optionUnit = (option?.unitName || '').toLowerCase().trim()
    return optionUnit === normalizedUnit
  })
  if (servingOption) {
    return qty * parseNumber(servingOption.value || 1)
  }

  return qty
}

const getChangedServingAmountAndUnit = item => {
  const changed = item?.changedServing || {}
  const quantityFromChanged = parseNumber(changed.quantity)
  if (quantityFromChanged > 0 && changed.unit) {
    return { amount: quantityFromChanged, unit: changed.unit }
  }

  const valueFromChanged = parseNumber(changed.value)
  if (valueFromChanged > 0) {
    const unitFromServingOption = toUnitKey(changed?.servingOption?.unitName || '')
    const resolvedServingOptionUnit = STANDARD_UNITS.has(unitFromServingOption)
      ? unitFromServingOption
      : null
    return {
      amount: valueFromChanged,
      unit: resolvedServingOptionUnit || item?.unit || (isLiquidItem(item) ? 'ml' : 'g')
    }
  }

  const quantity = parseNumber(item?.quantity)
  if (quantity > 0) {
    return { amount: quantity, unit: item?.unit || (isLiquidItem(item) ? 'ml' : 'g') }
  }

  const originalServingAmount = parseNumber(item?.originalServingAmount)
  if (originalServingAmount > 0) {
    return { amount: originalServingAmount, unit: isLiquidItem(item) ? 'ml' : 'g' }
  }

  return { amount: 100, unit: isLiquidItem(item) ? 'ml' : 'g' }
}

const getItemCaloriesPer100 = item => {
  return parseNumber(item?.caloriesPer100)
}

const getItemNutrientsPer100 = item => {
  return parseJsonObject(item?.nutrientsPer100)
}

export const detectIsRecipe = item => {
  const type = (item?.itemType || item?.type || '').toString().toLowerCase()
  return type === 'recipe' || type === 'recipes'
}

export const getServingIdentifier = serving => {
  if (!serving) return ''
  const unitName = serving?.unitName || ''
  const value = parseNumber(serving?.value ?? 0)
  return `${unitName}_${value}`
}

export const findServingByIdentifier = (servingOptions, identifier) => {
  if (!identifier) return null
  const options = parseJsonArray(servingOptions)
  return options.find(s => getServingIdentifier(s) === identifier) || null
}

export const findDefaultServing = servingOptions => {
  const options = parseJsonArray(servingOptions)
  if (options.length === 0) return null

  const priorityUnits = ['g', 'ml']
  for (const priorityUnit of priorityUnits) {
    const found = options.find(s => (s?.unitName || '').toLowerCase() === priorityUnit)
    if (found) return found
  }

  return options[0]
}

export const buildServingOptionsForMenuItem = (item, isImperial = false) => {
  const options = normalizeServingOptions(item)
  const liquid = isLiquidItem(item)
  const metricUnit = liquid ? 'ml' : 'g'
  const imperialUnit = liquid ? 'fl oz' : 'oz'
  const imperialValue = liquid ? 100 / FL_OZ_TO_ML : 100 / OZ_TO_GRAMS

  const normalized = []

  // Always include base metric option (per-100 base for calculations)
  normalized.push({
    unitName: metricUnit,
    value: 100,
    name: metricUnit,
    innerName: metricUnit,
    unit: metricUnit
  })

  // Include base imperial option only when user preference is imperial
  if (isImperial) {
    normalized.push({
      unitName: imperialUnit,
      value: imperialValue,
      name: imperialUnit,
      innerName: imperialUnit,
      unit: imperialUnit
    })
  }

  // Include custom servings from item servingOptions (non-standard units only)
  options.forEach(option => {
    const unitRaw =
      option?.unitName || option?.name || option?.innerName || option?.unit || ''
    const unitKey = toUnitKey(unitRaw)
    const value = parseNumber(option?.value ?? option?.amount ?? 0)
    if (!unitRaw || value <= 0) return
    if (STANDARD_UNITS.has(unitKey)) return
    normalized.push({
      ...option,
      unitName: unitRaw,
      value,
      name: option?.name || option?.innerName || unitRaw,
      innerName: option?.innerName || option?.name || unitRaw,
      unit: option?.unit || unitRaw
    })
  })

  // Deduplicate by serving identifier
  const deduped = []
  const seen = new Set()
  normalized.forEach(option => {
    const id = getServingIdentifier(option)
    if (!id || seen.has(id)) return
    seen.add(id)
    deduped.push(option)
  })

  return deduped
}

export const safeNutrients = nutrients => ({
  proteinsInGrams: parseNumber(nutrients?.proteinsInGrams),
  carbohydratesInGrams: parseNumber(nutrients?.carbohydratesInGrams),
  fatInGrams: parseNumber(nutrients?.fatInGrams),
  fibreInGrams: parseNumber(nutrients?.fibreInGrams),
  sugarsInGrams: parseNumber(nutrients?.sugarsInGrams)
})

export const calculateDisplayValues = (
  item,
  selectedServingAmount,
  _originalServingAmount,
  selectedServingUnit = null
) => {
  const selectedAmount = parseNumber(selectedServingAmount)
  if (selectedAmount <= 0) {
    return {
      calories: 0,
      nutrients: safeNutrients({})
    }
  }

  const per100Calories = getItemCaloriesPer100(item)
  const per100Nutrients = getItemNutrientsPer100(item)
  const { unit: fallbackUnit } = getChangedServingAmountAndUnit(item)
  const unit = selectedServingUnit || fallbackUnit
  const amountInBaseUnit = getAmountInBaseUnit(item, selectedAmount, unit)
  const ratio = amountInBaseUnit / 100

  return {
    calories: Math.round(per100Calories * ratio),
    nutrients: {
      proteinsInGrams: parseNumber(per100Nutrients?.proteinsInGrams) * ratio,
      carbohydratesInGrams:
        parseNumber(per100Nutrients?.carbohydratesInGrams) * ratio,
      fatInGrams: parseNumber(per100Nutrients?.fatInGrams) * ratio,
      fibreInGrams: parseNumber(per100Nutrients?.fibreInGrams) * ratio,
      sugarsInGrams: parseNumber(per100Nutrients?.sugarsInGrams) * ratio
    }
  }
}

export const computeAppliedItemTotals = entry => {
  const food = entry?.food || entry
  if (!food) {
    return {
      calories: 0,
      proteinsInGrams: 0,
      carbohydratesInGrams: 0,
      fatInGrams: 0
    }
  }

  const per100Calories = getItemCaloriesPer100(food)
  const per100Nutrients = getItemNutrientsPer100(food)
  const quantity = parseNumber(entry?.quantity)
  const unit = entry?.unit || (isLiquidItem(food) ? 'ml' : 'g')
  const amountInBaseUnit =
    quantity > 0
      ? getAmountInBaseUnit(food, quantity, unit)
      : getAmountInBaseUnit(food, 100, isLiquidItem(food) ? 'ml' : 'g')

  const ratio = amountInBaseUnit / 100
  return {
    calories: per100Calories * ratio,
    proteinsInGrams: parseNumber(per100Nutrients?.proteinsInGrams) * ratio,
    carbohydratesInGrams:
      parseNumber(per100Nutrients?.carbohydratesInGrams) * ratio,
    fatInGrams: parseNumber(per100Nutrients?.fatInGrams) * ratio
  }
}

export const computeAppliedTotals = items => {
  return (items || []).reduce(
    (acc, item) => {
      const totals = computeAppliedItemTotals(item)
      return {
        calories: acc.calories + totals.calories,
        proteinsInGrams: acc.proteinsInGrams + totals.proteinsInGrams,
        carbohydratesInGrams:
          acc.carbohydratesInGrams + totals.carbohydratesInGrams,
        fatInGrams: acc.fatInGrams + totals.fatInGrams
      }
    },
    { calories: 0, proteinsInGrams: 0, carbohydratesInGrams: 0, fatInGrams: 0 }
  )
}

export const sumTotalsByMealsApplied = daily => {
  const bp = computeAppliedTotals(daily.breakfast || [])
  const lp = computeAppliedTotals(daily.lunch || [])
  const dp = computeAppliedTotals(daily.dinner || [])
  const sp = computeAppliedTotals(daily.snack || [])
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
}
