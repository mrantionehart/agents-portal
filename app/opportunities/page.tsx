'use client'

import { useRouter } from 'next/navigation'
import { useAuth } from '../providers'
import Link from 'next/link'
import { Users, MapPin, DollarSign, TrendingUp, Lock, Unlock } from 'lucide-react'
import { useState } from 'react'

export default function OpportunitiesPage() {
  const { user, loading, signOut } = useAuth()
  const router = useRouter()
  const [isUnlocked, setIsUnlocked] = useState(false)
  const [passwordInput, setPasswordInput] = useState('')
  const [showPasswordInput, setShowPasswordInput] = useState(false)

  // Password for accessing private opportunities
  const OPPORTUNITIES_PASSWORD = 'HartFelt2024' // ← CHANGE THIS TO YOUR PASSWORD

  const handlePasswordSubmit = () => {
    if (passwordInput === OPPORTUNITIES_PASSWORD) {
      setIsUnlocked(true)
      setPasswordInput('')
      setShowPasswordInput(false)
    } else {
      alert('Incorrect password')
    }
  }

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

  // Sample opportunities data - replace with Vault API call
  const opportunities = [
    {
      id: 1,
      title: 'Downtown Miami Mixed-Use Development',
      type: 'Development Opportunity',
      location: 'Downtown Miami, FL',
      description: 'New mixed-use development project with residential and retail components. Estimated 250 units.',
      investmentRange: '$5M - $10M',
      daysPosted: 3,
      postedBy: 'John Smith',
    },
    {
      id: 2,
      title: 'Wynwood Warehouse Conversion',
      type: 'Development Opportunity',
      location: 'Wynwood, Miami, FL',
      description: 'Warehouse-to-loft conversion project in high-growth Wynwood district. Prime location for appreciation.',
      investmentRange: '$2M - $4M',
      daysPosted: 5,
      postedBy: 'Sarah Johnson',
    },
    {
      id: 3,
      title: 'Brickell Office Building - Off-Market',
      type: 'Exclusive Deal',
      location: 'Brickell, Miami, FL',
      description: 'Class A office building with long-term tenants. Strong NOI. Not listed on MLS.',
      investmentRange: '$15M+',
      daysPosted: 1,
      postedBy: 'Michael Chen',
    },
    {
      id: 4,
      title: 'South Beach Boutique Hotel',
      type: 'Investment Property',
      location: 'South Beach, Miami, FL',
      description: 'Established boutique hotel with proven operating history. Turn-key opportunity.',
      investmentRange: '$8M - $12M',
      daysPosted: 7,
      postedBy: 'Elizabeth Rodriguez',
    },
    {
      id: 5,
      title: 'Coral Gables Land Assembly',
      type: 'Partnership Opportunity',
      location: 'Coral Gables, FL',
      description: 'Strategic land assembly in prestigious Coral Gables. Perfect for luxury residential development.',
      investmentRange: '$3M - $6M',
      daysPosted: 2,
      postedBy: 'David Martinez',
    },
    {
      id: 6,
      title: 'Coconut Grove Waterfront Development',
      type: 'Development Opportunity',
      location: 'Coconut Grove, FL',
      description: 'Waterfront parcel with approved entitlements. Ready for development. Rare opportunity.',
      investmentRange: '$7M - $15M',
      daysPosted: 4,
      postedBy: 'Jennifer Lee',
    },
  ]

  const getOpportunityIcon = (type: string) => {
    switch (type) {
      case 'Exclusive Deal':
        return 'text-red-600'
      case 'Development Opportunity':
        return 'text-blue-600'
      case 'Investment Property':
        return 'text-green-600'
      case 'Partnership Opportunity':
        return 'text-purple-600'
      default:
        return 'text-gray-600'
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'Exclusive Deal':
        return 'bg-red-100 text-red-800'
      case 'Development Opportunity':
        return 'bg-blue-100 text-blue-800'
      case 'Investment Property':
        return 'bg-green-100 text-green-800'
      case 'Partnership Opportunity':
        return 'bg-purple-100 text-purple-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
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
            <h1 className="text-2xl font-bold text-gray-900">Private Opportunities</h1>
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
        {!isUnlocked ? (
          // Locked State
          <div className="flex items-center justify-center py-24">
            <div className="bg-white rounded-lg shadow p-12 max-w-md w-full text-center">
              <Lock className="w-16 h-16 text-red-600 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-900 mb-3">Private Opportunities</h2>
              <p className="text-gray-600 mb-8">
                This section contains exclusive off-market deals and development opportunities within the HartFelt network. Enter the password to access.
              </p>
              {showPasswordInput ? (
                <div className="space-y-4">
                  <input
                    type="password"
                    placeholder="Enter password"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handlePasswordSubmit()}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                    autoFocus
                  />
                  <div className="flex gap-3">
                    <button
                      onClick={handlePasswordSubmit}
                      className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition font-medium"
                    >
                      Unlock
                    </button>
                    <button
                      onClick={() => {
                        setShowPasswordInput(false)
                        setPasswordInput('')
                      }}
                      className="flex-1 bg-gray-300 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-400 transition font-medium"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowPasswordInput(true)}
                  className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition font-medium flex items-center justify-center gap-2"
                >
                  <Unlock className="w-5 h-5" />
                  Unlock Opportunities
                </button>
              )}
            </div>
          </div>
        ) : (
          // Unlocked State
          <div>
            <div className="mb-8">
              <p className="text-gray-600 text-lg">
                Access exclusive off-market deals and development opportunities shared within the HartFelt network. These opportunities are curated for qualified investors and agents looking to expand their portfolios.
              </p>
            </div>

            {/* Opportunities Grid */}
            <div className="space-y-4">
              {opportunities.map((opp) => (
                <div
                  key={opp.id}
                  className="bg-white rounded-lg shadow hover:shadow-lg transition overflow-hidden border-l-4 border-blue-500"
                >
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-xl font-bold text-gray-900">{opp.title}</h3>
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getTypeColor(opp.type)}`}>
                            {opp.type}
                          </span>
                        </div>
                        <p className="text-gray-600 mb-3">{opp.description}</p>
                      </div>
                      <Users className={`w-10 h-10 flex-shrink-0 ${getOpportunityIcon(opp.type)}`} />
                    </div>

                    <div className="grid grid-cols-3 gap-4 mb-4">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-600">{opp.location}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-gray-400" />
                        <span className="text-sm font-medium text-gray-900">{opp.investmentRange}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-600">{opp.daysPosted} days ago</span>
                      </div>
                    </div>

                    <div className="border-t border-gray-200 pt-4 flex items-center justify-between">
                      <span className="text-sm text-gray-500">Posted by {opp.postedBy}</span>
                      <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition text-sm font-medium">
                        View Details
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Submit Opportunity Button */}
            <div className="mt-12 text-center">
              <button className="bg-green-600 text-white px-8 py-3 rounded-lg hover:bg-green-700 transition font-medium">
                Submit Opportunity
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
