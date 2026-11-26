'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../providers'
import Link from 'next/link'
import { vaultAPI } from '@/lib/vault-client'
import { authFetch } from '@/lib/supabase'

// FINSEC closeout (P1) — this page used to open with an 80% split and a $295
// fee and call the result "your" net commission. Those were invented numbers,
// not the agent's agreement (three agents signed at $395). Now:
//   • verified signed terms from Vault (/api/vault/compensation with
//     terms_verified === true) prefill the split and fee, labelled as such;
//   • otherwise the split and fee start EMPTY and every result is labelled an
//     illustrative estimate — no default is ever presented as the agent's terms.
type TermsState =
  | { kind: 'loading' }
  | { kind: 'verified'; agentSplitPct: number; transactionFee: number; planVersion: string | null }
  | { kind: 'unverified'; notice: string | null }

const numOrEmpty = (v: string): number | '' => (v === '' ? '' : Number(v))
const n = (v: number | ''): number => (v === '' || !Number.isFinite(v) ? 0 : v)

export default function CommissionCalculatorPage() {
  const { user, role, loading, signOut } = useAuth()
  const router = useRouter()

  const [salePrice, setSalePrice] = useState(500000)
  const [totalCommPct, setTotalCommPct] = useState(5)
  const [brokageSplit, setBrokageSplit] = useState<number | ''>('')
  const [referralFeePct, setReferralFeePct] = useState(0)
  const [transactionFee, setTransactionFee] = useState<number | ''>('')
  const [vaultResult, setVaultResult] = useState<any>(null)
  const [isCalculating, setIsCalculating] = useState(false)
  const [terms, setTerms] = useState<TermsState>({ kind: 'loading' })

  // The agent's own terms, only when Vault has verified a signed agreement.
  useEffect(() => {
    if (!user) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await authFetch('/api/vault/compensation')
        const data = res.ok ? await res.json() : null
        if (cancelled) return
        const plan = data?.plan
        if (
          data?.terms_verified === true &&
          plan &&
          Number.isFinite(plan.agentSplitPct) &&
          Number.isFinite(plan.transactionFee)
        ) {
          setTerms({
            kind: 'verified',
            agentSplitPct: plan.agentSplitPct,
            transactionFee: plan.transactionFee,
            planVersion: data?.signed_terms?.planVersion ?? null,
          })
          setBrokageSplit(plan.agentSplitPct)
          setTransactionFee(plan.transactionFee)
        } else {
          setTerms({ kind: 'unverified', notice: typeof data?.terms_notice === 'string' ? data.terms_notice : null })
        }
      } catch {
        if (!cancelled) setTerms({ kind: 'unverified', notice: null })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user])

  const usingVerifiedTerms =
    terms.kind === 'verified' &&
    brokageSplit === terms.agentSplitPct &&
    transactionFee === terms.transactionFee

  // Local calculation for immediate UI feedback
  const grossCommission = (salePrice * totalCommPct) / 100
  const yourSplit = (grossCommission * n(brokageSplit)) / 100
  const referralFee = (yourSplit * referralFeePct) / 100
  const netCommission = yourSplit - referralFee - n(transactionFee)

  // Calculate using Vault API (for broker-defined rules and compliance)
  const calculateWithVault = async () => {
    if (!user) return

    try {
      setIsCalculating(true)
      const result = await vaultAPI.commissions.calculate(
        {
          salePrice,
          commissionRate: totalCommPct,
          brokerSplit: n(brokageSplit),
          referralFee: referralFeePct,
          transactionFee: n(transactionFee),
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
          <p className="text-gray-400 mb-4">
            Quickly estimate your net earnings on any deal. Results update automatically as you type.
          </p>
          <p data-testid="calc-terms-basis" className="text-sm mb-8 text-amber-300">
            {terms.kind === 'verified'
              ? `Split and fee prefilled from your signed agreement${terms.planVersion ? ` (plan ${terms.planVersion})` : ''}. Change them to explore a what-if.`
              : terms.kind === 'unverified'
                ? `Illustrative estimate only — these are not your compensation terms. ${terms.notice ?? 'Your compensation terms are being verified by the Broker of Record.'} Enter a split and fee to explore.`
                : 'Loading your compensation terms…'}
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
                      aria-label="Brokerage split percent"
                      onChange={(e) => setBrokageSplit(numOrEmpty(e.target.value))}
                      placeholder="your split %"
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
                      aria-label="Transaction fee"
                      onChange={(e) => setTransactionFee(numOrEmpty(e.target.value))}
                      placeholder="flat fee per closing"
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
                  {vaultResult
                    ? 'Vault-Calculated Net Commission'
                    : usingVerifiedTerms
                      ? 'Estimated Net Commission (your signed terms)'
                      : 'Illustrative Estimate — not your terms'}
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
                    <span className="text-gray-200">
                      {usingVerifiedTerms ? 'Your Split' : 'Entered Split'} ({n(brokageSplit)}%)
                    </span>
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
                {n(transactionFee) > 0 && (
                  <div className="border-t border-[#1a1a2e] pt-4">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-200">Transaction Fee</span>
                      <span className="font-semibold text-red-600">-${n(transactionFee).toFixed(2)}</span>
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
                    setBrokageSplit(terms.kind === 'verified' ? terms.agentSplitPct : '')
                    setReferralFeePct(0)
                    setTransactionFee(terms.kind === 'verified' ? terms.transactionFee : '')
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
