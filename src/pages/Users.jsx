/* eslint-disable max-len */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import {
  MagnifyingGlassIcon,
  EyeIcon,
  ExclamationTriangleIcon,
  ArrowsUpDownIcon,
  EnvelopeIcon,
  ChartBarIcon,
  ChatBubbleLeftRightIcon,
  ShieldCheckIcon
} from '@heroicons/react/24/outline'
import {
  getUsers,
  getUserRewardsSummary,
  getUserPurchaseRequests,
  updateUserPurchaseStatus,
  formatUserData,
  formatSubscriptionStatus,
  setUserSubscriptionWhitelistDetails
} from '../services/api'
import { getUsersCaloriesActivity, sendReminderEmail, getUserCaloriesHistory } from '../services/loggedinApi'
import UserDetailModal from '../components/UserDetailModal'
import ControlsDropdown from '../components/ControlsDropdown'
import WhitelistModal from '../components/WhitelistModal'
import CreateLeadModal from '../components/CreateLeadModal'
import { selectIsAdmin } from '../store/userSlice'

const USERS_CACHE_KEY = 'users'
const USER_REWARDS_CACHE_KEY = 'userRewardsSummary'
const ACTIVITY_CACHE_KEY = 'users_calories_activity'

const REMINDER_TRANSLATIONS = {
  en: {
    miss_you: {
      label: 'We miss you',
      subject: n => `We miss you on Alexa Fit, ${n}!`,
      h1: n => `We miss you, ${n}! 👋`,
      p1: `It's been a while since you've logged your meals on <strong>Alexa Fit</strong>. Your health journey is important and we're here to support you every step of the way.`,
      p2: `Jump back in and start logging again – even small steps lead to big results!`
    },
    keep_going: {
      label: 'Keep going',
      subject: n => `Keep up the great work, ${n}!`,
      h1: n => `You're doing great, ${n}! 💪`,
      p1: `You've been making progress on <strong>Alexa Fit</strong>! Don't let a few missed days slow you down – consistency is what makes the difference.`,
      p2: `Open the app today and log your meals to keep your streak alive!`
    },
    nudge: {
      label: 'Gentle nudge',
      subject: n => `Quick check-in from Alexa Fit, ${n}`,
      h1: n => `Just checking in, ${n} 🌟`,
      p1: `We noticed you haven't logged your meals recently on <strong>Alexa Fit</strong>. Tracking your nutrition is one of the most powerful things you can do for your health.`,
      p2: `It only takes a moment – open the app and log your next meal!`
    }
  },
  fr: {
    miss_you: {
      label: 'Vous nous manquez',
      subject: n => `Vous nous manquez sur Alexa Fit, ${n} !`,
      h1: n => `Vous nous manquez, ${n} ! 👋`,
      p1: `Cela fait un moment que vous n'avez pas enregistré vos repas sur <strong>Alexa Fit</strong>. Votre parcours santé est important et nous sommes là pour vous soutenir à chaque étape.`,
      p2: `Revenez et recommencez à enregistrer – même les petits pas mènent à de grands résultats !`
    },
    keep_going: {
      label: 'Continuez ainsi',
      subject: n => `Continuez comme ça, ${n} !`,
      h1: n => `Vous faites du bon travail, ${n} ! 💪`,
      p1: `Vous progressez sur <strong>Alexa Fit</strong> ! Ne laissez pas quelques jours manqués vous ralentir – la régularité fait la différence.`,
      p2: `Ouvrez l'application aujourd'hui et enregistrez vos repas pour maintenir votre élan !`
    },
    nudge: {
      label: 'Petit rappel',
      subject: n => `Un petit coucou d'Alexa Fit, ${n}`,
      h1: n => `Juste un coucou, ${n} 🌟`,
      p1: `Nous avons remarqué que vous n'avez pas récemment enregistré vos repas sur <strong>Alexa Fit</strong>. Suivre votre nutrition est l'une des choses les plus puissantes pour votre santé.`,
      p2: `Ça ne prend qu'un instant – ouvrez l'appli et enregistrez votre prochain repas !`
    }
  },
  es: {
    miss_you: {
      label: 'Te echamos de menos',
      subject: n => `¡Te echamos de menos en Alexa Fit, ${n}!`,
      h1: n => `¡Te echamos de menos, ${n}! 👋`,
      p1: `Ha pasado un tiempo desde que registraste tus comidas en <strong>Alexa Fit</strong>. Tu camino hacia la salud es importante y estamos aquí para apoyarte en cada paso.`,
      p2: `¡Vuelve y empieza a registrar de nuevo – incluso los pequeños pasos llevan a grandes resultados!`
    },
    keep_going: {
      label: 'Sigue adelante',
      subject: n => `¡Sigue con el buen trabajo, ${n}!`,
      h1: n => `¡Lo estás haciendo genial, ${n}! 💪`,
      p1: `¡Estás progresando en <strong>Alexa Fit</strong>! No dejes que unos pocos días perdidos te frenen – la constancia es lo que marca la diferencia.`,
      p2: `¡Abre la app hoy y registra tus comidas para mantener tu racha!`
    },
    nudge: {
      label: 'Recordatorio amable',
      subject: n => `Un rápido saludo de Alexa Fit, ${n}`,
      h1: n => `Solo pasando a saludar, ${n} 🌟`,
      p1: `Notamos que no has registrado tus comidas recientemente en <strong>Alexa Fit</strong>. Hacer un seguimiento de tu nutrición es una de las cosas más poderosas para tu salud.`,
      p2: `Solo toma un momento – ¡abre la app y registra tu próxima comida!`
    }
  },
  ro: {
    miss_you: {
      label: 'Ne ești dor',
      subject: n => `Ne ești dor pe Alexa Fit, ${n}!`,
      h1: n => `Ne ești dor, ${n}! 👋`,
      p1: `A trecut ceva timp de când nu ți-ai înregistrat mesele în <strong>Alexa Fit</strong>. Călătoria ta spre sănătate este importantă și suntem aici să te sprijinim la fiecare pas.`,
      p2: `Revino și începe din nou să înregistrezi – chiar și pașii mici duc la rezultate mari!`
    },
    keep_going: {
      label: 'Continuă tot așa',
      subject: n => `Continuă tot așa, ${n}!`,
      h1: n => `Te descurci excelent, ${n}! 💪`,
      p1: `Faci progrese pe <strong>Alexa Fit</strong>! Nu lăsa câteva zile ratate să te oprească – consecvența face diferența.`,
      p2: `Deschide aplicația astăzi și înregistrează-ți mesele pentru a-ți menține seria!`
    },
    nudge: {
      label: 'Un mic memento',
      subject: n => `Un salut rapid de la Alexa Fit, ${n}`,
      h1: n => `Doar un salut, ${n} 🌟`,
      p1: `Am observat că nu ți-ai înregistrat mesele recent în <strong>Alexa Fit</strong>. Urmărirea nutriției tale este unul dintre cele mai puternice lucruri pe care le poți face pentru sănătatea ta.`,
      p2: `Durează doar un moment – deschide aplicația și înregistrează-ți următoarea masă!`
    }
  }
}

const EMAIL_CSS = `body{font-family:'Helvetica Neue',Arial,sans-serif;background:#f4f4f7;margin:0;padding:0}.c{max-width:600px;margin:0 auto;background:#fff;padding:40px 30px;border-radius:10px}.d{width:48px;height:3px;background:#0a84ff;border-radius:2px;margin:0 auto 24px}h1{color:#1a1a1a;text-align:center;font-size:22px;font-weight:700;margin:0 0 20px}p{color:#555;font-size:15px;line-height:1.6;margin:0 0 14px}.f{text-align:center;margin-top:36px;padding-top:20px;border-top:1px solid #eee;font-size:12px;color:#aaa}`

