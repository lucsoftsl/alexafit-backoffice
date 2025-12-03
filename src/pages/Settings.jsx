import { useSelector } from 'react-redux'
import { useAuth } from '../contexts/AuthContext'
import { selectUserData, selectIsAdmin, selectUserType } from '../store/userSlice'
import {
  UserIcon,
  EnvelopeIcon,
  ShieldCheckIcon,
  CalendarIcon,
  IdentificationIcon,
  CheckCircleIcon,
  XCircleIcon
} from '@heroicons/react/24/outline'

const Settings = () => {
  const { currentUser } = useAuth()
  const userData = useSelector(selectUserData)
  const isAdmin = useSelector(selectIsAdmin)
  const userType = useSelector(selectUserType)

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

  const InfoRow = ({ icon: Icon, label, value, highlight = false }) => (
    <div className="flex items-start py-4 border-b border-gray-200 last:border-0">
      <div className="flex-shrink-0 mt-1">
        <Icon className="w-5 h-5 text-gray-400" />
      </div>
      <div className="ml-4 flex-1">
        <p className="text-sm font-medium text-gray-500">{label}</p>
        <p
          className={`mt-1 text-sm ${highlight ? 'font-semibold text-blue-600' : 'text-gray-900'}`}
        >
          {value || 'N/A'}
        </p>
      </div>
    </div>
  )

  const renderUserDetails = () => {
    if (!userData) {
      return (
        <div className="text-center py-8">
          <p className="text-gray-500">No user data available</p>
        </div>
      )
    }

    return (
      <div className="space-y-6">
        {/* Account Information */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <UserIcon className="w-5 h-5 mr-2" />
            Account Information
          </h3>
          <div className="space-y-0">
            <InfoRow
              icon={IdentificationIcon}
              label="User ID"
              value={userData.userId || currentUser?.uid}
            />
            <InfoRow
              icon={EnvelopeIcon}
              label="Email"
              value={userData.email || currentUser?.email}
            />
            <InfoRow
              icon={ShieldCheckIcon}
              label="User Type"
              value={userType}
              highlight={true}
            />
            <InfoRow
              icon={isAdmin ? CheckCircleIcon : XCircleIcon}
              label="Admin Status"
              value={isAdmin ? 'Administrator' : 'Regular User'}
              highlight={isAdmin}
            />
          </div>
        </div>

        {/* Login Details */}
        {userData.loginDetails && (
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <CalendarIcon className="w-5 h-5 mr-2" />
              Login Details
            </h3>
            <div className="space-y-0">
              <InfoRow
                icon={CheckCircleIcon}
                label="Logged In Status"
                value={
                  userData.loginDetails.isLoggedIn === 'true' ||
                  userData.loginDetails.isLoggedIn === true
                    ? 'Active'
                    : 'Inactive'
                }
              />
              {userData.loginDetails.lastLoginDate && (
                <InfoRow
                  icon={CalendarIcon}
                  label="Last Login"
                  value={formatDate(userData.loginDetails.lastLoginDate)}
                />
              )}
              {userData.loginDetails.loginCount && (
                <InfoRow
                  icon={UserIcon}
                  label="Login Count"
                  value={userData.loginDetails.loginCount}
                />
              )}
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="mt-2 text-gray-600">
          Manage your account settings and preferences
        </p>
      </div>

      {/* Firebase User Info */}
      <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg shadow-lg p-6 mb-6 text-white">
        <div className="flex items-center">
          {currentUser?.photoURL ? (
            <img
              src={currentUser.photoURL}
              alt="Profile"
              className="w-16 h-16 rounded-full border-4 border-white"
              onError={e => {
                e.target.style.display = 'none'
              }}
            />
          ) : (
            <div className="w-16 h-16 bg-white bg-opacity-20 rounded-full flex items-center justify-center border-4 border-white">
              <UserIcon className="w-8 h-8 text-white" />
            </div>
          )}
          <div className="ml-4">
            <h2 className="text-xl font-bold">
              {currentUser?.displayName || currentUser?.email?.split('@')[0] || 'User'}
            </h2>
            <p className="text-blue-100">{currentUser?.email}</p>
            <div className="mt-2">
              <span
                className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                  isAdmin
                    ? 'bg-green-400 text-green-900'
                    : 'bg-blue-400 text-blue-900'
                }`}
              >
                {isAdmin ? '👑 Administrator' : '👤 User'}
              </span>
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
