/**
 * @jest-environment node
 */
// ============================================================================
// P0-41 · calendar/events · cross-tenant recipient-fan-out isolation
// ============================================================================
// Before the fix, POST /api/calendar/events selected every profile row and
// pushed a notification + email + Expo broadcast to every user in every
// tenant. Recipients were unfiltered — no role, no tenant, no is_active.
// This suite locks the tenant-scope contract:
//
//   1. Recipient set is derived from the CALLER's own tenant_id
//   2. Cross-tenant profiles never appear in any channel (in-app / mail / push)
//   3. Profiles with tenant_id = NULL are excluded
//   4. Caller with tenant_id = NULL (broker/admin/office_manager role) →
//      route fails closed (403) and NO event is created and NO channel fires
//   5. Actor is always excluded from own recipient set
//   6. Platform-super-admin (mrhart@hartfeltmg.com) does NOT gain
//      cross-tenant recipient widening — Correction 1 of the finding
//   7. Push fan-out uses per-user token lookup (sendExpoPushToUsers),
//      NOT the tenantless sendExpoPushBroadcast which loads every active
//      token in the system.
// ============================================================================

// ── State the mocks read from — reset in beforeEach ────────────────────────
type ProfileFixture = {
  id: string
  email: string | null
  full_name: string | null
  role?: string
  tenant_id: string | null
  is_active?: boolean
}

let AUTHED_USER: { id: string; email?: string } | null = null
let PROFILES: ProfileFixture[] = []

// Recording pins — assertions read these
type NotificationRow = {
  user_id: string
  type: string
  status?: string
  title: string
  body: string
}
let notificationInsertCalls: NotificationRow[][] = []
let calendarEventInserts: any[] = []
type PushBroadcastCall = {
  title: string
  body: string
  data: Record<string, any>
  excludeUserId?: string
}
type PushToUsersCall = {
  userIds: string[]
  title: string
  body: string
  data: Record<string, any>
  excludeUserId?: string
}
let pushBroadcastCalls: PushBroadcastCall[] = []
let pushToUsersCalls: PushToUsersCall[] = []
let sendGridMultipleCalls: any[] = []

// ── @sendgrid/mail (dynamic import inside route) ───────────────────────────
jest.mock('@sendgrid/mail', () => ({
  __esModule: true,
  default: {
    setApiKey: jest.fn(),
    sendMultiple: jest.fn(async (payload: any) => {
      sendGridMultipleCalls.push(payload)
      return { ok: true } as any
    }),
  },
}))

// ── @/lib/vault-client (only VAULT_BASE_URL is used, for email HTML) ──────
jest.mock('@/lib/vault-client', () => ({
  VAULT_BASE_URL: 'http://vault.test',
}))

// ── @/lib/push-notifications (broadcast + per-user variants) ──────────────
jest.mock('@/lib/push-notifications', () => ({
  sendExpoPushBroadcast: jest.fn(
    async (
      title: string,
      body: string,
      data: Record<string, any>,
      excludeUserId?: string,
    ) => {
      pushBroadcastCalls.push({ title, body, data, excludeUserId })
    },
  ),
  sendExpoPushToUsers: jest.fn(
    async (
      userIds: string[],
      title: string,
      body: string,
      data: Record<string, any>,
      excludeUserId?: string,
    ) => {
      pushToUsersCalls.push({ userIds, title, body, data, excludeUserId })
    },
  ),
}))

// ── Service-role client (adminClient) ─────────────────────────────────────
// Returns a chainable client whose reads come from PROFILES fixture. Writes
// are recorded into notificationInsertCalls / calendarEventInserts. The chain
// is thenable so that awaiting a list SELECT resolves to { data, error }.
type QueryFilter = { column: string; value: any; op: 'eq' | 'neq' | 'in' }

