# App Guardias

App web para que los bomberos del cuartel carguen sus guardias del mes siguiente desde el navegador.

- Cuenta propia con mail de contacto, nombre y apellido, legajo (147/XXX), dependencia (CM, Dto 1 o Dto 2) y clave.
- Cada día tiene guardia **diurna** y **nocturna**, con **7 lugares** cada una.
- Cada persona elige hasta **6 guardias** por mes.
- Al elegir, el lugar queda **retenido 10 minutos** (desde la primera guardia elegida). Los demás lo ven ocupado al instante.
- Al confirmar se guardan todas y llega un **mail con el reporte**.
- Los administradores ven el **listado de usuarios** y el **calendario del mes**, igual a la planilla de Excel y listo para imprimir en A4 apaisada.
- El **superusuario** (el programador) nombra y quita administradores.

Todo corre en planes gratis: **GitHub Pages** (la página), **Supabase** (login, base de datos, tiempo real y la función de mail) y **Brevo** (envío de mails).

## Roles

| Rol | Qué puede hacer | Cómo se asigna |
|---|---|---|
| Usuario | Cargar y confirmar sus guardias, corregir sus datos | Todos arrancan así al crear la cuenta |
| Administrador | Además: pantalla **Usuarios** y **Calendario** | Lo nombra el superusuario desde la pantalla Usuarios |
| Superusuario | Además: cambiar el rol de cualquiera | El primero se pone con una línea de SQL (paso 1.5). Después, desde la app |

Siempre tiene que quedar al menos un superusuario: la app no deja quitar el último. Tampoco te deja cambiar tu propio rol desde la pantalla; para eso, otro superusuario.

## Probarlo en tu computadora

