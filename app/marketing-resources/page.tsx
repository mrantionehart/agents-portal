'use client'

import { useRouter } from 'next/navigation'
import { useAuth } from '../providers'
import Link from 'next/link'
import { Download, FileText, Image, Video, Share2, Zap, PenTool, BarChart3 } from 'lucide-react'
import { useState, useEffect } from 'react'

interface MarketingResource {
  id: string
  title: string
  description: string
  category: string
  type: 'template' | 'guide' | 'video' | 'image' | 'document'
  fileUrl?: string
  icon: React.ReactNode
}

export default function MarketingResourcesPage() {
  const { user, loading, signOut } = useAuth()
  const router = useRouter()
  const [selectedCategory, setSelectedCategory] = useState('all')

  // Marketing resources - these can be configured by admins
  const resources: MarketingResource[] = [
    {
      id: '1',
      title: 'Property Listing Post Template',
      description: 'Professional template for creating engaging property listings on social media',
      category: 'templates',
      type: 'template',
      fileUrl: '/resources/listing-post-template.docx',
      icon: <PenTool className="w-6 h-6" />,
    },
    {
      id: '2',
      title: 'Email Campaign Framework',
      description: 'Proven email templates for lead nurturing and client communication',
      category: 'templates',
      type: 'template',
      fileUrl: '/resources/email-campaign-framework.docx',
      icon: <FileText className="w-6 h-6" />,
    },
    {
      id: '3',
      title: 'HartFelt Brand Guidelines',
      description: 'Complete brand guidelines including colors, fonts, and imagery standards',
      category: 'guides',
      type: 'document',
      fileUrl: '/resources/brand-guidelines.pdf',
      icon: <BarChart3 className="w-6 h-6" />,
    },
    {
      id: '4',
      title: 'Social Media Content Calendar',
      description: 'Monthly content calendar template for planning your social media posts',
      category: 'templates',
      type: 'template',
      fileUrl: '/resources/content-calendar.xlsx',
      icon: <Share2 className="w-6 h-6" />,
    },
    {
      id: '5',
      title: 'Video Production Guide',
      description: 'Step-by-step guide for creating property videos and virtual tours',
      category: 'guides',
      type: 'guide',
      fileUrl: '/resources/video-production-guide.pdf',
      icon: <Video className="w-6 h-6" />,
    },
    {
      id: '6',
      title: 'Property Photography Tips',
      description: 'Professional photography techniques for capturing properties in their best light',
      category: 'guides',
      type: 'guide',
      fileUrl: '/resources/photography-tips.pdf',
      icon: <Image className="w-6 h-6" />,
    },
  ]

  const categories = [
    { id: 'all', label: 'All Resources' },
    { id: 'templates', label: 'Templates' },
    { id: 'guides', label: 'Guides' },
  ]

  const filteredResources = selectedCategory === 'all'
    ? resources
    : resources.filter(r => r.category === selectedCategory)

  const handleSignOut = async () => {
    await signOut()
    router.push('/login')
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  }

  if (!user) {
    router.push('/login')
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
            <h1 className="text-2xl font-bold text-gray-900">Marketing Resources</h1>
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
        <div className="mb-8">
          <p className="text-gray-600 text-lg">
            Access professionally designed templates, guides, and resources to enhance your marketing efforts and grow your real estate business.
          </p>
        </div>

        {/* Category Filter */}
        <div className="flex gap-3 mb-12">
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                selectedCategory === cat.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Resources Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredResources.map(resource => (
            <div
              key={resource.id}
              className="bg-white rounded-lg shadow hover:shadow-lg transition overflow-hidden"
            >
              <div className="h-40 bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white">
                {resource.icon}
              </div>
              <div className="p-6">
                <h3 className="font-bold text-gray-900 mb-2">{resource.title}</h3>
                <p className="text-gray-600 text-sm mb-4">{resource.description}</p>

                <div className="mb-4">
                  <span className="text-xs font-semibold px-2 py-1 rounded-full bg-blue-100 text-blue-800">
                    {resource.type === 'template' ? 'Template' : resource.type === 'guide' ? 'Guide' : 'Document'}
                  </span>
                </div>

                <a
                  href={resource.fileUrl}
                  download
                  className="w-full inline-flex items-center justify-center gap-2 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition font-medium text-sm"
                >
                  <Download className="w-4 h-4" />
                  Download
                </a>
              </div>
            </div>
          ))}
        </div>

        {/* Empty State */}
        {filteredResources.length === 0 && (
          <div className="text-center py-12">
            <Zap className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 text-lg">No resources in this category yet</p>
          </div>
        )}

        {/* Upload Section for Admins */}
        {/* This can be enabled for admin users to upload new resources */}
        <div className="mt-16 bg-white rounded-lg shadow p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Need Custom Resources?</h2>
          <p className="text-gray-600 mb-4">
            Contact your administrator to request custom marketing templates or resources tailored to your needs.
          </p>
          <button
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition font-medium"
          >
            Request New Resource
          </button>
        </div>
      </main>
    </div>
  )
}
