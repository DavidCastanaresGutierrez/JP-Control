// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { Toasts } from './Toasts.tsx'

afterEach(cleanup)

describe('Toasts', () => {
  it('pinta cada aviso con su estilo por tipo', () => {
    render(
      <Toasts
        toasts={[
          { id: 1, kind: 'ok', text: 'Importado correctamente' },
          { id: 2, kind: 'warn', text: 'Aviso de totales' },
          { id: 3, kind: 'error', text: 'Fichero no reconocido' },
        ]}
      />,
    )
    expect(screen.getByText('Importado correctamente')).toBeInTheDocument()
    expect(screen.getByText('Aviso de totales')).toBeInTheDocument()
    expect(screen.getByText('Fichero no reconocido')).toBeInTheDocument()
  })
})
