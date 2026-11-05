import {
  ALWAYS_ALLOWED_ACTIONS,
  POLICY_ACK_ENFORCEMENT,
  RESTRICTED_WHEN_ENFORCED_ACTIONS,
  classifyPolicyAction,
  isPolicyActionBlocked,
} from '../enforcement'

describe('[A4-ENF] policy-acknowledgment action classification', () => {
  it('[A4-ENF1] enforcement ships OFF', () => {
    expect(POLICY_ACK_ENFORCEMENT).toBe(false)
  })

  it.each([
    'existing_transaction', 'cma', 'docusign', 'clients',
    'communications', 'commissions', 'training', 'inbound_leads',
  ])('[A4-ENF2] %s is always allowed', (a) => {
    expect(classifyPolicyAction(a)).toBe('always_allowed')
    expect(isPolicyActionBlocked(a, { owed: true, enforcement: true })).toBe(false)
  })

  it.each(['new_transaction', 'new_listing', 'outbound_marketing'])(
    '[A4-ENF3] %s is restricted only when enforced AND owed',
    (a) => {
      expect(classifyPolicyAction(a)).toBe('restricted_when_enforced')
      expect(isPolicyActionBlocked(a, { owed: true, enforcement: true })).toBe(true)
      expect(isPolicyActionBlocked(a, { owed: false, enforcement: true })).toBe(false)
      expect(isPolicyActionBlocked(a, { owed: true, enforcement: false })).toBe(false)
      // Default = the shipped flag (off) → nothing blocked.
      expect(isPolicyActionBlocked(a, { owed: true })).toBe(false)
    },
  )

  it('[A4-ENF4] an unknown action is never restricted by inference', () => {
    expect(classifyPolicyAction('something_new')).toBe('always_allowed')
  })

  it('[A4-ENF5] the two lists are disjoint', () => {
    const allowed = new Set<string>(ALWAYS_ALLOWED_ACTIONS)
    for (const a of RESTRICTED_WHEN_ENFORCED_ACTIONS) expect(allowed.has(a)).toBe(false)
  })
})
