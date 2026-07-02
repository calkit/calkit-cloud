import { LoginService } from "../client"

export const getAccessToken = (): string | null =>
  localStorage.getItem("access_token")

export const getRefreshToken = (): string | null =>
  localStorage.getItem("refresh_token")

export const storeTokens = (
  accessToken: string,
  refreshToken?: string | null,
) => {
  localStorage.setItem("access_token", accessToken)
  if (refreshToken != null) {
    localStorage.setItem("refresh_token", refreshToken)
  } else {
    localStorage.removeItem("refresh_token")
  }
}

export const clearTokens = () => {
  localStorage.removeItem("access_token")
  localStorage.removeItem("refresh_token")
}

const shouldBypassRefreshForRequest = (requestUrl?: string): boolean => {
  if (!requestUrl) return false

  const [path] = requestUrl.split("?")
  return path === "/login/refresh"
}

const decodeBase64Url = (value: string): string => {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/")
  const padding = (4 - (base64.length % 4)) % 4
  return atob(base64 + "=".repeat(padding))
}

const getTokenExpiry = (token: string): number | null => {
  try {
    const [, payloadSegment] = token.split(".")
    if (!payloadSegment) return null
    const payload = JSON.parse(decodeBase64Url(payloadSegment))
    return typeof payload.exp === "number" ? payload.exp : null
  } catch {
    return null
  }
}

const isTokenExpiredOrExpiringSoon = (
  token: string,
  bufferSeconds = 30,
): boolean => {
  const exp = getTokenExpiry(token)
  if (exp === null) return true
  return Date.now() / 1000 + bufferSeconds >= exp
}

// In-flight refresh promise — prevents multiple concurrent refresh calls.
let refreshPromise: Promise<string | null> | null = null

/**
 * Returns a valid access token, silently refreshing if it is expired or
 * expiring within 30 seconds. Returns null if refresh fails (caller should
 * treat the session as logged out).
 */
export const getValidAccessToken = async (
  requestUrl?: string,
): Promise<string | null> => {
  const accessToken = getAccessToken()
  if (!accessToken) return null

  // Prevent recursive refresh when requesting the refresh endpoint itself.
  if (shouldBypassRefreshForRequest(requestUrl)) return accessToken

  if (!isTokenExpiredOrExpiringSoon(accessToken)) return accessToken

  // Token is expired/expiring — attempt a refresh
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const refreshToken = getRefreshToken()
        if (!refreshToken) return null
        const response = await LoginService.refreshAccessToken({
          requestBody: { refresh_token: refreshToken },
        })
        storeTokens(response.access_token, response.refresh_token)
        return response.access_token
      } catch {
        clearTokens()
        return null
      } finally {
        refreshPromise = null
      }
    })()
  }
  return refreshPromise
}

/**
 * Retrieves and removes the stored post-login redirect path from localStorage.
 * Only returns paths that start with "/" and don't contain ".." to prevent
 * open redirect and directory traversal attacks.
 */
export const popPostLoginRedirect = (): string | null => {
  if (typeof window === "undefined") return null
  const target = localStorage.getItem("post_login_redirect")
  if (target && target.startsWith("/") && !target.includes("..")) {
    localStorage.removeItem("post_login_redirect")
    return target
  }
  // Drop malformed/stale values
  localStorage.removeItem("post_login_redirect")
  return null
}

/**
 * Checks if an error indicates an authentication/authorization failure.
 */
export const isAuthenticationError = (error: any): boolean => {
  const status = error?.status ?? error?.response?.status
  const detail = error?.body?.detail ?? error?.response?.data?.detail

  return (
    status === 401 ||
    status === 403 ||
    detail === "Token has expired" ||
    detail === "Invalid token" ||
    detail === "Could not validate credentials"
  )
}
