import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("../client", () => ({
  LoginService: {
    refreshAccessToken: vi.fn(),
  },
}))

import { LoginService } from "../client"
import {
  clearTokens,
  getAccessToken,
  getValidAccessToken,
  storeTokens,
} from "./auth"

class LocalStorageMock {
  private store = new Map<string, string>()

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value)
  }

  removeItem(key: string): void {
    this.store.delete(key)
  }

  clear(): void {
    this.store.clear()
  }
}

const createJwt = (exp: number): string => {
  const encode = (value: object) =>
    Buffer.from(JSON.stringify(value)).toString("base64url")

  return `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ exp })}.sig`
}

describe("getValidAccessToken", () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, "localStorage", {
      value: new LocalStorageMock(),
      writable: true,
      configurable: true,
    })

    if (!globalThis.atob) {
      Object.defineProperty(globalThis, "atob", {
        value: (input: string) => Buffer.from(input, "base64").toString("utf8"),
        writable: true,
        configurable: true,
      })
    }

    clearTokens()
    vi.clearAllMocks()
  })

  it("does not refresh while requesting /login/refresh", async () => {
    const expiredAccessToken = createJwt(Math.floor(Date.now() / 1000) - 3600)
    storeTokens(expiredAccessToken, "refresh-token")

    const refreshAccessTokenMock = vi.mocked(LoginService.refreshAccessToken)
    refreshAccessTokenMock.mockResolvedValue({
      access_token: "new-access",
      refresh_token: "new-refresh",
      token_type: "bearer",
    })

    const token = await getValidAccessToken("/login/refresh")

    expect(token).toBe(expiredAccessToken)
    expect(refreshAccessTokenMock).not.toHaveBeenCalled()
  })

  it("refreshes expired token for normal API requests", async () => {
    const expiredAccessToken = createJwt(Math.floor(Date.now() / 1000) - 3600)
    storeTokens(expiredAccessToken, "refresh-token")

    const refreshAccessTokenMock = vi.mocked(LoginService.refreshAccessToken)
    refreshAccessTokenMock.mockResolvedValue({
      access_token: "new-access",
      refresh_token: "new-refresh",
      token_type: "bearer",
    })

    const token = await getValidAccessToken("/projects")

    expect(token).toBe("new-access")
    expect(refreshAccessTokenMock).toHaveBeenCalledTimes(1)
    expect(getAccessToken()).toBe("new-access")
  })
})
