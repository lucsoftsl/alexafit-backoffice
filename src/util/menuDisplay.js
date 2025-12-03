export const detectIsRecipe = (item) => {
  const type = (item?.itemType || item?.type || '').toString().toUpperCase()
  return type === 'RECIPE' || type === 'RECIPES'
}

export const getServingIdentifier = (serving) => {
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

export const findDefaultServing = (servingArray) => {
  if (!servingArray || !Array.isArray(servingArray) || servingArray.length === 0) {
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

export const safeNutrients = (nutrients) => ({
  proteinsInGrams: Number(nutrients?.proteinsInGrams) || 0,
  carbohydratesInGrams: Number(nutrients?.carbohydratesInGrams) || 0,
  fatInGrams: Number(nutrients?.fatInGrams) || 0,
})

export const calculateDisplayValues = (item, selectedServingAmount, originalServingAmount) => {
  if (!originalServingAmount || originalServingAmount <= 0 || !selectedServingAmount || selectedServingAmount <= 0) {
    return {
      calories: item?.originalCalories || item?.totalCalories || 0,
      nutrients: item?.originalNutrients || item?.totalNutrients || {}
    }
  }

  const isRecipe = detectIsRecipe(item)
  const originalCalories = item?.originalCalories || item?.totalCalories || 0
  const originalNutrients = item?.originalNutrients || item?.totalNutrients || {}
  let scaleRatio

  if (isRecipe) {
    const numberOfServings = item?.numberOfServings || item?.originalServings || 1
    let perServingWeight = null
    if (item?.serving && Array.isArray(item.serving)) {
      const portionServing = item.serving.find(s => s.profileId === 1)
      if (portionServing) {
        perServingWeight = portionServing.amount
      } else {
        const nonDefaultServing = item.serving.find(s =>
          s.profileId !== 0 &&
          (s.name?.toLowerCase() !== 'grame' && s.innerName?.toLowerCase() !== 'grame')
        )
        perServingWeight = nonDefaultServing?.amount || (originalServingAmount / numberOfServings)
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
      carbohydratesInGrams: (originalNutrients?.carbohydratesInGrams || 0) * scaleRatio,
      fatInGrams: (originalNutrients?.fatInGrams || 0) * scaleRatio,
      cholesterol: (originalNutrients?.cholesterol || 0) * scaleRatio,
      fibers: (originalNutrients?.fibers || 0) * scaleRatio,
      nonSaturatedFat: (originalNutrients?.nonSaturatedFat || 0) * scaleRatio,
      saturatedFat: (originalNutrients?.saturatedFat || 0) * scaleRatio,
      sodium: (originalNutrients?.sodium || 0) * scaleRatio,
      sugar: (originalNutrients?.sugar || 0) * scaleRatio,
    }
  }
}

// Sum totals assuming items already have applied totals (items-by-date payload)
export const computeAppliedTotals = (items) => {
  return (items || []).reduce((acc, item) => {
    const calories = Number(item?.totalCalories || item?.food?.totalCalories || 0)
    const nutrients = item?.totalNutrients || item?.food?.totalNutrients || {}
    const n = safeNutrients(nutrients)
    return {
      calories: acc.calories + calories,
      proteinsInGrams: acc.proteinsInGrams + n.proteinsInGrams,
      carbohydratesInGrams: acc.carbohydratesInGrams + n.carbohydratesInGrams,
      fatInGrams: acc.fatInGrams + n.fatInGrams,
    }
  }, { calories: 0, proteinsInGrams: 0, carbohydratesInGrams: 0, fatInGrams: 0 })
}

export const sumTotalsByMealsApplied = (daily) => {
  const bp = computeAppliedTotals(daily.breakfast || [])
  const lp = computeAppliedTotals(daily.lunch || [])
  const dp = computeAppliedTotals(daily.dinner || [])
  const sp = computeAppliedTotals(daily.snack || [])
  return {
    calories: bp.calories + lp.calories + dp.calories + sp.calories,
    proteinsInGrams: bp.proteinsInGrams + lp.proteinsInGrams + dp.proteinsInGrams + sp.proteinsInGrams,
    carbohydratesInGrams: bp.carbohydratesInGrams + lp.carbohydratesInGrams + dp.carbohydratesInGrams + sp.carbohydratesInGrams,
    fatInGrams: bp.fatInGrams + lp.fatInGrams + dp.fatInGrams + sp.fatInGrams,
    perMeal: { bp, lp, dp, sp }
  }
}