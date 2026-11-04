/**
 * Units for the backoffice (mirrors foodsync/util/units.ts).
 *
 * Model: every value is stored in metric (g, ml, kg, cm). Each client has ONE
 * preference, userData.unitSystem ('metric' | 'imperial'). Legacy rows may
 * still carry IMPERIAL values (lb, "feet.inches" heights) until migration
 * F_001 runs, so readers go through getBodyMetrics(), never the raw fields.
 */

export const KG_PER_LB = 0.45359237
export const G_PER_OZ = 28.349523125
export const ML_PER_FL_OZ = 29.5735295625
export const CM_PER_IN = 2.54

const KG_TO_LB = 1 / KG_PER_LB
const CM_TO_IN = 1 / CM_PER_IN

const getUserDataObject = input => {
  if (!input || typeof input !== 'object') return {}
  if (input.userData && typeof input.userData === 'object')
    return input.userData
  return input
}

const toNumber = value => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value !== 'string') return null
  const s = value.trim().replace(',', '.')
  if (!/^[-+]?\d*\.?\d+$/.test(s)) return null
  return Number(s)
}

const legacyIsImperial = v => String(v || '').toUpperCase() === 'IMPERIAL'

/** The client's single unit preference. */
export const getUnitSystem = input => {
  const userData = getUserDataObject(input)
  if (userData.unitSystem === 'imperial' || userData.unitSystem === 'metric') {
    return userData.unitSystem
  }
  return legacyIsImperial(userData.selectedWeightMeasurementUnit) ||
    legacyIsImperial(userData.selectedTargetWeightMeasurementUnit) ||
    legacyIsImperial(userData.selectedHeightMeasurementUnit)
    ? 'imperial'
    : 'metric'
}

export const isImperialFromUserData = input =>
  getUnitSystem(input) === 'imperial'

/** Legacy "feet.inches" ("5.10" = 5'10") → cm; values >= 48 are already cm. */
export const legacyHeightToCm = (value, unit) => {
  const n = toNumber(value)
  if (n == null || n <= 0) return null
  if (!legacyIsImperial(unit) || n >= 48) return n
  const [feetRaw, inchRaw = '0'] = String(value)
    .trim()
    .replace(',', '.')
    .split('.')
  const inches = Math.min(11, Math.max(0, Number(inchRaw) || 0))
  return ((Number(feetRaw) || 0) * 12 + inches) * CM_PER_IN
}

export const legacyWeightToKg = (value, unit) => {
  const n = toNumber(value)
  if (n == null || n <= 0) return null
  return legacyIsImperial(unit) ? n * KG_PER_LB : n
}

/** Height/weight/target of a client in metric, whatever is stored. */
export const getBodyMetrics = input => {
  const ud = getUserDataObject(input)
  return {
    heightCm: legacyHeightToCm(
      ud.selectedHeight,
      ud.selectedHeightMeasurementUnit
    ),
    weightKg: legacyWeightToKg(
      ud.selectedWeight,
      ud.selectedWeightMeasurementUnit
    ),
    targetWeightKg: legacyWeightToKg(
      ud.selectedTargetWeight,
      ud.selectedTargetWeightMeasurementUnit
    )
  }
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

const trim = (v, decimals) => String(Number(v.toFixed(decimals)))

export const formatWeightByPreference = (kgValue, isImperial) => {
  const n = Number(kgValue)
  if (kgValue == null || kgValue === '' || !Number.isFinite(n)) return 'N/A'
  const v = isImperial ? convertKgToLb(n) : n
  return `${trim(v, 1)} ${isImperial ? 'lb' : 'kg'}`
}

/** Body measurements (waist, arm...). */
export const formatLengthByPreference = (cmValue, isImperial) => {
  const n = Number(cmValue)
  if (cmValue == null || cmValue === '' || !Number.isFinite(n)) return 'N/A'
  const v = isImperial ? convertCmToIn(n) : n
  return `${trim(v, 1)} ${isImperial ? 'in' : 'cm'}`
}

/** Height: "178 cm" or "5 ft 10 in" (was "5.10 in" for imperial clients). */
export const formatHeightByPreference = (cmValue, isImperial) => {
  const n = Number(cmValue)
  if (cmValue == null || cmValue === '' || !Number.isFinite(n) || n <= 0)
    return 'N/A'
  if (!isImperial) return `${Math.round(n)} cm`
  const totalInches = Math.round(n * CM_TO_IN)
  return `${Math.floor(totalInches / 12)} ft ${totalInches % 12} in`
}

const MASS_TO_G = {
  g: 1,
  gram: 1,
  grams: 1,
  kg: 1000,
  oz: G_PER_OZ,
  lb: 453.59237
}
const VOLUME_TO_ML = {
  ml: 1,
  milliliter: 1,
  millilitre: 1,
  l: 1000,
  'fl oz': ML_PER_FL_OZ
}

/** Food quantity in the client's preferred unit; descriptive servings pass through. */
export const convertFoodQuantityByPreference = (quantity, unit, isImperial) => {
  const q = Number(quantity)
  if (!Number.isFinite(q)) {
    return { quantity: 0, unit: unit || '' }
  }
  const rawUnit = String(unit || '')
    .toLowerCase()
    .trim()
  const massFactor = MASS_TO_G[rawUnit]
  const volumeFactor = VOLUME_TO_ML[rawUnit]
  if (massFactor) {
    const g = q * massFactor
    return isImperial
      ? { quantity: g / G_PER_OZ, unit: 'oz' }
      : { quantity: g, unit: 'g' }
  }
  if (volumeFactor) {
    const ml = q * volumeFactor
    return isImperial
      ? { quantity: ml / ML_PER_FL_OZ, unit: 'fl oz' }
      : { quantity: ml, unit: 'ml' }
  }
  return { quantity: q, unit: unit || '' }
}
