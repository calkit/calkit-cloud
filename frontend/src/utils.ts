import type { ApiError } from "./client"

export const emailPattern = {
  value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
  message: "Invalid email address",
}

export const namePattern = {
  value: /^[A-Za-z\s\u00C0-\u017F]{1,30}$/,
  message: "Invalid name",
}

export const passwordRules = (isRequired = true) => {
  const rules: any = {
    minLength: {
      value: 8,
      message: "Password must be at least 8 characters",
    },
  }

  if (isRequired) {
    rules.required = "Password is required"
  }

  return rules
}

export const confirmPasswordRules = (
  getValues: () => any,
  isRequired = true,
) => {
  const rules: any = {
    validate: (value: string) => {
      const password = getValues().password || getValues().new_password
      return value === password ? true : "The passwords do not match"
    },
  }

  if (isRequired) {
    rules.required = "Password confirmation is required"
  }

  return rules
}

export const handleError = (err: ApiError, showToast: any) => {
  const errDetail = (err.body as any)?.detail
  let errorMessage = errDetail || "Something went wrong."
  if (Array.isArray(errDetail) && errDetail.length > 0) {
    errorMessage = errDetail[0].msg
  }
  showToast("Error", errorMessage, "error")
}

export const pageWidthNoSidebar = "85%"

export const zenodoAuthStateParam = "4fdkjhsdrf84hfdkjhx" // TODO: Should be random

export const getZenodoAuthUrl = () => {
  const apiUrl = String(import.meta.env.VITE_API_URL)
  if (apiUrl.includes("localhost") || apiUrl.includes("staging")) {
    return "https://sandbox.zenodo.org/oauth/authorize"
  }
  return "https://zenodo.org/oauth/authorize"
}

export const getZenodoRedirectUri = () => {
  const apiUrl = String(import.meta.env.VITE_API_URL)
  if (apiUrl.includes("localhost")) {
    return "http://localhost:5173/zenodo-auth"
  }
  if (apiUrl.includes("staging")) {
    return "https://staging.calkit.io/zenodo-auth"
  }
  return "https://calkit.io/zenodo-auth"
}

export const capitalizeFirstLetter = (val: string) => {
  return val.charAt(0).toUpperCase() + val.slice(1)
}
