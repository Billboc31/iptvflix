import { Outlet } from 'react-router-dom'
import TopNav from './TopNav.js'
import BottomNav from './BottomNav.js'

export default function AppShell() {
  return (
    <div className="flex flex-col min-h-screen bg-[#0a0a0f]">
      <TopNav />
      <main className="flex-1 pb-20 md:pb-0">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  )
}
