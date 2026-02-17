const KG_TO_LB = 2.2046226218
const CM_TO_IN = 0.3937007874

const getUserDataObject = input => {
  if (!input || typeof input !== 'object') return {}
  if (input.userData && typeof input.userData === 'object') return input.userData
  return input
}

export const isImperialFromUserData = input => {
  const userData = getUserDataObject(input)
  const weightUnit = String(userData?.selectedWeightMeasurementUnit || '').toUpperCase()
  const targetWeightUnit = String(
    userData?.selectedTargetWeightMeasurementUnit || ''
  ).toUpperCase()
  return weightUnit === 'IMPERIAL' || targetWeightUnit === 'IMPERIAL'
}

export const convertKgToLb = value => {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  return n * KG_TO_LB
}

export const convertCmToIn = value => {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  return n * CM_TO_IN
}

export const formatWeightByPreference = (kgValue, isImperial) => {
  const n = Number(kgValue)
  if (!Number.isFinite(n)) return 'N/A'
  const v = isImperial ? convertKgToLb(n) : n
  const unit = isImperial ? 'lb' : 'kg'
  return `${v.toFixed(1)} ${unit}`
}

export const formatLengthByPreference = (cmValue, isImperial) => {
  const n = Number(cmValue)
  if (!Number.isFinite(n)) return 'N/A'
  const v = isImperial ? convertCmToIn(n) : n
  const unit = isImperial ? 'in' : 'cm'
  return `${v.toFixed(1)} ${unit}`
}

const GRAMS_TO_OZ = 0.03527396195
const ML_TO_FL_OZ = 0.0338140227

export const convertFoodQuantityByPreference = (quantity, unit, isImperial) => {
  const q = Number(quantity)
  if (!Number.isFinite(q)) {
    return { quantity: 0, unit: unit || '' }
  }

  const rawUnit = String(unit || '').toLowerCase().trim()
  if (!isImperial) return { quantity: q, unit: unit || 'g' }

  if (['g', 'gram', 'grams'].includes(rawUnit)) {
    return { quantity: q * GRAMS_TO_OZ, unit: 'oz' }
  }
  if (rawUnit === 'kg') {
    return { quantity: q * 1000 * GRAMS_TO_OZ, unit: 'oz' }
  }
  if (['ml', 'milliliter', 'millilitre'].includes(rawUnit)) {
    return { quantity: q * ML_TO_FL_OZ, unit: 'fl oz' }
  }
  if (rawUnit === 'l') {
    return { quantity: q * 1000 * ML_TO_FL_OZ, unit: 'fl oz' }
  }

  return { quantity: q, unit: unit || '' }
}
