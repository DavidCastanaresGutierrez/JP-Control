import { describe, expect, it } from 'vitest'
import type { Comida, Entreno, RegistroHabito, SnapshotPatrimonio, Transaccion } from '../types.ts'
import {
  cumplidosRecientes,
  gastoPorCategoria,
  patrimonioNeto,
  rachaActual,
  resumenDia,
  resumenMes,
  serieMensual,
  seriePatrimonio,
  volumenEntreno,
} from './metrics.ts'

const t = (over: Partial<Transaccion>): Transaccion => ({
  id: Math.random().toString(),
  fecha: '2026-07-10',
  tipo: 'gasto',
  categoria: 'Otros',
  importe: 10,
  ...over,
})

describe('economía', () => {
  const trans: Transaccion[] = [
    t({ tipo: 'ingreso', importe: 2000, fecha: '2026-07-01', categoria: 'Nómina' }),
    t({ tipo: 'gasto', importe: 500, fecha: '2026-07-05', categoria: 'Vivienda' }),
    t({ tipo: 'gasto', importe: 200, fecha: '2026-07-06', categoria: 'Alimentación' }),
    t({ tipo: 'gasto', importe: 100, fecha: '2026-06-30', categoria: 'Ocio' }),
  ]

  it('resume ingresos, gastos y balance de un mes', () => {
    const r = resumenMes(trans, '2026-07')
    expect(r.ingresos).toBe(2000)
    expect(r.gastos).toBe(700)
    expect(r.balance).toBe(1300)
  })

  it('agrupa gasto por categoría ordenado desc', () => {
    const g = gastoPorCategoria(trans, '2026-07')
    expect(g[0]).toEqual({ categoria: 'Vivienda', total: 500 })
    expect(g).toHaveLength(2)
  })

  it('construye serie mensual ordenada', () => {
    const s = serieMensual(trans)
    expect(s.map((p) => p.mes)).toEqual(['2026-06', '2026-07'])
    expect(s[1].balance).toBe(1300)
  })

  it('calcula patrimonio neto sumando saldos (deudas negativas)', () => {
    const snap: SnapshotPatrimonio = { id: '1', fecha: '2026-07-01', saldos: { a: 1000, b: 500, c: -300 } }
    expect(patrimonioNeto(snap)).toBe(1200)
  })

  it('ordena la serie de patrimonio por fecha', () => {
    const snaps: SnapshotPatrimonio[] = [
      { id: '2', fecha: '2026-07-01', saldos: { a: 200 } },
      { id: '1', fecha: '2026-06-01', saldos: { a: 100 } },
    ]
    expect(seriePatrimonio(snaps).map((p) => p.total)).toEqual([100, 200])
  })
})

describe('salud', () => {
  it('suma la nutrición de un día', () => {
    const comidas: Comida[] = [
      { id: '1', fecha: '2026-07-10', tipo: 'desayuno', descripcion: 'a', kcal: 300, proteina: 20 },
      { id: '2', fecha: '2026-07-10', tipo: 'comida', descripcion: 'b', kcal: 700, proteina: 40 },
      { id: '3', fecha: '2026-07-11', tipo: 'cena', descripcion: 'c', kcal: 500 },
    ]
    const r = resumenDia(comidas, '2026-07-10')
    expect(r.kcal).toBe(1000)
    expect(r.proteina).toBe(60)
  })

  it('calcula el volumen de un entreno (reps × peso)', () => {
    const e: Entreno = {
      id: '1',
      fecha: '2026-07-10',
      nombre: 'Empuje',
      ejercicios: [
        { nombre: 'Press', series: [{ reps: 10, peso: 40 }, { reps: 8, peso: 45 }] },
        { nombre: 'Fondos', series: [{ reps: 12, peso: 0 }] },
      ],
    }
    expect(volumenEntreno(e)).toBe(10 * 40 + 8 * 45)
  })
})

describe('hábitos', () => {
  const reg = (habitoId: string, fecha: string): RegistroHabito => ({ id: `${habitoId}:${fecha}`, habitoId, fecha })

  it('cuenta la racha consecutiva hasta la referencia', () => {
    const registros = [reg('h', '2026-07-18'), reg('h', '2026-07-17'), reg('h', '2026-07-16')]
    expect(rachaActual(registros, 'h', '2026-07-18')).toBe(3)
  })

  it('mantiene la racha viva si hoy no está marcado pero ayer sí', () => {
    const registros = [reg('h', '2026-07-17'), reg('h', '2026-07-16')]
    expect(rachaActual(registros, 'h', '2026-07-18')).toBe(2)
  })

  it('rompe la racha con un hueco', () => {
    const registros = [reg('h', '2026-07-18'), reg('h', '2026-07-16')]
    expect(rachaActual(registros, 'h', '2026-07-18')).toBe(1)
  })

  it('cuenta cumplidos recientes en una ventana', () => {
    const registros = [reg('h', '2026-07-18'), reg('h', '2026-07-15'), reg('h', '2026-07-01')]
    expect(cumplidosRecientes(registros, 'h', 7, '2026-07-18')).toBe(2)
  })
})
