import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ArrowPathIcon,
  ExclamationTriangleIcon,
  MagnifyingGlassIcon,
  TrashIcon,
  ArrowUturnLeftIcon
} from '@heroicons/react/24/outline'
import { getPendingDeletionUsers, hardDeleteUser, restoreUser, formatUserData } from '../services/api'

const formatShortDate = value => {
  if (!value) return 'N/A'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'N/A' : date.toLocaleDateString()
}

const getDisplayName = user => {
  const ud = user?.userData || {}
  const ld = user?.loginDetails || {}
  if (ud.name) return ud.name
  if (ud.displayName) return ud.displayName
  if (ld.displayName) return ld.displayName
  const providerName = ld.providerData?.find(p => p?.displayName)?.displayName
  if (providerName) return providerName
  const email = ld.providerData?.[0]?.email || ld.email
  if (email && !email.includes('privaterelay.appleid.com')) return email
  return 'Unknown'
}

const getUserEmail = user => {
  const ld = user?.loginDetails || {}
  return ld.providerData?.[0]?.email || ld.email || 'N/A'
}

const getInitials = name =>
  name.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2)

const DeletedUsers = () => {
  const { t } = useTranslation()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [actionLoadingId, setActionLoadingId] = useState(null)
  const hasLoadedRef = useRef(false)

  const load = async (force = false) => {
    setLoading(true)
    setError(null)
    try {
      const data = await getPendingDeletionUsers()
      setUsers(Array.isArray(data?.data) ? data.data : [])
    } catch (err) {
      setError(err.message || 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (hasLoadedRef.current) return
    hasLoadedRef.current = true
    load()
  }, [])

  const handleRestore = async user => {
    if (!window.confirm(`Restore ${getDisplayName(user)}? This will set their account back to ACTIVE.`)) return
    setActionLoadingId(user.userId)
    try {
      await restoreUser({ userId: user.userId })
      setUsers(prev => prev.filter(u => u.userId !== user.userId))
    } catch (err) {
      alert(`Failed to restore user: ${err.message}`)
    } finally {
      setActionLoadingId(null)
    }
  }

  const handleDelete = async user => {
    const name = getDisplayName(user)
    if (!window.confirm(`Permanently delete ${name}? This will remove all their data and cannot be undone.`)) return
    if (!window.confirm(`Second confirmation: permanently delete ${name} and all associated data?`)) return
    setActionLoadingId(user.userId)
    try {
      await hardDeleteUser({ userId: user.userId })
      setUsers(prev => prev.filter(u => u.userId !== user.userId))
    } catch (err) {
      alert(`Failed to delete user: ${err.message}`)
    } finally {
      setActionLoadingId(null)
    }
  }

  const filtered = users.filter(u => {
    const name = getDisplayName(u).toLowerCase()
    const email = getUserEmail(u).toLowerCase()
    const q = search.toLowerCase()
    return name.includes(q) || email.includes(q) || (u.userId || '').toLowerCase().includes(q)
  })

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Deleted Users</h1>
          <p className="mt-2 text-gray-600">Users pending permanent deletion</p>
        </div>
        <div className="flex h-64 items-center justify-center">
          <div className="text-center">
            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-red-600" />
            <p className="mt-4 text-gray-600">Loading…</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-gray-900">Deleted Users</h1>
        <div className="card p-6">
          <div className="flex items-center">
            <ExclamationTriangleIcon className="mr-4 h-8 w-8 text-red-600" />
            <div>
              <h3 className="text-lg font-medium text-gray-900">Failed to load</h3>
              <p className="mt-1 text-gray-600">{error}</p>
              <button onClick={() => load(true)} className="btn-primary mt-4">Try again</button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Deleted Users</h1>
          <p className="mt-1 text-sm text-gray-600">
            {filtered.length} user{filtered.length !== 1 ? 's' : ''} pending permanent deletion
          </p>
        </div>
        <button onClick={() => load(true)} disabled={loading} className="btn-secondary flex items-center gap-2">
          <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="card p-4">
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, email or user ID…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input pl-10"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <TrashIcon className="mx-auto h-12 w-12 text-gray-300" />
          <p className="mt-4 text-gray-500">No users pending deletion{search ? ' matching your search' : ''}.</p>
        </div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {filtered.map(user => {
              const name = getDisplayName(user)
              const email = getUserEmail(user)
              const isLoading = actionLoadingId === user.userId
              return (
                <div key={user.userId} className="card p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-red-700 text-sm font-semibold">
                        {getInitials(name)}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{name}</p>
                        <p className="text-xs text-gray-500">{email}</p>
                        <p className="text-xs text-gray-400 mt-0.5">Deleted: {formatShortDate(user.dateTimeUpdated)}</p>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => handleRestore(user)}
                      disabled={isLoading}
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-green-300 bg-green-50 px-3 py-2 text-sm font-medium text-green-700 hover:bg-green-100 disabled:opacity-50"
                    >
                      <ArrowUturnLeftIcon className="h-4 w-4" />
                      Restore
                    </button>
                    <button
                      onClick={() => handleDelete(user)}
                      disabled={isLoading}
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
                    >
                      <TrashIcon className="h-4 w-4" />
                      Delete permanently
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Desktop table */}
          <div className="card hidden overflow-x-auto md:block">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">User</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">User ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Joined</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Deletion requested</th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {filtered.map(user => {
                  const name = getDisplayName(user)
                  const email = getUserEmail(user)
                  const isLoading = actionLoadingId === user.userId
                  return (
                    <tr key={user.userId} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-100 text-sm font-semibold text-red-700">
                            {getInitials(name)}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">{name}</p>
                            <p className="text-sm text-gray-500">{email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-xs text-gray-400 font-mono">{user.userId}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{formatShortDate(user.dateTimeCreated)}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{formatShortDate(user.dateTimeUpdated)}</td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleRestore(user)}
                            disabled={isLoading}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-green-300 bg-green-50 px-3 py-1.5 text-sm font-medium text-green-700 hover:bg-green-100 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isLoading ? (
                              <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-green-700" />
                            ) : (
                              <ArrowUturnLeftIcon className="h-4 w-4" />
                            )}
                            Restore
                          </button>
                          <button
                            onClick={() => handleDelete(user)}
                            disabled={isLoading}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isLoading ? (
                              <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-red-700" />
                            ) : (
                              <TrashIcon className="h-4 w-4" />
                            )}
                            Delete permanently
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

export default DeletedUsers