function makeAdminClient() {
  return {
    from(table: string) {
      const filters: QueryFilter[] = []
      let selectCols = '*'
      let pendingInsertRow: any = null

      const rowMatches = (row: any): boolean =>
        filters.every((f) => {
          const cell = row?.[f.column]
          if (f.op === 'eq') return cell === f.value
          if (f.op === 'neq') return cell !== f.value
          if (f.op === 'in')
            return Array.isArray(f.value) && f.value.includes(cell)
          return true
        })

      const listForTable = (): any[] => {
        if (table === 'profiles') return PROFILES.filter(rowMatches)
        return []
      }

      const singleForTable = () => {
        if (pendingInsertRow) return { data: pendingInsertRow, error: null }
        if (table === 'profiles') {
          const row = PROFILES.find(rowMatches)
          if (!row)
            return {
              data: null,
              error: { code: 'PGRST116', message: 'no rows' },
            }
          return { data: row, error: null }
        }
        return { data: null, error: null }
      }

      const chain: any = {
        select(cols?: string) {
          if (cols) selectCols = cols
          return chain
        },
        eq(column: string, value: any) {
          filters.push({ column, value, op: 'eq' })
          return chain
        },
        neq(column: string, value: any) {
          filters.push({ column, value, op: 'neq' })
          return chain
        },
        in(column: string, values: any[]) {
          filters.push({ column, value: values, op: 'in' })
          return chain
        },
        order() {
          return chain
        },
        gte() {
          return chain
        },
        lte() {
          return chain
        },
        single() {
          return Promise.resolve(singleForTable())
        },
        insert(payload: any) {
          const rows = Array.isArray(payload) ? payload : [payload]
          if (table === 'notifications') {
            notificationInsertCalls.push(rows as NotificationRow[])
            return Promise.resolve({ data: null, error: null })
          }
          if (table === 'calendar_events') {
            const row = { id: 'evt-fixture-1', ...rows[0] }
            calendarEventInserts.push(row)
            pendingInsertRow = row
            return chain
          }
          return Promise.resolve({ data: null, error: null })
        },
        // Awaiting the chain (list SELECT) resolves to { data, error }
        then(resolve: (v: any) => void) {
          resolve({ data: listForTable(), error: null })
        },
      }
      return chain
    },
  }
}

jest.mock('@/lib/security', () => ({
  adminClient: jest.fn(() => makeAdminClient()),
}))

// ── Bearer/cookie auth — provide AUTHED_USER via both paths ───────────────
jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: {
      getUser: async () => ({
        data: { user: AUTHED_USER },
        error: AUTHED_USER ? null : { message: 'no user' },
      }),
    },
  }),
}))
jest.mock('@supabase/ssr', () => ({
  createServerClient: () => ({
    auth: {
      getUser: async () => ({ data: { user: AUTHED_USER } }),
    },
  }),
}))

// Ensure the SendGrid branch runs
process.env.SENDGRID_API_KEY = 'SG.test-key'

// Import AFTER all mocks are staged
import { POST } from '@/app/api/calendar/events/route'

function req(body: any): any {
  return {
    headers: {
      get(name: string) {
        return name.toLowerCase() === 'authorization' ? 'Bearer test' : null
      },
    },
    cookies: { get: () => undefined },
    json: async () => body,
    url: 'http://apx/api/calendar/events',
    nextUrl: new URL('http://apx/api/calendar/events'),
  }
}

// Fixture helpers
const TENANT_A = 'tenant-a-uuid'
const TENANT_B = 'tenant-b-uuid'
const PLATFORM_SUPER_ADMIN_EMAIL = 'mrhart@hartfeltmg.com'

function baseBody() {
  return {
    title: 'Team Standup',
    type: 'meeting',
    event_date: '2026-10-15',
    event_time: '10:00',
    location: 'HQ',
    notes: 'Bring notes',
  }
}

function flatRecipientIds() {
  return notificationInsertCalls.flat().map((n) => n.user_id)
}
function flatEmails() {
  return sendGridMultipleCalls.flatMap((call: any) =>
    Array.isArray(call?.to) ? call.to : [],
  )
}

beforeEach(() => {
  AUTHED_USER = null
  PROFILES = []
  notificationInsertCalls = []
  calendarEventInserts = []
  pushBroadcastCalls = []
  pushToUsersCalls = []
  sendGridMultipleCalls = []
})

