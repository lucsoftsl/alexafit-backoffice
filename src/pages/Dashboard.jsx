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

  const stats = useMemo(() => {
    const totalSubscribers = subscribers.length
    const activeSubscribers = subscribers.filter(sub => sub.status === 'ACTIVE').length
    const proSubscribers = subscribers.filter(sub =>
      sub.subscriptionWhitelistDetails?.isPro === 'true'
    ).length

    return [
      {
        name: 'Total Subscribers',
        value: totalSubscribers.toString(),
        change: '+12%',
        changeType: 'positive',
        icon: UsersIcon,
      },
      {
        name: 'Active Subscribers',
        value: activeSubscribers.toString(),
        change: '+8%',
        changeType: 'positive',
        icon: UserGroupIcon,
      },
      {
        name: 'Pro Subscribers',
        value: proSubscribers.toString(),
        change: '+15%',
        changeType: 'positive',
        icon: ChartBarIcon,
      },
      {
        name: 'Conversion Rate',
        value: totalSubscribers > 0 ? ((proSubscribers / totalSubscribers) * 100).toFixed(1) + '%' : '0%',
        change: '+2.1%',
        changeType: 'positive',
        icon: ArrowTrendingUpIcon,
      },
    ]
  }, [subscribers])

  const recentActivities = [
    { id: 1, user: 'John Doe', action: 'Subscribed to Premium', time: '2 minutes ago', type: 'subscription' },
    { id: 2, user: 'Jane Smith', action: 'Updated profile', time: '5 minutes ago', type: 'profile' },
    { id: 3, user: 'Mike Johnson', action: 'Cancelled subscription', time: '10 minutes ago', type: 'cancellation' },
    { id: 4, user: 'Sarah Wilson', action: 'Completed workout', time: '15 minutes ago', type: 'activity' },
    { id: 5, user: 'David Brown', action: 'Joined community', time: '20 minutes ago', type: 'community' },
  ]

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
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-2">Welcome back! Here's what's happening with your fitness platform.</p>
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
              <div className="mt-4">
                <span className={`text-sm font-medium ${stat.changeType === 'positive' ? 'text-green-600' : 'text-red-600'
                  }`}>
                  {stat.change} from last month
                </span>
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

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
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
              {filteredSubscribers.map((subscriber) => {
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
      </div>

      {/* Recent Activity */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h2>
        <div className="space-y-3">
          {recentActivities.map((activity) => (
            <div key={activity.id} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-b-0">
              <div className="flex items-center">
                <div className={`w-2 h-2 rounded-full mr-3 ${activity.type === 'subscription' ? 'bg-green-500' :
                  activity.type === 'cancellation' ? 'bg-red-500' :
                    activity.type === 'profile' ? 'bg-blue-500' :
                      activity.type === 'activity' ? 'bg-purple-500' :
                        'bg-gray-500'
                  }`} />
                <div>
                  <p className="text-sm font-medium text-gray-900">{activity.user}</p>
                  <p className="text-sm text-gray-500">{activity.action}</p>
                </div>
              </div>
              <span className="text-sm text-gray-400">{activity.time}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <button
            onClick={() => {
              if (subscribers.length > 0) {
                setSelectedUser(subscribers[0])
                setIsModalOpen(true)
              }
            }}
            className="btn-primary text-center py-3 flex items-center justify-center"
          >
            <EyeIcon className="w-4 h-4 mr-2" />
            View All Users
          </button>
          <button className="btn-secondary text-center py-3">
            Export Data
          </button>
          <button className="btn-secondary text-center py-3">
            Send Newsletter
          </button>
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
