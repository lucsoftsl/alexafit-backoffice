import { useState, useEffect } from 'react'
import { useSelector } from 'react-redux'
import Sidebar from './components/Sidebar'
import Dashboard from './pages/Dashboard'
import MyDay from './pages/MyDay'
import MyUsers from './pages/MyUsers'
import MyMenus from './pages/MyMenus'
import MyRecipes from './pages/MyRecipes'
import FoodItems from './pages/FoodItems'
import Users from './pages/Users'
import Subscribers from './pages/Subscribers'
import UnapprovedItems from './pages/UnapprovedItems'
import Analytics from './pages/Analytics'
import Menus from './pages/Menus'
import Recipes from './pages/Recipes'
import Settings from './pages/Settings'
import UserProgress from './pages/UserProgress'
import UserNotes from './pages/UserNotes'
import ClientJournal from './pages/ClientJournal'
import ClientProfile from './pages/ClientProfile'
import ClientMealPlans from './pages/ClientMealPlans'
import ClientNotes from './pages/ClientNotes'
import Chat from './pages/Chat'
import Tutorials from './pages/Tutorials'
import BugHunting from './pages/BugHunting'
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
  const { t, i18n } = useTranslation()
  const [activePage, setActivePage] = useState('dashboard')
  const [isSidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarVariant, setSidebarVariant] = useState('main')
  const [clientSidebarItem, setClientSidebarItem] = useState('all-clients')
  const [selectedClient, setSelectedClient] = useState(null)
  const [adminChatUserId, setAdminChatUserId] = useState(null)
  const [adminChatReturnPage, setAdminChatReturnPage] = useState('dashboard')
  const { currentUser, logout } = useAuth()
  const isAdmin = useSelector(selectIsAdmin)
  const isNutritionist = useSelector(selectIsNutritionist)
  const userData = useSelector(selectUserData)
  const userLoading = useSelector(selectUserLoading)
  const userError = useSelector(selectUserError)
  const shouldUseNutritionistTopTabs = isNutritionist && !isAdmin
  const currentYear = new Date().getFullYear()
  const languageOptions = [
    { value: 'en', label: 'English' },
    { value: 'fr', label: 'Français' },
    { value: 'es', label: 'Español' },
    { value: 'ro', label: 'Română' }
  ]

  const nutritionistTopTabs = [
    { id: 'myusers', label: t('sidebar.clients') },
    { id: 'mymenus', label: t('sidebar.myMenus') },
    { id: 'myrecipes', label: t('sidebar.myRecipes') },
    { id: 'myfooditems', label: t('sidebar.myFoodItems') },
    { id: 'myday', label: t('sidebar.myDay') },
    { id: 'tutorials', label: t('sidebar.tutorials') }
  ]
  const nutritionistMyDaySubTabs = [
    { id: 'myday', label: t('sidebar.myDay') },
    { id: 'progress', label: t('sidebar.progress') }
  ]
  const isNutritionistMyDaySection =
    shouldUseNutritionistTopTabs &&
    (activePage === 'myday' || activePage === 'progress')

  const getUserDisplayName = () => {
    if (currentUser?.displayName) return currentUser.displayName
    if (currentUser?.email) return currentUser.email.split('@')[0]
    return 'AlexaFit'
  }

  const getUserInitial = () => getUserDisplayName().charAt(0).toUpperCase()

  const handleLogout = async () => {
    try {
      await logout()
    } catch (error) {
      console.error('Failed to logout:', error)
    }
  }

  const handleLanguageChange = (event) => {
    const nextLanguage = event.target.value
    i18n.changeLanguage(nextLanguage)

    try {
      localStorage.setItem('lang', nextLanguage)
    } catch (error) {
      console.error('Failed to persist language:', error)
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
      'meal-plans': 'client-meal-plans',
      chat: 'client-chat',
      notes: 'client-notes'
    }
    const nextPage = map[itemId] || 'client-journal'
    setActivePage(nextPage)
    setSidebarVariant('clients')
  }

  const handleOpenAdminChat = (userId) => {
    setAdminChatReturnPage(activePage)
    setAdminChatUserId(userId)
    setActivePage('admin-chat')
    setSidebarOpen(false)
  }

  const handleAdminChatBack = () => {
    setActivePage(adminChatReturnPage)
    setAdminChatUserId(null)
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
    const adminPages = ['users', 'subscribers', 'unapprovedItems', 'analytics', 'dashboard', 'bug-hunting', 'admin-chat']
    // Admin + Nutritionist pages
    const adminOrNutritionistPages = ['menus', 'recipes', 'mymenus', 'myrecipes', 'myfooditems']
    // Nutritionist-only pages
    const nutritionistPages = ['myusers', 'client-profile', 'client-journal', 'client-meal-plans', 'client-notes']
    
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
    if (nutritionistPages.includes(activePage) && !(isNutritionist || isAdmin)) {
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
      case 'admin-chat':
        return <Chat selectedUserId={adminChatUserId} onBack={handleAdminChatBack} />
      case 'dashboard':
        return <Dashboard onOpenChat={handleOpenAdminChat} />
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
      case 'client-notes':
        return <ClientNotes client={selectedClient} />
      case 'client-chat':
        return <Chat selectedUserId={selectedClient?.userId} />
      case 'mymenus':
        return <MyMenus />
      case 'myrecipes':
        return <MyRecipes />
      case 'myfooditems':
        return <FoodItems />
      case 'users':
        return <Users onOpenChat={handleOpenAdminChat} />
      case 'subscribers':
        return <Subscribers onOpenChat={handleOpenAdminChat} />
      case 'unapprovedItems':
        return <UnapprovedItems />
      case 'analytics':
        return <Analytics />
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
      case 'tutorials':
        return <Tutorials />
      case 'bug-hunting':
        return <BugHunting />
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
          <h2 className="text-2xl font-bold text-red-600 mb-4">
            {t('pages.access.deniedTitle')}
          </h2>
          <p className="text-gray-700 mb-4">
            {userError
              ? t(userError, { defaultValue: userError })
              : t('pages.access.deniedMessage')}
          </p>
          <p className="text-gray-600 mb-6">
            {t('pages.access.deniedDescription')}
          </p>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
          >
            <ArrowRightOnRectangleIcon className="w-4 h-4" />
            {t('pages.access.logout')}
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
        hideDesktop={shouldUseNutritionistTopTabs}
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
          <div className="flex items-center gap-2">
            <select
              value={i18n.language}
              onChange={handleLanguageChange}
              className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label={t('pages.settings.language')}
            >
              {languageOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <span className={`px-2 py-1 text-xs font-medium rounded-full ${isAdmin ? 'bg-green-100 text-green-800' : isNutritionist ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>
              {isAdmin ? 'Admin' : isNutritionist ? 'Nutritionist' : 'User'}
            </span>
          </div>
        </header>

        {shouldUseNutritionistTopTabs && (
          <div className="hidden border-b border-[#ececf2] bg-white md:block">
            <div className="mx-auto flex max-w-[1400px] items-center justify-between px-6 py-4">
              <div className="flex items-center gap-10">
                <div className="flex items-center gap-3">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#7a56df] text-white">
                    <span className="text-xs font-bold">{getUserInitial()}</span>
                  </div>
                  <p className="text-lg font-semibold text-[#1b2232]">AlexaFit</p>
                </div>
                <nav className="flex items-center gap-2">
                  {nutritionistTopTabs.map(tab => {
                    const isActive =
                      tab.id === 'myday'
                        ? activePage === 'myday' || activePage === 'progress'
                        : activePage === tab.id
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => handleNavigate(tab.id)}
                        className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                          isActive
                            ? 'bg-[#f1ecff] text-[#7a56df]'
                            : 'text-[#566074] hover:bg-[#f7f7fb] hover:text-[#1b2232]'
                        }`}
                      >
                        {tab.label}
                      </button>
                    )
                  })}
                </nav>
              </div>
              <div className="flex items-center gap-3">
                <select
                  value={i18n.language}
                  onChange={handleLanguageChange}
                  className="rounded-full border border-[#ebeef5] bg-white px-3 py-2 text-sm font-medium text-[#566074] focus:outline-none focus:ring-2 focus:ring-[#7a56df]"
                  aria-label={t('pages.settings.language')}
                >
                  {languageOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => handleNavigate('settings')}
                  className="flex items-center gap-3 rounded-full border border-[#ebeef5] bg-[#fafbfe] px-3 py-2"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f3e1d8] text-sm font-semibold text-[#1b2232]">
                    {getUserInitial()}
                  </div>
                  <div className="text-left">
                    <p className="max-w-[180px] truncate text-sm font-medium text-[#1b2232]">
                      {getUserDisplayName()}
                    </p>
                    <p className="max-w-[180px] truncate text-xs text-[#7b8497]">
                      {currentUser?.email || t('sidebar.backofficeAdmin')}
                    </p>
                  </div>
                </button>
              </div>
            </div>
            {isNutritionistMyDaySection ? (
              <div className="mx-auto flex max-w-[1400px] items-center gap-2 border-t border-[#f1f2f6] px-6 py-3">
                {nutritionistMyDaySubTabs.map(tab => {
                  const isActive = activePage === tab.id

                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => handleNavigate(tab.id)}
                      className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                        isActive
                          ? 'bg-[#f1ecff] text-[#7a56df]'
                          : 'text-[#566074] hover:bg-[#f7f7fb] hover:text-[#1b2232]'
                      }`}
                    >
                      {tab.label}
                    </button>
                  )
                })}
              </div>
            ) : null}
          </div>
        )}

        <main className="flex-1 overflow-y-auto">
          <div className={`${shouldUseNutritionistTopTabs ? 'mx-auto max-w-[1400px] p-4 md:px-6 md:py-7' : 'p-4 md:p-6'}`}>
            {/* User info badge - desktop */}
            {!shouldUseNutritionistTopTabs && (
              <div className="mb-4 hidden items-center justify-end gap-2 md:flex">
                <select
                  value={i18n.language}
                  onChange={handleLanguageChange}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  aria-label={t('pages.settings.language')}
                >
                  {languageOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${isAdmin ? 'bg-green-100 text-green-800' : isNutritionist ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>
                  {isAdmin ? 'Admin' : isNutritionist ? 'Nutritionist' : 'User'}
                </span>
              </div>
            )}
            {renderPage()}
            <footer className="mt-10 border-t border-gray-200 pt-6">
              <div className="flex flex-col gap-2 text-center text-sm text-[#8ca0bf] md:flex-row md:items-center md:justify-center md:gap-3">
                <span>{`© ${currentYear} AlexaFit ${t('pages.app.footer.rightsReserved')}`}</span>
                <div className="flex items-center justify-center gap-3">
                  <a
                    href="https://lucsoft-website.vercel.app/root/foodsync-terms.html"
                    target="_blank"
                    rel="noreferrer"
                    className="transition hover:text-[#5f78a0]"
                  >
                    {t('pages.app.footer.terms')}
                  </a>
                  <span className="text-[#c6d1e2]">|</span>
                  <a
                    href="https://lucsoft-website.vercel.app/root/foodsync-privacy.html"
                    target="_blank"
                    rel="noreferrer"
                    className="transition hover:text-[#5f78a0]"
                  >
                    {t('pages.app.footer.privacy')}
                  </a>
                </div>
              </div>
            </footer>
          </div>
        </main>
      </div>
    </div>
  )
}

export default App
