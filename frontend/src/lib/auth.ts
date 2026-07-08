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

// The exact detail strings the backend returns for a bad/expired/deactivated
// token (all as 403s; see backend/app/api/deps.py). A logged-in user seeing one
// of these has an invalid session and should be logged out.
const TOKEN_AUTH_DETAILS = new Set([
  "Could not validate credentials",
  "Invalid token",
  "Invalid token scope",
  "Token has been deactivated",
  "Token has expired",
  "Token invalid",
])

/**
 * Checks if an error means the Calkit session itself is invalid (so the user
 * should be logged out), as opposed to an ordinary authorization denial or a
 * missing third-party token.
 *
 * The backend signals an invalid/expired session ONLY with a 403 carrying one
 * of the details above (see backend/app/api/deps.py). It does NOT use status
 * codes as the signal:
 * - 403 is also returned for plain permission denials (e.g. a GitHub-less
 *   collaborator hitting a resource they can't access).
 * - 401 is returned for MISSING third-party provider tokens (GitHub, Google,
 *   Zenodo, Overleaf) and login/refresh flows -- e.g. viewing the profile page
 *   as a GitHub-less user hits /user/github-app-installations, which 401s with
 *   "User needs to authenticate with GitHub". Those must NOT log the user out.
 * So we key strictly off the session-token detail, never the status code. A
 * genuinely dead session (expired refresh token) is handled separately by the
 * token-refresh flow, which clears tokens on failure.
 */
export const isAuthenticationError = (error: any): boolean => {
  const detail = error?.body?.detail ?? error?.response?.data?.detail

  return typeof detail === "string" && TOKEN_AUTH_DETAILS.has(detail)
}
