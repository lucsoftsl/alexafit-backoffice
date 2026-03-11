/* eslint-disable max-len */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import {
  MagnifyingGlassIcon,
  TrashIcon,
  ExclamationTriangleIcon,
  UserPlusIcon,
  XMarkIcon,
  FingerPrintIcon,
  InformationCircleIcon,
  CheckCircleIcon,
  ArrowTopRightOnSquareIcon
} from '@heroicons/react/24/outline'
import { getNutritionistClients, assignClientToNutritionist, unassignClientFromNutritionist } from '../services/loggedinApi'
import { useAuth } from '../contexts/AuthContext'
import { selectUserData } from '../store/userSlice'

const MyUsers = ({ onSelectClient = () => {} }) => {
  const cardClass = 'rounded-[24px] border border-[#e7eaf1] bg-white shadow-[0_10px_30px_rgba(15,23,42,0.05)]'
  const statCardClass = 'rounded-[20px] border border-[#e7def8] bg-[#f7f2ff] p-4 md:p-5'

  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const hasLoadedRef = useRef(false)
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [usersPerPage, setUsersPerPage] = useState(5)
  const userData = useSelector(selectUserData)
  const { currentUser } = useAuth()
  const { t } = useTranslation()

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
        dateTimeAssigned: item.nutritionistUser?.dateTimeAssigned,
        userId: Array.isArray(item.user?.userId) && item.user.userId.length > 0 ? item.user.userId[0] : item.user?.userId
      }))
      setUsers(usersArray)
      setError(null)
    } catch (err) {
      setError(t('pages.myUsers.errors.refresh'))
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
          setError(t('pages.myUsers.errors.userIdNotFound'))
          setLoading(false)
          return
        }

        const response = await getNutritionistClients({ nutritionistId })
        // Backend returns array of { nutritionistUser, user } objects
        const dataArray = Array.isArray(response?.data) ? response.data : []
        // Extract just the user objects with assignment info
        const usersArray = dataArray.map(item => ({
          ...item.user,
          dateTimeAssigned: item.nutritionistUser?.dateTimeAssigned,
          userId: Array.isArray(item.user?.userId) && item.user.userId.length > 0 ? item.user.userId[0] : item.user?.userId
        }))
        setUsers(usersArray)
        setError(null)
        setLoading(false)
      } catch (err) {
        setError(t('pages.myUsers.error'))
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
                   t('pages.myUsers.list.unknown')
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

  const paginatedUsers = useMemo(() => {
    const startIndex = (currentPage - 1) * usersPerPage
    const endIndex = startIndex + usersPerPage
    return filteredUsers.slice(startIndex, endIndex)
  }, [filteredUsers, currentPage, usersPerPage])

  const totalPages = useMemo(() => Math.max(1, Math.ceil(filteredUsers.length / usersPerPage)), [filteredUsers.length, usersPerPage])

  const filterTabs = [
    { value: 'all', label: t('pages.myUsers.filters.allStatus') },
    { value: 'active', label: t('pages.myUsers.active') },
    { value: 'inactive', label: t('pages.myUsers.inactive') }
  ]

  const getDisplayName = user =>
    user?.userData?.name ||
    user?.loginDetails?.displayName ||
    `${user?.firstName || ''} ${user?.lastName || ''}`.trim() ||
    t('pages.myUsers.list.unknown')

  const getDisplayEmail = user =>
    user?.loginDetails?.email || user?.email || t('pages.myUsers.list.notAvailable')

  const getDisplayAssignedDate = user =>
    user?.dateTimeAssigned
      ? new Date(user.dateTimeAssigned).toLocaleDateString()
      : t('pages.myUsers.list.notAvailable')

  const getStatusBadge = (status) => {
    const normalized = (status || '').toString().toLowerCase()
    const statusStyles = {
      active: 'bg-[#ddf6e7] text-[#1f8b50]',
      inactive: 'bg-[#eef2f7] text-[#6d7a92]',
      suspended: 'bg-[#ffe2e2] text-[#c35353]'
    }
    const style = statusStyles[normalized] || statusStyles.inactive
    const statusLabels = {
      active: t('pages.myUsers.active'),
      inactive: t('pages.myUsers.inactive'),
      suspended: t('pages.myUsers.list.unknown')
    }
    const label = statusLabels[normalized] || (normalized ? normalized.charAt(0).toUpperCase() + normalized.slice(1) : t('pages.myUsers.list.unknown'))
    return (
      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${style}`}>
        {label}
      </span>
    )
  }

  // Stats for header
  const stats = useMemo(() => {
    const total = users.length
    const active = users.filter(u => (u?.status || '').toString().toLowerCase() === 'active').length
    const inactive = users.filter(u => (u?.status || '').toString().toLowerCase() === 'inactive').length
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
    const recentAssigned = users.filter(u => {
      const d = u?.dateTimeAssigned ? new Date(u.dateTimeAssigned).getTime() : 0
      return d >= sevenDaysAgo
    }).length
    return { total, active, inactive, recentAssigned }
  }, [users])

  const handleAssignUser = async (e) => {
    e.preventDefault()
    setAssignError(null)
    setAssigning(true)

    try {
      if (!assignUserId) {
        setAssignError(t('pages.myUsers.errors.assignUserIdMissing'))
        setAssigning(false)
        return
      }

      const nutritionistId = currentUser?.uid || userData?.userId
      const response = await assignClientToNutritionist({
        nutritionistId,
        userId: assignUserId
      })

      if (!response?.ok) {
        throw new Error(response?.error || t('pages.myUsers.errors.assignFailed'))
      }

      // Reset form and close modal
      setAssignUserId('')
      setIsAssignModalOpen(false)
      // Refresh users list
      await refreshUsers()
    } catch (err) {
      setAssignError(err?.message || t('pages.myUsers.errors.assignFailedRetry'))
      console.error('Error assigning user:', err)
    } finally {
      setAssigning(false)
    }
  }

  const handleUnassignUser = async (userId) => {
    if (!window.confirm(t('pages.myUsers.confirmUnassign'))) {
      return
    }

    try {
      const nutritionistId = currentUser?.uid || userData?.userId
      const response = await unassignClientFromNutritionist({
        nutritionistId,
        userId
      })

      if (!response?.ok) {
        throw new Error(response?.error || t('pages.myUsers.errors.unassignFailed'))
      }

      // Refresh users list
      await refreshUsers()
    } catch (err) {
      setError(err?.message || t('pages.myUsers.errors.unassignFailedRetry'))
      console.error('Error unassigning user:', err)
    }
  }

  const handleSelectClient = (user) => {
    if (onSelectClient) {
      onSelectClient(user)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-[-0.03em] text-[#1b2232]">
            {t('pages.myUsers.headerTitle')}
          </h1>
          <p className="mt-2 text-base text-[#607089]">
            {t('pages.myUsers.headerSubtitle')}
          </p>
        </div>
        <div className={`${cardClass} flex items-center justify-center p-10`}>
          <div className="text-center">
            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-[#7a56df]"></div>
            <p className="mt-4 text-[#607089]">{t('pages.myUsers.loading')}</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-[-0.03em] text-[#1b2232]">
            {t('pages.myUsers.headerTitle')}
          </h1>
          <p className="mt-2 text-base text-[#607089]">
            {t('pages.myUsers.headerSubtitle')}
          </p>
        </div>
        <div className={`${cardClass} p-6`}>
          <div className="flex items-center">
            <ExclamationTriangleIcon className="mr-4 h-8 w-8 text-rose-600" />
            <div>
              <h3 className="text-lg font-semibold text-[#1b2232]">{t('pages.myUsers.error')}</h3>
              <p className="mt-1 text-[#607089]">{error}</p>
              <button
                onClick={refreshUsers}
                className="mt-4 rounded-xl bg-[#7a56df] px-4 py-2 text-sm font-semibold text-white"
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
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-[-0.03em] text-[#1b2232]">
            {t('pages.myUsers.headerTitle')}
          </h1>
          <p className="mt-2 text-base text-[#607089]">
            {t('pages.myUsers.headerSubtitle')}
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={refreshUsers}
            className="hidden items-center rounded-2xl border border-[#dfe3ec] bg-white px-4 py-3 text-sm font-medium text-[#4f5e76] transition hover:bg-[#f8f9fc] md:inline-flex"
            disabled={loading}
          >
            {loading ? t('pages.myUsers.actions.loading') : t('pages.myUsers.actions.refresh')}
          </button>
          <button
            onClick={() => setIsAssignModalOpen(true)}
            className="inline-flex items-center rounded-2xl bg-[#7a56df] px-5 py-3 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(122,86,223,0.28)] transition hover:bg-[#6947ca]"
          >
            <UserPlusIcon className="mr-2 h-5 w-5" />
            {t('pages.myUsers.actions.assignUser')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className={statCardClass}>
          <p className="text-sm text-[#62718a]">{t('pages.myUsers.stats.total')}</p>
          <p className="mt-2 text-4xl font-bold tracking-[-0.04em] text-[#7a56df]">{stats.total}</p>
        </div>
        <div className={statCardClass}>
          <p className="text-sm text-[#62718a]">{t('pages.myUsers.stats.active')}</p>
          <p className="mt-2 text-4xl font-bold tracking-[-0.04em] text-[#7a56df]">{stats.active}</p>
        </div>
        <div className={statCardClass}>
          <p className="text-sm text-[#62718a]">{t('pages.myUsers.stats.inactive')}</p>
          <p className="mt-2 text-4xl font-bold tracking-[-0.04em] text-[#7a56df]">{stats.inactive}</p>
        </div>
        <div className={statCardClass}>
          <p className="text-sm text-[#62718a]">{t('pages.myUsers.stats.assigned7d')}</p>
          <p className="mt-2 text-4xl font-bold tracking-[-0.04em] text-[#7a56df]">{stats.recentAssigned}</p>
        </div>
      </div>

      <div className={cardClass}>
        <div className="border-b border-[#edf0f5] px-4 py-4 md:px-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              {filterTabs.map(tab => {
                const isActive = filterStatus === tab.value
                return (
                  <button
                    key={tab.value}
                    type="button"
                    onClick={() => setFilterStatus(tab.value)}
                    className={`rounded-full px-3 py-2 text-sm font-semibold transition ${
                      isActive
                        ? 'bg-[#f1ecff] text-[#7a56df]'
                        : 'text-[#66758e] hover:bg-[#f6f7fb] hover:text-[#1b2232]'
                    }`}
                  >
                    {tab.label}
                  </button>
                )
              })}
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={refreshUsers}
                className="inline-flex items-center rounded-2xl border border-[#dfe3ec] bg-white px-4 py-3 text-sm font-medium text-[#4f5e76] transition hover:bg-[#f8f9fc] md:hidden"
                disabled={loading}
              >
                {loading ? t('pages.myUsers.actions.loading') : t('pages.myUsers.actions.refresh')}
              </button>
              <div className="relative w-full md:w-[320px]">
                <MagnifyingGlassIcon className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#a3abb9]" />
                <input
                  type="text"
                  placeholder={t('pages.myUsers.filters.searchPlaceholder')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full rounded-2xl border border-[#e3e7ef] bg-[#fafbfd] py-3 pl-11 pr-4 text-sm text-[#1b2232] outline-none transition placeholder:text-[#98a1b3] focus:border-[#7a56df]"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-3 md:hidden">
        {paginatedUsers.map((user) => {
          const name = getDisplayName(user)
          const email = getDisplayEmail(user)
          const avatar = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
          const assignedDate = getDisplayAssignedDate(user)
          const accountStatus = (user?.status || '').toString().toLowerCase()
          const userId = Array.isArray(user?.userId) ? user.userId[0] : user?.userId
          return (
            <div
              key={userId || user?.id}
              className={`${cardClass} cursor-pointer p-4 transition hover:shadow-[0_16px_32px_rgba(15,23,42,0.08)]`}
              onClick={() => handleSelectClient(user)}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center">
                  <div className="mr-3 flex h-11 w-11 items-center justify-center rounded-full bg-[linear-gradient(135deg,#7a56df,#a35bff)] text-white shadow-md">
                    <span className="text-sm font-semibold">{avatar}</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#1b2232]">{name}</p>
                    <p className="text-xs text-[#7b8497]">{email}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleUnassignUser(userId)
                    }}
                    className="rounded-full p-2 text-[#8f98ab] transition hover:bg-[#f8f9fc] hover:text-rose-600"
                    title={t('pages.myUsers.unassign')}
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div className="space-y-1">
                  <p className="text-[#7b8497]">{t('pages.myUsers.list.status')}</p>
                  {getStatusBadge(accountStatus)}
                </div>
                <div className="space-y-1">
                  <p className="text-[#7b8497]">{t('pages.myUsers.list.assigned')}</p>
                  <p className="text-sm text-[#1b2232]">{assignedDate}</p>
                </div>
              </div>
            </div>
          )
        })}

        {/* Mobile Pagination */}
        <div className={`${cardClass} mt-2 flex flex-col gap-3 px-4 py-3`}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <label className="text-sm text-[#607089]">{t('pages.myUsers.pagination.perPage')}</label>
              <select
                value={usersPerPage}
                onChange={(e) => {
                  setUsersPerPage(Number(e.target.value))
                  setCurrentPage(1)
                }}
                className="rounded-md border border-[#dfe3ec] bg-white px-2 py-1 text-sm"
              >
                <option value="5">5</option>
                <option value="15">15</option>
                <option value="25">25</option>
              </select>
            </div>
            <span className="text-xs text-[#7b8497]">{t('pages.myUsers.pagination.pageOf', { current: currentPage, total: totalPages })}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="w-full rounded-md border border-[#dfe3ec] bg-white px-3 py-2 text-sm font-medium text-[#1b2232] hover:bg-[#fafbfd] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t('common.Previous')}
            </button>
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage >= totalPages}
              className="w-full rounded-md border border-[#dfe3ec] bg-white px-3 py-2 text-sm font-medium text-[#1b2232] hover:bg-[#fafbfd] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t('common.Next')}
            </button>
          </div>
          <div className="text-center text-xs text-[#7b8497]">
            {filteredUsers.length === 0
              ? t('pages.myUsers.pagination.showingZero')
              : t('pages.myUsers.pagination.showingRange', {
                  start: ((currentPage - 1) * usersPerPage) + 1,
                  end: Math.min(currentPage * usersPerPage, filteredUsers.length),
                  total: filteredUsers.length
                })}
          </div>
        </div>
      </div>

      {/* Users Table - Desktop */}
      <div className={`${cardClass} hidden overflow-hidden md:block`}>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-[#f8f9fc]">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.16em] text-[#7b8497]">
                  {t('pages.myUsers.list.user')}
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.16em] text-[#7b8497]">
                  {t('pages.myUsers.list.status')}
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.16em] text-[#7b8497]">
                  {t('pages.myUsers.list.assignedDate')}
                </th>
                <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-[0.16em] text-[#7b8497]">
                  {t('pages.myUsers.list.actions')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#edf0f5] bg-white">
              {paginatedUsers.map((user) => {
                const name = getDisplayName(user)
                const email = getDisplayEmail(user)
                const avatar = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
                const assignedDate = getDisplayAssignedDate(user)
                const accountStatus = (user?.status || '').toString().toLowerCase()
                const userId = Array.isArray(user?.userId) ? user.userId[0] : user?.userId
                return (
                  <tr
                    key={userId || user?.id}
                    className="cursor-pointer transition hover:bg-[#fafbfd]"
                    onClick={() => handleSelectClient(user)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[linear-gradient(135deg,#7a56df,#a35bff)] text-white shadow-md">
                            <span className="text-sm font-semibold">{avatar}</span>
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-[#1b2232]">{name}</div>
                          <div className="text-sm text-[#7b8497]">{email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(accountStatus)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-[#55657d]">
                      {assignedDate}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end space-x-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleUnassignUser(userId)
                          }}
                          className="rounded-full p-2 text-[#8f98ab] transition hover:bg-[#f8f9fc] hover:text-rose-600"
                          title={t('pages.myUsers.unassign')}
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
        <div className="hidden flex-wrap items-center gap-4 border-t border-[#edf0f5] px-4 py-4 md:flex md:gap-6 sm:px-6">
          <div className="flex items-center gap-3">
            <label className="text-sm text-[#607089]">{t('pages.myUsers.pagination.perPage')}:</label>
            <select
              value={usersPerPage}
              onChange={(e) => {
                setUsersPerPage(Number(e.target.value))
                setCurrentPage(1)
              }}
              className="rounded-md border border-[#dfe3ec] bg-white px-3 py-1 text-sm"
            >
              <option value="5">5</option>
              <option value="15">15</option>
              <option value="25">25</option>
            </select>
          </div>

          <div className="flex flex-col text-sm text-[#607089] md:flex-row md:items-center md:gap-3">
            <span className="font-medium">{t('pages.myUsers.pagination.pageOf', { current: currentPage, total: totalPages })}</span>
            <span className="text-[#7b8497]">
              {filteredUsers.length === 0
                ? t('pages.myUsers.pagination.showingZero')
                : t('pages.myUsers.pagination.showingRangeResults', {
                    start: ((currentPage - 1) * usersPerPage) + 1,
                    end: Math.min(currentPage * usersPerPage, filteredUsers.length),
                    total: filteredUsers.length
                  })}
            </span>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="rounded-md border border-[#dfe3ec] bg-white px-3 py-2 text-sm font-medium text-[#1b2232] hover:bg-[#fafbfd] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t('common.Previous')}
            </button>

            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage >= totalPages}
              className="rounded-md border border-[#dfe3ec] bg-white px-3 py-2 text-sm font-medium text-[#1b2232] hover:bg-[#fafbfd] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t('common.Next')}
            </button>
          </div>
        </div>
      </div>

      {/* Assign User Modal */}
      {isAssignModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-800/55 px-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl overflow-hidden rounded-[24px] bg-[#f4f5f7] shadow-[0_30px_80px_rgba(15,23,42,0.28)]">
            <div className="flex items-center justify-between border-b border-[#d9dce3] px-8 py-6">
              <h3 className="text-[2rem] font-semibold tracking-[-0.03em] text-[#1a2233]">
                {t('pages.myUsers.actions.assignUser')}
              </h3>
              <button
                className="text-[#99a0af] transition hover:text-[#677084] cursor-pointer"
                onClick={() => {
                  setIsAssignModalOpen(false)
                  setAssignError(null)
                  setAssignUserId('')
                }}
              >
                <XMarkIcon className="h-7 w-7" />
              </button>
            </div>

            <form onSubmit={handleAssignUser} className="px-8 py-7">
              <div className="space-y-7">
                <div className="space-y-3">
                  <label className="block text-[1.4rem] font-semibold text-[#394255]">
                    {t('pages.myUsers.form.userIdLabel')}
                  </label>
                  <div className="relative">
                    <FingerPrintIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#a0a8b8]" />
                    <input
                      type="text"
                      value={assignUserId}
                      onChange={(e) => setAssignUserId(e.target.value)}
                      className="w-full rounded-2xl border border-[#d7dce7] bg-[#f8faff] py-4 pl-12 pr-4 text-lg text-[#1a2233] outline-none transition placeholder:text-[#9aa3b5] focus:border-[#7a56df] focus:ring-2 focus:ring-[#7a56df]/15"
                      placeholder={t('pages.myUsers.form.userIdPlaceholder')}
                      required
                    />
                  </div>
                  <p className="text-base italic text-[#7e8798]">
                    {t('pages.myUsers.form.help')}
                  </p>
                </div>

                {assignError && (
                  <div className="rounded-2xl border border-[#f0c7c7] bg-[#fff2f2] px-4 py-3">
                    <p className="text-sm text-[#be4f4f]">{assignError}</p>
                  </div>
                )}

                <div className="rounded-2xl border border-[#dfd8f2] bg-[#f3effd] px-5 py-4">
                  <div className="flex gap-4">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#d7ccfb] text-[#7a56df]">
                      <InformationCircleIcon className="h-7 w-7" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[1.3rem] font-semibold text-[#2c3550]">
                        {t('pages.myUsers.form.quickTipTitle')}
                      </p>
                      <p className="mt-1 text-lg leading-7 text-[#5f6980]">
                        {t('pages.myUsers.form.quickTipBody')}
                      </p>
                      <p className="mt-2 text-base leading-6 text-[#7a8397]">
                        {t('pages.myUsers.form.quickTipUserIdLocation')}
                      </p>
                      <div className="mt-4 flex flex-wrap gap-3">
                        <a
                          href="https://apps.apple.com/app/id6736826072"
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 rounded-xl border border-[#d6dced] bg-white px-4 py-2 text-sm font-medium text-[#2c3550] transition hover:border-[#7a56df] hover:text-[#7a56df]"
                        >
                          <span>{t('pages.myUsers.form.iosLink')}</span>
                          <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                        </a>
                        <a
                          href="https://play.google.com/store/apps/details?id=com.lucsoft.foodsync"
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 rounded-xl border border-[#d6dced] bg-white px-4 py-2 text-sm font-medium text-[#2c3550] transition hover:border-[#7a56df] hover:text-[#7a56df]"
                        >
                          <span>{t('pages.myUsers.form.androidLink')}</span>
                          <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-8 flex justify-end border-t border-[#dde1e8] pt-6">
                <button
                  type="submit"
                  className="inline-flex items-center gap-3 rounded-2xl bg-[#7a56df] px-6 py-4 text-lg font-semibold text-white shadow-[0_14px_30px_rgba(122,86,223,0.35)] transition hover:bg-[#6947ca] disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={assigning}
                >
                  <CheckCircleIcon className="h-5 w-5" />
                  {assigning
                    ? t('pages.myUsers.actions.assigning')
                    : t('pages.myUsers.actions.assignUser')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default MyUsers
