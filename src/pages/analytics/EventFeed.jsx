import { useEffect, useMemo, useRef, useState } from 'react'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import {
  Area,
  Bar,
  BarChart,
  Brush,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  ArrowPathIcon,
  ChartBarIcon,
  ExclamationTriangleIcon,
  ServerStackIcon,
  SparklesIcon
} from '@heroicons/react/24/outline'

import { useAuth } from '../../contexts/AuthContext'
import { selectIsAdmin } from '../../store/userSlice'
import { getBackofficeAnalyticsFeed } from '../../services/loggedinApi'
import Skeleton from '../../components/admin/Skeleton'
import StatTile from '../../components/admin/StatTile'
import { chartAnimation } from '../../components/admin/motion'

import BreakdownBarCard from './BreakdownBarCard'
import TopUsersCard from './TopUsersCard'

import {
  TIME_RANGE_OPTIONS,
  ANALYTICS_KIND_COLORS,
  ANALYTICS_SERIES_KEYS,
  getBucketMinutes,
  truncateToBucket,
  formatBucketLabel,
  safePrettyJson,
  truncateLabel,
  formatEndpointLabel,
  parseAnalyticsUserIdentifier,
  buildCountRows,
  getRangeLabel,
  renderTimelineTooltip
} from './eventFeedUtils'

