import { useEffect, useMemo, useState } from 'react'
import { useSelector } from 'react-redux'
import {
  getUserNotes,
  addUserNote,
  updateUserNote,
  deleteUserNote
} from '../services/loggedinApi'
import { selectUserData } from '../store/userSlice'
import {
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  DocumentTextIcon,
  ArrowPathIcon,
  XMarkIcon,
  CheckIcon
} from '@heroicons/react/24/outline'

const formatDate = (d) => {
  if (!d) return ''
  try {
    const date = typeof d === 'string' ? new Date(d) : d
    return date.toLocaleString()
  } catch {
    return d
  }
}

const normalizeDate = (n) => {
  // Try common keys returned by APIs
  return (
    n?.datetimeupdated ||
    n?.datetimeUpdated ||
    n?.updatedAt ||
    n?.updated_at ||
    n?.createdAt ||
    n?.created_at ||
    n?.datetimecreated ||
    n?.datetimeCreated ||
    null
  )
}

const getId = (n) => n?.noteId || n?.id || n?._id || null

export default function UserNotes() {
  const userData = useSelector(selectUserData)
  const userId = userData?.userId
  const [notes, setNotes] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [editing, setEditing] = useState(null) // { id, text }
  const [draft, setDraft] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const sortedNotes = useMemo(() => {
    const copy = [...notes]
    copy.sort((a, b) => {
      const da = new Date(normalizeDate(a) || 0).getTime()
      const db = new Date(normalizeDate(b) || 0).getTime()
      return db - da
    })
    return copy
  }, [notes])

  const loadNotes = async () => {
    if (!userId) return
    setLoading(true)
    setError(null)
    try {
      const res = await getUserNotes({ userId })
      // Accept a few common shapes
      const list = res?.data || res?.notes || res?.items || res || []
      setNotes(Array.isArray(list) ? list : [])
    } catch (err) {
      console.error('Failed to load notes', err)
      setError(err?.message || 'Failed to load notes')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadNotes()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  const openNew = () => {
    setEditing({ id: null })
    setDraft('')
  }

  const openEdit = (n) => {
    setEditing({ id: getId(n) })
    setDraft(n?.note || n?.text || '')
  }

  const closeEditor = () => {
    setEditing(null)
    setDraft('')
  }

  const onSubmit = async () => {
    if (!userId) return
    const text = draft?.trim()
    if (!text) return
    setSubmitting(true)
    setError(null)
    try {
      if (editing?.id) {
        await updateUserNote({ userId, noteId: editing.id, note: text })
      } else {
        await addUserNote({ userId, note: text })
      }
      closeEditor()
      await loadNotes()
    } catch (err) {
      console.error('Failed to save note', err)
      setError(err?.message || 'Failed to save note')
    } finally {
      setSubmitting(false)
    }
  }

  const onDelete = async (note) => {
    const id = getId(note)
    if (!id || !userId) return
    if (!confirm('Delete this note?')) return
    setSubmitting(true)
    setError(null)
    try {
      await deleteUserNote({ userId, noteId: id })
      await loadNotes()
    } catch (err) {
      console.error('Failed to delete note', err)
      setError(err?.message || 'Failed to delete note')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-4 md:mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">User Notes</h1>
        <p className="mt-1 md:mt-2 text-sm md:text-base text-gray-600">Create, update, and organize your private notes.</p>
      </div>

      <div className="relative overflow-hidden rounded-2xl md:rounded-3xl backdrop-blur-xl bg-gradient-to-br from-white/80 to-white/50 border border-white/20 shadow-2xl">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 pointer-events-none"></div>
        <div className="relative p-4 md:p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-0 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 md:w-11 md:h-11 rounded-xl md:rounded-2xl bg-gradient-to-br from-blue-100 to-blue-50 flex items-center justify-center shadow-md">
                <DocumentTextIcon className="w-5 h-5 md:w-6 md:h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Notes</p>
                <p className="text-xs text-gray-500">Sorted by last update</p>
              </div>
            </div>
            <div className="w-full md:w-auto flex flex-col md:flex-row items-stretch md:items-center gap-2">
              <button
                onClick={loadNotes}
                className="w-full md:w-auto px-3 py-2 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 flex items-center justify-center gap-2 text-sm"
                title="Refresh"
              >
                <ArrowPathIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              <button
                onClick={openNew}
                className="w-full md:w-auto px-3 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 text-white flex items-center justify-center gap-2 text-sm shadow-md hover:shadow-lg"
              >
                <PlusIcon className="w-4 h-4" />
                New Note
              </button>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-xl border border-red-200 bg-red-50/70 text-red-700 text-sm">
              {error}
            </div>
          )}

          {loading ? (
            <div className="py-10 md:py-12 text-center text-gray-500 text-sm md:text-base">Loading notes…</div>
          ) : sortedNotes.length === 0 ? (
            <div className="py-10 md:py-12 text-center text-gray-500 text-sm md:text-base">No notes yet. Create your first note.</div>
          ) : (
            <ul className="space-y-3">
              {sortedNotes.map((n) => {
                const id = getId(n)
                const dateStr = formatDate(normalizeDate(n))
                const text = n?.note || n?.text || ''
                return (
                  <li
                    key={id || text + dateStr}
                    className="group relative overflow-hidden rounded-xl md:rounded-2xl bg-gradient-to-br from-blue-50/50 to-blue-100/30 backdrop-blur-sm border border-blue-200/30 p-4 md:p-5 hover:shadow-lg transition-all duration-300"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-sm md:text-base text-gray-900 whitespace-pre-wrap break-words">{text}</p>
                        {dateStr && (
                          <p className="mt-2 text-xs text-gray-500">Updated: {dateStr}</p>
                        )}
                      </div>
                      <div className="flex-shrink-0 flex items-center gap-2 opacity-90">
                        <button
                          onClick={() => openEdit(n)}
                          className="p-2 rounded-lg bg-white/70 hover:bg-white border border-gray-200 text-gray-700 hover:text-gray-900 shadow-sm"
                          title="Edit"
                        >
                          <PencilSquareIcon className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => onDelete(n)}
                          className="p-2 rounded-lg bg-white/70 hover:bg-white border border-red-200 text-red-600 hover:text-red-700 shadow-sm"
                          title="Delete"
                        >
                          <TrashIcon className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Floating action button for mobile */}
      {!editing && (
        <button
          aria-label="New note"
          onClick={openNew}
          className="md:hidden fixed bottom-16 right-4 z-40 inline-flex items-center justify-center w-12 h-12 rounded-full shadow-lg bg-gradient-to-r from-blue-600 to-blue-700 text-white"
        >
          <PlusIcon className="w-5 h-5" />
        </button>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30" onClick={closeEditor} />
          <div className="relative w-full max-w-lg mx-4 md:mx-0 overflow-hidden rounded-2xl backdrop-blur-xl bg-gradient-to-br from-white/90 to-white/70 border border-white/20 shadow-2xl">
            <div className="p-4 md:p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <DocumentTextIcon className="w-5 h-5 text-blue-600" />
                  {editing.id ? 'Edit Note' : 'New Note'}
                </h2>
                <button onClick={closeEditor} className="p-2 rounded-lg hover:bg-gray-100">
                  <XMarkIcon className="w-5 h-5 text-gray-600" />
                </button>
              </div>
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={6}
                placeholder="Write your note…"
                className="w-full px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white/80 text-sm md:text-base"
              />
              <div className="mt-4 flex flex-col-reverse md:flex-row md:items-center md:justify-end gap-2">
                <button
                  onClick={closeEditor}
                  disabled={submitting}
                  className="px-4 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-700"
                >
                  Cancel
                </button>
                <button
                  onClick={onSubmit}
                  disabled={submitting || !draft.trim()}
                  className="px-4 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 text-white flex items-center gap-2 disabled:opacity-60"
                >
                  <CheckIcon className="w-4 h-4" />
                  {submitting ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
