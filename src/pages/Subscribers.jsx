import { useState, useEffect, useMemo, useRef } from 'react'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { 
  MagnifyingGlassIcon,
  FunnelIcon,
  PencilIcon,
  TrashIcon,
  EyeIcon,
  PlusIcon,
  CalendarIcon,
  CurrencyDollarIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline'
import { fetchProgramSubscribers, formatSubscriptionStatus, formatUserData, formatPaymentData } from '../services/api'
import UserDetailModal from '../components/UserDetailModal'
import { selectIsAdmin } from '../store/userSlice'

const Subscribers = () => {
  const { t } = useTranslation()
  const [searchTerm, setSearchTerm] = useState('')
  const [filterPlan, setFilterPlan] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [subscribers, setSubscribers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(25)
  const [selectedUser, setSelectedUser] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const hasLoadedRef = useRef(false)
  const isAdmin = useSelector(selectIsAdmin)

  // Manual refresh function
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

  // Fetch real data from API - only once on component mount
  useEffect(() => {
    // Prevent duplicate calls even in React Strict Mode
    if (hasLoadedRef.current) {
      console.log('Skipping duplicate API call')
      return
    }
    
    hasLoadedRef.current = true
    
    const loadSubscribers = async () => {
      // Only fetch data if user is admin
      if (!isAdmin) {
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setError(null)
        console.log('Loading subscribers... (first time only)')
        
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
        setLoading(false)
        
        console.log('State updated successfully')
      } catch (err) {
        console.log('Error occurred:', err)
        
        const errorMessage = err.message === 'Request timeout' 
          ? 'Request timed out. Please check your connection.'
          : 'Failed to load subscribers. Please try again.'
        setError(errorMessage)
        setLoading(false)
        console.error('Error loading subscribers:', err)
      }
    }

    loadSubscribers()
  }, [isAdmin]) // Include isAdmin in dependency array

  // Mock data for demonstration (fallback)
  const mockSubscribers = [
    {
      id: 1,
      name: 'John Doe',
      email: 'john.doe@example.com',
      plan: 'Premium',
      status: 'active',
      startDate: '2024-01-15',
      nextBilling: '2024-02-15',
      amount: '$29.99',
      avatar: 'JD'
    },
    {
      id: 2,
      name: 'Jane Smith',
      email: 'jane.smith@example.com',
      plan: 'Basic',
      status: 'active',
      startDate: '2024-01-10',
      nextBilling: '2024-02-10',
      amount: '$9.99',
      avatar: 'JS'
    },
    {
      id: 3,
      name: 'Mike Johnson',
      email: 'mike.johnson@example.com',
      plan: 'Premium',
      status: 'cancelled',
      startDate: '2024-01-05',
      nextBilling: '2024-02-05',
      amount: '$29.99',
      avatar: 'MJ'
    },
    {
      id: 4,
      name: 'Sarah Wilson',
      email: 'sarah.wilson@example.com',
      plan: 'Premium',
      status: 'active',
      startDate: '2024-01-18',
      nextBilling: '2024-02-18',
      amount: '$29.99',
      avatar: 'SW'
    },
    {
      id: 5,
      name: 'David Brown',
      email: 'david.brown@example.com',
      plan: 'Basic',
      status: 'paused',
      startDate: '2024-01-12',
      nextBilling: '2024-02-12',
      amount: '$9.99',
      avatar: 'DB'
    },
    {
      id: 6,
      name: 'Emily Davis',
      email: 'emily.davis@example.com',
      plan: 'Premium',
      status: 'active',
      startDate: '2024-01-20',
      nextBilling: '2024-02-20',
      amount: '$29.99',
      avatar: 'ED'
    },
  ]

  // Memoize filtered subscribers to prevent unnecessary recalculations
  const filteredSubscribers = useMemo(() => {
    return subscribers.filter(subscriber => {
      const userData = formatUserData(subscriber)
      const subscriptionData = formatSubscriptionStatus(subscriber)
      
      const matchesSearch = userData.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           userData.email.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesPlan = filterPlan === 'all' || subscriptionData.plan.includes(filterPlan)
      const matchesStatus = filterStatus === 'all' || subscriptionData.status === filterStatus
      return matchesSearch && matchesPlan && matchesStatus
    })
  }, [subscribers, searchTerm, filterPlan, filterStatus])

  const getStatusBadge = (status) => {
    const statusStyles = {
      active: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800',
      paused: 'bg-yellow-100 text-yellow-800',
      expired: 'bg-gray-100 text-gray-800'
    }
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusStyles[status]}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    )
  }

  const getPlanBadge = (plan) => {
    const planStyles = {
      Premium: 'bg-purple-100 text-purple-800',
      Basic: 'bg-blue-100 text-blue-800',
      Free: 'bg-gray-100 text-gray-800'
    }
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${planStyles[plan]}`}>
        {plan}
      </span>
    )
  }

  // Memoize stats to prevent unnecessary recalculations
  const stats = useMemo(() => [
    {
      name: 'Total Subscribers',
      value: subscribers.length,
    },
    {
      name: 'Active Subscriptions',
      value: subscribers.filter(s => formatSubscriptionStatus(s).status === 'active').length,
    },
    {
      name: 'Program Plans',
      value: subscribers.filter(s => formatSubscriptionStatus(s).plan.includes('Program')).length,
    },
    {
      name: 'Pro Plans',
      value: subscribers.filter(s => formatSubscriptionStatus(s).plan.includes('Pro')).length,
    },
  ], [subscribers])

  const paginatedSubscribers = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    const end = start + itemsPerPage
    return filteredSubscribers.slice(start, end)
  }, [filteredSubscribers, currentPage, itemsPerPage])

  const totalPages = useMemo(() => Math.max(1, Math.ceil(filteredSubscribers.length / itemsPerPage)), [filteredSubscribers.length, itemsPerPage])

  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, filterPlan, filterStatus, itemsPerPage])

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Subscribers Management</h1>
            <p className="text-gray-600 mt-2">Manage subscription plans and billing</p>
          </div>
        </div>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">{t('pages.subscribers.loading')}</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Subscribers Management</h1>
            <p className="text-gray-600 mt-2">Manage subscription plans and billing</p>
          </div>
        </div>
        <div className="card p-6">
          <div className="flex items-center">
            <ExclamationTriangleIcon className="h-8 w-8 text-red-600 mr-4" />
            <div>
              <h3 className="text-lg font-medium text-gray-900">{t('pages.subscribers.error')}</h3>
              <p className="text-gray-600 mt-1">{error}</p>
              <button 
                onClick={refreshSubscribers} 
                className="btn-primary mt-4"
              >
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
          <h1 className="text-3xl font-bold text-gray-900">Subscribers Management</h1>
          <p className="text-gray-600 mt-2">Manage subscription plans and billing</p>
        </div>
        <div className="flex gap-2 items-center justify-center sm:justify-end">
          <button 
            onClick={refreshSubscribers}
            className="btn-secondary flex items-center"
            disabled={loading}
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {loading ? 'Loading...' : 'Refresh'}
          </button>
          <button className="btn-primary flex items-center">
            <PlusIcon className="w-5 h-5 mr-2" />
            Add Subscription
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <div key={stat.name} className="card p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <CurrencyDollarIcon className="h-8 w-8 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">{stat.name}</p>
                <p className="text-2xl font-semibold text-gray-900">{stat.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters and Search */}
      <div className="card p-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search subscribers by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input pl-10"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <select
              value={filterPlan}
              onChange={(e) => setFilterPlan(e.target.value)}
              className="input w-32"
            >
              <option value="all">All Plans</option>
              <option value="Premium">Premium</option>
              <option value="Basic">Basic</option>
              <option value="Free">Free</option>
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="input w-32"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="cancelled">Cancelled</option>
              <option value="paused">Paused</option>
              <option value="expired">Expired</option>
            </select>
          </div>
        </div>
      </div>

      {/* Subscribers List & Table */}
      <div className="card overflow-hidden">
        {/* Mobile list */}
        <div className="md:hidden">
          <div className="space-y-4">
            {paginatedSubscribers.length === 0 && (
              <div className="text-center text-sm text-gray-600 py-6">No subscribers found.</div>
            )}
            {paginatedSubscribers.map((subscriber) => {
              const userData = formatUserData(subscriber)
              const subscriptionData = formatSubscriptionStatus(subscriber)
              const paymentData = formatPaymentData(subscriber)
              const avatar = userData.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)

              return (
                <div key={subscriber.id} className="border border-gray-200 rounded-lg p-4 shadow-sm">
                  <div className="flex gap-3">
                    <div className="h-12 w-12 rounded-full bg-blue-600 flex items-center justify-center text-white font-semibold text-sm">
                      {avatar}
                    </div>
                    <div className="flex-1 space-y-2">
                      <div className="flex flex-col">
                        <span className="text-base font-semibold text-gray-900 leading-tight">{userData.name}</span>
                        <span className="text-sm text-gray-600 break-words">{userData.email}</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {getPlanBadge(subscriptionData.plan)}
                        {getStatusBadge(subscriptionData.status)}
                      </div>
                      <div className="text-sm text-gray-700 flex flex-wrap gap-3">
                        <span className="flex items-center gap-1"><CurrencyDollarIcon className="w-4 h-4 text-gray-500" />{paymentData.amount}</span>
                        <span className="flex items-center gap-1"><CalendarIcon className="w-4 h-4 text-gray-500" />Start {new Date(subscriber.dateTimeCreated).toLocaleDateString()}</span>
                        <span className="flex items-center gap-1"><CalendarIcon className="w-4 h-4 text-gray-500" />Next {subscriptionData.expiresAt !== 'N/A' ? new Date(subscriptionData.expiresAt).toLocaleDateString() : 'N/A'}</span>
                      </div>
                      <div className="flex gap-3 pt-1">
                        <button 
                          onClick={() => {
                            setSelectedUser(subscriber)
                            setIsModalOpen(true)
                          }}
                          className="text-blue-600 hover:text-blue-800"
                          title="View user details and nutrition"
                        >
                          <EyeIcon className="w-5 h-5" />
                        </button>
                        <button className="text-gray-600 hover:text-gray-900">
                          <PencilIcon className="w-5 h-5" />
                        </button>
                        <button className="text-red-600 hover:text-red-800">
                          <TrashIcon className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Mobile pagination */}
          <div className="mt-4 bg-white border-t border-gray-200 px-4 py-3 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-700">Per page</label>
                <select
                  value={itemsPerPage}
                  onChange={(e) => setItemsPerPage(Number(e.target.value))}
                  className="px-2 py-1 border border-gray-300 rounded-md text-sm"
                >
                  <option value="5">5</option>
                  <option value="25">25</option>
                  <option value="50">50</option>
                </select>
              </div>
              <span className="text-xs text-gray-600">Page {currentPage} / {totalPages}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage >= totalPages}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
            <div className="text-xs text-gray-600 text-center">
              {filteredSubscribers.length === 0
                ? 'Showing 0 of 0'
                : `Showing ${((currentPage - 1) * itemsPerPage) + 1} - ${Math.min(currentPage * itemsPerPage, filteredSubscribers.length)} of ${filteredSubscribers.length}`}
            </div>
          </div>
        </div>

        {/* Desktop table */}
        <div className="hidden md:block">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Subscriber
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Plan
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Start Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Next Billing
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginatedSubscribers.map((subscriber) => {
                  const userData = formatUserData(subscriber)
                  const subscriptionData = formatSubscriptionStatus(subscriber)
                  const paymentData = formatPaymentData(subscriber)
                  const avatar = userData.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
                  
                  return (
                    <tr key={subscriber.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10">
                            <div className="h-10 w-10 rounded-full bg-blue-600 flex items-center justify-center">
                              <span className="text-sm font-medium text-white">{avatar}</span>
                            </div>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">{userData.name}</div>
                            <div className="text-sm text-gray-500">{userData.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getPlanBadge(subscriptionData.plan)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(subscriptionData.status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {paymentData.amount}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(subscriber.dateTimeCreated).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {subscriptionData.expiresAt !== 'N/A' ? 
                          new Date(subscriptionData.expiresAt).toLocaleDateString() : 
                          'N/A'
                        }
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end space-x-2">
                          <button 
                            onClick={() => {
                              setSelectedUser(subscriber)
                              setIsModalOpen(true)
                            }}
                            className="text-blue-600 hover:text-blue-900"
                            title="View user details and nutrition"
                          >
                            <EyeIcon className="w-4 h-4" />
                          </button>
                          <button className="text-gray-600 hover:text-gray-900">
                            <PencilIcon className="w-4 h-4" />
                          </button>
                          <button className="text-red-600 hover:text-red-900">
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Desktop pagination */}
          <div className="bg-white px-4 py-3 hidden md:flex flex-wrap items-center gap-4 md:gap-6 border-t border-gray-200 sm:px-6">
            <div className="flex items-center gap-3">
              <label className="text-sm text-gray-700">Items per page:</label>
              <select
                value={itemsPerPage}
                onChange={(e) => setItemsPerPage(Number(e.target.value))}
                className="px-3 py-1 border border-gray-300 rounded-md text-sm"
              >
                <option value="5">5</option>
                <option value="25">25</option>
                <option value="50">50</option>
              </select>
            </div>

            <div className="flex flex-col md:flex-row md:items-center md:gap-3 text-sm text-gray-700">
              <span className="font-medium">Page {currentPage} of {totalPages}</span>
              <span className="text-gray-600">
                {filteredSubscribers.length === 0
                  ? 'Showing 0 of 0 results'
                  : `Showing ${((currentPage - 1) * itemsPerPage) + 1} to ${Math.min(currentPage * itemsPerPage, filteredSubscribers.length)} of ${filteredSubscribers.length} results`}
              </span>
            </div>

            <div className="flex items-center gap-2 ml-auto">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage >= totalPages}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Subscription Plans Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Program Plans</h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Subscribers:</span>
              <span className="text-sm font-medium">
                {subscribers.filter(s => formatSubscriptionStatus(s).plan.includes('Program')).length}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Active:</span>
              <span className="text-sm font-medium">
                {subscribers.filter(s => {
                  const status = formatSubscriptionStatus(s)
                  return status.plan.includes('Program') && status.status === 'active'
                }).length}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Price:</span>
              <span className="text-sm font-medium">Program Plan</span>
            </div>
          </div>
        </div>
        
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Pro Plans</h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Subscribers:</span>
              <span className="text-sm font-medium">
                {subscribers.filter(s => formatSubscriptionStatus(s).plan.includes('Pro')).length}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Active:</span>
              <span className="text-sm font-medium">
                {subscribers.filter(s => {
                  const status = formatSubscriptionStatus(s)
                  return status.plan.includes('Pro') && status.status === 'active'
                }).length}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Price:</span>
              <span className="text-sm font-medium">Pro Plan</span>
            </div>
          </div>
        </div>
        
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">No Plans</h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Users:</span>
              <span className="text-sm font-medium">
                {subscribers.filter(s => formatSubscriptionStatus(s).plan === 'No Plan').length}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Status:</span>
              <span className="text-sm font-medium">Inactive</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Price:</span>
              <span className="text-sm font-medium">Free</span>
            </div>
          </div>
        </div>
      </div>

      {/* User Detail Modal */}
      <UserDetailModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setSelectedUser(null)
        }}
        user={selectedUser}
      />
    </div>
  )
}

export default Subscribers
