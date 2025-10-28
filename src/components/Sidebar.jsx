import {
  HomeIcon,
  UsersIcon,
  UserGroupIcon,
  ChartBarIcon,
  CogIcon,
  ListBulletIcon,
  CakeIcon
} from '@heroicons/react/24/outline'

const Sidebar = ({ activePage, setActivePage }) => {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: HomeIcon },
    { id: 'users', label: 'Users', icon: UsersIcon },
    { id: 'unapprovedItems', label: 'Unapproved Items', icon: ListBulletIcon },
    { id: 'menus', label: 'Menus', icon: CakeIcon },
    { id: 'subscribers', label: 'Subscribers', icon: UserGroupIcon },
    { id: 'analytics', label: 'Analytics', icon: ChartBarIcon },
    { id: 'settings', label: 'Settings', icon: CogIcon },
  ]

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
                className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg mb-1 transition-colors duration-200 ${isActive
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

      <div className="absolute bottom-0 w-64 p-6 border-t border-gray-200">
        <div className="flex items-center">
          <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
            <span className="text-white text-sm font-medium">A</span>
          </div>
          <div className="ml-3">
            <p className="text-sm font-medium text-gray-900">Admin User</p>
            <p className="text-xs text-gray-500">admin@alexafit.com</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Sidebar
