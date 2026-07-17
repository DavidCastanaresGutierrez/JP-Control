import { useCallback, useState } from 'react'

export type ToastKind = 'ok' | 'error' | 'warn'

export interface Toast {
  id: number
  kind: ToastKind
  text: string
}

const TOAST_MS = 6000

let toastId = 0

/** Sistema de avisos flotantes de la app. `toast` es estable entre renders. */
export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([])
  const toast = useCallback((kind: ToastKind, text: string) => {
    const id = ++toastId
    setToasts((t) => [...t, { id, kind, text }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), TOAST_MS)
  }, [])
  return { toasts, toast }
}