const EventFeed = ({ refreshSignal = 0 }) => {
  const { t } = useTranslation()
  const { currentUser } = useAuth()
  const isAdmin = useSelector(selectIsAdmin)
  const [lookbackWindow, setLookbackWindow] = useState('7d')
  const [sourceFilter, setSourceFilter] = useState('ALL')
  const [websiteActionFilter, setWebsiteActionFilter] = useState('ALL')
  const [websiteButtonFilter, setWebsiteButtonFilter] = useState('ALL')
  const [refreshTick, setRefreshTick] = useState(0)
  const [timeframeMenuOpen, setTimeframeMenuOpen] = useState(false)
  const [timeframeSearch, setTimeframeSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [analyticsFeed, setAnalyticsFeed] = useState({ rows: [], meta: {} })
  const [pendingBucketKey, setPendingBucketKey] = useState(null)
  const [confirmedBucketKey, setConfirmedBucketKey] = useState(null)
  const [selectedBucketKindFilter, setSelectedBucketKindFilter] =
    useState('ALL')
  const [showAllTopUsers, setShowAllTopUsers] = useState(false)
  const [zoomRange, setZoomRange] = useState({ startIndex: 0, endIndex: 0 })
  const [dragSelection, setDragSelection] = useState({
    startKey: null,
    endKey: null
  })
  const [visibleSeries, setVisibleSeries] = useState({
    TOTAL: true,
    API_FAILURE: true,
    APP_FAILURE: true,
    UI_INTERACTION: true,
    PRODUCT_ANALYTICS: true,
    API_EVENT: true,
    OTHER: false
  })
  const suppressNextClickRef = useRef(false)
  const chartAnim = useMemo(() => chartAnimation(), [])

  useEffect(() => {
    if (!isAdmin || !currentUser?.uid) {
      setLoading(false)
      return
    }

    let isMounted = true

    const loadAnalytics = async () => {
      try {
        setLoading(true)
        setError(null)

        const response = await getBackofficeAnalyticsFeed({
          userId: currentUser.uid,
          lookbackWindow
        })

        if (!isMounted) {
          return
        }

        const payload = response?.data || response || {}
        setAnalyticsFeed({
          rows: Array.isArray(payload?.rows) ? payload.rows : [],
          meta: payload?.meta || {}
        })
      } catch (err) {
        if (!isMounted) {
          return
        }

        setError(err?.message || t('pages.analytics.errors.loadFailed'))
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    loadAnalytics()

    return () => {
      isMounted = false
    }
  }, [currentUser?.uid, isAdmin, lookbackWindow, refreshTick, refreshSignal, t])

  const analyticsRows = analyticsFeed?.rows || []

  // Filter rows by source. 'WEBSITE' = version === 'website', 'APP' = everything else.
  const activeRows = useMemo(() => {
    if (sourceFilter === 'WEBSITE')
      return analyticsRows.filter(r => r.version === 'website')
    if (sourceFilter === 'APP')
      return analyticsRows.filter(r => r.version !== 'website')
    return analyticsRows
  }, [analyticsRows, sourceFilter])

  // Reset website sub-filters whenever the source filter changes
  useEffect(() => {
    setWebsiteActionFilter('ALL')
    setWebsiteButtonFilter('ALL')
  }, [sourceFilter])

  // All distinct button names present in the current website rows (for the dropdown)
  const availableButtonNames = useMemo(() => {
    if (sourceFilter !== 'WEBSITE') return []
    const names = new Set()
    for (const row of activeRows) {
      if (row.action === 'button_click' && row.details?.button) {
        names.add(row.details.button)
      }
    }
    return Array.from(names).sort()
  }, [sourceFilter, activeRows])

  // Rows fed into the timeline — further narrowed by the website action/button filters
  const timelineRows = useMemo(() => {
    if (sourceFilter !== 'WEBSITE') return activeRows
    let rows = activeRows
    if (websiteActionFilter !== 'ALL') {
      rows = rows.filter(r => r.action === websiteActionFilter)
    }
    if (websiteButtonFilter !== 'ALL') {
      rows = rows.filter(r => r.details?.button === websiteButtonFilter)
    }
    return rows
  }, [sourceFilter, activeRows, websiteActionFilter, websiteButtonFilter])

  const emailRows = useMemo(
    () =>
      activeRows.filter(row => {
        const action = (row.action || row.message || '').toLowerCase()
        return (
          action.includes('email') ||
          action.includes('sendwelcome') ||
          action.includes('sendnormal') ||
          action.includes('sendprogram') ||
          action.includes('reminder')
        )
      }),
    [activeRows]
  )
  const analyticsMeta = analyticsFeed?.meta || {}

  const timelineBuckets = useMemo(() => {
    const bucketMinutes = getBucketMinutes(lookbackWindow)
    const grouped = new Map()

    timelineRows.forEach(row => {
      const bucketDate = truncateToBucket(row?.createdAt, bucketMinutes)
      if (!bucketDate) {
        return
      }

      const bucketKey = bucketDate.toISOString()
      if (!grouped.has(bucketKey)) {
        grouped.set(bucketKey, {
          bucketKey,
          bucketDate: bucketKey,
          label: formatBucketLabel(bucketDate, lookbackWindow),
          total: 0,
          TOTAL: 0,
          API_FAILURE: 0,
          APP_FAILURE: 0,
          UI_INTERACTION: 0,
          PRODUCT_ANALYTICS: 0,
          API_EVENT: 0,
          OTHER: 0,
          rows: []
        })
      }

      const bucket = grouped.get(bucketKey)
      const kind = row?.analyticsKind || 'OTHER'
      bucket.total += 1
      bucket.TOTAL += 1
      bucket[kind] = (bucket[kind] || 0) + 1
      bucket.rows.push(row)
    })

    const sortedBuckets = [...grouped.values()].sort(
      (a, b) =>
        new Date(a.bucketDate).getTime() - new Date(b.bucketDate).getTime()
    )

    return sortedBuckets
  }, [timelineRows, lookbackWindow])

  useEffect(() => {
    const hasConfirmedBucket = timelineBuckets.some(
      bucket => bucket.bucketKey === confirmedBucketKey
    )
    const hasPendingBucket = timelineBuckets.some(
      bucket => bucket.bucketKey === pendingBucketKey
    )

    if (!hasConfirmedBucket) {
      setConfirmedBucketKey(null)
    }

    if (!hasPendingBucket) {
      setPendingBucketKey(null)
    }
  }, [confirmedBucketKey, pendingBucketKey, timelineBuckets])

  useEffect(() => {
    if (timelineBuckets.length === 0) {
      setZoomRange({ startIndex: 0, endIndex: 0 })
      return
    }

    setZoomRange({
      startIndex: 0,
      endIndex: timelineBuckets.length - 1
    })
  }, [timelineBuckets])

  const isZoomed =
    timelineBuckets.length > 0 &&
    (zoomRange.startIndex > 0 ||
      zoomRange.endIndex < timelineBuckets.length - 1)

  const selectedBucketIndex = timelineBuckets.findIndex(
    bucket => bucket.bucketKey === confirmedBucketKey
  )
  const selectedBucket =
    selectedBucketIndex >= 0 ? timelineBuckets[selectedBucketIndex] : null
  const pendingBucket = timelineBuckets.find(
    bucket => bucket.bucketKey === pendingBucketKey
  )

  // When a source filter is active, derive breakdowns from activeRows so counts stay accurate.
  // When showing all sources (filter = 'ALL'), use the server-provided meta for efficiency.
  const isFiltered = sourceFilter !== 'ALL'

  const analyticsKindRows = useMemo(() => {
    if (!isFiltered)
      return buildCountRows(analyticsMeta?.analyticsKindCounts, 'kind')
    const counts = {}
    for (const row of activeRows) {
      const kind = row.analyticsKind || 'OTHER'
      counts[kind] = (counts[kind] || 0) + 1
    }
    return buildCountRows(counts, 'kind')
  }, [isFiltered, analyticsMeta?.analyticsKindCounts, activeRows])

  const deviceRows = useMemo(() => {
    if (!isFiltered)
      return buildCountRows(analyticsMeta?.deviceTypeCounts, 'device')
    const counts = {}
    for (const row of activeRows) {
      const device = row.deviceType || row.phone || 'Unknown'
      counts[device] = (counts[device] || 0) + 1
    }
    return buildCountRows(counts, 'device')
  }, [isFiltered, analyticsMeta?.deviceTypeCounts, activeRows])

  const sourceRows = useMemo(() => {
    if (!isFiltered)
      return buildCountRows(analyticsMeta?.sourcePlatformCounts, 'source')
    const counts = {}
    for (const row of activeRows) {
      const src = row.sourcePlatform || 'UNKNOWN'
      counts[src] = (counts[src] || 0) + 1
    }
    return buildCountRows(counts, 'source')
  }, [isFiltered, analyticsMeta?.sourcePlatformCounts, activeRows])

  const endpointRows = useMemo(() => {
    if (!isFiltered) {
      return buildCountRows(analyticsMeta?.endpointCounts, 'endpoint')
        .map(row => ({
          ...row,
          endpointDisplay: formatEndpointLabel(row.endpoint)
        }))
        .slice(0, 10)
    }
    const counts = {}
    for (const row of activeRows) {
      const ep = row.endpoint || row.details?.url || row.message || 'N/A'
      counts[ep] = (counts[ep] || 0) + 1
    }
    return buildCountRows(counts, 'endpoint')
      .map(row => ({
        ...row,
        endpointDisplay: formatEndpointLabel(row.endpoint)
      }))
      .slice(0, 10)
  }, [isFiltered, analyticsMeta?.endpointCounts, activeRows])

  const appVersionRows = useMemo(() => {
    if (!isFiltered)
      return buildCountRows(analyticsMeta?.appVersionCounts, 'version').slice(
        0,
        10
      )
    const counts = {}
    for (const row of activeRows) {
      const v = row.version || 'unknown'
      counts[v] = (counts[v] || 0) + 1
    }
    return buildCountRows(counts, 'version').slice(0, 10)
  }, [isFiltered, analyticsMeta?.appVersionCounts, activeRows])
  const topUserRows = useMemo(() => {
    const counts = activeRows.reduce((acc, row) => {
      const key = row?.userID || 'Unknown'
      acc[key] = (acc[key] || 0) + 1
      return acc
    }, {})

    return buildCountRows(counts, 'userId').map(row => ({
      ...row,
      ...parseAnalyticsUserIdentifier(row.userId)
    }))
  }, [activeRows])
  const visibleTopUserRows = useMemo(
    () => (showAllTopUsers ? topUserRows : topUserRows.slice(0, 8)),
    [showAllTopUsers, topUserRows]
  )

  const selectedBucketRows = selectedBucket?.rows || []
  const selectedBucketKindOptions = useMemo(() => {
    const kinds = [
      ...new Set(selectedBucketRows.map(row => row?.analyticsKind || 'OTHER'))
    ]
    return ['ALL', ...kinds]
  }, [selectedBucketRows])
  const filteredSelectedBucketRows = useMemo(() => {
    if (selectedBucketKindFilter === 'ALL') {
      return selectedBucketRows
    }

    return selectedBucketRows.filter(
      row => (row?.analyticsKind || 'OTHER') === selectedBucketKindFilter
    )
  }, [selectedBucketKindFilter, selectedBucketRows])
  const filteredTimeRangeOptions = TIME_RANGE_OPTIONS.filter(option =>
    option.label.toLowerCase().includes(timeframeSearch.toLowerCase())
  )
  const dragSelectionVisible =
    dragSelection.startKey &&
    dragSelection.endKey &&
    dragSelection.startKey !== dragSelection.endKey
  const isDraggingTimeline = Boolean(dragSelection.startKey)

  useEffect(() => {
    setSelectedBucketKindFilter('ALL')
  }, [confirmedBucketKey])

  const handleSeriesSelection = kind => {
    setVisibleSeries(current => {
      if (kind === 'TOTAL') {
        return ANALYTICS_SERIES_KEYS.reduce(
          (next, seriesKey) => ({
            ...next,
            [seriesKey]: true
          }),
          {}
        )
      }

      const visibleNonTotalSeries = ANALYTICS_SERIES_KEYS.filter(
        seriesKey => seriesKey !== 'TOTAL' && current[seriesKey]
      )
      const isOnlySelectedSeries =
        current[kind] &&
        visibleNonTotalSeries.length === 1 &&
        visibleNonTotalSeries[0] === kind

      if (isOnlySelectedSeries) {
        return ANALYTICS_SERIES_KEYS.reduce(
          (next, seriesKey) => ({
            ...next,
            [seriesKey]: true
          }),
          {}
        )
      }

      return ANALYTICS_SERIES_KEYS.reduce(
        (next, seriesKey) => ({
          ...next,
          [seriesKey]: seriesKey === kind
        }),
        {}
      )
    })
  }

  const openPendingBucketFromState = state => {
    const bucketKey =
      state?.payload?.bucketKey ||
      state?.activePayload?.[0]?.payload?.bucketKey ||
      state?.activeLabel

    if (bucketKey) {
      setPendingBucketKey(bucketKey)
    }
  }

  const handleChartMouseDown = state => {
    const bucketKey = state?.activeLabel
    if (!bucketKey) {
      return
    }

    suppressNextClickRef.current = false
    setDragSelection({
      startKey: bucketKey,
      endKey: bucketKey
    })
  }

  const handleChartMouseMove = state => {
    const bucketKey = state?.activeLabel
    if (!dragSelection.startKey || !bucketKey) {
      return
    }

    if (bucketKey !== dragSelection.startKey) {
      suppressNextClickRef.current = true
    }

    setDragSelection(current => ({
      ...current,
      endKey: bucketKey
    }))
  }

  const handleChartMouseUp = () => {
    if (!dragSelection.startKey || !dragSelection.endKey) {
      setDragSelection({ startKey: null, endKey: null })
      return
    }

    const startIndex = timelineBuckets.findIndex(
      bucket => bucket.bucketKey === dragSelection.startKey
    )
    const endIndex = timelineBuckets.findIndex(
      bucket => bucket.bucketKey === dragSelection.endKey
    )

    if (startIndex >= 0 && endIndex >= 0 && startIndex !== endIndex) {
      setZoomRange({
        startIndex: Math.min(startIndex, endIndex),
        endIndex: Math.max(startIndex, endIndex)
      })
    }

    setDragSelection({ startKey: null, endKey: null })
  }

  const filteredStats = useMemo(() => {
    if (!isFiltered) {
      return {
        total: analyticsMeta?.total || 0,
        uniqueUsers: analyticsMeta?.uniqueUserCount || 0,
        apiFailures: analyticsMeta?.analyticsKindCounts?.API_FAILURE || 0,
        appFailures: analyticsMeta?.analyticsKindCounts?.APP_FAILURE || 0
      }
    }
    const uniqueUsers = new Set(activeRows.map(r => r.userID || r.userId)).size
    let apiFailures = 0
    let appFailures = 0
    for (const row of activeRows) {
      if (row.analyticsKind === 'API_FAILURE') apiFailures++
      else if (row.analyticsKind === 'APP_FAILURE') appFailures++
    }
    return { total: activeRows.length, uniqueUsers, apiFailures, appFailures }
  }, [isFiltered, analyticsMeta, activeRows])

  const stats = [
    {
      title: t('pages.analytics.stats.totalEvents'),
      value: filteredStats.total,
      icon: ChartBarIcon
    },
    {
      title: t('pages.analytics.stats.uniqueUsers'),
      value: filteredStats.uniqueUsers,
      icon: SparklesIcon
    },
    {
      title: t('pages.analytics.stats.apiFailures'),
      value: filteredStats.apiFailures,
      icon: ServerStackIcon
    },
    {
      title: t('pages.analytics.stats.appFailures'),
      value: filteredStats.appFailures,
      icon: ExclamationTriangleIcon
    }
  ]

  if (!isAdmin) {
    return null
  }

  const pageHeader = (
    <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-violet-600">
          {t('admin.analytics.eventsEyebrow')}
        </p>
        <h2 className="text-2xl font-semibold text-slate-900">
          {t('pages.analytics.title')}
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          {t('pages.analytics.subtitle')}
        </p>
      </div>

      <div className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:flex-row md:items-end">
        <div className="min-w-40">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Source
          </p>
          <div className="flex gap-1.5">
            {[
              { value: 'ALL', label: 'All' },
              { value: 'WEBSITE', label: '🌐 Website' },
              { value: 'APP', label: '📱 App' }
            ].map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setSourceFilter(opt.value)}
                className={`rounded-2xl border px-3 py-2 text-sm font-medium transition ${
                  sourceFilter === opt.value
                    ? 'border-violet-400 bg-violet-50 text-violet-800'
                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="relative min-w-56">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            {t('pages.analytics.filters.timeWindow')}
          </p>
          <button
            type="button"
            onClick={() => setTimeframeMenuOpen(open => !open)}
            className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-white"
          >
            <span>{getRangeLabel(lookbackWindow, t)}</span>
            <span className="text-slate-400">▾</span>
          </button>

          {timeframeMenuOpen ? (
            <div className="absolute left-0 top-full z-20 mt-2 w-full rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl">
              <input
                type="text"
                value={timeframeSearch}
                onChange={event => setTimeframeSearch(event.target.value)}
                placeholder={t('pages.analytics.filters.searchQuickRanges')}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-violet-400"
              />
              <div className="mt-3 max-h-64 overflow-auto">
                {filteredTimeRangeOptions.map(option => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      setLookbackWindow(option.value)
                      setTimeframeMenuOpen(false)
                      setTimeframeSearch('')
                    }}
                    className={`flex w-full rounded-xl px-3 py-2 text-left text-sm transition ${
                      lookbackWindow === option.value
                        ? 'bg-slate-100 font-semibold text-slate-900'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {getRangeLabel(option.value, t)}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="min-w-32">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            {t('pages.analytics.filters.refresh')}
          </p>
          <button
            type="button"
            onClick={() => setRefreshTick(value => value + 1)}
            disabled={loading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ArrowPathIcon
              className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}
            />
            {t('pages.analytics.filters.refresh')}
          </button>
        </div>
      </div>
    </div>
  )

  if (loading) {
    return (
      <div className="space-y-6">
        {pageHeader}
        <div
          className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4"
          aria-busy="true"
          aria-label={t('pages.analytics.loading')}
        >
          {[0, 1, 2, 3].map(i => (
            <Skeleton key={i} className="h-28 rounded-3xl" />
          ))}
          <Skeleton className="h-72 rounded-3xl md:col-span-2 xl:col-span-4" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        {pageHeader}
        <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-red-700">
          <p className="font-semibold">
            {t('pages.analytics.errors.loadFailed')}
          </p>
          <p className="mt-2 text-sm">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {pageHeader}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.map(stat => (
          <StatTile
            key={stat.title}
            label={stat.title}
            value={stat.value}
            icon={stat.icon}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[2fr_1fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">
                {t('pages.analytics.timeline.title')}
              </h2>
              <p className="text-sm text-slate-500">
                {t('pages.analytics.timeline.subtitle')}
              </p>
            </div>
            <div className="text-xs font-medium text-slate-500">
              {t('pages.analytics.timeline.selectedBucket')}:{' '}
              <span className="text-slate-800">
                {pendingBucket?.label ||
                  selectedBucket?.label ||
                  t('pages.analytics.timeline.none')}
              </span>
            </div>
          </div>

          <div className="mb-5 flex flex-wrap gap-2">
            {ANALYTICS_SERIES_KEYS.map(kind => {
              const isVisible = visibleSeries[kind]
              return (
                <button
                  key={kind}
                  type="button"
                  onClick={() => handleSeriesSelection(kind)}
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                    isVisible
                      ? 'border-slate-300 bg-slate-100 text-slate-900'
                      : 'border-slate-200 bg-white text-slate-400'
                  }`}
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: ANALYTICS_KIND_COLORS[kind] }}
                  />
                  {kind}
                </button>
              )
            })}
          </div>

          {sourceFilter === 'WEBSITE' && (
            <div className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-violet-100 bg-violet-50 px-4 py-3">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-500">
                🌐 Website filter
              </span>

              {/* Action filter */}
              <div className="flex gap-1.5">
                {[
                  { value: 'ALL', label: 'All events' },
                  { value: 'page_view', label: '👁 Page views' },
                  { value: 'button_click', label: '🖱 Button clicks' }
                ].map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      setWebsiteActionFilter(opt.value)
                      if (opt.value !== 'button_click')
                        setWebsiteButtonFilter('ALL')
                    }}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                      websiteActionFilter === opt.value
                        ? 'border-violet-400 bg-violet-600 text-white'
                        : 'border-violet-200 bg-white text-violet-700 hover:bg-violet-100'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* Button name filter — only when action = button_click */}
              {websiteActionFilter === 'button_click' &&
                availableButtonNames.length > 0 && (
                  <select
                    value={websiteButtonFilter}
                    onChange={e => setWebsiteButtonFilter(e.target.value)}
                    className="rounded-full border border-violet-200 bg-white px-3 py-1.5 text-xs font-semibold text-violet-700 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                  >
                    <option value="ALL">All buttons</option>
                    {availableButtonNames.map(name => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                )}

              {/* Active filter badge */}
              {(websiteActionFilter !== 'ALL' ||
                websiteButtonFilter !== 'ALL') && (
                <button
                  type="button"
                  onClick={() => {
                    setWebsiteActionFilter('ALL')
                    setWebsiteButtonFilter('ALL')
                  }}
                  className="ml-auto rounded-full border border-violet-200 bg-white px-3 py-1.5 text-xs font-semibold text-violet-500 hover:bg-violet-100 transition"
                >
                  Clear ×
                </button>
              )}
            </div>
          )}

          <div className="mb-4 flex items-center justify-between gap-3">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
              {t('pages.analytics.timeline.zoomRange')}
            </p>
            <p className="flex-1 text-center text-xs text-slate-500">
              {t('pages.analytics.timeline.dragToZoom')}
            </p>
            {isZoomed ? (
              <button
                type="button"
                onClick={() =>
                  setZoomRange({
                    startIndex: 0,
                    endIndex: Math.max(0, timelineBuckets.length - 1)
                  })
                }
                className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                {t('pages.analytics.timeline.resetZoom')}
              </button>
            ) : null}
          </div>

          <div
            className={`h-80 min-w-0 transition-opacity ${
              isDraggingTimeline ? 'opacity-80' : 'opacity-100'
            }`}
          >
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={timelineBuckets}
                onMouseDown={handleChartMouseDown}
                onMouseMove={handleChartMouseMove}
                onMouseUp={handleChartMouseUp}
                onMouseLeave={handleChartMouseUp}
                onClick={state => {
                  if (suppressNextClickRef.current) {
                    suppressNextClickRef.current = false
                    return
                  }
                  openPendingBucketFromState(state)
                }}
              >
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                <XAxis
                  dataKey="bucketKey"
                  tick={{ fontSize: 12, fill: '#64748b' }}
                  minTickGap={24}
                  tickFormatter={value =>
                    formatBucketLabel(value, lookbackWindow)
                  }
                  stroke="#cbd5e1"
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 12, fill: '#64748b' }}
                  stroke="#cbd5e1"
                />
                <Tooltip
                  content={props =>
                    renderTimelineTooltip(props, lookbackWindow)
                  }
                  wrapperStyle={{ pointerEvents: 'none' }}
                />
                {ANALYTICS_SERIES_KEYS.map(kind => (
                  <Area
                    {...chartAnim}
                    key={`${kind}-fill`}
                    type="linear"
                    dataKey={kind}
                    hide={!visibleSeries[kind]}
                    onClick={state => {
                      if (suppressNextClickRef.current) {
                        suppressNextClickRef.current = false
                        return
                      }
                      openPendingBucketFromState(state)
                    }}
                    stroke="none"
                    fill={ANALYTICS_KIND_COLORS[kind]}
                    fillOpacity={kind === 'TOTAL' ? 0.05 : 0.12}
                    isAnimationActive={false}
                  />
                ))}
                {ANALYTICS_SERIES_KEYS.map(kind => (
                  <Line
                    {...chartAnim}
                    key={kind}
                    type="linear"
                    dataKey={kind}
                    hide={!visibleSeries[kind]}
                    stroke={ANALYTICS_KIND_COLORS[kind]}
                    strokeWidth={2}
                    dot={{
                      r: 2,
                      onClick: state => {
                        if (suppressNextClickRef.current) {
                          suppressNextClickRef.current = false
                          return
                        }
                        openPendingBucketFromState(state)
                      }
                    }}
                    activeDot={{
                      r: 5,
                      onClick: state => {
                        if (suppressNextClickRef.current) {
                          suppressNextClickRef.current = false
                          return
                        }
                        openPendingBucketFromState(state)
                      }
                    }}
                  />
                ))}
                {dragSelectionVisible ? (
                  <ReferenceArea
                    x1={dragSelection.startKey}
                    x2={dragSelection.endKey}
                    strokeOpacity={0}
                    fill="#7c3aed"
                    fillOpacity={0.14}
                  />
                ) : null}
                <Brush
                  dataKey="bucketKey"
                  height={28}
                  stroke="#7c3aed"
                  travellerWidth={10}
                  fill="#f8fafc"
                  tickFormatter={value =>
                    formatBucketLabel(value, lookbackWindow)
                  }
                  startIndex={zoomRange.startIndex}
                  endIndex={zoomRange.endIndex}
                  onChange={range => {
                    if (
                      typeof range?.startIndex === 'number' &&
                      typeof range?.endIndex === 'number'
                    ) {
                      setZoomRange({
                        startIndex: range.startIndex,
                        endIndex: range.endIndex
                      })
                    }
                  }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="space-y-6">
          <div className="min-w-0 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">
              {t('pages.analytics.breakdowns.analyticsKinds')}
            </h2>
            <div className="mt-4 h-60 min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    {...chartAnim}
                    data={analyticsKindRows}
                    dataKey="value"
                    nameKey="kind"
                    innerRadius={52}
                    outerRadius={80}
                    paddingAngle={2}
                  >
                    {analyticsKindRows.map(entry => (
                      <Cell
                        key={entry.kind}
                        fill={
                          ANALYTICS_KIND_COLORS[entry.kind] ||
                          ANALYTICS_KIND_COLORS.OTHER
                        }
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <BreakdownBarCard
          title={t('pages.analytics.breakdowns.devices')}
          rows={deviceRows}
          categoryKey="device"
          color="#6250d6"
        />
        <BreakdownBarCard
          title={t('pages.analytics.breakdowns.sources')}
          rows={sourceRows}
          categoryKey="source"
          color="#2a78d6"
        />
      </div>

      <BreakdownBarCard
        title={t('pages.analytics.breakdowns.appVersions')}
        unitLabel={t('pages.analytics.breakdowns.events')}
        rows={appVersionRows}
        categoryKey="version"
        color="#1baf7a"
        height="h-72"
        tickFormatter={value => truncateLabel(value, 18)}
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <BreakdownBarCard
          title={t('pages.analytics.breakdowns.endpoints')}
          unitLabel={t('pages.analytics.breakdowns.events')}
          rows={endpointRows}
          categoryKey="endpointDisplay"
          color="#008300"
          height="h-72"
          vertical
          tickFormatter={value => truncateLabel(value, 34)}
          labelFormatter={value => formatEndpointLabel(value)}
        />

        <TopUsersCard
          rows={topUserRows}
          visibleRows={visibleTopUserRows}
          showAll={showAllTopUsers}
          onToggle={() => setShowAllTopUsers(prev => !prev)}
        />
      </div>

      {pendingBucket || confirmedBucketKey ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-4 py-6">
          <div className="max-h-[90vh] w-full max-w-6xl overflow-hidden rounded-[28px] bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">
                  {t('pages.analytics.details.title')}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {pendingBucket || selectedBucket
                    ? t('pages.analytics.details.subtitleWithBucket', {
                        bucket: pendingBucket?.label || selectedBucket?.label,
                        count:
                          pendingBucket?.rows?.length ||
                          selectedBucketRows.length
                      })
                    : t('pages.analytics.details.subtitle')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setPendingBucketKey(null)
                  setConfirmedBucketKey(null)
                }}
                className="rounded-full border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-500 transition hover:bg-slate-50"
              >
                ×
              </button>
            </div>

            <div className="max-h-[calc(90vh-88px)] overflow-auto px-6 py-6">
              {pendingBucket ? (
                <div className="rounded-3xl border border-violet-200 bg-violet-50 p-5">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-violet-900">
                        {t('pages.analytics.timeline.confirmTitle', {
                          bucket: pendingBucket.label
                        })}
                      </p>
                      <p className="mt-1 text-sm text-violet-700">
                        {t('pages.analytics.timeline.confirmSubtitle', {
                          count: pendingBucket.rows?.length || 0
                        })}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setPendingBucketKey(null)}
                        className="rounded-2xl border border-violet-200 bg-white px-4 py-2 text-sm font-medium text-violet-700 transition hover:bg-violet-100"
                      >
                        {t('pages.analytics.timeline.cancel')}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setConfirmedBucketKey(pendingBucket.bucketKey)
                          setPendingBucketKey(null)
                        }}
                        className="rounded-2xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-violet-700"
                      >
                        {t('pages.analytics.timeline.viewLogs')}
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}

              {selectedBucket ? (
                <div className="space-y-6">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={selectedBucketIndex <= 0}
                      onClick={() =>
                        setConfirmedBucketKey(
                          timelineBuckets[selectedBucketIndex - 1]?.bucketKey ||
                            null
                        )
                      }
                      className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <ArrowLeftIcon className="h-4 w-4" />
                      {t('pages.analytics.details.loadBefore')}
                    </button>
                    <button
                      type="button"
                      disabled={
                        selectedBucketIndex < 0 ||
                        selectedBucketIndex >= timelineBuckets.length - 1
                      }
                      onClick={() =>
                        setConfirmedBucketKey(
                          timelineBuckets[selectedBucketIndex + 1]?.bucketKey ||
                            null
                        )
                      }
                      className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {t('pages.analytics.details.loadAfter')}
                      <ArrowRightIcon className="h-4 w-4" />
                    </button>
                    <div className="ml-auto flex items-center gap-2">
                      <label
                        htmlFor="bucket-kind-filter"
                        className="text-sm font-medium text-slate-600"
                      >
                        {t('pages.analytics.details.eventType')}
                      </label>
                      <select
                        id="bucket-kind-filter"
                        value={selectedBucketKindFilter}
                        onChange={event =>
                          setSelectedBucketKindFilter(event.target.value)
                        }
                        className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-violet-300 focus:ring-2 focus:ring-violet-100"
                      >
                        {selectedBucketKindOptions.map(kind => (
                          <option key={kind} value={kind}>
                            {kind === 'ALL'
                              ? t('pages.analytics.details.allEventTypes')
                              : kind}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {filteredSelectedBucketRows.length === 0 ? (
                    <div className="py-10 text-center text-sm text-slate-500">
                      {t('pages.analytics.details.empty')}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {filteredSelectedBucketRows.map(row => (
                        <details
                          key={row.id}
                          className="overflow-hidden rounded-2xl border border-slate-200 bg-white group"
                        >
                          <summary className="grid cursor-pointer grid-cols-[20px_190px_minmax(0,1fr)] items-center gap-4 bg-slate-50 px-4 py-3 font-mono text-[13px] text-slate-800 marker:content-none hover:bg-slate-100">
                            <span className="text-slate-400 transition group-open:rotate-90">
                              ▶
                            </span>
                            <span className="whitespace-nowrap text-slate-600">
                              {row.createdAt || 'N/A'}
                            </span>
                            <div className="min-w-0">
                              <div className="flex min-w-0 flex-wrap items-center gap-2">
                                <span className="font-semibold text-slate-900">
                                  [{row.analyticsKind || 'UNKNOWN'}]
                                </span>
                                <span className="text-slate-500">
                                  [{row.requestMethod || 'N/A'}]
                                </span>
                                <span className="text-slate-500">
                                  [{row.httpStatusCode || 'N/A'}]
                                </span>
                                <span className="truncate text-slate-700">
                                  {row.action || row.message || 'N/A'}
                                </span>
                              </div>
                              <div className="mt-1 truncate text-xs text-slate-500">
                                {row.endpoint || row.message || 'N/A'}
                              </div>
                            </div>
                          </summary>

                          <div className="border-t border-slate-200 px-4 py-4">
                            <div className="mb-4 grid gap-3 text-sm text-slate-700 md:grid-cols-2">
                              <div>
                                <span className="font-semibold text-slate-900">
                                  {t('pages.analytics.table.userId')}:
                                </span>{' '}
                                <span className="break-all">
                                  {row.userID || 'N/A'}
                                </span>
                              </div>
                              <div>
                                <span className="font-semibold text-slate-900">
                                  {t('pages.analytics.table.classification')}:
                                </span>{' '}
                                {row.sourcePlatform || 'N/A'} /{' '}
                                {row.deviceType || 'N/A'}
                              </div>
                            </div>

                            <div className="grid gap-4 lg:grid-cols-2">
                              <div>
                                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                                  {t('pages.analytics.table.request')}
                                </p>
                                <pre className="max-h-64 overflow-auto rounded-2xl bg-slate-950 p-4 text-xs text-slate-100">
                                  {safePrettyJson({
                                    endpoint: row.endpoint,
                                    method: row.requestMethod,
                                    body: row.requestBody,
                                    params: row.requestParams
                                  })}
                                </pre>
                              </div>
                              <div>
                                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                                  {t('pages.analytics.table.response')}
                                </p>
                                <pre className="max-h-64 overflow-auto rounded-2xl bg-slate-950 p-4 text-xs text-slate-100">
                                  {safePrettyJson({
                                    statusCode: row.httpStatusCode,
                                    responseBody: row.responseBody,
                                    analyticsData: row.parsedData || row.data,
                                    analyticsDetails:
                                      row.parsedDetails || row.details
                                  })}
                                </pre>
                              </div>
                            </div>
                          </div>
                        </details>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {isAdmin && emailRows.length > 0 ? (
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Email Events</h2>
            <p className="mt-1 text-sm text-gray-500">
              Automated and admin-triggered emails sent in the selected time
              window — {emailRows.length} event
              {emailRows.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Time
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Action
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Recipient
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    User ID
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Details
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {emailRows.map((row, i) => {
                  const details = row.parsedDetails || row.details || {}
                  const parsedDetails =
                    typeof details === 'string'
                      ? (() => {
                          try {
                            return JSON.parse(details)
                          } catch {
                            return {}
                          }
                        })()
                      : details
                  return (
                    <tr key={row.id || i} className="hover:bg-slate-50">
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">
                        {row.createdAt
                          ? new Date(row.createdAt).toLocaleString()
                          : 'N/A'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span className="inline-flex rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                          {row.action || row.message || 'N/A'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-700">
                        {parsedDetails?.email || '—'}
                      </td>
                      <td className="max-w-[140px] truncate px-4 py-3 text-xs text-slate-500">
                        {row.userID || row.userId || '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {parsedDetails?.subject ? (
                          <span className="italic">
                            {parsedDetails.subject}
                          </span>
                        ) : parsedDetails?.sentByAdmin ? (
                          'Admin reminder'
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default EventFeed
