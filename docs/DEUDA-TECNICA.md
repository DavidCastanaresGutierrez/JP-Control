# Deuda técnica y próximos pasos de escalabilidad

Estado de las decisiones tomadas durante la auditoría de julio 2026. La mayoría
se resolvieron en la pasada del 17/07/2026; quedan documentadas las que siguen
aplazadas a propósito, con la señal que indicaría que toca abordarlas.

## Resuelto (17/07/2026)

| Tema | Cómo se resolvió |
| --- | --- |
| **Payloads de arranque** | Sync incremental por versión: al conectar, el cliente pide solo `GET ?vista=versiones` (KBs) y descarga el detalle únicamente de lo que no esté al día en su caché IndexedDB (comparando versión + hash de la última copia sincronizada, persistidos en el store `meta`). Bonus: las ediciones hechas offline ahora se detectan por hash y se suben, antes se pisaban en silencio al conectar. |
| **Soft-delete** | `deleted_at` en `jp_projects`/`jp_departments`: el DELETE marca, el GET filtra, cualquier PUT revive la fila. Un borrado accidental se recupera reimportando el proyecto (o poniendo `deleted_at` a NULL en la BD). |
| **CSRF en el refresh SSO** | Las cookies pasan de `SameSite=None` a `Lax` (el flujo SSO devuelve los tokens por parámetros de URL en navegación top-level; `None` no era necesario). Un tercero ya no puede disparar el refresh cross-site. |
| **npm audit** | 10 vulnerabilidades en transitivas de `@vercel/node` (tooling de tipos) resueltas con `overrides` a las versiones parcheadas. 0 hallazgos. |
| **Estado de sync invisible** | Indicador permanente en el Sidebar (nube / solo local / conectando / error): un fallo de sincronización ya no pasa desapercibido. |
| **Conflictos a nivel de entidad** | Fusión a tres vías campo a campo usando la última copia sincronizada como base común: si dos usuarios editan campos distintos del mismo proyecto, se combinan ambos; solo el campo con doble edición lo gana el que guardó primero (con aviso detallando qué campos). |
| **Resurrección de zombis** | `?vista=versiones` devuelve también los tombstones del soft-delete; un borrado hecho en otro dispositivo se propaga a la caché local (con aviso). Excepción deliberada: si aquí hay trabajo offline sin subir, se conserva y revive. |
| **Sin tests de componentes** | Andamiaje montado (jsdom + testing-library, entorno por fichero con `@vitest-environment`): smoke tests de Overview (tarjetas, KPIs, buscador, navegación) y Toasts fijan el patrón para ampliar. |

## Pendiente (a propósito)

### PATCH parcial para campos pequeños

Cada guardado sigue subiendo el proyecto entero por PUT, aunque el cambio sea
un solo campo (`progress`, `watchers`, `deptShare`). Con el bloqueo optimista
ya no hay riesgo de pisado, solo coste de ancho de banda en proyectos grandes.

**Cuándo**: si los PUT de proyectos con decenas de miles de apuntes empiezan a
notarse o fallar. **Diseño**: endpoint PATCH con lista blanca de campos ligeros
+ misma condición de versión; el PUT completo queda solo para los imports.

### Resumen precalculado en servidor (para dispositivos nuevos)

El sync incremental elimina la descarga repetida, pero un dispositivo nuevo
sigue bajándose todos los proyectos completos la primera vez (una sola vez,
luego queda en caché).

**Cuándo**: si el primer arranque en un dispositivo nuevo tarda demasiado con
el volumen real. **Diseño**: columna `resumen` (KPIs del Overview) calculada al
guardar; `GET ?vista=resumen` para pintar el Overview al instante y detalle
bajo demanda al abrir cada proyecto.

### Otras decisiones aplazadas

| Tema | Estado | Cuándo reabrirlo |
| --- | --- | --- |
| **Configuración de negocio editable** | Departamentos estándar, cuentas contables (9990/9101), umbrales (70/110/85, 30 días) y regex de clasificación están en constantes con nombre, pero en código. | Si Gestión pide cambiarlos sin redeploy: tabla `jp_config` (jsonb) + pantalla en Administración. |
| **react-router / deep links** | La navegación es estado en memoria (no hay URLs por proyecto). El lazy-loading que motivaba el router ya se logró con `lazy()`. | Si se quiere compartir por enlace un proyecto o pestaña concretos. |
| **Purga del soft-delete** | Las filas borradas se conservan indefinidamente (volumen irrelevante hoy). Ojo: purgarlas elimina también su tombstone (un dispositivo con copia local muy antigua podría revivirlas). | Si algún día estorban: `DELETE ... WHERE deleted_at < now() - interval '90 days'` en un cron. |
| **Tests E2E** | Los 107 tests cubren lógica pura y componentes en jsdom; no hay E2E real de navegador (los flujos se verifican a mano en cada cambio). | Si el equipo crece o las regresiones de UI empiezan a colarse: Playwright con el flujo import → dashboard como primer caso. |
