import { useState, useEffect, useMemo, useRef } from 'react'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import {
  UsersIcon,
  UserGroupIcon,
  ChartBarIcon,
  ArrowTrendingUpIcon,
  EyeIcon,
  MagnifyingGlassIcon,
  ChatBubbleLeftRightIcon
} from '@heroicons/react/24/outline'
import { fetchProgramSubscribers, formatUserData, formatSubscriptionStatus, formatPaymentData } from '../services/api'
import UserDetailModal from '../components/UserDetailModal'
import { selectIsAdmin } from '../store/userSlice'

const Dashboard = ({ onOpenChat = () => {} }) => {
  const [subscribers, setSubscribers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedUser, setSelectedUser] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(5)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterPlan, setFilterPlan] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [sortField, setSortField] = useState('dateTimeCreated')
  const [sortDirection, setSortDirection] = useState('desc')
  const hasLoadedRef = useRef(false)
  const isAdmin = useSelector(selectIsAdmin)
  const { t } = useTranslation()

  const normalizePlanType = planRaw => {
    const plan = String(planRaw || '').trim().toLowerCase()
    if (plan.includes('paid') && plan.includes('not onboarded')) return 'Paid - Not Onboarded'
    if (plan.includes('program')) return 'Program Plan'
    if (plan.includes('pro')) return 'Pro Plan'
    return 'No Plan'
  }

  useEffect(() => {
    const loadSubscribers = async () => {
      if (hasLoadedRef.current) return
      hasLoadedRef.current = true

      // Only fetch data if user is admin
      if (!isAdmin) {
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setError(null)

        // Add timeout to prevent hanging
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Request timeout')), 10000)
        )

        const data = await Promise.race([
          fetchProgramSubscribers(),
          timeoutPromise
        ])

        setSubscribers(data.subscribers || [])
        setError(null)
      } catch (err) {
        setError(err.message || t('Failed to load subscribers'))
      } finally {
        setLoading(false)
      }
    }

    loadSubscribers()
  }, [isAdmin])

  const refreshSubscribers = async () => {
    if (!isAdmin) return
    
    hasLoadedRef.current = false
    setError(null)
    setLoading(true)

    try {
      const data = await fetchProgramSubscribers()
      setSubscribers(data.subscribers || [])
      setError(null)
    } catch (err) {
      setError(t('Failed to refresh subscribers. Please try again.'))
    } finally {
      setLoading(false)
    }
  }

  const filteredSubscribers = useMemo(() => {
    return subscribers.filter(subscriber => {
      const userData = formatUserData(subscriber)
      const subscriptionData = formatSubscriptionStatus(subscriber)
      const matchesSearch =
        userData.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        userData.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(subscriber?.userId || '').toLowerCase().includes(searchTerm.toLowerCase())
      const matchesPlan =
        filterPlan === 'all' || normalizePlanType(subscriptionData.plan) === filterPlan
      const matchesStatus =
        filterStatus === 'all' || String(subscriptionData.status || '').toLowerCase() === filterStatus
      return matchesSearch && matchesPlan && matchesStatus
    })
  }, [subscribers, searchTerm, filterPlan, filterStatus])

  const sortedSubscribers = useMemo(() => {
    const direction = sortDirection === 'asc' ? 1 : -1
    return [...filteredSubscribers].sort((a, b) => {
      const userDataA = formatUserData(a)
      const userDataB = formatUserData(b)
      const subscriptionDataA = formatSubscriptionStatus(a)
      const subscriptionDataB = formatSubscriptionStatus(b)
      const paymentDataA = formatPaymentData(a)
      const paymentDataB = formatPaymentData(b)

      switch (sortField) {
        case 'name':
          return userDataA.name.localeCompare(userDataB.name) * direction
        case 'email':
          return userDataA.email.localeCompare(userDataB.email) * direction
        case 'plan':
          return normalizePlanType(subscriptionDataA.plan).localeCompare(
            normalizePlanType(subscriptionDataB.plan)
          ) * direction
        case 'status':
          return String(subscriptionDataA.status || '').localeCompare(
            String(subscriptionDataB.status || '')
          ) * direction
        case 'amount': {
          const amountA = Number.parseFloat(String(paymentDataA.amount || '').replace(/[^\d.]/g, '')) || 0
          const amountB = Number.parseFloat(String(paymentDataB.amount || '').replace(/[^\d.]/g, '')) || 0
          return (amountA - amountB) * direction
        }
        case 'dateTimeCreated':
        default: {
          const timeA = a?.dateTimeCreated ? new Date(a.dateTimeCreated).getTime() : 0
          const timeB = b?.dateTimeCreated ? new Date(b.dateTimeCreated).getTime() : 0
          return (timeA - timeB) * direction
        }
      }
    })
  }, [filteredSubscribers, sortDirection, sortField])

  const handleSort = field => {
    if (sortField === field) {
      setSortDirection(current => (current === 'asc' ? 'desc' : 'asc'))
      return
    }
    setSortField(field)
    setSortDirection('asc')
  }

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(sortedSubscribers.length / itemsPerPage) || 1)
  }, [sortedSubscribers.length, itemsPerPage])

  const paginatedSubscribers = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    return sortedSubscribers.slice(startIndex, endIndex)
  }, [sortedSubscribers, currentPage, itemsPerPage])

  useEffect(() => {
    setCurrentPage(1)
  }, [itemsPerPage, filteredSubscribers.length, searchTerm, filterPlan, filterStatus])

  const stats = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const totalSubscribers = subscribers.length

    // Active subscribers: status === 'ACTIVE' AND subscription is still active
    const activeSubscribers = subscribers.filter(sub => {
      if (sub.status !== 'ACTIVE') return false

      // Check whitelist subscription (web-based)
      if (sub.subscriptionWhitelistDetails?.activeUntil) {
        const activeUntil = new Date(sub.subscriptionWhitelistDetails.activeUntil)
        activeUntil.setHours(0, 0, 0, 0)
        if (activeUntil >= today) return true
      }

      // Check RevenueCat subscription (mobile-based)
      if (sub.subscriptionDetails?.Pro?.isActive === true) {
        return true
      }

      return false
    }).length

    // Pro subscribers: either whitelist or RevenueCat Pro is active
    const proSubscribers = subscribers.filter(sub => {
      // Check whitelist Pro
      if (sub.subscriptionWhitelistDetails?.isPro === 'true') {
        const activeUntil = new Date(sub.subscriptionWhitelistDetails.activeUntil || '1970-01-01')
        activeUntil.setHours(0, 0, 0, 0)
        if (activeUntil >= today) return true
      }

      // Check RevenueCat Pro
      if (sub.subscriptionDetails?.Pro?.isActive === true) {
        return true
      }

      return false
    }).length

    const conversionRate = totalSubscribers > 0 ? ((proSubscribers / totalSubscribers) * 100).toFixed(1) : '0'

    return [
      {
        name: t('common.Total Subscribers'),
        value: totalSubscribers.toString(),
        icon: UsersIcon,
      },
      {
        name: t('common.Active Subscribers') ,
        value: activeSubscribers.toString(),
        icon: UserGroupIcon,
      },
      {
        name: t('common.Pro Subscribers'),
        value: proSubscribers.toString(),
        icon: ChartBarIcon,
      },
      {
        name: t('common.Conversion Rate'),
        value: `${conversionRate}%`,
        icon: ArrowTrendingUpIcon,
      },
    ]
  }, [subscribers])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">{t('pages.dashboard.loading')}</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
          <button
            onClick={refreshSubscribers}
            className="mt-2 text-blue-600 hover:text-blue-900 underline"
          >
            {t('common.tryAgain')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-center sm:text-left">
          <h1 className="text-3xl font-bold text-gray-900">{t('pages.dashboard.title')}</h1>
          <p className="text-gray-600 mt-1 text-sm sm:text-base">{t('pages.dashboard.welcomeMessage')}</p>
        </div>
        <button
          onClick={refreshSubscribers}
          className="btn-primary"
        >
          {t('pages.dashboard.refresh')}
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <div key={stat.name} className="card p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Icon className="h-8 w-8 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">{stat.name}</p>
                  <p className="text-2xl font-semibold text-gray-900">{stat.value}</p>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Subscribers Table */}
      <div className="card p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-semibold text-gray-900">{t('pages.dashboard.subscribers')}</h2>
          <span className="text-sm text-gray-500">{filteredSubscribers.length} {t('subscribers')}</span>
        </div>
        <div className="mb-6 flex flex-col gap-3 lg:flex-row">
          <div className="relative flex-1">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={event => setSearchTerm(event.target.value)}
              placeholder="Search subscribers by name, email, or ID..."
              className="input pl-10"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={filterPlan}
              onChange={event => setFilterPlan(event.target.value)}
              className="input w-40"
            >
              <option value="all">All Plans</option>
              <option value="Program Plan">Program Plan</option>
              <option value="Pro Plan">Pro Plan</option>
              <option value="No Plan">No Plan</option>
            </select>
            <select
              value={filterStatus}
              onChange={event => setFilterStatus(event.target.value)}
              className="input w-36"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="cancelled">Cancelled</option>
              <option value="paused">Paused</option>
              <option value="expired">Expired</option>
            </select>
          </div>
        </div>
        <div className="space-y-3 md:hidden">
          {paginatedSubscribers.map((subscriber) => {
            const userData = formatUserData(subscriber)
            const subscriptionData = formatSubscriptionStatus(subscriber)
            const paymentData = formatPaymentData(subscriber)
            return (
              <div key={subscriber.id} className="card p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{userData.name}</p>
                    <p className="text-xs text-gray-500">{userData.email}</p>
                    <p className="text-xs text-gray-400">ID: {subscriber.userId}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setSelectedUser(subscriber)
                        setIsModalOpen(true)
                      }}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      <EyeIcon className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => onOpenChat(subscriber.userId)}
                      className="text-green-600 hover:text-green-900"
                      title="Chat with user"
                    >
                      <ChatBubbleLeftRightIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div className="space-y-1">
                    <p className="text-gray-500">{t('common.Subscription')}</p>
                    <p className="text-gray-800 text-sm">{subscriptionData.plan}</p>
                    <p className="text-gray-500">{subscriptionData.status}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-gray-500">{t('common.Payment')}</p>
                    <p className="text-gray-800 text-sm">{paymentData.status}</p>
                    <p className="text-gray-500">{paymentData.date}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-gray-500">{t('common.Contact')}</p>
                    <p className="text-gray-800 text-sm">{userData.phone || 'N/A'}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-gray-500">{t('common.Status')}</p>
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${subscriber.status === 'ACTIVE'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                      }`}>
                      {t(`common.${subscriber.status}`)}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <div className="overflow-x-auto hidden md:block">
          <table className="min-w-[960px] divide-y divide-gray-200">
            <thead className="bg-gray-50">
                <tr>
                  <th
                    onClick={() => handleSort('name')}
                    className="cursor-pointer px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                  >
                    {t('common.User')}
                  </th>
                  <th
                    onClick={() => handleSort('email')}
                    className="cursor-pointer px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                  >
                    {t('common.Contact')}
                  </th>
                  <th
                    onClick={() => handleSort('plan')}
                    className="cursor-pointer px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                  >
                    {t('common.Subscription')}
                  </th>
                  <th
                    onClick={() => handleSort('amount')}
                    className="cursor-pointer px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                  >
                    {t('common.Payment')}
                  </th>
                  <th
                    onClick={() => handleSort('status')}
                    className="cursor-pointer px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                  >
                    {t('common.Status')}
                  </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('common.Actions')}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginatedSubscribers.map((subscriber) => {
                const userData = formatUserData(subscriber)
                const subscriptionData = formatSubscriptionStatus(subscriber)
                const paymentData = formatPaymentData(subscriber)

                return (
                  <tr key={subscriber.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{userData.name}</div>
                        <div className="text-sm text-gray-500">ID: {subscriber.userId}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm text-gray-900">{userData.email}</div>
                        <div className="text-sm text-gray-500">{userData.phone}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className={`text-sm font-medium ${normalizePlanType(subscriptionData.plan) === 'Paid - Not Onboarded' ? 'text-amber-700' : 'text-gray-900'}`}>
                          {normalizePlanType(subscriptionData.plan)}
                        </div>
                        <div className="text-sm text-gray-500">{subscriptionData.status}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm text-gray-900">{paymentData.status}</div>
                        <div className="text-sm text-gray-500">{paymentData.date}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${subscriber.status === 'ACTIVE'
                        ? 'bg-green-100 text-green-800'
                        : subscriber.noMobileOnboarding
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-red-100 text-red-800'
                        }`}>
                        {subscriber.noMobileOnboarding ? 'Not Onboarded' : t(`common.${subscriber.status}`)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setSelectedUser(subscriber)
                            setIsModalOpen(true)
                          }}
                          className="text-blue-600 hover:text-blue-900 cursor-pointer"
                        >
                          <EyeIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => onOpenChat(subscriber.userId)}
                          className="text-green-600 hover:text-green-900 cursor-pointer"
                          title="Chat with user"
                        >
                          <ChatBubbleLeftRightIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-gray-100 pt-4">
          <div className="flex items-center gap-3">
            <label className="text-sm text-gray-700">{t('common.Items per page')}:</label>
            <select
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value))
                setCurrentPage(1)
              }}
              className="px-3 py-1 border border-gray-300 rounded-md text-sm"
            >
              <option value={5}>5</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
            <p className="text-sm text-gray-700">
              {(() => {
                const total = filteredSubscribers.length
                const start = total > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0
                const end = Math.min(currentPage * itemsPerPage, total)
                return `${t('common.Showing')} ${start}–${end} ${t('common.of')} ${total}`
              })()}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="px-3 py-2 text-sm border border-gray-300 rounded-md bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('common.Previous')}
              </button>
              <span className="text-sm text-gray-600">{t('common.Page')} {currentPage} {t('common.of')} {totalPages}</span>
              <button
                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={currentPage >= totalPages}
                className="px-3 py-2 text-sm border border-gray-300 rounded-md bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('common.Next')}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* User Detail Modal */}
      <UserDetailModal
        user={selectedUser}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setSelectedUser(null)
        }}
      />
    </div>
  )
}

export default Dashboard
