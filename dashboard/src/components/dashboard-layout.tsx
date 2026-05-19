'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Activity, LayoutDashboard, Settings, List, LogOut, Crop } from 'lucide-react'
import { signOut } from '@/app/login/actions'

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  const navigation = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Live Monitor', href: '/live', icon: Activity },
    { name: 'ROI Config', href: '/roi', icon: Crop },
    { name: 'Logs', href: '/logs', icon: List },
    { name: 'Settings', href: '/settings', icon: Settings },
  ]

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-100">
      {/* Sidebar */}
      <div className="w-64 flex-col border-r border-zinc-800 bg-zinc-950/50 hidden md:flex">
        <div className="flex h-16 items-center px-6 border-b border-zinc-800">
          <h1 className="text-lg font-semibold tracking-tight text-zinc-100">Smart Kitchen AI</h1>
        </div>
        <div className="flex-1 overflow-y-auto py-4">
          <nav className="space-y-1 px-4">
            {navigation.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`group flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-blue-600/10 text-blue-500'
                      : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100'
                  }`}
                >
                  <item.icon
                    className={`mr-3 h-5 w-5 flex-shrink-0 ${
                      isActive ? 'text-blue-500' : 'text-zinc-500 group-hover:text-zinc-300'
                    }`}
                    aria-hidden="true"
                  />
                  {item.name}
                </Link>
              )
            })}
          </nav>
        </div>
        <div className="p-4 border-t border-zinc-800">
          <form action={signOut}>
            <button
              type="submit"
              className="group flex w-full items-center rounded-md px-3 py-2 text-sm font-medium text-zinc-400 hover:bg-red-500/10 hover:text-red-500 transition-colors"
            >
              <LogOut className="mr-3 h-5 w-5 text-zinc-500 group-hover:text-red-500" />
              Keluar
            </button>
          </form>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
