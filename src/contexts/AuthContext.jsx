import { createContext, useContext, useState, useEffect } from 'react'
import { useDispatch } from 'react-redux'
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  OAuthProvider
} from 'firebase/auth'
import { auth } from '../config/firebase'
import { getUserById } from '../services/api'
import {
  setUserData,
  setLoading,
  setError as setUserError,
  clearUserData
} from '../store/userSlice'

const AuthContext = createContext({})

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null)
  const [loading, setAuthLoading] = useState(true)
  const [error, setError] = useState(null)
  const dispatch = useDispatch()

  // Fetch backend user data
  const fetchUserData = async firebaseUser => {
    if (!firebaseUser) return

    try {
      dispatch(setLoading(true))
      const response = await getUserById(firebaseUser.uid)

      if (response.ok && response.data) {
        dispatch(setUserData(response.data))
      } else {
        // User not found or not logged in on backend
        dispatch(setUserError('User not authorized for backoffice'))
        console.warn('User not authorized:', response)
      }
    } catch (err) {
      console.error('Error fetching user data:', err)
      dispatch(setUserError(err.message))
    } finally {
      dispatch(setLoading(false))
    }
  }

  // Register new user
  const register = async (email, password) => {
    try {
      setError(null)
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      )
      // Fetch backend user data after registration
      await fetchUserData(userCredential.user)
      return userCredential.user
    } catch (err) {
      setError(err.message)
      throw err
    }
  }

  // Login user
  const login = async (email, password) => {
    try {
      setError(null)
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password
      )
      // Fetch backend user data after login
      await fetchUserData(userCredential.user)
      return userCredential.user
    } catch (err) {
      setError(err.message)
      throw err
    }
  }

  // Sign in with Google
  const signInWithGoogle = async () => {
    try {
      setError(null)
      const provider = new GoogleAuthProvider()
      const result = await signInWithPopup(auth, provider)
      // Fetch backend user data after Google sign-in
      await fetchUserData(result.user)
      return result.user
    } catch (err) {
      setError(err.message)
      throw err
    }
  }

  // Sign in with Apple
  const signInWithApple = async () => {
    try {
      setError(null)
      const provider = new OAuthProvider('apple.com')
      provider.addScope('email')
      provider.addScope('name')
      // Set language for localization
      provider.setCustomParameters({
        locale: 'en'
      })
      const result = await signInWithPopup(auth, provider)
      // Fetch backend user data after Apple sign-in
      await fetchUserData(result.user)
      return result.user
    } catch (err) {
      console.error('Apple Sign-In Error:', err)
      setError(err.message)
      throw err
    }
  }

  // Logout user
  const logout = async () => {
    try {
      setError(null)
      await signOut(auth)
      // Clear Redux user data
      dispatch(clearUserData())
    } catch (err) {
      setError(err.message)
      throw err
    }
  }

  // Get current user's ID token
  const getIdToken = async () => {
    if (currentUser) {
      return await currentUser.getIdToken()
    }
    return null
  }

  // Subscribe to auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, user => {
      setCurrentUser(user)
      setAuthLoading(false)

      // Fetch backend user data when Firebase auth state changes
      if (user) {
        fetchUserData(user)
      } else {
        // Clear Redux data on logout
        dispatch(clearUserData())
      }
    })

    return unsubscribe
  }, [dispatch])

  const value = {
    currentUser,
    register,
    login,
    signInWithGoogle,
    signInWithApple,
    logout,
    getIdToken,
    error,
    loading: loading
  }

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  )
}
