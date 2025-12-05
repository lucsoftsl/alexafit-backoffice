export const detectIsRecipe = item => {
  const type = (item?.itemType || item?.type || '').toString().toUpperCase()
  return type === 'RECIPE' || type === 'RECIPES'
}

export const getServingIdentifier = serving => {
  if (serving?.id !== undefined && serving?.id !== null) {
    return `${serving.id}_${serving.name || serving.innerName || ''}`
  }
  return serving?.name || serving?.innerName || ''
}

export const findServingByIdentifier = (servingOptions, identifier) => {
  if (!identifier) return null
  return (servingOptions || []).find(s => {
    const servingId = getServingIdentifier(s)
    return servingId === identifier
  })
}

export const findDefaultServing = servingArray => {
  if (
    !servingArray ||
    !Array.isArray(servingArray) ||
    servingArray.length === 0
  ) {
    return null
  }
  let selectedServing = servingArray.find(s => s.profileId === 0)
  if (!selectedServing) {
    const namePatterns = ['g', 'gram', 'grame', 'gramm', 'ml']
    selectedServing = servingArray.find(s => {
      const nameLower = (s.name || '').toLowerCase()
      return namePatterns.some(pattern => nameLower === pattern)
    })
  }
  if (!selectedServing) selectedServing = servingArray[0]
  return selectedServing
}

export const safeNutrients = nutrients => ({
  proteinsInGrams: Number(nutrients?.proteinsInGrams) || 0,
  carbohydratesInGrams: Number(nutrients?.carbohydratesInGrams) || 0,
  fatInGrams: Number(nutrients?.fatInGrams) || 0
})

export const calculateDisplayValues = (
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
    const numberOfServings =
      item?.numberOfServings || item?.originalServings || 1
    let perServingWeight = null
    if (item?.serving && Array.isArray(item.serving)) {
      const portionServing = item.serving.find(s => s.profileId === 1)
      if (portionServing) {
        perServingWeight = portionServing.amount
      } else {
        const nonDefaultServing = item.serving.find(
          s =>
            s.profileId !== 0 &&
            s.name?.toLowerCase() !== 'grame' &&
            s.innerName?.toLowerCase() !== 'grame'
        )
        perServingWeight =
          nonDefaultServing?.amount || originalServingAmount / numberOfServings
      }
    } else {
      perServingWeight = originalServingAmount / numberOfServings
    }

    if (perServingWeight && perServingWeight > 0) {
      const selectedServings = selectedServingAmount / perServingWeight
      scaleRatio = selectedServings / numberOfServings
    } else {
      scaleRatio = selectedServingAmount / originalServingAmount
    }
  } else {
    scaleRatio = selectedServingAmount / originalServingAmount
  }

  return {
    calories: Math.round(originalCalories * scaleRatio),
    nutrients: {
      proteinsInGrams: (originalNutrients?.proteinsInGrams || 0) * scaleRatio,
      carbohydratesInGrams:
        (originalNutrients?.carbohydratesInGrams || 0) * scaleRatio,
      fatInGrams: (originalNutrients?.fatInGrams || 0) * scaleRatio,
      cholesterol: (originalNutrients?.cholesterol || 0) * scaleRatio,
      fibers: (originalNutrients?.fibers || 0) * scaleRatio,
      nonSaturatedFat: (originalNutrients?.nonSaturatedFat || 0) * scaleRatio,
      saturatedFat: (originalNutrients?.saturatedFat || 0) * scaleRatio,
      sodium: (originalNutrients?.sodium || 0) * scaleRatio,
      sugar: (originalNutrients?.sugar || 0) * scaleRatio
    }
  }
}

// Sum totals assuming items already have applied totals (items-by-date payload)
// This now accounts for quantity and unit when calculating actual calories
export const computeAppliedTotals = items => {
  return (items || []).reduce(
    (acc, item) => {
      const isRecipe = detectIsRecipe(item?.food || item)
      const baseCalories = Number(
        item?.totalCalories || item?.food?.totalCalories || 0
      )
      const baseNutrients =
        item?.totalNutrients || item?.food?.totalNutrients || {}

      // Get quantity from the applied item
      const quantity = Number(item?.quantity) || 0

      let calories = 0
      let nutrients = safeNutrients(baseNutrients)
      let scaleRatio = 1

      if (isRecipe) {
        // For recipes: totalCalories is for ALL numberOfServings servings
        // We need to find the actual total weight and scale accordingly
        const numberOfServings = item?.food?.numberOfServings || 1
        const totalQuantity = baseNutrients?.totalQuantity ||
                             baseNutrients?.weightAfterCooking ||
                             null

        if (totalQuantity && totalQuantity > 0 && quantity > 0) {
          // Scale recipe based on actual quantity vs total recipe weight
          scaleRatio = quantity / totalQuantity
          calories = Math.round(baseCalories * scaleRatio)
        } else {
          // Fallback: use default serving if totalQuantity not available
          const servingArray = item?.food?.serving || item?.serving || []
          const portionServing = servingArray.find(s => s.profileId === 1)
          const defaultServing = portionServing || findDefaultServing(servingArray)
          const defaultServingAmount = defaultServing?.amount || 100
          const perServingWeight = portionServing?.amount || (defaultServingAmount / numberOfServings)
          
          if (perServingWeight && perServingWeight > 0 && quantity > 0) {
            const selectedServings = quantity / perServingWeight
            scaleRatio = selectedServings / numberOfServings
            calories = Math.round(baseCalories * scaleRatio)
          } else {
            scaleRatio = quantity / defaultServingAmount
            calories = Math.round(baseCalories * scaleRatio)
          }
        }
      } else {
        // For foods: use default serving
        const servingArray = item?.food?.serving || item?.serving || []
        const defaultServing = findDefaultServing(servingArray)
        const defaultServingAmount = defaultServing?.amount || 100
        
        if (quantity > 0) {
          scaleRatio = quantity / defaultServingAmount
          calories = Math.round(baseCalories * scaleRatio)
        } else {
          calories = Math.round(baseCalories)
        }
      }

      return {
        calories: acc.calories + calories,
        proteinsInGrams:
          acc.proteinsInGrams + nutrients.proteinsInGrams * scaleRatio,
        carbohydratesInGrams:
          acc.carbohydratesInGrams +
          nutrients.carbohydratesInGrams * scaleRatio,
        fatInGrams: acc.fatInGrams + nutrients.fatInGrams * scaleRatio
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
