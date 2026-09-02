import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import api, { setReportTenantContext } from './api'

/**
 * Contract of the temporary Reports tenant target (B4).
 *
 * These tests drive the REAL request interceptor of the shared Axios instance:
 * the adapter is replaced so nothing leaves the process, and every assertion
 * reads the config that the interceptor actually produced.
 */

// The interceptor reads the session token from localStorage, which does not
// exist in the Node test environment. A stub keeps the focus on the target.
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: { getItem: () => null },
})

const TARGET = 'tenant-target'
const OTHER = 'tenant-explicit'

let lastConfig: InternalAxiosRequestConfig | undefined
const originalAdapter = api.defaults.adapter

api.defaults.adapter = async (config) => {
  lastConfig = config
  return {
    data: {}, status: 200, statusText: 'OK', headers: {}, config,
  } as AxiosResponse
}

/** Sends the request and returns the params the interceptor produced. */
async function paramsOf(
  method: 'get' | 'post' | 'put',
  url: string,
  config?: { params?: Record<string, unknown> },
): Promise<Record<string, unknown>> {
  lastConfig = undefined
  if (method === 'get') await api.get(url, config)
  else if (method === 'post') await api.post(url, {}, config)
  else await api.put(url, {}, config)
  // Re-widened on purpose: the adapter assigns it inside a closure, which
  // control-flow analysis cannot see after the reset above.
  const seen = lastConfig as InternalAxiosRequestConfig | undefined
  return (seen?.params ?? {}) as Record<string, unknown>
}

beforeEach(() => {
  setReportTenantContext(undefined)
})

afterAll(() => {
  setReportTenantContext(undefined)
  api.defaults.adapter = originalAdapter
})

describe('Reports tenant target — allowed read paths', () => {
  it('adds the temporary target to an allowed GET', async () => {
    setReportTenantContext(TARGET)
    expect((await paramsOf('get', '/reports/academic/completeness-status')).institutionId).toBe(TARGET)
  })

  it('covers every authorised segment, and only as a whole segment', async () => {
    setReportTenantContext(TARGET)
    for (const url of [
      '/reports/academic/subject-averages',
      '/academic-terms',
      '/groups',
      '/subjects',
      '/teacher-assignments',
      '/institution-config',
      '/institution-config/grading',
    ]) {
      expect((await paramsOf('get', url)).institutionId, url).toBe(TARGET)
    }
  })
})

describe('Reports tenant target — similar prefixes are not allowed paths', () => {
  it('does not add the target to /reports-legacy', async () => {
    setReportTenantContext(TARGET)
    expect((await paramsOf('get', '/reports-legacy')).institutionId).toBeUndefined()
  })

  it('does not add the target to /institution-config-extra', async () => {
    setReportTenantContext(TARGET)
    expect((await paramsOf('get', '/institution-config-extra')).institutionId).toBeUndefined()
  })

  it('does not add the target to an unrelated path', async () => {
    setReportTenantContext(TARGET)
    expect((await paramsOf('get', '/communications/inbox')).institutionId).toBeUndefined()
  })
})

describe('Reports tenant target — an explicit institutionId wins', () => {
  it('keeps the caller value instead of the temporary target', async () => {
    setReportTenantContext(TARGET)
    const params = await paramsOf('get', '/groups', { params: { institutionId: OTHER } })
    expect(params.institutionId).toBe(OTHER)
  })

  it('still fills the gap when the caller passes institutionId as undefined', async () => {
    setReportTenantContext(TARGET)
    const params = await paramsOf('get', '/subjects', { params: { areaId: 'area-1', institutionId: undefined } })
    expect(params.institutionId).toBe(TARGET)
    expect(params.areaId).toBe('area-1')
  })
})

describe('Reports tenant target — writes never receive it', () => {
  it('does not add the target to a POST on an allowed path', async () => {
    setReportTenantContext(TARGET)
    expect((await paramsOf('post', '/groups')).institutionId).toBeUndefined()
  })

  it('does not add the target to a PUT on an allowed path', async () => {
    setReportTenantContext(TARGET)
    expect((await paramsOf('put', '/institution-config/grading')).institutionId).toBeUndefined()
  })
})

describe('Reports tenant target — clearing the context', () => {
  it('leaves no target behind on a later allowed GET', async () => {
    setReportTenantContext(TARGET)
    expect((await paramsOf('get', '/groups')).institutionId).toBe(TARGET)

    setReportTenantContext(undefined)
    expect((await paramsOf('get', '/groups')).institutionId).toBeUndefined()
  })
})
