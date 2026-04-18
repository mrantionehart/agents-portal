'use client'

import { useRouter } from 'next/navigation'
import { useAuth } from '../providers'
import Link from 'next/link'
import { ArrowLeft, Plus, Mail, Edit, Trash2, Send, Copy, X } from 'lucide-react'
import { useState, useEffect } from 'react'
import { vaultAPI } from '@/lib/vault-client'
import ComplianceNotifications from '../components/compliance-notifications'

interface EmailTemplate {
  id: string
  name: string
  category: string
  subject: string
  body: string
  isDefault: boolean
  createdAt: string
}

const DEFAULT_CATEGORIES = [
  { id: 'leads', name: 'Lead Follow-up', icon: '📧', color: 'text-blue-600' },
  { id: 'clients', name: 'Client Communication', icon: '👥', color: 'text-green-600' },
  { id: 'team', name: 'Team Messages', icon: '👔', color: 'text-purple-600' },
  { id: 'closing', name: 'Closing Coordination', icon: '🔑', color: 'text-amber-600' },
  { id: 'marketing', name: 'Marketing', icon: '📢', color: 'text-red-600' },
]

const DEFAULT_TEMPLATES: EmailTemplate[] = [
  {
    id: 'd1',
    name: 'Lead Follow-up',
    category: 'leads',
    subject: 'Following Up: {property_address}',
    body: `Hi {first_name},

I wanted to follow up on our discussion about {property_address}. I believe this is a great opportunity for you.

Would you like to schedule a time to discuss this further?

Best regards,
{agent_name}`,
    isDefault: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'd2',
    name: 'Property Interest',
    category: 'leads',
    subject: 'Interested in {property_address}?',
    body: `Hello {first_name},

I saw your interest in {property_address}. I have some great information about this property that I think you'll be interested in.

Contact me to learn more!

Best regards,
{agent_name}`,
    isDefault: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'd3',
    name: 'Under Contract Notification',
    category: 'closing',
    subject: 'Great News: We\'re Under Contract!',
    body: `Dear {client_name},

Congratulations! Your offer on {property_address} has been accepted!

Next steps:
- Home inspection scheduled for {inspection_date}
- Appraisal will be ordered this week
- We'll schedule a final walkthrough before closing

I'll keep you updated every step of the way.

Best regards,
{agent_name}`,
    isDefault: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'd4',
    name: 'Just Sold',
    category: 'marketing',
    subject: 'Just Sold in Your Neighborhood!',
    body: `Hi Neighbor,

I wanted to share some great news! I just helped close a sale on {property_address} in your area.

If you're curious about your home's value or considering selling, I'd love to help!

Best regards,
{agent_name}`,
    isDefault: true,
    createdAt: new Date().toISOString(),
  },
]