Necesitás [Node.js](https://nodejs.org) 20 o más nuevo.

```bash
npm install
npm run dev
```

Abrí la dirección que aparece (normalmente http://localhost:5173). Sin el archivo `.env` arranca en **modo demostración**: podés ingresar con cualquier mail, entrás como superusuario, nada se guarda y se simula a otros bomberos reservando.

## Ponerlo en marcha de verdad

### 1. Supabase (base de datos y login)

1. Creá una cuenta en [supabase.com](https://supabase.com) y un proyecto nuevo (región *South America (São Paulo)*).
2. En **SQL Editor**, ejecutá uno por uno y en este orden los archivos de `supabase/migrations/`:
   1. `001_guardias.sql` (guardias, reservas y reglas)
   2. `002_limpieza_automatica.sql` (libera las retenciones vencidas cada minuto)
   3. `003_calendario.sql` (calendario imprimible)
   4. `004_usuarios_y_roles.sql` (datos de cada persona y roles)
3. En **Authentication > Sign In / Providers > Email**, dejá activado el login con mail. El mail de confirmación de cuenta que trae Supabase tiene un límite bajo de envíos por hora: para las pruebas con varias personas a la vez, desactivá **Confirm email** o configurá Brevo como SMTP en **Authentication > SMTP Settings**.
4. En **Project Settings > API** copiá la **Project URL** y la **anon key** (en proyectos nuevos se llama *publishable key*). Las vas a usar en el paso 4.
5. **Tu superusuario.** Cuando la página ya esté publicada (paso 4), creá tu cuenta en la app como cualquier usuario. Después, en el **SQL Editor**, ejecutá con tu mail:
   ```sql
   update public.profiles set rol = 'super' where email = 'tu-mail@ejemplo.com';
   ```
   Cerrá sesión y volvé a entrar: vas a ver los enlaces **Calendario** y **Usuarios**.

### 2. Brevo (mails del reporte)

1. Creá una cuenta gratis en [brevo.com](https://www.brevo.com).
2. En **Senders**, agregá y verificá el mail desde el que van a salir los reportes.
3. En **SMTP & API > API Keys**, generá una API key.

### 3. Función que envía el mail

En Supabase, **Edge Functions > Deploy a new function > Via Editor**:

1. Nombre: `enviar-reporte` (tiene que ser exactamente ese).
2. Pegá el contenido de `supabase/functions/enviar-reporte/index.ts` y desplegala.
3. En **Edge Functions > Secrets** cargá:

| Secreto | Valor |
|---|---|
| `BREVO_API_KEY` | la API key de Brevo |
| `REMITENTE_EMAIL` | el mail verificado en Brevo |
| `REMITENTE_NOMBRE` | opcional, ej. `Guardias Cuartel Central` |
| `COPIA_EMAIL` | opcional, recibe copia oculta de cada reporte (ej. la jefatura) |

### 4. GitHub Pages (publicar la página)

1. Creá un repositorio nuevo en GitHub (por ejemplo `guardias`) y subí esta carpeta a la rama `main`:
   ```bash
   git remote add origin https://github.com/TU-USUARIO/guardias.git
   git push -u origin main
   ```
2. En el repo, **Settings > Pages > Build and deployment > Source**: elegí **GitHub Actions**.
3. En **Settings > Secrets and variables > Actions > Variables**, creá dos variables de repositorio:
   - `VITE_SUPABASE_URL` = la Project URL
   - `VITE_SUPABASE_ANON_KEY` = la anon / publishable key

   Si no las cargás, la página se publica igual pero en modo demostración.
4. En **Actions**, abrí **Publicar en GitHub Pages** y tocá **Run workflow** (o subí cualquier cambio). En un par de minutos queda en `https://TU-USUARIO.github.io/guardias/`.
5. Volvé a Supabase, **Authentication > URL Configuration**, y poné esa dirección en **Site URL** y en **Redirect URLs**. Sin esto, los enlaces de "confirmar cuenta" y "me olvidé la clave" no vuelven a la app.

Cada vez que subas un cambio a `main`, la página se vuelve a publicar sola.

## Uso diario

- **Nombrar o quitar administradores (superusuario):** **Usuarios**, buscá a la persona y cambiá el rol en el desplegable. Se aplica al instante; la persona lo ve la próxima vez que entra.
- **Ver quién falta cargar (administradores):** **Usuarios > Sin guardias este mes**. También se puede filtrar por dependencia o buscar por apellido, legajo o mail.
- **Imprimir el calendario (administradores):** **Calendario > Imprimir** (o guardalo como PDF). Sale en una hoja A4 apaisada con las guardias confirmadas, como "Apellido I.". Las filas de Of. de Semana, Enc. Guardia, Ayte. Guardia y Chofer salen vacías para completar a mano.
- **Corregir mis datos (todos):** **Mis datos**. Las cuentas que no tengan legajo o dependencia tienen que completarlos antes de cargar guardias.
- **Borrar o corregir una guardia confirmada:** Supabase > **Table Editor > reservations**, borrá la fila. El contador de lugares se actualiza solo.
- **Borrar una cuenta:** Supabase > **Authentication > Users**, borrá el usuario. Se borran también su perfil y sus guardias.
- **Qué mes se carga:** siempre el siguiente al actual, en hora de Argentina.

## Cambiar las reglas

Los números se aplican en la base de datos y se muestran en la app, así que se cambian en los dos lugares:

- `supabase/migrations/001_guardias.sql`: funciones `cfg_max_por_guardia`, `cfg_max_por_persona` y `cfg_minutos_retencion` (volvé a ejecutar solo esas líneas en el SQL Editor).
- `src/config.ts`: los mismos valores, el nombre del cuartel y el horario opcional de cada franja.

Las dependencias (CM, Dto 1, Dto 2) y el formato del legajo (147/ + hasta 5 números) están en `004_usuarios_y_roles.sql` y en `src/ProfileFields.tsx`.

## Tené en cuenta

- En el plan gratis, Supabase **pausa el proyecto si pasa 7 días sin uso**. Se reactiva desde el panel con un clic. Conviene entrar a la app o al panel unos días antes de abrir la carga.
- Brevo gratis permite 300 mails por día, de sobra para un cuartel.

## Estructura

```
src/
  App.tsx            sesión y navegación entre pantallas
  Login.tsx          ingresar, crear cuenta, recuperar clave
  ProfileFields.tsx  nombre, apellido, legajo y dependencia
  MyData.tsx         completar o corregir mis datos
  Roster.tsx         planilla del mes, retención, revisión y confirmación
  Calendar.tsx       calendario imprimible (administradores)
  Users.tsx          listado de usuarios y roles (administradores)
  config.ts          reglas y textos que se muestran
  lib/api.ts         conexión con Supabase (y el modo demostración)
supabase/
  migrations/        tablas, reglas y permisos (SQL)
  functions/         envío del mail con el reporte
.github/workflows/   publicación automática en GitHub Pages
```
