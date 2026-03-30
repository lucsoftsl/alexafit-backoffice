/* eslint-disable no-undef */
import { auth } from '../config/firebase'

import { API_BASE_FOODSYNC_URL, API_BASE_UTILS_URL } from './const'

// Endpoints that require Firebase Bearer token (parity with RN http)
// Mobile app uses `Authorization: Bearer <token>` via getValidToken()

const DEFAULT_TIMEOUT_MS = 15000

async function getBearerHeaders(isJson = true) {
  const headers = {}
  if (isJson) headers['Content-Type'] = 'application/json'
  let token = null
  if (auth.currentUser) {
    try {
      token = await auth.currentUser.getIdToken()
    } catch (error) {
      console.error('Error getting Firebase token:', error)
    }
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  return headers
}

async function request(
  path,
  {
    method = 'POST',
    body = null,
    isForm = false,
    timeout = DEFAULT_TIMEOUT_MS
  } = {}
) {
  const controller = new AbortController()
  const signal = controller.signal
  const timer = setTimeout(() => controller.abort(), timeout)
  try {
    const headers = await getBearerHeaders(!isForm)
    const res = await fetch(`${API_BASE_FOODSYNC_URL}${path}`, {
      method,
      headers,
      body: isForm ? body : body ? JSON.stringify(body) : undefined,
      signal
    })
    clearTimeout(timer)
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`)
    }
    const data = await res.json()
    return data
  } catch (err) {
    clearTimeout(timer)
    console.error('loggedinApi request error:', err)
    throw err
  }
}

async function requestAbsolute(
  url,
  {
    method = 'POST',
    body = null,
    isForm = false,
    timeout = DEFAULT_TIMEOUT_MS
  } = {}
) {
  const controller = new AbortController()
  const signal = controller.signal
  const timer = setTimeout(() => controller.abort(), timeout)
  try {
    const headers = await getBearerHeaders(!isForm)
    const res = await fetch(url, {
      method,
      headers,
      body: isForm ? body : body ? JSON.stringify(body) : undefined,
      signal
    })
    clearTimeout(timer)
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`)
    }
    const data = await res.json()
    return data
  } catch (err) {
    clearTimeout(timer)
    console.error('loggedinApi absolute request error:', err)
    throw err
  }
}

