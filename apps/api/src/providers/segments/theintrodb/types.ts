export interface TheIntroDbSegment {
  start: number
  end: number
  submissions?: number
  verified?: boolean
}

export interface TheIntroDbResponse {
  intro?: TheIntroDbSegment[]
  recap?: TheIntroDbSegment[]
  credits?: TheIntroDbSegment[]
  preview?: TheIntroDbSegment[]
}
