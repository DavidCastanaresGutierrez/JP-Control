import type { TipoActividad } from '../../types'

// Tema base de graficos compartido por toda la app
export { CHART_AXIS, CHART_COLORS, CHART_GRID, TOOLTIP_STYLE } from '../../lib/chartTheme'

/**
 * Color fijo por tipo de actividad, para que cada categoría conserve su color
 * de un mes a otro. Los tipos que facturan (facturable, innovación, soporte)
 * van en la familia de verdes; el resto en colores neutros/cálidos.
 */
export const TIPO_ACTIVIDAD_COLOR: Record<TipoActividad, string> = {
  facturable: '#7CE7C8',
  innovacion: '#1FAE7A',
  soporte: '#9AF2D6',
  formacion: '#F2B84B',
  gestion: '#143A45',
  vacaciones: '#5C6F75',
}

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

export function truncarEtiqueta(value: string, max = 26): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value
}
