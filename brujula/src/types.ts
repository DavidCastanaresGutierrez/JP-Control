/**
 * Modelo de datos de Brújula. Todo vive en un único documento `DB` que se
 * guarda en IndexedDB y, con la nube configurada, se sincroniza como un solo
 * blob JSON con bloqueo optimista por versión (ver lib/store.ts).
 */

// ─── Pilar 1: Economía ───────────────────────────────────────────────────────

export type TipoMovimiento = 'gasto' | 'ingreso'

export interface Transaccion {
  id: string
  fecha: string // ISO yyyy-mm-dd
  tipo: TipoMovimiento
  categoria: string
  importe: number // siempre positivo; el signo lo da `tipo`
  cuenta?: string // nombre de la cuenta/activo (opcional)
  nota?: string
}

export type TipoActivo = 'banco' | 'efectivo' | 'inversion' | 'inmueble' | 'deuda' | 'otro'

export interface Activo {
  id: string
  nombre: string
  tipo: TipoActivo
}

/** Foto del patrimonio en una fecha: saldo por activo. La suma es el patrimonio neto. */
export interface SnapshotPatrimonio {
  id: string
  fecha: string // ISO yyyy-mm-dd
  saldos: Record<string, number> // activoId -> valor (las deudas van en negativo)
  nota?: string
}

// ─── Pilar 2: Salud ──────────────────────────────────────────────────────────

/** Medición corporal en una fecha; todos los campos son opcionales. */
export interface MedidaCorporal {
  id: string
  fecha: string // ISO yyyy-mm-dd
  peso?: number // kg
  grasa?: number // % grasa corporal
  musculo?: number // % masa muscular
  cintura?: number // cm
  nota?: string
}

export type TipoComida = 'desayuno' | 'almuerzo' | 'comida' | 'merienda' | 'cena' | 'snack'

export interface Comida {
  id: string
  fecha: string // ISO yyyy-mm-dd
  tipo: TipoComida
  descripcion: string
  kcal?: number
  proteina?: number // g
  carbos?: number // g
  grasa?: number // g
}

export interface SerieEjercicio {
  reps: number
  peso: number // kg (0 = peso corporal)
}

export interface EjercicioSesion {
  nombre: string
  series: SerieEjercicio[]
}

/** Una sesión de gimnasio en una fecha. */
export interface Entreno {
  id: string
  fecha: string // ISO yyyy-mm-dd
  nombre: string // p.ej. "Empuje", "Pierna", "Full body"
  ejercicios: EjercicioSesion[]
  nota?: string
}

// ─── Pilar 3: Hábitos ────────────────────────────────────────────────────────

export interface Habito {
  id: string
  nombre: string
  emoji?: string
  color?: string
  /** Días objetivo por semana (informativo, 1-7) */
  objetivoSemanal?: number
  creado: string // ISO yyyy-mm-dd
  archivado?: boolean
  orden?: number
}

/** Marca de un hábito cumplido un día. La presencia del registro = cumplido. */
export interface RegistroHabito {
  id: string // `${habitoId}:${fecha}`
  habitoId: string
  fecha: string // ISO yyyy-mm-dd
}

// ─── Documento raíz ──────────────────────────────────────────────────────────

export interface DB {
  transacciones: Transaccion[]
  activos: Activo[]
  patrimonio: SnapshotPatrimonio[]
  medidas: MedidaCorporal[]
  comidas: Comida[]
  entrenos: Entreno[]
  habitos: Habito[]
  registrosHabito: RegistroHabito[]
}

export function dbVacia(): DB {
  return {
    transacciones: [],
    activos: [],
    patrimonio: [],
    medidas: [],
    comidas: [],
    entrenos: [],
    habitos: [],
    registrosHabito: [],
  }
}

/** Normaliza un documento cargado (de IndexedDB o de la nube) rellenando arrays que falten. */
export function normalizarDb(parcial: Partial<DB> | null | undefined): DB {
  const base = dbVacia()
  if (!parcial || typeof parcial !== 'object') return base
  return {
    transacciones: Array.isArray(parcial.transacciones) ? parcial.transacciones : base.transacciones,
    activos: Array.isArray(parcial.activos) ? parcial.activos : base.activos,
    patrimonio: Array.isArray(parcial.patrimonio) ? parcial.patrimonio : base.patrimonio,
    medidas: Array.isArray(parcial.medidas) ? parcial.medidas : base.medidas,
    comidas: Array.isArray(parcial.comidas) ? parcial.comidas : base.comidas,
    entrenos: Array.isArray(parcial.entrenos) ? parcial.entrenos : base.entrenos,
    habitos: Array.isArray(parcial.habitos) ? parcial.habitos : base.habitos,
    registrosHabito: Array.isArray(parcial.registrosHabito) ? parcial.registrosHabito : base.registrosHabito,
  }
}
