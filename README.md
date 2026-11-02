# SIELE Trainer Pro

*Plataforma independiente de simulacros, evaluación y preparación personalizada del español.*

> Producto independiente. No está afiliado, certificado ni respaldado por SIELE, el Instituto Cervantes ni las universidades que lo promueven. Los resultados son estimaciones pedagógicas, nunca calificaciones oficiales.

## Qué incluye

- **Tres roles separados** (estudiante, profesora, administración) con permisos aplicados en la base de datos (RLS + funciones `SECURITY DEFINER`), no solo en la interfaz.
- **Motor de simulacros** con 7 tipos de tarea (selección única, asociación, huecos desplegables, fragmentos, selección múltiple, escritura, oral grabada), temporizadores controlados por el servidor, guardado automático con copia local ante cortes, reproducción de audio limitada por el servidor, grabación con MediaRecorder verificada en Storage (tamaño + SHA‑256), modo práctica (corrección inmediata) y modo formal.
- **Simulacro 01 completo y original**: 38 ítems de lectura, 38 de audición (audios con voces sintéticas de 6 variedades del español, identificadas como tales), 2 tareas escritas y 5 orales con ilustraciones propias.
- **Corrección docente**: rúbricas 0–5 versionadas (ponderaciones de la Guía de preparadores 2016), anotaciones sobre fragmentos del texto o momentos del audio, borradores, historial, nueva entrega, publicación, informe imprimible y exportación CSV.
- **Diagnóstico y plan**: errores recurrentes con evidencias, tres prioridades con indicador de progreso, biblioteca de 56 micro‑lecciones con ejercicios y planes de 15/30/60 min al día.
- **Administración**: usuarios y roles, clases, invitaciones (solo se guarda el hash), editor de simulacros con validación y versiones inmutables, vista previa, multimedia, rúbricas, «Fuentes, versión y metodología», auditoría automática, retención de datos y IA opcional (solo sugerencias que la profesora revisa).
- **Manual de evaluación y preparación del SIELE** integrado (capítulos A–F).

Stack: Next.js 16 (App Router) · React 19 · TypeScript estricto · Tailwind CSS 4 · Supabase (Auth, Postgres, Storage, RLS) · Zod · Vitest · PGlite (pruebas de RLS con Postgres real).

### Camino del estudiante

El inicio propone siempre un único paso (`src/lib/student/next-step.ts`): elegir el nivel objetivo, hacer la prueba de nivel, crear el plan, seguir las actividades de cada día y comprobar el nivel con un simulacro. Lo que falta en cada prueba se calcula con la tabla pública de referencia (`src/lib/diagnosis/target.ts`), y el plan recorre los módulos del nivel de partida al nivel objetivo (`generatePlan`). La biblioteca (`src/content/refuerzo*.ts`) cubre de A1 a C1, con especial atención a los errores de quien habla portugués.

## Puesta en marcha

1. **Supabase**: cree un proyecto. En *Authentication → Providers → Email* desactive «Allow new users to sign up» (las cuentas se crean con invitación desde el servidor). En *URL Configuration* añada `https://SU-DOMINIO/auth/confirm` como Redirect URL.
2. **Migraciones**: `npx supabase link --project-ref XXXX` y `npx supabase db push` (o pegue en orden los archivos de `supabase/migrations/` en el editor SQL). Crean tablas, RLS, funciones, buckets privados `recordings` y `exam-media` y sus políticas.
3. **Variables**: copie `.env.example` a `.env.local` y complete URL, clave publicable y clave secreta.
4. `npm install` · `npm run dev`.
5. **Primer administrador** (no hay contraseñas por defecto):
   `node --env-file=.env.local --experimental-strip-types scripts/bootstrap-admin.ts admin@centro.edu "Nombre"` → abre un enlace de un solo uso para definir la contraseña.
6. **Contenido de ejemplo**: `node --env-file=.env.local --experimental-strip-types scripts/seed-content.ts` (sube audios e imágenes y publica el Simulacro 01). Sus claves están en el repositorio: para simulacros formales cree contenido nuevo en `/admin/simulacros`.
7. **Usuarios de prueba** (solo en un proyecto separado): `ALLOW_TEST_USERS=true node --env-file=.env.test --experimental-strip-types scripts/create-test-users.ts` (contraseñas aleatorias mostradas una vez).

### Pruebas de extremo a extremo

Con la aplicación en marcha (`npm run dev`), `npm run test:e2e` recorre con Chromium y un micrófono simulado el simulacro completo, la corrección y la publicación, además de los casos límite (micrófono sin sonido, fin del tiempo durante una grabación, nueva entrega). Usa el alumno y la profesora de prueba de `ACESSOS.txt` y borra al terminar la asignación temporal que crea.

### Despliegue en Vercel

Importe el repositorio de GitHub en Vercel, configure las variables de `.env.example` (las `NEXT_PUBLIC_*` y `SUPABASE_SECRET_KEY` como *Sensitive*) y `NEXT_PUBLIC_SITE_URL` con el dominio final. GitHub Pages no sirve: la aplicación necesita servidor.

**Comprobación tras el despliegue**: acceder como admin · crear clase e invitación · registrarse como estudiante · asignar el simulacro · hacer un intento con audio y micrófono (https) · corregir y publicar · ver el informe como estudiante · revisar `/admin/auditoria`.

### Copias de seguridad, revocación y borrado

- Active backups diarios/PITR en Supabase y exporte con `npx supabase db dump -f backup.sql`; restaure con `psql` sobre un proyecto nuevo y copie los buckets.
- Revocar acceso: `/admin/usuarios → Revocar acceso` (la base de datos deja de servir datos al instante y se bloquean las sesiones).
- Eliminar cuenta: `/admin/usuarios → Eliminar` (borra datos y grabaciones; queda auditado). Retención configurable en `/admin/datos`.

## Calidad

```bash
npm run lint && npm run typecheck && npm test && npm run build
```

`npm test` ejecuta las pruebas unitarias y las de base de datos: las migraciones reales se aplican sobre PGlite con una emulación mínima de Supabase (`supabase/tests/support`) para comprobar RLS, permisos, temporizadores, corrección, grabaciones, publicación y nuevas entregas.

Audios y figuras: `pip install edge-tts && python scripts/generate_audio.py` · `node scripts/rasterize-images.mjs`.

## Limitaciones conocidas

- Las conversiones a nivel usan tablas públicas de 2016 (marcadas «edición antigua»); comprensión solo muestra el intervalo de la franja. Varias reglas orales tienen fuentes contradictorias y se documentan en `/admin/fuentes`.
- Las URL firmadas de audio duran 10 min: el límite de escuchas lo impone el servidor al emitir cada URL, no impide reutilizar una URL ya emitida.
- Los tiempos de preparación oral se reinician si el estudiante recarga antes de grabar (el límite global de la prueba sigue en el servidor).