describe('POST /api/calendar/events · tenant-scoped recipient fan-out (P0-41)', () => {
  it('1 · same-tenant intended recipient receives the notification', async () => {
    const brokerA = {
      id: 'broker-a',
      email: 'broker.a@hartfeltrealestate.com',
      full_name: 'Broker A',
      role: 'broker',
      tenant_id: TENANT_A,
    }
    const agentA = {
      id: 'agent-a',
      email: 'agent.a@hartfeltrealestate.com',
      full_name: 'Agent A',
      role: 'agent',
      tenant_id: TENANT_A,
    }
    AUTHED_USER = { id: brokerA.id, email: brokerA.email }
    PROFILES = [brokerA, agentA]

    const res = await POST(req(baseBody()))

    expect(res.status).toBe(201)
    const ids = flatRecipientIds()
    expect(ids).toContain(agentA.id)
    expect(flatEmails()).toContain(agentA.email)
  })

  it('2 · foreign-tenant user does NOT receive notification / email / push', async () => {
    const brokerA = {
      id: 'broker-a',
      email: 'broker.a@hartfeltrealestate.com',
      full_name: 'Broker A',
      role: 'broker',
      tenant_id: TENANT_A,
    }
    const agentA = {
      id: 'agent-a',
      email: 'agent.a@hartfeltrealestate.com',
      full_name: 'Agent A',
      role: 'agent',
      tenant_id: TENANT_A,
    }
    const agentB = {
      id: 'agent-b',
      email: 'agent.b@othertenant.example',
      full_name: 'Agent B',
      role: 'agent',
      tenant_id: TENANT_B,
    }
    AUTHED_USER = { id: brokerA.id, email: brokerA.email }
    PROFILES = [brokerA, agentA, agentB]

    const res = await POST(req(baseBody()))
    expect(res.status).toBe(201)

    const ids = flatRecipientIds()
    expect(ids).not.toContain(agentB.id)
    expect(flatEmails()).not.toContain(agentB.email)

    // Push must not fan out via the tenantless system-wide broadcast
    expect(pushBroadcastCalls).toHaveLength(0)
    // And any per-user push must NOT include tenant B users
    const pushedIds = pushToUsersCalls.flatMap((c) => c.userIds || [])
    expect(pushedIds).not.toContain(agentB.id)
  })

  it('3 · foreign-tenant same-email-pattern user (@hartfeltrealestate.com in tenant B) does NOT receive', async () => {
    const brokerA = {
      id: 'broker-a',
      email: 'broker.a@hartfeltrealestate.com',
      full_name: 'Broker A',
      role: 'broker',
      tenant_id: TENANT_A,
    }
    // A tenant B agent with the SAME email domain — proves the filter is
    // structural (tenant_id) not heuristic (email pattern).
    const plantB = {
      id: 'plant-b',
      email: 'agent@hartfeltrealestate.com',
      full_name: 'Look-Alike Agent',
      role: 'agent',
      tenant_id: TENANT_B,
    }
    AUTHED_USER = { id: brokerA.id, email: brokerA.email }
    PROFILES = [brokerA, plantB]

    const res = await POST(req(baseBody()))
    expect(res.status).toBe(201)

    expect(flatRecipientIds()).not.toContain(plantB.id)
    expect(flatEmails()).not.toContain(plantB.email)
  })

  it('4 · tenantless (tenant_id=NULL) recipient does NOT receive', async () => {
    const brokerA = {
      id: 'broker-a',
      email: 'broker.a@hartfeltrealestate.com',
      full_name: 'Broker A',
      role: 'broker',
      tenant_id: TENANT_A,
    }
    const orphan = {
      id: 'orphan-1',
      email: 'orphan@example.test',
      full_name: 'Orphan',
      role: 'agent',
      tenant_id: null,
    }
    AUTHED_USER = { id: brokerA.id, email: brokerA.email }
    PROFILES = [brokerA, orphan]

    const res = await POST(req(baseBody()))
    expect(res.status).toBe(201)

    expect(flatRecipientIds()).not.toContain(orphan.id)
    expect(flatEmails()).not.toContain(orphan.email)
  })

  it('5 · caller with tenant_id=NULL (broker role) → 403 and NO fan-out', async () => {
    const orphanBroker = {
      id: 'broker-orphan',
      email: 'broker@nowhere.example',
      full_name: 'Orphan Broker',
      role: 'broker',
      tenant_id: null,
    }
    const agentA = {
      id: 'agent-a',
      email: 'agent.a@hartfeltrealestate.com',
      full_name: 'Agent A',
      role: 'agent',
      tenant_id: TENANT_A,
    }
    AUTHED_USER = { id: orphanBroker.id, email: orphanBroker.email }
    PROFILES = [orphanBroker, agentA]

    const res = await POST(req(baseBody()))
    expect(res.status).toBe(403)

    // Assert nothing fanned out (no push, no email, no in-app), and no
    // orphan event was persisted.
    expect(notificationInsertCalls).toHaveLength(0)
    expect(sendGridMultipleCalls).toHaveLength(0)
    expect(pushBroadcastCalls).toHaveLength(0)
    expect(pushToUsersCalls).toHaveLength(0)
    expect(calendarEventInserts).toHaveLength(0)
  })

  it('6 · actor is excluded from own recipient set (same-tenant self-notify guard)', async () => {
    const brokerA = {
      id: 'broker-a',
      email: 'broker.a@hartfeltrealestate.com',
      full_name: 'Broker A',
      role: 'broker',
      tenant_id: TENANT_A,
    }
    const agentA = {
      id: 'agent-a',
      email: 'agent.a@hartfeltrealestate.com',
      full_name: 'Agent A',
      role: 'agent',
      tenant_id: TENANT_A,
    }
    AUTHED_USER = { id: brokerA.id, email: brokerA.email }
    PROFILES = [brokerA, agentA]

    const res = await POST(req(baseBody()))
    expect(res.status).toBe(201)

    expect(flatRecipientIds()).not.toContain(brokerA.id)
    expect(flatEmails()).not.toContain(brokerA.email)
    const pushedIds = pushToUsersCalls.flatMap((c) => c.userIds || [])
    expect(pushedIds).not.toContain(brokerA.id)
  })

  it('7 · no duplicate side effects — one in-app insert, one email send, one push call', async () => {
    const brokerA = {
      id: 'broker-a',
      email: 'broker.a@hartfeltrealestate.com',
      full_name: 'Broker A',
      role: 'broker',
      tenant_id: TENANT_A,
    }
    const agentA1 = {
      id: 'agent-a1',
      email: 'a1@hartfeltrealestate.com',
      full_name: 'Agent A1',
      role: 'agent',
      tenant_id: TENANT_A,
    }
    const agentA2 = {
      id: 'agent-a2',
      email: 'a2@hartfeltrealestate.com',
      full_name: 'Agent A2',
      role: 'agent',
      tenant_id: TENANT_A,
    }
    AUTHED_USER = { id: brokerA.id, email: brokerA.email }
    PROFILES = [brokerA, agentA1, agentA2]

    const res = await POST(req(baseBody()))
    expect(res.status).toBe(201)

    // In-app: exactly one insert call, carrying both recipients (no dupes)
    expect(notificationInsertCalls).toHaveLength(1)
    const inAppIds = notificationInsertCalls[0].map((n) => n.user_id).sort()
    expect(inAppIds).toEqual(['agent-a1', 'agent-a2'])

    // Email: one sendMultiple call with both recipient emails, no dupes
    expect(sendGridMultipleCalls).toHaveLength(1)
    const emails = sendGridMultipleCalls[0].to
    expect(Array.isArray(emails)).toBe(true)
    expect([...emails].sort()).toEqual(
      ['a1@hartfeltrealestate.com', 'a2@hartfeltrealestate.com'].sort(),
    )

    // Push: exactly one per-user call. Tenantless broadcast MUST NOT fire.
    expect(pushBroadcastCalls).toHaveLength(0)
    expect(pushToUsersCalls).toHaveLength(1)
    expect([...pushToUsersCalls[0].userIds].sort()).toEqual(
      ['agent-a1', 'agent-a2'].sort(),
    )
  })

  it('8 · existing single-tenant flow still works (tenant A broker → two tenant A agents)', async () => {
    const brokerA = {
      id: 'broker-a',
      email: 'broker.a@hartfeltrealestate.com',
      full_name: 'Broker A',
      role: 'broker',
      tenant_id: TENANT_A,
    }
    const agentA1 = {
      id: 'agent-a1',
      email: 'a1@hartfeltrealestate.com',
      full_name: 'Agent A1',
      role: 'agent',
      tenant_id: TENANT_A,
    }
    const agentA2 = {
      id: 'agent-a2',
      email: 'a2@hartfeltrealestate.com',
      full_name: 'Agent A2',
      role: 'agent',
      tenant_id: TENANT_A,
    }
    AUTHED_USER = { id: brokerA.id, email: brokerA.email }
    PROFILES = [brokerA, agentA1, agentA2]

    const res = await POST(req(baseBody()))
    expect(res.status).toBe(201)

    const ids = flatRecipientIds().sort()
    expect(ids).toEqual(['agent-a1', 'agent-a2'])
    expect(calendarEventInserts).toHaveLength(1)
  })

  it('9 · platform super-admin (mrhart@hartfeltmg.com) acting on tenant A produces tenant-A-only recipients — NO cross-tenant widening', async () => {
    const superAdmin = {
      id: 'super-admin',
      email: PLATFORM_SUPER_ADMIN_EMAIL,
      full_name: 'Platform Super Admin',
      role: 'admin',
      tenant_id: TENANT_A, // super-admin acts inside tenant A
    }
    const agentA = {
      id: 'agent-a',
      email: 'agent.a@hartfeltrealestate.com',
      full_name: 'Agent A',
      role: 'agent',
      tenant_id: TENANT_A,
    }
    const agentB = {
      id: 'agent-b',
      email: 'agent.b@othertenant.example',
      full_name: 'Agent B',
      role: 'agent',
      tenant_id: TENANT_B,
    }
    AUTHED_USER = { id: superAdmin.id, email: superAdmin.email }
    PROFILES = [superAdmin, agentA, agentB]

    const res = await POST(req(baseBody()))
    expect(res.status).toBe(201)

    const ids = flatRecipientIds()
    expect(ids).toContain(agentA.id)
    expect(ids).not.toContain(agentB.id)
    expect(flatEmails()).not.toContain(agentB.email)

    // Super-admin's push must not use the tenantless broadcast either
    expect(pushBroadcastCalls).toHaveLength(0)
    const pushedIds = pushToUsersCalls.flatMap((c) => c.userIds || [])
    expect(pushedIds).not.toContain(agentB.id)
  })
})
