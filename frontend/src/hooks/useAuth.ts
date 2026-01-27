import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import mixpanel from "mixpanel-browser"

import { AxiosError } from "axios"
import {
  type Body_login_login_access_token as AccessToken,
  type ApiError,
  LoginService,
  type UserPublic,
  type UserRegister,
  UsersService,
} from "../client"
import useCustomToast from "./useCustomToast"

const isLoggedIn = () => {
  return localStorage.getItem("access_token") !== null
}

const popPostLoginRedirect = () => {
  if (typeof window === "undefined") return null
  const target = localStorage.getItem("post_login_redirect")
  if (target && target.startsWith("/")) {
    localStorage.removeItem("post_login_redirect")
    return target
  }
  // Drop malformed/stale values
  localStorage.removeItem("post_login_redirect")
  return null
}

const useAuth = () => {
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()
  const showToast = useCustomToast()
  const queryClient = useQueryClient()
  const {
    data: user,
    isLoading,
    error: getUserError,
  } = useQuery<UserPublic | null, Error>({
    queryKey: ["currentUser"],
    queryFn: UsersService.getCurrentUser,
    enabled: isLoggedIn(),
    retry: (failureCount, error: any) => {
      const status = error?.status ?? error?.response?.status
      if (status >= 400 && status < 500) return false
      return failureCount < 3
    },
  })

  const signUpMutation = useMutation({
    mutationFn: (data: UserRegister) =>
      UsersService.registerUser({ requestBody: data }),
    onSuccess: () => {
      navigate({ to: "/login" })
      showToast(
        "Account created.",
        "Your account has been created successfully.",
        "success",
      )
    },
    onError: (err: ApiError) => {
      let errDetail = (err.body as any)?.detail
      if (err instanceof AxiosError) {
        errDetail = err.message
      }
      showToast("Something went wrong.", errDetail, "error")
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] })
    },
  })

  const login = async (data: AccessToken) => {
    const response = await LoginService.loginAccessToken({
      formData: data,
    })
    localStorage.setItem("access_token", response.access_token)
  }

  const loginMutation = useMutation({
    mutationFn: login,
    onSuccess: () => {
      const redirectTo = popPostLoginRedirect()
      const safeRedirect =
        redirectTo && redirectTo.startsWith("/") ? redirectTo : "/"
      navigate({ to: safeRedirect })
    },
    onError: (err: ApiError) => {
      let errDetail = (err.body as any)?.detail
      if (err instanceof AxiosError) {
        errDetail = err.message
      }
      if (Array.isArray(errDetail)) {
        errDetail = "Something went wrong"
      }
      setError(errDetail)
    },
  })

  const loginGithub = async (code: string) => {
    const response = await LoginService.loginWithGithub({
      code,
    })
    localStorage.setItem("access_token", response.access_token)
  }

  const loginGitHubMutation = useMutation({
    mutationFn: loginGithub,
    onSuccess: () => {
      const redirectTo = popPostLoginRedirect()
      const safeRedirect =
        redirectTo && redirectTo.startsWith("/") ? redirectTo : "/"
      navigate({ to: safeRedirect })
    },
    onError: (err: ApiError) => {
      let errDetail = (err.body as any)?.detail
      if (err instanceof AxiosError) {
        errDetail = err.message
      }
      if (Array.isArray(errDetail)) {
        errDetail = "Something went wrong"
      }
      showToast("Something went wrong.", errDetail, "error")
      setError(errDetail)
    },
  })

  const logout = () => {
    localStorage.removeItem("access_token")
    mixpanel.reset()
    localStorage.removeItem("post_login_redirect")
    if (typeof window !== "undefined") {
      window.location.replace("/")
    } else {
      navigate({ to: "/" })
    }
  }

  // Only handle auth errors when we still have a token; otherwise we can end up
  // repeatedly navigating to /login and appending redirect params on every render.
  if (getUserError && isLoggedIn()) {
    const status =
      (getUserError as any)?.status ?? (getUserError as any)?.response?.status
    const detail =
      (getUserError as any)?.body?.detail ??
      (getUserError as any)?.response?.data?.detail
    const isAuthError =
      status === 401 ||
      status === 403 ||
      detail === "Token has expired" ||
      detail === "Invalid token" ||
      detail === "Could not validate credentials"

    if (isAuthError) {
      logout()
    }
    // Do NOT logout on 404 or other non-auth errors; leave token intact
  }

  return {
    signUpMutation,
    loginMutation,
    loginGitHubMutation,
    logout,
    user,
    isLoading,
    error,
    resetError: () => setError(null),
  }
}

export { isLoggedIn }
export default useAuth
