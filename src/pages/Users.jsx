/* eslint-disable max-len */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import {
  MagnifyingGlassIcon,
  EyeIcon,
  ExclamationTriangleIcon,
  ArrowsUpDownIcon
} from '@heroicons/react/24/outline'
import {
  getUsers,
  getUserRewardsSummary,
  getUserPurchaseRequests,
  updateUserPurchaseStatus,
  formatUserData,
  formatSubscriptionStatus
} from '../services/api'
import UserDetailModal from '../components/UserDetailModal'
import { selectIsAdmin } from '../store/userSlice'

const USERS_CACHE_KEY = 'users'
const USER_REWARDS_CACHE_KEY = 'userRewardsSummary'

const formatShortDate = value => {
  if (!value) return 'N/A'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'N/A' : date.toLocaleDateString()
}

const compareValues = (left, right) => {
  const a = left ?? ''
  const b = right ?? ''

  if (typeof a === 'number' && typeof b === 'number') {
    return a - b
  }

  return String(a).localeCompare(String(b), undefined, {
    numeric: true,
    sensitivity: 'base'
  })
}

const getDisplayName = ({ user, userData, loginDetails }) => {
  if (userData?.name) return userData.name
  if (user?.firstName && user?.lastName) {
    return `${user.firstName} ${user.lastName}`.trim()
  }
  if (loginDetails?.displayName) return loginDetails.displayName
  if (user?.firstName) return user.firstName
  if (user?.lastName) return user.lastName
  return 'Unknown'
}

const getUserEmail = ({ user, loginDetails }) =>
  user?.email ||
  loginDetails?.providerData?.[0]?.email ||
  loginDetails?.email ||
  'N/A'

