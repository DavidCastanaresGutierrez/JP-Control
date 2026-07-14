import { describe, expect, it } from 'vitest'
import { parseExplotacion } from './parseExplotacion.ts'
import { aoaToXlsx, toSerial } from './testHelpers.ts'

// Columnas de apunte: (vacía) | Asiento | Fecha | Concepto | Área | Debe | Haber
const ficheroBase = (totalDebe: number, totalHaber: number) =>
  aoaToXlsx([
    ['Detalle de Explotación', null, 'hasta 31/03/2026'],
    ['Proyecto: DSES.TEST03 - Plataforma GIS'],
    ['Fecha Alta', toSerial('2025-01-10'), null, 'Director Apellido, Nombre'],
    [null, '9990 Facturación'],
    [null, 'Asiento', 'Fecha', 'Concepto', 'Área', 'Debe', 'Haber'],
    [null, 'A123', toSerial('2026-01-15'), 'Factura 1', 'BIM', 0, 1000],
    [null, '6070 Trab. otras emp.(GENERAL)'],
    [null, 'Asiento', 'Fecha', 'Concepto', 'Área', 'Debe', 'Haber'],
    [null, 'A124', toSerial('2026-02-10'), 'Subcontrata', null, 500, 0],
    [null, 'Contabilizado desde 01/01/2026', null, null, null, totalDebe, totalHaber],
  ])

describe('parseExplotacion', () => {
  it('extrae metadatos del proyecto y apuntes por bloque de cuenta', () => {
    const parsed = parseExplotacion(ficheroBase(500, 1000), 'detalle.xlsx')
    expect(parsed.code).toBe('DSES.TEST03')
    expect(parsed.name).toBe('Plataforma GIS')
    expect(parsed.director).toBe('Director Apellido, Nombre')
    expect(parsed.fechaAlta).toBe('2025-01-10')
    expect(parsed.hasta).toBe('2026-03-31')
    expect(parsed.totalDebe).toBe(500)
    expect(parsed.totalHaber).toBe(1000)
    expect(parsed.warnings).toEqual([])
    expect(parsed.entries).toEqual([
      {
        id: '9990|A123|2026-01-15|Factura 1|0|1000',
        asiento: 'A123',
        fecha: '2026-01-15',
        mes: '2026-01',
        concepto: 'Factura 1',
        area: 'BIM',
        cuenta: '9990 Facturación',
        cuentaCodigo: '9990',
        debe: 0,
        haber: 1000,
      },
      {
        id: '6070|A124|2026-02-10|Subcontrata|500|0',
        asiento: 'A124',
        fecha: '2026-02-10',
        mes: '2026-02',
        concepto: 'Subcontrata',
        area: null,
        cuenta: '6070 Trab. otras emp.(GENERAL)',
        cuentaCodigo: '6070',
        debe: 500,
        haber: 0,
      },
    ])
  })

  it('avisa si los totales del fichero no cuadran con los apuntes leidos', () => {
    const { warnings } = parseExplotacion(ficheroBase(9999, 8888), 'detalle.xlsx')
    expect(warnings).toHaveLength(2)
    expect(warnings[0]).toMatch(/total debe/)
    expect(warnings[1]).toMatch(/total haber/)
  })

  it('recupera el codigo de proyecto del nombre de fichero si el fichero no lo trae', () => {
    const sinProyecto = aoaToXlsx([
      [null, '9990 Facturación'],
      [null, 'A123', toSerial('2026-01-15'), 'Factura 1', null, 0, 1000],
    ])
    const parsed = parseExplotacion(sinProyecto, 'explotacion-detalle-DSES.X99-20260301.xlsx')
    expect(parsed.code).toBe('DSES.X99')
    expect(parsed.hasta).toBe('2026-03-01')
  })

  it('lanza error si no hay codigo de proyecto por ninguna via', () => {
    const sinNada = aoaToXlsx([
      [null, '9990 Facturación'],
      [null, 'A123', toSerial('2026-01-15'), 'Factura 1', null, 0, 1000],
    ])
    expect(() => parseExplotacion(sinNada, 'otro-nombre.xlsx')).toThrow(/código de proyecto/)
  })

  it('lanza error si no encuentra apuntes', () => {
    expect(() =>
      parseExplotacion(aoaToXlsx([['Proyecto: DSES.TEST03 - X']]), 'detalle.xlsx'),
    ).toThrow(/ningún apunte/)
  })
})
