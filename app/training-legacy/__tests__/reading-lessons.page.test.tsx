/**
 * @jest-environment jsdom
 */
// D6 — the agent journey on the real training page (Agent Portal entry point
// /training-legacy): Module 14 shows six reading lessons in order, a lesson
// opens in the reading view, "I have read this lesson" writes the agent's OWN
// training_video_progress row, the quiz stays locked until all six are read,
// and the existing video module keeps its player and "Mark as complete".
import React from 'react'
import { render, screen, fireEvent, waitFor, within, configure } from '@testing-library/react'
import '@testing-library/jest-dom'

const AGENT = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn(), back: jest.fn() }) }))
// A STABLE auth object: the page reloads its catalog whenever `user` changes identity.
jest.mock('../../providers', () => {
  const auth = {
    user: { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', email: 'a@x.co' },
    loading: false, signOut: () => undefined, role: 'agent',
    trainingGate: { gateOpen: true, vol1: { completed: [], total: 9 } },
  }
  return { useAuth: () => auth }
})
const upserts: any[] = []
let upsertError: any = null
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: (table: string) => ({
      upsert: async (row: any, opts: any) => { upserts.push({ table, row, opts }); return { error: upsertError } },
    }),
  },
}))
jest.mock('@/lib/vault-client', () => ({ VAULT_BASE_URL: 'https://vault.example' }))

import TrainingPage from '../page'

// The full page mounts slowly under jsdom; the default 1 s wait is too short.
configure({ asyncUtilTimeout: 8000 })
jest.setTimeout(30000)

const LESSONS = [1, 2, 3, 4, 5, 6].map((n) => ({
  id: `v_v1_14_${n}`, module_id: 'm_v1_14', volume: 1, module_num: 14, video_num: `14.${n}`,
  title_en: `Lesson title ${n}`, title_es: null, youtube_id_en: null, youtube_id_es: null, r2_key_en: null, r2_key_es: null,
  duration_en_sec: null, duration_es_sec: null, sort_order: 11400 + n,
  body_markdown: `## Lesson title ${n}\n\nApproved text ${n}.`, certification_id: null,
}))
const VIDEO = {
  id: 'v_v1_1_1', module_id: 'm_v1_1', volume: 1, module_num: 1, video_num: '1.1', title_en: 'Intro video', title_es: null,
  youtube_id_en: null, youtube_id_es: null, r2_key_en: 'vol1/m1.mp4', r2_key_es: null, duration_en_sec: 120, duration_es_sec: null,
  sort_order: 1, body_markdown: null, certification_id: null,
}
const MODULES = [
  { id: 'm_v1_1', volume: 1, module_num: 1, title_en: 'Module One', title_es: 'Uno', sort_order: 100 },
  { id: 'm_v1_13', volume: 1, module_num: 13, title_en: 'EASE Training', title_es: 'EASE', sort_order: 11300 },
  { id: 'm_v1_14', volume: 1, module_num: 14, title_en: 'Fair Housing & Disclosure', title_es: 'Vivienda', sort_order: 11400 },
]
let progressRows: any[] = []

function resp(body: unknown) { return { ok: true, status: 200, json: async () => body } as unknown as Response }
beforeEach(() => {
  upserts.length = 0
  upsertError = null
  progressRows = []
  global.fetch = jest.fn(async (url: string) => {
    if (url === '/api/training/catalog') return resp({ modules: MODULES, videos: [VIDEO, ...LESSONS], progress: progressRows })
    if (url === '/api/training/progress')
      return resp({ trainingProgress: [{ volume: 'volume-1', completed_modules: [1, 13], test_scores: {}, volume_completed: false }], quizResults: [] })
    if (url.startsWith('/api/training/sign-video')) return resp({ url: 'https://signed.example/m1.mp4' })
    return resp({})
  }) as any
})

async function openModule14() {
  render(<TrainingPage />)
  const mod = await screen.findByRole('button', { name: /Module 14.*Fair Housing & Disclosure/ })
  // Module 14 unlocks once Module 13's pass has loaded.
  await waitFor(() => expect(within(mod).queryByText('Complete previous module quiz to unlock')).toBeNull())
  fireEvent.click(mod)
}

describe('Module 14 reading lessons on the training page', () => {
  it('lists the six reading lessons in order, each labelled Reading', async () => {
    await openModule14()
    const items = (await screen.findAllByRole('button', { name: /^14\.\d\s*Lesson title \d/ })).map((b) => b.textContent)
    expect(items.map((t) => t!.slice(0, 4))).toEqual(['14.1', '14.2', '14.3', '14.4', '14.5', '14.6'])
    for (const t of items) expect(t).toMatch(/Reading$/)
  })

  it('opens a lesson in the reading view (no video player) and the quiz is locked at 0 of 6', async () => {
    await openModule14()
    fireEvent.click(await screen.findByRole('button', { name: /^14\.1\s*Lesson title 1/ }))
    const article = await screen.findByRole('article', { name: 'Lesson 14.1: Lesson title 1' })
    expect(within(article).getByText('Approved text 1.')).toBeInTheDocument()
    expect(screen.queryByText(/Video coming soon/)).toBeNull()
    expect(screen.getAllByText(/Quiz locked — 0 of 6 lessons read/).length).toBeGreaterThan(0)
    expect(screen.queryByRole('button', { name: /Take (Module )?Quiz/ })).toBeNull()
  })

  it("'I have read this lesson' writes the agent's own progress row and updates the lock", async () => {
    await openModule14()
    fireEvent.click(await screen.findByRole('button', { name: /^14\.2\s*Lesson title 2/ }))
    fireEvent.click(await screen.findByRole('button', { name: /I have read this lesson/ }))
    await screen.findByRole('button', { name: /Lesson completed/ })
    expect(upserts).toEqual([{
      table: 'training_video_progress',
      row: expect.objectContaining({ user_id: AGENT, video_id: 'v_v1_14_2', completed: true }),
      opts: { onConflict: 'user_id,video_id' },
    }])
    expect(screen.getAllByText(/Quiz locked — 1 of 6 lessons read/).length).toBeGreaterThan(0)
  })

  it('a failed save is reported and does NOT mark the lesson read', async () => {
    upsertError = { code: '42501', message: 'denied' }
    await openModule14()
    fireEvent.click(await screen.findByRole('button', { name: /^14\.3\s*Lesson title 3/ }))
    fireEvent.click(await screen.findByRole('button', { name: /I have read this lesson/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not be saved/)
    expect(screen.getByRole('button', { name: /I have read this lesson/ })).toBeEnabled()
    expect(screen.getAllByText(/0 of 6 lessons read/).length).toBeGreaterThan(0)
  })

  it('with all six read (persisted progress), the Module 14 quiz button appears', async () => {
    progressRows = LESSONS.map((l) => ({ video_id: l.id, watched_seconds: 0, completed: true }))
    await openModule14()
    await screen.findAllByRole('button', { name: /^14\.\d\s*Lesson title \d/ })
    expect(screen.queryByText(/Quiz locked/)).toBeNull()
    expect(screen.getByRole('button', { name: /^Take Quiz$/ })).toBeEnabled()
  })

  it('the existing video module still plays video and keeps "Mark as complete"', async () => {
    render(<TrainingPage />)
    await waitFor(() => expect(document.querySelector('video[src="https://signed.example/m1.mp4"]')).not.toBeNull())
    expect(screen.getByRole('button', { name: /Mark as complete/ })).toBeEnabled()
    expect(screen.queryByRole('article')).toBeNull()
  })
})
