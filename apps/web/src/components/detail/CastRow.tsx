import type { CastMemberResponse } from '@iptvflix/api-contracts'

interface CastRowProps {
  cast: CastMemberResponse[]
  director: string | null
}

export default function CastRow({ cast, director }: CastRowProps) {
  if (cast.length === 0 && !director) return null

  return (
    <div className="mb-6">
      {director && (
        <p className="text-sm text-gray-400 mb-3">
          <span className="font-medium text-gray-300">Réalisateur :</span> {director}
        </p>
      )}
      {cast.length > 0 && (
        <>
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Casting</p>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {cast.map((member, i) => (
              <div key={i} className="flex-shrink-0 w-20 text-center">
                <div className="w-20 h-20 rounded-full overflow-hidden bg-white/10 mb-1 mx-auto">
                  {member.profileUrl ? (
                    <img
                      src={member.profileUrl}
                      alt={member.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-2xl text-gray-500">
                      👤
                    </div>
                  )}
                </div>
                <p className="text-xs text-white font-medium truncate">{member.name}</p>
                {member.character && (
                  <p className="text-xs text-gray-500 truncate">{member.character}</p>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
