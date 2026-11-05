/**
 * @jest-environment node
 */
// HR-CERT-DISPLAY — the browser-graded training-interactive "final" is graded
// on the client, so passing it must not present a HartFelt Ready certificate.
// The official certificate is reported by /api/training/certificate
// (Broker-of-Record-verified only — see its verified-only.test.ts).
import { readFileSync } from 'fs'
import { join } from 'path'

describe('training-interactive — no browser-graded certificate', () => {
  const src = readFileSync(join(process.cwd(), 'app/training-interactive/page.tsx'), 'utf8')
  it('no "CERTIFIED!" claim and no switch to the certificate screen on a browser-graded pass', () => {
    expect(src).not.toContain('CERTIFIED!')
    expect(src).not.toMatch(/setScreen\('certificate'\)/)
  })
  it('the pass message points to the Broker of Record grant', () => {
    expect(src).toContain('issued after your Broker of Record grants it')
  })
})
