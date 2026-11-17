// ============================================================================
// Tailwind only emits CSS for classes in files its `content` globs scan.
// ============================================================================
// The portal shell's mobile drawer (`src/portal/Sidebar.tsx`) was not
// scanned, so `-translate-x-full` and `md:translate-x-0` produced no CSS: on a
// phone the nav sat open over every page and its close button did nothing.
// Found in the Deal Dispo UAT at 375px, 2026-11-13. A class nobody generates
// cannot fail a component test — jsdom applies no stylesheet — so the
// coverage is pinned here, against Tailwind's own matcher.
// ============================================================================
import path from 'node:path'
import micromatch from 'micromatch'
// eslint-disable-next-line @typescript-eslint/no-var-requires
const config = require('../../../tailwind.config.js')

const globs: string[] = (config.content as string[]).map((g) => g.replace(/^\.\//, ''))
const scanned = (file: string) => micromatch.isMatch(file, globs)

describe('tailwind content covers the portal shell and Deal Opportunities', () => {
  it.each([
    'src/portal/Sidebar.tsx',
    'src/portal/deal-opportunities/DealOpportunities.tsx',
    'src/portal/clients/ClientsClient.tsx',
  ])('%s is scanned', (file) => {
    expect(scanned(file)).toBe(true)
  })

  it('the drawer still uses the classes this guard exists for', () => {
    const src = require('node:fs').readFileSync(path.join(process.cwd(), 'src/portal/Sidebar.tsx'), 'utf8')
    expect(src).toContain('-translate-x-full')
    expect(src).toContain('md:translate-x-0')
  })
})
