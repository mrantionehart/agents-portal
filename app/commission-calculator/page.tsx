'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../providers'
import Link from 'next/link'
import { vaultAPI } from '@/lib/vault-client'

export default function CommissionCalculatorPage() {
  const { user, role, loading, signOut } = useAuth()
  const router = useRouter()

  const [salePrice, setSalePrice] = useState(500000)
  const [totalCommPct, setTotalCommPct] = useState(5)
  const [brokageSplit, setBrokageSplit] = useState(80)
  const [referralFeePct, setReferralFeePct] = useState(0)
  const [transactionFee, setTransactionFee] = useState(295)
  const [vaultResult, setVaultResult] = useState<any>(null)
  const [isCalculating, setIsCalculating] = useState(false)

  // Local calculation for immediate UI feedback
  const grossCommission = (salePrice * totalCommPct) / 100
  const yourSplit = (grossCommission * brokageSplit) / 100
  const referralFee = (yourSplit * referralFeePct) / 100
  const netCommission = yourSplit - referralFee - transactionFee

  // Calculate using Vault API (for broker-defined rules and compliance)
  const calculateWithVault = async () => {
    if (!user) return

    try {
      setIsCalculating(true)
      const result = await vaultAPI.commissions.calculate(
        {
          salePrice,
          commissionRate: totalCommPct,
          brokerSplit: brokageSplit,
          referralFee: referralFeePct,
          transactionFee,
        },
        user.id,
        role
      )
      setVaultResult(result)
    } catch (error) {
      console.error('Vault calculation failed:', error)
    } finally {
      setIsCalculating(false)
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <header className="bg-[#0a0a0f] border-b border-[#1a1a2e]">
        <div className="max-w-5xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-blue-600 hover:text-blue-400 font-medium">
              ← Dashboard
            </Link>
            <h1 className="text-2xl font-bold text-white">Commission Calculator</h1>
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
      <main className="max-w-5xl mx-auto px-6 py-12">
        <div className="bg-[#0a0a0f] rounded-lg shadow-lg shadow-black/20 p-8">
          <p className="text-gray-400 mb-8">
            Quickly estimate your net earnings on any deal. Results update automatically as you type.
          </p>

          <div className="grid grid-cols-2 gap-8">
            {/* Input Section */}
            <div>
              <h3 className="text-lg font-bold text-white mb-6">Deal Details</h3>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-white mb-2">Sale Price</label>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400">$</span>
                    <input
                      type="number"
                      value={salePrice}
                      onChange={(e) => setSalePrice(Number(e.target.value))}
                      placeholder="e.g. 500000"
                      className="flex-1 px-4 py-2 border border-[#1a1a2e] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/30"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-white mb-2">Total Commission %</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={totalCommPct}
                      onChange={(e) => setTotalCommPct(Number(e.target.value))}
                      placeholder="e.g. 5"
                      className="flex-1 px-4 py-2 border border-[#1a1a2e] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/30"
                    />
                    <span className="text-gray-400">%</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Brokerage Split % <span className="text-gray-400 text-xs">(your share)</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={brokageSplit}
                      onChange={(e) => setBrokageSplit(Number(e.target.value))}
                      placeholder="e.g. 80"
                      className="flex-1 px-4 py-2 border border-[#1a1a2e] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/30"
                    />
                    <span className="text-gray-400">%</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-2">% of gross commission that goes to you after brokerage split</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Referral Fee % <span className="text-gray-400 text-xs">Optional</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={referralFeePct}
                      onChange={(e) => setReferralFeePct(Number(e.target.value))}
                      placeholder="e.g. 25"
                      className="flex-1 px-4 py-2 border border-[#1a1a2e] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/30"
                    />
                    <span className="text-gray-400">%</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-2">% of your agent split paid as referral fee</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Transaction Fee <span className="text-gray-400 text-xs">Optional</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400">$</span>
                    <input
                      type="number"
                      value={transactionFee}
                      onChange={(e) => setTransactionFee(Number(e.target.value))}
                      placeholder="e.g. 395"
                      className="flex-1 px-4 py-2 border border-[#1a1a2e] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/30"
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-2">Flat fee deducted from your commission</p>
                </div>
              </div>
            </div>

            {/* Results Section */}
            <div>
              <h3 className="text-lg font-bold text-white mb-6">Results</h3>

              {/* Display Vault result if available, otherwise local calculation */}
              <div className={`bg-gradient-to-br rounded-lg p-8 text-white mb-6 ${vaultResult ? 'from-purple-500 to-purple-600' : 'from-green-500 to-green-600'}`}>
                <p className="text-sm font-medium opacity-90">
                  {vaultResult ? 'Vault-Calculated Net Commission' : 'Estimated Net Commission'}
                </p>
                <p className="text-5xl font-bold mt-2">
                  ${vaultResult?.net_commission || netCommission.toFixed(2)}
                </p>
              </div>

              <div className="space-y-4 bg-[#050507] rounded-lg p-6">
                <div className="flex justify-between items-center">
                  <span className="text-gray-200">Gross Commission</span>
                  <span className="font-semibold text-white">${grossCommission.toFixed(2)}</span>
                </div>
                <div className="border-t border-[#1a1a2e] pt-4">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-200">Your Split ({brokageSplit}%)</span>
                    <span className="font-semibold text-white">${yourSplit.toFixed(2)}</span>
                  </div>
                </div>
                {referralFeePct > 0 && (
                  <div className="border-t border-[#1a1a2e] pt-4">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-200">Referral Fee ({referralFeePct}%)</span>
                      <span className="font-semibold text-red-600">-${referralFee.toFixed(2)}</span>
                    </div>
                  </div>
                )}
                {transactionFee > 0 && (
                  <div className="border-t border-[#1a1a2e] pt-4">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-200">Transaction Fee</span>
                      <span className="font-semibold text-red-600">-${transactionFee.toFixed(2)}</span>
                    </div>
                  </div>
                )}
                <div className="border-t-2 border-[#1a1a2e] pt-4 mt-4">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-white">Net Commission</span>
                    <span className="text-2xl font-bold text-green-600">${netCommission.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={calculateWithVault}
                  disabled={isCalculating}
                  className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition font-medium disabled:bg-purple-400"
                >
                  {isCalculating ? 'Calculating...' : 'Calculate with Vault'}
                </button>
                <button
                  onClick={() => {
                    setSalePrice(500000)
                    setTotalCommPct(5)
                    setBrokageSplit(80)
                    setReferralFeePct(0)
                    setTransactionFee(295)
                    setVaultResult(null)
                  }}
                  className="flex-1 px-4 py-2 border border-[#1a1a2e] text-gray-200 rounded-lg hover:bg-[#0a0a0f] transition font-medium"
                >
                  ↺ Reset
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
