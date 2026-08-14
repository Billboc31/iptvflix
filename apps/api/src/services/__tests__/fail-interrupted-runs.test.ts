import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockReturning = vi.fn()
const mockWhere = vi.fn()
const mockSet = vi.fn()
const mockUpdate = vi.fn()

vi.mock('../../db/schema/sync-runs.js', () => ({
  syncRuns: { id: 'sync.id', status: 'sync.status' },
}))
vi.mock('../../db/schema/catalog-bootstrap-runs.js', () => ({
  catalogBootstrapRuns: { id: 'boot.id', status: 'boot.status' },
}))
vi.mock('../../db/schema/catalog-refresh-runs.js', () => ({
  catalogRefreshRuns: { id: 'refresh.id', status: 'refresh.status' },
}))
vi.mock('../../db/schema/reconciliation-runs.js', () => ({
  reconciliationRuns: { id: 'recon.id', status: 'recon.status' },
}))

import { failInterruptedRuns } from '../fail-interrupted-runs.js'

describe('failInterruptedRuns', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('marks leftover RUNNING rows as FAILED', async () => {
    mockReturning
      .mockResolvedValueOnce([{ id: 'sync-1' }])
      .mockResolvedValueOnce([{ id: 'boot-1' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
    mockWhere.mockReturnValue({ returning: mockReturning })
    mockSet.mockReturnValue({ where: mockWhere })
    mockUpdate.mockReturnValue({ set: mockSet })

    const result = await failInterruptedRuns({ update: mockUpdate } as never, 'interrupted by deploy')

    expect(result).toEqual({
      syncRunIds: ['sync-1'],
      bootstrapRunIds: ['boot-1'],
      refreshRunIds: [],
      reconciliationRunIds: [],
    })
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'FAILED', errorMessage: 'interrupted by deploy' }),
    )
    expect(mockUpdate).toHaveBeenCalledTimes(4)
  })
})
