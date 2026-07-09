import type { ReactNode } from 'react'

export const emoji = {
  alert: String.fromCodePoint(0x26a0, 0xfe0f),
  chart: String.fromCodePoint(0x1f4c8),
  check: String.fromCodePoint(0x2705),
  document: String.fromCodePoint(0x1f9fe),
  folder: String.fromCodePoint(0x1f4c1),
  home: String.fromCodePoint(0x1f4ca),
  money: String.fromCodePoint(0x1f4b8),
  refresh: String.fromCodePoint(0x1f504),
  search: String.fromCodePoint(0x1f50d),
  settings: String.fromCodePoint(0x2699, 0xfe0f),
  trend: String.fromCodePoint(0x1f4c9),
} as const

export function EmojiIcon({ children }: { children: ReactNode }) {
  return (
    <span aria-hidden="true" className="inline-block leading-none">
      {children}
    </span>
  )
}
