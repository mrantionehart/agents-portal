'use client'

import { useState } from 'react'
import { FileText, CheckCircle } from 'lucide-react'
import { createClient } from '@supabase/supabase-js'

interface PolicyAcceptanceModalProps {
  userId: string
  userName: string
  onAcceptance: () => void
}

export default function PolicyAcceptanceModal({ userId, userName, onAcceptance }: PolicyAcceptanceModalProps) {
  const [hasRead, setHasRead] = useState(false)
  const [isAccepting, setIsAccepting] = useState(false)
  const [showPdf, setShowPdf] = useState(false)

  const handleAccept = async () => {
    if (!hasRead) {
      alert('Please review the policy before accepting')
      return
    }

    setIsAccepting(true)

    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

      if (supabaseUrl && supabaseKey) {
        const supabase = createClient(supabaseUrl, supabaseKey)

        const { error } = await supabase
          .from('policy_acceptances')
          .insert({
            user_id: userId,
            policy_type: 'brokerage_manual',
            accepted_at: new Date().toISOString(),
            user_name: userName
          })

        if (error) {
          console.error('Database error:', error)
        }
      }

      // Save to localStorage to avoid re-checking
      localStorage.setItem(`policy_accepted_${userId}`, 'true')

      onAcceptance()
    } catch (error) {
      console.error('Error recording acceptance:', error)
      // Still accept even if database fails, but warn user
      localStorage.setItem(`policy_accepted_${userId}`, 'true')
      onAcceptance()
    } finally {
      setIsAccepting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-[#0a0a0f] rounded-lg shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-red-600 to-red-700 text-white p-6 border-b border-red-800">
          <div className="flex items-center gap-3">
            <FileText className="w-8 h-8" />
            <div>
              <h2 className="text-2xl font-bold">HartFelt Ready™ Brokerage Policy Manual</h2>
              <p className="text-red-100 text-sm mt-1">Required acknowledgment before portal access</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-8">
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 mb-6">
            <p className="text-blue-900 text-sm">
              <strong>Welcome to HartFelt Real Estate!</strong> Before you can access the agent portal, you must acknowledge that you have reviewed and understand the HartFelt Brokerage Policy Manual.
            </p>
          </div>

          {/* Summary of Key Policies */}
          <div className="mb-6">
            <h3 className="text-lg font-bold text-white mb-4">Key Policy Areas:</h3>
            <ul className="space-y-2 text-gray-200">
              <li className="flex items-start gap-2">
                <span className="text-red-600 font-bold mt-1">•</span>
                <span><strong>Commission Structure:</strong> Understanding how your commissions are calculated and when they are paid</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-600 font-bold mt-1">•</span>
                <span><strong>Compliance Requirements:</strong> Legal and regulatory obligations you must follow</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-600 font-bold mt-1">•</span>
                <span><strong>Code of Conduct:</strong> Professional standards and ethical expectations</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-600 font-bold mt-1">•</span>
                <span><strong>Dispute Resolution:</strong> How issues and conflicts are handled</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-600 font-bold mt-1">•</span>
                <span><strong>Termination & Separation:</strong> Conditions and procedures for ending your relationship with HartFelt</span>
              </li>
            </ul>
          </div>

          {/* PDF Viewer Button */}
          <div className="mb-6">
            <button
              onClick={() => setShowPdf(!showPdf)}
              className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition font-medium flex items-center justify-center gap-2"
            >
              <FileText className="w-5 h-5" />
              {showPdf ? 'Hide Full Policy Manual' : 'View Full Policy Manual (PDF)'}
            </button>
          </div>

          {/* PDF Embed */}
          {showPdf && (
            <div className="mb-6 border border-[#1a1a2e] rounded-lg overflow-hidden bg-[#0a0a0f]">
              <iframe
                src="/training/brokerage-policy-manual.pdf"
                className="w-full h-[500px]"
                title="Brokerage Policy Manual"
              />
            </div>
          )}

          {/* Acceptance Checkbox */}
          <div className="bg-[#050507] border border-[#1a1a2e] rounded-lg p-4 mb-6">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={hasRead}
                onChange={(e) => setHasRead(e.target.checked)}
                className="mt-1 w-5 h-5 text-red-600 rounded focus:ring-2 focus:ring-red-500"
              />
              <span className="text-gray-200">
                I acknowledge that I have reviewed the HartFelt Brokerage Policy Manual and understand the policies, procedures, and requirements outlined within. I agree to comply with all policies and procedures outlined in this manual.
              </span>
            </label>
          </div>

          {/* Legal Notice */}
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 mb-6">
            <p className="text-yellow-900 text-xs">
              <strong>Note:</strong> This acknowledgment will be recorded and kept on file. You may request a copy of the signed acknowledgment at any time. The policies outlined in this manual are subject to change at HartFelt's discretion with proper notice to all agents.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-[#050507] border-t border-[#1a1a2e] p-6 flex gap-4">
          <button
            onClick={handleAccept}
            disabled={!hasRead || isAccepting}
            className={`flex-1 py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition ${
              hasRead && !isAccepting
                ? 'bg-green-600 text-white hover:bg-green-700'
                : 'bg-[#1a1a2e] text-gray-400 cursor-not-allowed'
            }`}
          >
            <CheckCircle className="w-5 h-5" />
            {isAccepting ? 'Accepting...' : 'Accept & Continue'}
          </button>
        </div>
      </div>
    </div>
  )
}
