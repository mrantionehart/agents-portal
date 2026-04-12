'use client'

import { useRouter } from 'next/navigation'
import { useAuth } from '../providers'
import Link from 'next/link'
import { BookOpen, FileText, Users, Zap, Lock, Unlock } from 'lucide-react'
import { useState } from 'react'

export default function ResourcesPage() {
  const { user, loading, signOut } = useAuth()
  const router = useRouter()
  const [unlockedSections, setUnlockedSections] = useState<string[]>([])
  const [passwordInput, setPasswordInput] = useState('')
  const [activePasswordSection, setActivePasswordSection] = useState<string | null>(null)

  // Password for Private Opportunities section
  const PRIVATE_SECTION_PASSWORD = 'HartFelt2024' // ← CHANGE THIS TO YOUR PASSWORD

  const handleSignOut = async () => {
    await signOut()
    router.push('/login')
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-blue-600 hover:text-blue-700 font-medium">
              ← Dashboard
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">Resources</h1>
          </div>
          <button
            onClick={handleSignOut}
            className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition"
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-12">
        {/* HartFelt Ready Training */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
            <BookOpen className="w-6 h-6" />
            HartFelt Ready Training
          </h2>

          <div className="grid grid-cols-3 gap-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="font-bold text-gray-900 mb-2">Volume 1</h3>
              <p className="text-gray-600 text-sm mb-4">Foundations and essential skills for real estate excellence</p>
              <a
                href="/training/volume-1.pdf"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition font-medium text-sm inline-block text-center"
              >
                Download PDF
              </a>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="font-bold text-gray-900 mb-2">Volume 2</h3>
              <p className="text-gray-600 text-sm mb-4">Advanced strategies and client management techniques</p>
              <a
                href="/training/volume-2.pdf"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition font-medium text-sm inline-block text-center"
              >
                Download PDF
              </a>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="font-bold text-gray-900 mb-2">Volume 3</h3>
              <p className="text-gray-600 text-sm mb-4">Growth strategies and business development</p>
              <a
                href="/training/volume-3.pdf"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition font-medium text-sm inline-block text-center"
              >
                Download PDF
              </a>
            </div>
          </div>
        </section>

        {/* Brokerage Policy Manual */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
            <FileText className="w-6 h-6" />
            Brokerage Policy Manual
          </h2>

          <div className="bg-white rounded-lg shadow p-8">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">HartFelt Brokerage Policy Manual</h3>
                <p className="text-gray-600 mb-4">Complete guide to HartFelt policies, procedures, and best practices for all agents</p>
                <a
                  href="/training/brokerage-policy-manual.pdf"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition font-medium"
                >
                  <FileText className="w-5 h-5" />
                  Download PDF
                </a>
              </div>
              <FileText className="w-16 h-16 text-blue-300 flex-shrink-0" />
            </div>
          </div>
        </section>

        {/* Resources Grid */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Resource Library</h2>
          <div className="grid grid-cols-3 gap-6">
            {/* Marketing Resources */}
            <div className="bg-white rounded-lg shadow p-8">
              <div className="flex items-center gap-3 mb-4">
                <Zap className="w-6 h-6 text-purple-600" />
                <h3 className="text-xl font-bold text-gray-900">Marketing Resources</h3>
              </div>
              <p className="text-gray-600 mb-6">
                HartFelt branded marketing materials, templates, and assets to help you market properties effectively.
              </p>
              <ul className="space-y-2 mb-6">
                <li className="flex items-center gap-2 text-gray-700">
                  <span className="w-2 h-2 bg-purple-600 rounded-full"></span>
                  Listing presentation templates
                </li>
                <li className="flex items-center gap-2 text-gray-700">
                  <span className="w-2 h-2 bg-purple-600 rounded-full"></span>
                  Social media guides & assets
                </li>
                <li className="flex items-center gap-2 text-gray-700">
                  <span className="w-2 h-2 bg-purple-600 rounded-full"></span>
                  HartFelt branded templates
                </li>
                <li className="flex items-center gap-2 text-gray-700">
                  <span className="w-2 h-2 bg-purple-600 rounded-full"></span>
                  Logo & brand guidelines
                </li>
                <li className="flex items-center gap-2 text-gray-700">
                  <span className="w-2 h-2 bg-purple-600 rounded-full"></span>
                  Marketing guides & best practices
                </li>
              </ul>
              <p className="text-xs text-gray-500 mb-4">
                Note: Social media content can also be generated using the AI tool in your dashboard.
              </p>
              <button className="w-full bg-purple-600 text-white py-2 rounded-lg hover:bg-purple-700 transition font-medium">
                Open Folder
              </button>
            </div>

            {/* Contracts & Forms */}
            <div className="bg-white rounded-lg shadow p-8">
              <div className="flex items-center gap-3 mb-4">
                <FileText className="w-6 h-6 text-orange-600" />
                <h3 className="text-xl font-bold text-gray-900">Contracts & Forms</h3>
              </div>
              <p className="text-gray-600 mb-6">
                Essential documents and templates for all stages of the transaction.
              </p>
              <ul className="space-y-2 mb-6">
                <li className="flex items-center gap-2 text-gray-700">
                  <span className="w-2 h-2 bg-orange-600 rounded-full"></span>
                  Listing agreements
                </li>
                <li className="flex items-center gap-2 text-gray-700">
                  <span className="w-2 h-2 bg-orange-600 rounded-full"></span>
                  Buyer representation agreements
                </li>
                <li className="flex items-center gap-2 text-gray-700">
                  <span className="w-2 h-2 bg-orange-600 rounded-full"></span>
                  Disclosure forms
                </li>
                <li className="flex items-center gap-2 text-gray-700">
                  <span className="w-2 h-2 bg-orange-600 rounded-full"></span>
                  Offer templates
                </li>
                <li className="flex items-center gap-2 text-gray-700">
                  <span className="w-2 h-2 bg-orange-600 rounded-full"></span>
                  Addendums
                </li>
              </ul>
              <Link href="/documents" className="block w-full bg-orange-600 text-white py-2 rounded-lg hover:bg-orange-700 transition font-medium text-center">
                Open Folder
              </Link>
            </div>

            {/* Private Opportunities */}
            <div className="bg-white rounded-lg shadow p-8">
              <div className="flex items-center gap-3 mb-4">
                <Users className="w-6 h-6 text-blue-600" />
                <h3 className="text-xl font-bold text-gray-900">Private Opportunities</h3>
              </div>
              <p className="text-gray-600 mb-6">
                Access off-market deals and development opportunities shared within the HartFelt network.
              </p>
              <ul className="space-y-2 mb-6">
                <li className="flex items-center gap-2 text-gray-700">
                  <span className="w-2 h-2 bg-blue-600 rounded-full"></span>
                  Exclusive deals
                </li>
                <li className="flex items-center gap-2 text-gray-700">
                  <span className="w-2 h-2 bg-blue-600 rounded-full"></span>
                  Development opportunities
                </li>
                <li className="flex items-center gap-2 text-gray-700">
                  <span className="w-2 h-2 bg-blue-600 rounded-full"></span>
                  Investment properties
                </li>
                <li className="flex items-center gap-2 text-gray-700">
                  <span className="w-2 h-2 bg-blue-600 rounded-full"></span>
                  Partnership opportunities
                </li>
              </ul>
              <button className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition font-medium">
                View Opportunities
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