async function requestGet(path, { timeout = DEFAULT_TIMEOUT_MS } = {}) {
  const controller = new AbortController()
  const signal = controller.signal
  const timer = setTimeout(() => controller.abort(), timeout)
  try {
    const headers = await getBearerHeaders(true)
    const res = await fetch(`${API_BASE_FOODSYNC_URL}${path}`, {
      method: 'GET',
      headers,
      signal
    })
    clearTimeout(timer)
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`)
    }
    const data = await res.json()
    return data
  } catch (err) {
    clearTimeout(timer)
    console.error('loggedinApi GET error:', err)
    throw err
  }
}

const analyticsFeedInFlightRequests = new Map()

export async function getDailyNutrition({ userId, dateApplied }) {
  // RN http.ts: POST /foodsync/getUserItemsByDateApplied
  return request('/foodsync/getUserItemsByDateApplied', {
    method: 'POST',
    body: { userId, dateApplied }
  })
}

export async function getUserData({ userId, selectedDate }) {
  // RN http.ts: GET /foodsync/getUserGoals?userId=...&dateApplied=...
  const qs = `userId=${encodeURIComponent(userId)}&dateApplied=${encodeURIComponent(selectedDate)}&skipLoginCheck=true`
  return requestGet(`/foodsync/getUserGoals?${qs}`)
}

export async function getUserMenuByDate({ userId, dateApplied }) {
  // RN: httpMenus.getUserMenuByDate
  return request('/foodsync/getUserMenuByDate', {
    method: 'POST',
    body: { userId, dateApplied }
  })
}

export async function getUserCaloriesHistory({ userId }) {
  // Fetch per-day calories history to mark dates in calendar
  // Mirrors RN: GET /foodsync/getUserCaloriesHistory?userId=...
  const qs = `userId=${encodeURIComponent(userId)}`
  return requestGet(`/foodsync/getUserCaloriesHistory?${qs}`)
}

/**
 * Admin: fetch calorie activity for ALL users within the given lookback window.
 * Returns { days, totalActiveUsers, users: { [userId]: [{dateApplied, caloriesConsumed, caloriesGoal, dateTimeUpdated}] } }
 * @param {object} [options]
 * @param {number} [options.days=14]  - Lookback window in days (1–90)
 */
export async function getUsersCaloriesActivity({ days = 14 } = {}) {
  return request('/backoffice/getUsersCaloriesActivity', {
    method: 'POST',
    body: { days }
  })
}

/**
 * Admin: send a reminder email to a specific user.
 * @param {object} params
 * @param {string} params.userId
 * @param {string} params.subject
 * @param {string} params.html
 */
export async function sendReminderEmail({ userId, subject, html }) {
  return request('/backoffice/sendReminderEmail', {
    method: 'POST',
    body: { userId, subject, html }
  })
}

// Backoffice-only menu endpoints for nutritionists
export async function getAllMenuTemplatesByUser({ createdByUserId }) {
  // Get all menu templates created by a specific user (nutritionist)
  return request('/foodsync/getAllMenuTemplatesByUserBO', {
    method: 'POST',
    body: { createdByUserId }
  })
}

export async function addMenuTemplateBO({
  breakfastPlan,
  dinnerPlan,
  lunchPlan,
  snackPlan,
  name,
  isAssignableByUser,
  createdByUserId
}) {
  // Create a new menu template
  return request('/foodsync/addMenuTemplateBO', {
    method: 'POST',
    body: {
      breakfastPlan: breakfastPlan?.length > 0 ? breakfastPlan : [],
      dinnerPlan: dinnerPlan?.length > 0 ? dinnerPlan : [],
      lunchPlan: lunchPlan?.length > 0 ? lunchPlan : [],
      snackPlan: snackPlan?.length > 0 ? snackPlan : [],
      name,
      isAssignableByUser,
      createdByUserId
    }
  })
}

export async function updateMenuTemplateBO({
  menuTemplateId,
  breakfastPlan,
  dinnerPlan,
  lunchPlan,
  snackPlan,
  name,
  isAssignableByUser,
  createdByUserId
}) {
  // Update an existing menu template
  return request('/foodsync/updateMenuTemplateBO', {
    method: 'POST',
    body: {
      menuTemplateId,
      breakfastPlan,
      dinnerPlan,
      lunchPlan,
      snackPlan,
      name,
      isAssignableByUser,
      createdByUserId
    }
  })
}

export async function deleteMenuTemplateByIdBO({
  menuTemplateId,
  createdByUserId
}) {
  // Delete a menu template by ID
  return request('/foodsync/deleteMenuTemplateByIdBO', {
    method: 'POST',
    body: { menuTemplateId, createdByUserId }
  })
}

export async function renameMenuContainerBO({
  menuTemplateIds,
  newContainerName,
  createdByUserId
}) {
  return request('/foodsync/renameMenuContainerBO', {
    method: 'POST',
    body: { menuTemplateIds, newContainerName, createdByUserId }
  })
}

export async function copyMenuContainerBO({
  menuTemplateIds,
  newContainerName,
  createdByUserId
}) {
  return request('/foodsync/copyMenuContainerBO', {
    method: 'POST',
    body: { menuTemplateIds, newContainerName, createdByUserId }
  })
}

export async function copyMenuContainerToCountryBO({
  menuTemplateIds,
  newContainerName,
  countryCode,
  userId,
  createdByUserId
}) {
  return request('/foodsync/copyMenuContainerToCountryBO', {
    method: 'POST',
    body: {
      menuTemplateIds,
      newContainerName,
      countryCode,
      userId,
      createdByUserId
    }
  })
}

export async function deleteMenuContainerBO({
  menuTemplateIds,
  createdByUserId
}) {
  return request('/foodsync/deleteMenuContainerBO', {
    method: 'POST',
    body: { menuTemplateIds, createdByUserId }
  })
}

export async function deleteMenuTemplateItemByIdBO({
  menuTemplateId,
  itemType,
  itemId,
  createdByUserId
}) {
  // Delete a single item from a menu template
  return request('/foodsync/deleteMenuTemplateItemByIdBO', {
    method: 'POST',
    body: { menuTemplateId, itemType, itemId, createdByUserId }
  })
}

export async function assignMenuTemplateToUserBO({
  userId,
  dateApplied,
  menuTemplateId,
  replaceExisting = false
}) {
  // Assign a menu template to a user
  return request('/foodsync/assignMenuTemplateToUserBO', {
    method: 'POST',
    body: { userId, dateApplied, menuTemplateId, replaceExisting }
  })
}

export async function assignMenuContainerToUserBO({
  userId,
  startDate,
  menuTemplateIds,
  replaceExisting = false,
  createdByUserId
}) {
  return request('/foodsync/assignMenuContainerToUserBO', {
    method: 'POST',
    body: {
      userId,
      startDate,
      menuTemplateIds,
      replaceExisting,
      createdByUserId
    }
  })
}

export async function reorderMenuContainerBO({
  menuTemplateOrders,
  containerName,
  createdByUserId
}) {
  return request('/foodsync/reorderMenuContainerBO', {
    method: 'POST',
    body: { menuTemplateOrders, containerName, createdByUserId }
  })
}

export async function removeMenuFromUserBO({
  userId,
  dateApplied,
  menuTemplateId
}) {
  // Remove a menu from a user
  return request('/foodsync/removeMenuFromUserBO', {
    method: 'POST',
    body: { userId, dateApplied, menuTemplateId }
  })
}

export async function getUserMenusBO({ userId }) {
  // Get all menus assigned to a user
  return request('/foodsync/getUserMenusBO', {
    method: 'POST',
    body: { userId }
  })
}

// Nutritionist endpoints for managing clients
export async function getNutritionistClients({ nutritionistId }) {
  // Get all clients assigned to a nutritionist
  return requestGet(`/nutritionist-users/${nutritionistId}`)
}

export async function assignClientToNutritionist({ nutritionistId, userId }) {
  // Assign an existing user to a nutritionist
  return request('/nutritionist-users/assign', {
    method: 'POST',
    body: { nutritionistId, userId }
  })
}

export async function createClientAndAssignToNutritionist({
  nutritionistId,
  fullName,
  email,
  password,
  userData,
  selectedDate
}) {
  return request('/nutritionist-users/create-and-assign', {
    method: 'POST',
    body: {
      nutritionistId,
      fullName,
      email,
      password,
      userData,
      selectedDate
    }
  })
}

export async function unassignClientFromNutritionist({
  nutritionistId,
  userId
}) {
  // Unassign a user from a nutritionist
  return request('/nutritionist-users/unassign', {
    method: 'DELETE',
    body: { nutritionistId, userId }
  })
}

export async function saveUserDataFromWelcomeScreen({
  userData,
  userId,
  selectedDate
}) {
  // Save user profile data (used in Settings page)
  return request('/foodsync/save-user-data', {
    method: 'POST',
    body: {
      userId,
      userData,
      selectedDate
    }
  })
}

export async function completeBackofficeRegistration({
  userId,
  fullName,
  email
}) {
  return request('/foodsync/users/completeBackofficeRegistration', {
    method: 'POST',
    body: {
      userId,
      fullName,
      email
    }
  })
}

export async function getAvatars({ userId }) {
  // Get available avatars for a user
  return request('/foodsync/getAvatars', {
    method: 'POST',
    body: { userId }
  })
}

export async function getUserById({ userId }) {
  // Get user profile data by ID
  return request('/foodsync/getUserById', {
    method: 'POST',
    body: { userId }
  })
}

// User Notes endpoints
export async function getUserNotes({ userId }) {
  // Fetch notes for a user
  return request('/foodsync/getUserNotes', {
    method: 'POST',
    body: { userId }
  })
}

export async function getUserNotesByAuthor({ userId, fromUserId }) {
  return request('/foodsync/getUserNotesByAuthor', {
    method: 'POST',
    body: { userId, fromUserId }
  })
}

export async function addUserNote({ userId, note }) {
  // Create a new note for a user
  return request('/foodsync/addUserNote', {
    method: 'POST',
    body: { userId, note }
  })
}

export async function addClientNote({
  userId,
  note,
  fromUserId,
  isFromNutritionist = true
}) {
  // Create a new note for a user
  return request('/foodsync/addUserNote', {
    method: 'POST',
    body: { userId, note, fromUserId, isFromNutritionist }
  })
}

export async function updateUserNote({ userId, noteId, note }) {
  // Update an existing user note
  return request('/foodsync/updateUserNote', {
    method: 'POST',
    body: { userId, noteId, note }
  })
}

export async function deleteUserNote({ userId, noteId }) {
  // Delete a user note
  return request('/foodsync/deleteUserNote', {
    method: 'POST',
    body: { userId, noteId }
  })
}

export async function getUserCheckins({ userId }) {
  // Get all user check-ins (progress entries) - uses GET endpoint with query param
  return requestGet(
    `/foodsync/getUserProgress/?userId=${encodeURIComponent(userId)}&skipLoginCheck=true`
  )
}

export async function saveUserCheckin({
  userId,
  checkInDateTime,
  currentWeightInKg,
  currentFatPercentage,
  currentWaistSizeInCm,
  currentChestSizeInCm,
  currentHipSizeInCm,
  currentThighSizeInCm,
  currentWaterPercentage,
  currentArmSizeInCm
}) {
  // Save a new check-in
  return request('/foodsync/addUserCheckIn', {
    method: 'POST',
    body: {
      userId,
      checkInDateTime,
      currentWeightInKg,
      currentMeasurement: {
        currentArmSizeInCm: currentArmSizeInCm || null,
        currentChestSizeInCm: currentChestSizeInCm || null,
        currentWaistSizeInCm: currentWaistSizeInCm || null,
        currentHipSizeInCm: currentHipSizeInCm || null,
        currentFatPercentage: currentFatPercentage || null,
        currentThighSizeInCm: currentThighSizeInCm || null,
        currentWaterPercentage: currentWaterPercentage || null
      },
      photoUrls: { mainPhoto: null }
    }
  })
}

export async function updateUserCheckin({
  userId,
  checkInId,
  checkInDateTime,
  currentWeightInKg,
  currentFatPercentage,
  currentWaistSizeInCm,
  currentChestSizeInCm,
  currentHipSizeInCm,
  currentThighSizeInCm,
  currentWaterPercentage,
  currentArmSizeInCm
}) {
  // Update an existing check-in
  return request('/foodsync/updateUserCheckIn', {
    method: 'PUT',
    body: {
      userId,
      checkInId,
      checkInDateTime,
      currentWeightInKg,
      currentArmSizeInCm: currentArmSizeInCm || null,
      currentChestSizeInCm: currentChestSizeInCm || null,
      currentWaistSizeInCm: currentWaistSizeInCm || null,
      currentHipSizeInCm: currentHipSizeInCm || null,
      currentFatPercentage: currentFatPercentage || null,
      currentThighSizeInCm: currentThighSizeInCm || null,
      currentWaterPercentage: currentWaterPercentage || null
    }
  })
}

export async function deleteUserCheckin({ userId, checkInId }) {
  // Delete a check-in
  return request('/foodsync/removeUserCheckIn', {
    method: 'POST',
    body: {
      userId,
      checkInId
    }
  })
}

export async function getBackofficeAnalyticsFeed({
  userId,
  lookbackWindow = '7d'
}) {
  const requestKey = JSON.stringify({
    userId,
    lookbackWindow
  })

  if (analyticsFeedInFlightRequests.has(requestKey)) {
    return analyticsFeedInFlightRequests.get(requestKey)
  }

  const requestPromise = requestAbsolute(
    `${API_BASE_UTILS_URL}/analytics/alexafit/feed`,
    {
      method: 'POST',
      body: {
        userId,
        lookbackWindow
      }
    }
  ).finally(() => {
    analyticsFeedInFlightRequests.delete(requestKey)
  })

  analyticsFeedInFlightRequests.set(requestKey, requestPromise)
  return requestPromise
}
