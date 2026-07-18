import { expect, test } from '@playwright/test'

test('carga el resumen de los tres pilares', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Resumen' })).toBeVisible()
  await expect(page.getByText('Economía').first()).toBeVisible()
  await expect(page.getByText('Salud').first()).toBeVisible()
  await expect(page.getByText('Hábitos').first()).toBeVisible()
})

test('registra un gasto y aparece en el listado', async ({ page }) => {
  await page.goto('/economia')
  await page.getByRole('button', { name: '＋ Añadir movimiento' }).click()
  await page.getByPlaceholder('0,00').fill('42')
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('−42,00 €')).toBeVisible()
})

test('crea un hábito y lo marca hoy', async ({ page }) => {
  await page.goto('/habitos')
  await page.getByRole('button', { name: '＋ Nuevo hábito' }).click()
  await page.getByPlaceholder('p.ej. Leer 20 minutos').fill('Meditar')
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('Meditar')).toBeVisible()
  await expect(page.getByText('0/1 cumplidos hoy')).toBeVisible()
})
