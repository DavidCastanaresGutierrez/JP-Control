// Tema base de graficos compartido por toda la app
export { CHART_AXIS, CHART_COLORS, CHART_GRID, TOOLTIP_STYLE } from '../../lib/chartTheme'

export const ANOMALIA_STYLE: Record<string, string> = {
  pico: 'bg-danger/12 text-danger ring-1 ring-danger/30',
  caida: 'bg-warning/16 text-[#8A5A00] ring-1 ring-warning/40',
  nuevo: 'bg-info/10 text-info ring-1 ring-info/30',
  hueco: 'bg-surface-muted text-ink-muted ring-1 ring-line-strong',
}

