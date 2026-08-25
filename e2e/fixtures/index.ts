import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test as base } from '@playwright/test'

interface FakeServers {
  happy: string
  empty: string
  authFail: string
  m3uHappy: string
  m3uAuthFail: string
  m3uEmpty: string
  m3uMalformed: string
  m3uLiveChannels: string
}

function loadServers(): FakeServers {
  const path = join(import.meta.dirname, '../.fake-servers.json')
  return JSON.parse(readFileSync(path, 'utf8')) as FakeServers
}

export const test = base.extend<{
  fakeServers: FakeServers
  apiBaseUrl: string
}>({
  fakeServers: async ({}, use) => {
    await use(loadServers())
  },
  apiBaseUrl: async ({}, use) => {
    await use(process.env.API_BASE_URL ?? 'http://localhost:3000')
  },
})

export { expect } from '@playwright/test'
