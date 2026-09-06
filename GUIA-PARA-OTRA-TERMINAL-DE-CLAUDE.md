# Conectar una invitación al sistema de invitados

**Para quien lea esto (otra terminal de Claude Code):**
El sistema ya está construido y andando en producción. Tu trabajo es conectar
**una invitación nueva** —con su propio diseño— a un panel que ya existe.

No hay que crear nada en Supabase. No hay que tocar el panel. Todas las bodas
comparten la misma base de datos.

**No toques el diseño de la invitación.** Se agregan dos archivos, cuatro `id=`
en el HTML que ya existe, y unas líneas de script. Colores, fotos, animaciones
y tipografías quedan como están.

---

## 1. Qué es el sistema

Dos cosas separadas que hablan con la misma base:

```
PANEL (uno solo, para todos los clientes)
  https://sistema-panel-omega.vercel.app/admin
  Repo: github.com/RamiusCode/sistema-panel
  Carpeta: D:\Invitaciones Web\sistema-invitados

INVITACIONES (una por boda, cada una con su diseño)
  Ejemplo: https://boda-ana-lucia-y-marcelo-2026.vercel.app
  Carpeta: D:\Invitaciones Web\boda\<nombre>\

                    ambos →  BASE DE DATOS (Supabase, proyecto "bodas")
```

El link que se manda por WhatsApp lleva **solo un código**:

```
https://la-invitacion.vercel.app/?i=k7m2p
```

El nombre y los pases viven en la base. Si el cliente corrige un nombre en el
panel, **el link ya enviado muestra el nombre corregido**. Eso es lo que se le
vende al cliente, y es la razón de que el nombre no viaje en la URL.

### Roles

| Quién | Qué ve |
|---|---|
| `super` (el dueño del negocio) | Todas las bodas, crea clientes y prende funciones |
| `novio` (el cliente) | Solo su boda: sus invitados y confirmaciones |

La separación está en las **políticas RLS de la base**, no en el JavaScript.
Si agregás alguna restricción nueva, tiene que ir también en una política: un
`if` en el frontend no protege nada.

### Funciones por cliente

Cada boda guarda en `bodas.funciones` (jsonb) qué contrató:

```json
{ "pases": true, "confirmacion": true, "cantidad": false,
  "mesa": false, "acompanantes": false }
```

La invitación las recibe junto con el nombre y los pases, y muestra u oculta
según eso. **Un solo código para todos los clientes.**

⚠️ `cantidad`, `mesa` y `acompanantes` se comparan con `=== true`. Las bodas
viejas no tienen esas claves y tienen que seguir comportándose como antes.

---

## 2. Credenciales

Son públicas por diseño: viajan al navegador de cada invitado.

```
PUBLIC_SUPABASE_URL=https://wfyfiimpcvxnbzngubmb.supabase.co
PUBLIC_SUPABASE_KEY=sb_publishable_LxIxjpM_I80eCg0rimoenw_rH-his92
```

Son **las mismas para todas las bodas**. Lo que protege los datos son las
políticas RLS, no esconder la clave.

⚠️ Nunca uses ni pidas la clave `service_role` / `secret`.

---

## 3. Archivos a copiar

Desde `D:\Invitaciones Web\sistema-invitados\` al proyecto de la invitación:

```
src/lib/supabase.ts                     →  src/lib/supabase.ts
src/lib/invitado.ts                     →  src/lib/invitado.ts
src/componentes/LinkNoDisponible.astro  →  src/components/LinkNoDisponible.astro
```

`src/componentes/Pase.astro` y `Confirmar.astro` son **ejemplos de referencia**,
no para copiar enteros: cada invitación tiene su diseño. De ahí se sacan solo
las líneas de script.

---

## 4. Los pasos

### PASO 1 — La librería

```
npm install @supabase/supabase-js
```

### PASO 2 — El `.env`

En la raíz del proyecto de la invitación, con las dos líneas de la sección 2.

⚠️ El prefijo es `PUBLIC_`, **no** `NEXT_PUBLIC_`. Astro solo expone `PUBLIC_`.
Verificá que `.gitignore` tenga `.env`.

### PASO 3 — La tarjeta del pase

Agregarle cuatro `id` al HTML que ya existe:

| Elemento | `id` |
|---|---|
| Donde va el nombre | `nombre-invitado` |
| El número de pases | `numero-pases` |
| La palabra "pase/pases" | `palabra-pases` |
| El contenedor de los monigotes | `iconos-pase` |

Y en su `<script>`:

```js
import { datosInvitado, alCambiarInvitado } from "../lib/invitado";