const buildReminderHtml = (h1, p1, p2) =>
  `<!DOCTYPE html><html><head><meta charset="UTF-8"/><style>${EMAIL_CSS}</style></head><body><div class="c"><div class="d"></div><h1>${h1}</h1><p>${p1}</p><p>${p2}</p><div class="f">&copy; ${new Date().getFullYear()} Alexa Fit. All rights reserved.</div></div></body></html>`

const getReminderTemplates = (lang = 'en') => {
  const strings = REMINDER_TRANSLATIONS[lang] || REMINDER_TRANSLATIONS.en
  return [
    {
      id: 'miss_you',
      label: strings.miss_you.label,
      minDays: 8,
      subject: strings.miss_you.subject,
      html: n => buildReminderHtml(strings.miss_you.h1(n), strings.miss_you.p1, strings.miss_you.p2)
    },
    {
      id: 'keep_going',
      label: strings.keep_going.label,
      minDays: 4,
      subject: strings.keep_going.subject,
      html: n => buildReminderHtml(strings.keep_going.h1(n), strings.keep_going.p1, strings.keep_going.p2)
    },
    {
      id: 'nudge',
      label: strings.nudge.label,
      minDays: 1,
      subject: strings.nudge.subject,
      html: n => buildReminderHtml(strings.nudge.h1(n), strings.nudge.p1, strings.nudge.p2)
    }
  ]
}

const getActivityLevel = daysSinceLastLog => {
  if (daysSinceLastLog === null) return { label: 'No data', color: 'bg-gray-100 text-gray-600' }
  if (daysSinceLastLog === 0) return { label: 'Active today', color: 'bg-green-100 text-green-700' }
  if (daysSinceLastLog <= 3) return { label: `${daysSinceLastLog}d ago`, color: 'bg-blue-100 text-blue-700' }
  if (daysSinceLastLog <= 7) return { label: `${daysSinceLastLog}d ago`, color: 'bg-yellow-100 text-yellow-700' }
  return { label: `${daysSinceLastLog}+ days`, color: 'bg-red-100 text-red-700' }
}

const formatShortDate = value => {
  if (!value) return 'N/A'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'N/A' : date.toLocaleDateString()
}

const compareValues = (left, right) => {
  const a = left ?? ''
  const b = right ?? ''

  if (typeof a === 'number' && typeof b === 'number') {
    return a - b
  }

  return String(a).localeCompare(String(b), undefined, {
    numeric: true,
    sensitivity: 'base'
  })
}

const getDisplayName = ({ user, userData, loginDetails }) => {
  if (userData?.name) return userData.name
  if (user?.firstName && user?.lastName) {
    return `${user.firstName} ${user.lastName}`.trim()
  }
  if (loginDetails?.displayName) return loginDetails.displayName
  if (user?.firstName) return user.firstName
  if (user?.lastName) return user.lastName
  return 'Unknown'
}

const getUserEmail = ({ user, loginDetails }) =>
  user?.email ||
  loginDetails?.providerData?.[0]?.email ||
  loginDetails?.email ||
  'N/A'

