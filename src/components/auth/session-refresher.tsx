"use client"

import { useEffect, useRef } from "react"
import { refreshSession } from "@/actions/auth-actions"

const MIN_REFRESH_INTERVAL_MS = 30 * 60 * 1000

export function SessionRefresher() {
  const lastRefreshRef = useRef(0)

  useEffect(() => {
    let disposed = false

    async function refreshIfNeeded() {
      const now = Date.now()
      if (disposed || now - lastRefreshRef.current < MIN_REFRESH_INTERVAL_MS) return
      lastRefreshRef.current = now
      try {
        await refreshSession()
      } catch {
        // Navigation and the proxy handle an expired/revoked session. Keeping
        // this silent avoids interrupting a member registration in progress.
      }
    }

    void refreshIfNeeded()
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void refreshIfNeeded()
    }
    document.addEventListener("visibilitychange", onVisibilityChange)
    return () => {
      disposed = true
      document.removeEventListener("visibilitychange", onVisibilityChange)
    }
  }, [])

  return null
}
