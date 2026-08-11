import { useState, useEffect, useCallback } from 'react'
import type {
  SourceResponse,
  CreateSourceBody,
  UpdateSourceBody,
  TestSourceResult,
} from '@iptvflix/api-contracts'
import {
  listSources,
  createSource,
  updateSource,
  deleteSource,
  testSource,
} from '../lib/api.js'

export type SourcesState = {
  sources: SourceResponse[] | null
  loading: boolean
  error: Error | null
  refetch: () => void
  createSource: (body: CreateSourceBody) => Promise<SourceResponse>
  updateSource: (id: string, body: UpdateSourceBody) => Promise<SourceResponse>
  deleteSource: (id: string) => Promise<void>
  testSource: (id: string) => Promise<TestSourceResult>
}

export function useSources(): SourcesState {
  const [sources, setSources] = useState<SourceResponse[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setSources(await listSources())
    } catch (e) {
      setError(e as Error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refetch()
  }, [refetch])

  const handleCreate = useCallback(async (body: CreateSourceBody) => {
    const created = await createSource(body)
    setSources((prev) => (prev ? [...prev, created] : [created]))
    return created
  }, [])

  const handleUpdate = useCallback(async (id: string, body: UpdateSourceBody) => {
    const updated = await updateSource(id, body)
    setSources((prev) => (prev ? prev.map((s) => (s.id === id ? updated : s)) : [updated]))
    return updated
  }, [])

  const handleDelete = useCallback(async (id: string) => {
    await deleteSource(id)
    setSources((prev) => (prev ? prev.filter((s) => s.id !== id) : []))
  }, [])

  const handleTest = useCallback(async (id: string) => {
    return testSource(id)
  }, [])

  return {
    sources,
    loading,
    error,
    refetch,
    createSource: handleCreate,
    updateSource: handleUpdate,
    deleteSource: handleDelete,
    testSource: handleTest,
  }
}
