import type { RefObject } from 'react';
import type { AvailabilityVariantResponse, EpisodeResponse } from '@iptvflix/api-contracts';
export type AudioTrack = {
    id: number;
    label: string;
    lang: string;
};
export type SubtitleTrack = {
    id: number;
    label: string;
    lang: string;
};
export type Marker = {
    type: 'intro' | 'recap' | 'outro';
    startSeconds: number;
    endSeconds: number;
};
type Props = {
    videoRef: RefObject<HTMLVideoElement | null>;
    alternatives: AvailabilityVariantResponse[];
    onVariantSwitch: (id: string) => void;
    onClose: () => void;
    currentVariantId?: string | null;
    audioTracks?: AudioTrack[];
    currentAudioTrack?: number;
    onAudioTrack?: (id: number) => void;
    subtitleTracks?: SubtitleTrack[];
    currentSubtitleTrack?: number | null;
    onSubtitleTrack?: (id: number | null) => void;
    episodeLabel?: string | null;
    nextEpisode?: EpisodeResponse | null;
    onNextEpisode?: () => void;
    markers?: Marker[];
    deliveryMode?: string | null;
    containerExtension?: string | null;
    hintDurationSeconds?: number | null;
    onStableDuration?: (seconds: number) => void;
};
export default function PlayerControls({ videoRef, alternatives, onVariantSwitch, onClose, currentVariantId, audioTracks, currentAudioTrack, onAudioTrack, subtitleTracks, currentSubtitleTrack, onSubtitleTrack, episodeLabel, nextEpisode, onNextEpisode, markers, deliveryMode, containerExtension, hintDurationSeconds, onStableDuration, }: Props): import("react").JSX.Element;
export {};
//# sourceMappingURL=PlayerControls.d.ts.map