export const COUNTRY_OPTIONS = [
  { code: 'DE', labelKey: 'common.countries.DE', flag: 'DE' },
  { code: 'ES', labelKey: 'common.countries.ES', flag: 'ES' },
  { code: 'FR', labelKey: 'common.countries.FR', flag: 'FR' },
  { code: 'HU', labelKey: 'common.countries.HU', flag: 'HU' },
  { code: 'IT', labelKey: 'common.countries.IT', flag: 'IT' },
  { code: 'RO', labelKey: 'common.countries.RO', flag: 'RO' },
  { code: 'UK', labelKey: 'common.countries.UK', flag: 'GB' },
  { code: 'US', labelKey: 'common.countries.US', flag: 'US' }
]

export const GOAL_OPTIONS = [
  { value: 'LOSE_WEIGHT', labelKey: 'goal.LOSE_WEIGHT' },
  { value: 'MAINTAIN_WEIGHT', labelKey: 'goal.MAINTAIN_WEIGHT' },
  { value: 'GAIN_WEIGHT', labelKey: 'goal.GAIN_WEIGHT' }
]

export const ACTIVITY_OPTIONS = [
  { value: 'NOT_ACTIVE', labelKey: 'activity.NOT_ACTIVE' },
  { value: 'LIGHTLY_ACTIVE', labelKey: 'activity.LIGHTLY_ACTIVE' },
  { value: 'ACTIVE', labelKey: 'activity.ACTIVE' },
  { value: 'VERY_ACTIVE', labelKey: 'activity.VERY_ACTIVE' }
]

export const GENDER_OPTIONS = [
  { value: 'MALE', labelKey: 'sex.MALE' },
  { value: 'FEMALE', labelKey: 'sex.FEMALE' },
  { value: 'OTHER', labelKey: 'sex.OTHER' }
]

export const FEMININ_OPTIONS = [
  { value: 'NONE', labelKey: 'feminin.NONE' },
  { value: 'PREGNANT', labelKey: 'feminin.PREGNANT' },
  { value: 'BREASTFEEDING', labelKey: 'feminin.BREASTFEEDING' }
]

export const MEASUREMENT_SYSTEM_OPTIONS = [
  { value: 'METRIC', labelKey: 'measurement.METRIC' },
  { value: 'IMPERIAL', labelKey: 'measurement.IMPERIAL' }
]

export const getDefaultCountryCode = () => {
  if (typeof window === 'undefined') {
    return 'US'
  }

  const localeCandidates = [
    window.navigator?.language,
    ...(Array.isArray(window.navigator?.languages)
      ? window.navigator.languages
      : [])
  ].filter(Boolean)

  for (const locale of localeCandidates) {
    const region = String(locale)
      .split('-')[1]
      ?.toUpperCase()

    if (!region) continue

    const normalizedRegion = region === 'GB' ? 'UK' : region
    if (COUNTRY_OPTIONS.some(country => country.code === normalizedRegion)) {
      return normalizedRegion
    }
  }

  return 'US'
}

export const createDefaultUserProfileForm = ({
  countryCode = getDefaultCountryCode(),
  selectedGoalType = '',
  selectedActivityType = '',
  selectedGender = '',
  selectedFemininOption = 'NONE',
  selectedHeightMeasurementUnit = 'METRIC',
  selectedWeightMeasurementUnit = 'METRIC'
} = {}) => ({
  countryCode,
  selectedGoalType,
  selectedActivityType,
  selectedGender,
  selectedFemininOption,
  selectedBirthDate: '',
  selectedHeightMetric: '',
  selectedHeightFeet: '',
  selectedHeightInches: '',
  selectedHeightMeasurementUnit,
  selectedWeight: '',
  selectedWeightMeasurementUnit,
  selectedTargetWeight: ''
})

const parseOptionalNumber = value => {
  if (value === '' || value === null || value === undefined) {
    return null
  }

  const parsedValue = Number(value)
  return Number.isFinite(parsedValue) ? parsedValue : null
}

export const buildUserDataFromProfileForm = (form, { fullName = '' } = {}) => {
  const isImperialHeight = form.selectedHeightMeasurementUnit === 'IMPERIAL'
  const selectedHeight = isImperialHeight
    ? parseOptionalNumber(
        `${parseOptionalNumber(form.selectedHeightFeet) || 0}.${
          parseOptionalNumber(form.selectedHeightInches) || 0
        }`
      )
    : parseOptionalNumber(form.selectedHeightMetric)

  const selectedGender = form.selectedGender || null
  const selectedWeightMeasurementUnit =
    form.selectedWeightMeasurementUnit || 'METRIC'

  return {
    name: fullName || null,
    displayName: fullName || null,
    countryCode: form.countryCode || null,
    selectedGoalType: form.selectedGoalType || null,
    selectedActivityType: form.selectedActivityType || null,
    selectedGender,
    selectedFemininOption:
      selectedGender === 'FEMALE'
        ? form.selectedFemininOption || 'NONE'
        : null,
    selectedBirthDate: form.selectedBirthDate || null,
    selectedHeight,
    selectedHeightMeasurementUnit:
      form.selectedHeightMeasurementUnit || 'METRIC',
    selectedWeight: parseOptionalNumber(form.selectedWeight),
    selectedWeightMeasurementUnit,
    selectedTargetWeight: parseOptionalNumber(form.selectedTargetWeight),
    selectedTargetWeightMeasurementUnit: selectedWeightMeasurementUnit
  }
}

export const getLocalizedOptions = (options, t, baseKey) =>
  options.map(option => ({
    ...option,
    label: t(`${baseKey}.${option.labelKey.split('.').pop()}`)
  }))

export const isPasswordValid = password =>
  /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*\W).{5,}$/.test(
    String(password || '')
  )
