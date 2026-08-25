import { test, expect } from '@playwright/test'

const LIVE_TV_BASE = process.env.LIVE_TV_BASE_URL ?? 'http://localhost:5174'
const API_BASE = process.env.API_BASE_URL ?? 'http://localhost:3000'

async function resetDb(request: Parameters<Parameters<typeof test>[1]>[0]['request']) {
  await request.delete(`${API_BASE}/test/reset`)
}

test.describe('Live TV smoke', () => {
  test.beforeEach(async ({ request }) => {
    await resetDb(request)
  })

  test('GET /health returns HTTP 200', async ({ request }) => {
    const res = await request.get(`${LIVE_TV_BASE}/health`)
    expect(res.status()).toBe(200)
  })

  test('unauthenticated / redirects to /login', async ({ page }) => {
    await page.goto(LIVE_TV_BASE)
    await page.waitForURL(`${LIVE_TV_BASE}/login`)
    await expect(page).toHaveURL(/\/login/)
  })

  test('login form authenticates and navigates to profile chooser', async ({ page }) => {
    await page.goto(`${LIVE_TV_BASE}/login`)
    await page.getByLabel('Identifiant').fill('admin')
    await page.getByLabel('Mot de passe').fill('admin')
    await page.getByRole('button', { name: 'Se connecter' }).click()
    await page.waitForURL(`${LIVE_TV_BASE}/profiles/choose`)
    await expect(page).toHaveURL(/\/profiles\/choose/)
  })

  test('after profile selection, sidebar renders all 5 nav items', async ({ page }) => {
    await page.goto(`${LIVE_TV_BASE}/login`)
    await page.getByLabel('Identifiant').fill('admin')
    await page.getByLabel('Mot de passe').fill('admin')
    await page.getByRole('button', { name: 'Se connecter' }).click()
    await page.waitForURL(`${LIVE_TV_BASE}/profiles/choose`)

    // Select first available profile
    const firstProfile = page.locator('button[aria-label]').first()
    await firstProfile.click()
    await page.waitForURL(`${LIVE_TV_BASE}/`)

    const nav = page.getByRole('navigation', { name: 'Navigation Live TV' })
    await expect(nav.getByRole('link', { name: 'Accueil TV' })).toBeVisible()
    await expect(nav.getByRole('link', { name: 'Favoris' })).toBeVisible()
    await expect(nav.getByRole('link', { name: 'Récemment regardées' })).toBeVisible()
    await expect(nav.getByRole('link', { name: 'Guide TV' })).toBeVisible()
    await expect(nav.getByRole('link', { name: 'Toutes les chaînes' })).toBeVisible()
  })

  test('VOD/TV toggle is visible; TV tab is active', async ({ page }) => {
    await page.goto(`${LIVE_TV_BASE}/login`)
    await page.getByLabel('Identifiant').fill('admin')
    await page.getByLabel('Mot de passe').fill('admin')
    await page.getByRole('button', { name: 'Se connecter' }).click()
    await page.waitForURL(`${LIVE_TV_BASE}/profiles/choose`)

    const firstProfile = page.locator('button[aria-label]').first()
    await firstProfile.click()
    await page.waitForURL(`${LIVE_TV_BASE}/`)

    const toggle = page.getByRole('tablist', { name: 'Mode de visionnage' })
    await expect(toggle).toBeVisible()
    const tvTab = toggle.getByRole('tab', { name: 'TV' })
    await expect(tvTab).toBeVisible()
    await expect(tvTab).toHaveAttribute('aria-selected', 'true')
  })

  test('clicking Toutes les chaînes navigates to /channels with grid or empty-state', async ({ page }) => {
    await page.goto(`${LIVE_TV_BASE}/login`)
    await page.getByLabel('Identifiant').fill('admin')
    await page.getByLabel('Mot de passe').fill('admin')
    await page.getByRole('button', { name: 'Se connecter' }).click()
    await page.waitForURL(`${LIVE_TV_BASE}/profiles/choose`)

    const firstProfile = page.locator('button[aria-label]').first()
    await firstProfile.click()
    await page.waitForURL(`${LIVE_TV_BASE}/`)

    await page.getByRole('link', { name: 'Toutes les chaînes' }).click()
    await expect(page).toHaveURL(/\/channels/)
    await expect(page.getByRole('heading', { name: 'Toutes les chaînes' })).toBeVisible()
  })
})
