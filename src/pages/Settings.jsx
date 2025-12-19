import { useSelector, useDispatch } from 'react-redux'
import { useAuth } from '../contexts/AuthContext'
import { selectUserData, selectIsAdmin, selectUserType, setUserData } from '../store/userSlice'
import { saveUserDataFromWelcomeScreen, getAvatars, getUserData, getUserById } from '../services/loggedinApi'
import { useState, useEffect, useRef, useCallback } from 'react'
import FormField from '../components/FormField'
import FormSelect from '../components/FormSelect'
import {
  UserIcon,
  EnvelopeIcon,
  ShieldCheckIcon,
  CalendarIcon,
  IdentificationIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowRightOnRectangleIcon,
  PencilIcon,
  XMarkIcon,
  CheckIcon,
  PhotoIcon,
  ArrowUpTrayIcon,
  LockClosedIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline'

const Settings = () => {
  const { currentUser, logout } = useAuth()
  const userData = useSelector(selectUserData)
  const isAdmin = useSelector(selectIsAdmin)
  const userType = useSelector(selectUserType)
  const dispatch = useDispatch()

  const [editMode, setEditMode] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)
  const [avatars, setAvatars] = useState({ generic: [], pro: [] })
  const [selectedAvatarForEdit, setSelectedAvatarForEdit] = useState(null)
  const [showAvatarSelector, setShowAvatarSelector] = useState(false)
  const [avatarLoading, setAvatarLoading] = useState(false)
  const fileInputRef = useRef(null)

  // Form state for editable fields
  const [formData, setFormData] = useState({
    name: '',
    selectedGender: '',
    selectedFemininOption: '',
    selectedBirthDate: '',
    selectedHeight: '',
    selectedHeightMeasurementUnit: 'METRIC',
    selectedWeight: '',
    selectedWeightMeasurementUnit: 'METRIC',
    selectedTargetWeight: '',
    selectedTargetWeightMeasurementUnit: 'METRIC',
    selectedActivityType: '',
    selectedGoalType: ''
  })

  // Initialize form data from userData
  useEffect(() => {
    if (userData?.userData) {
      // Convert birthdate to YYYY-MM-DD format if needed for date input
      let birthDate = userData.userData.selectedBirthDate || ''
      if (birthDate && !birthDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
        // If birthdate exists but not in correct format, try to convert it
        const date = new Date(birthDate)
        if (!isNaN(date.getTime())) {
          birthDate = date.toISOString().split('T')[0]
        }
      }

      setFormData({
        name: userData.userData.name || userData.userData.displayName || '',
        selectedGender: userData.userData.selectedGender || '',
        selectedFemininOption: userData.userData.selectedFemininOption || '',
        selectedBirthDate: birthDate,
        selectedHeight: userData.userData.selectedHeight || '',
        selectedHeightMeasurementUnit:
          userData.userData.selectedHeightMeasurementUnit || 'METRIC',
        selectedWeight: userData.userData.selectedWeight || '',
        selectedWeightMeasurementUnit:
          userData.userData.selectedWeightMeasurementUnit || 'METRIC',
        selectedTargetWeight: userData.userData.selectedTargetWeight || '',
        selectedTargetWeightMeasurementUnit:
          userData.userData.selectedTargetWeightMeasurementUnit || 'METRIC',
        selectedActivityType: userData.userData.selectedActivityType || '',
        selectedGoalType: userData.userData.selectedGoalType || ''
      })

      // Set initial selected avatar
      if (userData.userData.avatar) {
        setSelectedAvatarForEdit(userData.userData.avatar)
      } else if (currentUser?.photoURL) {
        setSelectedAvatarForEdit({ avatarUrl: currentUser.photoURL })
      }
    }
  }, [userData, currentUser])

  // Fetch available avatars with localStorage caching
  const fetchAvatars = useCallback(async (forceRefresh = false) => {
    if (!userData?.userId) return

    const cacheKey = `avatars_${userData.userId}`
    
    // Check localStorage cache first (unless forcing refresh)
    if (!forceRefresh) {
      try {
        const cachedData = localStorage.getItem(cacheKey)
        if (cachedData) {
          const data = JSON.parse(cachedData)
          setAvatars({
            generic: data.generic || [],
            pro: data.pro || []
          })
          console.log('Loaded avatars from cache')
          return
        }
      } catch (err) {
        console.error('Error reading avatar cache:', err)
      }
    }

    // Fetch from API if not cached or forcing refresh
    setAvatarLoading(true)
    try {
      const response = await getAvatars({ userId: userData.userId })
      const avatarData = {
        generic: response?.avatars?.GENERIC || [],
        pro: response?.avatars?.PRO || []
      }
      setAvatars(avatarData)
      
      // Save to localStorage
      try {
        localStorage.setItem(cacheKey, JSON.stringify(avatarData))
        console.log('Avatars cached to localStorage')
      } catch (err) {
        console.error('Error saving avatar cache:', err)
      }
    } catch (err) {
      console.error('Error fetching avatars:', err)
    } finally {
      setAvatarLoading(false)
    }
  }, [userData?.userId])

  useEffect(() => {
    if (editMode) {
      fetchAvatars(false)
    }
  }, [editMode, fetchAvatars])

  const handleLogout = async () => {
    try {
      await logout()
    } catch (error) {
      console.error('Failed to logout:', error)
    }
  }

  const handleInputChange = useCallback(e => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }, [])

  const handleSaveProfile = async () => {
    setLoading(true)
    setError(null)
    setSuccess(false)

    try {
      const updatedUserData = {
        ...userData.userData,
        ...formData
      }

      // Include selected avatar if changed
      if (selectedAvatarForEdit) {
        updatedUserData.avatar = selectedAvatarForEdit
      }

      await saveUserDataFromWelcomeScreen({
        userData: updatedUserData,
        userId: userData.userId,
        selectedDate: new Date().toISOString().split('T')[0]
      })

      setSuccess(true)

      // Wait 1.5 seconds then refetch user data to update Redux store
      setTimeout(async () => {
        try {
          const [goalsData, userProfileData] = await Promise.all([
            getUserData({
              userId: userData.userId,
              selectedDate: new Date().toISOString().split('T')[0]
            }),
            getUserById({
              userId: userData.userId
            })
          ])
          // Merge both responses and update Redux store
          const mergedData = {
            ...goalsData,
            ...userProfileData
          }

          dispatch(setUserData(mergedData.data))
        } catch (err) {
          console.error('Error refetching user data:', err)
        }
        setEditMode(false)
      }, 1500)

      // Reset success message after 4.5 seconds
      setTimeout(() => setSuccess(false), 4500)
    } catch (err) {
      setError(err.message || 'Failed to save profile. Please try again.')
      console.error('Error saving user data:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    // Reset form to original values
    if (userData?.userData) {
      setFormData({
        name: userData.userData.name || userData.userData.displayName || '',
        selectedGender: userData.userData.selectedGender || '',
        selectedFemininOption: userData.userData.selectedFemininOption || '',
        selectedBirthDate: userData.userData.selectedBirthDate || '',
        selectedHeight: userData.userData.selectedHeight || '',
        selectedHeightMeasurementUnit:
          userData.userData.selectedHeightMeasurementUnit || 'METRIC',
        selectedWeight: userData.userData.selectedWeight || '',
        selectedWeightMeasurementUnit:
          userData.userData.selectedWeightMeasurementUnit || 'METRIC',
        selectedTargetWeight: userData.userData.selectedTargetWeight || '',
        selectedTargetWeightMeasurementUnit:
          userData.userData.selectedTargetWeightMeasurementUnit || 'METRIC',
        selectedActivityType: userData.userData.selectedActivityType || '',
        selectedGoalType: userData.userData.selectedGoalType || ''
      })

      // Reset avatar to original
      if (userData.userData.avatar) {
        setSelectedAvatarForEdit(userData.userData.avatar)
      } else if (currentUser?.photoURL) {
        setSelectedAvatarForEdit({ avatarUrl: currentUser.photoURL })
      }
    }
    setEditMode(false)
    setError(null)
  }


  const formatDate = dateString => {
    if (!dateString) return 'N/A'
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch {
      return dateString
    }
  }

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (event) => {
        const dataUrl = event.target?.result
        if (dataUrl) {
          setSelectedAvatarForEdit({
            avatarUrl: dataUrl,
            isCustom: true
          })
        }
      }
      reader.readAsDataURL(file)
    }
  }

  const renderUserDetails = () => {
    if (!userData) {
      return (
        <div className="text-center py-8">
          <p className="text-gray-500">No user data available</p>
        </div>
      )
    }

    if (editMode) {
      return (
        <div className="relative">
          {/* Glass Morphism Card */}
          <div className="relative overflow-hidden rounded-3xl backdrop-blur-xl bg-gradient-to-br from-white/90 to-white/70 border border-white/20 shadow-2xl p-8">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 pointer-events-none"></div>

            <div className="relative">
              <h3 className="text-2xl font-bold text-gray-900 mb-8 flex items-center">
                <PencilIcon className="w-6 h-6 mr-3 text-blue-600" />
                Edit Profile
              </h3>

              {error && (
                <div className="mb-6 p-4 bg-red-50/80 backdrop-blur-md border border-red-200/30 rounded-2xl text-red-700 rounded-xl">
                  {error}
                </div>
              )}

              {success && (
                <div className="mb-6 p-4 bg-green-50/80 backdrop-blur-md border border-green-200/30 rounded-2xl text-green-700">
                  Profile updated successfully!
                </div>
              )}

              {/* Avatar Section - Modernized */}
              <div className="mb-8 p-6 bg-gradient-to-br from-blue-50/40 to-purple-50/40 backdrop-blur-md border border-blue-200/20 rounded-2xl">
                <h4 className="text-sm font-semibold text-gray-900 mb-6 flex items-center">
                  <PhotoIcon className="w-5 h-5 mr-2 text-blue-600" />
                  Avatar
                </h4>

                <div className="flex flex-col gap-6">
                  {/* Current Avatar Preview */}
                  <div className="flex items-center gap-4">
                    <div className="flex-shrink-0">
                      <div className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-blue-200/50 bg-gradient-to-br from-white to-blue-50 flex items-center justify-center shadow-lg">
                        {selectedAvatarForEdit?.avatarUrl ? (
                          <img
                            src={selectedAvatarForEdit.avatarUrl}
                            alt="Selected Avatar"
                            className="w-full h-full object-cover"
                            onError={e => {
                              e.target.style.display = 'none'
                            }}
                          />
                        ) : (
                          <UserIcon className="w-10 h-10 text-gray-300" />
                        )}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-600 mb-1">Current Avatar</p>
                      <p className="text-sm text-gray-500">Click below to change</p>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowAvatarSelector(!showAvatarSelector)}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-lg hover:shadow-xl backdrop-blur-md"
                    >
                      <PhotoIcon className="w-4 h-4" />
                      {showAvatarSelector ? 'Hide Avatars' : 'Choose Avatar'}
                    </button>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-blue-600 bg-gradient-to-r from-blue-50/40 to-blue-100/40 border border-blue-200/50 rounded-xl hover:from-blue-100/60 hover:to-blue-150/60 transition-all duration-200 backdrop-blur-md"
                    >
                      <ArrowUpTrayIcon className="w-4 h-4" />
                      Upload
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </div>

                  {/* Avatar Grid */}
                  {showAvatarSelector && (
                    <div className="mt-4 pt-4 border-t border-blue-200/20">
                      {/* Generic Avatars */}
                      {avatars.generic.length > 0 && (
                        <div className="mb-6">
                          <div className="flex items-center justify-between mb-3">
                            <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Available Avatars</p>
                            <button
                              onClick={() => fetchAvatars(true)}
                              disabled={avatarLoading}
                              className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 hover:text-blue-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Refresh avatars"
                            >
                              <ArrowPathIcon className={`w-4 h-4 ${avatarLoading ? 'animate-spin' : ''}`} />
                            </button>
                          </div>
                          <div className="grid grid-cols-4 gap-3">
                            {avatars.generic.map((avatar, idx) => (
                              <button
                                key={`generic-${idx}`}
                                onClick={() => {
                                  setSelectedAvatarForEdit(avatar)
                                  setShowAvatarSelector(false)
                                }}
                                className={`aspect-square rounded-xl overflow-hidden border-2 transition-all duration-200 ${
                                  selectedAvatarForEdit?.avatarUrl === avatar.avatarUrl
                                    ? 'border-green-500 ring-2 ring-green-500 shadow-lg'
                                    : 'border-gray-200 hover:border-blue-400 shadow-md hover:shadow-lg'
                                } hover:scale-105`}
                              >
                                <img
                                  src={avatar.avatarUrl}
                                  alt={`Avatar ${idx}`}
                                  className="w-full h-full object-cover"
                                  onError={e => {
                                    e.target.style.display = 'none'
                                  }}
                                />
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Pro Avatars */}
                      {avatars.pro.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-gray-700 mb-3 uppercase tracking-wide">Premium Avatars</p>
                          <div className="grid grid-cols-4 gap-3">
                            {avatars.pro.map((avatar, idx) => (
                              <button
                                key={`pro-${idx}`}
                                onClick={() => {
                                  setSelectedAvatarForEdit(avatar)
                                  setShowAvatarSelector(false)
                                }}
                                className={`aspect-square rounded-xl overflow-hidden border-2 transition-all duration-200 relative ${
                                  selectedAvatarForEdit?.avatarUrl === avatar.avatarUrl
                                    ? 'border-green-500 ring-2 ring-green-500 shadow-lg'
                                    : 'border-gray-200 hover:border-blue-400 shadow-md hover:shadow-lg'
                                } hover:scale-105`}
                              >
                                <img
                                  src={avatar.avatarUrl}
                                  alt={`Premium Avatar ${idx}`}
                                  className="w-full h-full object-cover"
                                  onError={e => {
                                    e.target.style.display = 'none'
                                  }}
                                />
                                <div className="absolute top-1 right-1 bg-gradient-to-r from-yellow-400 to-yellow-500 text-white px-1.5 py-0.5 rounded-lg text-xs font-bold shadow-md">
                                  Pro
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Form Fields Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {/* Name */}
            <div className="md:col-span-2">
              <FormField
                label="Full Name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
              />
            </div>

            {/* Gender */}
            <FormSelect
              label="Gender"
              name="selectedGender"
              value={formData.selectedGender}
              onChange={handleInputChange}
              options={[
                { value: 'MALE', label: 'Male' },
                { value: 'FEMALE', label: 'Female' },
                { value: 'OTHER', label: 'Other' }
              ]}
            />

            {/* Birth Date */}
            <FormField
              label="Birth Date"
              name="selectedBirthDate"
              type="date"
              value={formData.selectedBirthDate}
              onChange={handleInputChange}
            />

            {/* Feminine Health (only for female users) */}
            {formData.selectedGender === 'FEMALE' && (
              <FormSelect
                label="Women's Health Status"
                name="selectedFemininOption"
                value={formData.selectedFemininOption}
                onChange={handleInputChange}
                options={[
                  { value: 'NONE', label: 'None' },
                  { value: 'PREGNANT', label: 'Pregnant' },
                  { value: 'BREASTFEEDING', label: 'Breastfeeding' },
                ]}
              />
            )}

            {/* Height */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Height
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  name="selectedHeight"
                  value={formData.selectedHeight}
                  onChange={handleInputChange}
                  placeholder="Height"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <select
                  name="selectedHeightMeasurementUnit"
                  value={formData.selectedHeightMeasurementUnit}
                  onChange={handleInputChange}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="METRIC">cm</option>
                  <option value="IMPERIAL">in</option>
                </select>
              </div>
            </div>

            {/* Weight */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Current Weight
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  name="selectedWeight"
                  value={formData.selectedWeight}
                  onChange={handleInputChange}
                  placeholder="Weight"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <select
                  name="selectedWeightMeasurementUnit"
                  value={formData.selectedWeightMeasurementUnit}
                  onChange={handleInputChange}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="METRIC">kg</option>
                  <option value="IMPERIAL">lb</option>
                </select>
              </div>
            </div>

            {/* Target Weight */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Target Weight
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  name="selectedTargetWeight"
                  value={formData.selectedTargetWeight}
                  onChange={handleInputChange}
                  placeholder="Target Weight"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <select
                  name="selectedTargetWeightMeasurementUnit"
                  value={formData.selectedTargetWeightMeasurementUnit}
                  onChange={handleInputChange}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="METRIC">kg</option>
                  <option value="IMPERIAL">lb</option>
                </select>
              </div>
            </div>

            {/* Activity Level */}
            <FormSelect
              label="Activity Level"
              name="selectedActivityType"
              value={formData.selectedActivityType}
              onChange={handleInputChange}
              options={[
                { value: 'NOT_ACTIVE', label: 'Not Active' },
                { value: 'LIGHTLY_ACTIVE', label: 'Lightly Active' },
                { value: 'MODERATELY_ACTIVE', label: 'Moderately Active' },
                { value: 'VERY_ACTIVE', label: 'Very Active' }
              ]}
            />

            {/* Goal Type */}
            <FormSelect
              label="Goal"
              name="selectedGoalType"
              value={formData.selectedGoalType}
              onChange={handleInputChange}
              options={[
                { value: 'LOSE_WEIGHT', label: 'Lose Weight' },
                { value: 'MAINTAIN_WEIGHT', label: 'Maintain Weight' },
                { value: 'GAIN_WEIGHT', label: 'Gain Weight' }
              ]}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-6 border-t border-white/20">
            <button
              onClick={handleSaveProfile}
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-gradient-to-r from-green-500 to-green-600 rounded-xl hover:from-green-600 hover:to-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CheckIcon className="w-4 h-4" />
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              onClick={handleCancel}
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 text-sm font-semibold text-gray-700 bg-gradient-to-r from-gray-100/40 to-gray-200/40 border border-gray-200/50 rounded-xl hover:from-gray-200/60 hover:to-gray-300/60 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-all duration-200 backdrop-blur-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <XMarkIcon className="w-4 h-4" />
              Cancel
            </button>
          </div>
            </div>
          </div>
        </div>
      )
    }

    return (
      <div className="space-y-6">
        {/* Edit Button - Top */}
        <div className="flex justify-end">
          <button
            onClick={() => setEditMode(true)}
            className="flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
          >
            <PencilIcon className="w-4 h-4" />
            Edit Profile
          </button>
        </div>

        {/* Account Information - Modern Grid Layout */}
        <div className="relative overflow-hidden rounded-3xl backdrop-blur-xl bg-gradient-to-br from-white/90 to-white/70 border border-white/20 shadow-2xl p-8">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 pointer-events-none"></div>

          <div className="relative">
            <h3 className="text-xl font-bold text-gray-900 flex items-center mb-8">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-100 to-blue-50 flex items-center justify-center mr-3 shadow-md">
                <UserIcon className="w-6 h-6 text-blue-600" />
              </div>
              Account Information
            </h3>

            {/* Grid Layout for Account Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
              {/* User ID Card */}
              <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-50/50 to-blue-100/30 backdrop-blur-sm border border-blue-200/30 p-6 hover:shadow-lg transition-all duration-300">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/0 to-blue-600/0 group-hover:from-blue-500/5 group-hover:to-blue-600/5 transition-all duration-300"></div>
                <div className="relative flex items-start gap-4">
                  <div className="flex-shrink-0">
                    <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-gradient-to-br from-blue-400/20 to-blue-500/20">
                      <IdentificationIcon className="h-5 w-5 text-blue-600" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider">User ID</p>
                    <p className="mt-2 text-sm font-medium text-gray-900 break-all">
                      {userData.userId || currentUser?.uid}
                    </p>
                  </div>
                </div>
              </div>

              {/* Email Card */}
              <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-50/50 to-blue-100/30 backdrop-blur-sm border border-blue-200/30 p-6 hover:shadow-lg transition-all duration-300">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/0 to-blue-600/0 group-hover:from-blue-500/5 group-hover:to-blue-600/5 transition-all duration-300"></div>
                <div className="relative flex items-start gap-4">
                  <div className="flex-shrink-0">
                    <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-gradient-to-br from-blue-400/20 to-blue-500/20">
                      <EnvelopeIcon className="h-5 w-5 text-blue-600" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider">Email</p>
                    <p className="mt-2 text-sm font-medium text-gray-900 break-all">
                      {userData.email || currentUser?.email}
                    </p>
                  </div>
                </div>
              </div>

              {/* User Type Card */}
              <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-purple-50/50 to-purple-100/30 backdrop-blur-sm border border-purple-200/30 p-6 hover:shadow-lg transition-all duration-300">
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/0 to-purple-600/0 group-hover:from-purple-500/5 group-hover:to-purple-600/5 transition-all duration-300"></div>
                <div className="relative flex items-start gap-4">
                  <div className="flex-shrink-0">
                    <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-gradient-to-br from-purple-400/20 to-purple-500/20">
                      <ShieldCheckIcon className="h-5 w-5 text-purple-600" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-purple-600 uppercase tracking-wider">User Type</p>
                    <p className="mt-2 text-sm font-bold text-purple-700">
                      {userType}
                    </p>
                  </div>
                </div>
              </div>

              {/* Admin Status Card */}
              <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-yellow-50/50 to-yellow-100/30 backdrop-blur-sm border border-yellow-200/30 p-6 hover:shadow-lg transition-all duration-300">
                <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/0 to-yellow-600/0 group-hover:from-yellow-500/5 group-hover:to-yellow-600/5 transition-all duration-300"></div>
                <div className="relative flex items-start gap-4">
                  <div className="flex-shrink-0">
                    <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-gradient-to-br from-yellow-400/20 to-yellow-500/20">
                      {isAdmin ? (
                        <CheckCircleIcon className="h-5 w-5 text-yellow-600" />
                      ) : (
                        <XCircleIcon className="h-5 w-5 text-gray-400" />
                      )}
                    </div>
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-yellow-600 uppercase tracking-wider">Admin Status</p>
                    <p className={`mt-2 text-sm font-bold ${isAdmin ? 'text-yellow-700' : 'text-gray-600'}`}>
                      {isAdmin ? 'Administrator' : 'Regular User'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Profile Information - Modern Grid Layout */}
        {userData.userData && (
          <div className="relative overflow-hidden rounded-3xl backdrop-blur-xl bg-gradient-to-br from-white/90 to-white/70 border border-white/20 shadow-2xl p-8">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-pink-500/5 pointer-events-none"></div>

            <div className="relative">
              <h3 className="text-xl font-bold text-gray-900 mb-8 flex items-center">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-100 to-purple-50 flex items-center justify-center mr-3 shadow-md">
                  <UserIcon className="w-6 h-6 text-purple-600" />
                </div>
                Profile Information
              </h3>

              {/* Avatar Section */}
              {(userData.userData.avatar?.avatarUrl || currentUser?.photoURL) && (
                <div className="mb-8">
                  <p className="text-xs font-semibold text-purple-600 uppercase tracking-wider mb-4">Avatar</p>
                  <div className="flex gap-4">
                    {userData.userData.avatar?.avatarUrl ? (
                      <img
                        src={userData.userData.avatar.avatarUrl}
                        alt="User Avatar"
                        className="w-24 h-24 rounded-2xl object-cover border-2 border-purple-200/50 shadow-lg"
                        onError={e => {
                          e.target.style.display = 'none'
                        }}
                      />
                    ) : currentUser?.photoURL ? (
                      <img
                        src={currentUser.photoURL}
                        alt="Firebase Avatar"
                        className="w-24 h-24 rounded-2xl object-cover border-2 border-purple-200/50 shadow-lg"
                        onError={e => {
                          e.target.style.display = 'none'
                        }}
                      />
                    ) : (
                      <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-200/50 flex items-center justify-center shadow-lg">
                        <UserIcon className="w-10 h-10 text-gray-400" />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Profile Details Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Name Card */}
                {userData.userData.name && (
                  <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-purple-50/50 to-purple-100/30 backdrop-blur-sm border border-purple-200/30 p-5 hover:shadow-lg transition-all duration-300">
                    <div className="absolute inset-0 bg-gradient-to-br from-purple-500/0 to-purple-600/0 group-hover:from-purple-500/5 group-hover:to-purple-600/5 transition-all duration-300"></div>
                    <div className="relative">
                      <p className="text-xs font-semibold text-purple-600 uppercase tracking-wider">Full Name</p>
                      <p className="mt-2 text-sm font-medium text-gray-900">{userData.userData.name || userData.userData.displayName}</p>
                    </div>
                  </div>
                )}

                {/* Gender Card */}
                {userData.userData.selectedGender && (
                  <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-pink-50/50 to-pink-100/30 backdrop-blur-sm border border-pink-200/30 p-5 hover:shadow-lg transition-all duration-300">
                    <div className="absolute inset-0 bg-gradient-to-br from-pink-500/0 to-pink-600/0 group-hover:from-pink-500/5 group-hover:to-pink-600/5 transition-all duration-300"></div>
                    <div className="relative">
                      <p className="text-xs font-semibold text-pink-600 uppercase tracking-wider">Gender</p>
                      <p className="mt-2 text-sm font-medium text-gray-900">{userData.userData.selectedGender}</p>
                    </div>
                  </div>
                )}

                {/* Women's Health Status Card */}
                {userData.userData.selectedGender === 'FEMALE' && userData.userData.selectedFemininOption && (
                  <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-teal-50/50 to-teal-100/30 backdrop-blur-sm border border-teal-200/30 p-5 hover:shadow-lg transition-all duration-300">
                    <div className="absolute inset-0 bg-gradient-to-br from-teal-500/0 to-teal-600/0 group-hover:from-teal-500/5 group-hover:to-teal-600/5 transition-all duration-300"></div>
                    <div className="relative">
                      <p className="text-xs font-semibold text-teal-600 uppercase tracking-wider">Women's Health Status</p>
                      <p className="mt-2 text-sm font-medium text-gray-900">{userData.userData.selectedFemininOption}</p>
                    </div>
                  </div>
                )}

                {/* Birth Date Card */}
                {userData.userData.selectedBirthDate && (
                  <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-orange-50/50 to-orange-100/30 backdrop-blur-sm border border-orange-200/30 p-5 hover:shadow-lg transition-all duration-300">
                    <div className="absolute inset-0 bg-gradient-to-br from-orange-500/0 to-orange-600/0 group-hover:from-orange-500/5 group-hover:to-orange-600/5 transition-all duration-300"></div>
                    <div className="relative">
                      <p className="text-xs font-semibold text-orange-600 uppercase tracking-wider">Birth Date</p>
                      <p className="mt-2 text-sm font-medium text-gray-900">{userData.userData.selectedBirthDate}</p>
                    </div>
                  </div>
                )}

                {/* Height Card */}
                {userData.userData.selectedHeight && (
                  <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-green-50/50 to-green-100/30 backdrop-blur-sm border border-green-200/30 p-5 hover:shadow-lg transition-all duration-300">
                    <div className="absolute inset-0 bg-gradient-to-br from-green-500/0 to-green-600/0 group-hover:from-green-500/5 group-hover:to-green-600/5 transition-all duration-300"></div>
                    <div className="relative">
                      <p className="text-xs font-semibold text-green-600 uppercase tracking-wider">Height</p>
                      <p className="mt-2 text-sm font-medium text-gray-900">
                        {userData.userData.selectedHeight} {userData.userData.selectedHeightMeasurementUnit === 'METRIC' ? 'cm' : 'in'}
                      </p>
                    </div>
                  </div>
                )}

                {/* Current Weight Card */}
                {userData.userData.selectedWeight && (
                  <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-cyan-50/50 to-cyan-100/30 backdrop-blur-sm border border-cyan-200/30 p-5 hover:shadow-lg transition-all duration-300">
                    <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/0 to-cyan-600/0 group-hover:from-cyan-500/5 group-hover:to-cyan-600/5 transition-all duration-300"></div>
                    <div className="relative">
                      <p className="text-xs font-semibold text-cyan-600 uppercase tracking-wider">Current Weight</p>
                      <p className="mt-2 text-sm font-medium text-gray-900">
                        {userData.userData.selectedWeight} {userData.userData.selectedWeightMeasurementUnit === 'METRIC' ? 'kg' : 'lb'}
                      </p>
                    </div>
                  </div>
                )}

                {/* Target Weight Card */}
                {userData.userData.selectedTargetWeight && (
                  <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-50/50 to-indigo-100/30 backdrop-blur-sm border border-indigo-200/30 p-5 hover:shadow-lg transition-all duration-300">
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/0 to-indigo-600/0 group-hover:from-indigo-500/5 group-hover:to-indigo-600/5 transition-all duration-300"></div>
                    <div className="relative">
                      <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wider">Target Weight</p>
                      <p className="mt-2 text-sm font-medium text-gray-900">
                        {userData.userData.selectedTargetWeight} {userData.userData.selectedTargetWeightMeasurementUnit === 'METRIC' ? 'kg' : 'lb'}
                      </p>
                    </div>
                  </div>
                )}

                {/* Activity Level Card */}
                {userData.userData.selectedActivityType && (
                  <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-50/50 to-amber-100/30 backdrop-blur-sm border border-amber-200/30 p-5 hover:shadow-lg transition-all duration-300">
                    <div className="absolute inset-0 bg-gradient-to-br from-amber-500/0 to-amber-600/0 group-hover:from-amber-500/5 group-hover:to-amber-600/5 transition-all duration-300"></div>
                    <div className="relative">
                      <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider">Activity Level</p>
                      <p className="mt-2 text-sm font-medium text-gray-900">{userData.userData.selectedActivityType.replace(/_/g, ' ')}</p>
                    </div>
                  </div>
                )}

                {/* Goal Card */}
                {userData.userData.selectedGoalType && (
                  <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-rose-50/50 to-rose-100/30 backdrop-blur-sm border border-rose-200/30 p-5 hover:shadow-lg transition-all duration-300">
                    <div className="absolute inset-0 bg-gradient-to-br from-rose-500/0 to-rose-600/0 group-hover:from-rose-500/5 group-hover:to-rose-600/5 transition-all duration-300"></div>
                    <div className="relative">
                      <p className="text-xs font-semibold text-rose-600 uppercase tracking-wider">Goal</p>
                      <p className="mt-2 text-sm font-medium text-gray-900">{userData.userData.selectedGoalType.replace(/_/g, ' ')}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Login Details - Glass Morphism */}
        {userData.loginDetails && (
          <div className="relative overflow-hidden rounded-3xl backdrop-blur-xl bg-gradient-to-br from-white/90 to-white/70 border border-white/20 shadow-2xl p-8">
            <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 to-orange-500/5 pointer-events-none"></div>

            <div className="relative">
              <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-100 to-red-50 flex items-center justify-center mr-3">
                  <LockClosedIcon className="w-5 h-5 text-red-600" />
                </div>
                Login Details
              </h3>

              <div className="space-y-0">
                <div className="flex items-start py-4 border-b border-white/20">
                  <div className="flex-shrink-0 mt-1">
                    <CheckCircleIcon className="w-5 h-5 text-green-400" />
                  </div>
                  <div className="ml-4 flex-1">
                    <p className="text-sm font-medium text-gray-500">Logged In Status</p>
                    <p className="mt-1 text-sm text-gray-900 font-medium">
                      <span className="inline-block px-3 py-1 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200/50 rounded-lg text-green-700 text-xs font-semibold">
                        {userData.loginDetails.isLoggedIn === 'true' ||
                        userData.loginDetails.isLoggedIn === true
                          ? 'Active'
                          : 'Inactive'}
                      </span>
                    </p>
                  </div>
                </div>

                {userData.loginDetails.lastLoginDate && (
                  <div className="flex items-start py-4 border-b border-white/20">
                    <div className="flex-shrink-0 mt-1">
                      <CalendarIcon className="w-5 h-5 text-red-400" />
                    </div>
                    <div className="ml-4 flex-1">
                      <p className="text-sm font-medium text-gray-500">Last Login</p>
                      <p className="mt-1 text-sm text-gray-900 font-medium">
                        {formatDate(userData.loginDetails.lastLoginDate)}
                      </p>
                    </div>
                  </div>
                )}

                {userData.loginDetails.loginCount && (
                  <div className="flex items-start py-4 border-b border-white/20">
                    <div className="flex-shrink-0 mt-1">
                      <UserIcon className="w-5 h-5 text-red-400" />
                    </div>
                    <div className="ml-4 flex-1">
                      <p className="text-sm font-medium text-gray-500">Login Count</p>
                      <p className="mt-1 text-sm text-gray-900 font-medium">
                        {userData.loginDetails.loginCount}
                      </p>
                    </div>
                  </div>
                )}

                <div className="py-4">
                  <button
                    onClick={handleLogout}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
                  >
                    <ArrowRightOnRectangleIcon className="w-4 h-4" />
                    Logout
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">My Profile</h1>
        <p className="mt-2 text-gray-600">
          Manage your account settings and preferences
        </p>
      </div>

      {/* Firebase User Info - Glass Morphism */}
      <div className="mb-6">
        <div className="relative overflow-hidden rounded-3xl backdrop-blur-xl bg-gradient-to-br from-white/80 to-white/40 border border-white/20 shadow-2xl p-8">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 pointer-events-none"></div>
          <div className="relative flex items-center gap-6">
            {/* Avatar Display */}
            <div className="flex-shrink-0">
              <div className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-white/30 shadow-lg bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center backdrop-blur-sm">
                {selectedAvatarForEdit?.avatarUrl ? (
                  <img
                    src={selectedAvatarForEdit.avatarUrl}
                    alt="Profile"
                    className="w-full h-full object-cover"
                    loading="lazy"
                    onError={e => {
                      e.target.style.display = 'none'
                    }}
                  />
                ) : currentUser?.photoURL ? (
                  <img
                    src={currentUser.photoURL}
                    alt="Profile"
                    className="w-full h-full object-cover"
                    loading="lazy"
                    onError={e => {
                      e.target.style.display = 'none'
                    }}
                  />
                ) : (
                  <UserIcon className="w-10 h-10 text-gray-400" />
                )}
              </div>
            </div>
            {/* User Info */}
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-gray-900">
                {currentUser?.displayName ||
                  currentUser?.email?.split('@')[0] ||
                  'User'}
              </h2>
              <p className="text-sm text-gray-600 mt-1">{currentUser?.email}</p>
              <div className="mt-3 flex gap-2">
                <span
                  className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold backdrop-blur-md ${
                    isAdmin
                      ? 'bg-gradient-to-r from-yellow-400/30 to-yellow-500/30 text-yellow-800 border border-yellow-200/30'
                      : 'bg-gradient-to-r from-blue-400/30 to-blue-500/30 text-blue-800 border border-blue-200/30'
                  }`}
                >
                  {isAdmin ? '👑 Administrator' : '👤 User'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* User Details */}
      {renderUserDetails()}
    </div>
  )
}

export default Settings
