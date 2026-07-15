export const CHART_GRID = '#E2ECE9'
export const CHART_AXIS = { fontSize: 12, fill: '#8A9A9E' }
export const TOOLTIP_STYLE = { borderRadius: 12, border: '1px solid #DDE7E4', fontSize: 12 }
export const PIE_COLORS = ['#7CE7C8', '#143A45', '#3A8DFF', '#F2B84B', '#E05A47', '#1B4A55', '#5C6F75', '#9AF2D6']

export const ESTADO_COLOR: Record<string, string> = {
  ok: 'bg-success/10 text-success',
  baja: 'bg-warning/15 text-[#8A5A00]',
  sobre: 'bg-danger/10 text-danger',
  'sin-datos': 'bg-surface-muted text-ink-muted',
}

export const ESTADO_LABEL: Record<string, string> = {
  ok: 'Ocupación correcta',
  baja: 'Baja ocupación',
  sobre: 'Sobreocupación',
  'sin-datos': 'Sin datos',
}

export function normalizarBusqueda(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

export function truncarEtiqueta(value: string, max = 26): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value
}
