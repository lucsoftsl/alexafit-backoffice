import { useState } from 'react'
import {
  EyeIcon,
  EyeSlashIcon,
  LockClosedIcon
} from '@heroicons/react/24/outline'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../contexts/AuthContext'

const languageOptions = [
  { value: 'en', label: 'English' },
  { value: 'fr', label: 'Français' },
  { value: 'es', label: 'Español' },
  { value: 'ro', label: 'Română' }
]

const welcomeImageSrc = `${import.meta.env.BASE_URL}assets/welcome.png`

const Login = () => {
  const { t, i18n } = useTranslation()
  const [isLogin, setIsLogin] = useState(true)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
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

  const { login, register, resetPassword, signInWithGoogle } = useAuth()

  const resetFormFeedback = () => {
    setError(null)
    setSuccessMessage(null)
  }

  const handleSubmit = async e => {
    e.preventDefault()
    resetFormFeedback()

    if (!email || !password || (!isLogin && !fullName)) {
      setError(t('login.validation.fillAllFields'))
      return
    }

    if (!isLogin && password !== confirmPassword) {
      setError(t('login.validation.passwordsDoNotMatch'))
      return
    }

    if (password.length < 6) {
      setError(t('login.validation.passwordTooShort'))
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
          fullName
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
    setLoading(true)
    try {
      await signInWithGoogle()
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
    setFullName('')
    setPassword('')
    setConfirmPassword('')
    resetFormFeedback()
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

  return (
    <>
      <div className="min-h-screen bg-[#f4f4f6] px-4 py-8">
        <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-sm items-center">
          <div className="w-full rounded-[28px] border border-[#ececf2] bg-white px-6 py-5 shadow-[0_20px_60px_rgba(23,25,35,0.08)]">
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
                {isLogin ? t('login.welcomeBackTitle') : t('login.createAccountHeading')}
              </h1>
              <p className="mt-1 text-sm text-[#8a90a2]">
                {isLogin ? t('login.welcomeBackSubtitle') : t('login.createAccountSubtitle')}
              </p>
            </div>

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

              {!isLogin && (
                <div className="space-y-2">
                  <label htmlFor="fullName" className="block text-xs font-medium text-[#5d6472]">
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
                  <p className="text-xs text-[#6b63ff]">
                    {t('login.nutritionistOnlyHint')}
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <label htmlFor="email" className="block text-xs font-medium text-[#5d6472]">
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
                <label htmlFor="password" className="block text-xs font-medium text-[#5d6472]">
                  {t('login.passwordLabel')}
                </label>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete={isLogin ? 'current-password' : 'new-password'}
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

              {isLogin && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={openForgotPassword}
                    className="text-xs font-medium text-[#6b63ff]"
                  >
                    {t('login.forgotPassword.link')}
                  </button>
                </div>
              )}

              {!isLogin && (
                <div className="space-y-2">
                  <label htmlFor="confirmPassword" className="block text-xs font-medium text-[#5d6472]">
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
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
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
              )}

              <button
                type="submit"
                disabled={loading}
                className="mt-2 w-full rounded-2xl bg-[#6b63ff] px-4 py-3 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(107,99,255,0.28)] transition hover:bg-[#5c54f1] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading
                  ? t('login.pleaseWait')
                  : isLogin
                    ? t('login.signInButton')
                    : t('login.createAccountButton')}
              </button>

              {isLogin && (
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
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    {t('login.continueWithGoogle')}
                  </button>
                </>
              )}

              <div className="pt-1 text-center text-xs text-[#8a90a2]">
                {isLogin ? t('login.signUpPromptPrefix') : t('login.signInPromptPrefix')}{' '}
                <button
                  type="button"
                  onClick={toggleMode}
                  className="font-semibold text-[#6b63ff]"
                >
                  {isLogin ? t('login.signUpCta') : t('login.signInCta')}
                </button>
              </div>
            </form>

            <div className="mt-6 h-24 overflow-hidden rounded-[24px] border border-[#ececf2] bg-[#f6f4ff]">
              <img
                src={welcomeImageSrc}
                alt="Welcome"
                className="h-full w-full object-cover"
              />
            </div>
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
                <label htmlFor="forgot-email" className="block text-xs font-medium text-[#5d6472]">
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