function pintarPase(nombre, pases) {
  if (nombre) {
    const el = document.getElementById("nombre-invitado");
    if (el) el.textContent = nombre;
  }
  if (Number.isInteger(pases) && pases > 0) {
    const num = document.getElementById("numero-pases");
    const palabra = document.getElementById("palabra-pases");
    if (num) num.textContent = String(pases);
    if (palabra) palabra.textContent = pases === 1 ? "pase" : "pases";
    // Si la tarjeta dibuja un monigote por pase, regenerarlos acá
  }
}

function mostrar(inv) {
  if (!inv) return;

  // Hay clientes que no contratan pases: su tarjeta muestra solo el nombre.
  // Sin esto quedaría un "1 pase en su honor" inventado.
  if (inv.funciones && inv.funciones.pases === false) {
    for (const id of ["numero-pase", "texto-pase", "iconos-pase"]) {
      const el = document.getElementById(id);
      if (el) el.style.display = "none";
    }
    pintarPase(inv.nombre, null);
    return;
  }

  pintarPase(inv.nombre, inv.pases);
}

datosInvitado().then(mostrar);
alCambiarInvitado(mostrar);   // se actualiza sin que el invitado recargue
```

⚠️ **Si la tarjeta achica el nombre según su largo**, esa escala vive en DOS
lados: el render del servidor (frontmatter de Astro) y este script. Tienen que
coincidir exactamente, o el nombre salta de tamaño al cargar. Y no lo fuerces a
una sola línea: un "Familia Rodríguez Fernández" termina ilegible. Dejalo usar
dos renglones.

### PASO 4 — El modal de confirmación

```js
import { datosInvitado, confirmarAsistencia, alCambiarInvitado } from "../lib/invitado";

await confirmarAsistencia(true, cuantosVienen, nombresAcompanantes);
await confirmarAsistencia(false);
```

Ver `src/componentes/Confirmar.astro` para el ejemplo completo. Tiene:

- El selector **− 2 +**, solo si `inv.funciones.cantidad === true`
- Campos de acompañantes, solo si `inv.funciones.acompanantes`
- La pantalla de "ya confirmaste" si vuelve a entrar por su link
- La sección entera se esconde si `inv.funciones.confirmacion === false`

⚠️ **La cantidad tiene que seguir a los pases** mientras el invitado no elija
otra con los botones. Si se lee una sola vez al abrir, un invitado que abrió
con 4 pases confirma 4 aunque los novios se lo hayan corregido a 5 mientras
tanto. Eso ya pasó.

### PASO 5 — La pantalla de link borrado

Copiar `LinkNoDisponible.astro` y agregarlo arriba de todo en `index.astro`:

```astro
import LinkNoDisponible from "../components/LinkNoDisponible.astro";
...
<Layout title="...">
    <LinkNoDisponible />
