'use client'

import { useRouter } from 'next/navigation'
import { useAuth } from '../providers'
import Link from 'next/link'
import { ArrowLeft, Plus, Calendar as CalendarIcon, Clock, MapPin, AlertCircle, Trash2, Edit, X, ChevronLeft, ChevronRight } from 'lucide-react'
import { useState, useEffect } from 'react'
import { vaultAPI } from '@/lib/vault-client'
import ComplianceNotifications from '../components/compliance-notifications'

interface Event {
  id: string
  title: string
  type: 'showing' | 'appointment' | 'reminder' | 'other'
  date: string
  time: string
  duration: number
  location?: string
  notes?: string
  propertyAddress?: string
  clientName?: string
  agentId: string
  createdAt: string
}

const EVENT_TYPES = [
  { id: 'showing', label: 'Property Showing', color: 'bg-blue-100', textColor: 'text-blue-800', borderColor: 'border-blue-300' },
  { id: 'appointment', label: 'Appointment', color: 'bg-green-100', textColor: 'text-green-800', borderColor: 'border-green-300' },
  { id: 'reminder', label: 'Reminder', color: 'bg-yellow-100', textColor: 'text-yellow-800', borderColor: 'border-yellow-300' },
  { id: 'other', label: 'Other', color: 'bg-gray-100', textColor: 'text-gray-800', borderColor: 'border-gray-300' },
]

