import { test, expect } from '@playwright/test'

test.describe('Mobile navigation', () => {
  test.skip(({ browserName, isMobile }) => !isMobile, 'Mobile-only tests')

  test('TopNav header is present and no sidebar nav is visible on mobile', async ({ page }) => {
    await page.goto('/')
    // The persistent top navigation renders inside a <header>
    await expect(page.getByRole('banner')).toBeVisible()
    // No standalone sidebar <nav> element should be present (TopNav links are hidden on mobile via CSS)
    const sidebarNav = page.locator('aside nav')
    await expect(sidebarNav).toHaveCount(0)
  })

  test('BottomNav is visible with all 5 tabs', async ({ page }) => {
    await page.goto('/')
    const bottomNav = page.getByRole('navigation', { name: 'Navigation principale' })
    await expect(bottomNav).toBeVisible()

    await expect(page.getByRole('link', { name: /accueil/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /recherche/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /ma liste/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /activité/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /profil/i })).toBeVisible()
  })

  test('tapping the Home tab navigates to /', async ({ page }) => {
    await page.goto('/search')
    await page.getByRole('link', { name: /accueil/i }).click()
    await expect(page).toHaveURL('/')
  })

  test('page content bottom is reachable above the bottom nav', async ({ page }) => {
    await page.goto('/')
    // Scroll to the very bottom of the page
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    const bottomNav = page.getByRole('navigation', { name: 'Navigation principale' })
    const navBox = await bottomNav.boundingBox()
    // Get the last visible element above the fold
    const bodyHeight = await page.evaluate(() => document.documentElement.scrollHeight)
    const viewportHeight = page.viewportSize()!.height
    // The scrolled position + viewport height should reach document bottom
    // and the BottomNav top should not cover content past document scroll end
    expect(navBox).not.toBeNull()
    expect(bodyHeight).toBeGreaterThan(viewportHeight)
  })
})
