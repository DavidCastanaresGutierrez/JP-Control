# Vida Control — Control personal de tres pilares

App web personal para llevar el control de tres pilares de tu vida:

1. **Economía** — gastos e ingresos por categoría y evolución del patrimonio.
2. **Salud** — valores corporales, dieta (calorías y macros) y rutinas de gimnasio.
3. **Hábitos** — seguimiento diario con rachas y mapa de calor.

Misma filosofía que **JP Control**: *local-first* (todo funciona en el navegador,
sin conexión) con una capa de **nube opcional** para que los datos te sigan entre
dispositivos. React + Vite + TypeScript + Tailwind, PWA instalable, desplegable
en Vercel con Neon Postgres.

## Qué hace

### 💶 Economía

- **Gastos e ingresos**: registra movimientos con fecha, categoría, importe,
  cuenta y nota. KPIs de ingresos/gastos/balance del mes, gráfica de evolución
  mensual y tarta de gasto por categoría.
- **Patrimonio**: da de alta tus activos (cuentas, inversiones, inmuebles,
  deudas…) y registra "fotos de patrimonio" con el saldo de cada uno en una
  fecha. La suma es tu patrimonio neto, con gráfica de evolución y variación
  frente a la foto anterior. Las deudas se registran en negativo.

### ❤️ Salud

- **Corporal**: peso, % de grasa, % de músculo y cintura por fecha, con gráfica
  de evolución por métrica e historial en tabla.
- **Dieta**: comidas del día (con calorías y macros opcionales), resumen diario
  y gráfica de calorías de los últimos 14 días. Navegación por día.
- **Gimnasio**: sesiones con ejercicios y series (reps × peso). Volumen por
  sesión, historial detallado y gráfica de evolución del volumen.

### ✅ Hábitos

- Crea hábitos con emoji, color y objetivo semanal.
- Marca cada día (últimos 7 días a un toque, o cualquier día desde el mapa de
  calor). Racha actual 🔥, cumplidos de la semana y % histórico.

### General

- **Guardado automático**: todo se persiste en el navegador (IndexedDB) en
  cuanto cambia; no hace falta guardar a mano.
- **Copia de seguridad**: exportar/restaurar todos los datos en JSON (Ajustes).

## Desarrollo

```bash
npm install
npm run dev      # servidor local (http://localhost:5173)
npm run build    # producción (carpeta dist/)
npm test         # tests unitarios (Vitest)
npm run test:e2e # end-to-end (Playwright, contra el build)
npm run lint     # oxlint
```

## Arquitectura de datos

- **Sin nube** (desarrollo local o Vercel sin base de datos): todo se guarda en
  IndexedDB del navegador. La barra superior muestra «Solo local».
- **Con nube** (Vercel + Postgres): al arrancar, la app descarga el documento de
  la base de datos y lo concilia con lo local. Cada cambio se sincroniza
  automáticamente (~1 s de retardo) con **bloqueo optimista** por versión: si se
  guardó una versión más reciente desde otro dispositivo, en vez de pisarla en
  silencio se **fusionan** los cambios de ambos lados (unión por `id`) y se avisa.
- El API es una única función serverless en [api/state.ts](api/state.ts) que crea
  la tabla `vc_state` (un solo documento JSON con columna `version`)
  automáticamente en el primer uso.
- Al ser una app **personal de un solo usuario**, no hay SSO ni roles: la nube se
  protege con un código de acceso compartido (`APP_TOKEN`).

## Despliegue en Vercel (GitHub + Neon Postgres)

1. **GitHub** — el código ya está en este repositorio.

2. **Vercel** — en [vercel.com](https://vercel.com) → *Add New…* → *Project* →
   importa este repo. Con el plan **Hobby** gratis Vercel detecta Vite solo
   (build `npm run build`, salida `dist`) y despliega también el API de `api/`.

3. **Base de datos** — en el proyecto de Vercel → pestaña **Storage** →
   *Create Database* → **Neon (Postgres)** → plan gratuito → *Connect*. Esto crea
   la variable de entorno `DATABASE_URL` automáticamente.

4. **Código de acceso** — en *Settings → Environment Variables* añade `APP_TOKEN`
   con el valor que quieras (una frase larga). Sin él, el API queda abierto a
   cualquiera con la URL.

5. **Redespliega** (*Deployments → ⋯ → Redeploy*) para que tome las variables.
   Abre la URL, ve a **Ajustes** e introduce el mismo código de acceso; verás
   «Sincronizado».

Cada `git push` a `main` publica automáticamente una nueva versión.
