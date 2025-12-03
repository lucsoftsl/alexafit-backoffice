import { createSlice } from '@reduxjs/toolkit'

const ONE_DAY_MS = 24 * 60 * 60 * 1000

const initialState = {
  userData: null,
  userType: null,
  isAdmin: false,
  fetchedAt: null,
  loading: false,
  error: null
}

const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    setUserData: (state, action) => {
      state.userData = action.payload
      state.userType = action.payload?.userType || null
      state.isAdmin = action.payload?.userType === 'ADMIN'
      state.fetchedAt = Date.now()
      state.loading = false
      state.error = null
    },
    setLoading: (state, action) => {
      state.loading = action.payload
    },
    setError: (state, action) => {
      state.error = action.payload
      state.loading = false
    },
    clearUserData: state => {
      state.userData = null
      state.userType = null
      state.isAdmin = false
      state.fetchedAt = null
      state.loading = false
      state.error = null
    }
  }
})

export const { setUserData, setLoading, setError, clearUserData } =
  userSlice.actions

// Selectors
export const selectUserData = state => state.user.userData
export const selectUserType = state => state.user.userType
export const selectIsAdmin = state => state.user.isAdmin
export const selectUserLoading = state => state.user.loading
export const selectUserError = state => state.user.error

// Check if user data is stale (older than 1 day)
export const selectIsUserDataStale = state => {
  if (!state.user.fetchedAt) return true
  return Date.now() - state.user.fetchedAt > ONE_DAY_MS
}

export default userSlice.reducer
