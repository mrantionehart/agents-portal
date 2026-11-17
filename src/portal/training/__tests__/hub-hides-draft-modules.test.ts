// CTM-1 staging finding (2026-11-12): with the 18 CTM training_modules rows
// present as DRAFT, the Agent Portal Training hub listed all 18 to an agent by
// title — the loader never filtered on status. The fake below APPLIES the
// filters the loader builds, so a missing status filter shows up as a leaked
// row, not as a missing method call.
import { loadTrainingHub } from '../loader'

type Row = Record<string, unknown>
const MODULES: Row[] = [
  { id: 'platform-m01', volume: 1, module_num: 1, title_en: 'Published platform module', sort_order: 1, status: 'published' },
  { id: 'matrix-m01', volume: 5, module_num: 1, title_en: 'Published Matrix module', sort_order: 501, status: 'published' },
  { id: 'ctm-m01', volume: 10, module_num: 1, title_en: 'Residential Buyer Transactions & Closings', sort_order: 1001, status: 'draft' },
  { id: 'ctm-m17', volume: 10, module_num: 17, title_en: 'Certification Exam', sort_order: 1017, status: 'draft' },
  { id: 'old-m01', volume: 2, module_num: 1, title_en: 'Archived module', sort_order: 201, status: 'archived' },
]

function fakeSupabase() {
  return {
    from: (table: string) => {
      let rows: Row[] = table === 'training_modules' ? [...MODULES] : []
      const chain: Record<string, unknown> = {}
      chain.select = () => chain
      chain.eq = (k: string, v: unknown) => { rows = rows.filter((r) => r[k] === v || !(k in r)); return chain }
      chain.order = (k: string) => { rows = [...rows].sort((a, b) => Number(a[k]) - Number(b[k])); return chain }
      chain.then = (res: (v: { data: Row[] }) => unknown) => Promise.resolve({ data: rows }).then(res)
      return chain
    },
  } as never
}

describe('Training hub lists only PUBLISHED modules', () => {
  it('draft CTM modules and archived modules never reach an agent; published ones still do', async () => {
    const res = await loadTrainingHub({ supabase: fakeSupabase(), callerId: 'agent-1' })
    const titles = res.training.map((i) => i.title)
    expect(titles).toEqual(expect.arrayContaining(['Published platform module', 'Published Matrix module']))
    expect(titles.join(' | ')).not.toMatch(/Residential Buyer Transactions|Certification Exam|Archived module/)
    expect(res.training[0]?.id).toBe('training/the-ring')
  })
})
