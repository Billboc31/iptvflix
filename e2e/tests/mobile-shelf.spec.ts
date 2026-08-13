import { test, expect } from '@playwright/test'

test.describe('Mobile shelf browsing', () => {
  test.skip(({ isMobile }) => !isMobile, 'Mobile-only tests')

  test('Home page renders at least one shelf row', async ({ page }) => {
    await page.goto('/')
    const shelfSection = page.locator('section').first()
    await expect(shelfSection).toBeVisible()
  })

  test('shelf scroll container overflows horizontally (scrollWidth > clientWidth)', async ({ page }) => {
    await page.goto('/')
    // Wait for shelves to load
    await page.waitForSelector('section .overflow-x-auto', { timeout: 10_000 })

    const overflows = await page.evaluate(() => {
      const containers = document.querySelectorAll<HTMLElement>('.overflow-x-auto')
      return Array.from(containers).some((el) => el.scrollWidth > el.clientWidth)
    })
    expect(overflows).toBe(true)
  })

  test('arrow navigation buttons are not visible on mobile', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('section', { timeout: 10_000 })

    const leftArrow = page.getByLabel('Défiler à gauche').first()
    const rightArrow = page.getByLabel('Défiler à droite').first()
    await expect(leftArrow).toBeHidden()
    await expect(rightArrow).toBeHidden()
  })

  test('swiping a shelf does not trigger a video preview overlay', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('.overflow-x-auto', { timeout: 10_000 })

    const scrollContainer = page.locator('.overflow-x-auto').first()
    const box = await scrollContainer.boundingBox()
    if (!box) return

    // Simulate a horizontal swipe gesture
    await page.touchscreen.tap(box.x + box.width * 0.7, box.y + box.height / 2)
    await page.touchscreen.tap(box.x + box.width * 0.3, box.y + box.height / 2)

    // Wait briefly to see if a preview video appears
    await page.waitForTimeout(500)
    const video = page.locator('video')
    await expect(video).toHaveCount(0)
  })
})
