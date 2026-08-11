import PosterCard from './PosterCard.js'

type ContentItem = {
  id: string
  title: string
  year?: number | null
  posterUrl?: string | null
  quality?: string | null
}

type PosterGridProps = {
  items: ContentItem[]
  onItemClick: (id: string) => void
}

export default function PosterGrid({ items, onItemClick }: PosterGridProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mt-6">
      {items.map((item) => (
        <PosterCard
          key={item.id}
          title={item.title}
          year={item.year}
          posterUrl={item.posterUrl}
          quality={item.quality}
          onClick={() => onItemClick(item.id)}
        />
      ))}
    </div>
  )
}
