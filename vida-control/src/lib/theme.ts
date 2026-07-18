/** Colores compartidos para las gráficas (coinciden con los acentos de index.css). */
export const COLOR = {
  eco: '#10b981',
  salud: '#3b82f6',
  habito: '#f59e0b',
  ink: '#0f172a',
  inkSoft: '#475569',
  line: '#e2e8f0',
  danger: '#ef4444',
  success: '#16a34a',
}

/** Paleta cíclica para categorías (tartas y barras apiladas). */
export const PALETA = [
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#8b5cf6',
  '#ec4899',
  '#14b8a6',
  '#ef4444',
  '#6366f1',
  '#84cc16',
  '#f97316',
  '#06b6d4',
  '#a855f7',
]

export function colorCategoria(i: number): string {
  return PALETA[i % PALETA.length]
}
