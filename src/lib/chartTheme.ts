/**
 * Tema compartido de graficos Recharts: unica fuente de verdad para rejilla,
 * ejes, tooltip y paleta cualitativa. Los colores por dominio (tipo de
 * actividad, estados de ocupacion, anomalias) viven en el theme.ts de cada
 * seccion (components/department/theme.ts, components/hours/theme.ts).
 */

export const CHART_GRID = '#E2ECE9'
export const CHART_AXIS = { fontSize: 12, fill: '#8A9A9E' }
export const TOOLTIP_STYLE = { borderRadius: 12, border: '1px solid #DDE7E4', fontSize: 12 }

/** Paleta cualitativa (hasta 10 series/sectores), derivada del sistema de diseno */
export const CHART_COLORS = [
  '#7CE7C8',
  '#143A45',
  '#3A8DFF',
  '#F2B84B',
  '#E05A47',
  '#1B4A55',
  '#5C6F75',
  '#9AF2D6',
  '#1FAE7A',
  '#8A5A00',
]
