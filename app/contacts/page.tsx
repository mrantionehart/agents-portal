'use client'

import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../providers'
import Link from 'next/link'
import {
  ArrowLeft, Plus, Search, Upload, Edit, Trash2, Mail, Phone,
  Building, Tag, X, Download, Users, Filter
} from 'lucide-react'

interface Contact {
  id: string
  full_name: string
  email: string | null
  phone: string | null
  company: string | null
  category_id: string | null
  notes: string | null
  contact_categories: { id: string; name: string; color: string } | null
}

interface Category {
  id: string
  name: string
  color: string
  owner_id: string | null
}

export default function ContactsPage() {
  const { user } = useAuth()
  const [contacts, setContacts] = useState<Contact[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState<string | ''>('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [showUpload, setShowUpload] = useState(false)
  const [editingContact, setEditingContact] = useState<Contact | null>(null)
  const [showNewCategory, setShowNewCategory] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Form state
  const [form, setForm] = useState({
    full_name: '', email: '', phone: '', company: '', category_id: '', notes: ''
  })

  const [newCategoryName, setNewCategoryName] = useState('')
  const [newCategoryColor, setNewCategoryColor] = useState('#C9A84C')

  // CSV state
  const [csvData, setCsvData] = useState<any[]>([])
  const [csvHeaders, setCsvHeaders] = useState<string[]>([])
  const [csvMapping, setCsvMapping] = useState<Record<string, string>>({})
  const [csvCategoryId, setCsvCategoryId] = useState('')
  const [importing, setImporting] = useState(false)

  useEffect(() => {
    loadContacts()
    loadCategories()
  }, [filterCategory, search])

  const loadContacts = async () => {
    const params = new URLSearchParams()
    if (filterCategory) params.set('category', filterCategory)
    if (search) params.set('search', search)

    const res = await fetch(`/api/contacts?${params}`)
    if (res.ok) setContacts(await res.json())
    setLoading(false)
  }

  const loadCategories = async () => {
    const res = await fetch('/api/contacts/categories')
    if (res.ok) setCategories(await res.json())
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const method = editingContact ? 'PUT' : 'POST'
    const url = editingContact ? `/api/contacts/${editingContact.id}` : '/api/contacts'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })

    if (res.ok) {
      setShowAddForm(false)
      setEditingContact(null)
      setForm({ full_name: '', email: '', phone: '', company: '', category_id: '', notes: '' })
      loadContacts()
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this contact?')) return
    await fetch(`/api/contacts/${id}`, { method: 'DELETE' })
    loadContacts()
  }

  const handleEdit = (contact: Contact) => {
    setEditingContact(contact)
    setForm({
      full_name: contact.full_name,
      email: contact.email || '',
      phone: contact.phone || '',
      company: contact.company || '',
      category_id: contact.category_id || '',
      notes: contact.notes || '',
    })
    setShowAddForm(true)
  }

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault()
    const res = await fetch('/api/contacts/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newCategoryName, color: newCategoryColor }),
    })
    if (res.ok) {
      setNewCategoryName('')
      setShowNewCategory(false)
      loadCategories()
    }
  }

  // CSV Upload
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (evt) => {
      const text = evt.target?.result as string
      const lines = text.split('\n').filter(l => l.trim())
      if (lines.length < 2) return

      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''))
      const rows = lines.slice(1).map(line => {
        const values = line.match(/(".*?"|[^,]+)/g)?.map(v => v.trim().replace(/^"|"$/g, '')) || []
        const obj: Record<string, string> = {}
        headers.forEach((h, i) => { obj[h] = values[i] || '' })
        return obj
      })

      setCsvHeaders(headers)
      setCsvData(rows)

      // Auto-map common column names
      const mapping: Record<string, string> = {}
      const nameFields = ['name', 'full_name', 'fullname', 'contact', 'contact name']
      const emailFields = ['email', 'e-mail', 'email address']
      const phoneFields = ['phone', 'telephone', 'mobile', 'cell', 'phone number']
      const companyFields = ['company', 'organization', 'org', 'business']

      headers.forEach(h => {
        const lower = h.toLowerCase()
        if (nameFields.includes(lower)) mapping[h] = 'full_name'
        else if (emailFields.includes(lower)) mapping[h] = 'email'
        else if (phoneFields.includes(lower)) mapping[h] = 'phone'
        else if (companyFields.includes(lower)) mapping[h] = 'company'
      })

      setCsvMapping(mapping)
      setShowUpload(true)
    }
    reader.readAsText(file)
  }

  const handleImport = async () => {
    setImporting(true)
    const contacts = csvData.map(row => {
      const mapped: any = {}
      Object.entries(csvMapping).forEach(([csvCol, field]) => {
        if (field && row[csvCol]) mapped[field] = row[csvCol]
      })
      if (csvCategoryId) mapped.category_id = csvCategoryId
      return mapped
    }).filter(c => c.full_name)

    const res = await fetch('/api/contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(contacts),
    })

    if (res.ok) {
      setShowUpload(false)
      setCsvData([])
      setCsvHeaders([])
      setCsvMapping({})
      loadContacts()
    }
    setImporting(false)
  }

  const fieldOptions = [
    { value: '', label: 'Skip' },
    { value: 'full_name', label: 'Name' },
    { value: 'email', label: 'Email' },
    { value: 'phone', label: 'Phone' },
    { value: 'company', label: 'Company' },
    { value: 'notes', label: 'Notes' },
  ]

  const categoryColors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316', '#C9A84C']

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="text-gray-400 hover:text-white">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Contacts</h1>
            <p className="text-gray-400 text-sm mt-1">{contacts.length} contacts</p>
          </div>
        </div>
        <div className="flex gap-3">
          <label className="flex items-center gap-2 px-4 py-2 bg-[#111] border border-[#222] rounded-lg cursor-pointer hover:bg-[#1a1a1a] text-sm">
            <Upload className="w-4 h-4" />
            Upload CSV
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleFileSelect}
            />
          </label>
          <button
            onClick={() => { setShowAddForm(true); setEditingContact(null); setForm({ full_name: '', email: '', phone: '', company: '', category_id: '', notes: '' }) }}
            className="flex items-center gap-2 px-4 py-2 bg-[#C9A84C] text-black rounded-lg font-medium hover:bg-[#d4b65c] text-sm"
          >
            <Plus className="w-4 h-4" />
            Add Contact
          </button>
        </div>
      </div>

      {/* Search + Filter */}
      <div className="flex gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search contacts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-[#111] border border-[#222] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/30"
          />
        </div>
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="px-4 py-2 bg-[#111] border border-[#222] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/30"
        >
          <option value="">All Categories</option>
          {categories.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {/* Category Pills */}
      <div className="flex flex-wrap gap-2 mb-6">
        {categories.map(cat => (
          <button
            key={cat.id}
            onClick={() => setFilterCategory(filterCategory === cat.id ? '' : cat.id)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
              filterCategory === cat.id
                ? 'border-[#C9A84C] bg-[#C9A84C]/10 text-[#C9A84C]'
                : 'border-[#222] bg-[#111] text-gray-400 hover:border-[#333]'
            }`}
          >
            <span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ backgroundColor: cat.color }} />
            {cat.name}
          </button>
        ))}
        <button
          onClick={() => setShowNewCategory(true)}
          className="px-3 py-1 rounded-full text-xs font-medium border border-dashed border-[#333] text-gray-500 hover:text-white hover:border-[#C9A84C]"
        >
          + New Category
        </button>
      </div>

      {/* Contacts Table */}
      <div className="bg-[#0a0a0f] border border-[#1a1a2e] rounded-lg overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#1a1a2e]">
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Email</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Phone</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Company</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Category</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">Loading...</td></tr>
            ) : contacts.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">No contacts yet. Add one or upload a CSV.</td></tr>
            ) : (
              contacts.map(contact => (
                <tr key={contact.id} className="border-b border-[#1a1a2e] hover:bg-[#111] transition-colors">
                  <td className="px-4 py-3 text-sm font-medium">{contact.full_name}</td>
                  <td className="px-4 py-3 text-sm text-gray-400">{contact.email || '-'}</td>
                  <td className="px-4 py-3 text-sm text-gray-400">{contact.phone || '-'}</td>
                  <td className="px-4 py-3 text-sm text-gray-400">{contact.company || '-'}</td>
                  <td className="px-4 py-3 text-sm">
                    {contact.contact_categories ? (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs border border-[#222]">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: contact.contact_categories.color }} />
                        {contact.contact_categories.name}
                      </span>
                    ) : '-'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {contact.email && (
                        <Link
                          href={`/email?to=${encodeURIComponent(contact.email)}&name=${encodeURIComponent(contact.full_name)}&contactId=${contact.id}`}
                          className="p-1.5 text-gray-500 hover:text-[#C9A84C] rounded"
                        >
                          <Mail className="w-4 h-4" />
                        </Link>
                      )}
                      <button onClick={() => handleEdit(contact)} className="p-1.5 text-gray-500 hover:text-white rounded">
                        <Edit className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(contact.id)} className="p-1.5 text-gray-500 hover:text-red-400 rounded">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Contact Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-[#0a0a0f] border border-[#1a1a2e] rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">{editingContact ? 'Edit Contact' : 'Add Contact'}</h2>
              <button onClick={() => { setShowAddForm(false); setEditingContact(null) }} className="text-gray-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <input
                type="text"
                placeholder="Full Name *"
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                className="w-full px-3 py-2 bg-[#111] border border-[#222] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/30"
                required
              />
              <input
                type="email"
                placeholder="Email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-3 py-2 bg-[#111] border border-[#222] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/30"
              />
              <input
                type="tel"
                placeholder="Phone"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full px-3 py-2 bg-[#111] border border-[#222] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/30"
              />
              <input
                type="text"
                placeholder="Company"
                value={form.company}
                onChange={(e) => setForm({ ...form, company: e.target.value })}
                className="w-full px-3 py-2 bg-[#111] border border-[#222] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/30"
              />
              <select
                value={form.category_id}
                onChange={(e) => setForm({ ...form, category_id: e.target.value })}
                className="w-full px-3 py-2 bg-[#111] border border-[#222] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/30"
              >
                <option value="">No Category</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <textarea
                placeholder="Notes"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 bg-[#111] border border-[#222] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/30 resize-none"
              />
              <button
                type="submit"
                className="w-full bg-[#C9A84C] text-black py-2 rounded-lg font-medium hover:bg-[#d4b65c]"
              >
                {editingContact ? 'Save Changes' : 'Add Contact'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* CSV Upload Modal */}
      {showUpload && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-[#0a0a0f] border border-[#1a1a2e] rounded-lg p-6 w-full max-w-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Import CSV — {csvData.length} rows</h2>
              <button onClick={() => setShowUpload(false)} className="text-gray-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-gray-400 mb-4">Map your CSV columns to contact fields:</p>

            <div className="space-y-2 mb-4">
              {csvHeaders.map(header => (
                <div key={header} className="flex items-center gap-3">
                  <span className="text-sm text-gray-300 w-40 truncate">{header}</span>
                  <span className="text-gray-600">→</span>
                  <select
                    value={csvMapping[header] || ''}
                    onChange={(e) => setCsvMapping({ ...csvMapping, [header]: e.target.value })}
                    className="flex-1 px-3 py-1.5 bg-[#111] border border-[#222] rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/30"
                  >
                    {fieldOptions.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            <div className="mb-4">
              <label className="text-sm text-gray-400 block mb-1">Assign category to all imported contacts:</label>
              <select
                value={csvCategoryId}
                onChange={(e) => setCsvCategoryId(e.target.value)}
                className="w-full px-3 py-2 bg-[#111] border border-[#222] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/30"
              >
                <option value="">No Category</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Preview */}
            <div className="bg-[#111] border border-[#222] rounded-lg p-3 mb-4 max-h-40 overflow-y-auto">
              <p className="text-xs text-gray-500 mb-2">Preview (first 3 rows):</p>
              {csvData.slice(0, 3).map((row, i) => (
                <div key={i} className="text-xs text-gray-300 mb-1">
                  {Object.entries(csvMapping)
                    .filter(([, field]) => field)
                    .map(([col, field]) => `${field}: ${row[col]}`)
                    .join(' | ') || 'Map columns above'}
                </div>
              ))}
            </div>

            <button
              onClick={handleImport}
              disabled={importing || !Object.values(csvMapping).includes('full_name')}
              className="w-full bg-[#C9A84C] text-black py-2 rounded-lg font-medium hover:bg-[#d4b65c] disabled:opacity-50"
            >
              {importing ? 'Importing...' : `Import ${csvData.length} Contacts`}
            </button>
            {!Object.values(csvMapping).includes('full_name') && (
              <p className="text-xs text-red-400 mt-2 text-center">You must map at least one column to "Name"</p>
            )}
          </div>
        </div>
      )}

      {/* New Category Modal */}
      {showNewCategory && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-[#0a0a0f] border border-[#1a1a2e] rounded-lg p-6 w-full max-w-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">New Category</h2>
              <button onClick={() => setShowNewCategory(false)} className="text-gray-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateCategory} className="space-y-3">
              <input
                type="text"
                placeholder="Category name"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                className="w-full px-3 py-2 bg-[#111] border border-[#222] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/30"
                required
              />
              <div>
                <label className="text-xs text-gray-400 block mb-2">Color</label>
                <div className="flex gap-2">
                  {categoryColors.map(color => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setNewCategoryColor(color)}
                      className={`w-7 h-7 rounded-full border-2 transition-all ${
                        newCategoryColor === color ? 'border-white scale-110' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
              <button type="submit" className="w-full bg-[#C9A84C] text-black py-2 rounded-lg font-medium hover:bg-[#d4b65c]">
                Create Category
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
