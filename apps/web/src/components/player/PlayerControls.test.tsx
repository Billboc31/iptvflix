import { render, screen, fireEvent, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useRef } from 'react'
import PlayerControls from './PlayerControls.js'
import type { AudioTrack, SubtitleTrack, Marker } from './PlayerControls.js'
import type { AvailabilityVariantResponse, EpisodeResponse } from '@iptvflix/api-contracts'

function createMockVideo({
  currentTime = 0,
  duration = 3600,
  paused = true,
  volume = 1,
  muted = false,
  playbackRate = 1,
}: Partial<{
  currentTime: number
  duration: number
  paused: boolean
  volume: number
  muted: boolean
  playbackRate: number
}> = {}) {
  const video = document.createElement('video')

  let _currentTime = currentTime
  let _muted = muted
  let _volume = volume
  let _playbackRate = playbackRate
  let _paused = paused

  Object.defineProperties(video, {
    currentTime: {
      get: () => _currentTime,
      set: (v: number) => { _currentTime = v },
      configurable: true,
    },
    duration: { get: () => duration, configurable: true },
    paused: { get: () => _paused, configurable: true },
    volume: {
      get: () => _volume,
      set: (v: number) => { _volume = v },
      configurable: true,
    },
    muted: {
      get: () => _muted,
      set: (v: boolean) => { _muted = v },
      configurable: true,
    },
    playbackRate: {
      get: () => _playbackRate,
      set: (v: number) => {
        _playbackRate = v
        video.dispatchEvent(new Event('ratechange'))
      },
      configurable: true,
    },
    seekable: {
      get: () => ({ length: 1 }),
      configurable: true,
    },
  })

  video.play = vi.fn().mockImplementation(() => {
    _paused = false
    return Promise.resolve()
  })
  video.pause = vi.fn().mockImplementation(() => {
    _paused = true
  })

  return video
}

type WrapperProps = {
  video: HTMLVideoElement
  alternatives?: AvailabilityVariantResponse[]
  audioTracks?: AudioTrack[]
  subtitleTracks?: SubtitleTrack[]
  currentSubtitleTrack?: number | null
  markers?: Marker[]
  episodeLabel?: string | null
  nextEpisode?: EpisodeResponse | null
  onNextEpisode?: () => void
  onClose?: () => void
  onVariantSwitch?: (id: string) => void
  onAudioTrack?: (id: number) => void
  onSubtitleTrack?: (id: number | null) => void
  deliveryMode?: string | null
  containerExtension?: string | null
}

function Wrapper({
  video,
  alternatives = [],
  audioTracks = [],
  subtitleTracks = [],
  currentSubtitleTrack = null,
  markers = [],
  episodeLabel = null,
  nextEpisode = null,
  onNextEpisode = vi.fn(),
  onClose = vi.fn(),
  onVariantSwitch = vi.fn(),
  onAudioTrack = vi.fn(),
  onSubtitleTrack = vi.fn(),
  deliveryMode = null,
  containerExtension = null,
}: WrapperProps) {
  const videoRef = useRef(video)
  return (
    <PlayerControls
      videoRef={videoRef}
      alternatives={alternatives}
      onVariantSwitch={onVariantSwitch}
      onClose={onClose}
      audioTracks={audioTracks}
      subtitleTracks={subtitleTracks}
      currentSubtitleTrack={currentSubtitleTrack}
      onAudioTrack={onAudioTrack}
      onSubtitleTrack={onSubtitleTrack}
      markers={markers}
      episodeLabel={episodeLabel}
      nextEpisode={nextEpisode}
      onNextEpisode={onNextEpisode}
      deliveryMode={deliveryMode}
      containerExtension={containerExtension}
    />
  )
}

