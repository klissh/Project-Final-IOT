'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  Activity, LayoutDashboard, Settings, List, LogOut, Crop, Camera, Sun, Moon, ChevronRight, ChevronLeft
} from 'lucide-react'
import { signOut } from '@/app/login/actions'

import Image from 'next/image'
import logoArka from '@/components/logo/logo arkahygiene.png'

// Persistent in-memory state across client-side SPA navigations to prevent page transition glitches
let globalCollapsed = false

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [dark, setDark] = useState<boolean>(true)
  const [mounted, setMounted] = useState<boolean>(false)
  const [collapsed, setCollapsed] = useState<boolean>(globalCollapsed)
  const [isReady, setIsReady] = useState<boolean>(false)

  useEffect(() => {
    setMounted(true)
    const isDark = document.documentElement.classList.contains('dark')
    setDark(isDark)

    // Sync collapsible state from localStorage
    const saved = localStorage.getItem('sidebar-collapsed') === 'true'
    if (saved !== globalCollapsed) {
      globalCollapsed = saved
      setCollapsed(saved)
    }

    // Enable transition animations after mounting and state restoration
    const timer = setTimeout(() => {
      setIsReady(true)
    }, 80)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (!mounted) return
    const root = document.documentElement
    if (dark) {
      root.classList.add('dark')
      root.classList.remove('light')
      localStorage.setItem('theme', 'dark')
    } else {
      root.classList.remove('dark')
      root.classList.add('light')
      localStorage.setItem('theme', 'light')
    }
  }, [dark, mounted])

  const toggleCollapsed = () => {
    setCollapsed(prev => {
      const next = !prev
      localStorage.setItem('sidebar-collapsed', String(next))
      globalCollapsed = next
      return next
    })
  }

  const navigation = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Live Monitor', href: '/live', icon: Camera },
    { name: 'ROI Config', href: '/roi', icon: Crop },
    { name: 'Logs', href: '/logs', icon: List },
    { name: 'Settings', href: '/settings', icon: Settings },
  ]

  // Derive page title from pathname
  const pageTitle = navigation.find(n => n.href === pathname)?.name ?? 'Dashboard'

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      {/* ── Sidebar ── */}
      <aside
        className={`hidden md:flex flex-col border-r border-border bg-card shrink-0 overflow-hidden select-none ${
          isReady ? 'transition-[width] duration-300 ease-in-out' : ''
        } ${collapsed ? 'w-16' : 'w-60'}`}
      >
        {/* Logo */}
        <div className="flex items-center h-16 px-4 gap-3 border-b border-border shrink-0 overflow-hidden">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-foreground text-background shrink-0 shadow-sm overflow-hidden p-0.5">
            <Image src={logoArka} alt="ArkaHygiene" className="w-full h-full object-contain" />
          </div>
          <div
            className={`flex flex-col transition-all duration-300 ease-in-out ${
              collapsed ? 'opacity-0 translate-x-4 pointer-events-none' : 'opacity-100 translate-x-0'
            }`}
          >
            <p className="text-sm font-bold leading-none text-foreground tracking-tight whitespace-nowrap">ArkaHygiene</p>
            <p className="text-[10px] text-muted-foreground mt-0.5 font-mono whitespace-nowrap">AIoT Monitor</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3 px-3 space-y-1.5">
          <p
            className={`px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 font-mono transition-all duration-300 ease-in-out ${
              collapsed ? 'opacity-0 translate-x-2 pointer-events-none' : 'opacity-100 translate-x-0'
            }`}
          >
            Menu
          </p>
          {navigation.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.name}
                href={item.href}
                title={collapsed ? item.name : undefined}
                className={`group flex items-center rounded-lg h-10 w-full px-3 transition-colors duration-200 ${
                  isActive
                    ? 'bg-secondary text-foreground'
                    : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground'
                }`}
              >
                <item.icon
                  className={`h-4 w-4 shrink-0 transition-colors duration-200 ${
                    isActive ? 'text-foreground' : 'text-muted-foreground/70 group-hover:text-foreground'
                  }`}
                />
                <span
                  className={`ml-3 whitespace-nowrap transition-all duration-300 ease-in-out ${
                    collapsed ? 'opacity-0 translate-x-4 pointer-events-none' : 'opacity-100 translate-x-0'
                  }`}
                >
                  {item.name}
                </span>
                {isActive && (
                  <ChevronRight
                    className={`ml-auto h-3 w-3 text-muted-foreground/40 transition-all duration-300 ease-in-out ${
                      collapsed ? 'opacity-0 translate-x-2 pointer-events-none' : 'opacity-100 translate-x-0'
                    }`}
                  />
                )}
              </Link>
            )
          })}
        </nav>

        {/* Bottom */}
        <div className="px-3 py-3 border-t border-border space-y-1.5 shrink-0 overflow-hidden">
          {/* Theme toggle */}
          <button
            onClick={() => setDark(d => !d)}
            title={collapsed ? (dark ? 'Light mode' : 'Dark mode') : undefined}
            className="group flex items-center rounded-lg h-10 w-full px-3 text-muted-foreground hover:bg-secondary/60 hover:text-foreground transition-colors duration-200"
            suppressHydrationWarning
          >
            <div className="h-4 w-4 shrink-0 flex items-center justify-center">
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </div>
            <span
              className={`ml-3 whitespace-nowrap transition-all duration-300 ease-in-out ${
                collapsed ? 'opacity-0 translate-x-4 pointer-events-none' : 'opacity-100 translate-x-0'
              }`}
            >
              {dark ? 'Light mode' : 'Dark mode'}
            </span>
          </button>

          {/* Logout */}
          <form action={signOut} className="w-full">
            <button
              type="submit"
              title={collapsed ? 'Keluar' : undefined}
              className="group flex items-center rounded-lg h-10 w-full px-3 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors duration-200"
            >
              <LogOut className="h-4 w-4 shrink-0 group-hover:text-destructive transition-colors duration-200" />
              <span
                className={`ml-3 whitespace-nowrap transition-all duration-300 ease-in-out ${
                  collapsed ? 'opacity-0 translate-x-4 pointer-events-none' : 'opacity-100 translate-x-0'
                }`}
              >
                Keluar
              </span>
            </button>
          </form>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Topbar */}
        <header className="flex items-center justify-between px-6 md:px-8 h-16 border-b border-border bg-background/80 backdrop-blur-sm shrink-0">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {/* Toggle Sidebar Button */}
            <button
              onClick={toggleCollapsed}
              title={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
              className="hidden md:flex h-8 w-8 items-center justify-center rounded-lg border border-border mr-2 text-muted-foreground hover:bg-secondary transition-colors"
            >
              {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>

            <span className="font-mono text-xs font-bold text-foreground">ArkaHygiene</span>
            <span>/</span>
            <span className="font-medium text-muted-foreground">{pageTitle}</span>
          </div>

          <div className="flex items-center gap-2">
            {/* Live pulse */}
            <div className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs font-mono text-muted-foreground">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
              </span>
              Live
            </div>

            {/* Mobile theme toggle */}
            <button
              onClick={() => setDark(d => !d)}
              className="md:hidden flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-secondary transition-colors"
              suppressHydrationWarning
            >
              {dark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
            </button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          {children}
        </main>
      </div>
    </div>
  )
}