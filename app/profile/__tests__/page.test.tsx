// Regression: the profile page must NEVER hang indefinitely on the loading
// spinner if the direct Supabase `profiles` query stalls on the shared auth lock.
// A bounded timeout resolves `loading` so the page renders (the birthday +
// marketing-card sections use lock-free API paths and load regardless).
import React from 'react'
import { render, screen, act } from '@testing-library/react'
import '@testing-library/jest-dom'

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn(), back: jest.fn() }) }))
// Stable user reference (created once) so the `[user]`-dep effect fires fetchProfile
// exactly once — otherwise a new object each render loops the effect.
jest.mock('../../providers', () => {
  const u = { id: 'u1', email: 'a@b.co' }
  return { useAuth: () => ({ user: u, loading: false }) }
})

// The direct profiles query NEVER resolves — simulating the auth-lock stall.
const neverResolves = () => new Promise(() => {})
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({ single: () => neverResolves() }) }),
      update: () => ({ eq: async () => ({ error: null }) }),
    }),
  },
}))
jest.mock('@/src/portal/profile/ProfileBirthdaySection', () => ({ __esModule: true, default: function B() { return <div>birthday-section</div> } }))
jest.mock('@/src/portal/marketing-profile/MarketingProfileSection', () => ({ __esModule: true, default: function M() { return <div>marketing-section</div> } }))

import ProfilePage from '../page'

describe('ProfilePage — never hangs on the loading spinner (regression)', () => {
  it('renders content within the timeout even when the profiles query hangs', async () => {
    jest.useFakeTimers()
    render(<ProfilePage />)

    // Content is gated behind loading — real content-branch text not shown yet.
    expect(screen.queryByText('Save Profile')).not.toBeInTheDocument()

    // Advance past the 6s fetch timeout → the query loses the race, loading resolves.
    // advanceTimersByTimeAsync flushes the promise microtasks (rejection → catch →
    // setLoading(false)) between timer ticks, so React re-renders with content.
    await act(async () => {
      await jest.advanceTimersByTimeAsync(6100)
    })

    // Page rendered (no infinite spinner): real content-branch UI + both sections.
    expect(screen.getByText('Save Profile')).toBeInTheDocument()
    expect(screen.getByText('marketing-section')).toBeInTheDocument()
    expect(screen.getByText('birthday-section')).toBeInTheDocument()

    jest.useRealTimers()
  })
})
