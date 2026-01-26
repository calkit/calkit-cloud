import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useNavigate, useRouter } from "@tanstack/react-router"
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

const useAuth = () => {
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()
  const router = useRouter()
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
      const redirectTo = localStorage.getItem("post_login_redirect") || "/"
      localStorage.removeItem("post_login_redirect")
      navigate({ to: redirectTo })
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
      const redirectTo = localStorage.getItem("post_login_redirect") || "/"
      localStorage.removeItem("post_login_redirect")
      navigate({ to: redirectTo })
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
    const currentHref = router.state.location.href
    localStorage.setItem("post_login_redirect", currentHref)
    navigate({
      to: "/login",
      search: (prev: any) => ({ ...prev, redirect: currentHref }),
    })
  }

  if (getUserError) {
    // Fallback: ensure we logout if an error slipped past onError
    logout()
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
