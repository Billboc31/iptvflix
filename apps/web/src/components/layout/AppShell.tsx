import { Outlet } from 'react-router-dom'
import LeftNav from './LeftNav.js'
import TopBar from './TopBar.js'

export default function AppShell() {
  return (
    <div className="flex min-h-screen bg-[#0a0a0f]">
      <LeftNav />
      <div className="flex-1 ml-60 flex flex-col min-h-screen">
        <TopBar />
        <main className="flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