export default function CalendarPage() {
  const { user, role, loading, signOut } = useAuth()
  const router = useRouter()
  const [events, setEvents] = useState<Event[]>([])
  const [eventsLoading, setEventsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [showAddForm, setShowAddForm] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null)
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'day'>('month')
  const [newEvent, setNewEvent] = useState({
    title: '',
    type: 'showing' as const,
    date: new Date().toISOString().split('T')[0],
    time: '10:00',
    duration: 60,
    location: '',
    notes: '',
    propertyAddress: '',
    clientName: '',
  })

  useEffect(() => {
    if (user) {
      loadEvents()
    }
  }, [user])

  const loadEvents = async () => {
    if (!user) return

    try {
      setEventsLoading(true)
      setError(null)

      // Placeholder: In production, Vault API would have /api/calendar or /api/events endpoint
      // For now, initialize with empty array
      setEvents([])
    } catch (err) {
      console.error('Error loading events:', err)
      setError(`Failed to load events: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setEventsLoading(false)
    }
  }

  const handleAddEvent = () => {
    if (!newEvent.title || !newEvent.date || !newEvent.time) {
      alert('Please fill in required fields')
      return
    }

    const event: Event = {
      id: `e${Date.now()}`,
      ...newEvent,
      agentId: user!.id,
      createdAt: new Date().toISOString(),
    }

    setEvents([...events, event])
    setNewEvent({
      title: '',
      type: 'showing',
      date: new Date().toISOString().split('T')[0],
      time: '10:00',
      duration: 60,
      location: '',
      notes: '',
      propertyAddress: '',
      clientName: '',
    })
    setShowAddForm(false)
  }

  const handleDeleteEvent = (eventId: string) => {
    if (confirm('Delete this event?')) {
      setEvents(events.filter((e) => e.id !== eventId))
    }
  }

  const handleSignOut = async () => {
    await signOut()
    router.push('/login')
  }

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  }

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay()
  }

  const getDaysArray = () => {
    const daysInMonth = getDaysInMonth(currentDate)
    const firstDay = getFirstDayOfMonth(currentDate)
    const days = []

    // Empty cells for days before month starts
    for (let i = 0; i < firstDay; i++) {
      days.push(null)
    }

    // Days of the month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i)
    }

    return days
  }

  const getEventsForDate = (day: number | null) => {
    if (!day) return []
    const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return events.filter((e) => e.date === dateStr)
  }

  const monthDays = getDaysArray()
  const monthName = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

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
            <h1 className="text-2xl font-bold text-gray-900">Calendar</h1>
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
        {/* Error Banner */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        {/* Add Event Button */}
        <div className="mb-8 flex gap-4 items-center">
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            {showAddForm ? 'Cancel' : 'Add Event'}
          </button>

          <div className="flex gap-2 ml-auto">
            <button
              onClick={() => setViewMode('month')}
              className={`px-4 py-2 rounded-lg transition ${
                viewMode === 'month'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              Month
            </button>
            <button
              onClick={() => setViewMode('week')}
              className={`px-4 py-2 rounded-lg transition ${
                viewMode === 'week'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              Week
            </button>
            <button
              onClick={() => setViewMode('day')}
              className={`px-4 py-2 rounded-lg transition ${
                viewMode === 'day'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              Day
            </button>
          </div>
        </div>

        {/* Add Event Form */}
        {showAddForm && (
          <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Add New Event</h2>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Event Title *</label>
                <input
                  type="text"
                  value={newEvent.title}
                  onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                  placeholder="e.g., Property Showing"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Event Type *</label>
                <select
                  value={newEvent.type}
                  onChange={(e) => setNewEvent({ ...newEvent, type: e.target.value as any })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  {EVENT_TYPES.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Date *</label>
                <input
                  type="date"
                  value={newEvent.date}
                  onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Time *</label>
                <input
                  type="time"
                  value={newEvent.time}
                  onChange={(e) => setNewEvent({ ...newEvent, time: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Duration (minutes)</label>
                <input
                  type="number"
                  value={newEvent.duration}
                  onChange={(e) => setNewEvent({ ...newEvent, duration: parseInt(e.target.value) })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
                <input
                  type="text"
                  value={newEvent.location}
                  onChange={(e) => setNewEvent({ ...newEvent, location: e.target.value })}
                  placeholder="e.g., 123 Main St, Miami, FL"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Property Address</label>
                <input
                  type="text"
                  value={newEvent.propertyAddress}
                  onChange={(e) => setNewEvent({ ...newEvent, propertyAddress: e.target.value })}
                  placeholder="Property address"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Client Name</label>
                <input
                  type="text"
                  value={newEvent.clientName}
                  onChange={(e) => setNewEvent({ ...newEvent, clientName: e.target.value })}
                  placeholder="Client name"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
                <textarea
                  value={newEvent.notes}
                  onChange={(e) => setNewEvent({ ...newEvent, notes: e.target.value })}
                  placeholder="Additional notes"
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <button
                onClick={handleAddEvent}
                className="col-span-2 w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition font-medium"
              >
                Save Event
              </button>
            </div>
          </div>
        )}

        {/* Calendar View - Month */}
        {viewMode === 'month' && (
          <div className="bg-white rounded-lg shadow">
            {/* Calendar Header */}
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-2xl font-bold text-gray-900">{monthName}</h2>
              <div className="flex gap-4">
                <button
                  onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))}
                  className="p-2 hover:bg-gray-100 rounded-lg transition"
                >
                  <ChevronLeft className="w-5 h-5 text-gray-700" />
                </button>
                <button
                  onClick={() => setCurrentDate(new Date())}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition text-sm font-medium"
                >
                  Today
                </button>
                <button
                  onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))}
                  className="p-2 hover:bg-gray-100 rounded-lg transition"
                >
                  <ChevronRight className="w-5 h-5 text-gray-700" />
                </button>
              </div>
            </div>

            {/* Day Headers */}
            <div className="grid grid-cols-7 gap-px bg-gray-200">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <div key={day} className="bg-gray-100 p-3 text-center font-semibold text-gray-700 text-sm">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Days */}
            <div className="grid grid-cols-7 gap-px bg-gray-200">
              {monthDays.map((day, index) => (
                <div
                  key={index}
                  className={`min-h-32 p-3 ${day ? 'bg-white' : 'bg-gray-50'}`}
                >
                  {day && (
                    <>
                      <p className="font-semibold text-gray-900 mb-2">{day}</p>
                      <div className="space-y-1">
                        {getEventsForDate(day).map((event) => {
                          const type = EVENT_TYPES.find((t) => t.id === event.type)
                          return (
                            <div
                              key={event.id}
                              className={`${type?.color} ${type?.textColor} rounded px-2 py-1 text-xs font-medium truncate cursor-pointer hover:shadow-md transition`}
                              onClick={() => setSelectedEvent(event)}
                            >
                              {event.title}
                            </div>
                          )
                        })}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Week View */}
        {viewMode === 'week' && (
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-600">Week view coming soon</p>
          </div>
        )}

        {/* Day View */}
        {viewMode === 'day' && (
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-600">Day view coming soon</p>
          </div>
        )}

        {/* Events List */}
        {events.length > 0 && (
          <div className="mt-8 bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Upcoming Events</h2>
            </div>
            <div className="divide-y">
              {events.map((event) => {
                const type = EVENT_TYPES.find((t) => t.id === event.type)
                return (
                  <div key={event.id} className={`p-6 ${type?.color}`}>
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className={`font-bold ${type?.textColor} mb-1`}>{event.title}</h3>
                        <div className="flex gap-4 text-sm">
                          <div className="flex items-center gap-1">
                            <CalendarIcon className={`w-4 h-4 ${type?.textColor}`} />
                            {event.date}
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className={`w-4 h-4 ${type?.textColor}`} />
                            {event.time}
                          </div>
                          {event.location && (
                            <div className="flex items-center gap-1">
                              <MapPin className={`w-4 h-4 ${type?.textColor}`} />
                              {event.location}
                            </div>
                          )}
                        </div>
                        {event.notes && <p className="text-sm mt-2">{event.notes}</p>}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleDeleteEvent(event.id)}
                          className="p-2 hover:bg-red-100 rounded-lg transition"
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Info Box */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mt-8">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-blue-900 mb-1">Calendar Management</p>
              <p className="text-sm text-blue-800">
                Manage your showings, appointments, and reminders in one place. Events are stored locally in this session. For production, Vault API integration is required.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