describe('PlayerControls', () => {
  let video: HTMLVideoElement

  beforeEach(() => {
    video = createMockVideo({ paused: true })
    vi.clearAllMocks()
  })

  it('renders play button when paused', () => {
    render(<Wrapper video={video} />)
    expect(screen.getAllByLabelText('Lire').length).toBeGreaterThan(0)
  })

  it('renders pause button when playing — sync from play event', () => {
    render(<Wrapper video={video} />)
    act(() => {
      video.dispatchEvent(new Event('play'))
    })
    expect(screen.getAllByLabelText('Pause').length).toBeGreaterThan(0)
  })

  it('calls play on video when play button clicked while paused', () => {
    render(<Wrapper video={video} />)
    const playBtn = screen.getAllByLabelText('Lire')[0]
    fireEvent.click(playBtn!)
    expect(video.play).toHaveBeenCalled()
  })

  it('calls pause on video when pause button clicked while playing', () => {
    render(<Wrapper video={video} />)
    act(() => {
      // Simulate the video actually playing (paused becomes false)
      Object.defineProperty(video, 'paused', { get: () => false, configurable: true })
      video.dispatchEvent(new Event('play'))
    })
    const pauseBtn = screen.getAllByLabelText('Pause')[0]
    fireEvent.click(pauseBtn!)
    expect(video.pause).toHaveBeenCalled()
  })

  it('skips backward 10 seconds via button', () => {
    const v = createMockVideo({ currentTime: 50, duration: 3600 })
    render(<Wrapper video={v} />)
    fireEvent.click(screen.getByLabelText('Reculer de 10 secondes'))
    expect(v.currentTime).toBe(40)
  })

  it('clamps backward skip at 0', () => {
    const v = createMockVideo({ currentTime: 5, duration: 3600 })
    render(<Wrapper video={v} />)
    fireEvent.click(screen.getByLabelText('Reculer de 10 secondes'))
    expect(v.currentTime).toBe(0)
  })

  it('skips forward 10 seconds via button', () => {
    const v = createMockVideo({ currentTime: 50, duration: 3600 })
    render(<Wrapper video={v} />)
    fireEvent.click(screen.getByLabelText('Avancer de 10 secondes'))
    expect(v.currentTime).toBe(60)
  })

  it('clamps forward skip at duration', () => {
    const v = createMockVideo({ currentTime: 3595, duration: 3600 })
    render(<Wrapper video={v} />)
    fireEvent.click(screen.getByLabelText('Avancer de 10 secondes'))
    expect(v.currentTime).toBe(3600)
  })

  it('shows audio popover only when more than one audio track', () => {
    const { rerender } = render(<Wrapper video={video} audioTracks={[]} />)
    expect(screen.queryByLabelText('Piste audio')).not.toBeInTheDocument()

    const tracks: AudioTrack[] = [
      { id: 0, label: 'Français', lang: 'fr' },
      { id: 1, label: 'English', lang: 'en' },
    ]
    rerender(<Wrapper video={video} audioTracks={tracks} />)
    expect(screen.getByLabelText('Piste audio')).toBeInTheDocument()
  })

  it('audio popover opens and lists tracks', () => {
    const tracks: AudioTrack[] = [
      { id: 0, label: 'Français', lang: 'fr' },
      { id: 1, label: 'English', lang: 'en' },
    ]
    render(<Wrapper video={video} audioTracks={tracks} />)
    fireEvent.click(screen.getByLabelText('Piste audio'))
    expect(screen.getByText('Français')).toBeInTheDocument()
    expect(screen.getByText('English')).toBeInTheDocument()
  })

  it('subtitle popover always includes Désactivés option', () => {
    const tracks: SubtitleTrack[] = [{ id: 0, label: 'Français', lang: 'fr' }]
    render(<Wrapper video={video} subtitleTracks={tracks} />)
    fireEvent.click(screen.getByLabelText('Sous-titres'))
    expect(screen.getByText('Désactivés')).toBeInTheDocument()
  })

  it('onSubtitleTrack called with null when Désactivés clicked', () => {
    const onSubtitleTrack = vi.fn()
    const tracks: SubtitleTrack[] = [{ id: 0, label: 'Français', lang: 'fr' }]
    render(<Wrapper video={video} subtitleTracks={tracks} onSubtitleTrack={onSubtitleTrack} />)
    fireEvent.click(screen.getByLabelText('Sous-titres'))
    fireEvent.click(screen.getByText('Désactivés'))
    expect(onSubtitleTrack).toHaveBeenCalledWith(null)
  })

  it('CC button hidden for DIRECT MP4 with no subtitle tracks', () => {
    render(<Wrapper video={video} deliveryMode="DIRECT" containerExtension="mp4" subtitleTracks={[]} />)
    expect(screen.queryByLabelText('Sous-titres')).not.toBeInTheDocument()
  })

  it('CC button shown for DIRECT MKV with no subtitle tracks', () => {
    render(<Wrapper video={video} deliveryMode="DIRECT" containerExtension="mkv" subtitleTracks={[]} />)
    expect(screen.getByLabelText('Sous-titres')).toBeInTheDocument()
  })

  it('CC button shown when subtitle tracks exist regardless of container', () => {
    const tracks: SubtitleTrack[] = [{ id: 0, label: 'Français', lang: 'fr' }]
    render(<Wrapper video={video} deliveryMode="DIRECT" containerExtension="mp4" subtitleTracks={tracks} />)
    expect(screen.getByLabelText('Sous-titres')).toBeInTheDocument()
  })

  it('speed selector updates playbackRate on selection', () => {
    render(<Wrapper video={video} />)
    fireEvent.click(screen.getByLabelText(/Vitesse/))
    fireEvent.click(screen.getByText('1.5×'))
    expect(video.playbackRate).toBe(1.5)
  })

  it('PiP button absent when document.pictureInPictureEnabled is false', () => {
    Object.defineProperty(document, 'pictureInPictureEnabled', {
      get: () => false,
      configurable: true,
    })
    render(<Wrapper video={video} />)
    expect(screen.queryByLabelText(/image dans l'image/i)).not.toBeInTheDocument()
  })

  it('shows marker button within marker range', () => {
    const markers: Marker[] = [{ type: 'intro', startSeconds: 0, endSeconds: 60 }]
    const v = createMockVideo({ currentTime: 30, duration: 3600 })
    render(<Wrapper video={v} markers={markers} />)
    // Simulate timeupdate to update currentTime state
    act(() => { v.dispatchEvent(new Event('timeupdate')) })
    expect(screen.getByText("Passer l'intro")).toBeInTheDocument()
  })

  it('does not show marker button outside marker range', () => {
    const markers: Marker[] = [{ type: 'intro', startSeconds: 0, endSeconds: 60 }]
    const v = createMockVideo({ currentTime: 90, duration: 3600 })
    render(<Wrapper video={v} markers={markers} />)
    act(() => { v.dispatchEvent(new Event('timeupdate')) })
    expect(screen.queryByText("Passer l'intro")).not.toBeInTheDocument()
  })

  it('shows episode label in top bar when provided', () => {
    render(<Wrapper video={video} episodeLabel="E01 · Titre" />)
    expect(screen.getByText('E01 · Titre')).toBeInTheDocument()
  })

  it('shows next episode button when nextEpisode provided', () => {
    const ep: EpisodeResponse = { id: 'ep-2', title: 'Ep 2', episodeNumber: 2, synopsis: null, durationMinutes: null, airDate: null, availabilityCount: 1, availabilityStatus: 'AVAILABLE', selectedVariantId: null, variants: [], watchState: null }
    render(<Wrapper video={video} nextEpisode={ep} />)
    expect(screen.getAllByText(/Épisode suivant/)[0]).toBeInTheDocument()
  })

  it('calls onNextEpisode when next episode button clicked', () => {
    const onNextEpisode = vi.fn()
    const ep: EpisodeResponse = { id: 'ep-2', title: 'Ep 2', episodeNumber: 2, synopsis: null, durationMinutes: null, airDate: null, availabilityCount: 1, availabilityStatus: 'AVAILABLE', selectedVariantId: null, variants: [], watchState: null }
    render(<Wrapper video={video} nextEpisode={ep} onNextEpisode={onNextEpisode} />)
    fireEvent.click(screen.getAllByText(/Épisode suivant/)[0])
    expect(onNextEpisode).toHaveBeenCalled()
  })
})

// Controls visibility — interaction and race-condition fixes
describe('PlayerControls controls visibility', () => {
  let video: HTMLVideoElement

  beforeEach(() => {
    video = createMockVideo({ paused: false })
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('pointer move on wrapper restores controls after auto-hide', () => {
    const { container } = render(<Wrapper video={video} />)
    act(() => { video.dispatchEvent(new Event('play')) })
    // Advance past hide timer — controls should auto-hide
    act(() => { vi.advanceTimersByTime(3001) })
    const overlay = screen.getByTestId('controls-overlay')
    expect(overlay.className).toContain('opacity-0')
    // Pointer move on the outer wrapper div
    act(() => { fireEvent.pointerMove(container.firstChild as Element) })
    expect(overlay.className).toContain('opacity-100')
  })

  it('pause keeps controls visible after hide timer would have fired', () => {
    render(<Wrapper video={video} />)
    act(() => { video.dispatchEvent(new Event('play')) })
    // Pause before timer fires
    act(() => { video.dispatchEvent(new Event('pause')) })
    act(() => { vi.advanceTimersByTime(3001) })
    expect(screen.getByTestId('controls-overlay').className).toContain('opacity-100')
  })

  it('fullscreen transition shows controls even when previously hidden', () => {
    render(<Wrapper video={video} />)
    act(() => { video.dispatchEvent(new Event('play')) })
    act(() => { vi.advanceTimersByTime(3001) })
    expect(screen.getByTestId('controls-overlay').className).toContain('opacity-0')
    // Fullscreen change event
    act(() => { document.dispatchEvent(new Event('fullscreenchange')) })
    expect(screen.getByTestId('controls-overlay').className).toContain('opacity-100')
  })

  it('source change resets scrubbing state so hide timer works on restart', () => {
    const { unmount } = render(<Wrapper video={video} />)
    act(() => { video.dispatchEvent(new Event('play')) })
    // Begin scrubbing on seek bar
    fireEvent.pointerDown(screen.getByLabelText('Position de lecture'))
    // Quality switch: unmount triggers cleanup which resets scrubbingRef and clears timer
    act(() => { unmount() })
    // Remount simulating new source
    render(<Wrapper video={video} />)
    act(() => { video.dispatchEvent(new Event('play')) })
    // Auto-hide should work normally (scrubbingRef is false)
    act(() => { vi.advanceTimersByTime(3001) })
    expect(screen.getByTestId('controls-overlay').className).toContain('opacity-0')
  })
})

// Keyboard shortcuts — note: these test the usePlayerKeyboard hook indirectly
describe('PlayerControls keyboard shortcuts', () => {
  let video: HTMLVideoElement

  beforeEach(() => {
    video = createMockVideo({ paused: true })
    vi.clearAllMocks()
  })

  it('Space key triggers play when paused', () => {
    render(<Wrapper video={video} />)
    fireEvent.keyDown(document, { key: ' ' })
    expect(video.play).toHaveBeenCalled()
  })

  it('K key triggers play when paused', () => {
    render(<Wrapper video={video} />)
    fireEvent.keyDown(document, { key: 'k' })
    expect(video.play).toHaveBeenCalled()
  })

  it('ArrowLeft key seeks backward 10 seconds', () => {
    const v = createMockVideo({ currentTime: 50, duration: 3600 })
    render(<Wrapper video={v} />)
    fireEvent.keyDown(document, { key: 'ArrowLeft' })
    expect(v.currentTime).toBe(40)
  })

  it('ArrowRight key seeks forward 10 seconds', () => {
    const v = createMockVideo({ currentTime: 50, duration: 3600 })
    render(<Wrapper video={v} />)
    fireEvent.keyDown(document, { key: 'ArrowRight' })
    expect(v.currentTime).toBe(60)
  })

  it('M key toggles mute', () => {
    render(<Wrapper video={video} />)
    fireEvent.keyDown(document, { key: 'M' })
    expect(video.muted).toBe(true)
  })

  it('keyboard shortcuts do not fire when typing in an input', () => {
    render(
      <>
        <input data-testid="txt" />
        <Wrapper video={video} />
      </>,
    )
    const input = screen.getByTestId('txt')
    input.focus()
    fireEvent.keyDown(input, { key: ' ', target: input })
    expect(video.play).not.toHaveBeenCalled()
  })
})