export default function EmailTemplatesPage() {
  const { user, role, loading, signOut } = useAuth()
  const router = useRouter()
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [templatesLoading, setTemplatesLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null)
  const [showComposer, setShowComposer] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [recipientEmail, setRecipientEmail] = useState('')
  const [composerVariables, setComposerVariables] = useState<Record<string, string>>({})
  const [newTemplate, setNewTemplate] = useState({
    name: '',
    category: 'leads',
    subject: '',
    body: '',
  })

  // Load templates from Vault API, fallback to defaults if empty
  useEffect(() => {
    const loadTemplates = async () => {
      if (!user) return
      try {
        setTemplatesLoading(true)
        const data = await vaultAPI.emailTemplates.list(user.id, role)
        if (data && Array.isArray(data) && data.length > 0) {
          setTemplates(data)
        } else {
          setTemplates(DEFAULT_TEMPLATES)
        }
      } catch (err) {
        console.error('Failed to load templates from API, using defaults:', err)
        setTemplates(DEFAULT_TEMPLATES)
      } finally {
        setTemplatesLoading(false)
      }
    }
    loadTemplates()
  }, [user, role])

  const filteredTemplates = selectedCategory
    ? templates.filter((t) => t.category === selectedCategory)
    : templates

  const handleSelectTemplate = (template: EmailTemplate) => {
    setSelectedTemplate(template)
    setShowComposer(true)
    setComposerVariables({})
  }

  const handleCreateTemplate = async () => {
    if (!newTemplate.name || !newTemplate.subject || !newTemplate.body) {
      alert('Please fill in all fields')
      return
    }

    if (!user) return

    try {
      const created = await vaultAPI.emailTemplates.create(newTemplate, user.id, role)
      if (created && created.id) {
        setTemplates([...templates, created])
      } else {
        // Fallback: add locally if API doesn't return the created template
        const template: EmailTemplate = {
          id: `c${Date.now()}`,
          ...newTemplate,
          isDefault: false,
          createdAt: new Date().toISOString(),
        }
        setTemplates([...templates, template])
      }
      setNewTemplate({ name: '', category: 'leads', subject: '', body: '' })
      setShowCreateForm(false)
    } catch (err) {
      console.error('Failed to create template via API:', err)
      // Fallback: add locally
      const template: EmailTemplate = {
        id: `c${Date.now()}`,
        ...newTemplate,
        isDefault: false,
        createdAt: new Date().toISOString(),
      }
      setTemplates([...templates, template])
      setNewTemplate({ name: '', category: 'leads', subject: '', body: '' })
      setShowCreateForm(false)
    }
  }

  const handleSendEmail = async () => {
    if (!recipientEmail || !selectedTemplate) {
      alert('Please enter a recipient email')
      return
    }

    if (!user) return

    try {
      // Replace variables in subject and body
      let subject = selectedTemplate.subject
      let body = selectedTemplate.body

      Object.entries(composerVariables).forEach(([key, value]) => {
        const regex = new RegExp(`{${key}}`, 'g')
        subject = subject.replace(regex, value)
        body = body.replace(regex, value)
      })

      await vaultAPI.emailTemplates.send(recipientEmail, selectedTemplate.id, composerVariables, user.id, role)

      alert('Email sent successfully!')
      setShowComposer(false)
      setSelectedTemplate(null)
      setRecipientEmail('')
      setComposerVariables({})
    } catch (err) {
      alert(`Failed to send email: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return
    if (!user) return

    try {
      await vaultAPI.emailTemplates.delete(templateId, user.id, role)
    } catch (err) {
      console.error('Failed to delete template via API:', err)
    }
    setTemplates(templates.filter((t) => t.id !== templateId))
  }

  const handleSignOut = async () => {
    await signOut()
    router.push('/login')
  }

  const extractVariables = (text: string): string[] => {
    const regex = /{(\w+)}/g
    const matches = text.match(regex) || []
    return [...new Set(matches.map((m) => m.slice(1, -1)))]
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
            <Link href="/dashboard" className="text-blue-600 hover:text-blue-700 font-medium flex items-center gap-2">
              <ArrowLeft className="w-5 h-5" />
              Dashboard
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">Email Templates</h1>
          </div>
          <div className="flex items-center gap-4">
            <ComplianceNotifications userId={user?.id} role={role} />
            <button
              onClick={handleSignOut}
              className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Create Template Button */}
        <div className="mb-8">
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            {showCreateForm ? 'Cancel' : 'Create New Template'}
          </button>
        </div>

        {/* Create Template Form */}
        {showCreateForm && (
          <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Create New Template</h2>
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Template Name *</label>
                <input
                  type="text"
                  value={newTemplate.name}
                  onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                  placeholder="e.g., Monthly Market Update"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Category *</label>
                <select
                  value={newTemplate.category}
                  onChange={(e) => setNewTemplate({ ...newTemplate, category: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  {DEFAULT_CATEGORIES.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Subject Line *</label>
                <input
                  type="text"
                  value={newTemplate.subject}
                  onChange={(e) => setNewTemplate({ ...newTemplate, subject: e.target.value })}
                  placeholder="e.g., Market Update for {area_name}"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email Body *</label>
                <textarea
                  value={newTemplate.body}
                  onChange={(e) => setNewTemplate({ ...newTemplate, body: e.target.value })}
                  rows={8}
                  placeholder="Use {variable_name} for dynamic content like {client_name}, {property_address}, etc."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="bg-blue-50 p-4 rounded-lg text-sm text-blue-800">
                <p className="font-semibold mb-2">Available Variables:</p>
                <p>{'{client_name}'}, {'{first_name}'}, {'{property_address}'}, {'{agent_name}'}, {'{inspection_date}'}, and more</p>
              </div>

              <button
                onClick={handleCreateTemplate}
                className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition font-medium"
              >
                Save Template
              </button>
            </div>
          </div>
        )}

        {/* Category Filter */}
        <div className="flex flex-wrap gap-2 mb-8">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`px-4 py-2 rounded-lg transition ${
              selectedCategory === null
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            All Templates
          </button>
          {DEFAULT_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-4 py-2 rounded-lg transition ${
                selectedCategory === cat.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              {cat.icon} {cat.name}
            </button>
          ))}
        </div>

        {/* Templates Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {filteredTemplates.map((template) => (
            <div key={template.id} className="bg-white rounded-lg shadow hover:shadow-lg transition p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="font-bold text-gray-900 mb-1">{template.name}</h3>
                  <p className="text-xs text-gray-500">
                    {DEFAULT_CATEGORIES.find((c) => c.id === template.category)?.name}
                  </p>
                </div>
                {template.isDefault && (
                  <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">Default</span>
                )}
              </div>

              <p className="text-sm text-gray-700 mb-4 line-clamp-2">{template.subject}</p>

              <div className="flex gap-2">
                <button
                  onClick={() => handleSelectTemplate(template)}
                  className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition text-sm font-medium flex items-center justify-center gap-1"
                >
                  <Mail className="w-4 h-4" />
                  Use
                </button>
                {!template.isDefault && (
                  <>
                    <button
                      onClick={() => handleDeleteTemplate(template.id)}
                      className="px-3 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Email Composer Modal */}
        {showComposer && selectedTemplate && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-96 overflow-y-auto">
              {/* Modal Header */}
              <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex justify-between items-center">
                <h2 className="text-xl font-bold text-gray-900">Send Email: {selectedTemplate.name}</h2>
                <button onClick={() => setShowComposer(false)}>
                  <X className="w-6 h-6 text-gray-500 hover:text-gray-700" />
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-6 space-y-4">
                {/* Recipient Email */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Recipient Email *</label>
                  <input
                    type="email"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    placeholder="recipient@example.com"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Variables */}
                {extractVariables(`${selectedTemplate.subject}${selectedTemplate.body}`).length > 0 && (
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm font-medium text-gray-900 mb-3">Fill in Variables:</p>
                    <div className="space-y-2">
                      {extractVariables(`${selectedTemplate.subject}${selectedTemplate.body}`).map((variable) => (
                        <input
                          key={variable}
                          type="text"
                          placeholder={variable}
                          value={composerVariables[variable] || ''}
                          onChange={(e) =>
                            setComposerVariables({ ...composerVariables, [variable]: e.target.value })
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Preview */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm font-medium text-gray-900 mb-2">Preview:</p>
                  <div className="bg-white border border-gray-300 rounded p-3">
                    <p className="text-xs text-gray-500 mb-1">Subject:</p>
                    <p className="text-sm font-semibold text-gray-900 mb-4">
                      {selectedTemplate.subject.replace(/{(\w+)}/g, (match, variable) => composerVariables[variable] || match)}
                    </p>
                    <p className="text-xs text-gray-500 mb-1">Body:</p>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">
                      {selectedTemplate.body.replace(/{(\w+)}/g, (match, variable) => composerVariables[variable] || match)}
                    </p>
                  </div>
                </div>

                {/* Send Button */}
                <button
                  onClick={handleSendEmail}
                  className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 transition font-medium flex items-center justify-center gap-2"
                >
                  <Send className="w-5 h-5" />
                  Send Email
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
