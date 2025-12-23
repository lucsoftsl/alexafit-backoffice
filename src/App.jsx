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
import UserProgress from './pages/UserProgress'
import UserNotes from './pages/UserNotes'
import ClientJournal from './pages/ClientJournal'
import ClientProfile from './pages/ClientProfile'
import ClientMealPlans from './pages/ClientMealPlans'
import Login from './components/Login'
import { useAuth } from './contexts/AuthContext'
import {
  selectIsAdmin,
  selectIsNutritionist,
  selectUserData,
  selectUserLoading,
  selectUserError
} from './store/userSlice'
import { ArrowRightOnRectangleIcon, Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline'
import { useTranslation } from 'react-i18next'

function App() {
  const { t } = useTranslation()
  const [activePage, setActivePage] = useState('dashboard')
  const [isSidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarVariant, setSidebarVariant] = useState('main')
  const [clientSidebarItem, setClientSidebarItem] = useState('all-clients')
  const [selectedClient, setSelectedClient] = useState(null)
  const { currentUser, logout } = useAuth()
  const isAdmin = useSelector(selectIsAdmin)
  const isNutritionist = useSelector(selectIsNutritionist)
  const userData = useSelector(selectUserData)
  const userLoading = useSelector(selectUserLoading)
  const userError = useSelector(selectUserError)

  const handleLogout = async () => {
    try {
      await logout()
    } catch (error) {
      console.error('Failed to logout:', error)
    }
  }

  const handleNavigate = (pageId) => {
    setActivePage(pageId)
    setSidebarVariant('main')
    setSidebarOpen(false)
  }

  const handleClientMenuSelect = (itemId) => {
    setClientSidebarItem(itemId)
    if (itemId === 'all-clients') {
      setActivePage('myusers')
      setSidebarVariant('main')
      setSelectedClient(null)
      return
    }
    const map = {
      profile: 'client-profile',
      journal: 'client-journal',
      'meal-plans': 'client-meal-plans'
    }
    const nextPage = map[itemId] || 'client-journal'
    setActivePage(nextPage)
    setSidebarVariant('clients')
  }

  const handleBackToMainSidebar = () => {
    setSidebarVariant('main')
    setClientSidebarItem('all-clients')
    setActivePage('myusers')
    setSelectedClient(null)
  }

  // Redirect non-admin users to appropriate page after login
  useEffect(() => {
    if (userData && !isAdmin && activePage === 'dashboard') {
      // Nutritionists go to My Users, others go to My Day
      const targetPage = isNutritionist ? 'myusers' : 'myday'
      setActivePage(targetPage)
      setSidebarVariant('main')
    }
  }, [userData, isAdmin, isNutritionist, activePage])

  useEffect(() => {
    if (activePage === 'myusers') {
      setSidebarVariant('main')
      setClientSidebarItem('all-clients')
    }
  }, [activePage])

  const renderPage = () => {
    // Admin-only pages
    const adminPages = ['users', 'subscribers', 'unapprovedItems', 'analytics', 'dashboard']
    // Admin + Nutritionist pages
    const adminOrNutritionistPages = ['menus', 'recipes', 'mymenus']
    // Nutritionist-only pages
    const nutritionistPages = ['myusers', 'client-profile', 'client-journal', 'client-meal-plans']
    
    // Check if current page requires admin access
    if (adminPages.includes(activePage) && !isAdmin) {
      return (
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('pages.access.restricted')}</h2>
            <p className="text-gray-600">{t('pages.access.noPermission')}</p>
            <p className="text-sm text-gray-500 mt-2">{t('pages.access.adminRequired')}</p>
          </div>
        </div>
      )
    }

    // Check if current page requires admin or nutritionist access
    if (adminOrNutritionistPages.includes(activePage) && !isAdmin && !isNutritionist) {
      return (
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('pages.access.restricted')}</h2>
            <p className="text-gray-600">{t('pages.access.noPermission')}</p>
            <p className="text-sm text-gray-500 mt-2">{t('pages.access.adminOrNutritionistRequired')}</p>
          </div>
        </div>
      )
    }

    // Check nutritionist-only pages
    if (nutritionistPages.includes(activePage) && !isNutritionist) {
      return (
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('pages.access.restricted')}</h2>
            <p className="text-gray-600">{t('pages.access.noPermission')}</p>
            <p className="text-sm text-gray-500 mt-2">{t('pages.access.nutritionistRequired')}</p>
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
        return (
          <MyUsers
            onSelectClient={(client) => {
              setSelectedClient(client)
              setActivePage('client-journal')
              setSidebarVariant('clients')
              setClientSidebarItem('journal')
            }}
          />
        )
      case 'client-profile':
        return <ClientProfile client={selectedClient} />
      case 'client-journal':
        return <ClientJournal client={selectedClient} />
      case 'client-meal-plans':
        return <ClientMealPlans client={selectedClient} />
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
      case 'user-notes':
        return <UserNotes />
      case 'progress':
        return <UserProgress />
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
          <p className="text-gray-600">{t('pages.app.loadingUserData')}</p>
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
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar
        activePage={activePage}
        onNavigate={handleNavigate}
        variant={sidebarVariant}
        onBackToMain={handleBackToMainSidebar}
        activeClientMenuItem={clientSidebarItem}
        onClientMenuSelect={handleClientMenuSelect}
        isMobileOpen={isSidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex flex-1 flex-col overflow-auto">
        <header className="flex items-center justify-between px-4 py-3 border-b bg-white shadow-sm md:hidden">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen((open) => !open)}
              className="rounded-lg border border-gray-200 p-2 text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Toggle menu"
            >
              {isSidebarOpen ? <XMarkIcon className="h-6 w-6" /> : <Bars3Icon className="h-6 w-6" />}
            </button>
            <div>
              <p className="text-base font-semibold text-gray-900 leading-tight">AlexaFit</p>
              <p className="text-xs text-gray-500">Nutrition Guide</p>
            </div>
          </div>
          <span className={`px-2 py-1 text-xs font-medium rounded-full ${isAdmin ? 'bg-green-100 text-green-800' : isNutritionist ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>
            {isAdmin ? 'Admin' : isNutritionist ? 'Nutritionist' : 'User'}
          </span>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="p-4 md:p-6">
            {/* User info badge - desktop */}
            <div className="mb-4 hidden items-center gap-2 md:flex">
              <span className={`px-2 py-1 text-xs font-medium rounded-full ${isAdmin ? 'bg-green-100 text-green-800' : isNutritionist ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>
                {isAdmin ? 'Admin' : isNutritionist ? 'Nutritionist' : 'User'}
              </span>
            </div>
            {renderPage()}
          </div>
        </main>
      </div>
    </div>
  )
}

export default App