"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { PENDING_RESET_KEY } from "@/lib/auth-context"

export default function ResetPasswordPage() {
  const router = useRouter()
  useEffect(() => {
    const email = new URLSearchParams(window.location.search).get("email")
    if (email) {
      sessionStorage.setItem(PENDING_RESET_KEY, email)
    }
    router.replace("/")
  }, [router])
  return null
}
