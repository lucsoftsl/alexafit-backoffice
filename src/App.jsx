import { useState } from 'react'
import Sidebar from './components/Sidebar'
import Dashboard from './pages/Dashboard'
import Users from './pages/Users'
import Subscribers from './pages/Subscribers'
import UnapprovedItems from './pages/UnapprovedItems'
import Menus from './pages/Menus'

function App() {
  const [activePage, setActivePage] = useState('dashboard')

  const renderPage = () => {
    switch (activePage) {
      case 'dashboard':
        return <Dashboard />
      case 'users':
        return <Users />
      case 'subscribers':
        return <Subscribers />
      case 'unapprovedItems':
        return <UnapprovedItems />
      case 'menus':
        return <Menus />
      default:
        return <Dashboard />
    }
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar activePage={activePage} setActivePage={setActivePage} />
      <main className="flex-1 overflow-y-auto">
        <div className="p-6">
          {renderPage()}
        </div>
      </main>
    </div>
  )
}

export default App