const getUserAvatar = name =>
  name
    .split(' ')
    .map(part => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

const replacePurchaseOptionAmount = option =>
  option?.title?.replace('{{amount}}', `${option?.value ?? '-'}`) || '-'

const SortHeader = ({ label, active, direction, onClick, align = 'left' }) => (
  <button
    type="button"
    onClick={onClick}
    className={`inline-flex items-center gap-1 text-xs font-medium uppercase tracking-wider text-gray-500 hover:text-gray-700 ${
      align === 'right' ? 'justify-end' : 'justify-start'
    }`}
  >
    <span>{label}</span>
    <ArrowsUpDownIcon className="h-3.5 w-3.5" />
    {active ? (
      <span className="text-[10px] text-violet-600">
        {direction === 'asc' ? '↑' : '↓'}
      </span>
    ) : null}
  </button>
)

const Users = () => {
  const { t } = useTranslation()
  const isAdmin = useSelector(selectIsAdmin)

  const [users, setUsers] = useState([])
  const [userRewardsSummaries, setUserRewardsSummaries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [rewardsError, setRewardsError] = useState(null)
  const hasLoadedRef = useRef(false)
  const [selectedUser, setSelectedUser] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedRewardRow, setSelectedRewardRow] = useState(null)
  const [isRewardsModalOpen, setIsRewardsModalOpen] = useState(false)
  const [rewardRequests, setRewardRequests] = useState([])
  const [rewardRequestsLoading, setRewardRequestsLoading] = useState(false)
  const [rewardRequestsError, setRewardRequestsError] = useState(null)
  const [updatingPurchaseId, setUpdatingPurchaseId] = useState(null)

  const [userSearchTerm, setUserSearchTerm] = useState('')
  const [userFilterStatus, setUserFilterStatus] = useState('all')
  const [userFilterSubscription, setUserFilterSubscription] = useState('all')
  const [usersSort, setUsersSort] = useState({
    column: 'joinDate',
    direction: 'desc'
  })
  const [usersCurrentPage, setUsersCurrentPage] = useState(1)
  const [usersPerPage, setUsersPerPage] = useState(5)

  const [rewardSearchTerm, setRewardSearchTerm] = useState('')
  const [rewardFilterStatus, setRewardFilterStatus] = useState('all')
  const [rewardsSort, setRewardsSort] = useState({
    column: 'coinsAmount',
    direction: 'desc'
  })
  const [rewardsCurrentPage, setRewardsCurrentPage] = useState(1)
  const [rewardsPerPage, setRewardsPerPage] = useState(5)

  const toggleUsersSort = column => {
    setUsersSort(current =>
      current.column === column
        ? {
            column,
            direction: current.direction === 'asc' ? 'desc' : 'asc'
          }
        : { column, direction: 'asc' }
    )
  }

  const toggleRewardsSort = column => {
    setRewardsSort(current =>
      current.column === column
        ? {
            column,
            direction: current.direction === 'asc' ? 'desc' : 'asc'
          }
        : { column, direction: 'asc' }
    )
  }

  const loadPageData = async ({ forceRefresh = false } = {}) => {
    if (!isAdmin) return

    setLoading(true)
    setError(null)
    setRewardsError(null)

    try {
      if (forceRefresh) {
        localStorage.removeItem(USERS_CACHE_KEY)
        localStorage.removeItem(USER_REWARDS_CACHE_KEY)
      }

      const cachedUsersData = forceRefresh
        ? null
        : localStorage.getItem(USERS_CACHE_KEY)
      const cachedRewardsData = forceRefresh
        ? null
        : localStorage.getItem(USER_REWARDS_CACHE_KEY)

      const hasUsersCache = Boolean(cachedUsersData)
      const hasRewardsCache = Boolean(cachedRewardsData)

      if (hasUsersCache) {
        const data = JSON.parse(cachedUsersData)
        setUsers(Array.isArray(data?.data) ? data.data : data?.users || [])
      }

      if (hasRewardsCache) {
        const data = JSON.parse(cachedRewardsData)
        setUserRewardsSummaries(
          Array.isArray(data?.data?.summaries) ? data.data.summaries : []
        )
      }

      if (hasUsersCache && hasRewardsCache && !forceRefresh) {
        setLoading(false)
        return
      }

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Request timeout')), 10000)
      )

      const [usersResult, rewardsResult] = await Promise.allSettled([
        Promise.race([getUsers(), timeoutPromise]),
        Promise.race([getUserRewardsSummary(), timeoutPromise])
      ])

      if (usersResult.status === 'fulfilled') {
        const data = usersResult.value
        setUsers(Array.isArray(data?.data) ? data.data : data?.users || [])
        try {
          localStorage.setItem(USERS_CACHE_KEY, JSON.stringify(data))
        } catch (_) {}
      } else if (!hasUsersCache) {
        throw usersResult.reason
      }

      if (rewardsResult.status === 'fulfilled') {
        const data = rewardsResult.value
        setUserRewardsSummaries(
          Array.isArray(data?.data?.summaries) ? data.data.summaries : []
        )
        try {
          localStorage.setItem(USER_REWARDS_CACHE_KEY, JSON.stringify(data))
        } catch (_) {}
      } else if (!hasRewardsCache) {
        setUserRewardsSummaries([])
        setRewardsError(t('pages.users.rewards.failed'))
      }
    } catch (err) {
      setError(
        err.message === 'Request timeout'
          ? 'Request timed out. Please check your connection.'
          : 'Failed to load users. Please try again.'
      )
      console.error('Error loading users page data:', err)
    } finally {
      setLoading(false)
    }
  }

  const refreshUsers = async () => {
    hasLoadedRef.current = false
    await loadPageData({ forceRefresh: true })
  }

  const loadRewardRequestsForUser = async userId => {
    setRewardRequestsLoading(true)
    setRewardRequestsError(null)
    try {
      const response = await getUserPurchaseRequests({ userId })
      setRewardRequests(Array.isArray(response?.data) ? response.data : [])
    } catch (err) {
      setRewardRequestsError(t('pages.users.rewards.requestsFailed'))
      console.error('Error loading reward requests:', err)
    } finally {
      setRewardRequestsLoading(false)
    }
  }

  const openRewardsModal = async row => {
    setSelectedRewardRow(row)
    setIsRewardsModalOpen(true)
    await loadRewardRequestsForUser(row.userId)
  }

  const handlePurchaseStatusUpdate = async ({ purchaseId, status, userId }) => {
    try {
      setUpdatingPurchaseId(purchaseId)
      await updateUserPurchaseStatus({ purchaseId, status })
      await Promise.all([
        loadRewardRequestsForUser(userId),
        loadPageData({ forceRefresh: true })
      ])
    } catch (err) {
      setRewardRequestsError(t('pages.users.rewards.updateFailed'))
      console.error('Error updating purchase request:', err)
    } finally {
      setUpdatingPurchaseId(null)
    }
  }

  useEffect(() => {
    if (hasLoadedRef.current) return
    hasLoadedRef.current = true
    loadPageData()
  }, [isAdmin, t])

  const usersRows = useMemo(() => {
    return users.map(user => {
      const userData = formatUserData(user)
      const loginDetails = user?.loginDetails || {}
      const name = getDisplayName({ user, userData, loginDetails })
      const email = getUserEmail({ user, loginDetails })
      const subInfo = formatSubscriptionStatus(user)
      const subscription =
        subInfo.plan === 'Pro Plan' || subInfo.plan === 'Program Plan'
          ? 'Premium'
          : 'Free'

      return {
        raw: user,
        key: user?.userId || user?.id,
        userId: user?.userId || user?.id || '',
        name,
        email,
        avatar: getUserAvatar(name),
        status: (user?.status || '').toString().toLowerCase(),
        subscription,
        joinDate: user?.dateTimeCreated || null,
        lastActive: user?.dateTimeUpdated || null
      }
    })
  }, [users])

  const filteredUsersRows = useMemo(() => {
    const filtered = usersRows.filter(row => {
      const matchesSearch =
        row.name.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
        row.email.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
        row.userId.toLowerCase().includes(userSearchTerm.toLowerCase())
      const matchesFilter =
        userFilterStatus === 'all' || row.status === userFilterStatus
      const matchesSubscription =
        userFilterSubscription === 'all' ||
        row.subscription === userFilterSubscription
      return matchesSearch && matchesFilter && matchesSubscription
    })

    const getterMap = {
      user: row => row.name,
      status: row => row.status,
      subscription: row => row.subscription,
      joinDate: row => new Date(row.joinDate || 0).getTime() || 0,
      lastActive: row => new Date(row.lastActive || 0).getTime() || 0
    }

    const getter = getterMap[usersSort.column] || getterMap.joinDate

    return filtered.sort((left, right) => {
      const result = compareValues(getter(left), getter(right))
      return usersSort.direction === 'asc' ? result : -result
    })
  }, [usersRows, userSearchTerm, userFilterStatus, userFilterSubscription, usersSort])

  useEffect(() => {
    setUsersCurrentPage(1)
  }, [userSearchTerm, userFilterStatus, userFilterSubscription, usersPerPage])

  const paginatedUsersRows = useMemo(() => {
    const startIndex = (usersCurrentPage - 1) * usersPerPage
    return filteredUsersRows.slice(startIndex, startIndex + usersPerPage)
  }, [filteredUsersRows, usersCurrentPage, usersPerPage])

  const usersTotalPages = Math.max(
    1,
    Math.ceil(filteredUsersRows.length / usersPerPage) || 1
  )
  const usersPageStart =
    filteredUsersRows.length > 0 ? (usersCurrentPage - 1) * usersPerPage + 1 : 0
  const usersPageEnd = Math.min(
    usersCurrentPage * usersPerPage,
    filteredUsersRows.length
  )

  const userRewardsByUserId = useMemo(
    () =>
      Object.fromEntries(
        userRewardsSummaries.map(summary => [summary.userId, summary])
      ),
    [userRewardsSummaries]
  )

  const rewardRows = useMemo(() => {
    return usersRows.map(row => {
      const rewardSummary = userRewardsByUserId[row.userId] || null
      const targetPurchaseOption = rewardSummary?.targetPurchaseOption || null
      const latestPurchase = rewardSummary?.latestPurchase || null

      return {
        ...row,
        coinsAmount: Number(rewardSummary?.coinsAmount || 0),
        targetPurchaseLabel: targetPurchaseOption
          ? replacePurchaseOptionAmount(targetPurchaseOption)
          : t('pages.users.rewards.noTarget'),
        targetCoins: Number(rewardSummary?.targetCoins || 0),
        progressPercentage: Number(rewardSummary?.progressPercentage || 0),
        latestPurchaseLabel: latestPurchase?.purchaseOption
          ? replacePurchaseOptionAmount(latestPurchase.purchaseOption)
          : t('pages.users.rewards.noRequest'),
        latestPurchaseStatus: latestPurchase?.status || '',
        latestPurchaseDate: latestPurchase?.dateTimeCreated || null,
        purchaseRequestsCount: Number(
          rewardSummary?.purchaseRequestsCount || 0
        ),
        pendingPurchaseRequestsCount: Number(
          rewardSummary?.pendingPurchaseRequestsCount || 0
        )
      }
    })
  }, [usersRows, userRewardsByUserId, t])

  const filteredRewardRows = useMemo(() => {
    const filtered = rewardRows.filter(row => {
      const matchesSearch =
        row.name.toLowerCase().includes(rewardSearchTerm.toLowerCase()) ||
        row.email.toLowerCase().includes(rewardSearchTerm.toLowerCase()) ||
        row.userId.toLowerCase().includes(rewardSearchTerm.toLowerCase()) ||
        row.targetPurchaseLabel
          .toLowerCase()
          .includes(rewardSearchTerm.toLowerCase()) ||
        row.latestPurchaseLabel
          .toLowerCase()
          .includes(rewardSearchTerm.toLowerCase())

      const normalizedStatus = (row.latestPurchaseStatus || 'NO_REQUEST')
        .toString()
        .toUpperCase()
      const matchesFilter =
        rewardFilterStatus === 'all' || normalizedStatus === rewardFilterStatus

      return matchesSearch && matchesFilter
    })

    const getterMap = {
      user: row => row.name,
      coinsAmount: row => row.coinsAmount,
      targetReward: row => row.targetCoins,
      progress: row => row.progressPercentage,
      latestRequest: row => row.latestPurchaseLabel,
      requestStatus: row => row.latestPurchaseStatus || 'NO_REQUEST',
      requests: row => row.purchaseRequestsCount,
      requestedAt: row => new Date(row.latestPurchaseDate || 0).getTime() || 0
    }

    const getter = getterMap[rewardsSort.column] || getterMap.coinsAmount

    return filtered.sort((left, right) => {
      const result = compareValues(getter(left), getter(right))
      return rewardsSort.direction === 'asc' ? result : -result
    })
  }, [rewardRows, rewardSearchTerm, rewardFilterStatus, rewardsSort])

  useEffect(() => {
    setRewardsCurrentPage(1)
  }, [rewardSearchTerm, rewardFilterStatus, rewardsPerPage])

  const paginatedRewardRows = useMemo(() => {
    const startIndex = (rewardsCurrentPage - 1) * rewardsPerPage
    return filteredRewardRows.slice(startIndex, startIndex + rewardsPerPage)
  }, [filteredRewardRows, rewardsCurrentPage, rewardsPerPage])

  const rewardsTotalPages = Math.max(
    1,
    Math.ceil(filteredRewardRows.length / rewardsPerPage) || 1
  )
  const rewardsPageStart =
    filteredRewardRows.length > 0
      ? (rewardsCurrentPage - 1) * rewardsPerPage + 1
      : 0
  const rewardsPageEnd = Math.min(
    rewardsCurrentPage * rewardsPerPage,
    filteredRewardRows.length
  )

  const getStatusBadge = status => {
    const styles = {
      active: 'bg-green-100 text-green-800',
      inactive: 'bg-gray-100 text-gray-800',
      suspended: 'bg-red-100 text-red-800',
      pending_deletion: 'bg-amber-100 text-amber-800'
    }

    return (
      <span
        className={`rounded-full px-2 py-1 text-xs font-medium ${
          styles[status] || 'bg-gray-100 text-gray-700'
        }`}
      >
        {status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}
      </span>
    )
  }

  const getSubscriptionBadge = subscription => {
    const styles = {
      Premium: 'bg-purple-100 text-purple-800',
      Basic: 'bg-blue-100 text-blue-800',
      Free: 'bg-gray-100 text-gray-800'
    }

    return (
      <span
        className={`rounded-full px-2 py-1 text-xs font-medium ${
          styles[subscription] || 'bg-gray-100 text-gray-700'
        }`}
      >
        {subscription}
      </span>
    )
  }

  const getRewardStatusBadge = status => {
    if (!status) {
      return (
        <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
          {t('pages.users.rewards.noRequest')}
        </span>
      )
    }

    const normalizedStatus = status.toUpperCase()
    const styles = {
      PENDING: 'bg-amber-100 text-amber-800',
      COMPLETED: 'bg-blue-100 text-blue-700',
      FAILED: 'bg-yellow-100 text-yellow-800'
    }

    return (
      <span
        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
          styles[normalizedStatus] || 'bg-gray-100 text-gray-700'
        }`}
      >
        {normalizedStatus}
      </span>
    )
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {t('pages.users.title')}
          </h1>
          <p className="mt-2 text-gray-600">{t('pages.users.subtitle')}</p>
        </div>
        <div className="flex h-64 items-center justify-center">
          <div className="text-center">
            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">{t('pages.users.loading')}</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {t('pages.users.title')}
          </h1>
          <p className="mt-2 text-gray-600">{t('pages.users.subtitle')}</p>
        </div>
        <div className="card p-6">
          <div className="flex items-center">
            <ExclamationTriangleIcon className="mr-4 h-8 w-8 text-red-600" />
            <div>
              <h3 className="text-lg font-medium text-gray-900">
                {t('pages.users.error')}
              </h3>
              <p className="mt-1 text-gray-600">{error}</p>
              <button onClick={refreshUsers} className="btn-primary mt-4">
                {t('common.tryAgain')}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-center sm:text-left">
          <h1 className="text-3xl font-bold text-gray-900">
            {t('pages.users.title')}
          </h1>
          <p className="mt-1 text-sm text-gray-600 sm:text-base">
            {t('pages.users.subtitle')}
          </p>
        </div>
        <button
          onClick={refreshUsers}
          className="btn-secondary flex items-center"
          disabled={loading}
        >
          <svg
            className="mr-2 h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          {loading ? t('common.loading') : t('pages.users.refresh')}
        </button>
      </div>

      <div className="card p-6">
        <div className="flex flex-col gap-4 md:flex-row">
          <div className="flex-1">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder={t('pages.users.searchPlaceholder')}
                value={userSearchTerm}
                onChange={e => setUserSearchTerm(e.target.value)}
                className="input pl-10"
              />
            </div>
          </div>
          <select
            value={userFilterStatus}
            onChange={e => setUserFilterStatus(e.target.value)}
            className="input w-44"
          >
            <option value="all">{t('pages.users.filters.allStatus')}</option>
            <option value="active">{t('pages.users.filters.active')}</option>
            <option value="inactive">Inactive</option>
            <option value="suspended">Suspended</option>
            <option value="pending_deletion">
              {t('pages.users.filters.pendingDeletion')}
            </option>
          </select>
          <select
            value={userFilterSubscription}
            onChange={e => setUserFilterSubscription(e.target.value)}
            className="input w-44"
          >
            <option value="all">All Plans</option>
            <option value="Premium">Premium</option>
            <option value="Free">Free</option>
          </select>
        </div>
      </div>

      <div className="space-y-3 md:hidden">
        {paginatedUsersRows.map(row => (
          <div key={row.key} className="card p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center">
                <div className="mr-3 flex h-10 w-10 items-center justify-center rounded-full bg-blue-600">
                  <span className="text-sm font-medium text-white">
                    {row.avatar}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    {row.name}
                  </p>
                  <p className="text-xs text-gray-500">{row.email}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setSelectedUser(row.raw)
                  setIsModalOpen(true)
                }}
                className="text-blue-600 hover:text-blue-900"
                title={t('pages.users.view')}
              >
                <EyeIcon className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div className="space-y-1">
                <p className="text-gray-500">{t('pages.users.status')}</p>
                {getStatusBadge(row.status)}
              </div>
              <div className="space-y-1">
                <p className="text-gray-500">{t('pages.users.subscription')}</p>
                {getSubscriptionBadge(row.subscription)}
              </div>
              <div className="space-y-1">
                <p className="text-gray-500">{t('pages.users.joinDate')}</p>
                <p className="text-sm text-gray-800">
                  {formatShortDate(row.joinDate)}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-gray-500">{t('pages.users.lastActive')}</p>
                <p className="text-sm text-gray-800">
                  {formatShortDate(row.lastActive)}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="card hidden overflow-visible md:block">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left">
                <SortHeader
                  label={t('pages.users.user')}
                  active={usersSort.column === 'user'}
                  direction={usersSort.direction}
                  onClick={() => toggleUsersSort('user')}
                />
              </th>
              <th className="px-6 py-3 text-left">
                <SortHeader
                  label={t('pages.users.status')}
                  active={usersSort.column === 'status'}
                  direction={usersSort.direction}
                  onClick={() => toggleUsersSort('status')}
                />
              </th>
              <th className="px-6 py-3 text-left">
                <SortHeader
                  label={t('pages.users.subscription')}
                  active={usersSort.column === 'subscription'}
                  direction={usersSort.direction}
                  onClick={() => toggleUsersSort('subscription')}
                />
              </th>
              <th className="px-6 py-3 text-left">
                <SortHeader
                  label={t('pages.users.joinDate')}
                  active={usersSort.column === 'joinDate'}
                  direction={usersSort.direction}
                  onClick={() => toggleUsersSort('joinDate')}
                />
              </th>
              <th className="px-6 py-3 text-left">
                <SortHeader
                  label={t('pages.users.lastActive')}
                  active={usersSort.column === 'lastActive'}
                  direction={usersSort.direction}
                  onClick={() => toggleUsersSort('lastActive')}
                />
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                {t('pages.users.actions')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {paginatedUsersRows.map(row => (
              <tr key={row.key} className="hover:bg-gray-50">
                <td className="whitespace-nowrap px-6 py-4">
                  <div className="flex items-center">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600">
                      <span className="text-sm font-medium text-white">
                        {row.avatar}
                      </span>
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900">
                        {row.name}
                      </div>
                      <div className="text-sm text-gray-500">{row.email}</div>
                    </div>
                  </div>
                </td>
                <td className="whitespace-nowrap px-6 py-4">
                  {getStatusBadge(row.status)}
                </td>
                <td className="whitespace-nowrap px-6 py-4">
                  {getSubscriptionBadge(row.subscription)}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                  {formatShortDate(row.joinDate)}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                  {formatShortDate(row.lastActive)}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-right">
                  <button
                    onClick={() => {
                      setSelectedUser(row.raw)
                      setIsModalOpen(true)
                    }}
                    className="text-blue-600 hover:text-blue-900"
                    title={t('pages.users.view')}
                  >
                    <EyeIcon className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-3 rounded-md border border-gray-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <label className="text-sm text-gray-700">
            {t('pages.users.perPage')}
          </label>
          <select
            value={usersPerPage}
            onChange={e => setUsersPerPage(Number(e.target.value))}
            className="rounded-md border border-gray-300 px-3 py-1 text-sm"
          >
            <option value="5">5</option>
            <option value="15">15</option>
            <option value="25">25</option>
          </select>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
          <p className="text-sm text-gray-700">
            {t('pages.users.pagination.showing', {
              start: usersPageStart,
              end: usersPageEnd,
              total: filteredUsersRows.length
            })}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() =>
                setUsersCurrentPage(prev => Math.max(1, prev - 1))
              }
              disabled={usersCurrentPage === 1}
              className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t('common.previous')}
            </button>
            <span className="text-sm text-gray-600">
              {t('pages.users.pagination.page', {
                current: usersCurrentPage,
                total: usersTotalPages
              })}
            </span>
            <button
              onClick={() =>
                setUsersCurrentPage(prev =>
                  Math.min(usersTotalPages, prev + 1)
                )
              }
              disabled={usersCurrentPage >= usersTotalPages}
              className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t('common.next')}
            </button>
          </div>
        </div>
      </div>

      {isAdmin ? (
        <div className="space-y-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {t('pages.users.rewards.title')}
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              {t('pages.users.rewards.subtitle')}
            </p>
          </div>

          {rewardsError ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {rewardsError}
            </div>
          ) : null}

          <div className="card p-6">
            <div className="flex flex-col gap-4 md:flex-row">
              <div className="flex-1">
                <div className="relative">
                  <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder={t('pages.users.rewards.searchPlaceholder')}
                    value={rewardSearchTerm}
                    onChange={e => setRewardSearchTerm(e.target.value)}
                    className="input pl-10"
                  />
                </div>
              </div>
              <select
                value={rewardFilterStatus}
                onChange={e => setRewardFilterStatus(e.target.value)}
                className="input w-52"
              >
                <option value="all">
                  {t('pages.users.rewards.filters.allRequests')}
                </option>
                <option value="PENDING">
                  {t('pages.users.rewards.filters.pending')}
                </option>
                <option value="COMPLETED">
                  {t('pages.users.rewards.filters.completed')}
                </option>
                <option value="FAILED">
                  {t('pages.users.rewards.filters.failed')}
                </option>
                <option value="NO_REQUEST">
                  {t('pages.users.rewards.filters.noRequest')}
                </option>
              </select>
            </div>
          </div>

          <div className="space-y-3 md:hidden">
            {paginatedRewardRows.map(row => (
              <button
                key={row.key}
                type="button"
                onClick={() => openRewardsModal(row)}
                className="card w-full p-4 text-left transition hover:border-violet-200 hover:shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-600 text-sm font-semibold text-white">
                    {row.avatar}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-gray-900">
                      {row.name}
                    </p>
                    <p className="truncate text-xs text-gray-500">{row.email}</p>
                  </div>
                  <div className="rounded-full bg-violet-50 px-3 py-1 text-sm font-semibold text-violet-700">
                    {row.coinsAmount} {t('pages.users.rewards.coinsUnit')}
                  </div>
                  <div className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-500">
                    <EyeIcon className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-4 space-y-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      {t('pages.users.rewards.targetReward')}
                    </p>
                    <p className="mt-1 text-sm text-slate-900">
                      {row.targetPurchaseLabel}
                    </p>
                  </div>
                  <div>
                    <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
                      <span>{t('pages.users.rewards.progress')}</span>
                      <span>
                        {row.coinsAmount} / {row.targetCoins || 0}{' '}
                        {t('pages.users.rewards.coinsUnit')}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100">
                      <div
                        className="h-2 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500"
                        style={{
                          width: `${Math.max(4, row.progressPercentage)}%`
                        }}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        {t('pages.users.rewards.latestRequest')}
                      </p>
                      <p className="mt-1 text-slate-900">
                        {row.latestPurchaseLabel}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        {t('pages.users.rewards.requestStatus')}
                      </p>
                      <div className="mt-1">
                        {getRewardStatusBadge(row.latestPurchaseStatus)}
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {t('pages.users.rewards.latestStatusHint')}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        {t('pages.users.rewards.requests')}
                      </p>
                      <p className="mt-1 text-slate-900">
                        {t('pages.users.rewards.requestsCount', {
                          count: row.purchaseRequestsCount,
                          pending: row.pendingPurchaseRequestsCount
                        })}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        {t('pages.users.rewards.requestedAt')}
                      </p>
                      <p className="mt-1 text-slate-900">
                        {formatShortDate(row.latestPurchaseDate)}
                      </p>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>

          <div className="card hidden overflow-visible md:block">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left">
                    <SortHeader
                      label={t('pages.users.user')}
                      active={rewardsSort.column === 'user'}
                      direction={rewardsSort.direction}
                      onClick={() => toggleRewardsSort('user')}
                    />
                  </th>
                  <th className="px-6 py-3 text-left">
                    <SortHeader
                      label={t('pages.users.rewards.coins')}
                      active={rewardsSort.column === 'coinsAmount'}
                      direction={rewardsSort.direction}
                      onClick={() => toggleRewardsSort('coinsAmount')}
                    />
                  </th>
                  <th className="px-6 py-3 text-left">
                    <SortHeader
                      label={t('pages.users.rewards.targetReward')}
                      active={rewardsSort.column === 'targetReward'}
                      direction={rewardsSort.direction}
                      onClick={() => toggleRewardsSort('targetReward')}
                    />
                  </th>
                  <th className="px-6 py-3 text-left">
                    <SortHeader
                      label={t('pages.users.rewards.progress')}
                      active={rewardsSort.column === 'progress'}
                      direction={rewardsSort.direction}
                      onClick={() => toggleRewardsSort('progress')}
                    />
                  </th>
                  <th className="px-6 py-3 text-left">
                    <SortHeader
                      label={t('pages.users.rewards.latestRequest')}
                      active={rewardsSort.column === 'latestRequest'}
                      direction={rewardsSort.direction}
                      onClick={() => toggleRewardsSort('latestRequest')}
                    />
                  </th>
                  <th className="px-6 py-3 text-left">
                    <SortHeader
                      label={t('pages.users.rewards.requestStatus')}
                      active={rewardsSort.column === 'requestStatus'}
                      direction={rewardsSort.direction}
                      onClick={() => toggleRewardsSort('requestStatus')}
                    />
                  </th>
                  <th className="px-6 py-3 text-left">
                    <SortHeader
                      label={t('pages.users.rewards.requests')}
                      active={rewardsSort.column === 'requests'}
                      direction={rewardsSort.direction}
                      onClick={() => toggleRewardsSort('requests')}
                    />
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                    {t('pages.users.rewards.actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {paginatedRewardRows.map(row => (
                  <tr
                    key={row.key}
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => openRewardsModal(row)}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-600 text-sm font-semibold text-white">
                          {row.avatar}
                        </div>
                        <div className="ml-4 min-w-0">
                          <div className="text-sm font-medium text-gray-900">
                            {row.name}
                          </div>
                          <div className="max-w-[240px] truncate text-sm text-gray-500">
                            {row.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="text-sm font-semibold text-gray-900">
                        {row.coinsAmount}
                      </div>
                      <div className="text-xs text-gray-500">
                        {t('pages.users.rewards.coinsUnit')}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <div>{row.targetPurchaseLabel}</div>
                      <div className="text-xs text-gray-500">
                        {row.targetCoins || 0} {t('pages.users.rewards.coinsUnit')}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="min-w-[220px]">
                        <div className="mb-2 flex items-center justify-between text-xs text-gray-500">
                          <span>{row.progressPercentage}%</span>
                          <span>
                            {row.coinsAmount} / {row.targetCoins || 0}{' '}
                            {t('pages.users.rewards.coinsUnit')}
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-slate-100">
                          <div
                            className="h-2 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500"
                            style={{
                              width: `${Math.max(4, row.progressPercentage)}%`
                            }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <div>{row.latestPurchaseLabel}</div>
                      <div className="text-xs text-gray-500">
                        {formatShortDate(row.latestPurchaseDate)}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="flex flex-col items-start gap-1">
                        {getRewardStatusBadge(row.latestPurchaseStatus)}
                        <span className="text-xs text-slate-500">
                          {t('pages.users.rewards.latestStatusHint')}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {t('pages.users.rewards.requestsCount', {
                        count: row.purchaseRequestsCount,
                        pending: row.pendingPurchaseRequestsCount
                      })}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right">
                      <button
                        type="button"
                        onClick={event => {
                          event.stopPropagation()
                          openRewardsModal(row)
                        }}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-violet-200 hover:text-violet-700"
                        title={t('pages.users.rewards.viewAll')}
                      >
                        <EyeIcon className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 rounded-md border border-gray-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <label className="text-sm text-gray-700">
                {t('pages.users.perPage')}
              </label>
              <select
                value={rewardsPerPage}
                onChange={e => setRewardsPerPage(Number(e.target.value))}
                className="rounded-md border border-gray-300 px-3 py-1 text-sm"
              >
                <option value="5">5</option>
                <option value="15">15</option>
                <option value="25">25</option>
              </select>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
              <p className="text-sm text-gray-700">
                {t('pages.users.pagination.showing', {
                  start: rewardsPageStart,
                  end: rewardsPageEnd,
                  total: filteredRewardRows.length
                })}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() =>
                    setRewardsCurrentPage(prev => Math.max(1, prev - 1))
                  }
                  disabled={rewardsCurrentPage === 1}
                  className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {t('common.previous')}
                </button>
                <span className="text-sm text-gray-600">
                  {t('pages.users.pagination.page', {
                    current: rewardsCurrentPage,
                    total: rewardsTotalPages
                  })}
                </span>
                <button
                  onClick={() =>
                    setRewardsCurrentPage(prev =>
                      Math.min(rewardsTotalPages, prev + 1)
                    )
                  }
                  disabled={rewardsCurrentPage >= rewardsTotalPages}
                  className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {t('common.next')}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <UserDetailModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setSelectedUser(null)
        }}
        user={selectedUser}
      />

      {isRewardsModalOpen ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/45 p-4">
          <div className="max-h-[85vh] w-full max-w-5xl overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
              <div>
                <h3 className="text-2xl font-bold text-slate-900">
                  {selectedRewardRow?.name || t('pages.users.rewards.title')}
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  {selectedRewardRow?.email || selectedRewardRow?.userId || ''}
                </p>
                <p className="mt-2 text-sm text-slate-600">
                  {t('pages.users.rewards.requestsSubtitle')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsRewardsModalOpen(false)
                  setSelectedRewardRow(null)
                  setRewardRequests([])
                  setRewardRequestsError(null)
                }}
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                {t('common.close')}
              </button>
            </div>

            <div className="space-y-4 overflow-y-auto px-6 py-5">
              {rewardRequestsError ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  {rewardRequestsError}
                </div>
              ) : null}

              {rewardRequestsLoading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-violet-600"></div>
                </div>
              ) : rewardRequests.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 px-6 py-12 text-center text-sm text-slate-500">
                  {t('pages.users.rewards.noRequestsForUser')}
                </div>
              ) : (
                <div className="space-y-3">
                  {rewardRequests.map(request => {
                    const purchaseOption = request?.purchaseOption || null
                    const purchaseLabel = purchaseOption
                      ? replacePurchaseOptionAmount(purchaseOption)
                      : t('pages.users.rewards.noRequest')
                    const isPending =
                      (request?.status || '').toUpperCase() === 'PENDING'

                    return (
                      <div
                        key={request.id}
                        className="rounded-2xl border border-slate-200 bg-white p-4"
                      >
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-3">
                              <p className="text-base font-semibold text-slate-900">
                                {purchaseLabel}
                              </p>
                              {getRewardStatusBadge(request?.status)}
                            </div>
                            <div className="mt-2 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-500">
                              <span>
                                {t('pages.users.rewards.requestedAt')}:{' '}
                                {formatShortDate(request?.dateTimeCreated)}
                              </span>
                              <span>
                                {t('pages.users.rewards.updatedAt')}:{' '}
                                {formatShortDate(request?.dateTimeUpdated)}
                              </span>
                              <span>
                                {t('pages.users.rewards.coins')}:{' '}
                                {purchaseOption?.coins || 0}{' '}
                                {t('pages.users.rewards.coinsUnit')}
                              </span>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            {isPending ? (
                              <>
                                <button
                                  type="button"
                                  disabled={updatingPurchaseId === request.id}
                                  onClick={() =>
                                    handlePurchaseStatusUpdate({
                                      purchaseId: request.id,
                                      status: 'COMPLETED',
                                      userId: selectedRewardRow?.userId
                                    })
                                  }
                                  className="rounded-full bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {updatingPurchaseId === request.id
                                    ? t('common.loading')
                                    : t('pages.users.rewards.complete')}
                                </button>
                                <button
                                  type="button"
                                  disabled={updatingPurchaseId === request.id}
                                  onClick={() =>
                                    handlePurchaseStatusUpdate({
                                      purchaseId: request.id,
                                      status: 'FAILED',
                                      userId: selectedRewardRow?.userId
                                    })
                                  }
                                  className="rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {updatingPurchaseId === request.id
                                    ? t('common.loading')
                                    : t('pages.users.rewards.fail')}
                                </button>
                              </>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default Users
