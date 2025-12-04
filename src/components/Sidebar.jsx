import { useState } from 'react'
import { useSelector } from 'react-redux'
import {
  HomeIcon,
  UsersIcon,
  UserGroupIcon,
  ChartBarIcon,
  CogIcon,
  ListBulletIcon,
  CakeIcon,
  BookOpenIcon
} from '@heroicons/react/24/outline'
import { useAuth } from '../contexts/AuthContext'
import { selectIsAdmin, selectIsNutritionist } from '../store/userSlice'

const Sidebar = ({ activePage, setActivePage }) => {
  const { currentUser } = useAuth()
  const isAdmin = useSelector(selectIsAdmin)
  const isNutritionist = useSelector(selectIsNutritionist)
  const [imageError, setImageError] = useState(false)
  
  const allMenuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: HomeIcon, adminOnly: true },
    { id: 'myday', label: 'My Day', icon: HomeIcon, adminOnly: false },
    { id: 'myusers', label: 'My Users', icon: UsersIcon, nutritionistOnly: true },
    { id: 'mymenus', label: 'My Menus', icon: CakeIcon, nutritionistOnly: true },
    { id: 'users', label: 'Users', icon: UsersIcon, adminOnly: true },
    { id: 'unapprovedItems', label: 'Unapproved Items', icon: ListBulletIcon, adminOnly: true },
    { id: 'menus', label: 'Menus', icon: CakeIcon, adminOnly: true },
    { id: 'recipes', label: 'Recipes', icon: BookOpenIcon, adminOnly: true },
    { id: 'subscribers', label: 'Subscribers', icon: UserGroupIcon, adminOnly: true },
    { id: 'analytics', label: 'Analytics', icon: ChartBarIcon, adminOnly: true },
    { id: 'settings', label: 'Settings', icon: CogIcon, adminOnly: false },
  ]

  // Filter menu items based on admin/nutritionist status
  const menuItems = allMenuItems.filter(item => {
    if (item.adminOnly && !isAdmin) return false
    if (item.nutritionistOnly && !isNutritionist) return false
    return true
  })

  // Get user display info
  const getUserDisplayName = () => {
    if (currentUser?.displayName) {
      return currentUser.displayName
    }
    if (currentUser?.email) {
      return currentUser.email.split('@')[0]
    }
    return 'Admin User'
  }

  const getUserInitial = () => {
    const displayName = getUserDisplayName()
    return displayName.charAt(0).toUpperCase()
  }

  return (
    <div className="w-64 bg-white shadow-lg border-r border-gray-200">
      <div className="p-6">
        <h1 className="text-2xl font-bold text-gray-900">AlexaFit</h1>
        <p className="text-sm text-gray-500 mt-1">Backoffice</p>
      </div>

      <nav className="mt-6">
        <div className="px-3">
          {menuItems.map((item) => {
            const Icon = item.icon
            const isActive = activePage === item.id

            return (
              <button
                key={item.id}
                onClick={() => setActivePage(item.id)}
                className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg mb-1 transition-colors duration-200 cursor-pointer ${isActive
                  ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-600'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
              >
                <Icon className="w-5 h-5 mr-3" />
                {item.label}
              </button>
            )
          })}
        </div>
      </nav>

      <div className="absolute bottom-0 w-64 p-6 border-t border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => setActivePage('settings')}>
        <div className="flex items-center">
          {currentUser?.photoURL && !imageError ? (
            <img 
              src={currentUser.photoURL} 
              alt="User avatar"
              className="w-8 h-8 rounded-full"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
              <span className="text-white text-sm font-medium">{getUserInitial()}</span>
            </div>
          )}
          <div className="ml-3 overflow-hidden">
            <p className="text-sm font-medium text-gray-900 truncate" title={getUserDisplayName()}>
              {getUserDisplayName()}
            </p>
            <p className="text-xs text-gray-500 truncate" title={currentUser?.email || ''}>
              {currentUser?.email || 'Backoffice Admin'}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Sidebar
