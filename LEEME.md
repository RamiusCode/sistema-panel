# Sistema de invitados multi-cliente

**Esta carpeta es un proyecto Astro independiente: EL PANEL.**
Se despliega una sola vez y queda para siempre. Las carpetas de cada boda se
borran cuando la boda termina; esta no. Guardala en otro disco.

    npm install
    npm run dev      →  http://localhost:4321/admin

Una sola base de datos de Supabase para todos los clientes. Cada cliente entra
a su panel y solo ve sus invitados. Vos entrás y ves todos.

---

## 1. Qué hace

Cargás el nombre de un invitado y cuántos pases le tocan. El sistema genera un
link corto y único:

    https://la-invitacion.vercel.app/?i=k7m2p

Ese link se manda por WhatsApp. Al abrirlo, la invitación muestra el nombre de
**ese** invitado y su cantidad de pases, y le deja confirmar asistencia.

**La ventaja que se le vende al cliente:** el nombre NO está dentro del link,
solo un código. Vive en la base. Si escribieron mal un nombre, lo corrigen en
el panel y el link YA ENVIADO muestra el nombre corregido. No hay que reenviar
nada.

**Y para vos:** un solo proyecto de Supabase gratis aguanta decenas de bodas.
El plan gratis permite 2 proyectos activos **por usuario** (no por
organización, no por cuenta de correo — crear organizaciones nuevas no
multiplica el cupo). Con este sistema ese límite deja de importar.

---

## 2. Cómo está armado

```
bodas ──────── un renglón por cliente
   slug, nombre, fecha, sitio_url, registro_abierto, funciones

invitados ──── todos los invitados de todas las bodas
   boda_id → bodas, codigo (único global), nombre, pases,
   confirmado, asisten, acompanantes, mesa

perfiles ───── quién es quién
   usuario → 'super' (vos) o 'novio' (el cliente) + su boda_id
```

### Las funciones por cliente

La columna `bodas.funciones` es un JSON con las casillas que ese cliente tiene
contratadas:

```json
{ "confirmacion": true, "mesa": false, "acompanantes": false }
```

Las prendés y apagás desde tu panel. El panel del cliente muestra la columna
"Mesa" solo si está prendida; la invitación pide confirmación solo si está
prendida. **Un solo código para todos los clientes.**

### Lo que hace que sea seguro

La separación entre clientes está en la **base de datos** (políticas RLS), no
en la pantalla:

```sql
create policy "invitados: ver los de mi boda"
  on public.invitados for select to authenticated
  using (public.soy_super() or boda_id = public.mi_boda());
```

El cliente 2 puede abrir F12 y manipular todo el JavaScript que quiera: no hay
forma de que vea la lista del cliente 1. Postgres se la niega.

Esconder un botón no protege nada. Si alguna vez agregás una restricción
nueva, tiene que ir también en una política.

---

## 3. Archivos

| Archivo | Qué es |
|---|---|
| `supabase/schema.sql` | Todo el SQL. Se corre una sola vez, en el proyecto nuevo |
| `src/pages/admin.astro` | El panel completo (super + cliente), CSS y JS incluidos |
| `package.json` · `astro.config.mjs` | Para que esta carpeta corra sola |
| `src/lib/supabase.ts` | Cliente de Supabase + generador de códigos |
| `src/lib/invitado.ts` | Puente entre la invitación y la base |
| `src/componentes/Pase.astro` | Ejemplo de la tarjeta del pase conectada |
| `src/componentes/Confirmar.astro` | Ejemplo del modal de confirmación conectado |
| `.github/workflows/despertar-supabase.yml` | El ping diario que evita que la base se duerma |
| `.env.example` | Las dos variables que hacen falta |

---

## 4. Puesta en marcha (una sola vez)

### PASO 1 — El proyecto de Supabase

1. supabase.com → **New project**
2. Region: **South America (São Paulo)** si los clientes están en Sudamérica
3. Guardá la contraseña de la base
4. `Project Settings → API Keys`, copiá dos valores:
   - **Project URL** → `https://xxxxxxxx.supabase.co`
   - **anon / publishable** → empieza con `sb_publishable_...`

⚠️ **NUNCA** uses ni compartas la clave `service_role` / `secret`. Esa es la
llave maestra: quien la tenga borra toda la base salteándose el RLS.

### PASO 2 — Las tablas

