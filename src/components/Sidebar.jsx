import { useSelector } from 'react-redux'
import {
  HomeIcon,
  UsersIcon,
  UserGroupIcon,
  ChartBarIcon,
  CogIcon,
  ListBulletIcon,
  CakeIcon,
  BookOpenIcon,
  UserCircleIcon,
  ClipboardDocumentListIcon,
  ArrowUturnLeftIcon
} from '@heroicons/react/24/outline'
import { useAuth } from '../contexts/AuthContext'
import { selectIsAdmin, selectIsNutritionist } from '../store/userSlice'

const Sidebar = ({
  activePage,
  onNavigate,
  isMobileOpen = false,
  onClose,
  variant = 'main',
  onBackToMain,
  activeClientMenuItem = 'all-clients',
  onClientMenuSelect
}) => {
  const { currentUser } = useAuth()
  const isAdmin = useSelector(selectIsAdmin)
  const isNutritionist = useSelector(selectIsNutritionist)

  const allMenuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: HomeIcon, adminOnly: true },
    { id: 'myday', label: 'My Day', icon: HomeIcon, adminOnly: false },
    { id: 'progress', label: 'Progress', icon: ChartBarIcon, adminOnly: false },
    { id: 'myusers', label: 'Clients', icon: UsersIcon, nutritionistOnly: true },
    { id: 'mymenus', label: 'My Menus', icon: CakeIcon, nutritionistOnly: true },
    { id: 'users', label: 'Users', icon: UsersIcon, adminOnly: true },
    { id: 'unapprovedItems', label: '⏳ Items', icon: ListBulletIcon, adminOnly: true },
    { id: 'menus', label: 'Menus', icon: CakeIcon, adminOnly: true },
    { id: 'recipes', label: 'Recipes', icon: BookOpenIcon, adminOnly: true },
    { id: 'subscribers', label: 'Subscribers', icon: UserGroupIcon, adminOnly: true },
    { id: 'analytics', label: 'Analytics', icon: ChartBarIcon, adminOnly: true },
    { id: 'settings', label: 'My Profile', icon: CogIcon, adminOnly: false },
  ]

  // Filter menu items based on admin/nutritionist status
  const menuItems = allMenuItems.filter(item => {
    if (item.adminOnly && !isAdmin) return false
    if (item.nutritionistOnly && !isNutritionist) return false
    return true
  })

  const clientMenuItems = [
    { id: 'profile', label: 'Client Profile', icon: UserCircleIcon },
    { id: 'journal', label: 'Client Journal', icon: ClipboardDocumentListIcon },
    { id: 'meal-plans', label: 'Client Meal Plans', icon: CakeIcon },
    { id: 'all-clients', label: 'All Clients', icon: UsersIcon }
  ]

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

  const handleNavigate = (pageId) => {
    if (onNavigate) {
      onNavigate(pageId)
    }
    if (onClose) {
      onClose()
    }
  }

  const handleClientSelect = (itemId) => {
    if (onClientMenuSelect) {
      onClientMenuSelect(itemId)
    }
    if (onClose) {
      onClose()
    }
  }

  return (
    <>
      <div
        className={`fixed inset-0 z-30 bg-black/40 transition-opacity duration-200 md:hidden ${isMobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 transform bg-white shadow-lg border-r border-gray-200 transition-transform duration-200 md:static md:translate-x-0 md:flex md:flex-col ${isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}
      >
        <div className="flex h-full flex-col">
          <div className="p-6">
            {variant === 'clients' ? (
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-xl font-bold text-gray-900">Client Actions</h1>
                  <p className="text-sm text-gray-500 mt-1">Quick links for this client</p>
                </div>
                <button
                  onClick={onBackToMain}
                  className="p-2 rounded-full text-gray-500 hover:text-gray-800 hover:bg-gray-100"
                  aria-label="Back to main menu"
                >
                  <ArrowUturnLeftIcon className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <div>
                <h1 className="text-2xl font-bold text-gray-900">AlexaFit</h1>
                <p className="text-sm text-gray-500 mt-1">Nutrition Guide</p>
              </div>
            )}
          </div>

          {variant === 'clients' ? (
            <nav className="mt-2 flex-1 overflow-y-auto">
              <div className="px-3 pb-4 space-y-1">
                {clientMenuItems.map((item) => {
                  const Icon = item.icon
                  const isActive = activeClientMenuItem === item.id
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleClientSelect(item.id)}
                      className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors duration-200 cursor-pointer ${isActive
                        ? 'bg-purple-50 text-purple-700 border-r-2 border-purple-600'
                        : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                        }`}
                    >
                      <Icon className="w-5 h-5 mr-3" />
                      {item.label}
                    </button>
                  )
                })}
              </div>
            </nav>
          ) : (
            <nav className="mt-2 flex-1 overflow-y-auto">
              <div className="px-3 pb-4">
                {menuItems.map((item) => {
                  const Icon = item.icon
                  const isActive = activePage === item.id

                  return (
                    <button
                      key={item.id}
                      onClick={() => handleNavigate(item.id)}
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
          )}

          <div
            className="mt-auto w-full p-6 border-t border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors"
            onClick={() => handleNavigate('settings')}
          >
            <div className="flex items-center">
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-medium">{getUserInitial()}</span>
              </div>
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
      </aside>
    </>
  )
}

export default Sidebar
