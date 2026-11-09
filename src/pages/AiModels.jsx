import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import {
  ClockIcon,
  CpuChipIcon,
  CurrencyDollarIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  LifebuoyIcon
} from '@heroicons/react/24/outline'

import CollapsibleSection from '../components/admin/CollapsibleSection'
import RefreshButton from '../components/admin/RefreshButton'
import Skeleton from '../components/admin/Skeleton'
import StatTile from '../components/admin/StatTile'
import UpdatedAgo from '../components/admin/UpdatedAgo'
import { colorForKey, MAX_SERIES } from '../components/admin/chartTheme'
import {
  formatMs,
  formatNumber,
  formatPercent,
  formatUsd
} from '../components/admin/format'
import useAdminResource from '../components/admin/useAdminResource'
import {
  getAiSettings,
  getAiUsage,
  saveAiSettings,
  testAiModel
} from '../services/adminApi'
import { selectIsAdmin } from '../store/userSlice'

import AiUserDrawer from './ai/AiUserDrawer'
import DefaultsPanel from './ai/DefaultsPanel'
import FeatureRow from './ai/FeatureRow'
import PriceTable from './ai/PriceTable'
import PlanLimitsPanel from './ai/PlanLimitsPanel'
import ProvidersPanel from './ai/ProvidersPanel'
import RapidApiModels, { rapidApiRoles } from './ai/RapidApiModels'
import UsageByUsers from './ai/UsageByUsers'
import UsageCharts from './ai/UsageCharts'
import {
  draftFromSettings,
  effectiveFor,
  isSameDraft,
  payloadFromDraft,
  updateDefaultModel,
  updateDefaults,
  updateFeature,
  updatePricing
} from './ai/aiDraft'

const DAY_MS = 86_400_000
const RANGES = [7, 30, 90]

const Banner = ({ tone = 'info', children }) => {
  const styles = {
    info: 'border-sky-200 bg-sky-50 text-sky-900',
    warn: 'border-amber-200 bg-amber-50 text-amber-900',
    bad: 'border-rose-200 bg-rose-50 text-rose-900'
  }
  const Icon = tone === 'info' ? InformationCircleIcon : ExclamationTriangleIcon
  return (
    <div
      className={`af-enter flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm ${styles[tone]}`}
      role={tone === 'bad' ? 'alert' : 'status'}
    >
      <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
      <div>{children}</div>
    </div>
  )
}

