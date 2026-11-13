import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { getAppConfig, saveAppConfig } from '../services/adminApi'

const APP_CHECK_MODES = ['off', 'monitor', 'enforce']

const Toggle = ({ checked, disabled, onChange, label }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    disabled={disabled}
    onClick={() => onChange(!checked)}
    className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:opacity-50 ${
      checked ? 'bg-indigo-600' : 'bg-gray-300'
    }`}
  >
    <span
      className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
        checked ? 'translate-x-6' : 'translate-x-1'
      }`}
    />
  </button>
)

const ControlRow = ({ title, description, checked, disabled, onChange }) => (
  <div className="flex items-start justify-between gap-6 py-4">
    <div>
      <p className="font-medium text-gray-900">{title}</p>
      {description && (
        <p className="mt-1 text-sm text-gray-600">{description}</p>
      )}
    </div>
    <Toggle
      checked={checked}
      disabled={disabled}
      onChange={onChange}
      label={title}
    />
  </div>
)

/** Admin switches read by the native apps through getConfigurations. */
const AppControls = () => {
  const { t } = useTranslation()
  const [config, setConfig] = useState(null)
  const [tourIds, setTourIds] = useState([])
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState(null)

  const load = useCallback(async signal => {
    setError(null)
    try {
      const data = await getAppConfig({ signal })
      setConfig(data.config)
      setTourIds(data.tourIds)
    } catch (err) {
      if (err.name !== 'AbortError') setError(err.message)
    }
  }, [])

  useEffect(() => {
    const controller = new window.AbortController()
    load(controller.signal)
    return () => controller.abort()
  }, [load])

  const save = async next => {
    const previous = config
    setConfig(next)
    setIsSaving(true)
    setError(null)
    try {
      const data = await saveAppConfig(next)
      setConfig(data.config)
    } catch (err) {
      setConfig(previous)
      setError(
        err.code === 'SETTINGS_TABLE_MISSING'
          ? t('admin.appControls.tableMissing')
          : t('admin.appControls.saveFailed')
      )
    } finally {
      setIsSaving(false)
    }
  }

  const setTours = patch =>
    save({ ...config, appTours: { ...config.appTours, ...patch } })

  // Older saved configs may lack orbHunt; mirror the server default (on).
  const orbHunt = {
    enabled: true,
    exploreEnabled: true,
    appCheck: 'monitor',
    ...(config?.orbHunt || {})
  }
  const setOrbHunt = patch =>
    save({ ...config, orbHunt: { ...orbHunt, ...patch } })

  // Same for sliceGame (added after orbHunt).
  const sliceGame = { enabled: true, ...(config?.sliceGame || {}) }
  const setSliceGame = patch =>
    save({ ...config, sliceGame: { ...sliceGame, ...patch } })

  // Same for quickLauncher (added after sliceGame).
  const quickLauncher = { enabled: true, ...(config?.quickLauncher || {}) }
  const setQuickLauncher = patch =>
    save({ ...config, quickLauncher: { ...quickLauncher, ...patch } })

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="text-3xl font-semibold">
          {t('admin.appControls.title')}
        </h1>
        <p className="mt-1 text-gray-600">{t('admin.appControls.subtitle')}</p>
      </header>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {error}
        </div>
      )}

      {!config ? (
        !error && (
          <p className="text-gray-500">{t('admin.appControls.loading')}</p>
        )
      ) : (
        <>
          <section className="rounded-2xl border border-gray-200 bg-white px-6 py-2 shadow-sm">
            <ControlRow
              title={t('admin.appControls.ota.title')}
              description={t('admin.appControls.ota.description')}
              checked={config.otaEnabled}
              disabled={isSaving}
              onChange={otaEnabled => save({ ...config, otaEnabled })}
            />
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white px-6 py-2 shadow-sm">
            <ControlRow
              title={t('admin.appControls.tours.title')}
              description={t('admin.appControls.tours.description')}
              checked={config.appTours.enabled}
              disabled={isSaving}
              onChange={enabled => setTours({ enabled })}
            />
            <div className="divide-y divide-gray-100 border-t border-gray-100">
              {tourIds.map(id => (
                <ControlRow
                  key={id}
                  title={t(`admin.appControls.tours.pages.${id}`)}
                  checked={config.appTours.pages[id]}
                  disabled={isSaving || !config.appTours.enabled}
                  onChange={value =>
                    setTours({
                      pages: { ...config.appTours.pages, [id]: value }
                    })
                  }
                />
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white px-6 py-2 shadow-sm">
            <ControlRow
              title={t('admin.appControls.sliceGame.title')}
              description={t('admin.appControls.sliceGame.description')}
              checked={sliceGame.enabled}
              disabled={isSaving}
              onChange={enabled => setSliceGame({ enabled })}
            />
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white px-6 py-2 shadow-sm">
            <ControlRow
              title={t('admin.appControls.quickLauncher.title')}
              description={t('admin.appControls.quickLauncher.description')}
              checked={quickLauncher.enabled}
              disabled={isSaving}
              onChange={enabled => setQuickLauncher({ enabled })}
            />
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white px-6 py-2 shadow-sm">
            <ControlRow
              title={t('admin.appControls.orbHunt.title')}
              description={t('admin.appControls.orbHunt.description')}
              checked={orbHunt.enabled}
              disabled={isSaving}
              onChange={enabled => setOrbHunt({ enabled })}
            />
            <div className="border-t border-gray-100">
              <ControlRow
                title={t('admin.appControls.orbHunt.exploreTitle')}
                description={t('admin.appControls.orbHunt.exploreDescription')}
                checked={orbHunt.exploreEnabled}
                disabled={isSaving || !orbHunt.enabled}
                onChange={exploreEnabled => setOrbHunt({ exploreEnabled })}
              />
            </div>
            <fieldset
              className="border-t border-gray-100 py-4"
              disabled={isSaving || !orbHunt.enabled}
            >
              <legend className="sr-only">
                {t('admin.appControls.orbHunt.appCheckTitle')}
              </legend>
              <p className="font-medium text-gray-900">
                {t('admin.appControls.orbHunt.appCheckTitle')}
              </p>
              <p className="mt-0.5 text-sm text-gray-600">
                {t('admin.appControls.orbHunt.appCheckDescription')}
              </p>
              <div
                role="radiogroup"
                className="mt-3 inline-flex rounded-xl border border-gray-200 bg-gray-50 p-1"
              >
                {APP_CHECK_MODES.map(mode => {
                  const active = (orbHunt.appCheck || 'monitor') === mode
                  return (
                    <button
                      key={mode}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => !active && setOrbHunt({ appCheck: mode })}
                      className={`rounded-lg px-4 py-1.5 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-50 ${
                        active
                          ? mode === 'enforce'
                            ? 'bg-emerald-600 text-white shadow-sm'
                            : 'bg-white text-gray-900 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      {t(`admin.appControls.orbHunt.appCheckModes.${mode}`)}
                    </button>
                  )
                })}
              </div>
              <p className="mt-2 text-xs text-gray-500">
                {t(
                  `admin.appControls.orbHunt.appCheckHelp.${orbHunt.appCheck || 'monitor'}`
                )}
              </p>
            </fieldset>
          </section>
        </>
      )}
    </div>
  )
}

export default AppControls
