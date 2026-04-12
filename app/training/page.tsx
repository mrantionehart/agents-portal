'use client'

import { useRouter } from 'next/navigation'
import { useAuth } from '../providers'
import Link from 'next/link'
import { BookOpen, Play, Clock, FileText } from 'lucide-react'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

export default function TrainingPage() {
  const { user, loading, signOut } = useAuth()
  const router = useRouter()
  const [courses, setCourses] = useState<any[]>([])
  const [coursesLoading, setCoursesLoading] = useState(true)

  // Fallback courses if database has no training data
  const defaultCourses = [
    { title: 'Getting Started as a Real Estate Agent', duration: '2h 30m', level: 'Beginner', modules: 5 },
    { title: 'Mastering Buyer Consultations', duration: '1h 45m', level: 'Intermediate', modules: 4 },
    { title: 'Advanced Listing Strategies', duration: '2h', level: 'Advanced', modules: 6 },
    { title: 'Negotiation Tactics That Close Deals', duration: '1h 30m', level: 'Intermediate', modules: 4 },
    { title: 'Digital Marketing for Real Estate', duration: '2h', level: 'Intermediate', modules: 5 },
    { title: 'Transaction Management & Compliance', duration: '1h 15m', level: 'Beginner', modules: 3 },
  ]

  useEffect(() => {
    if (user) {
      loadTrainingCourses()
    }
  }, [user])

  const loadTrainingCourses = async () => {
    try {
      setCoursesLoading(true)

      // Initialize Supabase client for training data
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

      if (!supabaseUrl || !supabaseKey) {
        setCourses(defaultCourses)
        return
      }

      const supabase = createClient(supabaseUrl, supabaseKey)

      // Fetch training categories and their items from EASE database
      const { data: categories, error } = await supabase
        .from('training_categories')
        .select('id, title, description, sort_order, training_items(id, title, duration, level)')
        .order('sort_order')

      if (error || !categories) {
        setCourses(defaultCourses)
      } else {
        // Transform categories into course format
        const transformedCourses = categories.map(cat => ({
          id: cat.id,
          title: cat.title,
          description: cat.description,
          level: cat.training_items?.[0]?.level || 'Intermediate',
          duration: `${(cat.training_items?.length || 0) * 25}m`, // Estimate: 25 min per module
          modules: cat.training_items?.length || 0,
        }))
        setCourses(transformedCourses.length > 0 ? transformedCourses : defaultCourses)
      }
    } catch (err) {
      console.error('Failed to load training courses:', err)
      setCourses(defaultCourses)
    } finally {
      setCoursesLoading(false)
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
            <h1 className="text-2xl font-bold text-gray-900">Training Modules</h1>
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
            Access our full library of agent training courses, scripts, and proven systems built to help you close more deals, serve clients at the highest level, and grow your real estate business.
          </p>
        </div>

        {/* Brokerage Policy Manual */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Brokerage Resources</h2>
          <div className="bg-white rounded-lg shadow p-8">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="w-6 h-6 text-blue-600" />
                  <h3 className="text-xl font-bold text-gray-900">Brokerage Policy Manual</h3>
                </div>
                <p className="text-gray-600 mb-6">
                  Essential reference guide containing all HartFelt policies, procedures, commission structures, compliance requirements, and best practices. Review before your first transaction and reference whenever you have questions about company procedures.
                </p>
                <a
                  href="/training/brokerage-policy-manual.pdf"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition font-medium"
                >
                  <FileText className="w-5 h-5" />
                  Download Manual (PDF)
                </a>
              </div>
              <FileText className="w-16 h-16 text-blue-300 flex-shrink-0" />
            </div>
          </div>
        </section>

        {/* HartFelt Ready Training Volumes */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">HartFelt Ready Training</h2>
          <div className="grid grid-cols-3 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition">
              <div className="h-32 bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center rounded-lg mb-4">
                <BookOpen className="w-12 h-12 text-white" />
              </div>
              <h3 className="font-bold text-gray-900 mb-2">Volume 1</h3>
              <p className="text-gray-600 text-sm mb-4">Foundations and essential skills for real estate excellence</p>
              <a
                href="/training/volume-1.pdf"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition font-medium text-sm inline-block text-center"
              >
                Download PDF
              </a>
            </div>
            <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition">
              <div className="h-32 bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center rounded-lg mb-4">
                <BookOpen className="w-12 h-12 text-white" />
              </div>
              <h3 className="font-bold text-gray-900 mb-2">Volume 2</h3>
              <p className="text-gray-600 text-sm mb-4">Advanced strategies and client management techniques</p>
              <a
                href="/training/volume-2.pdf"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition font-medium text-sm inline-block text-center"
              >
                Download PDF
              </a>
            </div>
            <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition">
              <div className="h-32 bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center rounded-lg mb-4">
                <BookOpen className="w-12 h-12 text-white" />
              </div>
              <h3 className="font-bold text-gray-900 mb-2">Volume 3</h3>
              <p className="text-gray-600 text-sm mb-4">Growth strategies and business development</p>
              <a
                href="/training/volume-3.pdf"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition font-medium text-sm inline-block text-center"
              >
                Download PDF
              </a>
            </div>
          </div>
        </section>

        {/* Video Training Courses */}
        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Video Training Courses</h2>
        </section>

        {coursesLoading ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-gray-600">Loading training courses...</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-6">
            {courses.map((course, idx) => (
            <div key={idx} className="bg-white rounded-lg shadow overflow-hidden hover:shadow-lg transition">
              <div className="h-32 bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                <Play className="w-12 h-12 text-white" />
              </div>
              <div className="p-6">
                <h3 className="font-bold text-gray-900 mb-3 line-clamp-2">{course.title}</h3>
                <div className="space-y-2 mb-4 text-sm text-gray-600">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    <span>{course.duration}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4" />
                    <span>{course.modules} modules</span>
                  </div>
                </div>
                <div className="mb-4">
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                    course.level === 'Beginner' ? 'bg-green-100 text-green-800' :
                    course.level === 'Intermediate' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {course.level}
                  </span>
                </div>
                <button className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition font-medium text-sm">
                  Start Course
                </button>
              </div>
            </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
