/* eslint-disable no-undef */
import { auth } from '../config/firebase'

// Endpoints that require Firebase Bearer token (parity with RN http)
// Mobile app uses `Authorization: Bearer <token>` via getValidToken()

const API_BASE_URL = 'https://foodsync-api.vercel.app'
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
    const res = await fetch(`${API_BASE_URL}${path}`, {
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

async function requestGet(path, { timeout = DEFAULT_TIMEOUT_MS } = {}) {
  const controller = new AbortController()
  const signal = controller.signal
  const timer = setTimeout(() => controller.abort(), timeout)
  try {
    const headers = await getBearerHeaders(true)
    const res = await fetch(`${API_BASE_URL}${path}`, {
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

// Parity helpers matching RN http.ts/httpMenus.ts usage patterns

export async function getUserById({ userId }) {
  // RN: POST /foodsync/getUserById with Bearer
  return request('/foodsync/getUserById', {
    method: 'POST',
    body: { userId }
  })
}

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

export async function getUserMenus({ userId }) {
  // RN: httpMenus.getUserMenus
  return request('/foodsync/getUserMenus', {
    method: 'POST',
    body: { userId }
  })
}

export async function getUserMenuByDate({ userId, dateApplied }) {
  // RN: httpMenus.getUserMenuByDate
  return request('/foodsync/getUserMenuByDate', {
    method: 'POST',
    body: { userId, dateApplied }
  })
}

export async function getUserWater({ userId, selectedDate }) {
  // RN http.ts: POST /foodsync/getUserItemsByDateApplied with itemType WATER
  return request('/foodsync/getUserItemsByDateApplied', {
    method: 'POST',
    body: { userId, itemType: 'WATER', dateApplied: selectedDate }
  })
}

export async function addUserItem({
  userId,
  itemType,
  itemId,
  dateApplied,
  mealType,
  quantity = 1,
  unit
}) {
  // RN: POST /foodsync/addUserItem
  return request('/foodsync/addUserItem', {
    method: 'POST',
    body: { userId, itemType, itemId, dateApplied, mealType, quantity, unit }
  })
}

export async function deleteUserItem({ userItemId, userId }) {
  // RN: /foodsync/deleteUserItem
  return request('/foodsync/deleteUserItem', {
    method: 'POST',
    body: { userItemId, userId }
  })
}

export async function elasticSearch({
  userId,
  searchTerm,
  itemType = 'FOOD',
  onlyRecipes = false,
  countryCode = 'RO'
}) {
  // RN: /backoffice/elasticSearch; secured for logged-in
  return request('/backoffice/elasticSearch', {
    method: 'POST',
    body: { userId, searchTerm, itemType, onlyRecipes, countryCode }
  })
}

export async function uploadImage(formData) {
  // RN style image upload with Bearer
  return request('/backoffice/images/upload', {
    method: 'POST',
    body: formData,
    isForm: true
  })
}

// Additional RN-style helpers (replicated as needed)

export async function assignMenuTemplateToUser({
  userId,
  dateApplied,
  menuTemplateId,
  replaceExisting
}) {
  // RN: httpMenus.assignMenuTemplateToUser
  return request('/foodsync/assignMenuTemplateToUser', {
    method: 'POST',
    body: { userId, dateApplied, menuTemplateId, replaceExisting }
  })
}

export async function getAssignableMenuTemplates() {
  // RN: httpMenus.getAssignableMenuTemplates
  return request('/foodsync/getAssignableMenuTemplates', {
    method: 'POST',
    body: {}
  })
}

export async function removeMenuFromUser({
  userId,
  userMenuId,
  dateApplied,
  mealType
}) {
  // RN: httpMenus.removeMenuFromUser
  return request('/foodsync/removeMenuFromUser', {
    method: 'POST',
    body: { userId, userMenuId, dateApplied, mealType }
  })
}

export async function updateUserMenu({
  breakfastPlan,
  dinnerPlan,
  lunchPlan,
  snackPlan,
  userId,
  dateApplied,
  userMenuId
}) {
  // RN: httpMenus.updateUserMenu
  return request('/foodsync/updateUserMenu', {
    method: 'POST',
    body: {
      breakfastPlan,
      dinnerPlan,
      lunchPlan,
      snackPlan,
      userId,
      dateApplied,
      userMenuId
    }
  })
}

export async function deleteUserMenuItemByItemId({
  userMenuId,
  itemType,
  itemId
}) {
  // RN: httpMenus.deleteUserMenuItemByItemId
  return request('/foodsync/deleteUserMenuItemByItemId', {
    method: 'POST',
    body: { userMenuId, itemType, itemId }
  })
}

export async function addAnalyticsLogged({
  action,
  message,
  details = {},
  data = {},
  saveToDB = true
}) {
  // RN http.ts addAnalytics (secured with Bearer here)
  return request('/analytics', {
    method: 'POST',
    body: { action, message, details, data, saveToDB }
  })
}

export async function getUserFasting({ userId, selectedDate }) {
  // RN httpFasting.ts equivalent
  return request('/foodsync/fasting/getUserFasting', {
    method: 'POST',
    body: { userId, selectedDate }
  })
}

export async function updateUserFasting({ userId, selectedDate, fastingData }) {
  // RN httpFasting.ts update
  return request('/foodsync/fasting/updateUserFasting', {
    method: 'POST',
    body: { userId, selectedDate, fastingData }
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

export async function getAllNutritionistUsers() {
  // Get all nutritionist-user assignments (admin only)
  return requestGet('/nutritionist-users')
}
