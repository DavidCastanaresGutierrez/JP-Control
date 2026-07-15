# JP Control — Seguimiento económico de proyectos

Dashboard web para el seguimiento económico de contratos a partir de las hojas
de **Detalle de Explotación** del ERP. Los ficheros se procesan en el navegador
(en un Web Worker) y los datos se guardan en una caché local (IndexedDB); con
la nube configurada se sincronizan además con la base de datos del proyecto.

## Qué hace

- **Añadir proyectos**: con el botón **«＋ Añadir proyecto»** de la barra lateral
  (disponible en todo momento) o arrastrando ficheros a la pantalla de resumen.
  Admite uno o varios `explotacion-detalle-*.xlsx` a la vez. Cada proyecto se
  identifica por su código; como los exportes son acumulativos, el fichero más
  reciente sustituye al anterior del mismo proyecto y los de otros códigos se
  añaden como proyectos nuevos.
- **Guardado automático**: todo se persiste en el navegador (IndexedDB) en
  cuanto cambia; no hace falta guardar a mano. Con la sincronización en la nube
  activa, los datos te siguen a cualquier equipo al iniciar sesión.
- **Panel por proyecto**: arriba, una **barra grande de consumo sobre
  presupuesto** — usa el mayor de (facturado, gasto acumulado) ÷ presupuesto y
  muestra una **marca (rallita) en el % de avance** para ver de un vistazo si el
  consumo va por delante o por detrás de lo previsto (verde ok, ámbar/rojo si se
  pasa). Debajo, KPIs de facturado, avance/facturación, gasto y resultado;
  evolución mensual de gasto y facturación (mes y acumulado) y una **tarta de
  gasto por departamento** (coste de personal + facturas de externos asignadas).
- **Horas**: predicción de la fecha de agotamiento del presupuesto (proyección
  del gasto acumulado al ritmo de los últimos 3 meses, con escenarios de último
  mes y media del proyecto); coste mensual de horas de oficina (cuenta 9101) y,
  con una importación adicional de horas por empleado, matriz participante × mes
  con detección de anomalías (picos, caídas, incorporaciones y meses sin imputar).
  Un conmutador **Horas / % ocupación** muestra en la gráfica y la tabla el
  porcentaje de dedicación de cada persona (horas ÷ jornada completa del mes,
  contando 8 h/día de lunes a viernes).
- **Resumen general** de la cartera con alertas por proyecto.
- **Copia de seguridad**: exportar/restaurar todos los datos en JSON (útil para
  cambiar de equipo o navegador).

## Parámetros a mantener por proyecto (pestaña Ajustes)

- **Importe de contrato**: contra esto se mide el % facturado (indicador principal).
- **Presupuesto de coste**: contra esto se mide el % de gasto (referencia secundaria).
- **% avance técnico**: actualízalo cada mes; es la base de las alertas de desvío.

## Importación de horas por participante

El Detalle de Explotación no desglosa las horas por persona. En la pestaña
**Horas** de cada proyecto puedes importar ese desglose:

- **Detalle de horas por empleado del ERP** (`horas-empleado-detalle-*.xlsx`):
  se reconoce directamente, agrega las imputaciones diarias (normales + extra)
  por persona y mes, y comprueba que el fichero pertenece al proyecto abierto
  y que la suma cuadra con el "Total Proyecto".
- **Formato largo**: columnas `Empleado / Mes / Horas` (el mes admite `mar-26`,
  `03/2026`, `2026-03`, fechas…).
- **Formato ancho**: una columna `Empleado`/`Nombre` y una columna por mes.

Los pares (persona, mes) reimportados sobrescriben a los existentes.

En la matriz, picos y caídas se marcan frente a la mediana de cada persona
(con ≥3 meses de historial; con 2 meses, saltos de más del doble o menos de la
mitad). Las incorporaciones se señalan en azul como marca informativa y los
meses sin imputar entre meses activos, en gris.

La gráfica de evolución se controla desde la tabla: **haz clic en un
participante** para dibujar (o quitar) su línea de horas mes a mes; se pueden
seleccionar varios para comparar, o usar «Ver todos» / «Limpiar». Por defecto
aparecen seleccionadas las personas con anomalías.

### Control por departamento

La **asignación** (qué departamento es cada persona y a qué departamento va cada
factura de externo) se configura en la pestaña **Ajustes** — se hace una vez:

- **Departamento de cada persona**. Si importaste el fichero del ERP, viene
  pre-rellenado con el «Área técnica» de cada empleado (editable).
