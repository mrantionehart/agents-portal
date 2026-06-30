'use client'

import { useRouter } from 'next/navigation'
import { useAuth } from '../providers'
import Link from 'next/link'
import { ArrowLeft, Plus, Calendar as CalendarIcon, Clock, MapPin, AlertCircle, Trash2, X, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { useState, useEffect, useCallback } from 'react'
import ComplianceNotifications from '../components/compliance-notifications'
import { authFetch } from '@/lib/supabase'

interface CalendarEvent {
  id: string
  agent_id: string
  title: string
  type: 'showing' | 'appointment' | 'reminder' | 'other'
  event_date: string
  event_time: string
  duration_min: number
  location?: string
  notes?: string
  property_address?: string
  client_name?: string
  transaction_id?: string
  created_at: string
}

const EVENT_TYPES = [
  { id: 'showing', label: 'Property Showing', color: 'bg-blue-500/15', textColor: 'text-blue-400', borderColor: 'border-blue-300' },
  { id: 'appointment', label: 'Appointment', color: 'bg-green-500/15', textColor: 'text-green-400', borderColor: 'border-green-300' },
  { id: 'reminder', label: 'Reminder', color: 'bg-yellow-500/15', textColor: 'text-yellow-400', borderColor: 'border-yellow-300' },
  { id: 'other', label: 'Other', color: 'bg-[#0a0a0f]', textColor: 'text-white', borderColor: 'border-[#1a1a2e]' },
]

export default function CalendarPage() {
  const { user, role, loading, signOut } = useAuth()
  const router = useRouter()
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [eventsLoading, setEventsLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [showAddForm, setShowAddForm] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'day'>('month')
  const [newEvent, setNewEvent] = useState({
    title: '',
    type: 'showing' as const,
    event_date: new Date().toISOString().split('T')[0],
    event_time: '10:00',
    duration_min: 60,
    location: '',
    notes: '',
    property_address: '',
    client_name: '',
  })

  const currentMonth = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`

  const loadEvents = useCallback(async () => {
    if (!user) return
    try {
      setEventsLoading(true)
      setError(null)
      const res = await authFetch(`/api/calendar/events?month=${currentMonth}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load events')
      setEvents(data.events || [])
    } catch (err) {
      console.error('Error loading events:', err)
      setError(err instanceof Error ? err.message : 'Failed to load events')
    } finally {
      setEventsLoading(false)
    }
  }, [user, currentMonth])

  useEffect(() => {
    if (user) loadEvents()
  }, [user, loadEvents])

  const handleAddEvent = async () => {
    if (!newEvent.title || !newEvent.event_date || !newEvent.event_time) {
      alert('Please fill in required fields')
      return
    }

    try {
      setSaving(true)
      const res = await authFetch('/api/calendar/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newEvent),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create event')

      // Add the new event to state and reset form
      setEvents(prev => [...prev, data.event].sort((a, b) =>
        `${a.event_date}${a.event_time}`.localeCompare(`${b.event_date}${b.event_time}`)
      ))
      setNewEvent({
        title: '',
        type: 'showing',
        event_date: new Date().toISOString().split('T')[0],
        event_time: '10:00',
        duration_min: 60,
        location: '',
        notes: '',
        property_address: '',
        client_name: '',
      })
      setShowAddForm(false)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save event')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteEvent = async (eventId: string) => {
    if (!confirm('Delete this event?')) return
    try {
      const res = await authFetch(`/api/calendar/events?id=${eventId}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to delete')
      }
      setEvents(prev => prev.filter(e => e.id !== eventId))
      if (selectedEvent?.id === eventId) setSelectedEvent(null)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete event')
    }
  }

  const handleSignOut = async () => {
    await signOut()
    router.push('/login')
  }

  const getDaysInMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  const getFirstDayOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay()

  const getDaysArray = () => {
    const daysInMonth = getDaysInMonth(currentDate)
    const firstDay = getFirstDayOfMonth(currentDate)
    const days: (number | null)[] = []
    for (let i = 0; i < firstDay; i++) days.push(null)
    for (let i = 1; i <= daysInMonth; i++) days.push(i)
    return days
  }

  const getEventsForDate = (day: number | null) => {
    if (!day) return []
    const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return events.filter(e => e.event_date === dateStr)
  }

  const formatTime = (time: string) => {
    const [h, m] = time.split(':').map(Number)
    const ampm = h >= 12 ? 'PM' : 'AM'
    const hour = h % 12 || 12
    return `${hour}:${String(m).padStart(2, '0')} ${ampm}`
  }

  const monthDays = getDaysArray()
  const monthName = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const today = new Date()
  const isToday = (day: number | null) =>
    day !== null &&
    currentDate.getFullYear() === today.getFullYear() &&
    currentDate.getMonth() === today.getMonth() &&
    day === today.getDate()

  // Upcoming events (sorted, future only)
  const todayStr = today.toISOString().split('T')[0]
  const upcomingEvents = events
    .filter(e => e.event_date >= todayStr)
    .sort((a, b) => `${a.event_date}${a.event_time}`.localeCompare(`${b.event_date}${b.event_time}`))

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  }
  if (!user) return null

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <header className="bg-[#0a0a0f] border-b border-[#1a1a2e]">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-blue-600 hover:text-blue-400 font-medium flex items-center gap-2">
              <ArrowLeft className="w-5 h-5" />
              Dashboard
            </Link>
            <h1 className="text-2xl font-bold text-white">Calendar</h1>
          </div>
          <div className="flex items-center gap-4">
            <ComplianceNotifications userId={user?.id} role={role} />
            <button onClick={handleSignOut} className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition">
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Error Banner */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-6 flex justify-between items-center">
            <p className="text-red-800 text-sm">{error}</p>
            <button onClick={loadEvents} className="text-red-600 text-sm font-medium hover:underline">Retry</button>
          </div>
        )}

        {/* Controls */}
        <div className="mb-8 flex gap-4 items-center">
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            {showAddForm ? 'Cancel' : 'Add Event'}
          </button>

          <div className="flex gap-2 ml-auto">
            {(['month', 'week', 'day'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-4 py-2 rounded-lg transition capitalize ${
                  viewMode === mode
                    ? 'bg-blue-600 text-white'
                    : 'bg-[#0a0a0f] text-gray-200 border border-[#1a1a2e] hover:bg-[#0a0a0f]'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>

        {/* Add Event Form */}
        {showAddForm && (
          <div className="bg-[#0a0a0f] rounded-lg shadow-lg shadow-black/20 p-8 mb-8">
            <h2 className="text-2xl font-bold text-white mb-6">Add New Event</h2>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-200 mb-2">Event Title *</label>
                <input
                  type="text"
                  value={newEvent.title}
                  onChange={e => setNewEvent({ ...newEvent, title: e.target.value })}
                  placeholder="e.g., Property Showing"
                  className="w-full px-4 py-2 border border-[#1a1a2e] rounded-lg focus:ring-2 focus:ring-[#C9A84C]/30"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-200 mb-2">Event Type *</label>
                <select
                  value={newEvent.type}
                  onChange={e => setNewEvent({ ...newEvent, type: e.target.value as any })}
                  className="w-full px-4 py-2 border border-[#1a1a2e] rounded-lg focus:ring-2 focus:ring-[#C9A84C]/30"
                >
                  {EVENT_TYPES.map(type => (
                    <option key={type.id} value={type.id}>{type.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-200 mb-2">Date *</label>
                <input
                  type="date"
                  value={newEvent.event_date}
                  onChange={e => setNewEvent({ ...newEvent, event_date: e.target.value })}
                  className="w-full px-4 py-2 border border-[#1a1a2e] rounded-lg focus:ring-2 focus:ring-[#C9A84C]/30"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-200 mb-2">Time *</label>
                <input
                  type="time"
                  value={newEvent.event_time}
                  onChange={e => setNewEvent({ ...newEvent, event_time: e.target.value })}
                  className="w-full px-4 py-2 border border-[#1a1a2e] rounded-lg focus:ring-2 focus:ring-[#C9A84C]/30"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-200 mb-2">Duration (minutes)</label>
                <input
                  type="number"
                  value={newEvent.duration_min}
                  onChange={e => setNewEvent({ ...newEvent, duration_min: parseInt(e.target.value) || 60 })}
                  className="w-full px-4 py-2 border border-[#1a1a2e] rounded-lg focus:ring-2 focus:ring-[#C9A84C]/30"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-200 mb-2">Location</label>
                <input
                  type="text"
                  value={newEvent.location}
                  onChange={e => setNewEvent({ ...newEvent, location: e.target.value })}
                  placeholder="e.g., 123 Main St, Miami, FL"
                  className="w-full px-4 py-2 border border-[#1a1a2e] rounded-lg focus:ring-2 focus:ring-[#C9A84C]/30"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-200 mb-2">Property Address</label>
                <input
                  type="text"
                  value={newEvent.property_address}
                  onChange={e => setNewEvent({ ...newEvent, property_address: e.target.value })}
                  placeholder="Property address"
                  className="w-full px-4 py-2 border border-[#1a1a2e] rounded-lg focus:ring-2 focus:ring-[#C9A84C]/30"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-200 mb-2">Client Name</label>
                <input
                  type="text"
                  value={newEvent.client_name}
                  onChange={e => setNewEvent({ ...newEvent, client_name: e.target.value })}
                  placeholder="Client name"
                  className="w-full px-4 py-2 border border-[#1a1a2e] rounded-lg focus:ring-2 focus:ring-[#C9A84C]/30"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-200 mb-2">Notes</label>
                <textarea
                  value={newEvent.notes}
                  onChange={e => setNewEvent({ ...newEvent, notes: e.target.value })}
                  placeholder="Additional notes"
                  rows={4}
                  className="w-full px-4 py-2 border border-[#1a1a2e] rounded-lg focus:ring-2 focus:ring-[#C9A84C]/30"
                />
              </div>
              <button
                onClick={handleAddEvent}
                disabled={saving}
                className="col-span-2 w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition font-medium disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {saving ? 'Saving...' : 'Save Event'}
              </button>
            </div>
          </div>
        )}

        {/* Calendar View - Month */}
        {viewMode === 'month' && (
          <div className="bg-[#0a0a0f] rounded-lg shadow">
            <div className="p-6 border-b border-[#1a1a2e] flex justify-between items-center">
              <h2 className="text-2xl font-bold text-white">{monthName}</h2>
              <div className="flex gap-4 items-center">
                {eventsLoading && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
                <button
                  onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))}
                  className="p-2 hover:bg-[#111] rounded-lg transition"
                >
                  <ChevronLeft className="w-5 h-5 text-gray-200" />
                </button>
                <button
                  onClick={() => setCurrentDate(new Date())}
                  className="px-4 py-2 text-gray-200 hover:bg-[#111] rounded-lg transition text-sm font-medium"
                >
                  Today
                </button>
                <button
                  onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))}
                  className="p-2 hover:bg-[#111] rounded-lg transition"
                >
                  <ChevronRight className="w-5 h-5 text-gray-200" />
                </button>
              </div>
            </div>

            {/* Day Headers */}
            <div className="grid grid-cols-7 gap-px bg-[#1a1a2e]">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="bg-[#0a0a0f] p-3 text-center font-semibold text-gray-200 text-sm">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Days */}
            <div className="grid grid-cols-7 gap-px bg-[#1a1a2e]">
              {monthDays.map((day, index) => (
                <div
                  key={index}
                  className={`min-h-32 p-3 ${day ? 'bg-[#0a0a0f]' : 'bg-[#050507]'} ${isToday(day) ? 'ring-2 ring-inset ring-blue-400' : ''}`}
                >
                  {day && (
                    <>
                      <p className={`font-semibold mb-2 ${isToday(day) ? 'text-blue-600' : 'text-white'}`}>{day}</p>
                      <div className="space-y-1">
                        {getEventsForDate(day).map(event => {
                          const type = EVENT_TYPES.find(t => t.id === event.type)
                          return (
                            <div
                              key={event.id}
                              className={`${type?.color} ${type?.textColor} rounded px-2 py-1 text-xs font-medium truncate cursor-pointer hover:shadow-md shadow-black/20 transition`}
                              onClick={() => setSelectedEvent(event)}
                              title={`${formatTime(event.event_time)} — ${event.title}`}
                            >
                              {formatTime(event.event_time)} {event.title}
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

        {/* Week View Placeholder */}
        {viewMode === 'week' && (
          <div className="bg-[#0a0a0f] rounded-lg shadow p-6">
            <p className="text-gray-400">Week view coming soon</p>
          </div>
        )}

        {/* Day View Placeholder */}
        {viewMode === 'day' && (
          <div className="bg-[#0a0a0f] rounded-lg shadow p-6">
            <p className="text-gray-400">Day view coming soon</p>
          </div>
        )}

        {/* Event Detail Modal */}
        {selectedEvent && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedEvent(null)}>
            <div className="bg-[#0a0a0f] rounded-xl shadow-2xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-start mb-4">
                <div>
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${EVENT_TYPES.find(t => t.id === selectedEvent.type)?.color} ${EVENT_TYPES.find(t => t.id === selectedEvent.type)?.textColor} mb-2`}>
                    {EVENT_TYPES.find(t => t.id === selectedEvent.type)?.label}
                  </span>
                  <h3 className="text-xl font-bold text-white">{selectedEvent.title}</h3>
                </div>
                <button onClick={() => setSelectedEvent(null)} className="p-1 hover:bg-[#111] rounded">
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-2 text-gray-200">
                  <CalendarIcon className="w-4 h-4" />
                  <span>{selectedEvent.event_date}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-200">
                  <Clock className="w-4 h-4" />
                  <span>{formatTime(selectedEvent.event_time)} ({selectedEvent.duration_min} min)</span>
                </div>
                {selectedEvent.location && (
                  <div className="flex items-center gap-2 text-gray-200">
                    <MapPin className="w-4 h-4" />
                    <span>{selectedEvent.location}</span>
                  </div>
                )}
                {selectedEvent.property_address && (
                  <p className="text-gray-400"><span className="font-medium">Property:</span> {selectedEvent.property_address}</p>
                )}
                {selectedEvent.client_name && (
                  <p className="text-gray-400"><span className="font-medium">Client:</span> {selectedEvent.client_name}</p>
                )}
                {selectedEvent.notes && (
                  <p className="text-gray-400 mt-2 border-t pt-2">{selectedEvent.notes}</p>
                )}
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => { handleDeleteEvent(selectedEvent.id); setSelectedEvent(null) }}
                  className="flex-1 bg-red-500/10 text-red-400 py-2 rounded-lg hover:bg-red-500/15 transition text-sm font-medium flex items-center justify-center gap-1"
                >
                  <Trash2 className="w-4 h-4" /> Delete
                </button>
                <button
                  onClick={() => setSelectedEvent(null)}
                  className="flex-1 bg-[#0a0a0f] text-gray-200 py-2 rounded-lg hover:bg-[#1a1a2e] transition text-sm font-medium"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Upcoming Events List */}
        {upcomingEvents.length > 0 && (
          <div className="mt-8 bg-[#0a0a0f] rounded-lg shadow">
            <div className="p-6 border-b border-[#1a1a2e]">
              <h2 className="text-xl font-bold text-white">Upcoming Events</h2>
            </div>
            <div className="divide-y">
              {upcomingEvents.slice(0, 10).map(event => {
                const type = EVENT_TYPES.find(t => t.id === event.type)
                return (
                  <div key={event.id} className="p-4 hover:bg-[#0a0a0f] transition cursor-pointer" onClick={() => setSelectedEvent(event)}>
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${type?.color} ${type?.textColor}`}>
                            {type?.label}
                          </span>
                          <h3 className="font-semibold text-white">{event.title}</h3>
                        </div>
                        <div className="flex gap-4 text-sm text-gray-400">
                          <span className="flex items-center gap-1">
                            <CalendarIcon className="w-3.5 h-3.5" /> {event.event_date}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" /> {formatTime(event.event_time)}
                          </span>
                          {event.location && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5" /> {event.location}
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={e => { e.stopPropagation(); handleDeleteEvent(event.id) }}
                        className="p-2 hover:bg-red-500/15 rounded-lg transition"
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!eventsLoading && events.length === 0 && !error && (
          <div className="mt-8 bg-[#0a0a0f] rounded-lg shadow p-12 text-center">
            <CalendarIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">No events this month</h3>
            <p className="text-gray-400 mb-4">Add a showing, appointment, or reminder to get started.</p>
            <button
              onClick={() => setShowAddForm(true)}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition"
            >
              Add Your First Event
            </button>
          </div>
        )}
      </main>
    </div>
  )
}
