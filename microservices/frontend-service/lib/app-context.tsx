"use client"

import type { ReactNode } from "react"
import { AuthProvider } from "@/lib/auth-context"
import { TransactionsProvider } from "@/lib/transactions-context"
import { SettingsProvider } from "@/lib/settings-context"

export type { View, AuthUser } from "@/lib/auth-context"
export type { Transaction, RecurringFrequency } from "@/lib/transactions-context"
export type { TimeFilter, ExchangeRateMode, ExchangeRateType, AIProvider } from "@/lib/settings-context"

export function AppProvider({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <TransactionsProvider>
        <SettingsProvider>{children}</SettingsProvider>
      </TransactionsProvider>
    </AuthProvider>
  )
}