const getUserAvatar = name =>
  name
    .split(' ')
    .map(part => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

const replacePurchaseOptionAmount = option =>
  option?.title?.replace('{{amount}}', `${option?.value ?? '-'}`) || '-'

const SortHeader = ({ label, active, direction, onClick, align = 'left' }) => (
  <button
    type="button"
    onClick={onClick}
    className={`inline-flex items-center gap-1 text-xs font-medium uppercase tracking-wider text-gray-500 hover:text-gray-700 ${
      align === 'right' ? 'justify-end' : 'justify-start'
    }`}
  >
    <span>{label}</span>
    <ArrowsUpDownIcon className="h-3.5 w-3.5" />
    {active ? (
      <span className="text-[10px] text-violet-600">
        {direction === 'asc' ? '↑' : '↓'}
      </span>
    ) : null}
  </button>
)

const Users = ({ onOpenChat = () => {} }) => {
  const { t } = useTranslation()
  const isAdmin = useSelector(selectIsAdmin)

  const [users, setUsers] = useState([])
  const [userRewardsSummaries, setUserRewardsSummaries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [rewardsError, setRewardsError] = useState(null)
  const hasLoadedRef = useRef(false)
  const [selectedUser, setSelectedUser] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedRewardRow, setSelectedRewardRow] = useState(null)
  const [isRewardsModalOpen, setIsRewardsModalOpen] = useState(false)
  const [rewardRequests, setRewardRequests] = useState([])
  const [rewardRequestsLoading, setRewardRequestsLoading] = useState(false)
  const [rewardRequestsError, setRewardRequestsError] = useState(null)
  const [updatingPurchaseId, setUpdatingPurchaseId] = useState(null)

  const [userSearchTerm, setUserSearchTerm] = useState('')
  const [userFilterStatus, setUserFilterStatus] = useState('all')
  const [userFilterSubscription, setUserFilterSubscription] = useState('all')
  const [usersSort, setUsersSort] = useState({
    column: 'joinDate',
    direction: 'desc'
  })
  const [usersCurrentPage, setUsersCurrentPage] = useState(1)
  const [usersPerPage, setUsersPerPage] = useState(5)

  const [rewardSearchTerm, setRewardSearchTerm] = useState('')
  const [rewardFilterStatus, setRewardFilterStatus] = useState('all')
  const [rewardsSort, setRewardsSort] = useState({
    column: 'coinsAmount',
    direction: 'desc'
  })
  const [rewardsCurrentPage, setRewardsCurrentPage] = useState(1)
  const [rewardsPerPage, setRewardsPerPage] = useState(5)

  const [activityByUserId, setActivityByUserId] = useState({})
  const [reminderRow, setReminderRow] = useState(null)
  const [selectedTemplateId, setSelectedTemplateId] = useState(null)
  const [sendingReminder, setSendingReminder] = useState(false)
  const [reminderResult, setReminderResult] = useState(null)
  const [reminderLang, setReminderLang] = useState('en')
  const [editedSubject, setEditedSubject] = useState('')
  const [editedHtml, setEditedHtml] = useState('')
  const [showEmailPreview, setShowEmailPreview] = useState(false)
  const [caloriesHistoryRow, setCaloriesHistoryRow] = useState(null)
  const [caloriesHistoryData, setCaloriesHistoryData] = useState([])
  const [caloriesHistoryLoading, setCaloriesHistoryLoading] = useState(false)
  const [caloriesHistoryError, setCaloriesHistoryError] = useState(null)
  const [caloriesHistorySort, setCaloriesHistorySort] = useState('desc')

  const [whitelistRow, setWhitelistRow] = useState(null)
  const [isCreateLeadOpen, setIsCreateLeadOpen] = useState(false)

  const toggleUsersSort = column => {
    setUsersSort(current =>
      current.column === column
        ? {
            column,
            direction: current.direction === 'asc' ? 'desc' : 'asc'
          }
        : { column, direction: 'asc' }
    )
  }

  const toggleRewardsSort = column => {
    setRewardsSort(current =>
      current.column === column
        ? {
            column,
            direction: current.direction === 'asc' ? 'desc' : 'asc'
          }
        : { column, direction: 'asc' }
    )
  }

  useEffect(() => {
    if (!reminderRow) return
    const templates = getReminderTemplates(reminderLang)
    const avail = templates.filter(tmpl => reminderRow.daysSinceLastLog === null || reminderRow.daysSinceLastLog >= tmpl.minDays)
    const tmpl = avail.find(tmpl => tmpl.id === selectedTemplateId) || avail[0]
    if (tmpl) {
      setEditedSubject(tmpl.subject(reminderRow.name))
      setEditedHtml(tmpl.html(reminderRow.name))
    }
  }, [selectedTemplateId, reminderLang, reminderRow])

  const openCaloriesHistory = async row => {
    setCaloriesHistoryRow(row)
    setCaloriesHistoryData([])
    setCaloriesHistoryError(null)
    setCaloriesHistoryLoading(true)
    try {
      const res = await getUserCaloriesHistory({ userId: row.userId })
      const entries = Array.isArray(res?.data?.data) ? res.data.data : Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : []
      setCaloriesHistoryData(entries.sort((a, b) => new Date(b.dateApplied) - new Date(a.dateApplied)))
    } catch (err) {
      setCaloriesHistoryError(err?.message || 'Failed to load')
    } finally {
      setCaloriesHistoryLoading(false)
    }
  }

  const loadPageData = async ({ forceRefresh = false } = {}) => {
    if (!isAdmin) return

    setLoading(true)
    setError(null)
    setRewardsError(null)

    try {
      if (forceRefresh) {
        localStorage.removeItem(USERS_CACHE_KEY)
        localStorage.removeItem(USER_REWARDS_CACHE_KEY)
        localStorage.removeItem(ACTIVITY_CACHE_KEY)
      }

      const cachedUsersData = forceRefresh
        ? null
        : localStorage.getItem(USERS_CACHE_KEY)
      const cachedRewardsData = forceRefresh
        ? null
        : localStorage.getItem(USER_REWARDS_CACHE_KEY)
      const cachedActivityData = forceRefresh
        ? null
        : localStorage.getItem(ACTIVITY_CACHE_KEY)

      const hasUsersCache = Boolean(cachedUsersData)
      const hasRewardsCache = Boolean(cachedRewardsData)
      const hasActivityCache = Boolean(cachedActivityData)

      if (hasUsersCache) {
        const data = JSON.parse(cachedUsersData)
        setUsers(Array.isArray(data?.data) ? data.data : data?.users || [])
      }

      if (hasRewardsCache) {
        const data = JSON.parse(cachedRewardsData)
        setUserRewardsSummaries(
          Array.isArray(data?.data?.summaries) ? data.data.summaries : []
        )
      }

      if (hasActivityCache) {
        setActivityByUserId(JSON.parse(cachedActivityData))
      }

      if (hasUsersCache && hasRewardsCache && hasActivityCache && !forceRefresh) {
        setLoading(false)
        return
      }

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Request timeout')), 10000)
      )

      const [usersResult, rewardsResult, activityResult] = await Promise.allSettled([
        Promise.race([getUsers(), timeoutPromise]),
        Promise.race([getUserRewardsSummary(), timeoutPromise]),
        Promise.race([getUsersCaloriesActivity({ days: 14 }), timeoutPromise])
      ])

      if (usersResult.status === 'fulfilled') {
        const data = usersResult.value
        setUsers(Array.isArray(data?.data) ? data.data : data?.users || [])
        try {
          localStorage.setItem(USERS_CACHE_KEY, JSON.stringify(data))
        } catch (_) {}
      } else if (!hasUsersCache) {
        throw usersResult.reason
      }

      if (rewardsResult.status === 'fulfilled') {
        const data = rewardsResult.value
        setUserRewardsSummaries(
          Array.isArray(data?.data?.summaries) ? data.data.summaries : []
        )
        try {
          localStorage.setItem(USER_REWARDS_CACHE_KEY, JSON.stringify(data))
        } catch (_) {}
      } else if (!hasRewardsCache) {
        setUserRewardsSummaries([])
        setRewardsError(t('pages.users.rewards.failed'))
      }

      if (activityResult.status === 'fulfilled') {
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const rawUsers = activityResult.value?.data?.users || {}
        const computed = {}
        for (const [uid, entries] of Object.entries(rawUsers)) {
          const sorted = [...entries].sort(
            (a, b) => new Date(b.dateApplied) - new Date(a.dateApplied)
          )
          const lastEntry = sorted.find(e => Number(e.caloriesConsumed) > 0)
          if (lastEntry) {
            const last = new Date(lastEntry.dateApplied)
            last.setHours(0, 0, 0, 0)
            const diff = Math.round((today - last) / 86400000)
            computed[uid] = { daysSinceLastLog: diff, daysActive: sorted.filter(e => Number(e.caloriesConsumed) > 0).length }
          } else {
            computed[uid] = { daysSinceLastLog: 14, daysActive: 0 }
          }
        }
        setActivityByUserId(computed)
        try {
          localStorage.setItem(ACTIVITY_CACHE_KEY, JSON.stringify(computed))
        } catch (_) {}
      }
    } catch (err) {
      setError(
        err.message === 'Request timeout'
          ? 'Request timed out. Please check your connection.'
          : 'Failed to load users. Please try again.'
      )
      console.error('Error loading users page data:', err)
    } finally {
      setLoading(false)
    }
  }

  const refreshUsers = async () => {
    hasLoadedRef.current = false
    await loadPageData({ forceRefresh: true })
  }

  const loadRewardRequestsForUser = async userId => {
    setRewardRequestsLoading(true)
    setRewardRequestsError(null)
    try {
      const response = await getUserPurchaseRequests({ userId })
      setRewardRequests(Array.isArray(response?.data) ? response.data : [])
    } catch (err) {
      setRewardRequestsError(t('pages.users.rewards.requestsFailed'))
      console.error('Error loading reward requests:', err)
    } finally {
      setRewardRequestsLoading(false)
    }
  }

  const openRewardsModal = async row => {
    setSelectedRewardRow(row)
    setIsRewardsModalOpen(true)
    await loadRewardRequestsForUser(row.userId)
  }

  const handlePurchaseStatusUpdate = async ({ purchaseId, status, userId }) => {
    try {
      setUpdatingPurchaseId(purchaseId)
      await updateUserPurchaseStatus({ purchaseId, status })
      await Promise.all([
        loadRewardRequestsForUser(userId),
        loadPageData({ forceRefresh: true })
      ])
    } catch (err) {
      setRewardRequestsError(t('pages.users.rewards.updateFailed'))
      console.error('Error updating purchase request:', err)
    } finally {
      setUpdatingPurchaseId(null)
    }
  }

  useEffect(() => {
    if (hasLoadedRef.current) return
    hasLoadedRef.current = true
    loadPageData()
  }, [isAdmin, t])

  const usersRows = useMemo(() => {
    return users.map(user => {
      const userData = formatUserData(user)
      const loginDetails = user?.loginDetails || {}
      const name = getDisplayName({ user, userData, loginDetails })
      const email = getUserEmail({ user, loginDetails })
      const subInfo = formatSubscriptionStatus(user)
      const subscription =
        subInfo.plan === 'Paid - Not Onboarded'
          ? 'Paid - Not Onboarded'
          : subInfo.plan === 'Pro Plan' || subInfo.plan === 'Program Plan'
            ? 'Premium'
            : 'Free'
      const uid = user?.userId || user?.id || ''
      const activity = activityByUserId[uid] ?? null

      return {
        raw: user,
        key: uid,
        userId: uid,
        name,
        email,
        avatar: getUserAvatar(name),
        status: (user?.status || '').toString().toLowerCase(),
        subscription,
        joinDate: user?.dateTimeCreated || null,
        lastActive: user?.dateTimeUpdated || null,
        daysSinceLastLog: activity ? activity.daysSinceLastLog : null,
        daysActive: activity ? activity.daysActive : null
      }
    })
  }, [users, activityByUserId])

  const filteredUsersRows = useMemo(() => {
    const filtered = usersRows.filter(row => {
      const matchesSearch =
        row.name.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
        row.email.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
        row.userId.toLowerCase().includes(userSearchTerm.toLowerCase())
      const matchesFilter =
        userFilterStatus === 'all' || row.status === userFilterStatus
      const matchesSubscription =
        userFilterSubscription === 'all' ||
        row.subscription === userFilterSubscription
      return matchesSearch && matchesFilter && matchesSubscription
    })

    const getterMap = {
      user: row => row.name,
      status: row => row.status,
      subscription: row => row.subscription,
      joinDate: row => new Date(row.joinDate || 0).getTime() || 0,
      lastActive: row => new Date(row.lastActive || 0).getTime() || 0,
      daysSinceLastLog: row => row.daysSinceLastLog ?? 999
    }

    const getter = getterMap[usersSort.column] || getterMap.joinDate

    return filtered.sort((left, right) => {
      const result = compareValues(getter(left), getter(right))
      return usersSort.direction === 'asc' ? result : -result
    })
  }, [usersRows, userSearchTerm, userFilterStatus, userFilterSubscription, usersSort])

  useEffect(() => {
    setUsersCurrentPage(1)
  }, [userSearchTerm, userFilterStatus, userFilterSubscription, usersPerPage])

  const paginatedUsersRows = useMemo(() => {
    const startIndex = (usersCurrentPage - 1) * usersPerPage
    return filteredUsersRows.slice(startIndex, startIndex + usersPerPage)
  }, [filteredUsersRows, usersCurrentPage, usersPerPage])

  const usersTotalPages = Math.max(
    1,
    Math.ceil(filteredUsersRows.length / usersPerPage) || 1
  )
  const usersPageStart =
    filteredUsersRows.length > 0 ? (usersCurrentPage - 1) * usersPerPage + 1 : 0
  const usersPageEnd = Math.min(
    usersCurrentPage * usersPerPage,
    filteredUsersRows.length
  )

  const userRewardsByUserId = useMemo(
    () =>
      Object.fromEntries(
        userRewardsSummaries.map(summary => [summary.userId, summary])
      ),
    [userRewardsSummaries]
  )

  const rewardRows = useMemo(() => {
    return usersRows.map(row => {
      const rewardSummary = userRewardsByUserId[row.userId] || null
      const targetPurchaseOption = rewardSummary?.targetPurchaseOption || null
      const latestPurchase = rewardSummary?.latestPurchase || null

      return {
        ...row,
        coinsAmount: Number(rewardSummary?.coinsAmount || 0),
        targetPurchaseLabel: targetPurchaseOption
          ? replacePurchaseOptionAmount(targetPurchaseOption)
          : t('pages.users.rewards.noTarget'),
        targetCoins: Number(rewardSummary?.targetCoins || 0),
        progressPercentage: Number(rewardSummary?.progressPercentage || 0),
        latestPurchaseLabel: latestPurchase?.purchaseOption
          ? replacePurchaseOptionAmount(latestPurchase.purchaseOption)
          : t('pages.users.rewards.noRequest'),
        latestPurchaseStatus: latestPurchase?.status || '',
        latestPurchaseDate: latestPurchase?.dateTimeCreated || null,
        purchaseRequestsCount: Number(
          rewardSummary?.purchaseRequestsCount || 0
        ),
        pendingPurchaseRequestsCount: Number(
          rewardSummary?.pendingPurchaseRequestsCount || 0
        )
      }
    })
  }, [usersRows, userRewardsByUserId, t])

  const filteredRewardRows = useMemo(() => {
    const filtered = rewardRows.filter(row => {
      const matchesSearch =
        row.name.toLowerCase().includes(rewardSearchTerm.toLowerCase()) ||
        row.email.toLowerCase().includes(rewardSearchTerm.toLowerCase()) ||
        row.userId.toLowerCase().includes(rewardSearchTerm.toLowerCase()) ||
        row.targetPurchaseLabel
          .toLowerCase()
          .includes(rewardSearchTerm.toLowerCase()) ||
        row.latestPurchaseLabel
          .toLowerCase()
          .includes(rewardSearchTerm.toLowerCase())

      const normalizedStatus = (row.latestPurchaseStatus || 'NO_REQUEST')
        .toString()
        .toUpperCase()
      const matchesFilter =
        rewardFilterStatus === 'all' || normalizedStatus === rewardFilterStatus

      return matchesSearch && matchesFilter
    })

    const getterMap = {
      user: row => row.name,
      coinsAmount: row => row.coinsAmount,
      targetReward: row => row.targetCoins,
      progress: row => row.progressPercentage,
      latestRequest: row => row.latestPurchaseLabel,
      requestStatus: row => row.latestPurchaseStatus || 'NO_REQUEST',
      requests: row => row.purchaseRequestsCount,
      requestedAt: row => new Date(row.latestPurchaseDate || 0).getTime() || 0
    }

    const getter = getterMap[rewardsSort.column] || getterMap.coinsAmount

    return filtered.sort((left, right) => {
      const result = compareValues(getter(left), getter(right))
      return rewardsSort.direction === 'asc' ? result : -result
    })
  }, [rewardRows, rewardSearchTerm, rewardFilterStatus, rewardsSort])

  useEffect(() => {
    setRewardsCurrentPage(1)
  }, [rewardSearchTerm, rewardFilterStatus, rewardsPerPage])

  const paginatedRewardRows = useMemo(() => {
    const startIndex = (rewardsCurrentPage - 1) * rewardsPerPage
    return filteredRewardRows.slice(startIndex, startIndex + rewardsPerPage)
  }, [filteredRewardRows, rewardsCurrentPage, rewardsPerPage])

  const rewardsTotalPages = Math.max(
    1,
    Math.ceil(filteredRewardRows.length / rewardsPerPage) || 1
  )
  const rewardsPageStart =
    filteredRewardRows.length > 0
      ? (rewardsCurrentPage - 1) * rewardsPerPage + 1
      : 0
  const rewardsPageEnd = Math.min(
    rewardsCurrentPage * rewardsPerPage,
    filteredRewardRows.length
  )

  const getStatusBadge = status => {
    const styles = {
      active: 'bg-green-100 text-green-800',
      inactive: 'bg-gray-100 text-gray-800',
      suspended: 'bg-red-100 text-red-800',
      pending_deletion: 'bg-amber-100 text-amber-800'
    }

    return (
      <span
        className={`rounded-full px-2 py-1 text-xs font-medium ${
          styles[status] || 'bg-gray-100 text-gray-700'
        }`}
      >
        {status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}
      </span>
    )
  }

  const getSubscriptionBadge = subscription => {
    const styles = {
      Premium: 'bg-purple-100 text-purple-800',
      Basic: 'bg-blue-100 text-blue-800',
      'Paid - Not Onboarded': 'bg-amber-100 text-amber-800',
      Free: 'bg-gray-100 text-gray-800'
    }

    return (
      <span
        className={`rounded-full px-2 py-1 text-xs font-medium ${
          styles[subscription] || 'bg-gray-100 text-gray-700'
        }`}
      >
        {subscription}
      </span>
    )
  }

  const getRewardStatusBadge = status => {
    if (!status) {
      return (
        <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
          {t('pages.users.rewards.noRequest')}
        </span>
      )
    }

    const normalizedStatus = status.toUpperCase()
    const styles = {
      PENDING: 'bg-amber-100 text-amber-800',
      COMPLETED: 'bg-blue-100 text-blue-700',
      FAILED: 'bg-yellow-100 text-yellow-800'
    }

    return (
      <span
        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
          styles[normalizedStatus] || 'bg-gray-100 text-gray-700'
        }`}
      >
        {normalizedStatus}
      </span>
    )
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {t('pages.users.title')}
          </h1>
          <p className="mt-2 text-gray-600">{t('pages.users.subtitle')}</p>
        </div>
        <div className="flex h-64 items-center justify-center">
          <div className="text-center">
            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">{t('pages.users.loading')}</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {t('pages.users.title')}
          </h1>
          <p className="mt-2 text-gray-600">{t('pages.users.subtitle')}</p>
        </div>
        <div className="card p-6">
          <div className="flex items-center">
            <ExclamationTriangleIcon className="mr-4 h-8 w-8 text-red-600" />
            <div>
              <h3 className="text-lg font-medium text-gray-900">
                {t('pages.users.error')}
              </h3>
              <p className="mt-1 text-gray-600">{error}</p>
              <button onClick={refreshUsers} className="btn-primary mt-4">
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
          <h1 className="text-3xl font-bold text-gray-900">
            {t('pages.users.title')}
          </h1>
          <p className="mt-1 text-sm text-gray-600 sm:text-base">
            {t('pages.users.subtitle')}
          </p>
        </div>
        <div className="flex gap-2 items-center justify-center sm:justify-end">
          <button
            onClick={() => setIsCreateLeadOpen(true)}
            className="btn-primary flex items-center"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Lead
          </button>
          <button
            onClick={refreshUsers}
            className="btn-secondary flex items-center"
            disabled={loading}
          >
            <svg
              className="mr-2 h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            {loading ? t('common.loading') : t('pages.users.refresh')}
          </button>
        </div>
      </div>

      <div className="card p-6">
        <div className="flex flex-col gap-4 md:flex-row">
          <div className="flex-1">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder={t('pages.users.searchPlaceholder')}
                value={userSearchTerm}
                onChange={e => setUserSearchTerm(e.target.value)}
                className="input pl-10"
              />
            </div>
          </div>
          <select
            value={userFilterStatus}
            onChange={e => setUserFilterStatus(e.target.value)}
            className="input w-44"
          >
            <option value="all">{t('pages.users.filters.allStatus')}</option>
            <option value="active">{t('pages.users.filters.active')}</option>
            <option value="inactive">Inactive</option>
            <option value="suspended">Suspended</option>
            <option value="pending_deletion">
              {t('pages.users.filters.pendingDeletion')}
            </option>
          </select>
          <select
            value={userFilterSubscription}
            onChange={e => setUserFilterSubscription(e.target.value)}
            className="input w-44"
          >
            <option value="all">All Plans</option>
            <option value="Premium">Premium</option>
            <option value="Free">Free</option>
          </select>
        </div>
      </div>

      <div className="space-y-3 md:hidden">
        {paginatedUsersRows.map(row => (
          <div key={row.key} className="card p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center">
                <div className="mr-3 flex h-10 w-10 items-center justify-center rounded-full bg-blue-600">
                  <span className="text-sm font-medium text-white">
                    {row.avatar}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    {row.name}
                  </p>
                  <p className="text-xs text-gray-500">{row.email}</p>
                </div>
              </div>
              <ControlsDropdown
                actions={[
                  {
                    icon: ChartBarIcon,
                    labelKey: 'common.controls.calorieHistory',
                    colorClass: 'text-teal-600',
                    onClick: () => openCaloriesHistory(row)
                  },
                  {
                    icon: EnvelopeIcon,
                    labelKey: 'common.controls.reminderEmail',
                    colorClass: 'text-indigo-600',
                    onClick: () => {
                      const available = getReminderTemplates('en').filter(
                        tmpl => row.daysSinceLastLog === null || row.daysSinceLastLog >= tmpl.minDays
                      )
                      setSelectedTemplateId(available[0]?.id ?? getReminderTemplates('en')[0].id)
                      setReminderLang('en')
                      setEditedSubject('')
                      setEditedHtml('')
                      setShowEmailPreview(false)
                      setReminderResult(null)
                      setReminderRow(row)
                    }
                  },
                  {
                    icon: ShieldCheckIcon,
                    labelKey: 'common.controls.whitelist',
                    colorClass: 'text-violet-600',
                    onClick: () => setWhitelistRow(row)
                  },
                  {
                    icon: EyeIcon,
                    labelKey: 'common.controls.viewDetails',
                    colorClass: 'text-blue-600',
                    onClick: () => {
                      setSelectedUser(row.raw)
                      setIsModalOpen(true)
                    }
                  },
                  {
                    icon: ChatBubbleLeftRightIcon,
                    labelKey: 'common.controls.chat',
                    colorClass: 'text-green-600',
                    onClick: () => onOpenChat(row.userId)
                  }
                ]}
              />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div className="space-y-1">
                <p className="text-gray-500">{t('pages.users.status')}</p>
                {getStatusBadge(row.status)}
              </div>
              <div className="space-y-1">
                <p className="text-gray-500">{t('pages.users.subscription')}</p>
                {getSubscriptionBadge(row.subscription)}
              </div>
              <div className="space-y-1">
                <p className="text-gray-500">{t('pages.users.joinDate')}</p>
                <p className="text-sm text-gray-800">
                  {formatShortDate(row.joinDate)}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-gray-500">{t('pages.users.lastActive')}</p>
                <p className="text-sm text-gray-800">
                  {formatShortDate(row.lastActive)}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="card hidden overflow-visible md:block">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left">
                <SortHeader
                  label={t('pages.users.user')}
                  active={usersSort.column === 'user'}
                  direction={usersSort.direction}
                  onClick={() => toggleUsersSort('user')}
                />
              </th>
              <th className="px-6 py-3 text-left">
                <SortHeader
                  label={t('pages.users.status')}
                  active={usersSort.column === 'status'}
                  direction={usersSort.direction}
                  onClick={() => toggleUsersSort('status')}
                />
              </th>
              <th className="px-6 py-3 text-left">
                <SortHeader
                  label={t('pages.users.subscription')}
                  active={usersSort.column === 'subscription'}
                  direction={usersSort.direction}
                  onClick={() => toggleUsersSort('subscription')}
                />
              </th>
              <th className="px-6 py-3 text-left">
                <SortHeader
                  label={t('pages.users.joinDate')}
                  active={usersSort.column === 'joinDate'}
                  direction={usersSort.direction}
                  onClick={() => toggleUsersSort('joinDate')}
                />
              </th>
              <th className="px-6 py-3 text-left">
                <SortHeader
                  label={t('pages.users.lastActive')}
                  active={usersSort.column === 'lastActive'}
                  direction={usersSort.direction}
                  onClick={() => toggleUsersSort('lastActive')}
                />
              </th>
              <th className="px-6 py-3 text-left">
                <SortHeader
                  label="Last Logged"
                  active={usersSort.column === 'daysSinceLastLog'}
                  direction={usersSort.direction}
                  onClick={() => toggleUsersSort('daysSinceLastLog')}
                />
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                {t('pages.users.actions')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {paginatedUsersRows.map(row => (
              <tr key={row.key} className="hover:bg-gray-50">
                <td className="whitespace-nowrap px-6 py-4">
                  <div className="flex items-center">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600">
                      <span className="text-sm font-medium text-white">
                        {row.avatar}
                      </span>
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900">
                        {row.name}
                      </div>
                      <div className="text-sm text-gray-500">{row.email}</div>
                    </div>
                  </div>
                </td>
                <td className="whitespace-nowrap px-6 py-4">
                  {getStatusBadge(row.status)}
                </td>
                <td className="whitespace-nowrap px-6 py-4">
                  {getSubscriptionBadge(row.subscription)}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                  {formatShortDate(row.joinDate)}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                  {formatShortDate(row.lastActive)}
                </td>
                <td className="whitespace-nowrap px-6 py-4">
                  {(() => {
                    const level = getActivityLevel(row.daysSinceLastLog)
                    return (
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${level.color}`}>
                        {level.label}
                      </span>
                    )
                  })()}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-right">
                  <ControlsDropdown
                    actions={[
                      {
                        icon: ChartBarIcon,
                        labelKey: 'common.controls.calorieHistory',
                        colorClass: 'text-teal-600',
                        onClick: () => openCaloriesHistory(row)
                      },
                      {
                        icon: EnvelopeIcon,
                        labelKey: 'common.controls.reminderEmail',
                        colorClass: 'text-indigo-600',
                        onClick: () => {
                          const available = getReminderTemplates('en').filter(
                            tmpl => row.daysSinceLastLog === null || row.daysSinceLastLog >= tmpl.minDays
                          )
                          setSelectedTemplateId(available[0]?.id ?? getReminderTemplates('en')[0].id)
                          setReminderLang('en')
                          setEditedSubject('')
                          setEditedHtml('')
                          setShowEmailPreview(false)
                          setReminderResult(null)
                          setReminderRow(row)
                        }
                      },
                      {
                        icon: ShieldCheckIcon,
                        labelKey: 'common.controls.whitelist',
                        colorClass: 'text-violet-600',
                        onClick: () => setWhitelistRow(row)
                      },
                      {
                        icon: EyeIcon,
                        labelKey: 'common.controls.viewDetails',
                        colorClass: 'text-blue-600',
                        onClick: () => {
                          setSelectedUser(row.raw)
                          setIsModalOpen(true)
                        }
                      },
                      {
                        icon: ChatBubbleLeftRightIcon,
                        labelKey: 'common.controls.chat',
                        colorClass: 'text-green-600',
                        onClick: () => onOpenChat(row.userId)
                      }
                    ]}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-3 rounded-md border border-gray-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <label className="text-sm text-gray-700">
            {t('pages.users.perPage')}
          </label>
          <select
            value={usersPerPage}
            onChange={e => setUsersPerPage(Number(e.target.value))}
            className="rounded-md border border-gray-300 px-3 py-1 text-sm"
          >
            <option value="5">5</option>
            <option value="15">15</option>
            <option value="25">25</option>
          </select>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
          <p className="text-sm text-gray-700">
            {t('pages.users.pagination.showing', {
              start: usersPageStart,
              end: usersPageEnd,
              total: filteredUsersRows.length
            })}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() =>
                setUsersCurrentPage(prev => Math.max(1, prev - 1))
              }
              disabled={usersCurrentPage === 1}
              className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t('common.previous')}
            </button>
            <span className="text-sm text-gray-600">
              {t('pages.users.pagination.page', {
                current: usersCurrentPage,
                total: usersTotalPages
              })}
            </span>
            <button
              onClick={() =>
                setUsersCurrentPage(prev =>
                  Math.min(usersTotalPages, prev + 1)
                )
              }
              disabled={usersCurrentPage >= usersTotalPages}
              className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t('common.next')}
            </button>
          </div>
        </div>
      </div>

      {isAdmin ? (
        <div className="space-y-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {t('pages.users.rewards.title')}
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              {t('pages.users.rewards.subtitle')}
            </p>
          </div>

          {rewardsError ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {rewardsError}
            </div>
          ) : null}

          <div className="card p-6">
            <div className="flex flex-col gap-4 md:flex-row">
              <div className="flex-1">
                <div className="relative">
                  <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder={t('pages.users.rewards.searchPlaceholder')}
                    value={rewardSearchTerm}
                    onChange={e => setRewardSearchTerm(e.target.value)}
                    className="input pl-10"
                  />
                </div>
              </div>
              <select
                value={rewardFilterStatus}
                onChange={e => setRewardFilterStatus(e.target.value)}
                className="input w-52"
              >
                <option value="all">
                  {t('pages.users.rewards.filters.allRequests')}
                </option>
                <option value="PENDING">
                  {t('pages.users.rewards.filters.pending')}
                </option>
                <option value="COMPLETED">
                  {t('pages.users.rewards.filters.completed')}
                </option>
                <option value="FAILED">
                  {t('pages.users.rewards.filters.failed')}
                </option>
                <option value="NO_REQUEST">
                  {t('pages.users.rewards.filters.noRequest')}
                </option>
              </select>
            </div>
          </div>

          <div className="space-y-3 md:hidden">
            {paginatedRewardRows.map(row => (
              <button
                key={row.key}
                type="button"
                onClick={() => openRewardsModal(row)}
                className="card w-full p-4 text-left transition hover:border-violet-200 hover:shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-600 text-sm font-semibold text-white">
                    {row.avatar}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-gray-900">
                      {row.name}
                    </p>
                    <p className="truncate text-xs text-gray-500">{row.email}</p>
                  </div>
                  <div className="rounded-full bg-violet-50 px-3 py-1 text-sm font-semibold text-violet-700">
                    {row.coinsAmount} {t('pages.users.rewards.coinsUnit')}
                  </div>
                  <div className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-500">
                    <EyeIcon className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-4 space-y-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      {t('pages.users.rewards.targetReward')}
                    </p>
                    <p className="mt-1 text-sm text-slate-900">
                      {row.targetPurchaseLabel}
                    </p>
                  </div>
                  <div>
                    <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
                      <span>{t('pages.users.rewards.progress')}</span>
                      <span>
                        {row.coinsAmount} / {row.targetCoins || 0}{' '}
                        {t('pages.users.rewards.coinsUnit')}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100">
                      <div
                        className="h-2 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500"
                        style={{
                          width: `${Math.max(4, row.progressPercentage)}%`
                        }}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        {t('pages.users.rewards.latestRequest')}
                      </p>
                      <p className="mt-1 text-slate-900">
                        {row.latestPurchaseLabel}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        {t('pages.users.rewards.requestStatus')}
                      </p>
                      <div className="mt-1">
                        {getRewardStatusBadge(row.latestPurchaseStatus)}
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {t('pages.users.rewards.latestStatusHint')}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        {t('pages.users.rewards.requests')}
                      </p>
                      <p className="mt-1 text-slate-900">
                        {t('pages.users.rewards.requestsCount', {
                          count: row.purchaseRequestsCount,
                          pending: row.pendingPurchaseRequestsCount
                        })}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        {t('pages.users.rewards.requestedAt')}
                      </p>
                      <p className="mt-1 text-slate-900">
                        {formatShortDate(row.latestPurchaseDate)}
                      </p>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>

          <div className="card hidden overflow-visible md:block">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left">
                    <SortHeader
                      label={t('pages.users.user')}
                      active={rewardsSort.column === 'user'}
                      direction={rewardsSort.direction}
                      onClick={() => toggleRewardsSort('user')}
                    />
                  </th>
                  <th className="px-6 py-3 text-left">
                    <SortHeader
                      label={t('pages.users.rewards.coins')}
                      active={rewardsSort.column === 'coinsAmount'}
                      direction={rewardsSort.direction}
                      onClick={() => toggleRewardsSort('coinsAmount')}
                    />
                  </th>
                  <th className="px-6 py-3 text-left">
                    <SortHeader
                      label={t('pages.users.rewards.targetReward')}
                      active={rewardsSort.column === 'targetReward'}
                      direction={rewardsSort.direction}
                      onClick={() => toggleRewardsSort('targetReward')}
                    />
                  </th>
                  <th className="px-6 py-3 text-left">
                    <SortHeader
                      label={t('pages.users.rewards.progress')}
                      active={rewardsSort.column === 'progress'}
                      direction={rewardsSort.direction}
                      onClick={() => toggleRewardsSort('progress')}
                    />
                  </th>
                  <th className="px-6 py-3 text-left">
                    <SortHeader
                      label={t('pages.users.rewards.latestRequest')}
                      active={rewardsSort.column === 'latestRequest'}
                      direction={rewardsSort.direction}
                      onClick={() => toggleRewardsSort('latestRequest')}
                    />
                  </th>
                  <th className="px-6 py-3 text-left">
                    <SortHeader
                      label={t('pages.users.rewards.requestStatus')}
                      active={rewardsSort.column === 'requestStatus'}
                      direction={rewardsSort.direction}
                      onClick={() => toggleRewardsSort('requestStatus')}
                    />
                  </th>
                  <th className="px-6 py-3 text-left">
                    <SortHeader
                      label={t('pages.users.rewards.requests')}
                      active={rewardsSort.column === 'requests'}
                      direction={rewardsSort.direction}
                      onClick={() => toggleRewardsSort('requests')}
                    />
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                    {t('pages.users.rewards.actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {paginatedRewardRows.map(row => (
                  <tr
                    key={row.key}
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => openRewardsModal(row)}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-600 text-sm font-semibold text-white">
                          {row.avatar}
                        </div>
                        <div className="ml-4 min-w-0">
                          <div className="text-sm font-medium text-gray-900">
                            {row.name}
                          </div>
                          <div className="max-w-[240px] truncate text-sm text-gray-500">
                            {row.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="text-sm font-semibold text-gray-900">
                        {row.coinsAmount}
                      </div>
                      <div className="text-xs text-gray-500">
                        {t('pages.users.rewards.coinsUnit')}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <div>{row.targetPurchaseLabel}</div>
                      <div className="text-xs text-gray-500">
                        {row.targetCoins || 0} {t('pages.users.rewards.coinsUnit')}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="min-w-[220px]">
                        <div className="mb-2 flex items-center justify-between text-xs text-gray-500">
                          <span>{row.progressPercentage}%</span>
                          <span>
                            {row.coinsAmount} / {row.targetCoins || 0}{' '}
                            {t('pages.users.rewards.coinsUnit')}
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-slate-100">
                          <div
                            className="h-2 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500"
                            style={{
                              width: `${Math.max(4, row.progressPercentage)}%`
                            }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <div>{row.latestPurchaseLabel}</div>
                      <div className="text-xs text-gray-500">
                        {formatShortDate(row.latestPurchaseDate)}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="flex flex-col items-start gap-1">
                        {getRewardStatusBadge(row.latestPurchaseStatus)}
                        <span className="text-xs text-slate-500">
                          {t('pages.users.rewards.latestStatusHint')}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {t('pages.users.rewards.requestsCount', {
                        count: row.purchaseRequestsCount,
                        pending: row.pendingPurchaseRequestsCount
                      })}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right">
                      <button
                        type="button"
                        onClick={event => {
                          event.stopPropagation()
                          openRewardsModal(row)
                        }}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-violet-200 hover:text-violet-700"
                        title={t('pages.users.rewards.viewAll')}
                      >
                        <EyeIcon className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 rounded-md border border-gray-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <label className="text-sm text-gray-700">
                {t('pages.users.perPage')}
              </label>
              <select
                value={rewardsPerPage}
                onChange={e => setRewardsPerPage(Number(e.target.value))}
                className="rounded-md border border-gray-300 px-3 py-1 text-sm"
              >
                <option value="5">5</option>
                <option value="15">15</option>
                <option value="25">25</option>
              </select>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
              <p className="text-sm text-gray-700">
                {t('pages.users.pagination.showing', {
                  start: rewardsPageStart,
                  end: rewardsPageEnd,
                  total: filteredRewardRows.length
                })}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() =>
                    setRewardsCurrentPage(prev => Math.max(1, prev - 1))
                  }
                  disabled={rewardsCurrentPage === 1}
                  className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {t('common.previous')}
                </button>
                <span className="text-sm text-gray-600">
                  {t('pages.users.pagination.page', {
                    current: rewardsCurrentPage,
                    total: rewardsTotalPages
                  })}
                </span>
                <button
                  onClick={() =>
                    setRewardsCurrentPage(prev =>
                      Math.min(rewardsTotalPages, prev + 1)
                    )
                  }
                  disabled={rewardsCurrentPage >= rewardsTotalPages}
                  className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {t('common.next')}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <UserDetailModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setSelectedUser(null)
        }}
        user={selectedUser}
      />

      {isCreateLeadOpen && (
        <CreateLeadModal
          onClose={() => setIsCreateLeadOpen(false)}
          onCreated={() => loadPageData({ forceRefresh: true })}
        />
      )}

      {whitelistRow ? (
        <WhitelistModal
          userMeta={{ name: whitelistRow.name, email: whitelistRow.email }}
          currentDetails={whitelistRow.raw?.subscriptionWhitelistDetails}
          onClose={() => setWhitelistRow(null)}
          onSave={async parsed => {
            const userId = whitelistRow.raw?.userId || null
            const id = whitelistRow.raw?.id || null
            await setUserSubscriptionWhitelistDetails({
              userId: userId || undefined,
              id: userId ? undefined : id,
              subscriptionWhitelistDetails: parsed
            })
            setUsers(prev => prev.map(u => {
              const uid = u?.userId || u?.id
              const rowUid = whitelistRow.raw?.userId || whitelistRow.raw?.id
              return uid === rowUid ? { ...u, subscriptionWhitelistDetails: parsed } : u
            }))
          }}
        />
      ) : null}

      {isRewardsModalOpen ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/45 p-4">
          <div className="max-h-[85vh] w-full max-w-5xl overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
              <div>
                <h3 className="text-2xl font-bold text-slate-900">
                  {selectedRewardRow?.name || t('pages.users.rewards.title')}
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  {selectedRewardRow?.email || selectedRewardRow?.userId || ''}
                </p>
                <p className="mt-2 text-sm text-slate-600">
                  {t('pages.users.rewards.requestsSubtitle')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsRewardsModalOpen(false)
                  setSelectedRewardRow(null)
                  setRewardRequests([])
                  setRewardRequestsError(null)
                }}
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                {t('common.close')}
              </button>
            </div>

            <div className="space-y-4 overflow-y-auto px-6 py-5">
              {rewardRequestsError ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  {rewardRequestsError}
                </div>
              ) : null}

              {rewardRequestsLoading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-violet-600"></div>
                </div>
              ) : rewardRequests.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 px-6 py-12 text-center text-sm text-slate-500">
                  {t('pages.users.rewards.noRequestsForUser')}
                </div>
              ) : (
                <div className="space-y-3">
                  {rewardRequests.map(request => {
                    const purchaseOption = request?.purchaseOption || null
                    const purchaseLabel = purchaseOption
                      ? replacePurchaseOptionAmount(purchaseOption)
                      : t('pages.users.rewards.noRequest')
                    const isPending =
                      (request?.status || '').toUpperCase() === 'PENDING'

                    return (
                      <div
                        key={request.id}
                        className="rounded-2xl border border-slate-200 bg-white p-4"
                      >
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-3">
                              <p className="text-base font-semibold text-slate-900">
                                {purchaseLabel}
                              </p>
                              {getRewardStatusBadge(request?.status)}
                            </div>
                            <div className="mt-2 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-500">
                              <span>
                                {t('pages.users.rewards.requestedAt')}:{' '}
                                {formatShortDate(request?.dateTimeCreated)}
                              </span>
                              <span>
                                {t('pages.users.rewards.updatedAt')}:{' '}
                                {formatShortDate(request?.dateTimeUpdated)}
                              </span>
                              <span>
                                {t('pages.users.rewards.coins')}:{' '}
                                {purchaseOption?.coins || 0}{' '}
                                {t('pages.users.rewards.coinsUnit')}
                              </span>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            {isPending ? (
                              <>
                                <button
                                  type="button"
                                  disabled={updatingPurchaseId === request.id}
                                  onClick={() =>
                                    handlePurchaseStatusUpdate({
                                      purchaseId: request.id,
                                      status: 'COMPLETED',
                                      userId: selectedRewardRow?.userId
                                    })
                                  }
                                  className="rounded-full bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {updatingPurchaseId === request.id
                                    ? t('common.loading')
                                    : t('pages.users.rewards.complete')}
                                </button>
                                <button
                                  type="button"
                                  disabled={updatingPurchaseId === request.id}
                                  onClick={() =>
                                    handlePurchaseStatusUpdate({
                                      purchaseId: request.id,
                                      status: 'FAILED',
                                      userId: selectedRewardRow?.userId
                                    })
                                  }
                                  className="rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {updatingPurchaseId === request.id
                                    ? t('common.loading')
                                    : t('pages.users.rewards.fail')}
                                </button>
                              </>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {reminderRow && (() => {
        const availableTemplates = getReminderTemplates(reminderLang).filter(
          tmpl => reminderRow.daysSinceLastLog === null || reminderRow.daysSinceLastLog >= tmpl.minDays
        )
        const handleSend = async () => {
          setSendingReminder(true)
          setReminderResult(null)
          try {
            await sendReminderEmail({
              userId: reminderRow.userId,
              subject: editedSubject,
              html: editedHtml
            })
            setReminderResult({ ok: true })
          } catch (err) {
            setReminderResult({ ok: false, error: err?.message || 'Failed to send' })
          } finally {
            setSendingReminder(false)
          }
        }

        const actLevel = getActivityLevel(reminderRow.daysSinceLastLog)
        const LANGS = ['en', 'fr', 'es', 'ro']

        return (
          <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-10">
            <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
              {/* Header */}
              <div className="border-b border-gray-100 px-6 py-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">Send Reminder Email</h3>
                  <button
                    onClick={() => { setReminderRow(null); setReminderResult(null) }}
                    className="text-gray-400 hover:text-gray-600"
                  >✕</button>
                </div>
                <div className="mt-2 flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-600 text-sm font-medium text-white">
                    {reminderRow.avatar}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{reminderRow.name}</p>
                    <p className="text-xs text-gray-500">{reminderRow.email}</p>
                  </div>
                  <span className={`ml-auto inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${actLevel.color}`}>
                    {actLevel.label}
                  </span>
                </div>
              </div>

              <div className="px-6 py-4 space-y-5">
                {/* Language selector */}
                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-500">Language</p>
                  <div className="flex gap-2">
                    {LANGS.map(lng => (
                      <button
                        key={lng}
                        onClick={() => setReminderLang(lng)}
                        className={`rounded-lg border px-3 py-1 text-xs font-medium uppercase transition-colors ${
                          reminderLang === lng
                            ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                            : 'border-gray-200 text-gray-600 hover:border-indigo-300'
                        }`}
                      >
                        {lng}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Template selector */}
                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-500">Template</p>
                  {availableTemplates.length === 0 ? (
                    <p className="text-sm text-gray-500">No templates available for this activity level.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {availableTemplates.map(tmpl => (
                        <button
                          key={tmpl.id}
                          onClick={() => setSelectedTemplateId(tmpl.id)}
                          className={`rounded-xl border px-4 py-2 text-left text-sm transition-colors ${
                            (selectedTemplateId === tmpl.id || (!selectedTemplateId && tmpl === availableTemplates[0]))
                              ? 'border-indigo-500 bg-indigo-50 text-indigo-800'
                              : 'border-gray-200 text-gray-700 hover:border-indigo-300'
                          }`}
                        >
                          <p className="font-medium">{tmpl.label}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Editable subject */}
                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-gray-500">Subject</label>
                  <input
                    type="text"
                    value={editedSubject}
                    onChange={e => setEditedSubject(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
                  />
                </div>

                {/* Editable HTML body */}
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <label className="text-xs font-medium uppercase tracking-wider text-gray-500">HTML Body</label>
                    <button
                      onClick={() => setShowEmailPreview(v => !v)}
                      className="text-xs text-indigo-600 hover:text-indigo-800"
                    >
                      {showEmailPreview ? 'Hide preview' : 'Show preview'}
                    </button>
                  </div>
                  <textarea
                    value={editedHtml}
                    onChange={e => setEditedHtml(e.target.value)}
                    rows={5}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-xs focus:border-indigo-400 focus:outline-none"
                  />
                </div>

                {/* HTML preview */}
                {showEmailPreview && editedHtml && (
                  <div>
                    <p className="mb-1 text-xs font-medium uppercase tracking-wider text-gray-500">Preview</p>
                    <iframe
                      srcDoc={editedHtml}
                      title="Email preview"
                      sandbox="allow-same-origin"
                      className="h-72 w-full rounded-lg border border-gray-200"
                    />
                  </div>
                )}

                {reminderResult && (
                  <div className={`rounded-lg px-4 py-2 text-sm ${reminderResult.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                    {reminderResult.ok ? 'Email sent successfully!' : `Error: ${reminderResult.error}`}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 border-t border-gray-100 px-6 py-4">
                <button
                  onClick={() => { setReminderRow(null); setReminderResult(null) }}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSend}
                  disabled={sendingReminder || !editedSubject || !editedHtml || reminderResult?.ok}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {sendingReminder ? 'Sending…' : reminderResult?.ok ? 'Sent ✓' : 'Send Email'}
                </button>
              </div>
            </div>
          </div>
        )
      })()}
      {caloriesHistoryRow && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-10">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
            <div className="border-b border-gray-100 px-6 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Calorie History</h3>
                  <p className="text-xs text-gray-500">{caloriesHistoryRow.name} · {caloriesHistoryRow.email}</p>
                </div>
                <button
                  onClick={() => setCaloriesHistoryRow(null)}
                  className="text-gray-400 hover:text-gray-600"
                >✕</button>
              </div>
            </div>

            <div className="px-6 py-4">
              {caloriesHistoryLoading && (
                <div className="flex items-center justify-center py-8">
                  <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-teal-600" />
                </div>
              )}
              {caloriesHistoryError && (
                <p className="text-sm text-red-600">{caloriesHistoryError}</p>
              )}
              {!caloriesHistoryLoading && !caloriesHistoryError && caloriesHistoryData.length === 0 && (
                <p className="py-4 text-center text-sm text-gray-500">No calorie history found.</p>
              )}
              {!caloriesHistoryLoading && caloriesHistoryData.length > 0 && (
                <div className="max-h-96 overflow-y-auto">
                  <table className="min-w-full divide-y divide-gray-100">
                    <thead className="sticky top-0 bg-white">
                      <tr>
                        <th className="py-2 pr-4 text-left">
                          <button
                            onClick={() => setCaloriesHistorySort(s => s === 'desc' ? 'asc' : 'desc')}
                            className="inline-flex items-center gap-1 text-xs font-medium uppercase tracking-wider text-gray-500 hover:text-gray-700"
                          >
                            Date
                            <span className="text-[10px] text-teal-600">{caloriesHistorySort === 'desc' ? '↓' : '↑'}</span>
                          </button>
                        </th>
                        <th className="py-2 pr-4 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Consumed</th>
                        <th className="py-2 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Goal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {[...caloriesHistoryData].sort((a, b) => {
                        const diff = new Date(b.dateApplied) - new Date(a.dateApplied)
                        return caloriesHistorySort === 'desc' ? diff : -diff
                      }).map((entry, i) => {
                        const consumed = Number(entry.caloriesConsumed || 0)
                        const goal = Number(entry.caloriesGoal || 0)
                        const pct = goal > 0 ? Math.min(100, Math.round((consumed / goal) * 100)) : null
                        return (
                          <tr key={entry.dateApplied || i} className="hover:bg-gray-50">
                            <td className="py-2 pr-4 text-sm text-gray-900">
                              {entry.dateApplied ? new Date(entry.dateApplied).toLocaleDateString() : '—'}
                            </td>
                            <td className="py-2 pr-4 text-right">
                              <span className={`text-sm font-medium ${consumed > 0 ? 'text-gray-900' : 'text-gray-400'}`}>
                                {consumed > 0 ? consumed.toLocaleString() : '—'}
                              </span>
                              {consumed > 0 && <span className="ml-1 text-xs text-gray-400">kcal</span>}
                            </td>
                            <td className="py-2 text-right">
                              {goal > 0 ? (
                                <span className={`inline-flex items-center gap-1 text-sm ${
                                  pct >= 90 ? 'text-green-600' : pct >= 60 ? 'text-yellow-600' : 'text-red-500'
                                }`}>
                                  {goal.toLocaleString()}
                                  <span className="text-xs text-gray-400">({pct}%)</span>
                                </span>
                              ) : (
                                <span className="text-sm text-gray-400">—</span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="flex justify-end border-t border-gray-100 px-6 py-4">
              <button
                onClick={() => setCaloriesHistoryRow(null)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Users
