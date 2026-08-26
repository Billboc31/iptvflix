import { test, expect } from '@playwright/test'

const LIVE_TV_BASE = process.env.LIVE_TV_BASE_URL ?? 'http://localhost:5174'
const API_BASE = process.env.API_BASE_URL ?? 'http://localhost:3000'

async function loginAndSelectProfile(
  page: Parameters<Parameters<typeof test>[1]>[0]['page'],
  request: Parameters<Parameters<typeof test>[1]>[0]['request'],
) {
  await request.delete(`${API_BASE}/test/reset`)
  await page.goto(`${LIVE_TV_BASE}/login`)
  await page.getByLabel('Identifiant').fill('admin')
  await page.getByLabel('Mot de passe').fill('admin')
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await page.waitForURL(`${LIVE_TV_BASE}/profiles/choose`)
  await page.locator('button[aria-label]').first().click()
  await page.waitForURL(`${LIVE_TV_BASE}/`)
}

test.describe('Live TV bottom nav', () => {
  test('five tab labels visible on 375 px mobile viewport', async ({ page, request }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await loginAndSelectProfile(page, request)

    const nav = page.getByRole('navigation', { name: 'Navigation Live TV' })
    await expect(nav.getByRole('link', { name: 'Accueil TV' })).toBeVisible()
    await expect(nav.getByRole('link', { name: 'Favoris' })).toBeVisible()
    await expect(nav.getByRole('link', { name: 'Guide TV' })).toBeVisible()
    await expect(nav.getByRole('link', { name: 'Chaînes' })).toBeVisible()
    await expect(nav.getByRole('link', { name: 'Recherche' })).toBeVisible()
  })

  test('Accueil TV tab is active on /', async ({ page, request }) => {
    await loginAndSelectProfile(page, request)

    const nav = page.getByRole('navigation', { name: 'Navigation Live TV' })
    const homeLink = nav.getByRole('link', { name: 'Accueil TV' })
    await expect(homeLink).toHaveClass(/text-\[#f97316\]/)
  })

  test('clicking Chaînes tab navigates to /channels', async ({ page, request }) => {
    await loginAndSelectProfile(page, request)

    await page.getByRole('link', { name: 'Chaînes' }).click()
    await expect(page).toHaveURL(/\/channels/)
  })

  test('clicking Guide TV tab navigates to /guide', async ({ page, request }) => {
    await loginAndSelectProfile(page, request)

    await page.getByRole('link', { name: 'Guide TV' }).click()
    await expect(page).toHaveURL(/\/guide/)
  })

  test('clicking Recherche tab navigates to /search', async ({ page, request }) => {
    await loginAndSelectProfile(page, request)

    await page.getByRole('link', { name: 'Recherche' }).click()
    await expect(page).toHaveURL(/\/search/)
    await expect(page.getByRole('heading', { name: 'Recherche' })).toBeVisible()
  })

  test('clicking Favoris tab navigates to /favorites', async ({ page, request }) => {
    await loginAndSelectProfile(page, request)

    await page.getByRole('link', { name: 'Favoris' }).click()
    await expect(page).toHaveURL(/\/favorites/)
  })

  test('bottom nav is fixed at viewport bottom on mobile', async ({ page, request }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await loginAndSelectProfile(page, request)

    const nav = page.getByRole('navigation', { name: 'Navigation Live TV' })
    await expect(nav).toBeVisible()

    const navBox = await nav.boundingBox()
    const viewport = page.viewportSize()!
    expect(navBox).not.toBeNull()
    // Nav bottom edge should be at or very close to the viewport bottom
    expect(navBox!.y + navBox!.height).toBeGreaterThanOrEqual(viewport.height - 16)
  })

  test('channel list content is not obscured by nav bar on mobile', async ({ page, request }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await loginAndSelectProfile(page, request)

    await page.getByRole('link', { name: 'Chaînes' }).click()
    await expect(page).toHaveURL(/\/channels/)

    const nav = page.getByRole('navigation', { name: 'Navigation Live TV' })
    const navBox = await nav.boundingBox()

    const playButtons = page.locator('[aria-label^="Regarder"]')
    const count = await playButtons.count()
    if (count > 0) {
      await playButtons.last().scrollIntoViewIfNeeded()
      const lastCardBox = await playButtons.last().boundingBox()
      if (lastCardBox && navBox) {
        // After scrolling the last card into view, it should not overlap the nav bar
        expect(lastCardBox.y + lastCardBox.height).toBeLessThanOrEqual(navBox.y + 4)
      }
    }
  })
})
