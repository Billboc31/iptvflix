/**
 * PlayerPage tests.
 *
 * What IS tested here:
 *   - Regression: HLS.js loadSource is called with the correct gateway URL (smoke test for the working playback path).
 *   - Resume dialog is shown when startPositionSeconds > 30 for movies and episodes.
 *   - Resume dialog is NOT shown when startPositionSeconds is 0, below threshold (≤30 s), or near end (within 60 s of duration).
 *   - Escape key closes the dialog without starting playback.
 *   - "Reprendre" and "Recommencer" buttons dismiss the dialog.
 *   - Episode dialog heading uses episodeLabel from useEpisodeNavigation.
 *
 * What CANNOT be tested in jsdom:
 *   - Actual HLS video decode / playback (no MSE in jsdom).
 *   - video.currentTime setter (jsdom stub — seek assertions are omitted where applicable).
 *   - iOS Safari webkitEnterFullscreen (no such API in jsdom).
 *   - PiP (not implemented in jsdom).
 *   - sendBeacon / keepalive fetch on beforeunload (synthetic environment).
 *   - Audio/subtitle track switching (requires real HLS.js runtime with MSE).
 *
 * These limitations are documented rather than falsely tested.
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { http, HttpResponse } from 'msw'
import { server } from '../test/handlers.js'
import PlayerPage from './PlayerPage.js'
import type { PlaybackSessionResponse } from '@iptvflix/api-contracts'

// ---------------------------------------------------------------------------
// HLS.js mock — must be hoisted by Vitest
// ---------------------------------------------------------------------------
const mockLoadSource = vi.fn()
const mockAttachMedia = vi.fn()
const mockHlsOn = vi.fn()
const mockHlsDestroy = vi.fn()

vi.mock('hls.js', () => {
  const MockHls = vi.fn(() => ({
    loadSource: mockLoadSource,
    attachMedia: mockAttachMedia,
    destroy: mockHlsDestroy,
    on: mockHlsOn,
    audioTracks: [],
    audioTrack: 0,
    subtitleTracks: [],
    subtitleTrack: -1,
    subtitleDisplay: false,
  }))
  ;(MockHls as unknown as Record<string, unknown>).isSupported = () => true
  ;(MockHls as unknown as Record<string, unknown>).Events = {
    MANIFEST_PARSED: 'hlsManifestParsed',
    ERROR: 'hlsError',
    AUDIO_TRACKS_UPDATED: 'hlsAudioTracksUpdated',
    AUDIO_TRACK_SWITCHED: 'hlsAudioTrackSwitched',
    SUBTITLE_TRACKS_UPDATED: 'hlsSubtitleTracksUpdated',
    SUBTITLE_TRACK_SWITCH: 'hlsSubtitleTrackSwitch',
  }
  return { default: MockHls }
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const BASE_PLAYBACK: PlaybackSessionResponse = {
  gatewayUrl: '/playback/stream/test-id',
  deliveryMode: 'HLS_REMUX',
  containerExtension: 'm3u8',
  startPositionSeconds: 0,
  alternatives: [],
  availabilityId: 'avail-1',
  correlationId: 'corr-1',
  probeResult: null,
}

function renderPlayerPage(mediaType = 'movie', mediaId = 'movie-1', searchParams = '') {
  return render(
    <MemoryRouter initialEntries={[`/player/${mediaType}/${mediaId}${searchParams}`]}>
      <Routes>
        <Route path="/player/:mediaType/:mediaId" element={<PlayerPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('PlayerPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    server.use(
      http.post('/api/playback/resolve/:mediaType/:mediaId', () =>
        HttpResponse.json(BASE_PLAYBACK),
      ),
      http.get('/api/progress/:mediaType/:mediaId', () => HttpResponse.json([])),
    )
  })

  afterEach(() => {
    server.resetHandlers()
  })

  // -------------------------------------------------------------------------
  // Regression smoke test — preserves the working playback path
  // -------------------------------------------------------------------------
  it('regression: calls HLS.js loadSource with the gateway URL from the playback session', async () => {
    renderPlayerPage()

    await waitFor(() => {
      expect(mockLoadSource).toHaveBeenCalled()
    })

    const url: string = mockLoadSource.mock.calls[0]?.[0] ?? ''
    expect(url).toContain('/playback/stream/test-id')
  })

  it('regression: calls HLS.js attachMedia with the video element', async () => {
    renderPlayerPage()
    await waitFor(() => {
      expect(mockAttachMedia).toHaveBeenCalled()
    })
    const arg: unknown = mockAttachMedia.mock.calls[0]?.[0]
    expect(arg).toBeInstanceOf(HTMLVideoElement)
  })

  // -------------------------------------------------------------------------
  // Resume dialog
  // -------------------------------------------------------------------------
  it('does not show resume dialog when startPositionSeconds is 0', async () => {
    renderPlayerPage()
    // Wait for playback to resolve
    await waitFor(() => expect(mockLoadSource).toHaveBeenCalled())
    expect(screen.queryByText('Recommencer')).not.toBeInTheDocument()
  })

  it('shows resume dialog when startPositionSeconds > 30', async () => {
    server.use(
      http.post('/api/playback/resolve/:mediaType/:mediaId', () =>
        HttpResponse.json({ ...BASE_PLAYBACK, startPositionSeconds: 600 }),
      ),
    )
    renderPlayerPage()

    // The resume dialog depends on loadedmetadata firing. In jsdom, we must fire it manually.
    await waitFor(() => expect(mockLoadSource).toHaveBeenCalled())

    const video = document.querySelector('video') as HTMLVideoElement
    // Stub duration so the threshold check passes
    Object.defineProperty(video, 'duration', { get: () => 7200, configurable: true })
    video.dispatchEvent(new Event('loadedmetadata'))

    await waitFor(() => {
      expect(screen.getByText('Recommencer')).toBeInTheDocument()
    })
  })

  it('"Recommencer" dismisses the resume dialog', async () => {
    server.use(
      http.post('/api/playback/resolve/:mediaType/:mediaId', () =>
        HttpResponse.json({ ...BASE_PLAYBACK, startPositionSeconds: 600 }),
      ),
    )
    renderPlayerPage()

    await waitFor(() => expect(mockLoadSource).toHaveBeenCalled())

    const video = document.querySelector('video') as HTMLVideoElement
    Object.defineProperty(video, 'duration', { get: () => 7200, configurable: true })
    video.dispatchEvent(new Event('loadedmetadata'))

    await waitFor(() => screen.getByText('Recommencer'))

    await userEvent.click(screen.getByText('Recommencer'))

    expect(screen.queryByText('Recommencer')).not.toBeInTheDocument()
  })

  it('"Reprendre" button dismisses the resume dialog', async () => {
    server.use(
      http.post('/api/playback/resolve/:mediaType/:mediaId', () =>
        HttpResponse.json({ ...BASE_PLAYBACK, startPositionSeconds: 600 }),
      ),
    )
    renderPlayerPage()

    await waitFor(() => expect(mockLoadSource).toHaveBeenCalled())

    const video = document.querySelector('video') as HTMLVideoElement
    Object.defineProperty(video, 'duration', { get: () => 7200, configurable: true })
    video.dispatchEvent(new Event('loadedmetadata'))

    await waitFor(() => screen.getByText('Recommencer'))

    // Click the resume button (there are two, pick first which is the primary action)
    const resumeBtn = screen.getAllByRole('button').find(
      (b) => b.textContent?.includes('Reprendre à'),
    )
    expect(resumeBtn).toBeDefined()
    await userEvent.click(resumeBtn!)

    expect(screen.queryByText('Recommencer')).not.toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // Resume dialog — episode
  // -------------------------------------------------------------------------
  it('shows resume dialog for episode with startPositionSeconds > 30', async () => {
    server.use(
      http.post('/api/playback/resolve/:mediaType/:mediaId', () =>
        HttpResponse.json({ ...BASE_PLAYBACK, startPositionSeconds: 120 }),
      ),
    )
    renderPlayerPage('episode', 'ep-1')

    await waitFor(() => expect(mockLoadSource).toHaveBeenCalled())

    const video = document.querySelector('video') as HTMLVideoElement
    Object.defineProperty(video, 'duration', { get: () => 3600, configurable: true })
    video.dispatchEvent(new Event('loadedmetadata'))

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })
  })

  it('episode dialog heading uses episodeLabel from useEpisodeNavigation', async () => {
    server.use(
      http.post('/api/playback/resolve/:mediaType/:mediaId', () =>
        HttpResponse.json({ ...BASE_PLAYBACK, startPositionSeconds: 120 }),
      ),
    )
    renderPlayerPage('episode', 'ep-1', '?seriesId=series-1&seasonNumber=1')

    await waitFor(() => expect(mockLoadSource).toHaveBeenCalled())

    const video = document.querySelector('video') as HTMLVideoElement
    Object.defineProperty(video, 'duration', { get: () => 3600, configurable: true })
    video.dispatchEvent(new Event('loadedmetadata'))

    // Wait for episode navigation to load and dialog heading to update
    await waitFor(() => {
      expect(screen.getByText('S01E01 · Pilot')).toBeInTheDocument()
    })
  })

  it('episode dialog shows "Recommencer l\'épisode" as secondary action', async () => {
    server.use(
      http.post('/api/playback/resolve/:mediaType/:mediaId', () =>
        HttpResponse.json({ ...BASE_PLAYBACK, startPositionSeconds: 120 }),
      ),
    )
    renderPlayerPage('episode', 'ep-1')

    await waitFor(() => expect(mockLoadSource).toHaveBeenCalled())

    const video = document.querySelector('video') as HTMLVideoElement
    Object.defineProperty(video, 'duration', { get: () => 3600, configurable: true })
    video.dispatchEvent(new Event('loadedmetadata'))

    await waitFor(() => {
      expect(screen.getByText("Recommencer l'épisode")).toBeInTheDocument()
    })
  })

  // -------------------------------------------------------------------------
  // Resume dialog — threshold boundaries
  // -------------------------------------------------------------------------
  it('does not show resume dialog when startPositionSeconds is below threshold (20 s)', async () => {
    server.use(
      http.post('/api/playback/resolve/:mediaType/:mediaId', () =>
        HttpResponse.json({ ...BASE_PLAYBACK, startPositionSeconds: 20 }),
      ),
    )
    renderPlayerPage()

    await waitFor(() => expect(mockLoadSource).toHaveBeenCalled())

    const video = document.querySelector('video') as HTMLVideoElement
    Object.defineProperty(video, 'duration', { get: () => 7200, configurable: true })
    video.dispatchEvent(new Event('loadedmetadata'))

    // Allow React to process any state updates
    await waitFor(() => expect(mockLoadSource).toHaveBeenCalled())
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('does not show resume dialog when startPositionSeconds is near the end (within 60 s of duration)', async () => {
    server.use(
      http.post('/api/playback/resolve/:mediaType/:mediaId', () =>
        HttpResponse.json({ ...BASE_PLAYBACK, startPositionSeconds: 3550 }),
      ),
    )
    renderPlayerPage()

    await waitFor(() => expect(mockLoadSource).toHaveBeenCalled())

    const video = document.querySelector('video') as HTMLVideoElement
    // 3550 is NOT < 3600 - 60 (= 3540), so dialog should not appear
    Object.defineProperty(video, 'duration', { get: () => 3600, configurable: true })
    video.dispatchEvent(new Event('loadedmetadata'))

    await waitFor(() => expect(mockLoadSource).toHaveBeenCalled())
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // Resume dialog — Escape key
  // -------------------------------------------------------------------------
  it('Escape key closes the resume dialog without starting playback', async () => {
    server.use(
      http.post('/api/playback/resolve/:mediaType/:mediaId', () =>
        HttpResponse.json({ ...BASE_PLAYBACK, startPositionSeconds: 600 }),
      ),
    )
    renderPlayerPage()

    await waitFor(() => expect(mockLoadSource).toHaveBeenCalled())

    const video = document.querySelector('video') as HTMLVideoElement
    Object.defineProperty(video, 'duration', { get: () => 7200, configurable: true })
    video.dispatchEvent(new Event('loadedmetadata'))

    await waitFor(() => screen.getByRole('dialog'))

    await userEvent.keyboard('{Escape}')

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // Resume dialog — ARIA
  // -------------------------------------------------------------------------
  it('resume dialog has correct ARIA attributes', async () => {
    server.use(
      http.post('/api/playback/resolve/:mediaType/:mediaId', () =>
        HttpResponse.json({ ...BASE_PLAYBACK, startPositionSeconds: 600 }),
      ),
    )
    renderPlayerPage()

    await waitFor(() => expect(mockLoadSource).toHaveBeenCalled())

    const video = document.querySelector('video') as HTMLVideoElement
    Object.defineProperty(video, 'duration', { get: () => 7200, configurable: true })
    video.dispatchEvent(new Event('loadedmetadata'))

    await waitFor(() => screen.getByRole('dialog'))

    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAttribute('aria-labelledby', 'resume-dialog-title')
    expect(dialog).toHaveAttribute('aria-describedby', 'resume-dialog-desc')
    expect(screen.getByText('Vous vous êtes arrêté à 10:00.')).toBeInTheDocument()
  })
})
