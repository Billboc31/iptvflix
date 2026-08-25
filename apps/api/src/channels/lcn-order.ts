/** French TNT / cable-ish logical channel order for Molotov-style curated lists. */
export const FR_LCN_ORDER: string[] = [
  'TF1.fr',
  'France2.fr',
  'France3.fr',
  'France4.fr',
  'France5.fr',
  'M6.fr',
  'arte.fr',
  'C8.fr',
  'W9.fr',
  'TMC.fr',
  'TFX.fr',
  'NRJ12.fr',
  'LCP.fr',
  'FranceInfo.fr',
  'CNews.fr',
  'CStar.fr',
  'Gulli.fr',
  'TF1SeriesFilms.fr',
  '6ter.fr',
  'RMCStory.fr',
  'RMCDecouverte.fr',
  'Cherie25.fr',
  'LCI.fr',
  'BFMTV.fr',
  'BFMBusiness.fr',
  'CanalPlus.fr',
  'CanalPlusCinema.fr',
  'CanalPlusSport.fr',
  'CanalPlusSeries.fr',
  'Eurosport1.fr',
  'Eurosport2.fr',
  'beINSports1.qa',
  'beINSports2.qa',
  'beINSports3.qa',
  'RMCSport1.fr',
]

const FR_LCN_RANK = new Map(FR_LCN_ORDER.map((id, i) => [id, i]))

export function lcnRank(iptvOrgId: string | null | undefined, country: string | null | undefined): number {
  if (!iptvOrgId) return 10_000
  if ((country ?? '').toUpperCase() === 'FR') {
    return FR_LCN_RANK.get(iptvOrgId) ?? 5_000
  }
  return 5_000
}
