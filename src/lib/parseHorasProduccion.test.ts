import { describe, expect, it } from 'vitest'
import { parseHorasProduccion } from './parseHorasProduccion.ts'
import { aoaToXlsx, toSerial } from './testHelpers.ts'

// Columnas: Proyecto/Persona | Fecha | H. Normales | H. Extra | Coste | Descripción | Tarea
const CABECERA = ['Empleado', 'Fecha', 'H. Normales', 'H. Extra', 'Coste', 'Descripción', 'Tarea']

describe('parseHorasProduccion', () => {
  it('lee apuntes por persona, limpia las iniciales y descarta totales', () => {
    const parsed = parseHorasProduccion(
      aoaToXlsx([
        CABECERA,
        ['García López, María (MGL)', 45, null, null, null, null, null], // subtotal persona (horas en col B)
        ['DSES.PROJ1 - Puente', toSerial('2026-03-05'), 8, 0, 240, 'Modelado', 'T1'],
        ['DSES.PROJ1 - Puente', toSerial('2026-03-06'), 7, 1, 250, null, null],
        ['Vacaciones', toSerial('2026-04-01'), 8, 0, 0, null, null],
        ['Pérez Ruiz, Antonio (APR)', null, 30, null, null, null, null], // subtotal con horas en col C
        ['DS.INTERNO - Soporte', toSerial('2026-03-10'), 5, 0, 150, null, null],
        ['Total', null, 28, 1, 640, null, null],
      ]),
    )

    expect(parsed.personas).toEqual(['García López, María', 'Pérez Ruiz, Antonio'])
    expect(parsed.horas).toEqual([
      {
        persona: 'García López, María',
        proyecto: 'DSES.PROJ1 - Puente',
        fecha: '2026-03-05',
        mes: '2026-03',
        horas: 8,
        coste: 240,
        descripcion: 'Modelado',
        tarea: 'T1',
      },
      {
        persona: 'García López, María',
        proyecto: 'DSES.PROJ1 - Puente',
        fecha: '2026-03-06',
        mes: '2026-03',
        horas: 8,
        coste: 250,
        descripcion: undefined,
        tarea: undefined,
      },
      {
        persona: 'García López, María',
        proyecto: 'Vacaciones',
        fecha: '2026-04-01',
        mes: '2026-04',
        horas: 8,
        coste: 0,
        descripcion: undefined,
        tarea: undefined,
      },
      {
        persona: 'Pérez Ruiz, Antonio',
        proyecto: 'DS.INTERNO - Soporte',
        fecha: '2026-03-10',
        mes: '2026-03',
        horas: 5,
        coste: 150,
        descripcion: undefined,
        tarea: undefined,
      },
    ])
  })

  it('lanza error si no reconoce la cabecera', () => {
    expect(() => parseHorasProduccion(aoaToXlsx([['Cualquier', 'cosa']]))).toThrow(
      /No se ha reconocido el fichero/,
    )
  })

  it('lanza error si no hay ningun apunte', () => {
    expect(() =>
      parseHorasProduccion(aoaToXlsx([CABECERA, ['García López, María (MGL)', 45, null, null, null, null, null]])),
    ).toThrow(/ningun apunte/)
  })
})
