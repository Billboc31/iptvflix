import { test, expect } from '../fixtures/index.js'

const API_BASE = process.env.API_BASE_URL ?? 'http://localhost:3000'

async function resetDb(request: Parameters<Parameters<typeof test>[1]>[0]['request']) {
  await request.delete(`${API_BASE}/test/reset`)
}

async function addSource(
  page: Parameters<Parameters<typeof test>[1]>[0]['page'],
  { name, baseUrl }: { name: string; baseUrl: string },
) {
  await page.getByRole('button', { name: '+ Ajouter une source' }).click()
  await page.getByLabel('Nom').fill(name)
  await page.getByLabel('URL de base').fill(baseUrl)
  await page.getByLabel('Identifiant').fill('testuser')
  await page.getByLabel('Mot de passe').fill('testpass')
  await page.getByRole('button', { name: 'Ajouter' }).click()
  // Wait for the dialog to close and the source card to appear
  await expect(page.getByText(name)).toBeVisible()
}

test.describe('E2E smoke — Batch 1 vertical slice', () => {
  test.beforeEach(async ({ request }) => {
    await resetDb(request)
  })

  test('empty catalog — no content before any sync', async ({ page }) => {
    await page.goto('/movies')
    await expect(page.getByRole('heading', { name: 'Disponibles' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Lire' })).not.toBeVisible()

    await page.goto('/series')
    await expect(page.getByRole('heading', { name: 'Disponibles' })).toBeVisible()
  })

  test('connection failure — auth-fail source shows error on test', async ({
    page,
    fakeServers,
  }) => {
    await page.goto('/sources')
    await addSource(page, { name: 'Auth Fail Source', baseUrl: fakeServers.authFail })

    // Click Test on the source card
    await page.getByRole('button', { name: 'Test' }).click()

    // Expect an error toast to appear
    const errorToast = page.locator('[class*="bg-red-700"]')
    await expect(errorToast).toBeVisible({ timeout: 10_000 })
  })

  test('empty catalog — sync with empty source shows empty UI', async ({ page, fakeServers }) => {
    await page.goto('/sources')
    await addSource(page, { name: 'Empty Source', baseUrl: fakeServers.empty })

    // Trigger sync
    await page.getByRole('button', { name: 'Synchroniser' }).click()
    await expect(page.getByText('Synchronisation lancée.')).toBeVisible({ timeout: 10_000 })

    // Navigate to movies — expect shelves present but no hero Play button
    await page.goto('/movies')
    await expect(page.getByRole('heading', { name: 'Disponibles' })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('button', { name: 'Lire' })).not.toBeVisible()

    // Navigate to series — expect shelves present with no playable hero
    await page.goto('/series')
    await expect(page.getByRole('heading', { name: 'Disponibles' })).toBeVisible({ timeout: 5_000 })
  })

  test('sync failure — unreachable source records a failed run', async ({ page }) => {
    await page.goto('/sources')
    // Use a port where nothing is listening
    await addSource(page, { name: 'Dead Source', baseUrl: 'http://127.0.0.1:9999' })

    await page.getByRole('button', { name: 'Synchroniser' }).click()
    // Sync will fail; we still see the submission toast
    await expect(page.getByText('Synchronisation lancée.')).toBeVisible({ timeout: 10_000 })

    // The SyncStatusBanner should show FAILED status
    await expect(page.getByText('FAILED')).toBeVisible({ timeout: 10_000 })
  })

  test('happy path — add source → test connection → sync → browse movies and series', async ({
    page,
    fakeServers,
  }) => {
    await page.goto('/sources')
    await addSource(page, { name: 'Happy Source', baseUrl: fakeServers.happy })

    // Test connection via source card button
    await page.getByRole('button', { name: 'Test' }).click()
    await expect(page.getByText('Connection successful')).toBeVisible({ timeout: 10_000 })

    // Trigger sync
    await page.getByRole('button', { name: 'Synchroniser' }).click()
    await expect(page.getByText('Synchronisation lancée.')).toBeVisible({ timeout: 10_000 })

    // Sync status should eventually show DONE
    await expect(page.getByText('DONE')).toBeVisible({ timeout: 30_000 })

    // Browse movies — expect at least one title from VOD_STREAMS fixture
    await page.goto('/movies')
    await expect(page.getByText('Test Movie Alpha')).toBeVisible({ timeout: 10_000 })

    // Browse series — expect at least one title from SERIES_LIST fixture
    await page.goto('/series')
    await expect(page.getByText('Test Series Gamma')).toBeVisible({ timeout: 10_000 })
  })
})
