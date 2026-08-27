import { Outlet } from 'react-router-dom'
import TopBar from './TopBar.js'

export default function AppShell() {
  return (
    <div className="flex flex-col min-h-screen bg-[#0a0a0f]">
      <TopBar />
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
