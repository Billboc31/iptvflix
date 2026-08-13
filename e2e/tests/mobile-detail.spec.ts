import { test, expect } from '../fixtures/index.js'

const API_BASE = process.env.API_BASE_URL ?? 'http://localhost:3000'

test.describe('Mobile detail page', () => {
  test.skip(({ isMobile }) => !isMobile, 'Mobile-only tests')

  test.beforeEach(async ({ request, fakeServers }) => {
    // Reset and seed data so there is at least one movie to navigate to
    await request.delete(`${API_BASE}/test/reset`)

    const sourcesResp = await request.post(`${API_BASE}/sources`, {
      data: {
        name: 'Mobile Test Source',
        type: 'xtream',
        baseUrl: fakeServers.happy,
        username: 'testuser',
        password: 'testpass',
      },
    })
    const source = await sourcesResp.json() as { id: string }
    await request.post(`${API_BASE}/sources/${source.id}/sync`)

    // Wait for sync to complete (up to 20s)
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 1000))
      const status = await request.get(`${API_BASE}/sources/${source.id}`)
      const body = await status.json() as { lastSyncStatus?: string }
      if (body.lastSyncStatus === 'DONE' || body.lastSyncStatus === 'FAILED') break
    }
  })

  test('Play and Play on TV buttons are visible within the initial viewport on a movie detail page', async ({ page }) => {
    // Find the first available movie from the catalog
    await page.goto('/movies')
    const firstMovie = page.locator('[role="button"], a[href*="/movies/"]').first()
    await expect(firstMovie).toBeVisible({ timeout: 15_000 })
    await firstMovie.click()

    // Should now be on a movie detail page
    await expect(page).toHaveURL(/\/movies\//)

    const viewportHeight = page.viewportSize()!.height

    // Play button must be above the fold without scrolling
    const playButton = page.getByRole('button', { name: /lecture/i }).or(
      page.getByRole('link', { name: /lecture/i })
    )
    await expect(playButton).toBeVisible({ timeout: 5_000 })
    const box = await playButton.boundingBox()
    expect(box!.y + box!.height).toBeLessThan(viewportHeight)
  })

  test('DevicePickerModal fits within mobile viewport width', async ({ page }) => {
    await page.goto('/movies')
    const firstMovie = page.locator('[role="button"], a[href*="/movies/"]').first()
    await expect(firstMovie).toBeVisible({ timeout: 15_000 })
    await firstMovie.click()
    await expect(page).toHaveURL(/\/movies\//)

    const playOnTvBtn = page.getByRole('button', { name: /lire sur tv/i })
    if (!(await playOnTvBtn.isVisible())) {
      test.skip()
      return
    }

    await playOnTvBtn.click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()

    const dialogBox = await dialog.boundingBox()
    const viewportWidth = page.viewportSize()!.width
    expect(dialogBox!.width).toBeLessThanOrEqual(viewportWidth)
    expect(dialogBox!.x).toBeGreaterThanOrEqual(0)
    expect(dialogBox!.x + dialogBox!.width).toBeLessThanOrEqual(viewportWidth)
  })
})
