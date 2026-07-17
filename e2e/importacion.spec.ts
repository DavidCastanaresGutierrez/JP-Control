import { expect, test } from '@playwright/test'
import * as XLSX from 'xlsx'

/**
 * Flujo completo de la app con el bundle real: importar un Detalle de
 * Explotacion por la UI (parseado en el Web Worker), ver el dashboard del
 * proyecto, la tabla de apuntes, y comprobar que sobrevive a una recarga
 * (persistencia IndexedDB).
 */

const CODIGO = 'DSES.E2E01'

function ficheroExplotacion(): Buffer {
  const serial = (iso: string) => {
    const [y, m, d] = iso.split('-').map(Number)
    return Math.round(Date.UTC(y, m - 1, d) / 86400000) + 25569
  }
  const rows = [
    ['Detalle de Explotación', null, 'hasta 31/03/2026'],
    [`Proyecto: ${CODIGO} - Proyecto E2E`],
    ['Fecha Alta', serial('2025-01-10'), null, 'Director E2E'],
    [null, '9990 Facturación'],
    [null, 'Asiento', 'Fecha', 'Concepto', 'Área', 'Debe', 'Haber'],
    [null, 'A1', serial('2026-01-15'), 'Factura E2E', 'BIM', 0, 12000],
    [null, '6070 Trab. otras emp.(GENERAL)'],
    [null, 'Asiento', 'Fecha', 'Concepto', 'Área', 'Debe', 'Haber'],
    [null, 'A2', serial('2026-02-10'), 'Subcontrata E2E', null, 500, 0],
    [null, 'Contabilizado desde 01/01/2026', null, null, null, 500, 12000],
  ]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows))
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
}

test('importar explotacion -> dashboard -> facturas -> persistencia tras recarga', async ({ page }) => {
  await page.goto('/')

  // Importar por la UI (el primer input oculto del modal es el de Explotacion)
  await page.getByRole('button', { name: /Anadir proyecto/ }).click()
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles({
      name: `explotacion-detalle-${CODIGO}-20260301.xlsx`,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: ficheroExplotacion(),
    })

  // Toast de confirmacion y salto directo al dashboard del proyecto
  await expect(page.getByText(`${CODIGO}: 2 apuntes importados.`)).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Proyecto E2E' })).toBeVisible()

  // Pestana Facturas: la tabla de apuntes muestra los dos movimientos
  await page.getByRole('button', { name: 'Facturas' }).click()
  await expect(page.getByText('2 apuntes', { exact: true })).toBeVisible()
  await expect(page.getByText('Factura E2E')).toBeVisible()
  await expect(page.getByText('Subcontrata E2E')).toBeVisible()

  // Recarga: el proyecto sobrevive en IndexedDB
  await page.reload()
  await page.getByRole('button', { name: 'Todos los proyectos' }).click()
  await expect(page.getByText('Proyecto E2E').first()).toBeVisible()
  await expect(page.getByText(CODIGO, { exact: true }).first()).toBeVisible()
})
