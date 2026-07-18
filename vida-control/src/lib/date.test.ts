import { describe, expect, it } from 'vitest'
import { diasEntre, etiquetaMes, inicialDiaSemana, mesDe, sumarDias } from './date.ts'

describe('date', () => {
  it('extrae el mes de una fecha ISO', () => {
    expect(mesDe('2026-07-18')).toBe('2026-07')
  })

  it('suma y resta días cruzando fin de mes', () => {
    expect(sumarDias('2026-07-31', 1)).toBe('2026-08-01')
    expect(sumarDias('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('cuenta días entre fechas', () => {
    expect(diasEntre('2026-07-01', '2026-07-08')).toBe(7)
    expect(diasEntre('2026-07-08', '2026-07-01')).toBe(-7)
  })

  it('etiqueta meses en español', () => {
    expect(etiquetaMes('2026-01')).toBe('ene 2026')
    expect(etiquetaMes('2026-12')).toBe('dic 2026')
  })

  it('da la inicial del día de la semana', () => {
    // 2026-07-18 es sábado
    expect(inicialDiaSemana('2026-07-18')).toBe('S')
  })
})
