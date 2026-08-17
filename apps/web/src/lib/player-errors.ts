export function videoErrorMessage(video: HTMLVideoElement | null, httpStatus?: number): string {
  if (httpStatus === 401 || httpStatus === 403) return 'Source expirée — contactez l\'administrateur'
  if (httpStatus === 404) return 'Média introuvable chez le fournisseur'
  if (httpStatus === 502) return 'Le fournisseur a refusé le flux'
  if (httpStatus === 504) return 'Fournisseur ne répond pas'
  if (httpStatus === 410) return 'Session de lecture expirée'
  if (httpStatus != null && httpStatus >= 400) return 'Erreur de lecture'
  if (video?.error) {
    const code = video.error.code
    if (code === MediaError.MEDIA_ERR_DECODE || code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED) {
      return 'Ce format n\'est pas lisible sur cet appareil — essayez une autre version'
    }
  }
  return 'Erreur de lecture'
}

export function isMpegTsContainer(ext: string | null | undefined): boolean {
  const e = (ext ?? '').toLowerCase()
  return e === 'ts' || e === 'm2ts' || e === 'mts'
}

export function isHlsContainer(ext: string | null | undefined): boolean {
  const e = (ext ?? '').toLowerCase()
  return e === 'm3u8' || e === 'm3u'
}
