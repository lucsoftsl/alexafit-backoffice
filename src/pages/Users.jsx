/* eslint-disable max-len */
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  PencilIcon,
  TrashIcon,
  EyeIcon,
  PlusIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline'
import { getUsers, formatUserData, formatSubscriptionStatus } from '../services/api'
import UserDetailModal from '../components/UserDetailModal'

const Users = () => {
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const hasLoadedRef = useRef(false)
  const [selectedUser, setSelectedUser] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [usersPerPage, setUsersPerPage] = useState(5)

  const refreshUsers = async () => {
    hasLoadedRef.current = false
    setError(null)
    setLoading(true)
    try {
      const data = await getUsers()
      const usersArray = Array.isArray(data?.data) ? data.data : (data?.users || [])
      setUsers(usersArray)
      try { localStorage.setItem('users', JSON.stringify(data)) } catch (_) { }
      setError(null)
    } catch (err) {
      setError('Failed to refresh users. Please try again.')
      console.error('Error refreshing users:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (hasLoadedRef.current) {
      return
    }
    hasLoadedRef.current = true

    const loadUsers = async () => {
      try {
        setLoading(true)
        setError(null)

        // Load cached users if available (indefinite cache)
        const cachedData = localStorage.getItem('users')
        if (cachedData) {
          const data = JSON.parse(cachedData)
          const usersArray = Array.isArray(data?.data) ? data.data : (data?.users || [])
          setUsers(usersArray)
          setLoading(false)
          return
        }

        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Request timeout')), 10000)
        )

        const data = await Promise.race([
          getUsers(),
          timeoutPromise
        ])

        const usersArray = Array.isArray(data?.data) ? data.data : (data?.users || [])
        setUsers(usersArray)
        try { localStorage.setItem('users', JSON.stringify(data)) } catch (_) { }
        setError(null)
        setLoading(false)
      } catch (err) {
        const errorMessage = err.message === 'Request timeout'
          ? 'Request timed out. Please check your connection.'
          : 'Failed to load users. Please try again.'
        setError(errorMessage)
        setLoading(false)
        console.error('Error loading users:', err)
      }
    }

    loadUsers()
  }, [])

  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      const { name, email } = formatUserData(user)
      const matchesSearch = name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        email.toLowerCase().includes(searchTerm.toLowerCase())
      const accountStatus = (user?.status || '').toString().toLowerCase()
      const matchesFilter = filterStatus === 'all' || accountStatus === filterStatus
      return matchesSearch && matchesFilter
    })
  }, [users, searchTerm, filterStatus])

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, usersPerPage, filterStatus])

  const getStatusBadge = (status) => {
    const statusStyles = {
      active: 'bg-green-100 text-green-800',
      inactive: 'bg-gray-100 text-gray-800',
      suspended: 'bg-red-100 text-red-800'
    }
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusStyles[status]}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    )
  }

  const getSubscriptionBadge = (subscription) => {
    const subscriptionStyles = {
      Premium: 'bg-purple-100 text-purple-800',
      Basic: 'bg-blue-100 text-blue-800',
      Free: 'bg-gray-100 text-gray-800'
    }
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${subscriptionStyles[subscription]}`}>
        {subscription}
      </span>
    )
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Users Management</h1>
            <p className="text-gray-600 mt-2">Manage and monitor all platform users</p>
          </div>
        </div>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading users...</p>
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
            <h1 className="text-3xl font-bold text-gray-900">Users Management</h1>
            <p className="text-gray-600 mt-2">Manage and monitor all platform users</p>
          </div>
        </div>
        <div className="card p-6">
          <div className="flex items-center">
            <ExclamationTriangleIcon className="h-8 w-8 text-red-600 mr-4" />
            <div>
              <h3 className="text-lg font-medium text-gray-900">Error Loading Data</h3>
              <p className="text-gray-600 mt-1">{error}</p>
              <button onClick={refreshUsers} className="btn-primary mt-4">Try Again</button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Users Management</h1>
          <p className="text-gray-600 mt-2">Manage and monitor all platform users</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={refreshUsers}
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
            Add User
          </button>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="card p-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search users by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input pl-10"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="input w-40"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="pending_deletion">Pending Deletion</option>
            </select>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Subscription
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Join Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Active
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {(() => {
                const startIndex = (currentPage - 1) * usersPerPage
                const endIndex = startIndex + usersPerPage
                const pageUsers = filteredUsers.slice(startIndex, endIndex)
                return pageUsers
              })().map((user) => {
                const userData = formatUserData(user)
                const loginDetails = user?.loginDetails || {}

                const subInfo = formatSubscriptionStatus(user)
                let name = 'Unknown'
                if (userData?.name) {
                  name = userData.name
                } else if (user?.firstName && user?.lastName) {
                  name = `${user.firstName} ${user.lastName}`.trim()
                } else if (loginDetails?.displayName) {
                  name = loginDetails.displayName
                } else if (user?.firstName) {
                  name = user.firstName
                } else if (user?.lastName) {
                  name = user.lastName
                }
                const email = user?.email || loginDetails?.providerData?.[0]?.email || loginDetails?.email || 'N/A'
                const subscription = subInfo.plan === 'Pro Plan' ? 'Premium' : (subInfo.plan === 'Program Plan' ? 'Premium' : 'Free')
                const avatar = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
                const joinDate = user?.dateTimeCreated ? new Date(user.dateTimeCreated).toLocaleDateString() : 'N/A'
                const lastActive = user?.dateTimeUpdated ? new Date(user.dateTimeUpdated).toLocaleDateString() : 'N/A'
                const accountStatus = (user?.status || '').toString().toLowerCase()
                return (
                  <tr key={user?.userId || user?.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          <div className="h-10 w-10 rounded-full bg-blue-600 flex items-center justify-center">
                            <span className="text-sm font-medium text-white">{avatar}</span>
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{name}</div>
                          <div className="text-sm text-gray-500">{email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(accountStatus)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getSubscriptionBadge(subscription)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {joinDate}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {lastActive}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end space-x-2">
                        <button
                          onClick={() => {
                            setSelectedUser(user)
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

        {/* Pagination */}
        <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
          <div className="flex items-center gap-4">
            <label className="text-sm text-gray-700">Items per page:</label>
            <select
              value={usersPerPage}
              onChange={(e) => {
                setUsersPerPage(Number(e.target.value))
                setCurrentPage(1)
              }}
              className="px-3 py-1 border border-gray-300 rounded-md text-sm"
            >
              <option value="5">5</option>
              <option value="15">15</option>
              <option value="25">25</option>
            </select>
          </div>
          <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between ml-4">
            <div>
              <p className="text-sm text-gray-700">
                {(() => {
                  const total = filteredUsers.length
                  const start = total > 0 ? (currentPage - 1) * usersPerPage + 1 : 0
                  const end = Math.min(currentPage * usersPerPage, total)
                  return (
                    <>Showing <span className="font-medium">{start}</span> to <span className="font-medium">{end}</span> of <span className="font-medium">{total}</span> results</>
                  )
                })()}
              </p>
            </div>
            <div>
              <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">
                  Page {currentPage} of {Math.max(1, Math.ceil(filteredUsers.length / usersPerPage))}
                </span>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(Math.ceil(filteredUsers.length / usersPerPage) || 1, prev + 1))}
                  disabled={currentPage >= (Math.ceil(filteredUsers.length / usersPerPage) || 1)}
                  className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </nav>
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

export default Users
