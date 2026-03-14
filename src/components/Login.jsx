import { useEffect, useMemo, useRef, useState } from 'react'
import {
  EyeIcon,
  EyeSlashIcon,
  LockClosedIcon,
  ChevronDownIcon,
  MagnifyingGlassIcon
} from '@heroicons/react/24/outline'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../contexts/AuthContext'
import {
  COUNTRY_OPTIONS,
  GOAL_OPTIONS,
  ACTIVITY_OPTIONS,
  GENDER_OPTIONS,
  FEMININ_OPTIONS,
  MEASUREMENT_SYSTEM_OPTIONS,
  createDefaultUserProfileForm,
  buildUserDataFromProfileForm,
  isPasswordValid
} from '../utils/userOnboardingProfile'

const languageOptions = [
  { value: 'en', label: 'English' },
  { value: 'fr', label: 'Français' },
  { value: 'es', label: 'Español' },
  { value: 'ro', label: 'Română' }
]

const SIGNUP_STEPS = ['profile', 'measurements', 'account']

const Login = () => {
  const { t, i18n } = useTranslation()
  const [isLogin, setIsLogin] = useState(true)
  const [signupStep, setSignupStep] = useState(0)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [signupProfileForm, setSignupProfileForm] = useState(
    createDefaultUserProfileForm()
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [successMessage, setSuccessMessage] = useState(null)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false)
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('')
  const [forgotPasswordError, setForgotPasswordError] = useState(null)
  const [forgotPasswordSuccess, setForgotPasswordSuccess] = useState(null)
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false)
  const [isCountryDropdownOpen, setIsCountryDropdownOpen] = useState(false)
  const [countrySearchTerm, setCountrySearchTerm] = useState('')
  const countryDropdownRef = useRef(null)

  const { login, register, resetPassword, signInWithGoogle } = useAuth()

  const resetFormFeedback = () => {
    setError(null)
    setSuccessMessage(null)
  }

  const resetSignupState = () => {
    setFullName('')
    setEmail('')
    setPassword('')
    setConfirmPassword('')
    setSignupStep(0)
    setSignupProfileForm(createDefaultUserProfileForm())
    setCountrySearchTerm('')
    setIsCountryDropdownOpen(false)
  }

  const sortedCountryOptions = useMemo(
    () =>
      [...COUNTRY_OPTIONS].sort((a, b) =>
        t(a.labelKey).localeCompare(t(b.labelKey))
      ),
    [t]
  )

  const filteredCountryOptions = useMemo(() => {
    const term = countrySearchTerm.trim().toLowerCase()
    if (!term) return sortedCountryOptions

    return sortedCountryOptions.filter(country => {
      return (
        t(country.labelKey).toLowerCase().includes(term) ||
        country.code.toLowerCase().includes(term)
      )
    })
  }, [countrySearchTerm, sortedCountryOptions, t])

  const selectedCountry = useMemo(
    () =>
      sortedCountryOptions.find(
        country => country.code === signupProfileForm.countryCode
      ) || null,
    [sortedCountryOptions, signupProfileForm.countryCode]
  )

  useEffect(() => {
    if (!isCountryDropdownOpen) {
      return undefined
    }

    const handlePointerDownOutside = event => {
      if (countryDropdownRef.current?.contains(event.target)) {
        return
      }

      setIsCountryDropdownOpen(false)
    }

    document.addEventListener('mousedown', handlePointerDownOutside)
    document.addEventListener('touchstart', handlePointerDownOutside)

    return () => {
      document.removeEventListener('mousedown', handlePointerDownOutside)
      document.removeEventListener('touchstart', handlePointerDownOutside)
    }
  }, [isCountryDropdownOpen])

  const updateSignupProfileForm = (field, value) => {
    setSignupProfileForm(prev => ({
      ...prev,
      [field]: value,
      ...(field === 'selectedHeightMeasurementUnit'
        ? value === 'METRIC'
          ? { selectedHeightFeet: '', selectedHeightInches: '' }
          : { selectedHeightMetric: '' }
        : {}),
      ...(field === 'selectedGender' && value !== 'FEMALE'
        ? { selectedFemininOption: 'NONE' }
        : {})
    }))
  }

  const buildSignupUserData = () =>
    buildUserDataFromProfileForm(signupProfileForm, {
      fullName: fullName.trim()
    })

  const validateAccountStep = () => {
    if (!email || !password || !fullName) {
      setError(t('login.validation.fillAllFields'))
      return false
    }

    if (password !== confirmPassword) {
      setError(t('login.validation.passwordsDoNotMatch'))
      return false
    }

    if (!isPasswordValid(password)) {
      setError(t('login.validation.passwordRequirements'))
      return false
    }

    return true
  }

  const handleSubmit = async e => {
    e.preventDefault()
    resetFormFeedback()

    if (isLogin) {
      if (!email || !password) {
        setError(t('login.validation.fillAllFields'))
        return
      }
    } else if (signupStep < SIGNUP_STEPS.length - 1) {
      setSignupStep(prev => Math.min(SIGNUP_STEPS.length - 1, prev + 1))
      return
    } else if (!validateAccountStep()) {
      return
    }

    setLoading(true)

    try {
      if (isLogin) {
        await login(email, password)
      } else {
        await register({
          email,
          password,
          fullName,
          userData: buildSignupUserData()
        })
      }
    } catch (err) {
      const errorMessage = err.message || 'An error occurred'
      if (errorMessage.includes('user-not-found')) {
        setError(t('login.errors.userNotFound'))
      } else if (errorMessage.includes('wrong-password')) {
        setError(t('login.errors.wrongPassword'))
      } else if (errorMessage.includes('email-already-in-use')) {
        setError(t('login.errors.emailInUse'))
      } else if (errorMessage.includes('invalid-email')) {
        setError(t('login.errors.invalidEmail'))
      } else if (errorMessage.includes('weak-password')) {
        setError(t('login.errors.weakPassword'))
      } else {
        setError(errorMessage)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    resetFormFeedback()
    if (!isLogin && signupStep !== SIGNUP_STEPS.length - 1) {
      setSignupStep(SIGNUP_STEPS.length - 1)
      return
    }

    if (!isLogin && signupStep === SIGNUP_STEPS.length - 1 && fullName.trim() === '') {
      setError(t('login.validation.fullNameOrGoogleProfile'))
      return
    }

    setLoading(true)
    try {
      if (isLogin) {
        await signInWithGoogle()
      } else {
        await signInWithGoogle({
          signupData: {
            fullName,
            userData: buildSignupUserData()
          }
        })
      }
    } catch (err) {
      const errorMessage = err.message || t('login.errors.googleSignInFailed')
      if (errorMessage.includes('popup-closed-by-user')) {
        setError(t('login.errors.signInCancelled'))
      } else if (errorMessage.includes('popup-blocked')) {
        setError(t('login.errors.popupBlocked'))
      } else {
        setError(errorMessage)
      }
    } finally {
      setLoading(false)
    }
  }

  const toggleMode = () => {
    setIsLogin(!isLogin)
    resetSignupState()
    resetFormFeedback()
    setPassword('')
    setConfirmPassword('')
  }

  const handleLanguageChange = e => {
    const lang = e.target.value
    i18n.changeLanguage(lang)
    try {
      localStorage.setItem('lang', lang)
    } catch (_) {}
  }

  const openForgotPassword = () => {
    setForgotPasswordEmail(email)
    setForgotPasswordError(null)
    setForgotPasswordSuccess(null)
    setForgotPasswordOpen(true)
  }

  const closeForgotPassword = () => {
    setForgotPasswordOpen(false)
    setForgotPasswordLoading(false)
    setForgotPasswordError(null)
    setForgotPasswordSuccess(null)
  }

  const handleForgotPasswordSubmit = async e => {
    e.preventDefault()
    setForgotPasswordError(null)
    setForgotPasswordSuccess(null)

    if (!forgotPasswordEmail) {
      setForgotPasswordError(t('login.validation.enterEmail'))
      return
    }

    setForgotPasswordLoading(true)
    try {
      await resetPassword(forgotPasswordEmail, i18n.language)
      setForgotPasswordSuccess(t('login.forgotPassword.success'))
    } catch (err) {
      const errorMessage = err.message || ''
      if (errorMessage.includes('user-not-found')) {
        setForgotPasswordError(t('login.errors.userNotFound'))
      } else if (errorMessage.includes('invalid-email')) {
        setForgotPasswordError(t('login.errors.invalidEmail'))
      } else {
        setForgotPasswordError(t('login.errors.forgotPasswordFailed'))
      }
    } finally {
      setForgotPasswordLoading(false)
    }
  }

  const renderSelectField = ({
    value,
    onChange,
    options,
    placeholder
  }) => (
    <div className="relative">
      <select
        value={value}
        onChange={onChange}
        className="w-full appearance-none rounded-2xl border border-[#d7dce7] bg-white px-4 py-3 pr-11 text-base text-[#1a2233] outline-none transition focus:border-[#7a56df] focus:ring-2 focus:ring-[#7a56df]/15"
      >
        {placeholder ? <option value="">{placeholder}</option> : null}
        {options.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDownIcon className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7d8698]" />
    </div>
  )

  const signupStepMeta = [
    {
      title: t('login.signupStepper.profile.title'),
      subtitle: t('login.signupStepper.profile.subtitle')
    },
    {
      title: t('login.signupStepper.measurements.title'),
      subtitle: t('login.signupStepper.measurements.subtitle')
    },
    {
      title: t('login.signupStepper.account.title'),
      subtitle: t('login.signupStepper.account.subtitle')
    }
  ]

  return (
    <>
      <div className="min-h-screen bg-[#f4f4f6] px-4 py-8">
        <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-2xl items-center">
          <div className="w-full rounded-[28px] border border-[#ececf2] bg-white px-6 py-5 shadow-[0_20px_60px_rgba(23,25,35,0.08)] md:px-8 md:py-7">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div className="rounded-2xl bg-[#eeecff] p-3 text-[#6b63ff]">
                <LockClosedIcon className="h-6 w-6" />
              </div>
              <div className="w-28">
                <select
                  id="auth-language"
                  value={i18n.language}
                  onChange={handleLanguageChange}
                  className="w-full rounded-xl border border-[#e7e7ee] bg-[#fafafe] px-3 py-2 text-xs font-medium text-[#5d6472] outline-none transition focus:border-[#6b63ff]"
                >
                  {languageOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mb-6">
              <h1 className="text-[1.8rem] font-semibold tracking-[-0.03em] text-[#171923]">
                {isLogin
                  ? t('login.welcomeBackTitle')
                  : t('login.createAccountHeading')}
              </h1>
              <p className="mt-1 text-sm text-[#8a90a2]">
                {isLogin
                  ? t('login.welcomeBackSubtitle')
                  : t('login.createAccountSubtitle')}
              </p>
            </div>

            {!isLogin && (
              <div className="mb-6 rounded-[24px] border border-[#ece8ff] bg-[#faf8ff] p-4">
                <div className="flex items-center gap-3">
                  {signupStepMeta.map((step, index) => {
                    const isActive = signupStep === index
                    const isCompleted = signupStep > index
                    return (
                      <div
                        key={SIGNUP_STEPS[index]}
                        className="flex min-w-0 flex-1 items-center gap-3"
                      >
                        <div
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                            isActive || isCompleted
                              ? 'bg-[#6b63ff] text-white'
                              : 'border border-[#d8dcee] bg-white text-[#98a0b3]'
                          }`}
                        >
                          {index + 1}
                        </div>
                        <div className="min-w-0">
                          <p
                            className={`truncate text-xs font-semibold uppercase tracking-[0.16em] ${
                              isActive
                                ? 'text-[#6b63ff]'
                                : 'text-[#98a0b3]'
                            }`}
                          >
                            {step.title}
                          </p>
                        </div>
                        {index < signupStepMeta.length - 1 ? (
                          <div className="h-px flex-1 bg-[#deddf0]" />
                        ) : null}
                      </div>
                    )
                  })}
                </div>
                <p className="mt-3 text-sm text-[#7f8798]">
                  {signupStepMeta[signupStep].subtitle}
                </p>
                <p className="mt-2 text-xs text-[#6b63ff]">
                  {t('login.signupStepper.optionalHint')}
                </p>
              </div>
            )}

            <form className="space-y-4" onSubmit={handleSubmit}>
              {error && (
                <div className="rounded-2xl border border-[#ffd6d6] bg-[#fff5f5] px-4 py-3 text-sm text-[#d44747]">
                  {error}
                </div>
              )}

              {successMessage && (
                <div className="rounded-2xl border border-[#d8f0db] bg-[#f3fff4] px-4 py-3 text-sm text-[#287a3e]">
                  {successMessage}
                </div>
              )}

              {isLogin ? (
                <>
                  <div className="space-y-2">
                    <label
                      htmlFor="email"
                      className="block text-xs font-medium text-[#5d6472]"
                    >
                      {t('login.emailLabel')}
                    </label>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      className="w-full rounded-2xl border border-[#e6e7ef] bg-[#fbfbfe] px-4 py-3 text-sm text-[#171923] outline-none transition placeholder:text-[#b2b7c4] focus:border-[#6b63ff]"
                      placeholder={t('login.emailPlaceholder')}
                    />
                  </div>

                  <div className="space-y-2">
                    <label
                      htmlFor="password"
                      className="block text-xs font-medium text-[#5d6472]"
                    >
                      {t('login.passwordLabel')}
                    </label>
                    <div className="relative">
                      <input
                        id="password"
                        name="password"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="current-password"
                        required
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        className="w-full rounded-2xl border border-[#e6e7ef] bg-[#fbfbfe] px-4 py-3 pr-12 text-sm text-[#171923] outline-none transition placeholder:text-[#b2b7c4] focus:border-[#6b63ff]"
                        placeholder={t('login.passwordPlaceholder')}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-[#9aa0ae]"
                      >
                        {showPassword ? (
                          <EyeSlashIcon className="h-5 w-5" />
                        ) : (
                          <EyeIcon className="h-5 w-5" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={openForgotPassword}
                      className="text-xs font-medium text-[#6b63ff]"
                    >
                      {t('login.forgotPassword.link')}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {signupStep === 0 && (
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2 md:col-span-2">
                        <label className="block text-xs font-medium text-[#5d6472]">
                          {t('pages.myUsers.createClient.fields.country')}
                        </label>
                        <div ref={countryDropdownRef} className="relative">
                          <button
                            type="button"
                            onClick={() =>
                              setIsCountryDropdownOpen(prev => !prev)
                            }
                            className="flex w-full items-center justify-between rounded-2xl border border-[#d7dce7] bg-white px-4 py-3 text-left text-base text-[#1a2233] outline-none transition focus:border-[#7a56df] focus:ring-2 focus:ring-[#7a56df]/15"
                          >
                            <div className="min-w-0">
                              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#7a8397]">
                                {selectedCountry?.flag ||
                                  signupProfileForm.countryCode}
                              </div>
                              <div className="truncate text-sm font-semibold text-[#1a2233]">
                                {selectedCountry
                                  ? t(selectedCountry.labelKey)
                                  : t(
                                      'pages.myUsers.createClient.placeholders.country'
                                    )}
                              </div>
                            </div>
                            <ChevronDownIcon className="h-4 w-4 shrink-0 text-[#7d8698]" />
                          </button>

                          {isCountryDropdownOpen && (
                            <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-2xl border border-[#d7dce7] bg-white shadow-[0_20px_45px_rgba(15,23,42,0.12)]">
                              <div className="border-b border-[#edf0f5] p-3">
                                <div className="relative">
                                  <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#98a2b3]" />
                                  <input
                                    type="text"
                                    value={countrySearchTerm}
                                    onChange={e =>
                                      setCountrySearchTerm(e.target.value)
                                    }
                                    placeholder={t(
                                      'pages.myUsers.createClient.placeholders.searchCountry'
                                    )}
                                    className="w-full rounded-xl border border-[#d7dce7] bg-[#fafbfd] py-2.5 pl-9 pr-3 text-sm text-[#1a2233] outline-none transition focus:border-[#7a56df] focus:ring-2 focus:ring-[#7a56df]/15"
                                  />
                                </div>
                              </div>
                              <div className="max-h-60 overflow-y-auto p-2">
                                {filteredCountryOptions.length === 0 ? (
                                  <div className="px-3 py-2 text-sm text-[#74809a]">
                                    {t(
                                      'pages.myUsers.createClient.noCountryFound'
                                    )}
                                  </div>
                                ) : (
                                  filteredCountryOptions.map(country => (
                                    <button
                                      key={country.code}
                                      type="button"
                                      onClick={() => {
                                        updateSignupProfileForm(
                                          'countryCode',
                                          country.code
                                        )
                                        setIsCountryDropdownOpen(false)
                                        setCountrySearchTerm('')
                                      }}
                                      className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left transition ${
                                        signupProfileForm.countryCode ===
                                        country.code
                                          ? 'bg-[#f4efff] text-[#382e66]'
                                          : 'text-[#1a2233] hover:bg-[#f6f8fc]'
                                      }`}
                                    >
                                      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[#7a8397]">
                                        {country.flag}
                                      </span>
                                      <span className="ml-3 flex-1 text-sm font-medium">
                                        {t(country.labelKey)}
                                      </span>
                                    </button>
                                  ))
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="block text-xs font-medium text-[#5d6472]">
                          {t('pages.myUsers.createClient.fields.goal')}
                        </label>
                        {renderSelectField({
                          value: signupProfileForm.selectedGoalType,
                          onChange: e =>
                            updateSignupProfileForm(
                              'selectedGoalType',
                              e.target.value
                            ),
                          options: GOAL_OPTIONS.map(option => ({
                            value: option.value,
                            label: t(
                              `pages.myUsers.createClient.options.goal.${option.value}`
                            )
                          })),
                          placeholder: t(
                            'pages.myUsers.createClient.fields.goal'
                          )
                        })}
                      </div>

                      <div className="space-y-2">
                        <label className="block text-xs font-medium text-[#5d6472]">
                          {t('pages.myUsers.createClient.fields.activity')}
                        </label>
                        {renderSelectField({
                          value: signupProfileForm.selectedActivityType,
                          onChange: e =>
                            updateSignupProfileForm(
                              'selectedActivityType',
                              e.target.value
                            ),
                          options: ACTIVITY_OPTIONS.map(option => ({
                            value: option.value,
                            label: t(
                              `pages.myUsers.createClient.options.activity.${option.value}`
                            )
                          })),
                          placeholder: t(
                            'pages.myUsers.createClient.fields.activity'
                          )
                        })}
                      </div>

                      <div className="space-y-2">
                        <label className="block text-xs font-medium text-[#5d6472]">
                          {t('pages.myUsers.createClient.fields.sex')}
                        </label>
                        {renderSelectField({
                          value: signupProfileForm.selectedGender,
                          onChange: e =>
                            updateSignupProfileForm(
                              'selectedGender',
                              e.target.value
                            ),
                          options: GENDER_OPTIONS.map(option => ({
                            value: option.value,
                            label: t(
                              `pages.myUsers.createClient.options.sex.${option.value}`
                            )
                          })),
                          placeholder: t('pages.myUsers.createClient.fields.sex')
                        })}
                      </div>

                      <div className="space-y-2">
                        <label className="block text-xs font-medium text-[#5d6472]">
                          {t('pages.myUsers.createClient.fields.birthDate')}
                        </label>
                        <input
                          type="date"
                          value={signupProfileForm.selectedBirthDate}
                          onChange={e =>
                            updateSignupProfileForm(
                              'selectedBirthDate',
                              e.target.value
                            )
                          }
                          className="w-full rounded-2xl border border-[#d7dce7] bg-white px-4 py-3 text-base text-[#1a2233] outline-none transition focus:border-[#7a56df] focus:ring-2 focus:ring-[#7a56df]/15"
                        />
                      </div>

                      {signupProfileForm.selectedGender === 'FEMALE' && (
                        <div className="space-y-2 md:col-span-2">
                          <label className="block text-xs font-medium text-[#5d6472]">
                            {t(
                              'pages.myUsers.createClient.fields.femininOption'
                            )}
                          </label>
                          {renderSelectField({
                            value: signupProfileForm.selectedFemininOption,
                            onChange: e =>
                              updateSignupProfileForm(
                                'selectedFemininOption',
                                e.target.value
                              ),
                            options: FEMININ_OPTIONS.map(option => ({
                              value: option.value,
                              label: t(
                                `pages.myUsers.createClient.options.feminin.${option.value}`
                              )
                            }))
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {signupStep === 1 && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="block text-xs font-medium text-[#5d6472]">
                          {t('pages.myUsers.createClient.fields.system')}
                        </label>
                        {renderSelectField({
                          value:
                            signupProfileForm.selectedHeightMeasurementUnit,
                          onChange: e => {
                            updateSignupProfileForm(
                              'selectedHeightMeasurementUnit',
                              e.target.value
                            )
                            updateSignupProfileForm(
                              'selectedWeightMeasurementUnit',
                              e.target.value
                            )
                          },
                          options: MEASUREMENT_SYSTEM_OPTIONS.map(option => ({
                            value: option.value,
                            label: t(
                              `pages.myUsers.createClient.options.measurement.${option.value}`
                            )
                          }))
                        })}
                      </div>

                      <div className="grid gap-4 md:grid-cols-3">
                        <div className="space-y-2">
                          <label className="block text-xs font-medium text-[#5d6472]">
                            {t('pages.myUsers.createClient.fields.height')}
                          </label>
                          {signupProfileForm.selectedHeightMeasurementUnit ===
                          'IMPERIAL' ? (
                            <div className="grid grid-cols-2 gap-3">
                              <input
                                type="number"
                                min="0"
                                step="1"
                                value={signupProfileForm.selectedHeightFeet}
                                onChange={e =>
                                  updateSignupProfileForm(
                                    'selectedHeightFeet',
                                    e.target.value
                                  )
                                }
                                className="w-full rounded-2xl border border-[#d7dce7] bg-white px-4 py-3 text-base text-[#1a2233] outline-none transition focus:border-[#7a56df] focus:ring-2 focus:ring-[#7a56df]/15"
                                placeholder={t(
                                  'pages.myUsers.createClient.placeholders.heightFeet'
                                )}
                              />
                              <input
                                type="number"
                                min="0"
                                step="1"
                                value={signupProfileForm.selectedHeightInches}
                                onChange={e =>
                                  updateSignupProfileForm(
                                    'selectedHeightInches',
                                    e.target.value
                                  )
                                }
                                className="w-full rounded-2xl border border-[#d7dce7] bg-white px-4 py-3 text-base text-[#1a2233] outline-none transition focus:border-[#7a56df] focus:ring-2 focus:ring-[#7a56df]/15"
                                placeholder={t(
                                  'pages.myUsers.createClient.placeholders.heightInches'
                                )}
                              />
                            </div>
                          ) : (
                            <div className="relative">
                              <input
                                type="number"
                                min="0"
                                step="0.1"
                                value={signupProfileForm.selectedHeightMetric}
                                onChange={e =>
                                  updateSignupProfileForm(
                                    'selectedHeightMetric',
                                    e.target.value
                                  )
                                }
                                className="w-full rounded-2xl border border-[#d7dce7] bg-white px-4 py-3 pr-14 text-base text-[#1a2233] outline-none transition focus:border-[#7a56df] focus:ring-2 focus:ring-[#7a56df]/15"
                                placeholder={t(
                                  'pages.myUsers.createClient.placeholders.heightMetric'
                                )}
                              />
                              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-[#8a93a7]">
                                cm
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="space-y-2">
                          <label className="block text-xs font-medium text-[#5d6472]">
                            {t('pages.myUsers.createClient.fields.weight')}
                          </label>
                          <div className="relative">
                            <input
                              type="number"
                              min="0"
                              step="0.1"
                              value={signupProfileForm.selectedWeight}
                              onChange={e =>
                                updateSignupProfileForm(
                                  'selectedWeight',
                                  e.target.value
                                )
                              }
                              className="w-full rounded-2xl border border-[#d7dce7] bg-white px-4 py-3 pr-14 text-base text-[#1a2233] outline-none transition focus:border-[#7a56df] focus:ring-2 focus:ring-[#7a56df]/15"
                              placeholder={t(
                                signupProfileForm.selectedWeightMeasurementUnit ===
                                  'METRIC'
                                  ? 'pages.myUsers.createClient.placeholders.weightMetric'
                                  : 'pages.myUsers.createClient.placeholders.weightImperial'
                              )}
                            />
                            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-[#8a93a7]">
                              {signupProfileForm.selectedWeightMeasurementUnit ===
                              'METRIC'
                                ? 'kg'
                                : 'lbs'}
                            </span>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="block text-xs font-medium text-[#5d6472]">
                            {t(
                              'pages.myUsers.createClient.fields.objectiveWeight'
                            )}
                          </label>
                          <div className="relative">
                            <input
                              type="number"
                              min="0"
                              step="0.1"
                              value={signupProfileForm.selectedTargetWeight}
                              onChange={e =>
                                updateSignupProfileForm(
                                  'selectedTargetWeight',
                                  e.target.value
                                )
                              }
                              className="w-full rounded-2xl border border-[#d7dce7] bg-white px-4 py-3 pr-14 text-base text-[#1a2233] outline-none transition focus:border-[#7a56df] focus:ring-2 focus:ring-[#7a56df]/15"
                              placeholder={t(
                                signupProfileForm.selectedWeightMeasurementUnit ===
                                  'METRIC'
                                  ? 'pages.myUsers.createClient.placeholders.objectiveWeightMetric'
                                  : 'pages.myUsers.createClient.placeholders.objectiveWeightImperial'
                              )}
                            />
                            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-[#8a93a7]">
                              {signupProfileForm.selectedWeightMeasurementUnit ===
                              'METRIC'
                                ? 'kg'
                                : 'lbs'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  {signupStep === 2 && (
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2 md:col-span-2">
                        <label
                          htmlFor="fullName"
                          className="block text-xs font-medium text-[#5d6472]"
                        >
                          {t('login.fullNameLabel')}
                        </label>
                        <input
                          id="fullName"
                          name="fullName"
                          type="text"
                          autoComplete="name"
                          required
                          value={fullName}
                          onChange={e => setFullName(e.target.value)}
                          className="w-full rounded-2xl border border-[#e6e7ef] bg-[#fbfbfe] px-4 py-3 text-sm text-[#171923] outline-none transition placeholder:text-[#b2b7c4] focus:border-[#6b63ff]"
                          placeholder={t('login.fullNamePlaceholder')}
                        />
                      </div>
                      <div className="space-y-2">
                        <label
                          htmlFor="email"
                          className="block text-xs font-medium text-[#5d6472]"
                        >
                          {t('login.emailLabel')}
                        </label>
                        <input
                          id="email"
                          name="email"
                          type="email"
                          autoComplete="email"
                          required
                          value={email}
                          onChange={e => setEmail(e.target.value)}
                          className="w-full rounded-2xl border border-[#e6e7ef] bg-[#fbfbfe] px-4 py-3 text-sm text-[#171923] outline-none transition placeholder:text-[#b2b7c4] focus:border-[#6b63ff]"
                          placeholder={t('login.emailPlaceholder')}
                        />
                      </div>
                      <div className="space-y-2">
                        <label
                          htmlFor="password"
                          className="block text-xs font-medium text-[#5d6472]"
                        >
                          {t('login.passwordLabel')}
                        </label>
                        <div className="relative">
                          <input
                            id="password"
                            name="password"
                            type={showPassword ? 'text' : 'password'}
                            autoComplete="new-password"
                            required
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            className="w-full rounded-2xl border border-[#e6e7ef] bg-[#fbfbfe] px-4 py-3 pr-12 text-sm text-[#171923] outline-none transition placeholder:text-[#b2b7c4] focus:border-[#6b63ff]"
                            placeholder={t('login.passwordPlaceholder')}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-[#9aa0ae]"
                          >
                            {showPassword ? (
                              <EyeSlashIcon className="h-5 w-5" />
                            ) : (
                              <EyeIcon className="h-5 w-5" />
                            )}
                          </button>
                        </div>
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <label
                          htmlFor="confirmPassword"
                          className="block text-xs font-medium text-[#5d6472]"
                        >
                          {t('login.confirmPasswordLabel')}
                        </label>
                        <div className="relative">
                          <input
                            id="confirmPassword"
                            name="confirmPassword"
                            type={showConfirmPassword ? 'text' : 'password'}
                            autoComplete="new-password"
                            required
                            value={confirmPassword}
                            onChange={e => setConfirmPassword(e.target.value)}
                            className="w-full rounded-2xl border border-[#e6e7ef] bg-[#fbfbfe] px-4 py-3 pr-12 text-sm text-[#171923] outline-none transition placeholder:text-[#b2b7c4] focus:border-[#6b63ff]"
                            placeholder={t('login.confirmPasswordPlaceholder')}
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setShowConfirmPassword(!showConfirmPassword)
                            }
                            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-[#9aa0ae]"
                          >
                            {showConfirmPassword ? (
                              <EyeSlashIcon className="h-5 w-5" />
                            ) : (
                              <EyeIcon className="h-5 w-5" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}

              <div className="flex flex-col gap-3 pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-2xl bg-[#6b63ff] px-4 py-3 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(107,99,255,0.28)] transition hover:bg-[#5c54f1] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading
                    ? t('login.pleaseWait')
                    : isLogin
                      ? t('login.signInButton')
                      : signupStep < SIGNUP_STEPS.length - 1
                        ? t('login.signupStepper.next')
                        : t('login.createAccountButton')}
                </button>

                {!isLogin && signupStep > 0 && (
                  <button
                    type="button"
                    onClick={() => setSignupStep(prev => Math.max(0, prev - 1))}
                    className="w-full rounded-2xl border border-[#e6e7ef] bg-white px-4 py-3 text-sm font-semibold text-[#171923] transition hover:bg-[#fafafe]"
                  >
                    {t('login.signupStepper.back')}
                  </button>
                )}
              </div>

              {(isLogin || signupStep === SIGNUP_STEPS.length - 1) && (
                <>
                  <div className="relative py-2">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-[#ececf2]" />
                    </div>
                    <div className="relative flex justify-center">
                      <span className="bg-white px-4 text-[11px] font-medium uppercase tracking-[0.18em] text-[#b0b5c3]">
                        {t('login.orContinueWith')}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    disabled={loading}
                    className="flex w-full items-center justify-center rounded-2xl border border-[#e6e7ef] bg-white px-4 py-3 text-sm font-medium text-[#171923] transition hover:bg-[#fafafe] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <svg className="mr-3 h-5 w-5" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      />
                    </svg>
                    {isLogin
                      ? t('login.continueWithGoogle')
                      : t('login.signUpWithGoogle')}
                  </button>
                </>
              )}

              <div className="pt-1 text-center text-xs text-[#8a90a2]">
                {isLogin
                  ? t('login.signUpPromptPrefix')
                  : t('login.signInPromptPrefix')}{' '}
                <button
                  type="button"
                  onClick={toggleMode}
                  className="font-semibold text-[#6b63ff]"
                >
                  {isLogin ? t('login.signUpCta') : t('login.signInCta')}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {forgotPasswordOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#171923]/40 px-4">
          <div className="w-full max-w-sm rounded-[28px] bg-white p-6 shadow-[0_30px_80px_rgba(23,25,35,0.18)]">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-[#171923]">
                  {t('login.forgotPassword.title')}
                </h2>
                <p className="mt-1 text-sm text-[#8a90a2]">
                  {t('login.forgotPassword.description')}
                </p>
              </div>
              <button
                type="button"
                onClick={closeForgotPassword}
                className="text-sm font-medium text-[#8a90a2]"
              >
                {t('common.close')}
              </button>
            </div>

            <form className="space-y-4" onSubmit={handleForgotPasswordSubmit}>
              <div className="space-y-2">
                <label
                  htmlFor="forgot-email"
                  className="block text-xs font-medium text-[#5d6472]"
                >
                  {t('login.emailLabel')}
                </label>
                <input
                  id="forgot-email"
                  type="email"
                  autoComplete="email"
                  value={forgotPasswordEmail}
                  onChange={e => setForgotPasswordEmail(e.target.value)}
                  className="w-full rounded-2xl border border-[#e6e7ef] bg-[#fbfbfe] px-4 py-3 text-sm text-[#171923] outline-none transition placeholder:text-[#b2b7c4] focus:border-[#6b63ff]"
                  placeholder={t('login.emailPlaceholder')}
                />
              </div>

              {forgotPasswordError && (
                <div className="rounded-2xl border border-[#ffd6d6] bg-[#fff5f5] px-4 py-3 text-sm text-[#d44747]">
                  {forgotPasswordError}
                </div>
              )}

              {forgotPasswordSuccess && (
                <div className="rounded-2xl border border-[#d8f0db] bg-[#f3fff4] px-4 py-3 text-sm text-[#287a3e]">
                  {forgotPasswordSuccess}
                </div>
              )}

              <button
                type="submit"
                disabled={forgotPasswordLoading}
                className="w-full rounded-2xl bg-[#6b63ff] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#5c54f1] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {forgotPasswordLoading
                  ? t('login.pleaseWait')
                  : t('login.forgotPassword.sendButton')}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  )
}

export default Login