SQL Editor → New query → pegar TODO `supabase/schema.sql` → **Run**.

Va a salir "Potential issue detected / destructive operations". Es normal (el
script tiene `drop policy if exists` para poder correrlo varias veces).
Resultado esperado: **Success. No rows returned**

### PASO 3 — Tu usuario

Authentication → Users → **Add user → Create new user**

⚠️ Marcá **Auto Confirm User**. Si no, Supabase espera un correo de
confirmación que nunca llega y el usuario no entra nunca.
Los correos pueden ser inventados: funcionan como nombre de usuario.

Después, en SQL Editor:

```sql
update public.perfiles
set rol = 'super', boda_id = null
where id = (select id from auth.users where email = 'admin@invita.com');

select u.email, p.rol from public.perfiles p join auth.users u on u.id = p.id;
```

⚠️ El rol se llama exactamente `'super'`. La tabla solo acepta `'super'` o
`'novio'`; cualquier otra cosa da
`ERROR 23514 violates check constraint "perfiles_rol_check"`.

### PASO 4 — El despertador

⚠️ El plan gratuito **pausa el proyecto tras 7 días sin consultas**. Entre que
se reparten las invitaciones y llega la boda pueden pasar semanas de calma. Si
se pausa, los invitados abren su link y no ven su nombre, y nadie se entera.

Copiá `.github/workflows/despertar-supabase.yml` a **UNO** de los repos y
cambiale la URL y la clave. Con una sola base compartida, **un solo
despertador cubre todas las bodas**.

Se prueba a mano: GitHub → Actions → Despertar Supabase → Run workflow.
Debe dar HTTP 200 y devolver `[]`.

---

## 5. Dar de alta un cliente nuevo

1. **En tu panel** → `+ Nueva boda`
   - Nombre, identificador corto (`ana-lucia-marcelo`), fecha
   - **Dirección del sitio**: el dominio de Vercel de ESA boda. De ahí salen
     los links de los invitados. Si lo dejás vacío se usa el dominio desde
     donde abriste el panel, que puede ser el equivocado
   - Marcá las funciones que contrató

2. **En Supabase** → Authentication → Add user → el correo y la contraseña del
   cliente (con **Auto Confirm User**)

3. **En tu panel** → `Asignar cliente` → pegás ese correo y elegís su boda

> Crear el usuario no se puede hacer desde el panel porque requiere la clave
> `service_role`, que jamás puede ir al navegador. Son 30 segundos a mano.

4. En el sitio de esa boda copiá SOLO `src/lib/` y el `.env` con las **mismas
   dos variables** (todas las bodas comparten base), y conectá los componentes
   según la sección 6.

   ⚠️ **La invitación NO lleva panel.** El `/admin` vive únicamente acá, en su
   propio sitio. Al cliente le pasás la dirección de este panel y su usuario:
   entra y va directo a su boda. Así, cuando borres la carpeta de una boda
   terminada, el panel y todos los datos siguen intactos.

---

## 6. Conectar la invitación

En el componente que muestra el pase, dentro del `<script>`:

```js
import { datosInvitado } from "../lib/invitado";

datosInvitado().then((inv) => {
  if (inv) pintarPase(inv.nombre, inv.pases);
});
```

Y en el de confirmación:

```js
import { datosInvitado, confirmarAsistencia } from "../lib/invitado";

await confirmarAsistencia(true, cuantos);   // confirma
await confirmarAsistencia(false);           // avisa que no viene
```

`src/componentes/Pase.astro` y `Confirmar.astro` son ejemplos completos y
funcionando. Copiá de ahí.

⚠️ **NO importar `supabase` de forma estática** en la invitación. La librería
pesa 220 KB. `invitado.ts` la carga con `import()` dinámico, así solo se baja
cuando el link trae `?i=`. Si la importás arriba del archivo, se la comen
todas las visitas.

⚠️ **Todo envuelto en `.catch()`.** Si Supabase no responde (proyecto pausado,
sin internet), la invitación NO debe romperse: muestra los valores por defecto
y el invitado ni se entera. `invitado.ts` ya lo hace.

---

## 7. Desplegar en Vercel

1. Settings → Environment Variables → **Add**
2. Type: **Config**, NO "Secret".
   (Secret oculta el valor para siempre. Estas claves son públicas por diseño,
   conviene poder verlas después para verificar.)
