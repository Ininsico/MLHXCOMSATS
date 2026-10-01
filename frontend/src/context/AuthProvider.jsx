import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'
import { AuthContext } from './auth-context'

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const data = await api.me()
    const account = data?.user ?? null
    setUser(account)
    return account
  }, [])

  useEffect(() => {
    let cancelled = false

    api
      .me()
      .then((data) => {
        if (!cancelled) setUser(data?.user ?? null)
      })
      .catch(() => {
        if (!cancelled) setUser(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const signin = useCallback(async (credentials) => {
    const data = await api.signin(credentials)
    setUser(data?.user ?? null)
    return data?.user
  }, [])

  const signup = useCallback(async (input) => {
    const data = await api.signup(input)
    setUser(data?.user ?? null)
    return data?.user
  }, [])

  const verifyOtp = useCallback(async (input) => {
    const data = await api.otp.verify(input)
    setUser(data?.user ?? null)
    return data?.user
  }, [])

  const demoLogin = useCallback(async (role) => {
    const data = await api.demoLogin(role)
    setUser(data?.user ?? null)
    return data?.user
  }, [])

  const resetPassword = useCallback(async (input) => {
    const data = await api.password.reset(input)
    setUser(data?.user ?? null)
    return data?.user
  }, [])

  const applyHospital = useCallback(async (input) => {
    const data = await api.hospitals.apply(input)
    setUser(data?.user ?? null)
    return data
  }, [])

  const requestEmailVerification = useCallback(() => api.verify.request(), [])

  const updateProfile = useCallback(async (input) => {
    const data = await api.updateProfile(input)
    setUser(data?.user ?? null)
    return data?.user
  }, [])

  const changePassword = useCallback((input) => api.changePassword(input), [])

  const confirmEmailVerification = useCallback(async (code) => {
    const data = await api.verify.confirm(code)
    setUser(data?.user ?? null)
    return data?.user
  }, [])

  const signout = useCallback(async () => {
    try {
      await api.signout()
    } finally {
      setUser(null)
    }
  }, [])

  const value = useMemo(
    () => ({
      user,
      loading,
      refresh,
      signin,
      signup,
      verifyOtp,
      demoLogin,
      resetPassword,
      applyHospital,
      requestEmailVerification,
      confirmEmailVerification,
      updateProfile,
      changePassword,
      signout,
    }),
    [
      user,
      loading,
      refresh,
      signin,
      signup,
      verifyOtp,
      demoLogin,
      resetPassword,
      applyHospital,
      requestEmailVerification,
      confirmEmailVerification,
      updateProfile,
      changePassword,
      signout,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
