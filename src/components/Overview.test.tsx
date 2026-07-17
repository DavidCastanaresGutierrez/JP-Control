// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import type { Entry, Project } from '../types.ts'
import { Overview } from './Overview.tsx'

afterEach(cleanup)

let seq = 0
const entry = (over: Partial<Entry>): Entry => ({
  id: `e${++seq}`,
  asiento: null,
  fecha: '2026-01-15',
  mes: '2026-01',
  concepto: 'Apunte',
  area: null,
  cuenta: '6070 Cuenta',
  cuentaCodigo: '6070',
  debe: 0,
  haber: 0,
  ...over,
})

const proyecto = (code: string, name: string, over: Partial<Project> = {}): Project => ({
  code,
  name,
  entries: [
    entry({ cuentaCodigo: '9990', cuenta: '9990 Facturación', haber: 6000 }),
    entry({ debe: 400 }),
  ],
  hours: [],
  ...over,
})

const props = {
  scope: 'all' as const,
  onSelect: vi.fn(),
  onReorder: vi.fn(),
  onFiles: vi.fn(),
  onHoursFiles: vi.fn(),
}

describe('Overview', () => {
  it('muestra las tarjetas de proyecto con sus KPIs', () => {
    render(<Overview {...props} projects={[proyecto('DSES.A', 'Puente Norte'), proyecto('DSES.B', 'Torre Sur')]} />)
    expect(screen.getByText('Puente Norte')).toBeInTheDocument()
    expect(screen.getByText('Torre Sur')).toBeInTheDocument()
    expect(screen.getByText('Proyectos')).toBeInTheDocument()
    // 2 proyectos x 6000 EUR facturados
    expect(screen.getByText(/12\.000/)).toBeInTheDocument()
  })

  it('el buscador filtra por nombre ignorando acentos', async () => {
    const user = userEvent.setup()
    render(<Overview {...props} projects={[proyecto('DSES.A', 'Estación Sur'), proyecto('DSES.B', 'Torre Norte')]} />)
    await user.type(screen.getByPlaceholderText(/Buscar por nombre/), 'estacion')
    expect(screen.getByText('Estación Sur')).toBeInTheDocument()
    expect(screen.queryByText('Torre Norte')).not.toBeInTheDocument()
  })

  it('sin proyectos muestra el estado vacio', () => {
    render(<Overview {...props} projects={[]} />)
    expect(screen.getByText(/Todavia no hay proyectos importados/)).toBeInTheDocument()
  })

  it('clicar una tarjeta abre el proyecto', async () => {
    const onSelect = vi.fn()
    const user = userEvent.setup()
    render(<Overview {...props} onSelect={onSelect} projects={[proyecto('DSES.A', 'Puente Norte')]} />)
    await user.click(screen.getByText('Puente Norte'))
    expect(onSelect).toHaveBeenCalledWith('DSES.A')
  })
})
