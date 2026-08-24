import { Component, useEffect, useRef } from 'react'
import type { ReactNode, ErrorInfo } from 'react'
import ShelfRow from '../components/content/ShelfRow.js'
import EmptyState from '../components/ui/EmptyState.js'
import ErrorState from '../components/ui/ErrorState.js'
import Skeleton from '../components/ui/Skeleton.js'
import Spinner from '../components/ui/Spinner.js'
import { useInfiniteSeriesPage } from '../hooks/useSeriesPage.js'
import { useProfile } from '../context/ProfileContext.js'

class ShelfErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(_: Error) {
    return { hasError: true }
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {}

  render() {
    if (this.state.hasError) return null
    return this.props.children
  }
}

function ShelfSkeleton() {
  return (
    <div className="px-8 mt-6">
      <Skeleton className="w-48 h-5 mb-3" />
      <div className="flex gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="w-36 h-52 flex-shrink-0" />
        ))}
      </div>
    </div>
  )
}

export default function SeriesPage() {
  const { currentProfile, profileVersion } = useProfile()
  const {
    allShelves,
    isLoading,
    isFetchingMore,
    hasMore,
    error,
    loadMore,
  } = useInfiniteSeriesPage(currentProfile?.id ?? '', profileVersion)

  const sentinelRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel || !hasMore) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore()
      },
      { rootMargin: '400px' },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasMore, loadMore])

  const hasContent = allShelves.length > 0

  if (!isLoading && !hasContent && !error) {
    return (
      <EmptyState
        icon="📺"
        heading="Aucune série disponible"
        description="Ajoutez une source IPTV pour explorer les séries recommandées."
      />
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      {isLoading && <Spinner />}

      {!isLoading && error && allShelves.length === 0 && (
        <ErrorState
          message="Impossible de charger les recommandations. Réessayez dans un moment."
          onRetry={() => window.location.reload()}
        />
      )}

      {isLoading && (
        <>
          <ShelfSkeleton />
          <ShelfSkeleton />
          <ShelfSkeleton />
        </>
      )}

      {!isLoading && (
        <>
          {allShelves.map((shelf) => (
            <ShelfErrorBoundary key={shelf.id}>
              <ShelfRow shelf={shelf} />
            </ShelfErrorBoundary>
          ))}
        </>
      )}

      {isFetchingMore && (
        <>
          <ShelfSkeleton />
          <ShelfSkeleton />
          <ShelfSkeleton />
        </>
      )}

      {hasMore && !isFetchingMore && <div ref={sentinelRef} aria-hidden="true" />}

      {!hasMore && allShelves.length > 0 && (
        <p className="text-center text-sm text-gray-600 py-8">— Fin des recommandations —</p>
      )}
    </div>
  )
}
