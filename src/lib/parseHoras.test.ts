import { describe, expect, it } from 'vitest'
import { parseHoras } from './parseHoras.ts'
import { aoaToXlsx, toSerial } from './testHelpers.ts'

describe('parseHoras: formato largo generico', () => {
  const fichero = aoaToXlsx([
    ['Empleado', 'Mes', 'Horas'],
    ['García López, María', 'mar-26', 120],
    ['García López, María', 'abr-26', 130],
    ['Pérez Ruiz, Antonio', '2026-03', 80],
    ['Pérez Ruiz, Antonio', '04/2026', 85],
    ['Total', '', 415],
  ])

  it('agrega por persona y mes admitiendo varios formatos de mes', () => {
    const { records, warnings } = parseHoras(fichero)
    expect(warnings).toEqual([])
    expect(records).toEqual([
      { persona: 'García López, María', mes: '2026-03', horas: 120, tarea: undefined },
      { persona: 'Pérez Ruiz, Antonio', mes: '2026-03', horas: 80, tarea: undefined },
      { persona: 'García López, María', mes: '2026-04', horas: 130, tarea: undefined },
      { persona: 'Pérez Ruiz, Antonio', mes: '2026-04', horas: 85, tarea: undefined },
    ])
  })

  it('descarta la fila Total', () => {
    const { records } = parseHoras(fichero)
    expect(records.some((r) => /^total/i.test(r.persona))).toBe(false)
  })
})

describe('parseHoras: formato ancho generico', () => {
  it('lee una columna por mes y descarta ceros', () => {
    const { records } = parseHoras(
      aoaToXlsx([
        ['Nombre', 'ene-26', 'feb-26', 'mar-26'],
        ['García López, María', 100, 110, 95],
        ['Castañares Gutiérrez, David', 20, 0, 35],
      ]),
    )
    expect(records).toHaveLength(5) // el 0 de feb-26 no genera registro
    expect(records.filter((r) => r.persona === 'Castañares Gutiérrez, David').map((r) => r.mes)).toEqual([
      '2026-01',
      '2026-03',
    ])
  })
})

describe('parseHoras: "Detalle de horas por empleado" del ERP', () => {
  // Columnas: Nro | Nombre | Fecha | H. Normales | H. Extra | Coste | ? | Tarea | Área | ? | Nombre
  const cabecera = ['Nro.', 'Nombre', 'Fecha', 'H. Normales', 'H. Extra', 'Coste', null, 'Tarea', 'Área técnica', null, 'Nombre']
  const detalle = (fecha: string, normales: number, extra: number, coste: number, tarea: string, area: string, persona: string) =>
    [1, 'x', toSerial(fecha), normales, extra, coste, null, tarea, area, null, persona]

  it('extrae codigo, registros con coste y area por persona', () => {
    const parsed = parseHoras(
      aoaToXlsx([
        ['Proyecto: DSES.TEST02 - Obra X'],
        cabecera,
        detalle('2026-03-05', 4, 0, 120, 'Diseño', 'BIM', 'Pérez Ruiz, Antonio'),
        detalle('2026-03-06', 3, 1, 130, 'Diseño', 'BIM', 'Pérez Ruiz, Antonio'),
        detalle('2026-04-02', 8, 0, 240, 'Obra', 'GIS', 'García López, María'),
        [null, 'Total Proyecto DSES.TEST02', null, 15, 1, 490],
      ]),
    )
    expect(parsed.code).toBe('DSES.TEST02')
    expect(parsed.warnings).toEqual([])
    expect(parsed.records).toEqual([
      { persona: 'Pérez Ruiz, Antonio', mes: '2026-03', horas: 8, tarea: 'Diseño', coste: 250 },
      { persona: 'García López, María', mes: '2026-04', horas: 8, tarea: 'Obra', coste: 240 },
    ])
    expect(parsed.areaPorPersona).toEqual({ 'Pérez Ruiz, Antonio': 'BIM', 'García López, María': 'GIS' })
  })

  it('avisa si las horas o el coste no cuadran con el total del fichero', () => {
    const { warnings } = parseHoras(
      aoaToXlsx([
        cabecera,
        detalle('2026-03-05', 4, 0, 120, 'Diseño', 'BIM', 'Pérez Ruiz, Antonio'),
        [null, 'Total Proyecto', null, 99, 0, 9999],
      ]),
    )
    expect(warnings).toHaveLength(2)
    expect(warnings[0]).toMatch(/no cuadran con el total/)
    expect(warnings[1]).toMatch(/no cuadra con el total/)
  })
})

describe('parseHoras: "Detalle de horas por tareas" del ERP', () => {
  it('cuelga los apuntes de la persona de agrupacion y hereda la tarea actual', () => {
    const parsed = parseHoras(
      aoaToXlsx([
        ['Proyecto: DSES.TEST01'],
        ['Nro.', 'Nombre', 'Descripción', 'Fecha', 'H. Normales', 'H. Extra', 'Coste', 'Tarea del contrato', 'ID de empleado'],
        ['Tarea A', null, null, null, null, null, null, null, null],
        [2, 'García López, María', null, null, null, null, null, null, null],
        [null, null, null, toSerial('2026-03-05'), 6, 0, 180, null, 111],
        [null, null, null, toSerial('2026-03-06'), 2, 1, 90, null, 111],
        [null, 'Total Proyecto DSES.TEST01', null, null, 8, 1, 270, null, null],
      ]),
    )
    expect(parsed.code).toBe('DSES.TEST01')
    expect(parsed.warnings).toEqual([])
    expect(parsed.records).toEqual([
      { persona: 'García López, María', mes: '2026-03', horas: 9, tarea: 'Tarea A', coste: 270 },
    ])
  })

  it('distingue filas de area (sin coma) de filas de persona (con coma)', () => {
    const parsed = parseHoras(
      aoaToXlsx([
        ['Nro.', 'Nombre', 'Descripción', 'Fecha', 'H. Normales', 'H. Extra', 'Coste', 'Tarea del contrato', 'ID de empleado'],
        [1, 'Área Digital', null, null, null, null, null, null, null],
        [2, 'García López, María', null, null, null, null, null, null, null],
        [null, null, null, toSerial('2026-03-05'), 8, 0, 240, 'T1', 111],
      ]),
    )
    expect(parsed.records).toEqual([
      { persona: 'García López, María', mes: '2026-03', horas: 8, tarea: 'T1', coste: 240 },
    ])
    expect(parsed.areaPorPersona).toEqual({ 'García López, María': 'Área Digital' })
  })
})

describe('parseHoras: fichero no reconocido', () => {
  it('lanza un error explicativo', () => {
    expect(() => parseHoras(aoaToXlsx([['Esto', 'no es'], ['un fichero', 'de horas']]))).toThrow(
      /No se han podido leer horas/,
    )
  })
})
