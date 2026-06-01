import { useState, useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import { triggerRefillNotifications } from '../../services/refillNotificationService'

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    triggerRefillNotifications()
  }, [])

  return (
    <div className="flex h-screen bg-[#F0F4FF] overflow-hidden">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Right column: TopBar + page content */}
      <div className="flex flex-col flex-1 min-w-0">
        <TopBar onMenuClick={() => setSidebarOpen(true)} />

        <main className="flex-1 overflow-y-auto bg-premium-soft">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
