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
