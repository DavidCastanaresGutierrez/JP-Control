import { describe, expect, it } from 'vitest'
import { monthRange, parseFechaES, repairMojibake, serialToISO } from './format.ts'
import { toSerial } from './testHelpers.ts'

describe('serialToISO', () => {
  it('convierte seriales de Excel a yyyy-mm-dd', () => {
    expect(serialToISO(toSerial('2026-03-15'))).toBe('2026-03-15')
    expect(serialToISO(toSerial('2025-12-31'))).toBe('2025-12-31')
    expect(serialToISO(25569)).toBe('1970-01-01')
  })
})

describe('parseFechaES', () => {
  it('parsea dd/mm/yyyy con y sin ceros', () => {
    expect(parseFechaES('31/03/2026')).toBe('2026-03-31')
    expect(parseFechaES('hasta 1/3/2026')).toBe('2026-03-01')
  })
  it('devuelve undefined si no hay fecha', () => {
    expect(parseFechaES('sin fecha')).toBeUndefined()
  })
})

describe('monthRange', () => {
  it('rellena los meses intermedios', () => {
    expect(monthRange(['2025-11', '2026-02'])).toEqual(['2025-11', '2025-12', '2026-01', '2026-02'])
  })
  it('no depende del orden de entrada', () => {
    expect(monthRange(['2026-02', '2025-12'])).toEqual(['2025-12', '2026-01', '2026-02'])
  })
  it('lista vacia -> vacia', () => {
    expect(monthRange([])).toEqual([])
  })
})

describe('repairMojibake', () => {
  it('repara UTF-8 decodificado como latin-1', () => {
    expect(repairMojibake('CastaÃ±ares')).toBe('Castañares')
    expect(repairMojibake('GarcÃ­a')).toBe('García')
  })
  it('no toca texto sano', () => {
    expect(repairMojibake('García López, María')).toBe('García López, María')
    expect(repairMojibake(undefined)).toBe('')
  })
})
