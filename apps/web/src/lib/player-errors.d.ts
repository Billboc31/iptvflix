import type { PlaybackErrorCategory } from '@iptvflix/api-contracts';
export declare function errorCategoryMessage(category: PlaybackErrorCategory): string;
export declare function videoErrorMessage(video: HTMLVideoElement | null, httpStatus?: number, errorCategory?: PlaybackErrorCategory): string;
export declare function isMpegTsContainer(ext: string | null | undefined): boolean;
export declare function isHlsContainer(ext: string | null | undefined): boolean;
//# sourceMappingURL=player-errors.d.ts.map