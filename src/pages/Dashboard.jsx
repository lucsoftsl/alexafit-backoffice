import { useState, useEffect, useMemo, useRef } from 'react'
import { useSelector } from 'react-redux'
import {
  UsersIcon,
  UserGroupIcon,
  ChartBarIcon,
  ArrowTrendingUpIcon,
  EyeIcon,
  PencilIcon,
  TrashIcon,
} from '@heroicons/react/24/outline'
import { fetchProgramSubscribers, formatUserData, formatSubscriptionStatus, formatPaymentData } from '../services/api'
import UserDetailModal from '../components/UserDetailModal'
import { selectIsAdmin } from '../store/userSlice'

const Dashboard = () => {
  const [subscribers, setSubscribers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedUser, setSelectedUser] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(5)
  const hasLoadedRef = useRef(false)
  const isAdmin = useSelector(selectIsAdmin)

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
        console.log('Loading subscribers...')
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

        console.log('API Response received:', data)
        console.log('Setting subscribers and stopping loading...')
        setSubscribers(data.subscribers || [])
        setError(null)
        console.log('State updated successfully')
      } catch (err) {
        console.error('Error loading subscribers:', err)
        setError(err.message || 'Failed to load subscribers')
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
      console.log('Manually refreshing subscribers...')
      const data = await fetchProgramSubscribers()
      setSubscribers(data.subscribers || [])
      setError(null)
    } catch (err) {
      setError('Failed to refresh subscribers. Please try again.')
      console.error('Error refreshing subscribers:', err)
    } finally {
      setLoading(false)
    }
  }

  const filteredSubscribers = useMemo(() => {
    return subscribers.filter(subscriber => {
      const userData = formatUserData(subscriber)
      return userData.name.toLowerCase().includes('') &&
        userData.email.toLowerCase().includes('')
    })
  }, [subscribers])

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(filteredSubscribers.length / itemsPerPage) || 1)
  }, [filteredSubscribers.length, itemsPerPage])

  const paginatedSubscribers = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    return filteredSubscribers.slice(startIndex, endIndex)
  }, [filteredSubscribers, currentPage, itemsPerPage])

  useEffect(() => {
    setCurrentPage(1)
  }, [itemsPerPage, filteredSubscribers.length])

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
        name: 'Total Subscribers',
        value: totalSubscribers.toString(),
        icon: UsersIcon,
      },
      {
        name: 'Active Subscribers',
        value: activeSubscribers.toString(),
        icon: UserGroupIcon,
      },
      {
        name: 'Pro Subscribers',
        value: proSubscribers.toString(),
        icon: ChartBarIcon,
      },
      {
        name: 'Conversion Rate',
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
          <p className="mt-4 text-gray-600">Loading subscribers...</p>
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
            Try again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-center sm:text-left">
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-1 text-sm sm:text-base">Welcome back! Here's what's happening with your fitness platform.</p>
        </div>
        <button
          onClick={refreshSubscribers}
          className="btn-primary"
        >
          Refresh Data
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
          <h2 className="text-lg font-semibold text-gray-900">Program Subscribers</h2>
          <span className="text-sm text-gray-500">{filteredSubscribers.length} subscribers</span>
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
                    <button className="text-gray-600 hover:text-gray-900">
                      <PencilIcon className="h-4 w-4" />
                    </button>
                    <button className="text-red-600 hover:text-red-900">
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div className="space-y-1">
                    <p className="text-gray-500">Subscription</p>
                    <p className="text-gray-800 text-sm">{subscriptionData.plan}</p>
                    <p className="text-gray-500">{subscriptionData.status}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-gray-500">Payment</p>
                    <p className="text-gray-800 text-sm">{paymentData.status}</p>
                    <p className="text-gray-500">{paymentData.date}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-gray-500">Contact</p>
                    <p className="text-gray-800 text-sm">{userData.phone || 'N/A'}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-gray-500">Status</p>
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${subscriber.status === 'ACTIVE'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                      }`}>
                      {subscriber.status}
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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Contact
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Subscription
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Payment
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
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
                        <div className="text-sm text-gray-900">{subscriptionData.plan}</div>
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
                        : 'bg-red-100 text-red-800'
                        }`}>
                        {subscriber.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => {
                          console.log('Opening modal for subscriber:', subscriber)
                          console.log('User ID:', subscriber.userId)
                          setSelectedUser(subscriber)
                          setIsModalOpen(true)
                        }}
                        className="text-blue-600 hover:text-blue-900 mr-3 cursor-pointer"
                      >
                        <EyeIcon className="h-4 w-4" />
                      </button>
                      <button className="text-gray-600 hover:text-gray-900 mr-3">
                        <PencilIcon className="h-4 w-4" />
                      </button>
                      <button className="text-red-600 hover:text-red-900">
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-gray-100 pt-4">
          <div className="flex items-center gap-3">
            <label className="text-sm text-gray-700">Items per page:</label>
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
                return `Showing ${start}–${end} of ${total}`
              })()}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="px-3 py-2 text-sm border border-gray-300 rounded-md bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="text-sm text-gray-600">Page {currentPage} of {totalPages}</span>
              <button
                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={currentPage >= totalPages}
                className="px-3 py-2 text-sm border border-gray-300 rounded-md bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
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