- **Facturas de externos por departamento**: los gastos que no son de personal
  propio (trabajos de otras empresas —6070—, IT —6296—, etc.), agrupados por tipo
  de factura. Asigna cada uno a un departamento (o déjalo en **«Otros Gastos»**,
  el destino por defecto). Su importe cuenta como coste de ese departamento.

El **seguimiento** se ve en dos sitios:

- **Panel** → tarta de **gasto por departamento** (personal + facturas asignadas),
  que reconcilia con el gasto total del proyecto.
- **Horas** → tabla «Control por departamento» con la **corresponsabilidad**
  (% del presupuesto por departamento, editable) y la columna **coste real ÷
  presupuesto asignado**: por debajo de 100 % va dentro de su parte; por encima
  (rojo) se está pasando. El «coste real» usa el coste por persona del ERP si
  existe; si no, se estima repartiendo el coste de personal total (cuenta 9101)
  por horas (se marca con «*»).

## Desarrollo

```bash
npm install
npm run dev      # servidor local
npm run build    # producción (carpeta dist/)

# Probar los parsers contra ficheros reales
node scripts/test-parser.mjs "ruta\al\explotacion-detalle-XXX.xlsx"
node scripts/test-horas.mjs
```

## Arquitectura de datos

- **Sin nube** (desarrollo local o Vercel sin base de datos): todo se guarda en
  IndexedDB del navegador (la copia antigua de `localStorage` se migra sola la
  primera vez). La barra superior muestra «Solo local».
- **Con nube** (Vercel + Postgres): al arrancar, la app carga los proyectos de la
  base de datos y los fusiona con lo local (lo local que no exista en la nube se
  sube). Cada cambio se sincroniza automáticamente (~1 s de retardo) con
  **bloqueo optimista**: si otro usuario guardó una versión más reciente, se
  adopta esa versión y se avisa (nadie pisa el trabajo de nadie en silencio).
  La barra superior muestra «Sincronizado con la nube».
- El API es una función serverless en [api/projects.ts](api/projects.ts) que crea
  la tabla `jp_projects` (una fila JSON por proyecto, con columna `version`)
  automáticamente en el primer uso.
- Las decisiones de escalabilidad aplazadas a propósito (metadata ligera, PATCH
  parcial, soft-delete…) están en [docs/DEUDA-TECNICA.md](docs/DEUDA-TECNICA.md).
- Concurrencia: gana la última escritura por proyecto (pensado para un equipo
  pequeño, no para edición simultánea intensiva del mismo proyecto).
- **Roles de usuario** (solo con SSO + base de datos configurados): cada persona
  que inicia sesión se registra automáticamente en la tabla `jp_users`
  ([api/users.ts](api/users.ts)) con un rol — *Lectura* (solo ver), *Edición*
  (ver y modificar) o *Administración* (además gestiona los roles de los demás
  desde el panel «Administración» del menú lateral). El resto entra con rol de
  Edición hasta que un administrador lo cambie. La lista de administradores
  fijos se controla con la variable de entorno `ADMIN_EMAILS` (correos
  separados por comas); si no se define, por defecto es solo
  `dcastanares@typsa.es`. Ese rol se reafirma en cada login, así que no se
  puede quitar por accidente (ni desde el panel).

## Despliegue en Vercel (GitHub + Neon Postgres)

1. **GitHub** — crea un repositorio vacío (p. ej. `jp-control`) en github.com y
   sube el código (el commit inicial ya está hecho):

   ```bash
   git remote add origin https://github.com/TU_USUARIO/jp-control.git
   git push -u origin main
   ```

2. **Vercel** — en [vercel.com](https://vercel.com) → *Add New…* → *Project* →
   importa el repo `jp-control`. Con el plan **Hobby** gratis Vercel detecta Vite
   solo (build `npm run build`, salida `dist`) y despliega también el API de
   `api/`.

3. **Base de datos** — en el proyecto de Vercel → pestaña **Storage** →
   *Create Database* → **Neon (Postgres)** → plan gratuito → *Connect*. Esto
   crea la variable de entorno `DATABASE_URL` automáticamente.

4. **Código de acceso** — en *Settings → Environment Variables* añade
   `APP_TOKEN` con el valor que quieras (p. ej. una frase larga). Sin él, el API
   queda abierto a cualquiera con la URL — no recomendado con datos de empresa.

5. **Redespliega** (*Deployments → ⋯ → Redeploy*) para que tome las variables.
   Abre la URL, introduce el código de acceso en la barra superior y verás
   «Sincronizado con la nube».

Cada `git push` a `main` publica automáticamente una nueva versión.