3. Las dos:
   ```
   PUBLIC_SUPABASE_URL = https://xxxxxxxx.supabase.co
   PUBLIC_SUPABASE_KEY = sb_publishable_xxxxxxxx
   ```
4. ⚠️ **Vercel NO reconstruye solo al agregar variables.**
   Deployments → en el más reciente, menú ⋯ → **Redeploy**
   → **DESMARCAR** "Use existing Build Cache" → Redeploy

   Sin este paso el sitio sigue sirviendo el build viejo, sin las variables, y
   `/admin` queda muerto.

5. Probar con **Ctrl+Shift+R** (recarga forzada, sin caché)

---

## 8. Errores que ya cometimos (no repetirlos)

1. **`NEXT_PUBLIC_` en vez de `PUBLIC_`.** La ventana "Connect" de Supabase
   muestra los ejemplos con `NEXT_PUBLIC_` porque asume Next.js. Astro solo
   expone las que empiezan con `PUBLIC_`. Este error costó un despliegue roto.

2. **Agregar las variables en Vercel y no redesplegar.** El sitio en línea
   sigue con el build viejo y `/admin` queda muerto.

3. **Dejar que `createClient()` lance al faltar las variables.** Mata todo el
   script y la página queda colgada en "Cargando…" sin decir por qué. Por eso
   `supabase.ts` exporta un flag `configurado` y crea el cliente solo si hay
   configuración.

4. **Escribir un rol que no existe.** Solo `'super'` o `'novio'`.

5. **Elegir "Secret" en el tipo de variable de Vercel.** Estas claves son
   públicas por diseño; con "Config" se pueden verificar después.

6. **`flex-wrap: wrap` en la celda de acciones.** En escritorio apila los
   botones en columna y estira las filas. Va `nowrap`, y `wrap` solo en móvil.

7. **Importar Supabase estáticamente en la invitación.** Agrega 220 KB a
   todas las visitas aunque el link no traiga código.

8. **Confiar en esconder botones para restringir permisos.** La restricción
   tiene que estar en las políticas RLS.

9. **Crear organizaciones nuevas en Supabase para tener más proyectos gratis.**
   No funciona: el cupo de 2 se cuenta **por usuario**, sumando todas las
   organizaciones donde seas Owner o Admin.

---

## 9. Cómo probar que todo funciona

1. Entrar a `/admin` con tu usuario → debe verse la **lista de bodas**
2. Crear una boda de prueba y asignarle un usuario cliente
3. Entrar con ese usuario → debe ir **directo a su boda**, sin ver la lista
4. Agregar un invitado de prueba → aparece con su link
5. Copiar el link, abrirlo en otra pestaña → se ve ese nombre en el pase
6. **Editar el nombre desde el panel → recargar el link → muestra el nuevo.**
   Esta es la prueba que demuestra el valor del sistema
7. Confirmar desde el link con el panel abierto en otra ventana → la fila
   cambia sola, sin recargar, y el punto **● En vivo** está verde
8. Prender "Mesa" en los ajustes de esa boda → aparece la columna
9. Con el usuario cliente, intentar ver otra boda → no debe poder
10. Apagar el interruptor de registro → el formulario desaparece
11. Abrir el panel en un celular → barra lateral con hamburguesa y la tabla
    convertida en tarjetas
12. Copiar mensaje → pegar en WhatsApp → los asteriscos salen en negrita
13. Borrar los invitados de prueba antes de entregar

---

## 10. Límites del plan gratis

| | Límite | 50 bodas × 100 invitados |
|---|---|---|
| Proyectos activos | **2 por usuario** | 1 |
| Base de datos | 500 MB | ~2 MB |
| Egress | 5 GB/mes | casi nada |
| Usuarios (MAU) | 50.000 | ~100 |
| Conexiones realtime | 200 simultáneas | 2 o 3 |
| Mensajes realtime | 2.000.000/mes | unos miles |

**El riesgo real no es la capacidad, es el huevo en una sola canasta:** si
esta base se rompe, se caen todos los clientes a la vez, y el plan gratis no
hace backups automáticos.

Hacé un export periódico:
Supabase → Table Editor → `invitados` → **Export to CSV**.

Cuando tengas varios clientes pagando, los $25/mes del plan Pro (con backups y
sin pausas) van a parecerte baratos.
