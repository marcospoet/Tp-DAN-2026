"use client"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import type { Transaction } from "@/lib/app-context"

interface DeleteDialogProps {
  deletingTxId: string | null
  setDeletingTxId: (id: string | null) => void
  transactions: Transaction[]
  deleteTransaction: (id: string, onError: (msg: string) => void) => void
  onError: (msg: string) => void
}

export function DeleteDialog({
  deletingTxId,
  setDeletingTxId,
  transactions,
  deleteTransaction,
  onError,
}: DeleteDialogProps) {
  const txToDelete = transactions.find(tx => tx.id === deletingTxId)

  return (
    <AlertDialog open={!!deletingTxId} onOpenChange={(open) => { if (!open) setDeletingTxId(null) }}>
      <AlertDialogContent className="bg-card border-border sm:max-w-sm">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-foreground">¿Eliminar movimiento?</AlertDialogTitle>
          <AlertDialogDescription className="text-muted-foreground">
            {txToDelete && (
              <span className="block mb-1 font-medium text-foreground/80">
                &ldquo;{txToDelete.description}&rdquo;
                {" — "}
                {txToDelete.currency === "USD"
                  ? `US$ ${txToDelete.amount.toLocaleString("es-AR")}`
                  : `$ ${txToDelete.amount.toLocaleString("es-AR")} ARS`}
              </span>
            )}
            Esta acción no se puede deshacer.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="cursor-pointer">Cancelar</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90 cursor-pointer"
            onClick={() => {
              if (deletingTxId) {
                deleteTransaction(deletingTxId, onError)
                setDeletingTxId(null)
              }
            }}
          >
            Eliminar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
