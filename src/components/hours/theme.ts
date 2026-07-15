// Paleta cualitativa para hasta 10 participantes, derivada del sistema de diseno
export const LINE_COLORS = [
  '#1FAE7A', '#143A45', '#3A8DFF', '#F2B84B', '#E05A47',
  '#7CE7C8', '#5C6F75', '#1B4A55', '#9AF2D6', '#8A5A00',
]
export const CHART_GRID = '#E2ECE9'
export const CHART_AXIS = { fontSize: 12, fill: '#8A9A9E' }
export const TOOLTIP_STYLE = { borderRadius: 12, border: '1px solid #DDE7E4', fontSize: 12 }

export const ANOMALIA_STYLE: Record<string, string> = {
  pico: 'bg-danger/12 text-danger ring-1 ring-danger/30',
  caida: 'bg-warning/16 text-[#8A5A00] ring-1 ring-warning/40',
  nuevo: 'bg-info/10 text-info ring-1 ring-info/30',
  hueco: 'bg-surface-muted text-ink-muted ring-1 ring-line-strong',
}

export function normalizarTexto(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(new RegExp('[\\u0300-\\u036f]', 'g'), '')
    .toLowerCase()
    .trim()
}
