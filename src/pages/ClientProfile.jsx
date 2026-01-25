import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import ClientProgress from '../components/ClientProgress'
import { saveUserDataFromWelcomeScreen, getUserCheckins } from '../services/loggedinApi'
import { PencilIcon, CheckIcon, XMarkIcon, ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline'
import FormSelect from '../components/FormSelect'

// Module-scoped guard to persist across StrictMode remounts in dev
const goalDataGuard = new Set()

const formatDate = (val, t) => {
  if (!val) return t('common.na')
  try {
    return new Date(val).toLocaleDateString()
  } catch {
    return val
  }
}

const InfoRow = ({ label, value }) => (
  <div className="flex justify-between items-center py-2">
    <span className="text-sm text-gray-600">{label}</span>
    <span className="text-sm font-medium text-gray-900 text-right truncate">{value}</span>
  </div>
)

const ClientProfile = ({ client }) => {
  const { t } = useTranslation()
  const [editGoalMode, setEditGoalMode] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)
  const [goalData, setGoalData] = useState(null)
  const [detailsExpanded, setDetailsExpanded] = useState(false)
  const [formData, setFormData] = useState({
    selectedTargetWeight: '',
    selectedTargetWeightMeasurementUnit: 'METRIC',
    selectedGoalType: ''
  })
  const goalDataLoadedRef = useRef(new Set())

  const fetchGoalData = async () => {
    if (!client?.userId) return
    try {
      const response = await getUserCheckins({ userId: client.userId })
      const goal = response?.data?.data?.data?.goal || response?.data?.data?.goal || null
      setGoalData(goal)

      if (client?.userData) {
        setFormData({
          selectedTargetWeight: client.userData.selectedTargetWeight || goal?.targetWeight || '',
          selectedTargetWeightMeasurementUnit: client.userData.selectedTargetWeightMeasurementUnit || 'METRIC',
          selectedGoalType: client.userData.selectedGoalType || goal?.goalType || ''
        })
      }
    } catch (err) {
      console.error('Error fetching goal data:', err)
    }
  }

  // Fetch goal data from progress API
  useEffect(() => {
    if (client?.userId) {
      // Guard to avoid duplicate calls in React 18 StrictMode/dev
      // useRef Set does not persist across StrictMode remounts; use module-scoped guard
      const uid = Array.isArray(client.userId) ? client.userId[0] : client.userId
      if (!goalDataGuard.has(uid)) {
        goalDataGuard.add(uid)
        // Also track in ref to avoid repeated calls within same mount
        goalDataLoadedRef.current.add(uid)
        fetchGoalData()
      }
    }
  }, [client?.userId])

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSaveGoal = async () => {
    setLoading(true)
    setError(null)
    setSuccess(false)

    try {
      const updatedUserData = {
        ...client.userData,
        selectedTargetWeight: formData.selectedTargetWeight,
        selectedTargetWeightMeasurementUnit: formData.selectedTargetWeightMeasurementUnit,
        selectedGoalType: formData.selectedGoalType
      }

      // Call saveUserDataFromWelcomeScreen with CLIENT's userId (not nutritionist's)
      await saveUserDataFromWelcomeScreen({
        userData: updatedUserData,
        userId: client.userId,
        selectedDate: new Date().toISOString().split('T')[0]
      })

      setSuccess(true)
      setEditGoalMode(false)

      // Refetch goal data to update display
      const response = await getUserCheckins({ userId: client.userId })
      const goal = response?.data?.data?.data?.goal || response?.data?.data?.goal || null
      setGoalData(goal)

      // Reset success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      setError(err.message || t('pages.clientProfile.errors.saveFailed'))
      console.error('Error saving goal data:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleCancelGoalEdit = () => {
    // Reset form to original values
    if (client?.userData) {
      setFormData({
        selectedTargetWeight: client.userData.selectedTargetWeight || goalData?.targetWeight || '',
        selectedTargetWeightMeasurementUnit: client.userData.selectedTargetWeightMeasurementUnit || 'METRIC',
        selectedGoalType: client.userData.selectedGoalType || goalData?.goalType || ''
      })
    }
    setEditGoalMode(false)
    setError(null)
  }
  if (!client) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">{t('pages.clientProfile.title')}</h2>
        <p className="text-gray-600">{t('pages.clientProfile.selectPrompt')}</p>
      </div>
    )
  }

  const name = client?.userData?.name || client?.loginDetails?.displayName || `${client?.firstName || ''} ${client?.lastName || ''}`.trim() || t('common.unknown')
  const email = client?.loginDetails?.email || client?.email || t('common.na')
  const accountStatus = (client?.status || '').toString().toLowerCase()
  const statusLabel = accountStatus ? accountStatus.charAt(0).toUpperCase() + accountStatus.slice(1) : t('common.unknown')
  const assignedDate = formatDate(client?.dateTimeAssigned, t)
  const avatar = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-full bg-blue-600 flex items-center justify-center text-white font-semibold text-lg">
            {avatar}
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{name}</h1>
            <p className="text-gray-600">{email}</p>
          </div>
          <span className={`ml-auto px-3 py-1 text-xs font-semibold rounded-full ${accountStatus === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'}`}>
            {statusLabel}
          </span>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">{t('pages.clientProfile.details')}</h2>
          <button
            onClick={() => setDetailsExpanded(!detailsExpanded)}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            <span>{detailsExpanded ? t('pages.clientProfile.showLess') : t('pages.clientProfile.showMore')}</span>
            {detailsExpanded ? (
              <ChevronUpIcon className="w-5 h-5" />
            ) : (
              <ChevronDownIcon className="w-5 h-5" />
            )}
          </button>
        </div>
        <div className="divide-y divide-gray-200">
          {/* Always visible fields */}
          <InfoRow label={t('common.User ID')} value={Array.isArray(client?.userId) ? client.userId[0] : client?.userId || t('common.na')} />
          <InfoRow label={t('common.Email')} value={email} />
          
          {/* Collapsible fields */}
          {detailsExpanded && (
            <>
              <InfoRow label={t('pages.clientProfile.assignedDate')} value={assignedDate} />
              {client?.loginDetails?.phoneNumber && (
                <InfoRow label={t('pages.clientProfile.phoneNumber')} value={client.loginDetails.phoneNumber} />
              )}
              {client?.userData?.selectedGender && (
                <InfoRow label={t('pages.clientProfile.gender')} value={t(`pages.clientProfile.genders.${client.userData.selectedGender}`)} />
              )}
              {client?.userData?.selectedBirthDate && (
                <InfoRow label={t('pages.clientProfile.birthDate')} value={formatDate(client.userData.selectedBirthDate, t)} />
              )}
              {client?.userData?.selectedHeight && (
                <InfoRow 
                  label={t('pages.clientProfile.height')} 
                  value={`${client.userData.selectedHeight} ${client.userData.selectedHeightMeasurementUnit === 'METRIC' ? 'cm' : 'in'}`} 
                />
              )}
              {client?.userData?.selectedWeight && (
                <InfoRow 
                  label={t('pages.clientProfile.weight')} 
                  value={`${client.userData.selectedWeight} ${client.userData.selectedWeightMeasurementUnit === 'METRIC' ? 'kg' : 'lb'}`} 
                />
              )}
              {client?.userData?.selectedActivityType && (
                <InfoRow label={t('pages.clientProfile.activityType')} value={t(`pages.clientProfile.activityTypes.${client.userData.selectedActivityType}`)} />
              )}
              {client?.loginDetails?.country && (
                <InfoRow label={t('pages.clientProfile.country')} value={client.loginDetails.country} />
              )}
              {client?.loginDetails?.city && (
                <InfoRow label={t('pages.clientProfile.city')} value={client.loginDetails.city} />
              )}
              {client?.loginDetails?.contactPreference && (
                <InfoRow label={t('pages.clientProfile.contactPreference')} value={client.loginDetails.contactPreference} />
              )}
              {client?.subscriptionWhitelistDetails?.isPro && (
                <InfoRow 
                  label={t('pages.clientProfile.subscription')} 
                  value={client.subscriptionWhitelistDetails.isPro === 'true' ? t('pages.clientProfile.proSubscription') : t('pages.clientProfile.freeSubscription')} 
                />
              )}
              {client?.subscriptionWhitelistDetails?.activeSince && (
                <InfoRow label={t('pages.clientProfile.subscriptionActiveSince')} value={formatDate(client.subscriptionWhitelistDetails.activeSince, t)} />
              )}
              {client?.foodTables && (
                <InfoRow label={t('pages.clientProfile.foodTables')} value={client.foodTables} />
              )}
              {client?.userType && (
                <InfoRow label={t('pages.clientProfile.userType')} value={client.userType} />
              )}
              {client?.loginDetails?.emailVerified !== undefined && (
                <InfoRow 
                  label={t('pages.clientProfile.emailVerified')} 
                  value={client.loginDetails.emailVerified ? t('common.Yes') : t('common.No')} 
                />
              )}
              {client?.loginDetails?.lastLoggedInDateTime && (
                <InfoRow label={t('pages.clientProfile.lastLoggedIn')} value={formatDate(client.loginDetails.lastLoggedInDateTime, t)} />
              )}
              {client?.dateTimeCreated && (
                <InfoRow label={t('pages.clientProfile.accountCreated')} value={formatDate(client.dateTimeCreated, t)} />
              )}
              {client?.dateTimeUpdated && (
                <InfoRow label={t('pages.clientProfile.lastUpdated')} value={formatDate(client.dateTimeUpdated, t)} />
              )}
            </>
          )}
        </div>
      </div>

      {/* Goal Management Card */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">{t('pages.clientProfile.goalCardTitle')}</h2>
          {!editGoalMode && (
            <button
              onClick={() => setEditGoalMode(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-md hover:shadow-lg"
            >
              <PencilIcon className="w-4 h-4" />
                {t('pages.clientProfile.editGoal')}
            </button>
          )}
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
            {t('pages.clientProfile.successUpdate')}
          </div>
        )}

        {editGoalMode ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Target Weight */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('pages.clientProfile.targetWeight')}
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    name="selectedTargetWeight"
                    value={formData.selectedTargetWeight}
                    onChange={handleInputChange}
                    placeholder={t('pages.clientProfile.targetWeightPlaceholder')}
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

              {/* Goal Type */}
              <FormSelect
                label={t('pages.clientProfile.goalType')}
                name="selectedGoalType"
                value={formData.selectedGoalType}
                onChange={handleInputChange}
                options={[
                  { value: 'LOSE_WEIGHT', label: t('pages.clientProfile.goalTypes.LOSE_WEIGHT') },
                  { value: 'MAINTAIN_WEIGHT', label: t('pages.clientProfile.goalTypes.MAINTAIN_WEIGHT') },
                  { value: 'GAIN_WEIGHT', label: t('pages.clientProfile.goalTypes.GAIN_WEIGHT') }
                ]}
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4 border-t border-gray-200">
              <button
                onClick={handleSaveGoal}
                disabled={loading}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-green-500 to-green-600 rounded-lg hover:from-green-600 hover:to-green-700 transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <CheckIcon className="w-4 h-4" />
                {loading ? t('pages.clientProfile.saving') : t('pages.clientProfile.saveChanges')}
              </button>
              <button
                onClick={handleCancelGoalEdit}
                disabled={loading}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-gray-700 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <XMarkIcon className="w-4 h-4" />
                {t('common.cancel')}
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Goal Type Display */}
            <div className="p-4 bg-gradient-to-br from-purple-50 to-purple-100/50 rounded-lg border border-purple-200/50">
              <p className="text-xs font-semibold text-purple-600 uppercase tracking-wider mb-2">{t('pages.clientProfile.goalType')}</p>
              <p className="text-lg font-bold text-gray-900">
                {formData.selectedGoalType ? t(`pages.clientProfile.goalTypes.${formData.selectedGoalType}`) : (goalData?.goalType ? t(`pages.clientProfile.goalTypes.${goalData.goalType}`) : t('pages.clientProfile.notSet'))}
              </p>
            </div>

            {/* Target Weight Display */}
            <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-lg border border-blue-200/50">
              <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-2">{t('pages.clientProfile.targetWeight')}</p>
              <p className="text-lg font-bold text-gray-900">
                {formData.selectedTargetWeight || goalData?.targetWeight || t('pages.clientProfile.notSet')}
                {(formData.selectedTargetWeight || goalData?.targetWeight) && (
                  <span className="text-sm text-gray-600 ml-1">
                    {formData.selectedTargetWeightMeasurementUnit === 'METRIC' ? 'kg' : 'lb'}
                  </span>
                )}
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
        <ClientProgress client={client} />
      </div>
    </div>
  )
}

export default ClientProfile
