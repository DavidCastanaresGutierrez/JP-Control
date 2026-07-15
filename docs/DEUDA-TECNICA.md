# Deuda técnica y próximos pasos de escalabilidad

Decisiones tomadas durante la auditoría de julio 2026 que quedaron **documentadas
a propósito en vez de implementadas**, con su justificación y la señal que
indicaría que ha llegado el momento de abordarlas.

## 1. Metadata ligera + carga de detalle bajo demanda

**Qué es**: hoy `GET /api/projects` devuelve todos los proyectos completos
(todos los apuntes y horas de cada uno) y cada guardado sube el proyecto entero
por PUT. El bloqueo optimista (columna `version`, julio 2026) impide que dos
usuarios se pisen, pero el *tamaño* de los payloads sigue siendo proporcional a
todos los datos.

**Por qué no se hizo**: el Overview calcula los KPIs en el cliente recorriendo
todas las `entries` de cada proyecto, así que la app necesita los datos
completos al arrancar. Un endpoint ligero exige mover ese cálculo al servidor,
un rediseño de otro calibre que con el volumen actual no se amortiza.

**Cuándo hacerlo**: si el arranque pasa de ~2-3 s por descarga de datos, o los
PUT de proyectos grandes (decenas de miles de apuntes) empiezan a fallar o a
notarse.

**Diseño previsto**:
1. Al hacer PUT, el servidor precalcula y guarda los KPIs del Overview
   (gasto, facturación, desvíos) en una columna propia de `jp_projects`
   (o los calcula el cliente y los manda junto al blob, verificables).
2. `GET /api/projects?vista=resumen` devuelve solo
   `{code, name, jp, kpis, version, updatedAt}` — KB en vez de MB.
3. El detalle completo se pide al abrir cada proyecto
   (`GET /api/projects?code=...`), con caché local en IndexedDB.
4. Opcional: PATCH parcial para los campos pequeños que se editan a menudo
   (`progress`, `watchers`, `deptShare`), dejando el PUT completo solo para
   los imports.

## 2. Otras decisiones aplazadas

| Tema | Estado | Cuándo reabrirlo |
| --- | --- | --- |
| **Soft-delete de proyectos** | El DELETE es definitivo, sin papelera ni traza. | Si algún borrado accidental duele. Añadir `deleted_at` y filtrar en el GET es barato. |
| **Token CSRF en el refresh SSO** | Las cookies van `SameSite=None` en producción; las operaciones sensibles exigen Bearer, así que el riesgo residual es bajo (solo se puede forzar un refresh). | Si se añade alguna operación que dependa solo de cookies. |
| **`@vercel/node` major (4.x)** | `npm audit` marca vulnerabilidades altas en el tooling de build (no llegan al navegador). El fix es un salto de major. | En el próximo ciclo de mantenimiento de dependencias, probando el deploy en preview. |
| **Configuración de negocio editable** | Departamentos estándar, cuentas contables (9990/9101), umbrales (70/110/85, 30 días) y regex de clasificación están en constantes con nombre, pero en código. | Si Gestión pide cambiarlos sin redeploy: tabla `jp_config` (jsonb) + pantalla en Administración. |
| **react-router / deep links** | La navegación es estado en memoria (no hay URLs por proyecto). El lazy-loading que motivaba el router ya se logró con `lazy()`. | Si se quiere compartir por enlace un proyecto o pestaña concretos. |
