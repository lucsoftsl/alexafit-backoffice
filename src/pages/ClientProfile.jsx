import { useState, useEffect } from 'react'
import ClientProgress from '../components/ClientProgress'
import { saveUserDataFromWelcomeScreen, getUserCheckins } from '../services/loggedinApi'
import { PencilIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline'
import FormSelect from '../components/FormSelect'

const formatDate = (val) => {
  if (!val) return 'N/A'
  try {
    return new Date(val).toLocaleDateString()
  } catch {
    return val
  }
}

const InfoRow = ({ label, value }) => (
  <div className="flex justify-between items-center py-2">
    <span className="text-sm text-gray-600">{label}</span>
    <span className="text-sm font-medium text-gray-900 text-right truncate">{value || 'N/A'}</span>
  </div>
)

const ClientProfile = ({ client }) => {
  const [editGoalMode, setEditGoalMode] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)
  const [goalData, setGoalData] = useState(null)
  const [formData, setFormData] = useState({
    selectedTargetWeight: '',
    selectedTargetWeightMeasurementUnit: 'METRIC',
    selectedGoalType: ''
  })

  // Fetch goal data from progress API
  useEffect(() => {
    const fetchGoalData = async () => {
      if (!client?.userId) return
      
      try {
        const response = await getUserCheckins({ userId: client.userId })
        const goal = response?.data?.data?.data?.goal || response?.data?.data?.goal || null
        setGoalData(goal)
        
        // Initialize form data from client's userData or goal data
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
    
    fetchGoalData()
  }, [client])

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
      setError(err.message || 'Failed to save goal. Please try again.')
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
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Client Profile</h2>
        <p className="text-gray-600">Select a client from the Clients list to view their profile.</p>
      </div>
    )
  }

  const name = client?.userData?.name || client?.loginDetails?.displayName || `${client?.firstName || ''} ${client?.lastName || ''}`.trim() || 'Unknown'
  const email = client?.loginDetails?.email || client?.email || 'N/A'
  const accountStatus = (client?.status || '').toString().toLowerCase()
  const statusLabel = accountStatus ? accountStatus.charAt(0).toUpperCase() + accountStatus.slice(1) : 'Unknown'
  const assignedDate = formatDate(client?.dateTimeAssigned)
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
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Details</h2>
        <div className="divide-y divide-gray-200">
          <InfoRow label="Assigned Date" value={assignedDate} />
          <InfoRow label="User ID" value={Array.isArray(client?.userId) ? client.userId[0] : client?.userId || 'N/A'} />
          <InfoRow label="Email" value={email} />
        </div>
      </div>

      {/* Goal Management Card */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Goal & Target Weight</h2>
          {!editGoalMode && (
            <button
              onClick={() => setEditGoalMode(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-md hover:shadow-lg"
            >
              <PencilIcon className="w-4 h-4" />
              Edit Goal
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
            Goal updated successfully!
          </div>
        )}

        {editGoalMode ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Target Weight */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
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

              {/* Goal Type */}
              <FormSelect
                label="Goal Type"
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
            <div className="flex gap-3 pt-4 border-t border-gray-200">
              <button
                onClick={handleSaveGoal}
                disabled={loading}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-green-500 to-green-600 rounded-lg hover:from-green-600 hover:to-green-700 transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <CheckIcon className="w-4 h-4" />
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
              <button
                onClick={handleCancelGoalEdit}
                disabled={loading}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-gray-700 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <XMarkIcon className="w-4 h-4" />
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Goal Type Display */}
            <div className="p-4 bg-gradient-to-br from-purple-50 to-purple-100/50 rounded-lg border border-purple-200/50">
              <p className="text-xs font-semibold text-purple-600 uppercase tracking-wider mb-2">Goal Type</p>
              <p className="text-lg font-bold text-gray-900">
                {formData.selectedGoalType ? formData.selectedGoalType.replace(/_/g, ' ') : goalData?.goalType?.replace(/_/g, ' ') || 'Not Set'}
              </p>
            </div>

            {/* Target Weight Display */}
            <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-lg border border-blue-200/50">
              <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-2">Target Weight</p>
              <p className="text-lg font-bold text-gray-900">
                {formData.selectedTargetWeight || goalData?.targetWeight || 'Not Set'} 
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
