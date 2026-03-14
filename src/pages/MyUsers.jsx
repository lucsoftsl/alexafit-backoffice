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
  ArrowTopRightOnSquareIcon,
  ChevronDownIcon
} from '@heroicons/react/24/outline'
import {
  getNutritionistClients,
  assignClientToNutritionist,
  createClientAndAssignToNutritionist,
  unassignClientFromNutritionist
} from '../services/loggedinApi'
import { useAuth } from '../contexts/AuthContext'
import { selectUserData } from '../store/userSlice'
import {
  COUNTRY_OPTIONS,
  GOAL_OPTIONS,
  ACTIVITY_OPTIONS,
  GENDER_OPTIONS,
  FEMININ_OPTIONS,
  MEASUREMENT_SYSTEM_OPTIONS,
  createDefaultUserProfileForm,
  buildUserDataFromProfileForm,
  isPasswordValid
} from '../utils/userOnboardingProfile'

const MyUsers = ({ onSelectClient = () => {} }) => {
  const cardClass =
    'rounded-[24px] border border-[#e7eaf1] bg-white shadow-[0_10px_30px_rgba(15,23,42,0.05)]'
  const statCardClass =
    'rounded-[20px] border border-[#e7def8] bg-[#f7f2ff] p-4 md:p-5'

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
  const [isCreateUserModalOpen, setIsCreateUserModalOpen] = useState(false)
  const [creatingUser, setCreatingUser] = useState(false)
  const [createUserError, setCreateUserError] = useState(null)
  const [isCountryDropdownOpen, setIsCountryDropdownOpen] = useState(false)
  const [countrySearchTerm, setCountrySearchTerm] = useState('')
  const countryDropdownRef = useRef(null)

  const getDefaultCreateUserForm = () => ({
    fullName: '',
    email: '',
    password: '',
    ...createDefaultUserProfileForm({
      selectedGoalType: 'LOSE_WEIGHT',
      selectedActivityType: 'LIGHTLY_ACTIVE',
      selectedGender: 'MALE'
    })
  })

  const [createUserForm, setCreateUserForm] = useState(getDefaultCreateUserForm)

  const sortedCountryOptions = useMemo(
    () =>
      [...COUNTRY_OPTIONS].sort((a, b) =>
        t(a.labelKey).localeCompare(t(b.labelKey))
      ),
    [t]
  )

  const filteredCountryOptions = useMemo(() => {
    const term = countrySearchTerm.trim().toLowerCase()
    if (!term) return sortedCountryOptions

    return sortedCountryOptions.filter(country => {
      return (
        t(country.labelKey).toLowerCase().includes(term) ||
        country.code.toLowerCase().includes(term)
      )
    })
  }, [countrySearchTerm, sortedCountryOptions, t])

  const selectedCountry = useMemo(
    () =>
      sortedCountryOptions.find(
        country => country.code === createUserForm.countryCode
      ) || null,
    [sortedCountryOptions, createUserForm.countryCode]
  )

  useEffect(() => {
    if (!isCountryDropdownOpen) {
      return undefined
    }

    const handlePointerDownOutside = event => {
      if (countryDropdownRef.current?.contains(event.target)) {
        return
      }

      setIsCountryDropdownOpen(false)
    }

    document.addEventListener('mousedown', handlePointerDownOutside)
    document.addEventListener('touchstart', handlePointerDownOutside)

    return () => {
      document.removeEventListener('mousedown', handlePointerDownOutside)
      document.removeEventListener('touchstart', handlePointerDownOutside)
    }
  }, [isCountryDropdownOpen])

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
        userId:
          Array.isArray(item.user?.userId) && item.user.userId.length > 0
            ? item.user.userId[0]
            : item.user?.userId
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
          userId:
            Array.isArray(item.user?.userId) && item.user.userId.length > 0
              ? item.user.userId[0]
              : item.user?.userId
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
      const name =
        user?.userData?.name ||
        user?.loginDetails?.displayName ||
        `${user?.firstName || ''} ${user?.lastName || ''}`.trim() ||
        t('pages.myUsers.list.unknown')
      const email = user?.loginDetails?.email || user?.email || ''
      const matchesSearch =
        name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        email.toLowerCase().includes(searchTerm.toLowerCase())
      const accountStatus = (user?.status || '').toString().toLowerCase()
      const matchesFilter =
        filterStatus === 'all' || accountStatus === filterStatus
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

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredUsers.length / usersPerPage)),
    [filteredUsers.length, usersPerPage]
  )

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
    user?.loginDetails?.email ||
    user?.email ||
    t('pages.myUsers.list.notAvailable')

  const getDisplayAssignedDate = user =>
    user?.dateTimeAssigned
      ? new Date(user.dateTimeAssigned).toLocaleDateString()
      : t('pages.myUsers.list.notAvailable')

  const getStatusBadge = status => {
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
    const label =
      statusLabels[normalized] ||
      (normalized
        ? normalized.charAt(0).toUpperCase() + normalized.slice(1)
        : t('pages.myUsers.list.unknown'))
    return (
      <span
        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${style}`}
      >
        {label}
      </span>
    )
  }

  // Stats for header
  const stats = useMemo(() => {
    const total = users.length
    const active = users.filter(
      u => (u?.status || '').toString().toLowerCase() === 'active'
    ).length
    const inactive = users.filter(
      u => (u?.status || '').toString().toLowerCase() === 'inactive'
    ).length
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
    const recentAssigned = users.filter(u => {
      const d = u?.dateTimeAssigned ? new Date(u.dateTimeAssigned).getTime() : 0
      return d >= sevenDaysAgo
    }).length
    return { total, active, inactive, recentAssigned }
  }, [users])

  const handleAssignUser = async e => {
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
        throw new Error(
          response?.error || t('pages.myUsers.errors.assignFailed')
        )
      }

      // Reset form and close modal
      setAssignUserId('')
      setIsAssignModalOpen(false)
      // Refresh users list
      await refreshUsers()
    } catch (err) {
      setAssignError(
        err?.message || t('pages.myUsers.errors.assignFailedRetry')
      )
      console.error('Error assigning user:', err)
    } finally {
      setAssigning(false)
    }
  }

  const resetCreateUserForm = () => {
    setCreateUserForm(getDefaultCreateUserForm())
    setCountrySearchTerm('')
    setIsCountryDropdownOpen(false)
    setCreateUserError(null)
  }

  const handleCreateUserFormChange = (field, value) => {
    setCreateUserForm(prev => ({
      ...prev,
      [field]: value,
      ...(field === 'selectedHeightMeasurementUnit'
        ? value === 'METRIC'
          ? { selectedHeightFeet: '', selectedHeightInches: '' }
          : { selectedHeightMetric: '' }
        : {}),
      ...(field === 'selectedGender' && value !== 'FEMALE'
        ? { selectedFemininOption: 'NONE' }
        : {})
    }))
  }

  const handleCreateClient = async e => {
    e.preventDefault()
    setCreateUserError(null)

    const nutritionistId = currentUser?.uid || userData?.userId
    if (!nutritionistId) {
      setCreateUserError(t('pages.myUsers.errors.userIdNotFound'))
      return
    }

    if (
      !createUserForm.fullName.trim() ||
      !createUserForm.email.trim() ||
      !createUserForm.password.trim() ||
      !createUserForm.selectedBirthDate ||
      (!createUserForm.selectedHeightMetric &&
        !createUserForm.selectedHeightFeet) ||
      !createUserForm.selectedWeight ||
      !createUserForm.selectedTargetWeight
    ) {
      setCreateUserError(t('pages.myUsers.createClient.errors.requiredFields'))
      return
    }

    if (!isPasswordValid(createUserForm.password)) {
      setCreateUserError(
        t('pages.myUsers.createClient.errors.passwordRequirements')
      )
      return
    }

    try {
      setCreatingUser(true)
      const payload = {
        nutritionistId,
        fullName: createUserForm.fullName.trim(),
        email: createUserForm.email.trim(),
        password: createUserForm.password,
        selectedDate: new Date().toISOString().split('T')[0],
        userData: buildUserDataFromProfileForm(createUserForm, {
          fullName: createUserForm.fullName.trim()
        })
      }

      const response = await createClientAndAssignToNutritionist(payload)

      if (!response?.ok) {
        throw new Error(
          response?.error || t('pages.myUsers.createClient.errors.failed')
        )
      }

      resetCreateUserForm()
      setIsCreateUserModalOpen(false)
      setIsAssignModalOpen(false)
      await refreshUsers()
    } catch (err) {
      setCreateUserError(
        err?.message || t('pages.myUsers.createClient.errors.failed')
      )
      console.error('Error creating nutritionist client:', err)
    } finally {
      setCreatingUser(false)
    }
  }

  const handleUnassignUser = async userId => {
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
        throw new Error(
          response?.error || t('pages.myUsers.errors.unassignFailed')
        )
      }

      // Refresh users list
      await refreshUsers()
    } catch (err) {
      setError(err?.message || t('pages.myUsers.errors.unassignFailedRetry'))
      console.error('Error unassigning user:', err)
    }
  }

  const handleSelectClient = user => {
    if (onSelectClient) {
      onSelectClient(user)
    }
  }

  const renderSelectField = ({
    value,
    onChange,
    options,
    placeholder
  }) => (
    <div className="relative">
      <select
        value={value}
        onChange={onChange}
        className="w-full appearance-none rounded-2xl border border-[#d7dce7] bg-white px-4 py-3 pr-11 text-base text-[#1a2233] outline-none transition focus:border-[#7a56df] focus:ring-2 focus:ring-[#7a56df]/15"
      >
        {placeholder ? <option value="">{placeholder}</option> : null}
        {options.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDownIcon className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7d8698]" />
    </div>
  )

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
              <h3 className="text-lg font-semibold text-[#1b2232]">
                {t('pages.myUsers.error')}
              </h3>
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
            {loading
              ? t('pages.myUsers.actions.loading')
              : t('pages.myUsers.actions.refresh')}
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
          <p className="text-sm text-[#62718a]">
            {t('pages.myUsers.stats.total')}
          </p>
          <p className="mt-2 text-4xl font-bold tracking-[-0.04em] text-[#7a56df]">
            {stats.total}
          </p>
        </div>
        <div className={statCardClass}>
          <p className="text-sm text-[#62718a]">
            {t('pages.myUsers.stats.active')}
          </p>
          <p className="mt-2 text-4xl font-bold tracking-[-0.04em] text-[#7a56df]">
            {stats.active}
          </p>
        </div>
        <div className={statCardClass}>
          <p className="text-sm text-[#62718a]">
            {t('pages.myUsers.stats.inactive')}
          </p>
          <p className="mt-2 text-4xl font-bold tracking-[-0.04em] text-[#7a56df]">
            {stats.inactive}
          </p>
        </div>
        <div className={statCardClass}>
          <p className="text-sm text-[#62718a]">
            {t('pages.myUsers.stats.assigned')}
          </p>
          <p className="mt-2 text-4xl font-bold tracking-[-0.04em] text-[#7a56df]">
            {stats.recentAssigned}
          </p>
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
                {loading
                  ? t('pages.myUsers.actions.loading')
                  : t('pages.myUsers.actions.refresh')}
              </button>
              <div className="relative w-full md:w-[320px]">
                <MagnifyingGlassIcon className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#a3abb9]" />
                <input
                  type="text"
                  placeholder={t('pages.myUsers.filters.searchPlaceholder')}
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full rounded-2xl border border-[#e3e7ef] bg-[#fafbfd] py-3 pl-11 pr-4 text-sm text-[#1b2232] outline-none transition placeholder:text-[#98a1b3] focus:border-[#7a56df]"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-3 md:hidden">
        {paginatedUsers.map(user => {
          const name = getDisplayName(user)
          const email = getDisplayEmail(user)
          const avatar = name
            .split(' ')
            .map(n => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2)
          const assignedDate = getDisplayAssignedDate(user)
          const accountStatus = (user?.status || '').toString().toLowerCase()
          const userId = Array.isArray(user?.userId)
            ? user.userId[0]
            : user?.userId
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
                    <p className="text-sm font-semibold text-[#1b2232]">
                      {name}
                    </p>
                    <p className="text-xs text-[#7b8497]">{email}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={e => {
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
                  <p className="text-[#7b8497]">
                    {t('pages.myUsers.list.status')}
                  </p>
                  {getStatusBadge(accountStatus)}
                </div>
                <div className="space-y-1">
                  <p className="text-[#7b8497]">
                    {t('pages.myUsers.list.assigned')}
                  </p>
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
              <label className="text-sm text-[#607089]">
                {t('pages.myUsers.pagination.perPage')}
              </label>
              <select
                value={usersPerPage}
                onChange={e => {
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
            <span className="text-xs text-[#7b8497]">
              {t('pages.myUsers.pagination.pageOf', {
                current: currentPage,
                total: totalPages
              })}
            </span>
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
              onClick={() =>
                setCurrentPage(prev => Math.min(totalPages, prev + 1))
              }
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
                  start: (currentPage - 1) * usersPerPage + 1,
                  end: Math.min(
                    currentPage * usersPerPage,
                    filteredUsers.length
                  ),
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
              {paginatedUsers.map(user => {
                const name = getDisplayName(user)
                const email = getDisplayEmail(user)
                const avatar = name
                  .split(' ')
                  .map(n => n[0])
                  .join('')
                  .toUpperCase()
                  .slice(0, 2)
                const assignedDate = getDisplayAssignedDate(user)
                const accountStatus = (user?.status || '')
                  .toString()
                  .toLowerCase()
                const userId = Array.isArray(user?.userId)
                  ? user.userId[0]
                  : user?.userId
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
                            <span className="text-sm font-semibold">
                              {avatar}
                            </span>
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-[#1b2232]">
                            {name}
                          </div>
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
                          onClick={e => {
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
            <label className="text-sm text-[#607089]">
              {t('pages.myUsers.pagination.perPage')}:
            </label>
            <select
              value={usersPerPage}
              onChange={e => {
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
            <span className="font-medium">
              {t('pages.myUsers.pagination.pageOf', {
                current: currentPage,
                total: totalPages
              })}
            </span>
            <span className="text-[#7b8497]">
              {filteredUsers.length === 0
                ? t('pages.myUsers.pagination.showingZero')
                : t('pages.myUsers.pagination.showingRangeResults', {
                    start: (currentPage - 1) * usersPerPage + 1,
                    end: Math.min(
                      currentPage * usersPerPage,
                      filteredUsers.length
                    ),
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
              onClick={() =>
                setCurrentPage(prev => Math.min(totalPages, prev + 1))
              }
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
                  <div ref={countryDropdownRef} className="relative">
                    <FingerPrintIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#a0a8b8]" />
                    <input
                      type="text"
                      value={assignUserId}
                      onChange={e => setAssignUserId(e.target.value)}
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
                <div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      resetCreateUserForm()
                      setIsCreateUserModalOpen(true)
                    }}
                    className="inline-flex items-center justify-center gap-3 rounded-2xl border border-[#d9dce3] bg-white px-6 py-4 text-lg font-semibold text-[#1a2233] transition hover:bg-[#fafbfd]"
                  >
                    <UserPlusIcon className="h-5 w-5" />
                    {t('pages.myUsers.createClient.title')}
                  </button>
                  <button
                    type="submit"
                    className="inline-flex items-center justify-center gap-3 rounded-2xl bg-[#7a56df] px-6 py-4 text-lg font-semibold text-white shadow-[0_14px_30px_rgba(122,86,223,0.35)] transition hover:bg-[#6947ca] disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={assigning}
                  >
                    <CheckCircleIcon className="h-5 w-5" />
                    {assigning
                      ? t('pages.myUsers.actions.assigning')
                      : t('pages.myUsers.actions.assignUser')}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {isCreateUserModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-800/55 px-4 backdrop-blur-sm">
          <div className="w-full max-w-4xl overflow-hidden rounded-[24px] bg-[#f8f9fb] shadow-[0_30px_80px_rgba(15,23,42,0.28)]">
            <div className="flex items-center justify-between border-b border-[#d9dce3] px-8 py-6">
              <div>
                <h3 className="text-[2rem] font-semibold tracking-[-0.03em] text-[#1a2233]">
                  {t('pages.myUsers.createClient.title')}
                </h3>
                <p className="mt-1 text-base text-[#74809a]">
                  {t('pages.myUsers.createClient.subtitle')}
                </p>
              </div>
              <button
                className="cursor-pointer text-[#99a0af] transition hover:text-[#677084]"
                onClick={() => {
                  setIsCreateUserModalOpen(false)
                  resetCreateUserForm()
                }}
              >
                <XMarkIcon className="h-7 w-7" />
              </button>
            </div>

            <form onSubmit={handleCreateClient} className="max-h-[85vh] overflow-y-auto px-8 py-7">
              <div className="space-y-8">
                <div className="border-b border-[#e5e8ef] pb-7">
                  <p className="mb-5 text-sm font-semibold uppercase tracking-[0.14em] text-[#8b5cf6]">
                    {t('pages.myUsers.createClient.sections.personalInformation')}
                  </p>
                  <div className="grid gap-6 lg:grid-cols-2">
                <div className="space-y-3">
                  <label className="block text-sm font-semibold text-[#394255]">
                    {t('pages.myUsers.createClient.fields.fullName')}
                  </label>
                  <input
                    type="text"
                    value={createUserForm.fullName}
                    onChange={e => handleCreateUserFormChange('fullName', e.target.value)}
                    className="w-full rounded-2xl border border-[#d7dce7] bg-white px-4 py-3 text-base text-[#1a2233] outline-none transition focus:border-[#7a56df] focus:ring-2 focus:ring-[#7a56df]/15"
                    placeholder={t('pages.myUsers.createClient.placeholders.fullName')}
                    required
                  />
                </div>
                <div className="space-y-3">
                  <label className="block text-sm font-semibold text-[#394255]">
                    {t('pages.myUsers.createClient.fields.email')}
                  </label>
                  <input
                    type="email"
                    value={createUserForm.email}
                    onChange={e => handleCreateUserFormChange('email', e.target.value)}
                    className="w-full rounded-2xl border border-[#d7dce7] bg-white px-4 py-3 text-base text-[#1a2233] outline-none transition focus:border-[#7a56df] focus:ring-2 focus:ring-[#7a56df]/15"
                    placeholder={t('pages.myUsers.createClient.placeholders.email')}
                    required
                  />
                </div>
                <div className="space-y-3">
                  <label className="block text-sm font-semibold text-[#394255]">
                    {t('pages.myUsers.createClient.fields.password')}
                  </label>
                  <input
                    type="password"
                    value={createUserForm.password}
                    onChange={e => handleCreateUserFormChange('password', e.target.value)}
                    className="w-full rounded-2xl border border-[#d7dce7] bg-white px-4 py-3 text-base text-[#1a2233] outline-none transition focus:border-[#7a56df] focus:ring-2 focus:ring-[#7a56df]/15"
                    placeholder={t('pages.myUsers.createClient.placeholders.password')}
                    required
                  />
                </div>

                <div className="space-y-3">
                  <label className="block text-sm font-semibold text-[#394255]">
                    {t('pages.myUsers.createClient.fields.country')}
                  </label>
                  <div ref={countryDropdownRef} className="relative">
                    <button
                      type="button"
                      onClick={() =>
                        setIsCountryDropdownOpen(prev => !prev)
                      }
                      className="flex w-full items-center justify-between rounded-2xl border border-[#d7dce7] bg-white px-4 py-3 text-left text-base text-[#1a2233] outline-none transition focus:border-[#7a56df] focus:ring-2 focus:ring-[#7a56df]/15"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#7a8397]">
                          {selectedCountry?.flag || createUserForm.countryCode}
                        </div>
                        <div className="truncate text-sm font-semibold text-[#1a2233]">
                          {selectedCountry
                            ? t(selectedCountry.labelKey)
                            :
                            t('pages.myUsers.createClient.placeholders.country')}
                        </div>
                      </div>
                      <ChevronDownIcon className="h-4 w-4 shrink-0 text-[#7d8698]" />
                    </button>

                    {isCountryDropdownOpen && (
                      <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-2xl border border-[#d7dce7] bg-white shadow-[0_20px_45px_rgba(15,23,42,0.12)]">
                        <div className="border-b border-[#edf0f5] p-3">
                          <div className="relative">
                            <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#98a2b3]" />
                            <input
                              type="text"
                              value={countrySearchTerm}
                              onChange={e => setCountrySearchTerm(e.target.value)}
                              placeholder={t(
                                'pages.myUsers.createClient.placeholders.searchCountry'
                              )}
                              className="w-full rounded-xl border border-[#d7dce7] bg-[#fafbfd] py-2.5 pl-9 pr-3 text-sm text-[#1a2233] outline-none transition focus:border-[#7a56df] focus:ring-2 focus:ring-[#7a56df]/15"
                            />
                          </div>
                        </div>
                        <div className="max-h-60 overflow-y-auto p-2">
                          {filteredCountryOptions.length === 0 ? (
                            <div className="px-3 py-2 text-sm text-[#74809a]">
                              {t('pages.myUsers.createClient.noCountryFound')}
                            </div>
                          ) : (
                            filteredCountryOptions.map(country => (
                              <button
                                key={country.code}
                                type="button"
                                onClick={() => {
                                  handleCreateUserFormChange(
                                    'countryCode',
                                    country.code
                                  )
                                  setIsCountryDropdownOpen(false)
                                  setCountrySearchTerm('')
                                }}
                                className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left transition ${
                                  createUserForm.countryCode === country.code
                                    ? 'bg-[#f4efff] text-[#382e66]'
                                    : 'text-[#1a2233] hover:bg-[#f6f8fc]'
                                }`}
                              >
                                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[#7a8397]">
                                  {country.flag}
                                </span>
                                <span className="ml-3 flex-1 text-sm font-medium">
                                  {t(country.labelKey)}
                                </span>
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                  </div>
                </div>

                <div className="border-b border-[#e5e8ef] pb-7">
                  <p className="mb-5 text-sm font-semibold uppercase tracking-[0.14em] text-[#8b5cf6]">
                    {t('pages.myUsers.createClient.sections.demographicsLifestyle')}
                  </p>
                  <div className="grid gap-6 lg:grid-cols-2">
                <div className="space-y-3">
                  <label className="block text-sm font-semibold text-[#394255]">
                    {t('pages.myUsers.createClient.fields.birthDate')}
                  </label>
                  <input
                    type="date"
                    value={createUserForm.selectedBirthDate}
                    onChange={e =>
                      handleCreateUserFormChange('selectedBirthDate', e.target.value)
                    }
                    className="w-full rounded-2xl border border-[#d7dce7] bg-white px-4 py-3 text-base text-[#1a2233] outline-none transition focus:border-[#7a56df] focus:ring-2 focus:ring-[#7a56df]/15"
                    required
                  />
                </div>

                <div className="space-y-3">
                  <label className="block text-sm font-semibold text-[#394255]">
                    {t('pages.myUsers.createClient.fields.sex')}
                  </label>
                  {renderSelectField({
                    value: createUserForm.selectedGender,
                    onChange: e =>
                      handleCreateUserFormChange('selectedGender', e.target.value),
                    options: GENDER_OPTIONS.map(option => ({
                      value: option.value,
                      label: t(`pages.myUsers.createClient.options.sex.${option.value}`)
                    }))
                  })}
                </div>

                <div className="space-y-3">
                  <label className="block text-sm font-semibold text-[#394255]">
                    {t('pages.myUsers.createClient.fields.goal')}
                  </label>
                  {renderSelectField({
                    value: createUserForm.selectedGoalType,
                    onChange: e =>
                      handleCreateUserFormChange('selectedGoalType', e.target.value),
                    options: GOAL_OPTIONS.map(option => ({
                      value: option.value,
                      label: t(`pages.myUsers.createClient.options.goal.${option.value}`)
                    }))
                  })}
                </div>

                <div className="space-y-3">
                  <label className="block text-sm font-semibold text-[#394255]">
                    {t('pages.myUsers.createClient.fields.activity')}
                  </label>
                  {renderSelectField({
                    value: createUserForm.selectedActivityType,
                    onChange: e =>
                      handleCreateUserFormChange(
                        'selectedActivityType',
                        e.target.value
                      ),
                    options: ACTIVITY_OPTIONS.map(option => ({
                      value: option.value,
                      label: t(
                        `pages.myUsers.createClient.options.activity.${option.value}`
                      )
                    }))
                  })}
                </div>

                {createUserForm.selectedGender === 'FEMALE' && (
                  <div className="space-y-3 lg:col-span-2">
                    <label className="block text-sm font-semibold text-[#394255]">
                      {t('pages.myUsers.createClient.fields.femininOption')}
                    </label>
                    {renderSelectField({
                      value: createUserForm.selectedFemininOption,
                      onChange: e =>
                        handleCreateUserFormChange(
                          'selectedFemininOption',
                          e.target.value
                        ),
                      options: FEMININ_OPTIONS.map(option => ({
                        value: option.value,
                        label: t(
                          `pages.myUsers.createClient.options.feminin.${option.value}`
                        )
                      }))
                    })}
                  </div>
                )}
                  </div>
                </div>

                <div>
                  <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#8b5cf6]">
                      {t('pages.myUsers.createClient.sections.physicalMeasurements')}
                    </p>
                    <div className="flex items-center gap-2 text-sm text-[#6b7280]">
                      <span className="font-medium">
                        {t('pages.myUsers.createClient.fields.system')}:
                      </span>
                      <div className="w-[200px]">
                        {renderSelectField({
                          value: createUserForm.selectedHeightMeasurementUnit,
                          onChange: e => {
                            const nextValue = e.target.value
                            handleCreateUserFormChange(
                              'selectedHeightMeasurementUnit',
                              nextValue
                            )
                            handleCreateUserFormChange(
                              'selectedWeightMeasurementUnit',
                              nextValue
                            )
                          },
                          options: MEASUREMENT_SYSTEM_OPTIONS.map(option => ({
                            value: option.value,
                            label: t(
                              `pages.myUsers.createClient.options.measurement.${option.value}`
                            )
                          }))
                        })}
                      </div>
                    </div>
                  </div>
                  <div className="grid gap-6 lg:grid-cols-3">
                <div className="space-y-3">
                  <label className="block text-sm font-semibold text-[#394255]">
                    {t('pages.myUsers.createClient.fields.height')}
                  </label>
                  {createUserForm.selectedHeightMeasurementUnit === 'METRIC' ? (
                    <div className="relative">
                      <input
                        type="number"
                        min="50"
                        step="1"
                        value={createUserForm.selectedHeightMetric}
                        onChange={e =>
                          handleCreateUserFormChange(
                            'selectedHeightMetric',
                            e.target.value
                          )
                        }
                        className="w-full rounded-2xl border border-[#d7dce7] bg-white px-4 py-3 pr-14 text-base text-[#1a2233] outline-none transition focus:border-[#7a56df] focus:ring-2 focus:ring-[#7a56df]/15"
                        placeholder={t(
                          'pages.myUsers.createClient.placeholders.heightMetric'
                        )}
                        required
                      />
                      <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-[#98a2b3]">
                        cm
                      </span>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        type="number"
                        min="3"
                        step="1"
                        value={createUserForm.selectedHeightFeet}
                        onChange={e =>
                          handleCreateUserFormChange(
                            'selectedHeightFeet',
                            e.target.value
                          )
                        }
                        className="w-full rounded-2xl border border-[#d7dce7] bg-white px-4 py-3 text-base text-[#1a2233] outline-none transition focus:border-[#7a56df] focus:ring-2 focus:ring-[#7a56df]/15"
                        placeholder={t(
                          'pages.myUsers.createClient.placeholders.heightFeet'
                        )}
                        required
                      />
                      <input
                        type="number"
                        min="0"
                        max="11"
                        step="1"
                        value={createUserForm.selectedHeightInches}
                        onChange={e =>
                          handleCreateUserFormChange(
                            'selectedHeightInches',
                            e.target.value
                          )
                        }
                        className="w-full rounded-2xl border border-[#d7dce7] bg-white px-4 py-3 text-base text-[#1a2233] outline-none transition focus:border-[#7a56df] focus:ring-2 focus:ring-[#7a56df]/15"
                        placeholder={t(
                          'pages.myUsers.createClient.placeholders.heightInches'
                        )}
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <label className="block text-sm font-semibold text-[#394255]">
                    {t('pages.myUsers.createClient.fields.weight')}
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="20"
                      step="0.1"
                      value={createUserForm.selectedWeight}
                      onChange={e => handleCreateUserFormChange('selectedWeight', e.target.value)}
                      className="w-full rounded-2xl border border-[#d7dce7] bg-white px-4 py-3 pr-14 text-base text-[#1a2233] outline-none transition focus:border-[#7a56df] focus:ring-2 focus:ring-[#7a56df]/15"
                      placeholder={t(
                        createUserForm.selectedWeightMeasurementUnit === 'METRIC'
                          ? 'pages.myUsers.createClient.placeholders.weightMetric'
                          : 'pages.myUsers.createClient.placeholders.weightImperial'
                      )}
                      required
                    />
                    <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-[#98a2b3]">
                      {createUserForm.selectedWeightMeasurementUnit === 'METRIC'
                        ? 'kg'
                        : 'lbs'}
                    </span>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="block text-sm font-semibold text-[#394255]">
                    {t('pages.myUsers.createClient.fields.objectiveWeight')}
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="20"
                      step="0.1"
                      value={createUserForm.selectedTargetWeight}
                      onChange={e =>
                        handleCreateUserFormChange('selectedTargetWeight', e.target.value)
                      }
                      className="w-full rounded-2xl border border-[#d7dce7] bg-white px-4 py-3 pr-14 text-base text-[#1a2233] outline-none transition focus:border-[#7a56df] focus:ring-2 focus:ring-[#7a56df]/15"
                      placeholder={t(
                        createUserForm.selectedWeightMeasurementUnit === 'METRIC'
                          ? 'pages.myUsers.createClient.placeholders.objectiveWeightMetric'
                          : 'pages.myUsers.createClient.placeholders.objectiveWeightImperial'
                      )}
                      required
                    />
                    <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-[#98a2b3]">
                      {createUserForm.selectedWeightMeasurementUnit === 'METRIC'
                        ? 'kg'
                        : 'lbs'}
                    </span>
                  </div>
                </div>
                  </div>
                </div>
              </div>

              {createUserError && (
                <div className="mt-6 rounded-2xl border border-[#f0c7c7] bg-[#fff2f2] px-4 py-3">
                  <p className="text-sm text-[#be4f4f]">{createUserError}</p>
                </div>
              )}

              <div className="mt-8 flex justify-end border-t border-[#dde1e8] pt-6">
                <div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreateUserModalOpen(false)
                      resetCreateUserForm()
                    }}
                    className="inline-flex items-center justify-center rounded-2xl border border-[#d9dce3] bg-white px-6 py-4 text-lg font-semibold text-[#1a2233] transition hover:bg-[#fafbfd]"
                    disabled={creatingUser}
                  >
                    {t('common.cancel') || 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    className="inline-flex items-center justify-center gap-3 rounded-2xl bg-[#7a56df] px-6 py-4 text-lg font-semibold text-white shadow-[0_14px_30px_rgba(122,86,223,0.35)] transition hover:bg-[#6947ca] disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={creatingUser}
                  >
                    <UserPlusIcon className="h-5 w-5" />
                    {creatingUser
                      ? t('pages.myUsers.createClient.actions.creating')
                      : t('pages.myUsers.createClient.actions.createAndAssign')}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default MyUsers
