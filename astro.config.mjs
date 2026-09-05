// @ts-check
import { defineConfig } from "astro/config";

// Sitio estático: el panel es 100% navegador, habla con Supabase directo.
// No lleva Tailwind — el CSS del panel es propio y va dentro de admin.astro,
// para que la herramienta y las invitaciones no se pisen los estilos.
export default defineConfig({});
