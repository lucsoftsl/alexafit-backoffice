import { useState, useEffect, useCallback } from 'react'
import {
  XMarkIcon,
  CalendarIcon,
  ChartBarIcon,
  ClockIcon,
  FireIcon,
  BeakerIcon,
  ScaleIcon,
  BellIcon,
  ChatBubbleLeftRightIcon,
  PaperAirplaneIcon,
  PencilIcon,
  TrashIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline'
import {
  fetchUserDailyNutrition,
  sendPushNotification,
  getUserMessages,
  sendMessageToUser,
  updateMessage,
  deleteMessage,
  sendPushNotificationToUser
} from '../services/api'

const UserDetailModal = ({ isOpen, onClose, user, fromPage }) => {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [nutritionData, setNutritionData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [sendingNotification, setSendingNotification] = useState(false)
  const [notificationMessage, setNotificationMessage] = useState('')

  // Messaging state
  const [messages, setMessages] = useState([])
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [messageError, setMessageError] = useState(null)
  const [messagesExpanded, setMessagesExpanded] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(5)
  const [sortField, setSortField] = useState('dateTimeUpdated')
  const [sortDirection, setSortDirection] = useState('desc')
  const [newMessage, setNewMessage] = useState('')
  const [sendingMessage, setSendingMessage] = useState(false)
  const [editingMessageId, setEditingMessageId] = useState(null)
  const [editingMessageText, setEditingMessageText] = useState('')
  const [showPushNotificationPopup, setShowPushNotificationPopup] = useState(false)
  const [lastSentMessage, setLastSentMessage] = useState('')
  const [notificationTitle, setNotificationTitle] = useState('You received a new message')
  const [notificationBody, setNotificationBody] = useState('')
  const [sendingPushNotification, setSendingPushNotification] = useState(false)

  // Debug logging
  console.log('UserDetailModal rendered with:', { isOpen, user: user?.userId, userData: user })

  const loadNutritionData = useCallback(async () => {
    if (!user?.userId) {
      console.error('No user ID available')
      return
    }

    try {
      setLoading(true)
      setError(null)
      console.log('Loading nutrition data for user:', user.userId, 'date:', selectedDate)
      const data = await fetchUserDailyNutrition(user.userId, selectedDate)
      setNutritionData(data)
    } catch (err) {
      setError('Failed to load nutrition data')
      console.error('Error loading nutrition data:', err)
    } finally {
      setLoading(false)
    }
  }, [user?.userId, selectedDate])

  const handleSendNotification = async () => {
    if (!user?.loginDetails?.pushNotificationToken) {
      alert('No push notification token available for this user')
      return
    }

    if (!notificationMessage.trim()) {
      alert('Please enter a notification message')
      return
    }

    if (!nutritionData) {
      alert('No nutrition data available')
      return
    }

    try {
      setSendingNotification(true)

      // Use the already calculated values from the component
      const goalsForScore = nutritionData.goalNutrients?.userGoals || {}

      const notificationTitle = `Scorul tău zilnic: ${dailyScore}%`
      const notificationBody = `${notificationMessage}\n\nCalorii: ${actualTotals.totalCalories.toFixed(0)}/${goalsForScore.totalCalories || 0}\nProteine: ${actualTotals.totalProtein.toFixed(1)}g/${goalsForScore.proteinsInGrams || 0}g`

      await sendPushNotification(
        user.loginDetails.pushNotificationToken,
        notificationTitle,
        notificationBody
      )

      alert('Notification sent successfully!')
      setNotificationMessage('')
    } catch (err) {
      console.error('Error sending notification:', err)
      alert('Failed to send notification. Please try again.')
    } finally {
      setSendingNotification(false)
    }
  }

  // Load messages (with cache)
  const loadMessages = useCallback(async () => {
    if (!user?.userId) return

    try {
      // Check if data exists in localStorage first
      const cacheKey = `userMessages_${user.userId}`
      const cachedData = localStorage.getItem(cacheKey)
      if (cachedData) {
        const data = JSON.parse(cachedData)
        const messagesArray = Array.isArray(data) ? data : (data?.data || data?.messages || [])
        setMessages(messagesArray)
        return
      }

      setLoadingMessages(true)
      setMessageError(null)
      const data = await getUserMessages({ userId: user.userId })
      // Assume data is an array or data.data is the array
      const messagesArray = Array.isArray(data) ? data : (data?.data || data?.messages || [])
      setMessages(messagesArray)
      // Cache the data
      localStorage.setItem(cacheKey, JSON.stringify(data))
    } catch (err) {
      setMessageError('Failed to load messages')
      console.error('Error loading messages:', err)
    } finally {
      setLoadingMessages(false)
    }
  }, [user?.userId])

  // Refresh messages (clear cache and reload)
  const refreshMessages = useCallback(async () => {
    if (!user?.userId) return

    try {
      const cacheKey = `userMessages_${user.userId}`
      localStorage.removeItem(cacheKey)
      setLoadingMessages(true)
      setMessageError(null)
      const data = await getUserMessages({ userId: user.userId })
      const messagesArray = Array.isArray(data) ? data : (data?.data || data?.messages || [])
      setMessages(messagesArray)
      // Cache the refreshed data
      localStorage.setItem(cacheKey, JSON.stringify(data))
      setCurrentPage(1) // Reset to first page after refresh
    } catch (err) {
      setMessageError('Failed to refresh messages')
      console.error('Error refreshing messages:', err)
    } finally {
      setLoadingMessages(false)
    }
  }, [user?.userId])

  // Send message
  const handleSendMessage = async () => {
    if (!user?.userId || !newMessage.trim()) {
      alert('Please enter a message')
      return
    }

    try {
      setSendingMessage(true)
      const messageText = newMessage.trim()
      await sendMessageToUser({ userId: user.userId, message: messageText })
      // Store the sent message and show push notification popup
      setLastSentMessage(messageText)
      setNotificationTitle('You received a new message')
      setNotificationBody(messageText)
      setNewMessage('')
      // wait for 1.5 seconds
      await new Promise(resolve => setTimeout(resolve, 1500))
      await refreshMessages() // Refresh messages (clear cache and reload)
      setShowPushNotificationPopup(true) // Show popup after message is sent
    } catch (err) {
      console.error('Error sending message:', err)
      alert('Failed to send message. Please try again.')
    } finally {
      setSendingMessage(false)
    }
  }

  // Send push notification
  const handleSendPushNotification = async () => {
    if (!user?.pushNotificationToken) {
      alert('No push notification token available for this user')
      return
    }

    // Check if user has rejected push notifications
    if (user?.isPushNotificationTokenEnabled === false) {
      const confirmed = window.confirm(
        'Are you sure you want to send a push notification to this user? They have rejected push notifications from their app.'
      )
      if (!confirmed) {
        return
      }
    }

    if (!notificationTitle.trim() || !notificationBody.trim()) {
      alert('Please enter both notification title and body')
      return
    }

    try {
      setSendingPushNotification(true)
      await sendPushNotificationToUser({
        pushNotificationToken: user.pushNotificationToken,
        notificationTitle: notificationTitle.trim(),
        notificationBody: notificationBody.trim()
      })
      alert('Push notification sent successfully!')
      setShowPushNotificationPopup(false)
      setNotificationTitle('You received a new message')
      setNotificationBody('')
    } catch (err) {
      console.error('Error sending push notification:', err)
      alert('Failed to send push notification. Please try again.')
    } finally {
      setSendingPushNotification(false)
    }
  }

  // Update message
  const handleUpdateMessage = async (messageId) => {
    if (!editingMessageText.trim()) {
      alert('Please enter a message')
      return
    }

    try {
      await updateMessage({ messageId, message: editingMessageText.trim() })
      setEditingMessageId(null)
      setEditingMessageText('')
      await new Promise(resolve => setTimeout(resolve, 1500))
      await refreshMessages() // Refresh messages (clear cache and reload)
      alert('Message updated successfully!')
    } catch (err) {
      console.error('Error updating message:', err)
      alert('Failed to update message. Please try again.')
    }
  }

  // Delete message
  const handleDeleteMessage = async (messageId) => {
    if (!window.confirm('Are you sure you want to delete this message?')) {
      return
    }

    try {
      await deleteMessage({ messageId })
      await new Promise(resolve => setTimeout(resolve, 1500))
      await refreshMessages() // Refresh messages (clear cache and reload)
      alert('Message deleted successfully!')
    } catch (err) {
      console.error('Error deleting message:', err)
      alert('Failed to delete message. Please try again.')
    }
  }

  // Toggle sort
  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  // Format date
  const formatDateTime = (dateString) => {
    if (!dateString) return 'N/A'
    try {
      const date = new Date(dateString)
      return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch (e) {
      return dateString
    }
  }

  useEffect(() => {
    if (isOpen && user && fromPage !== 'unapprovedItems') {
      loadNutritionData()
    }
  }, [isOpen, user, selectedDate, loadNutritionData, fromPage])

  // Load messages when modal opens and messages accordion is expanded
  useEffect(() => {
    if (isOpen && user?.userId && messagesExpanded) {
      loadMessages()
    }
  }, [isOpen, user?.userId, messagesExpanded, loadMessages])

  const formatNutritionValue = (value) => {
    if (value === null || value === undefined) return 'N/A'
    return typeof value === 'number' ? value.toFixed(1) : value
  }

  const getMealIcon = (mealType) => {
    switch (mealType.toLowerCase()) {
      case 'breakfast': return '🌅'
      case 'lunch': return '☀️'
      case 'dinner': return '🌙'
      case 'snack': return '🍎'
      case 'water': return '💧'
      default: return '🍽️'
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {user?.name || 'User Details'}
            </h2>
            <p className="text-gray-600 mt-1">User ID: {user?.userId}</p>

            {fromPage === 'unapprovedItems' && <>
              <p className="text-gray-600 mt-1">Status: {user?.status}</p>
              <p className="text-gray-600 mt-1">Name: {user?.loginDetails?.displayName || user?.userData?.name}</p>
              <p className="text-gray-600 mt-1">Email: {user?.loginDetails?.providerData[0]?.email || user?.loginDetails?.email || user?.userData?.email}</p>
              <p className="text-gray-600 mt-1">ProviderId: {user?.loginDetails?.providerData[0]?.providerId || user?.loginDetails?.providerId}</p>
            </>}
          </div>
          <button
            onClick={() => {
              setMessages([])
              setCurrentPage(1)
              setMessagesExpanded(false)
              setSelectedDate(new Date().toISOString().split('T')[0])
              setNewMessage('')
              setEditingMessageId(null)
              setEditingMessageText('')
              setSendingMessage(false)
              setSendingNotification(false)
              onClose()
            }}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {/* Date Selector */}
          {fromPage !== 'unapprovedItems' && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Date
              </label>
              <div className="flex items-center space-x-4">
                <CalendarIcon className="w-5 h-5 text-gray-400" />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>)}

          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              <span className="ml-4 text-gray-600">Loading nutrition data...</span>
            </div>
          )}

          {/* Error State */}
          {error && fromPage !== 'unapprovedItems' && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800">{error}</p>
            </div>
          )}

          {/* Nutrition Data */}
          {nutritionData && !loading && (() => {
            // Sum up the individual food items that are already calculated correctly
            const calculateActualTotals = () => {
              let totals = {
                totalCalories: 0,
                totalProtein: 0,
                totalCarbs: 0,
                totalFat: 0,
                totalFiber: 0,
                totalSugar: 0
              }

              if (nutritionData?.userItems) {
                Object.entries(nutritionData.userItems).forEach(([, items]) => {
                  if (!items || !Array.isArray(items)) return

                  items.forEach(item => {
                    // Debug: Log the raw item data
                    console.log('Raw item data:', {
                      quantity: item.quantity,
                      unit: item.unit,
                      foodName: item.food?.name
                    })

                    // Extract quantity and unit from the string
                    const quantityStr = item.quantity || '0'
                    const unitStr = item.unit || 'g'

                    // Parse quantity more carefully
                    let quantity = 0
                    if (typeof quantityStr === 'string') {
                      // Extract just the number part (e.g., "130Grame" -> "130")
                      const numberMatch = quantityStr.match(/(\d+(?:\.\d+)?)/)
                      quantity = numberMatch ? parseFloat(numberMatch[1]) : 0
                    } else if (typeof quantityStr === 'number') {
                      quantity = quantityStr
                    }

                    const unit = unitStr.toLowerCase()

                    // Convert to grams based on unit type
                    let quantityInGrams = quantity

                    // Handle serving units that contain gram amounts in parentheses
                    if (unitStr.includes('(') && unitStr.includes('g)')) {
                      // Extract serving amount from unit like "Lingurita rasa (5g)" or "Portie (108.0g)"
                      const servingMatch = unitStr.match(/\((\d+(?:\.\d+)?)g\)/)
                      if (servingMatch) {
                        const servingAmount = parseFloat(servingMatch[1])
                        quantityInGrams = quantity * servingAmount
                      }
                    } else if (unit.includes('mililitri') || unit.includes('ml')) {
                      quantityInGrams = quantity // Assume 1ml = 1g for liquids
                    } else if (unit.includes('litri') || unit.includes('l')) {
                      quantityInGrams = quantity * 1000
                    }

                    const multiplier = quantityInGrams / 100

                    const nutrients = item.food?.totalNutrients || {}

                    // Use the same calculation as individual items
                    console.log(`Item: ${item.food?.name}, Raw: "${quantityStr}", Parsed: ${quantity}, Unit: ${unit}, Multiplier: ${multiplier.toFixed(2)}`)
                    console.log(`Protein per 100g: ${nutrients.proteinsInGrams}, Actual: ${(nutrients.proteinsInGrams || 0) * multiplier}`)

                    // Calculate actual calories consumed
                    let actualCalories = 0
                    if (item.food?.type === 'recipe') {
                      // Quantity is total grams eaten; recipe totals are for all servings
                      const totalRecipeCalories = item.food?.totalCalories || 0
                      const numberOfServings = item.food?.numberOfServings || 1
                      let gramsPerServing
                      if (Array.isArray(item.food?.serving)) {
                        const portie = item.food.serving.find(s => s.profileId === 1)
                        const grams = item.food.serving.find(s => s.profileId === 0 || s.innerName?.toLowerCase() === 'grame')
                        gramsPerServing = portie?.amount || grams?.amount || undefined
                      } else if (item.food?.servings?.amount) {
                        gramsPerServing = item.food.servings.amount
                      }
                      const totalRecipeWeight = gramsPerServing && numberOfServings ? (gramsPerServing * numberOfServings) : undefined
                      if (totalRecipeWeight && totalRecipeWeight > 0) {
                        const caloriesPerGram = totalRecipeCalories / totalRecipeWeight
                        actualCalories = caloriesPerGram * quantity
                      } else {
                        // Fallback to per-serving if weight unknown
                        const caloriesPerServing = numberOfServings > 0 ? (totalRecipeCalories / numberOfServings) : 0
                        actualCalories = caloriesPerServing * quantity
                      }
                    } else if (item.food?.type === 'food') {
                      // For foods, quantity is already in grams, totalCalories is per 100g
                      const caloriesPer100g = item.food?.totalCalories || item.calories || 0
                      actualCalories = (caloriesPer100g / 100) * quantity
                    } else {
                      // Fallback for other types
                      const caloriesPer100g = item.food?.totalCalories || item.calories || 0
                      actualCalories = caloriesPer100g * multiplier
                    }
                    totals.totalCalories += actualCalories

                    // Calculate nutrients based on food type
                    if (item.food?.type === 'food') {
                      // For foods, quantity is already in grams, nutrients are per 100g
                      const nutrientMultiplier = quantity / 100
                      totals.totalProtein += (nutrients.proteinsInGrams || 0) * nutrientMultiplier
                      totals.totalCarbs += (nutrients.carbohydratesInGrams || 0) * nutrientMultiplier
                      totals.totalFat += (nutrients.fatInGrams || 0) * nutrientMultiplier
                      totals.totalFiber += (nutrients.fibreInGrams || 0) * nutrientMultiplier
                      totals.totalSugar += (nutrients.sugarsInGrams || 0) * nutrientMultiplier
                    } else if (item.food?.type === 'recipe') {
                      // Recipe nutrients are totals for entire recipe; scale by grams eaten / total weight
                      let gramsPerServing
                      const numberOfServings = item.food?.numberOfServings || 1
                      if (Array.isArray(item.food?.serving)) {
                        const portie = item.food.serving.find(s => s.profileId === 1)
                        const grams = item.food.serving.find(s => s.profileId === 0 || s.innerName?.toLowerCase() === 'grame')
                        gramsPerServing = portie?.amount || grams?.amount || undefined
                      } else if (item.food?.servings?.amount) {
                        gramsPerServing = item.food.servings.amount
                      }
                      const totalRecipeWeight = gramsPerServing && numberOfServings ? (gramsPerServing * numberOfServings) : undefined
                      if (totalRecipeWeight && totalRecipeWeight > 0) {
                        const ratio = quantity / totalRecipeWeight
                        totals.totalProtein += (nutrients.proteinsInGrams || 0) * ratio
                        totals.totalCarbs += (nutrients.carbohydratesInGrams || 0) * ratio
                        totals.totalFat += (nutrients.fatInGrams || 0) * ratio
                        totals.totalFiber += (nutrients.fibreInGrams || 0) * ratio
                        totals.totalSugar += (nutrients.sugarsInGrams || 0) * ratio
                      }
                    } else {
                      // Other types: assume per-100g
                      totals.totalProtein += (nutrients.proteinsInGrams || 0) * multiplier
                      totals.totalCarbs += (nutrients.carbohydratesInGrams || 0) * multiplier
                      totals.totalFat += (nutrients.fatInGrams || 0) * multiplier
                      totals.totalFiber += (nutrients.fibreInGrams || 0) * multiplier
                      totals.totalSugar += (nutrients.sugarsInGrams || 0) * multiplier
                    }
                  })
                })
              }

              console.log('Final calculated totals:', totals)
              return totals
            }

            const actualTotals = calculateActualTotals()

            // Compute completion flags and daily score with completion bonus
            const goalsForScore = nutritionData.goalNutrients?.userGoals || {}
            const clamp = (value, min, max) => Math.max(min, Math.min(max, value))

            // Parse goals as numbers (defensive against strings/null)
            const gProtein = parseFloat(goalsForScore.proteinsInGrams) || 0
            const gCalories = parseFloat(goalsForScore.totalCalories) || 0
            const gCarbs = parseFloat(goalsForScore.carbohydratesInGrams) || 0
            const gFat = parseFloat(goalsForScore.fatInGrams) || 0

            const proteinTarget = gProtein > 0 ? gProtein * 0.9 : 0
            const caloriesTarget = gCalories > 0 ? gCalories * 0.8 : 0
            const carbsTarget = gCarbs > 0 ? gCarbs * 0.9 : 0
            const fatTarget = gFat > 0 ? gFat * 0.9 : 0

            const proteinDone = proteinTarget > 0 && actualTotals.totalProtein >= proteinTarget
            const caloriesDone = caloriesTarget > 0 && actualTotals.totalCalories >= caloriesTarget
            const carbsDone = carbsTarget > 0 && actualTotals.totalCarbs >= carbsTarget
            const fatDone = fatTarget > 0 && actualTotals.totalFat >= fatTarget

            const computeDailyScore = () => {
              let score = 0

              if (goalsForScore.proteinsInGrams > 0) {
                const target = proteinTarget
                const achieved = actualTotals.totalProtein
                const pct = achieved >= target ? 1 : (target > 0 ? achieved / target : 0)
                score += clamp(pct, 0, 1) * 30
              }

              if (goalsForScore.totalCalories > 0) {
                const target = caloriesTarget
                const achieved = actualTotals.totalCalories
                const pct = achieved >= target ? 1 : (target > 0 ? achieved / target : 0)
                score += clamp(pct, 0, 1) * 30
              }

              if (goalsForScore.carbohydratesInGrams > 0) {
                const target = carbsTarget
                const achieved = actualTotals.totalCarbs
                const pct = achieved >= target ? 1 : (target > 0 ? achieved / target : 0)
                score += clamp(pct, 0, 1) * 20
              }

              if (goalsForScore.fatInGrams > 0) {
                const target = fatTarget
                const achieved = actualTotals.totalFat
                const pct = achieved >= target ? 1 : (target > 0 ? achieved / target : 0)
                score += clamp(pct, 0, 1) * 20
              }

              // Completion bonus: 5% per completed category, capped at 20%
              const completedCount = [proteinDone, caloriesDone, carbsDone, fatDone].filter(Boolean).length
              const bonus = Math.min(completedCount * 5, 20)
              score += bonus

              // Fallbacks: if no valid goals were provided but there is activity, derive a score
              const hasAnyGoal = gProtein > 0 || gCalories > 0 || gCarbs > 0 || gFat > 0
              const consumedSomething = (actualTotals.totalCalories || 0) > 0 || (actualTotals.totalProtein || 0) > 0
              if (!hasAnyGoal) {
                if (typeof nutritionData.percentageOfGoal === 'number' && nutritionData.percentageOfGoal > 0) {
                  return Math.round(nutritionData.percentageOfGoal)
                }
                if (consumedSomething) {
                  // Heuristic fallback: scale by 2000 kcal baseline cap at 100
                  const heuristic = clamp((actualTotals.totalCalories / 2000) * 100, 5, 100)
                  return Math.round(heuristic)
                }
              }

              // Ensure non-zero if at least one category completed
              if (score === 0 && completedCount > 0) {
                score = bonus
              }

              return Math.round(score)
            }
            const dailyScore = computeDailyScore()
            return (
              <div className="space-y-6">
                {/* Daily Summary */}
                <div className="card p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <ChartBarIcon className="w-5 h-5 mr-2" />
                    Daily Summary (Actual Consumed)
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">
                        {formatNutritionValue(actualTotals.totalCalories)}
                      </div>
                      <div className="text-sm text-gray-600">Total Calories</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">
                        {formatNutritionValue(actualTotals.totalProtein)}g
                      </div>
                      <div className="text-sm text-gray-600">Protein</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-yellow-600">
                        {formatNutritionValue(actualTotals.totalCarbs)}g
                      </div>
                      <div className="text-sm text-gray-600">Carbs</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-purple-600">
                        {formatNutritionValue(actualTotals.totalFat)}g
                      </div>
                      <div className="text-sm text-gray-600">Fat</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-red-600">
                        {formatNutritionValue(nutritionData.totalCalories || 0)}
                      </div>
                      <div className="text-sm text-gray-600">API Total Calories</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-emerald-600">
                        {dailyScore}%
                      </div>
                      <div className="text-sm text-gray-600">Daily Score</div>
                    </div>
                  </div>
                  {/* Completion badges */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    {proteinTarget > 0 && (
                      <span className={`px-2 py-1 rounded-full text-xs ${proteinDone ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                        Protein {proteinDone ? 'Completed' : 'Pending'}
                      </span>
                    )}
                    {caloriesTarget > 0 && (
                      <span className={`px-2 py-1 rounded-full text-xs ${caloriesDone ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                        Calories {caloriesDone ? 'Completed' : 'Pending'}
                      </span>
                    )}
                    {carbsTarget > 0 && (
                      <span className={`px-2 py-1 rounded-full text-xs ${carbsDone ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                        Carbs {carbsDone ? 'Completed' : 'Pending'}
                      </span>
                    )}
                    {fatTarget > 0 && (
                      <span className={`px-2 py-1 rounded-full text-xs ${fatDone ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                        Fat {fatDone ? 'Completed' : 'Pending'}
                      </span>
                    )}
                  </div>

                  {/* Send Notification Section */}
                  {user?.loginDetails?.pushNotificationToken && (
                    <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                      <h4 className="text-sm font-medium text-blue-900 mb-2 flex items-center">
                        <BellIcon className="w-4 h-4 mr-1" />
                        Send Daily Score Notification
                      </h4>
                      <div className="space-y-2">
                        <textarea
                          value={notificationMessage}
                          onChange={(e) => setNotificationMessage(e.target.value)}
                          placeholder="Enter your motivational message here..."
                          className="w-full p-2 border border-gray-300 rounded-md text-sm resize-none"
                          rows={2}
                        />
                        <button
                          onClick={handleSendNotification}
                          disabled={sendingNotification || !notificationMessage.trim()}
                          className="w-full bg-blue-600 text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center"
                        >
                          {sendingNotification ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                              Sending...
                            </>
                          ) : (
                            <>
                              <BellIcon className="w-4 h-4 mr-1" />
                              Send Notification
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Additional Nutrients */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center">
                      <div className="text-lg font-semibold text-orange-600">
                        {formatNutritionValue(actualTotals.totalFiber)}g
                      </div>
                      <div className="text-sm text-gray-600">Fiber</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-semibold text-pink-600">
                        {formatNutritionValue(actualTotals.totalSugar)}g
                      </div>
                      <div className="text-sm text-gray-600">Sugar</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-semibold text-red-600">
                        {formatNutritionValue(nutritionData.exerciseCalories || 0)}
                      </div>
                      <div className="text-sm text-gray-600">Exercise Calories</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-semibold text-indigo-600">
                        {formatNutritionValue(nutritionData.percentageOfGoal || 0)}%
                      </div>
                      <div className="text-sm text-gray-600">Goal Progress</div>
                    </div>
                  </div>
                </div>

                {/* Goal Nutrients */}
                {nutritionData.goalNutrients && (
                  <div className="card p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                      <ScaleIcon className="w-5 h-5 mr-2" />
                      Health Metrics & Goals
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center">
                        <div className="text-lg font-semibold text-blue-600">
                          {formatNutritionValue(nutritionData.goalNutrients.BMI)}
                        </div>
                        <div className="text-sm text-gray-600">BMI</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-semibold text-green-600">
                          {formatNutritionValue(nutritionData.goalNutrients.BMR)}
                        </div>
                        <div className="text-sm text-gray-600">BMR (Calories)</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-semibold text-yellow-600">
                          {formatNutritionValue(nutritionData.goalNutrients.TDEE)}
                        </div>
                        <div className="text-sm text-gray-600">TDEE (Calories)</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-semibold text-purple-600">
                          {nutritionData.goalNutrients.foodTables || 'N/A'}
                        </div>
                        <div className="text-sm text-gray-600">Food Tables</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* User Goals (Macros and Calories) */}
                {nutritionData.goalNutrients?.userGoals && (
                  <div className="card p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                      <ScaleIcon className="w-5 h-5 mr-2" />
                      User Goals
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center">
                        <div className="text-lg font-semibold text-blue-600">
                          {formatNutritionValue(nutritionData.goalNutrients.userGoals.totalCalories)}
                        </div>
                        <div className="text-sm text-gray-600">Calories Goal</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-semibold text-green-600">
                          {formatNutritionValue(nutritionData.goalNutrients.userGoals.proteinsInGrams)}g
                        </div>
                        <div className="text-sm text-gray-600">Protein Goal</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-semibold text-yellow-600">
                          {formatNutritionValue(nutritionData.goalNutrients.userGoals.carbohydratesInGrams)}g
                        </div>
                        <div className="text-sm text-gray-600">Carbs Goal</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-semibold text-purple-600">
                          {formatNutritionValue(nutritionData.goalNutrients.userGoals.fatInGrams)}g
                        </div>
                        <div className="text-sm text-gray-600">Fat Goal</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-semibold text-orange-600">
                          {formatNutritionValue(nutritionData.goalNutrients.userGoals.fibreInGrams)}g
                        </div>
                        <div className="text-sm text-gray-600">Fiber Goal</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-semibold text-pink-600">
                          {formatNutritionValue(nutritionData.goalNutrients.userGoals.sugarsInGrams)}g
                        </div>
                        <div className="text-sm text-gray-600">Sugar Goal</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Calories Per Meal */}
                {nutritionData.totalCaloriesPerMeal && (
                  <div className="card p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                      <ClockIcon className="w-5 h-5 mr-2" />
                      Calories Per Meal
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {Object.entries(nutritionData.totalCaloriesPerMeal).map(([meal, calories]) => (
                        <div key={meal} className="text-center">
                          <div className="text-lg font-semibold text-blue-600">
                            {formatNutritionValue(calories)}
                          </div>
                          <div className="text-sm text-gray-600 capitalize">{meal}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Food Items by Meal */}
                {nutritionData.userItems && (
                  <div className="card p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                      <BeakerIcon className="w-5 h-5 mr-2" />
                      Food Items
                    </h3>
                    <div className="space-y-6">
                      {Object.entries(nutritionData.userItems).map(([mealType, items]) => {
                        if (!items || !Array.isArray(items) || items.length === 0) return null

                        return (
                          <div key={mealType} className="border border-gray-200 rounded-lg p-4">
                            <h4 className="font-semibold text-gray-900 mb-3 flex items-center">
                              <span className="mr-2">{getMealIcon(mealType)}</span>
                              {mealType.charAt(0).toUpperCase() + mealType.slice(1)}
                            </h4>
                            <div className="space-y-3">
                              {items.map((item, index) => {
                                // Parse quantity more carefully
                                let quantity = 0
                                const quantityStr = item.quantity || '0'
                                if (typeof quantityStr === 'string') {
                                  // Extract just the number part (e.g., "130Grame" -> "130")
                                  const numberMatch = quantityStr.match(/(\d+(?:\.\d+)?)/)
                                  quantity = numberMatch ? parseFloat(numberMatch[1]) : 0
                                } else if (typeof quantityStr === 'number') {
                                  quantity = quantityStr
                                }

                                const unit = item.unit || 'g'
                                const nutrients = item.food?.totalNutrients || {}

                                // Convert to grams based on unit type
                                let quantityInGrams = quantity

                                // Handle serving units that contain gram amounts in parentheses
                                if (unit.includes('(') && unit.includes('g)')) {
                                  // Extract serving amount from unit like "Lingurita rasa (5g)" or "Portie (108.0g)"
                                  const servingMatch = unit.match(/\((\d+(?:\.\d+)?)g\)/)
                                  if (servingMatch) {
                                    const servingAmount = parseFloat(servingMatch[1])
                                    quantityInGrams = quantity * servingAmount
                                  }
                                } else if (unit.includes('mililitri') || unit.includes('ml')) {
                                  quantityInGrams = quantity // Assume 1ml = 1g for liquids
                                } else if (unit.includes('litri') || unit.includes('l')) {
                                  quantityInGrams = quantity * 1000
                                }

                                const multiplier = quantityInGrams / 100

                                // Calculate nutrients based on food type
                                let protein, carbs, fat, fiber, sugar
                                if (item.food?.type === 'food') {
                                  // For foods, quantity is already in grams, nutrients are per 100g
                                  const nutrientMultiplier = quantity / 100
                                  protein = (nutrients.proteinsInGrams || 0) * nutrientMultiplier
                                  carbs = (nutrients.carbohydratesInGrams || 0) * nutrientMultiplier
                                  fat = (nutrients.fatInGrams || 0) * nutrientMultiplier
                                  fiber = (nutrients.fibreInGrams || 0) * nutrientMultiplier
                                  sugar = (nutrients.sugarsInGrams || 0) * nutrientMultiplier
                                } else {
                                  // For recipes and other types, use the calculated multiplier
                                  protein = (nutrients.proteinsInGrams || 0) * multiplier
                                  carbs = (nutrients.carbohydratesInGrams || 0) * multiplier
                                  fat = (nutrients.fatInGrams || 0) * multiplier
                                  fiber = (nutrients.fibreInGrams || 0) * multiplier
                                  sugar = (nutrients.sugarsInGrams || 0) * multiplier
                                }

                                // Calculate actual calories consumed
                                let actualCalories = 0
                                if (item.food?.type === 'recipe') {
                                  // For recipes, totalCalories is for all portions, so divide by numberOfServings first
                                  const totalRecipeCalories = item.food?.totalCalories || 0
                                  const numberOfServings = item.food?.numberOfServings || 1
                                  const caloriesPerServing = totalRecipeCalories / numberOfServings
                                  actualCalories = caloriesPerServing * quantity
                                } else if (item.food?.type === 'food') {
                                  // For foods, quantity is already in grams, totalCalories is per 100g
                                  const caloriesPer100g = item.food?.totalCalories || item.calories || 0
                                  actualCalories = (caloriesPer100g / 100) * quantity
                                } else {
                                  // Fallback for other types
                                  const caloriesPer100g = item.food?.totalCalories || item.calories || 0
                                  actualCalories = caloriesPer100g * multiplier
                                }

                                return (
                                  <div key={index} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                                    <div className="flex-1">
                                      <div className="font-medium text-gray-900">
                                        {item.food?.name || 'Unknown Food'}
                                      </div>
                                      <div className="text-sm text-gray-600">
                                        {quantity} {unit} • <span className="font-semibold text-blue-600">{actualCalories.toFixed(0)} cal</span>
                                        {item.food?.category && ` • ${item.food.category}`}
                                      </div>
                                    </div>
                                    <div className="text-right text-sm">
                                      <div className="text-gray-600 font-medium">
                                        Per 100g: P: {nutrients.proteinsInGrams || 0}g • C: {nutrients.carbohydratesInGrams || 0}g • F: {nutrients.fatInGrams || 0}g
                                      </div>
                                      <div className="text-xs text-gray-500 mt-1">
                                        Fiber: {nutrients.fibreInGrams || 0}g • Sugar: {nutrients.sugarsInGrams || 0}g
                                      </div>
                                      <div className="text-right text-sm">
                                        <div className="text-gray-600 font-medium">
                                          Actual: P: {protein.toFixed(1)}g • C: {carbs.toFixed(1)}g • F: {fat.toFixed(1)}g
                                        </div>
                                        {(fiber > 0 || sugar > 0) && (
                                          <div className="text-xs text-gray-500 mt-1">
                                            Fiber: {fiber.toFixed(1)}g • Sugar: {sugar.toFixed(1)}g
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Messaging System */}
                <div className="card p-6">
                  <div className="flex items-center justify-between mb-4">
                    <button
                      onClick={() => setMessagesExpanded(!messagesExpanded)}
                      className="flex items-center justify-between text-left flex-1"
                    >
                      <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                        <ChatBubbleLeftRightIcon className="w-5 h-5 mr-2" />
                        Messages
                      </h3>
                      {messagesExpanded ? (
                        <ChevronUpIcon className="w-5 h-5 text-gray-500" />
                      ) : (
                        <ChevronDownIcon className="w-5 h-5 text-gray-500" />
                      )}
                    </button>
                    {messagesExpanded && (
                      <button
                        onClick={refreshMessages}
                        disabled={loadingMessages}
                        className="btn-secondary text-sm ml-4 flex items-center gap-2"
                      >
                        <ArrowPathIcon className={`w-4 h-4 ${loadingMessages ? 'animate-spin' : ''}`} />
                        {loadingMessages ? 'Refreshing...' : 'Refresh'}
                      </button>
                    )}
                  </div>

                  {messagesExpanded && (
                    <div className="mt-4 space-y-4">
                      {/* Send Message Form */}
                      <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                        <h4 className="text-sm font-medium text-gray-900 mb-2">Send New Message</h4>
                        <div className="flex gap-2">
                          <textarea
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            placeholder="Enter your message..."
                            className="flex-1 p-2 border border-gray-300 rounded-md text-sm resize-none"
                            rows={2}
                          />
                          <button
                            onClick={handleSendMessage}
                            disabled={sendingMessage || !newMessage.trim()}
                            className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
                          >
                            {sendingMessage ? (
                              <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                Sending...
                              </>
                            ) : (
                              <>
                                <PaperAirplaneIcon className="w-4 h-4" />
                                Send
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Messages Table */}
                      {loadingMessages ? (
                        <div className="flex items-center justify-center py-8">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                          <span className="ml-3 text-gray-600">Loading messages...</span>
                        </div>
                      ) : messageError ? (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                          <p className="text-red-800">{messageError}</p>
                        </div>
                      ) : (
                        <>
                          {/* Sort and Pagination Controls */}
                          <div className="flex items-center justify-between flex-wrap gap-4">
                            <div className="flex items-center gap-2">
                              <label className="text-sm text-gray-700">Items per page:</label>
                              <select
                                value={itemsPerPage}
                                onChange={(e) => {
                                  setItemsPerPage(Number(e.target.value))
                                  setCurrentPage(1)
                                }}
                                className="border border-gray-300 rounded-md px-2 py-1 text-sm"
                              >
                                <option value={3}>3</option>
                                <option value={5}>5</option>
                                <option value={10}>10</option>
                              </select>
                            </div>
                          </div>

                          {/* Messages Table */}
                          {messages.length === 0 ? (
                            <div className="text-center py-8 text-gray-500">
                              No messages found.
                            </div>
                          ) : (
                            <>
                              {/* Table */}
                              <div className="overflow-x-auto border border-gray-200 rounded-lg">
                                <table className="min-w-full divide-y divide-gray-200">
                                  <thead className="bg-gray-50">
                                    <tr>
                                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Message
                                      </th>
                                      <th
                                        className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                        onClick={() => handleSort('dateTimeUpdated')}
                                      >
                                        <div className="flex items-center gap-1">
                                          Date/Time
                                          {sortField === 'dateTimeUpdated' && (
                                            sortDirection === 'asc' ? '↑' : '↓'
                                          )}
                                        </div>
                                      </th>
                                      <th
                                        className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                        onClick={() => handleSort('isRead')}
                                      >
                                        <div className="flex items-center gap-1">
                                          Read Status
                                          {sortField === 'isRead' && (
                                            sortDirection === 'asc' ? '↑' : '↓'
                                          )}
                                        </div>
                                      </th>
                                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Actions
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody className="bg-white divide-y divide-gray-200">
                                    {(() => {
                                      // Sort messages
                                      const sortedMessages = [...messages].sort((a, b) => {
                                        let aVal, bVal
                                        if (sortField === 'dateTimeUpdated') {
                                          aVal = new Date(a.dateTimeUpdated || 0).getTime()
                                          bVal = new Date(b.dateTimeUpdated || 0).getTime()
                                        } else if (sortField === 'isRead') {
                                          aVal = a.isRead ? 1 : 0
                                          bVal = b.isRead ? 1 : 0
                                        } else {
                                          return 0
                                        }
                                        if (sortDirection === 'asc') {
                                          return aVal > bVal ? 1 : -1
                                        } else {
                                          return aVal < bVal ? 1 : -1
                                        }
                                      })

                                      // Paginate messages
                                      const startIndex = (currentPage - 1) * itemsPerPage
                                      const endIndex = startIndex + itemsPerPage
                                      const paginatedMessages = sortedMessages.slice(startIndex, endIndex)

                                      return paginatedMessages.map((msg) => (
                                        <tr key={msg.id} className="hover:bg-gray-50">
                                          <td className="px-4 py-3">
                                            {editingMessageId === msg.id ? (
                                              <div className="flex items-center gap-2">
                                                <textarea
                                                  value={editingMessageText}
                                                  onChange={(e) => setEditingMessageText(e.target.value)}
                                                  className="flex-1 p-2 border border-gray-300 rounded-md text-sm resize-none"
                                                  rows={2}
                                                />
                                                <div className="flex flex-col gap-1">
                                                  <button
                                                    onClick={() => handleUpdateMessage(msg.id)}
                                                    className="px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700"
                                                  >
                                                    Save
                                                  </button>
                                                  <button
                                                    onClick={() => {
                                                      setEditingMessageId(null)
                                                      setEditingMessageText('')
                                                    }}
                                                    className="px-2 py-1 bg-gray-500 text-white text-xs rounded hover:bg-gray-600"
                                                  >
                                                    Cancel
                                                  </button>
                                                </div>
                                              </div>
                                            ) : (
                                              <div className="text-sm text-gray-900 max-w-md break-words">
                                                {msg.message}
                                              </div>
                                            )}
                                          </td>
                                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                                            {formatDateTime(msg.dateTimeUpdated)}
                                          </td>
                                          <td className="px-4 py-3 whitespace-nowrap">
                                            <span
                                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${msg.isRead
                                                ? 'bg-green-100 text-green-800'
                                                : 'bg-yellow-100 text-yellow-800'
                                                }`}
                                            >
                                              {msg.isRead ? 'Read' : 'Unread'}
                                            </span>
                                          </td>
                                          <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                                            {editingMessageId === msg.id ? null : (
                                              <div className="flex items-center justify-end gap-2">
                                                <button
                                                  onClick={() => {
                                                    setEditingMessageId(msg.id)
                                                    setEditingMessageText(msg.message)
                                                  }}
                                                  className="text-blue-600 hover:text-blue-900"
                                                  title="Edit message"
                                                >
                                                  <PencilIcon className="w-4 h-4" />
                                                </button>
                                                <button
                                                  onClick={() => handleDeleteMessage(msg.id)}
                                                  className="text-red-600 hover:text-red-900"
                                                  title="Delete message"
                                                >
                                                  <TrashIcon className="w-4 h-4" />
                                                </button>
                                              </div>
                                            )}
                                          </td>
                                        </tr>
                                      ))
                                    })()}
                                  </tbody>
                                </table>
                              </div>

                              {/* Pagination */}
                              {(() => {
                                const totalPages = Math.ceil(messages.length / itemsPerPage)
                                if (totalPages <= 1) return null

                                return (
                                  <div className="flex items-center justify-between mt-4">
                                    <div className="text-sm text-gray-700">
                                      Showing {((currentPage - 1) * itemsPerPage) + 1} to{' '}
                                      {Math.min(currentPage * itemsPerPage, messages.length)} of{' '}
                                      {messages.length} messages
                                    </div>
                                    <div className="flex gap-2">
                                      <button
                                        onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                                        disabled={currentPage === 1}
                                        className="px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                      >
                                        Previous
                                      </button>
                                      <span className="px-3 py-1 text-sm text-gray-700">
                                        Page {currentPage} of {totalPages}
                                      </span>
                                      <button
                                        onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                                        disabled={currentPage === totalPages}
                                        className="px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                      >
                                        Next
                                      </button>
                                    </div>
                                  </div>
                                )
                              })()}
                            </>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Shareable Summary (Copy-ready) */}
                {(() => {
                  // Build a copy-ready summary text combining goals, per-meal calories, items, and totals
                  const lines = []
                  lines.push(`Date: ${selectedDate}`)
                  // Debug: Log the nutrition data structure
                  console.log('Nutrition data structure:', nutritionData)
                  console.log('User goals:', nutritionData.goalNutrients?.userGoals)

                  if (nutritionData.goalNutrients?.userGoals) {
                    const g = nutritionData.goalNutrients.userGoals
                    lines.push(`User Goals -> Calories: ${g.totalCalories}, Protein: ${g.proteinsInGrams}g, Carbs: ${g.carbohydratesInGrams}g, Fat: ${g.fatInGrams}g, Fiber: ${g.fibreInGrams}g, Sugar: ${g.sugarsInGrams}g`)
                    // Add additional micronutrient goals if available
                    if (g.calciumInGrams || g.cholesterolInGrams || g.ironInGrams || g.potassiumInGrams || g.saltInGrams) {
                      const micronutrients = []
                      if (g.calciumInGrams) micronutrients.push(`Calcium: ${g.calciumInGrams}g`)
                      if (g.cholesterolInGrams) micronutrients.push(`Cholesterol: ${g.cholesterolInGrams}g`)
                      if (g.ironInGrams) micronutrients.push(`Iron: ${g.ironInGrams}g`)
                      if (g.potassiumInGrams) micronutrients.push(`Potassium: ${g.potassiumInGrams}g`)
                      if (g.saltInGrams) micronutrients.push(`Salt: ${g.saltInGrams}g`)
                      if (g.fattyAcidsTotalSaturatedInGrams) micronutrients.push(`Saturated Fat: ${g.fattyAcidsTotalSaturatedInGrams}g`)
                      if (micronutrients.length > 0) {
                        lines.push(`Micronutrient Goals -> ${micronutrients.join(', ')}`)
                      }
                    }
                    // Add vitamin goals if available
                    if (g.vitaminAInGrams || g.vitaminCInGrams || g.vitaminDInGrams) {
                      const vitamins = []
                      if (g.vitaminAInGrams) vitamins.push(`Vitamin A: ${g.vitaminAInGrams}g`)
                      if (g.vitaminCInGrams) vitamins.push(`Vitamin C: ${g.vitaminCInGrams}g`)
                      if (g.vitaminDInGrams) vitamins.push(`Vitamin D: ${g.vitaminDInGrams}g`)
                      if (vitamins.length > 0) {
                        lines.push(`Vitamin Goals -> ${vitamins.join(', ')}`)
                      }
                    }
                  } else {
                    // Add a note if no user goals are available
                    lines.push(`User Goals -> No goals set for this user (userGoals is ${nutritionData.goalNutrients?.userGoals})`)
                  }
                  if (nutritionData.totalCaloriesPerMeal) {
                    const mealParts = Object.entries(nutritionData.totalCaloriesPerMeal).map(([meal, c]) => `${meal}: ${c}`)
                    lines.push(`Calories per Meal -> ${mealParts.join(', ')}`)
                  }
                  // Per-item details
                  if (nutritionData.userItems) {
                    Object.entries(nutritionData.userItems).forEach(([mealType, items]) => {
                      if (!Array.isArray(items) || items.length === 0) return
                      lines.push(`${mealType.toUpperCase()}:`)
                      items.forEach((item) => {
                        const quantityStr = item.quantity || '0'
                        let qty = 0
                        if (typeof quantityStr === 'string') {
                          const m = quantityStr.match(/(\d+(?:\.\d+)?)/)
                          qty = m ? parseFloat(m[1]) : 0
                        } else if (typeof quantityStr === 'number') {
                          qty = quantityStr
                        }
                        const unit = item.unit || 'g'

                        // Convert to grams based on unit type
                        let quantityInGrams = qty

                        // Handle serving units that contain gram amounts in parentheses
                        if (unit.includes('(') && unit.includes('g)')) {
                          // Extract serving amount from unit like "Lingurita rasa (5g)" or "Portie (108.0g)"
                          const servingMatch = unit.match(/\((\d+(?:\.\d+)?)g\)/)
                          if (servingMatch) {
                            const servingAmount = parseFloat(servingMatch[1])
                            quantityInGrams = qty * servingAmount
                          }
                        } else if (unit.toLowerCase().includes('mililitri') || unit.toLowerCase().includes('ml')) {
                          quantityInGrams = qty // Assume 1ml = 1g for liquids
                        } else if (unit.toLowerCase().includes('litri') || unit.toLowerCase().includes('l')) {
                          quantityInGrams = qty * 1000
                        }

                        const nutrients = item.food?.totalNutrients || {}

                        // Calculate actual calories consumed using same logic as main component
                        let itemCalories = 0
                        if (item.food?.type === 'recipe') {
                          // Quantity is total grams eaten; recipe totals are for all servings
                          const totalRecipeCalories = item.food?.totalCalories || 0
                          const numberOfServings = item.food?.numberOfServings || 1
                          let gramsPerServing
                          if (Array.isArray(item.food?.serving)) {
                            const portie = item.food.serving.find(s => s.profileId === 1)
                            const grams = item.food.serving.find(s => s.profileId === 0 || s.innerName?.toLowerCase() === 'grame')
                            gramsPerServing = portie?.amount || grams?.amount || undefined
                          } else if (item.food?.servings?.amount) {
                            gramsPerServing = item.food.servings.amount
                          }
                          const totalRecipeWeight = gramsPerServing && numberOfServings ? (gramsPerServing * numberOfServings) : undefined
                          if (totalRecipeWeight && totalRecipeWeight > 0) {
                            const caloriesPerGram = totalRecipeCalories / totalRecipeWeight
                            itemCalories = caloriesPerGram * qty
                          } else {
                            // Fallback to per-serving if weight unknown
                            const caloriesPerServing = numberOfServings > 0 ? (totalRecipeCalories / numberOfServings) : 0
                            itemCalories = caloriesPerServing * qty
                          }
                        } else if (item.food?.type === 'food') {
                          // For foods, quantity is already in grams, totalCalories is per 100g
                          const caloriesPer100g = item.food?.totalCalories || item.calories || 0
                          itemCalories = (caloriesPer100g / 100) * qty
                        } else {
                          // Fallback for other types
                          const caloriesPer100g = item.food?.totalCalories || item.calories || 0
                          const multiplier = quantityInGrams / 100
                          itemCalories = caloriesPer100g * multiplier
                        }

                        // Calculate nutrients using same logic as main component
                        let p, c, f
                        if (item.food?.type === 'food') {
                          // For foods, quantity is already in grams, nutrients are per 100g
                          const nutrientMultiplier = qty / 100
                          p = (nutrients.proteinsInGrams || 0) * nutrientMultiplier
                          c = (nutrients.carbohydratesInGrams || 0) * nutrientMultiplier
                          f = (nutrients.fatInGrams || 0) * nutrientMultiplier
                        } else if (item.food?.type === 'recipe') {
                          // Recipe nutrients are totals for entire recipe; scale by grams eaten / total weight
                          let gramsPerServing
                          const numberOfServings = item.food?.numberOfServings || 1
                          if (Array.isArray(item.food?.serving)) {
                            const portie = item.food.serving.find(s => s.profileId === 1)
                            const grams = item.food.serving.find(s => s.profileId === 0 || s.innerName?.toLowerCase() === 'grame')
                            gramsPerServing = portie?.amount || grams?.amount || undefined
                          } else if (item.food?.servings?.amount) {
                            gramsPerServing = item.food.servings.amount
                          }
                          const totalRecipeWeight = gramsPerServing && numberOfServings ? (gramsPerServing * numberOfServings) : undefined
                          if (totalRecipeWeight && totalRecipeWeight > 0) {
                            const ratio = qty / totalRecipeWeight
                            p = (nutrients.proteinsInGrams || 0) * ratio
                            c = (nutrients.carbohydratesInGrams || 0) * ratio
                            f = (nutrients.fatInGrams || 0) * ratio
                          } else {
                            // Fallback to per-serving
                            const ratio = numberOfServings > 0 ? (qty / numberOfServings) : 0
                            p = (nutrients.proteinsInGrams || 0) * ratio
                            c = (nutrients.carbohydratesInGrams || 0) * ratio
                            f = (nutrients.fatInGrams || 0) * ratio
                          }
                        } else {
                          // Other types: assume per-100g
                          const multiplier = quantityInGrams / 100
                          p = (nutrients.proteinsInGrams || 0) * multiplier
                          c = (nutrients.carbohydratesInGrams || 0) * multiplier
                          f = (nutrients.fatInGrams || 0) * multiplier
                        }

                        // Show quantity in grams and actual consumed values
                        lines.push(`- ${item.food?.name || 'Unknown'}: ${qty}g, ${Math.round(itemCalories)} cal, P ${p.toFixed(1)}g, C ${c.toFixed(1)}g, F ${f.toFixed(1)}g`)
                      })
                    })
                  }
                  // Daily totals (actual)
                  lines.push(`Daily Totals -> Calories: ${formatNutritionValue(actualTotals.totalCalories)}, Protein: ${formatNutritionValue(actualTotals.totalProtein)}g, Carbs: ${formatNutritionValue(actualTotals.totalCarbs)}g, Fat: ${formatNutritionValue(actualTotals.totalFat)}g, Fiber: ${formatNutritionValue(actualTotals.totalFiber)}g, Sugar: ${formatNutritionValue(actualTotals.totalSugar)}g`)

                  // API total if present
                  if (nutritionData.totalCalories !== undefined) {
                    lines.push(`API Total Calories: ${formatNutritionValue(nutritionData.totalCalories)}`)
                  }

                  // Additional health metrics
                  if (nutritionData.goalNutrients) {
                    const gn = nutritionData.goalNutrients
                    lines.push(`Health Metrics -> BMI: ${gn.BMI || 'N/A'}, BMR: ${gn.BMR || 'N/A'} cal, TDEE: ${gn.TDEE || 'N/A'} cal`)
                  }

                  // Exercise calories
                  if (nutritionData.exerciseCalories !== undefined && nutritionData.exerciseCalories > 0) {
                    lines.push(`Exercise Calories: ${formatNutritionValue(nutritionData.exerciseCalories)}`)
                  }

                  // Goal progress percentages
                  if (nutritionData.goalNutrients?.userGoals) {
                    const g = nutritionData.goalNutrients?.userGoals
                    const calorieProgress = g.totalCalories > 0 ? ((actualTotals.totalCalories / g.totalCalories) * 100).toFixed(1) : 'N/A'
                    const proteinProgress = g.proteinsInGrams > 0 ? ((actualTotals.totalProtein / g.proteinsInGrams) * 100).toFixed(1) : 'N/A'
                    const carbProgress = g.carbohydratesInGrams > 0 ? ((actualTotals.totalCarbs / g.carbohydratesInGrams) * 100).toFixed(1) : 'N/A'
                    const fatProgress = g.fatInGrams > 0 ? ((actualTotals.totalFat / g.fatInGrams) * 100).toFixed(1) : 'N/A'

                    lines.push(`Goal Progress -> Calories: ${calorieProgress}%, Protein: ${proteinProgress}%, Carbs: ${carbProgress}%, Fat: ${fatProgress}%`)
                  }

                  // Append score and completed categories
                  lines.push(`Daily Score: ${dailyScore}%`)
                  const completedList = [
                    proteinDone ? 'Protein' : null,
                    caloriesDone ? 'Calories' : null,
                    carbsDone ? 'Carbs' : null,
                    fatDone ? 'Fat' : null,
                  ].filter(Boolean)
                  if (completedList.length > 0) {
                    lines.push(`Completed Categories: ${completedList.join(', ')}`)
                  }

                  const summaryText = lines.join('\n')
                  return (
                    <div className="card p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Shareable Summary</h3>
                      <div className="mb-3 flex gap-2">
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(summaryText)
                            alert('Summary copied to clipboard!')
                          }}
                          className="btn-primary"
                        >
                          Copy Summary
                        </button>
                        <button
                          onClick={() => {
                            const whatsappMessage = encodeURIComponent(summaryText)
                            const whatsappUrl = `https://wa.me/?text=${whatsappMessage}`
                            window.open(whatsappUrl, '_blank')
                          }}
                          className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.488" />
                          </svg>
                          Send to WhatsApp
                        </button>
                      </div>
                      <textarea
                        readOnly
                        value={summaryText}
                        className="w-full h-48 border border-gray-300 rounded-md p-3 text-sm font-mono"
                      />
                    </div>
                  )
                })()}

                {/* No Data Message */}
                {!nutritionData.userItems && !nutritionData.totalCalories && (
                  <div className="text-center py-8">
                    <BeakerIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Nutrition Data</h3>
                    <p className="text-gray-600">No nutrition data found for {selectedDate}</p>
                  </div>
                )}
              </div>
            )
          })()}
        </div>
      </div>

      {/* Push Notification Popup */}
      {showPushNotificationPopup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-xl font-bold text-gray-900">Send Push Notification</h3>
              <button
                onClick={() => {
                  setShowPushNotificationPopup(false)
                  setNotificationTitle('You received a new message')
                  setNotificationBody('')
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-600">
                Would you like to send a push notification to this user about the message you just sent?
              </p>

              {/* Warning if user has rejected push notifications */}
              {user?.isPushNotificationTokenEnabled === false && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-sm text-yellow-800">
                    This user has rejected push notifications from their app.
                  </p>
                </div>
              )}

              {/* Notification Title Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notification Title
                </label>
                <input
                  type="text"
                  value={notificationTitle}
                  onChange={(e) => setNotificationTitle(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="You received a new message"
                />
              </div>

              {/* Notification Body Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notification Body
                </label>
                <textarea
                  value={notificationBody}
                  onChange={(e) => setNotificationBody(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  rows={3}
                  placeholder="Enter notification message..."
                />
              </div>

              {/* Send Button */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    setShowPushNotificationPopup(false)
                    setNotificationTitle('You received a new message')
                    setNotificationBody('')
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                >
                  Skip
                </button>
                <button
                  onClick={handleSendPushNotification}
                  disabled={sendingPushNotification || !user?.pushNotificationToken}
                  className={`flex-1 px-4 py-2 rounded-md text-sm font-medium text-white transition-colors flex items-center justify-center gap-2 ${user?.isPushNotificationTokenEnabled === false
                    ? sendingPushNotification || !user?.pushNotificationToken
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-gray-500 hover:bg-gray-600 cursor-pointer'
                    : sendingPushNotification || !user?.pushNotificationToken
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                >
                  {sendingPushNotification ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Sending...
                    </>
                  ) : (
                    <>
                      <BellIcon className="w-4 h-4" />
                      Send Notification
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default UserDetailModal