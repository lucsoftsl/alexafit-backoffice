/* eslint-disable max-len */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useSelector } from 'react-redux'
import {
  MagnifyingGlassIcon,
  PencilIcon,
  TrashIcon,
  EyeIcon,
  PlusIcon,
  ExclamationTriangleIcon,
  UserPlusIcon
} from '@heroicons/react/24/outline'
import { getNutritionistClients, assignClientToNutritionist, unassignClientFromNutritionist } from '../services/loggedinApi'
import { useAuth } from '../contexts/AuthContext'
import ClientDayModal from '../components/ClientDayModal'
import { selectUserData } from '../store/userSlice'

const MyUsers = () => {
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const hasLoadedRef = useRef(false)
  const [selectedUser, setSelectedUser] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [usersPerPage, setUsersPerPage] = useState(5)
  const userData = useSelector(selectUserData)
  const { currentUser } = useAuth()

  // Assign user form state
  const [assignUserId, setAssignUserId] = useState('')
  const [assignError, setAssignError] = useState(null)
  const [assigning, setAssigning] = useState(false)

  const refreshUsers = async () => {
    const nutritionistId = currentUser?.uid || userData?.userId
    if (!nutritionistId) return
    hasLoadedRef.current = false
    setError(null)
    setLoading(true)
    try {
      const response = await getNutritionistClients({ nutritionistId })
      // Backend returns array of { nutritionistUser, user } objects
      const dataArray = Array.isArray(response?.data) ? response.data : []
      // Extract just the user objects with assignment info
      const usersArray = dataArray.map(item => ({
        ...item.user,
        dateTimeAssigned: item.nutritionistUser?.dateTimeAssigned
      }))
      setUsers(usersArray)
      setError(null)
    } catch (err) {
      setError('Failed to refresh clients. Please try again.')
      console.error('Error refreshing clients:', err)
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

        const nutritionistId = currentUser?.uid || userData?.userId
        if (!nutritionistId) {
          setError('User ID not found')
          setLoading(false)
          return
        }

        const response = await getNutritionistClients({ nutritionistId })
        // Backend returns array of { nutritionistUser, user } objects
        const dataArray = Array.isArray(response?.data) ? response.data : []
        // Extract just the user objects with assignment info
        const usersArray = dataArray.map(item => ({
          ...item.user,
          dateTimeAssigned: item.nutritionistUser?.dateTimeAssigned
        }))
        setUsers(usersArray)
        setError(null)
        setLoading(false)
      } catch (err) {
        const errorMessage = 'Failed to load clients. Please try again.'
        setError(errorMessage)
        setLoading(false)
        console.error('Error loading clients:', err)
      }
    }

    loadUsers()
  }, [currentUser?.uid, userData?.userId])

  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      const name = user?.userData?.name || 
                   user?.loginDetails?.displayName || 
                   `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 
                   'Unknown'
      const email = user?.loginDetails?.email || user?.email || ''
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
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusStyles[status] || 'bg-gray-100 text-gray-800'}`}>
        {status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Unknown'}
      </span>
    )
  }

  const handleAssignUser = async (e) => {
    e.preventDefault()
    setAssignError(null)
    setAssigning(true)

    try {
      if (!assignUserId) {
        setAssignError('Please enter a valid user ID')
        setAssigning(false)
        return
      }

      const nutritionistId = currentUser?.uid || userData?.userId
      const response = await assignClientToNutritionist({
        nutritionistId,
        userId: assignUserId
      })

      if (!response?.ok) {
        throw new Error(response?.error || 'Failed to assign user')
      }

      // Reset form and close modal
      setAssignUserId('')
      setIsAssignModalOpen(false)
      // Refresh users list
      await refreshUsers()
    } catch (err) {
      setAssignError(err?.message || 'Failed to assign user. Please try again.')
      console.error('Error assigning user:', err)
    } finally {
      setAssigning(false)
    }
  }

  const handleUnassignUser = async (userId) => {
    if (!window.confirm('Are you sure you want to unassign this user?')) {
      return
    }

    try {
      const nutritionistId = currentUser?.uid || userData?.userId
      const response = await unassignClientFromNutritionist({
        nutritionistId,
        userId
      })

      if (!response?.ok) {
        throw new Error(response?.error || 'Failed to unassign user')
      }

      // Refresh users list
      await refreshUsers()
    } catch (err) {
      setError(err?.message || 'Failed to unassign user. Please try again.')
      console.error('Error unassigning user:', err)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">My Users</h1>
            <p className="text-gray-600 mt-2">Manage your clients and track their progress</p>
          </div>
        </div>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading clients...</p>
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
            <h1 className="text-3xl font-bold text-gray-900">My Users</h1>
            <p className="text-gray-600 mt-2">Manage your clients and track their progress</p>
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
          <h1 className="text-3xl font-bold text-gray-900">My Users</h1>
          <p className="text-gray-600 mt-2">Manage your clients and track their progress</p>
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
          <button
            onClick={() => setIsAssignModalOpen(true)}
            className="btn-primary flex items-center"
          >
            <UserPlusIcon className="w-5 h-5 mr-2" />
            Assign User
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
              <option value="inactive">Inactive</option>
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
                  Assigned Date
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
                const name = user?.userData?.name || 
                           user?.loginDetails?.displayName || 
                           `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 
                           'Unknown'
                const email = user?.loginDetails?.email || user?.email || 'N/A'
                const avatar = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
                const assignedDate = user?.dateTimeAssigned ? new Date(user.dateTimeAssigned).toLocaleDateString() : 'N/A'
                const lastActive = user?.dateTimeUpdated ? new Date(user.dateTimeUpdated).toLocaleDateString() : 'N/A'
                const accountStatus = (user?.status || '').toString().toLowerCase()
                const userId = Array.isArray(user?.userId) ? user.userId[0] : user?.userId
                return (
                  <tr key={userId || user?.id} className="hover:bg-gray-50">
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
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {assignedDate}
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
                        <button
                          onClick={() => handleUnassignUser(userId)}
                          className="text-red-600 hover:text-red-900"
                          title="Unassign user"
                        >
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

      {/* Assign User Modal */}
      {isAssignModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Assign Existing User</h3>
              <button
                className="text-gray-500 hover:text-gray-700 cursor-pointer"
                onClick={() => {
                  setIsAssignModalOpen(false)
                  setAssignError(null)
                  setAssignUserId('')
                }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAssignUser}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    User ID <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={assignUserId}
                    onChange={(e) => setAssignUserId(e.target.value)}
                    className="input w-full"
                    placeholder="Enter user ID"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">Enter the ID of an existing user to assign them to your client list</p>
                </div>

                {assignError && (
                  <div className="bg-red-50 border border-red-200 rounded p-3">
                    <p className="text-sm text-red-800">{assignError}</p>
                  </div>
                )}
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  className="btn-secondary px-4 py-2"
                  onClick={() => {
                    setIsAssignModalOpen(false)
                    setAssignError(null)
                    setAssignUserId('')
                  }}
                  disabled={assigning}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary px-4 py-2"
                  disabled={assigning}
                >
                  {assigning ? 'Assigning...' : 'Assign User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Client Day Modal */}
      <ClientDayModal
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

export default MyUsers
