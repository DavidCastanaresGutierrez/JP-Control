import { useCallback, useState } from 'react'
import { emoji } from '../lib/emoji'
import { EmojiIcon } from '../lib/EmojiIcon'

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

export function Toasts({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="fixed inset-x-4 bottom-4 z-50 space-y-2 sm:inset-x-auto sm:right-4 sm:max-w-md">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`rounded-[14px] px-4 py-2.5 text-sm font-medium shadow-hover ${
            t.kind === 'ok'
              ? 'bg-success text-white'
              : t.kind === 'warn'
                ? 'bg-warning text-primary-950'
                : 'bg-danger text-white'
          }`}
        >
          <span className="mr-1.5 align-[-1px]">
            <EmojiIcon>{t.kind === 'ok' ? emoji.check : emoji.alert}</EmojiIcon>
          </span>
          {t.text}
        </div>
      ))}
    </div>
  )
}
