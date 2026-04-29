'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Briefcase,
  Users,
  DollarSign,
  FileText,
  CalendarDays,
  MessageSquare,
  BookOpen,
  Sparkles,
  Wrench,
  Settings,
  ChevronDown,
  LogOut,
  CheckSquare,
  Shield,
  Gift,
  Megaphone,
  FileBarChart,
  CreditCard,
  ClipboardList,
  Bell,
  Trophy,
  UserPlus,
  User,
  Target,
  Home,
  Zap,
  Inbox,
  Store,
  Radar,
} from 'lucide-react'
import { useState } from 'react'

interface SidebarNavProps {
  onSignOut: () => void
  userName?: string
  role?: string
}

export default function SidebarNav({ onSignOut, userName, role }: SidebarNavProps) {
  const pathname = usePathname()
  const [isToolsOpen, setIsToolsOpen] = useState(false)

  const isActive = (path: string) => pathname === path || pathname.startsWith(path + '/')

  const mainNavItems = [
    { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { label: 'Deals / Pipeline', href: '/pipeline', icon: Briefcase },
    { label: 'CloseIQ', href: '/closeiq', icon: Target },
    { label: 'Commissions', href: '/commissions', icon: DollarSign },
    { label: 'New Leads', href: '/new-leads', icon: UserPlus },
    { label: 'Client Intakes', href: '/intakes', icon: ClipboardList },
    { label: 'My Card', href: '/business-card', icon: CreditCard },
    { label: 'Training', href: '/training', icon: BookOpen },
    { label: 'Leaderboard & Wins', href: '/leaderboard', icon: Trophy },
    { label: 'Calendar', href: '/calendar', icon: CalendarDays },
    { label: 'Documents', href: '/documents', icon: FileText },
    { label: 'Chat', href: '/chat', icon: MessageSquare },
    { label: 'Compliance', href: '/compliance', icon: Shield },
    { label: 'Deal Concierge', href: '/crm', icon: Zap },
    { label: 'Smart Inbox', href: '/crm/inbox', icon: Inbox },
    { label: 'Notifications', href: '/notifications', icon: Bell },
    { label: 'Active Listings', href: '/listings', icon: Home },
    { label: 'Vendor Marketplace', href: '/vendors', icon: Store },
    { label: 'Development Radar', href: '/development-radar', icon: Radar },
    { label: 'Referrals', href: '/recruiting', icon: Users },
  ]

  const operationsItems = [
    { label: 'Transaction Coordinator', href: '/transaction-coordinator', icon: CheckSquare },
  ]

  const toolsItems = [
    { label: 'CMA Generator', href: '/cma', icon: FileBarChart },
    { label: 'AI Assistant', href: '/ai-chat', icon: Sparkles },
    { label: 'Email Templates', href: '/email-templates', icon: MessageSquare },
    { label: 'Commission Calc', href: '/commission-calculator', icon: DollarSign },
  ]

  const adminItems = [
    { label: 'Brokerage', href: '/brokerage', icon: Users },
    { label: 'Recruiting', href: '/recruiting', icon: Users },
    { label: 'Compliance', href: '/compliance', icon: FileText },
    { label: 'Settings', href: '/admin-settings', icon: Settings },
  ]

  const navItemClass = (active: boolean) =>
    `flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-150 text-sm font-medium ${
      active
        ? 'bg-[#C9A84C]/10 text-[#C9A84C] border-l-2 border-[#C9A84C]'
        : 'text-gray-400 hover:bg-[#0a0a0f] hover:text-white'
    }`

  const subNavItemClass = (active: boolean) =>
    `flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-150 text-xs font-medium ${
      active
        ? 'bg-[#C9A84C]/10 text-[#C9A84C] border-l-2 border-[#C9A84C]'
        : 'text-gray-400 hover:bg-[#0a0a0f] hover:text-white'
    }`

  return (
    <aside className="w-64 bg-[#050507] text-white flex flex-col h-screen sticky top-0 overflow-y-auto border-r border-[#1a1a2e]">
      {/* Logo/Brand */}
      <div className="p-6 border-b border-[#1a1a2e]">
        <h1
          className="text-2xl font-bold bg-clip-text text-transparent"
          style={{ backgroundImage: 'linear-gradient(to right, #C9A84C, #E8D5A3)' }}
        >
          HF
        </h1>
        <p className="text-xs text-gray-500 mt-1">EASE Agent Portal</p>
      </div>

      {/* User Info */}
      <div className="px-6 py-4 border-b border-[#1a1a2e]">
        <p className="text-sm font-medium text-white truncate">{userName}</p>
        <p className="text-xs text-gray-400 capitalize mt-1">{role}</p>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
        {/* Main Items */}
        {mainNavItems.map((item) => {
          const Icon = item.icon
          const active = isActive(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={navItemClass(active)}
            >
              <Icon className="w-5 h-5" />
              {item.label}
            </Link>
          )
        })}

        {/* Operations Section */}
        <div className="pt-4 border-t border-[#1a1a2e] mt-4">
          <p className="px-4 text-xs uppercase text-gray-600 font-semibold tracking-wider mb-2">Operations</p>
          <div className="space-y-1">
            {operationsItems.map((item) => {
              const Icon = item.icon
              const active = isActive(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={navItemClass(active)}
                >
                  <Icon className="w-5 h-5" />
                  {item.label}
                </Link>
              )
            })}
          </div>
        </div>

        {/* Tools Section */}
        <div className="pt-4 border-t border-[#1a1a2e] mt-4">
          <button
            onClick={() => setIsToolsOpen(!isToolsOpen)}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-gray-400 hover:bg-[#0a0a0f] hover:text-white transition-all duration-150 text-sm font-medium"
          >
            <Wrench className="w-5 h-5" />
            <span className="flex-1 text-left">Tools</span>
            <ChevronDown
              className={`w-4 h-4 transition-transform duration-150 ${isToolsOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {isToolsOpen && (
            <div className="mt-2 space-y-1 ml-2 pl-2 border-l border-[#1a1a2e]">
              {toolsItems.map((item) => {
                const Icon = item.icon
                const active = isActive(item.href)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={subNavItemClass(active)}
                  >
                    <Icon className="w-4 h-4" />
                    {item.label}
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        {/* Admin Section - Only for brokers/admins */}
        {(role === 'broker' || role === 'admin') && (
          <div className="pt-4 border-t border-[#1a1a2e] mt-4">
            <p className="px-4 text-xs uppercase text-gray-600 font-semibold tracking-wider mb-2">Admin</p>
            <div className="space-y-1">
              {adminItems.map((item) => {
                const Icon = item.icon
                const active = isActive(item.href)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={subNavItemClass(active)}
                  >
                    <Icon className="w-4 h-4" />
                    {item.label}
                  </Link>
                )
              })}
            </div>
          </div>
        )}
      </nav>

      {/* Profile + Sign Out */}
      <div className="p-4 border-t border-[#1a1a2e] space-y-1">
        <Link
          href="/profile"
          className={navItemClass(isActive('/profile'))}
        >
          <User className="w-5 h-5" />
          Profile
        </Link>
        <button
          onClick={onSignOut}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-gray-400 hover:bg-red-500/100/10 hover:text-red-400 transition-all duration-150 text-sm font-medium"
        >
          <LogOut className="w-5 h-5" />
          Sign Out
        </button>
      </div>
    </aside>
  )
}
