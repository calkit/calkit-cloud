// Functionality for working with Google OAuth

export const googleAuthStateParam = "google-oauth-state" // TODO: Should be random

// Google OAuth authorization endpoint
export const getGoogleAuthUrl = () => {
  return "https://accounts.google.com/o/oauth2/v2/auth"
}

export const getGoogleRedirectUri = () => {
  const apiUrl = String(import.meta.env.VITE_API_URL)
  if (apiUrl.includes("localhost")) {
    return "http://localhost:5173/google-auth"
  }
  if (apiUrl.includes("staging")) {
    return "https://staging.calkit.io/google-auth"
  }
  return "https://calkit.io/google-auth"
}
