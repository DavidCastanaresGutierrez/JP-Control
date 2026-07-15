import { CHART_AXIS, truncarEtiqueta } from './theme'

/** Etiqueta del eje X angulada que muestra el nombre completo (via <title>, tooltip nativo del navegador) al pasar el raton, cuando esta cortada. */
export function EtiquetaProyectoEje({ x, y, payload }: { x?: number; y?: number; payload?: { value: string } }) {
  const nombre = payload?.value ?? ''
  return (
    <g transform={`translate(${x},${y})`}>
      <text
        x={0}
        y={0}
        dy={10}
        textAnchor="end"
        transform="rotate(-40)"
        fontSize={11}
        fill={CHART_AXIS.fill}
      >
        <title>{nombre}</title>
        {truncarEtiqueta(nombre, 16)}
      </text>
    </g>
  )
}
