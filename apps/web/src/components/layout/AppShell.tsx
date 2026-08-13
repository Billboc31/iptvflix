import { Outlet } from 'react-router-dom'
import LeftNav from './LeftNav.js'
import TopBar from './TopBar.js'
import BottomNav from './BottomNav.js'

export default function AppShell() {
  return (
    <div className="flex min-h-screen bg-[#0a0a0f]">
      <LeftNav />
      <div className="flex-1 ml-0 md:ml-60 flex flex-col min-h-screen">
        <TopBar />
        <main className="flex-1 pb-20 md:pb-0">
          <Outlet />
        </main>
      </div>
      <BottomNav />
    </div>
  )
}