```

Sin esto, un invitado que los novios borraron sigue viendo la invitación con el
nombre genérico, cree que sigue invitado y se presenta el día de la boda.

### PASO 6 — Vercel

1. Settings → Environment Variables
2. Type: **Config**, NO *Secret*
3. El nombre se **escribe a mano**, no se pega
4. Deployments → ⋯ → **Redeploy**, **desmarcando** "Use existing Build Cache"

### PASO 7 — Dar de alta la boda (lo hace el humano, en el panel)

En `sistema-panel-omega.vercel.app/admin`:

1. **+ Nueva boda** — nombre, fecha, funciones contratadas, y sobre todo la
   **Dirección del sitio**: el dominio de Vercel de ESA invitación
2. **Nuevo cliente** — correo y contraseña; el panel arma el mensaje de WhatsApp

---

## 5. Cómo probar que funciona

1. Cargar un invitado de prueba con 3 pases
2. **Solo link** → abrir en otra pestaña → se ve su nombre y sus 3 pases
3. **Editar** los pases a 5 → volver a la pestaña de la invitación →
   cambia **sin recargar** (máximo 10 segundos, o instantáneo al volver a la pestaña)
4. Confirmar desde la invitación → la fila del panel cambia sola, con destello
5. **Borrar** el invitado → recargar su link → "Invitación no disponible"
6. Abrir la invitación **sin** `?i=` → tiene que verse el pase genérico, sin romperse
7. Borrar los invitados de prueba antes de entregar

---

## 6. Errores que ya cometimos

1. **`NEXT_PUBLIC_` en vez de `PUBLIC_`.** Astro solo expone `PUBLIC_`.

2. **Variables como *Secret* en Vercel.** Llegan **vacías** al build y el sitio
   sale sin conexión sin decir por qué. Van como **Config**. Se diagnostica
   mirando el bundle publicado: `const ms="", Ha=""` en vez de la URL.

3. **Pegar el nombre de la variable en Vercel.** Arrastra caracteres invisibles
   y lo rechaza con *"contains invalid characters"*. Se escribe a mano.

4. **Agregar las variables y no redesplegar.** Vercel no reconstruye solo.

5. **Dejar vacía la Dirección del sitio.** Los links salen apuntando al panel y
   no le abren a nadie.

6. **Importar `supabase` de forma estática en la invitación.** Son 220 KB que se
   bajan en todas las visitas aunque el link no traiga código. `invitado.ts` usa
   `import()` dinámico: no lo cambies.

7. **No envolver en `.catch()`.** Si Supabase no responde —proyecto pausado, sin
   internet— la invitación tiene que mostrar los valores por defecto, no
   romperse. `invitado.ts` ya lo hace, y distingue "no existe" de "no contestó"
   justamente para no dejar afuera a un invitado real por un problema de red.

8. **Leer los datos una sola vez.** Los novios corrigen mientras el invitado
   tiene la página abierta. Usar `alCambiarInvitado`.

9. **Cambiar la escala del tamaño del nombre en un solo lado.** Está en el
   servidor y en el script.

10. **Armar la misma frase en varios lugares.** "Tienes N pases reservados"
    estaba en tres, y en uno se perdió el número. Una sola función.

---

## 7. Si hay que tocar el panel

Está todo en un archivo: `src/pages/admin.astro` (HTML + CSS + JS, sin Tailwind,
para que la herramienta y las invitaciones no se pisen los estilos).

Antes de dar por terminado un cambio ahí, correr esto: avisa si algún `$("id")`
del script apunta a un elemento que no existe, que es el error que deja la
pantalla colgada en "Cargando…" sin decir nada.

```js
const fs=require("fs");const s=fs.readFileSync("src/pages/admin.astro","utf8");
const p=[...new Set([...s.matchAll(/\$\("([a-z0-9\-]+)"\)/g)].map(m=>m[1]))];
const e=new Set([...s.matchAll(/id="([a-z0-9\-]+)"/g)].map(m=>m[1]));
console.log("ids faltantes:", p.filter(i=>!e.has(i)).join(", ") || "ninguno");
```

El panel tiene un **modo demo** en `/admin?demo=1`: datos inventados, sin login
y sin tocar la base. Sirve para revisar diseño sin ensuciar nada.

Y `/sql` lista los archivos de `supabase/` con un botón de copiar, para pegarlos
en el editor de Supabase sin usar la terminal.
