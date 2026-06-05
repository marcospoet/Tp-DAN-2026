"use client"

const CREDENTIAL_KEY = "bb_biometric_credential_id"
const ENABLED_KEY = "bb_biometric_enabled"

export function useBiometric() {
  const isSupported =
    typeof window !== "undefined" &&
    !!window.PublicKeyCredential &&
    typeof navigator.credentials?.create === "function"

  const isEnabled = () =>
    typeof window !== "undefined" && localStorage.getItem(ENABLED_KEY) === "true"

  const isRegistered = () =>
    typeof window !== "undefined" && !!localStorage.getItem(CREDENTIAL_KEY)

  const register = async (userId: string, userName: string): Promise<boolean> => {
    try {
      const challenge = crypto.getRandomValues(new Uint8Array(32))
      const credential = await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: { name: "BudgetBuddy", id: window.location.hostname },
          user: {
            id: new TextEncoder().encode(userId),
            name: userName,
            displayName: userName,
          },
          pubKeyCredParams: [
            { alg: -7, type: "public-key" },
            { alg: -257, type: "public-key" },
          ],
          authenticatorSelection: {
            authenticatorAttachment: "platform",
            userVerification: "required",
          },
          timeout: 60000,
        },
      }) as PublicKeyCredential | null

      if (!credential) return false
      const bytes = new Uint8Array(credential.rawId)
      const b64 = btoa(String.fromCharCode(...bytes))
      localStorage.setItem(CREDENTIAL_KEY, b64)
      localStorage.setItem(ENABLED_KEY, "true")
      return true
    } catch {
      return false
    }
  }

  const authenticate = async (): Promise<boolean> => {
    const b64 = localStorage.getItem(CREDENTIAL_KEY)
    if (!b64) return false
    try {
      const credBytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0))
      const challenge = crypto.getRandomValues(new Uint8Array(32))
      const assertion = await navigator.credentials.get({
        publicKey: {
          challenge,
          allowCredentials: [{ id: credBytes, type: "public-key" }],
          userVerification: "required",
          timeout: 60000,
        },
      })
      return !!assertion
    } catch {
      return false
    }
  }

  const disable = () => {
    localStorage.removeItem(CREDENTIAL_KEY)
    localStorage.removeItem(ENABLED_KEY)
    sessionStorage.removeItem("bb_unlocked")
  }

  return { isSupported, isEnabled, isRegistered, register, authenticate, disable }
}
