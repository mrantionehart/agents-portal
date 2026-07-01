/**
 * @jest-environment node
 */
// ============================================================================
// AGENT.SIGN.1C — checklist logic tests
// ============================================================================

import {
  mapVaultStatusToLabel,
  mapRequirementLabel,
  selectabilityFor,
  buildChecklistRows,
  deriveActionBar,
  type VaultDocumentCard,
  type VaultRequirementCard,
  type VaultFormStatus,
} from '../checklist-logic'

function doc(over: Partial<VaultDocumentCard> = {}): VaultDocumentCard {
  return {
    form_instance_id: 'fi-1',
    form_id: 'RLHD-3x',
    form_name: 'Residential Lease',
    category: 'lease',
    disposition: 'ready_for_review',
    status_label: 'Ready',
    downloadable: true,
    last_updated: '2026-07-01T00:00:00Z',
    status: 'ready',
    form_revision: 'Rev 10/25',
    manual_only: false,
    generatable: true,
    e_sign: true,
    has_upload: false,
    ...over,
  }
}

function req(over: Partial<VaultRequirementCard> = {}): VaultRequirementCard {
  return {
    form_id: 'RLHD-3x',
    form_name: 'Residential Lease',
    category: 'lease',
    form_revision: 'Rev 10/25',
    required: true,
    reason: 'FL Statute',
    requirement_basis: 'always',
    ...over,
  }
}

describe('mapVaultStatusToLabel', () => {
  const cases: Array<[VaultFormStatus, string]> = [
    ['blocked', 'Blocked'],
    ['recommended', 'Required'],
    ['required', 'Required'],
    ['in_progress', 'Preparing'],
    ['ready', 'Ready'],
    ['sent', 'Sent'],
    ['signed', 'Approved'],
    ['voided', 'Hidden'],
  ]
  it.each(cases)('%s → %s', (status, label) => {
    expect(mapVaultStatusToLabel(status)).toBe(label)
  })
})

describe('mapRequirementLabel', () => {
  it('always → Required, conditional → Conditional', () => {
    expect(mapRequirementLabel('always', true)).toBe('Required')
    expect(mapRequirementLabel('conditional', true)).toBe('Conditional')
  })
  it('no basis: required→Required, else Optional', () => {
    expect(mapRequirementLabel(undefined, true)).toBe('Required')
    expect(mapRequirementLabel(undefined, false)).toBe('Optional')
  })
})

describe('selectabilityFor — selection rules', () => {
  it('blocked → not selectable', () => {
    expect(selectabilityFor(doc({ status: 'blocked' })).selectable).toBe(false)
  })
  it('ready → selectable', () => {
    expect(selectabilityFor(doc({ status: 'ready' })).selectable).toBe(true)
  })
  it('signed → selectable', () => {
    expect(selectabilityFor(doc({ status: 'signed' })).selectable).toBe(true)
  })
  it('in_progress (Preparing) → disabled', () => {
    const s = selectabilityFor(doc({ status: 'in_progress' }))
    expect(s.selectable).toBe(false)
    expect(s.reason).toBe('Preparing')
  })
  it('manual-only selectable ONLY if uploaded (LFD-1)', () => {
    const notUploaded = selectabilityFor(
      doc({ form_id: 'LFD-1', manual_only: true, has_upload: false, status: 'required', generatable: false, e_sign: false, downloadable: false })
    )
    expect(notUploaded.selectable).toBe(false)
    const uploaded = selectabilityFor(
      doc({ form_id: 'LFD-1', manual_only: true, has_upload: true, status: 'signed', downloadable: true })
    )
    expect(uploaded.selectable).toBe(true)
  })
  it('not-started required → not selectable', () => {
    expect(selectabilityFor(doc({ status: 'required', downloadable: false })).selectable).toBe(false)
  })
  it('voided → not selectable', () => {
    expect(selectabilityFor(doc({ status: 'voided' })).selectable).toBe(false)
  })
})

describe('buildChecklistRows', () => {
  it('merges requirement + document by form_id', () => {
    const rows = buildChecklistRows([req()], [doc()])
    expect(rows).toHaveLength(1)
    expect(rows[0].statusLabel).toBe('Ready')
    expect(rows[0].requirementLabel).toBe('Required')
    expect(rows[0].e_sign).toBe(true)
    expect(rows[0].form_instance_id).toBe('fi-1')
    expect(rows[0].selectable).toBe(true)
  })

  it('conditional requirement → Conditional badge', () => {
    const rows = buildChecklistRows(
      [req({ form_id: 'LFD-1', requirement_basis: 'conditional' })],
      [doc({ form_id: 'LFD-1', manual_only: true, generatable: false, e_sign: false, status: 'required', downloadable: false })]
    )
    expect(rows[0].requirementLabel).toBe('Conditional')
    expect(rows[0].manual_only).toBe(true)
  })

  it('drops Hidden (voided) rows', () => {
    const rows = buildChecklistRows([req()], [doc({ status: 'voided' })])
    expect(rows).toHaveLength(0)
  })

  it('requirement with no materialized doc → not-started Required, not selectable', () => {
    const rows = buildChecklistRows([req({ form_id: 'ERS-20sa' })], [])
    expect(rows[0].statusLabel).toBe('Required')
    expect(rows[0].form_instance_id).toBeNull()
    expect(rows[0].selectable).toBe(false)
  })

  it('broker-only forms never appear (filtered upstream by the projection)', () => {
    // The Vault projection drops CDS-1/CAOT-2, so they are simply absent from
    // requirements/documents. Nothing to render here.
    const rows = buildChecklistRows([req()], [doc()])
    expect(rows.some((r) => r.form_id === 'CDS-1')).toBe(false)
  })
})

describe('deriveActionBar', () => {
  const rows = buildChecklistRows(
    [req(), req({ form_id: 'LFD-1', requirement_basis: 'conditional' })],
    [
      doc({ form_id: 'RLHD-3x', status: 'ready', generatable: true, downloadable: true }),
      doc({ form_id: 'LFD-1', manual_only: true, has_upload: true, status: 'signed', generatable: false, e_sign: false, downloadable: true }),
    ]
  )

  it('counts only selectable selected rows; enables generate/download appropriately', () => {
    const bar = deriveActionBar(rows, new Set(['RLHD-3x', 'LFD-1']))
    expect(bar.count).toBe(2)
    expect(bar.canGenerate).toBe(true) // RLHD-3x generatable
    expect(bar.canDownload).toBe(true)
  })

  it('manual-only-only selection: download yes, generate no', () => {
    const bar = deriveActionBar(rows, new Set(['LFD-1']))
    expect(bar.count).toBe(1)
    expect(bar.canGenerate).toBe(false)
    expect(bar.canDownload).toBe(true)
  })

  it('empty selection → zero count, nothing enabled', () => {
    const bar = deriveActionBar(rows, new Set())
    expect(bar.count).toBe(0)
    expect(bar.canGenerate).toBe(false)
    expect(bar.canDownload).toBe(false)
  })
})
