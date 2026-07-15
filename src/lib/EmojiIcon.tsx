import type { ReactNode } from 'react'

export function EmojiIcon({ children }: { children: ReactNode }) {
  return (
    <span aria-hidden="true" className="inline-block leading-none">
      {children}
    </span>
  )
}
