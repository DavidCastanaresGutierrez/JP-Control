import { useRef, useState } from 'react'

export function UploadZone({
  label,
  hint,
  onFiles,
  compact = false,
}: {
  label: string
  hint?: string
  onFiles: (files: File[]) => void
  compact?: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setOver(false)
        onFiles([...e.dataTransfer.files])
      }}
      onClick={() => inputRef.current?.click()}
      className={`cursor-pointer rounded-lg border-2 border-dashed transition-colors text-center
        ${compact ? 'p-4' : 'p-7'}
        ${over ? 'border-accent-500 bg-accent-300/20' : 'border-line-strong bg-surface hover:border-accent-500 hover:bg-surface-muted'}`}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) onFiles([...e.target.files])
          e.target.value = ''
        }}
      />
      <div className={`font-bold text-ink ${compact ? 'text-sm' : 'text-base'}`}>
        <span className="mr-2 text-accent-500">+</span>
        {label}
      </div>
      {hint && <div className="text-xs leading-relaxed text-ink-soft mt-1.5 max-w-3xl mx-auto">{hint}</div>}
    </div>
  )
}
