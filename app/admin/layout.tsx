import { ReactNode } from 'react'
import Link from 'next/link'

export const metadata = {
  title: 'Broker Admin - HartFelt Agents Portal',
  description: 'Broker administration dashboard for HartFelt agents',
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#050507]">
      {/* Sidebar Navigation */}
      <aside className="fixed left-0 top-0 w-64 h-screen bg-[#050507] border-r border-[#1a1a2e]">
        <div className="p-6">
          <Link href="/admin/dashboard" className="text-2xl font-bold text-white">
            HartFelt
          </Link>
          <p className="text-xs text-gray-400 mt-1">Broker Dashboard</p>
        </div>

        <nav className="mt-8">
          <Link href="/admin/dashboard" className="block px-6 py-3 text-gray-400 hover:bg-[#111] hover:text-white transition">
            Dashboard
          </Link>
          <Link href="/admin/agents" className="block px-6 py-3 text-gray-400 hover:bg-[#111] hover:text-white transition">
            Agents
          </Link>
          <Link href="/admin/deals" className="block px-6 py-3 text-gray-400 hover:bg-[#111] hover:text-white transition">
            All Deals
          </Link>
          <Link href="/admin/commissions" className="block px-6 py-3 text-gray-400 hover:bg-[#111] hover:text-white transition">
            Commission Approvals
          </Link>
          <Link href="/admin/reports" className="block px-6 py-3 text-gray-400 hover:bg-[#111] hover:text-white transition">
            Performance Reports
          </Link>
          <Link href="/admin/compliance" className="block px-6 py-3 text-gray-400 hover:bg-[#111] hover:text-white transition">
            Compliance Management
          </Link>
          <Link href="/admin/settings" className="block px-6 py-3 text-gray-400 hover:bg-[#111] hover:text-white transition">
            Settings
          </Link>
          <hr className="my-4 border-[#1a1a2e]" />
          <Link href="/dashboard" className="block px-6 py-3 text-gray-400 hover:bg-[#111] hover:text-white transition text-sm">
            ← Agent View
          </Link>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="ml-64">
        {children}
      </main>
    </div>
  )
}
