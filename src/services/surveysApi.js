import { auth } from '../config/firebase'
import { API_BASE_FOODSYNC_URL } from './const'

const getHeaders = async () => {
  const headers = { 'Content-Type': 'application/json' }
  if (auth.currentUser) {
    try {
      const token = await auth.currentUser.getIdToken()
      headers['Authorization'] = `Bearer ${token}`
    } catch (error) {
      console.error('Error getting Firebase token:', error)
    }
  }
  return headers
}

export const getSurveys = async () => {
  const headers = await getHeaders()
  const response = await fetch(`${API_BASE_FOODSYNC_URL}/alexafit/website/getSurveys`, { headers })
  return response.json()
}
