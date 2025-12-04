import { useState, useEffect } from 'react'
import { useSelector } from 'react-redux'
import Sidebar from './components/Sidebar'
import Dashboard from './pages/Dashboard'
import MyDay from './pages/MyDay'
import MyUsers from './pages/MyUsers'
import MyMenus from './pages/MyMenus'
import Users from './pages/Users'
import Subscribers from './pages/Subscribers'
import UnapprovedItems from './pages/UnapprovedItems'
import Menus from './pages/Menus'
import Recipes from './pages/Recipes'
import Settings from './pages/Settings'
import Login from './components/Login'
import { useAuth } from './contexts/AuthContext'
import {
  selectIsAdmin,
  selectIsNutritionist,
  selectUserData,
  selectUserLoading,
  selectUserError
} from './store/userSlice'

function App() {
  const [activePage, setActivePage] = useState('dashboard')
  const { currentUser, logout } = useAuth()
  const isAdmin = useSelector(selectIsAdmin)
  const isNutritionist = useSelector(selectIsNutritionist)
  const userData = useSelector(selectUserData)
  const userLoading = useSelector(selectUserLoading)
  const userError = useSelector(selectUserError)

  // Redirect non-admin users to appropriate page after login
  useEffect(() => {
    if (userData && !isAdmin && activePage === 'dashboard') {
      // Nutritionists go to My Users, others go to My Day
      setActivePage(isNutritionist ? 'myusers' : 'myday')
    }
  }, [userData, isAdmin, isNutritionist, activePage])

  const renderPage = () => {
    // Admin-only pages
    const adminPages = ['users', 'subscribers', 'unapprovedItems', 'analytics', 'dashboard']
    // Admin + Nutritionist pages
    const adminOrNutritionistPages = ['menus', 'recipes', 'mymenus']
    // Nutritionist-only pages
    const nutritionistPages = ['myusers']
    
    // Check if current page requires admin access
    if (adminPages.includes(activePage) && !isAdmin) {
      return (
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Restricted</h2>
            <p className="text-gray-600">You don't have permission to access this page.</p>
            <p className="text-sm text-gray-500 mt-2">Admin privileges required.</p>
          </div>
        </div>
      )
    }

    // Check if current page requires admin or nutritionist access
    if (adminOrNutritionistPages.includes(activePage) && !isAdmin && !isNutritionist) {
      return (
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Restricted</h2>
            <p className="text-gray-600">You don't have permission to access this page.</p>
            <p className="text-sm text-gray-500 mt-2">Admin or Nutritionist privileges required.</p>
          </div>
        </div>
      )
    }

    // Check nutritionist-only pages
    if (nutritionistPages.includes(activePage) && !isNutritionist) {
      return (
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Restricted</h2>
            <p className="text-gray-600">You don't have permission to access this page.</p>
            <p className="text-sm text-gray-500 mt-2">Nutritionist privileges required.</p>
          </div>
        </div>
      )
    }

    switch (activePage) {
      case 'dashboard':
        return <Dashboard />
      case 'myday':
        return <MyDay />
      case 'myusers':
        return <MyUsers />
      case 'mymenus':
        return <MyMenus />
      case 'users':
        return <Users />
      case 'subscribers':
        return <Subscribers />
      case 'unapprovedItems':
        return <UnapprovedItems />
      case 'menus':
        return <Menus />
      case 'recipes':
        return <Recipes />
      case 'settings':
        return <Settings />
      default:
        return <Dashboard />
    }
  }

  // Show login page if user is not authenticated
  if (!currentUser) {
    return <Login />
  }

  // Show loading state while fetching user data
  if (userLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading user data...</p>
        </div>
      </div>
    )
  }

  // Show error if user is not authorized
  if (userError || !userData) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-md">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h2>
          <p className="text-gray-700 mb-4">
            {userError || 'You are not authorized to access the backoffice.'}
          </p>
          <p className="text-gray-600 mb-6">
            Your account is not logged in or does not have backoffice access.
          </p>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
          >
            <ArrowRightOnRectangleIcon className="w-4 h-4" />
            Logout
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar activePage={activePage} setActivePage={setActivePage} />
      <main className="flex-1 overflow-y-auto">
        <div className="p-6">
          {/* User info badge */}
          <div className="mb-4 flex items-center gap-2">
            <span className={`px-2 py-1 text-xs font-medium rounded-full ${isAdmin ? 'bg-green-100 text-green-800' : isNutritionist ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>
              {isAdmin ? 'Admin' : isNutritionist ? 'Nutritionist' : 'User'}
            </span>
            {userData?.userType && (
              <span className="text-xs text-gray-500">Type: {userData.userType}</span>
            )}
          </div>
          {renderPage()}
        </div>
      </main>
    </div>
  )
}

export default App