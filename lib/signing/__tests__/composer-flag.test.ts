/**
 * @jest-environment node
 */
import { isSigningComposerEnabled } from '../composer-flag'

describe('isSigningComposerEnabled', () => {
  it('returns false when env is empty', () => {
    expect(isSigningComposerEnabled({})).toBe(false)
  })
  it('returns false when AP_SIGNING_COMPOSER_ENABLED is undefined', () => {
    expect(isSigningComposerEnabled({ AP_SIGNING_COMPOSER_ENABLED: undefined })).toBe(false)
  })
  it('returns false for any truthy-string that is not exactly "true"', () => {
    for (const v of ['1', 'yes', 'True', 'TRUE', 'on', '', ' true ']) {
      expect(isSigningComposerEnabled({ AP_SIGNING_COMPOSER_ENABLED: v })).toBe(false)
    }
  })
  it('returns true ONLY for exactly "true"', () => {
    expect(isSigningComposerEnabled({ AP_SIGNING_COMPOSER_ENABLED: 'true' })).toBe(true)
  })
})
