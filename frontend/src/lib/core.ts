export const appNameBase = "calkit"
export const apiUrl = String(import.meta.env.VITE_API_URL)

// Hover delay (ms) before any tooltip opens. Use this everywhere so the delay
// is consistent site-wide.
export const TOOLTIP_OPEN_DELAY = 600

const getAppName = () => {
  if (apiUrl.includes("localhost")) {
    return appNameBase + "-dev"
  }
  if (apiUrl.includes("staging")) {
    return appNameBase + "-staging"
  }
  return appNameBase
}

export const appName = getAppName()