/** Admin › AI: per-feature provider/model with fallback, caps, usage, prices. */
const AiModels = () => {
  const { t, i18n } = useTranslation()
  const locale = i18n.language
  const isAdmin = useSelector(selectIsAdmin)
  const [rangeDays, setRangeDays] = useState(30)
  const [draft, setDraft] = useState(null)
  const [baseline, setBaseline] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [savedAt, setSavedAt] = useState(null)
  const [tests, setTests] = useState({})
  const [drawerUserId, setDrawerUserId] = useState(null)
  const closeDrawer = useCallback(() => setDrawerUserId(null), [])

  const settings = useAdminResource(
    ({ refresh }) => getAiSettings({ refresh }),
    { enabled: isAdmin }
  )
  const usage = useAdminResource(
    () =>
      getAiUsage({
        from: new Date(Date.now() - rangeDays * DAY_MS).toISOString(),
        to: new Date().toISOString()
      }),
    { enabled: isAdmin }
  )
  const { reload: reloadUsage } = usage

  const firstRange = useRef(true)
  useEffect(() => {
    if (firstRange.current) {
      firstRange.current = false
      return
    }
    reloadUsage()
  }, [rangeDays, reloadUsage])

  const data = settings.data
  const features = useMemo(() => data?.features || [], [data])
  const providers = useMemo(() => data?.providers || [], [data])
  const providersById = useMemo(
    () => Object.fromEntries(providers.map(p => [p.id, p])),
    [providers]
  )
  const featureIds = useMemo(() => features.map(f => f.id), [features])
  const coloredFeatureIds = useMemo(
    () => featureIds.slice(0, MAX_SERIES),
    [featureIds]
  )
  const colorFor = useCallback(
    id => colorForKey(id, coloredFeatureIds),
    [coloredFeatureIds]
  )
  const featureLabel = useCallback(
    id =>
      features.find(f => f.id === id)?.label ||
      (id === 'admin_test' ? t('admin.ai.adminTest') : id),
    [features, t]
  )
  const providerLabel = useCallback(
    id => providersById[id]?.label || id || t('admin.ai.none'),
    [providersById, t]
  )

  // Take the server's settings as the draft unless the admin is mid-edit.
  const baselineRef = useRef(null)
  useEffect(() => {
    if (!data) return
    const next = draftFromSettings(data.settings, featureIds)
    const previous = baselineRef.current
    baselineRef.current = next
    setBaseline(next)
    setDraft(prev =>
      prev && previous && !isSameDraft(prev, previous) ? prev : next
    )
  }, [data, featureIds])

  const dirty = Boolean(draft && baseline && !isSameDraft(draft, baseline))

  const effectiveById = useMemo(() => {
    if (!draft) return {}
    return Object.fromEntries(
      features.map(f => [f.id, effectiveFor(draft, f, providersById)])
    )
  }, [draft, features, providersById])

  const modelsInUse = useMemo(() => {
    const set = new Set()
    Object.values(effectiveById).forEach(e => {
      if (e.primary?.provider === 'gemini') set.add(e.primary.model)
      if (e.fallback?.provider === 'gemini') set.add(e.fallback.model)
    })
    return set
  }, [effectiveById])

  const rapidRows = useMemo(() => data?.rapidapi?.rows || [], [data])
  const rapidInUse = useMemo(() => {
    const roles = rapidApiRoles(features, effectiveById, featureLabel, t)
    return rapidRows.filter(r => roles.has(r.model)).length
  }, [rapidRows, features, effectiveById, featureLabel, t])
  const geminiInUse = useMemo(
    () => (data?.prices || []).filter(p => modelsInUse.has(p.model)).length,
    [data, modelsInUse]
  )
  const countMeta = (count, inUse) =>
    [
      t('admin.ai.sections.models', { count }),
      inUse ? t('admin.ai.sections.inUse', { count: inUse }) : null
    ]
      .filter(Boolean)
      .join(' · ')

  const usageByFeature = useMemo(
    () =>
      Object.fromEntries(
        (usage.data?.byFeature || []).map(f => [f.feature, f])
      ),
    [usage.data]
  )

  const totals = usage.data?.totals
  const slowestP95 = useMemo(
    () =>
      Math.max(
        0,
        ...(usage.data?.byFeature || []).map(f => f.latency?.p95 || 0)
      ),
    [usage.data]
  )

  const handleSave = async () => {
    if (!draft) return
    setSaving(true)
    setSaveError(null)
    try {
      await saveAiSettings(payloadFromDraft(draft))
      setSavedAt(new Date().toISOString())
      baselineRef.current = draft
      setBaseline(draft)
      settings.reload()
      window.setTimeout(() => setSavedAt(null), 3000)
    } catch (error) {
      setSaveError(error)
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async (featureId, { provider, model }) => {
    setTests(prev => ({ ...prev, [featureId]: { pending: true } }))
    try {
      const result = await testAiModel({ provider, model })
      setTests(prev => ({ ...prev, [featureId]: result }))
      reloadUsage()
    } catch (error) {
      setTests(prev => ({
        ...prev,
        [featureId]: {
          ok: false,
          errorCode: error.code || 'ERROR',
          message: error.message
        }
      }))
    }
  }

  const refreshAll = () => {
    settings.reload(true)
    reloadUsage()
  }

  if (!isAdmin) return null

  const errorRate = totals?.calls ? totals.errors / totals.calls : null
  const fallbackRate = totals?.calls
    ? totals.fallbackCalls / totals.calls
    : null

  return (
    <div className="af-enter space-y-8 pb-24">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-violet-600">
            {t('admin.ai.eyebrow')}
          </p>
          <h1 className="mt-1 text-4xl font-semibold tracking-tight text-slate-900">
            {t('admin.ai.title')}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            {t('admin.ai.subtitle')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div
            role="tablist"
            aria-label={t('admin.ai.range')}
            className="flex rounded-full border border-slate-200 bg-white p-1"
          >
            {RANGES.map(days => (
              <button
                key={days}
                type="button"
                role="tab"
                aria-selected={rangeDays === days}
                onClick={() => setRangeDays(days)}
                className={`af-focus af-press rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                  rangeDays === days
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t('admin.ai.lastDays', { count: days })}
              </button>
            ))}
          </div>
          <UpdatedAgo at={usage.updatedAt} />
          <RefreshButton
            onClick={refreshAll}
            loading={settings.refreshing || usage.refreshing}
            label={t('admin.common.refresh')}
          />
        </div>
      </header>

      <div className="space-y-3">
        {data?.meta?.readError ? (
          <Banner tone="bad">
            {t('admin.ai.readError', { code: data.meta.readError })}
          </Banner>
        ) : data && !data.meta?.saved ? (
          <Banner>{t('admin.ai.nothingSaved')}</Banner>
        ) : null}
        {settings.error ? (
          <Banner tone="bad">
            {t('admin.ai.loadFailed')} ({settings.error.message})
          </Banner>
        ) : null}
        {usage.error?.code === 'USAGE_TABLE_MISSING' ? (
          <Banner tone="warn">{t('admin.ai.usageTableMissing')}</Banner>
        ) : null}
      </div>

      <section
        aria-label={t('admin.ai.summary')}
        className="grid grid-cols-2 gap-4 lg:grid-cols-12"
      >
        <StatTile
          className="col-span-2 lg:col-span-4"
          size="lg"
          label={t('admin.ai.spend', { count: rangeDays })}
          value={totals ? totals.costUsd : null}
          format={v => formatUsd(v, locale)}
          loading={usage.loading}
          icon={CurrencyDollarIcon}
          hint={t('admin.ai.spendHint')}
        />
        <StatTile
          className="lg:col-span-2"
          label={t('admin.ai.calls')}
          value={totals ? totals.calls : null}
          format={v => formatNumber(v, locale)}
          loading={usage.loading}
          icon={CpuChipIcon}
        />
        <StatTile
          className="lg:col-span-2"
          label={t('admin.ai.errorRate')}
          value={errorRate}
          format={v => formatPercent(v, locale)}
          tone={
            errorRate > 0.05 ? 'bad' : errorRate > 0.01 ? 'warn' : 'default'
          }
          loading={usage.loading}
          icon={ExclamationTriangleIcon}
        />
        <StatTile
          className="lg:col-span-2"
          label={t('admin.ai.fallbackRate')}
          value={fallbackRate}
          format={v => formatPercent(v, locale)}
          tone={fallbackRate > 0.2 ? 'warn' : 'default'}
          loading={usage.loading}
          icon={LifebuoyIcon}
        />
        <StatTile
          className="lg:col-span-2"
          label={t('admin.ai.slowestP95')}
          value={totals ? slowestP95 : null}
          format={formatMs}
          loading={usage.loading}
          icon={ClockIcon}
        />
      </section>

      <CollapsibleSection
        id="ai-usage"
        title={t('admin.ai.sections.usage')}
        meta={
          totals
            ? t('admin.ai.sections.calls', {
                count: totals.calls,
                formatted: formatNumber(totals.calls, locale)
              })
            : null
        }
      >
        <UsageCharts
          usage={usage.data}
          loading={usage.loading}
          coloredFeatureIds={coloredFeatureIds}
          colorFor={colorFor}
          featureLabel={featureLabel}
        />
      </CollapsibleSection>

      <CollapsibleSection id="ai-usage-users" title={t('admin.ai.users.title')}>
        <UsageByUsers
          rangeDays={rangeDays}
          featureLabel={featureLabel}
          onOpenUser={setDrawerUserId}
        />
      </CollapsibleSection>

      <CollapsibleSection
        id="ai-plan-limits"
        title={t('admin.ai.plan.title')}
        defaultOpen={false}
      >
        <PlanLimitsPanel />
      </CollapsibleSection>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-12">
        <CollapsibleSection
          id="ai-features"
          className="xl:col-span-8"
          title={t('admin.ai.features')}
          hint={t('admin.ai.featuresHint')}
          meta={
            features.length
              ? t('admin.ai.sections.features', { count: features.length })
              : null
          }
        >
          {settings.loading || !draft ? (
            <div className="space-y-4">
              {[0, 1, 2].map(i => (
                <Skeleton key={i} className="h-44 rounded-3xl" />
              ))}
            </div>
          ) : (
            <ul className="space-y-4">
              {features.map(feature => (
                <FeatureRow
                  key={feature.id}
                  feature={feature}
                  value={draft.features[feature.id]}
                  providers={providers}
                  providerLabel={providerLabel}
                  effective={effectiveById[feature.id]}
                  color={colorFor(feature.id)}
                  usage={usageByFeature[feature.id]}
                  testResult={tests[feature.id]}
                  onChange={patch =>
                    setDraft(d => updateFeature(d, feature.id, patch))
                  }
                  onTest={pair => handleTest(feature.id, pair)}
                />
              ))}
            </ul>
          )}
        </CollapsibleSection>

        <aside className="space-y-6 xl:col-span-4">
          {draft && data ? (
            <>
              <CollapsibleSection
                id="ai-defaults"
                title={t('admin.ai.defaults')}
              >
                <DefaultsPanel
                  draft={draft}
                  builtIn={data.builtIn}
                  providers={providers}
                  onModel={(id, model) =>
                    setDraft(d => updateDefaultModel(d, id, model))
                  }
                  onDefaults={patch => setDraft(d => updateDefaults(d, patch))}
                  onPricing={patch => setDraft(d => updatePricing(d, patch))}
                />
              </CollapsibleSection>
              <CollapsibleSection
                id="ai-providers"
                title={t('admin.ai.providers')}
                meta={t('admin.ai.sections.configured', {
                  count: providers.filter(p => p.configured).length,
                  total: providers.length
                })}
              >
                <ProvidersPanel
                  providers={providers}
                  cooldowns={data.cooldowns || []}
                  gone={data.gone}
                />
              </CollapsibleSection>
            </>
          ) : (
            <Skeleton className="h-96 rounded-3xl" />
          )}
        </aside>
      </div>

      {data ? (
        <>
          <CollapsibleSection
            id="ai-prices-gemini"
            title={t('admin.ai.prices')}
            defaultOpen={false}
            meta={countMeta((data.prices || []).length, geminiInUse)}
          >
            <PriceTable
              prices={data.prices}
              inUse={modelsInUse}
              fetchedAt={data.pricesFetchedAt}
              error={data.pricesError}
              source={data.pricesSource}
              googlePricing={data.googlePricing}
              onRefresh={() => settings.reload(true)}
              refreshing={settings.refreshing}
            />
          </CollapsibleSection>
          <CollapsibleSection
            id="ai-prices-rapidapi"
            title={t('admin.ai.rapid.title')}
            defaultOpen={false}
            meta={countMeta(rapidRows.length, rapidInUse)}
          >
            <RapidApiModels
              rapidapi={data.rapidapi}
              features={features}
              effectiveById={effectiveById}
              featureLabel={featureLabel}
              usage={usage.data}
              onRefreshed={() => settings.reload()}
            />
          </CollapsibleSection>
        </>
      ) : null}

      {drawerUserId ? (
        <AiUserDrawer
          userId={drawerUserId}
          onClose={closeDrawer}
          featureLabel={featureLabel}
        />
      ) : null}

      {dirty || saveError || savedAt ? (
        <div className="sticky bottom-4 z-20">
          <div className="af-enter mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900 px-5 py-3 text-sm text-white shadow-2xl">
            <p role="status">
              {saveError
                ? saveError.code === 'SETTINGS_TABLE_MISSING'
                  ? t('admin.ai.tableMissing')
                  : t('admin.ai.saveFailed', {
                      details: (saveError.details || [saveError.message]).join(
                        '; '
                      )
                    })
                : dirty
                  ? t('admin.ai.unsaved')
                  : t('admin.ai.saved')}
            </p>
            <div className="flex items-center gap-2">
              {dirty ? (
                <button
                  type="button"
                  onClick={() => {
                    setDraft(baseline)
                    setSaveError(null)
                  }}
                  className="af-press af-focus rounded-full px-4 py-1.5 font-medium text-slate-300 hover:text-white"
                >
                  {t('admin.ai.discard')}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setSavedAt(null)
                    setSaveError(null)
                  }}
                  className="af-press af-focus rounded-full px-4 py-1.5 font-medium text-slate-300 hover:text-white"
                >
                  {t('admin.common.dismiss')}
                </button>
              )}
              {dirty ? (
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="af-press af-focus rounded-full bg-violet-500 px-4 py-1.5 font-semibold text-white hover:bg-violet-400 disabled:opacity-60"
                >
                  {saving ? t('admin.ai.saving') : t('admin.ai.save')}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default AiModels
