// ═══════════════════════════════════════════════════════════════════════════
//  CREAR CLIENTE
//
//  Crea el usuario de un cliente y lo deja asignado a su boda, en un solo
//  paso, desde el panel.
//
//  ⚠️ POR QUÉ ESTO NO PUEDE VIVIR EN EL PANEL
//  Dar de alta un usuario exige la clave service_role, que se saltea todas
//  las reglas de seguridad de la base. El panel corre en el navegador y
//  cualquiera puede leer su código con F12: una clave así ahí sería regalarle
//  la base entera al primero que mire. Acá corre en el servidor de Supabase,
//  donde nadie la ve.
//
//  ⚠️ QUIÉN PUEDE LLAMARLA
//  Solo un usuario con rol 'super'. Se comprueba con la sesión de quien llama
//  ANTES de tocar nada. Sin esa comprobación, cualquiera con la clave pública
//  podría crearse un usuario y meterse en las bodas de los clientes.
// ═══════════════════════════════════════════════════════════════════════════

import { createClient } from "jsr:@supabase/supabase-js@2";

// El panel vive en otro dominio que la función, así que el navegador exige
// estos permisos antes de dejar pasar la llamada.
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function responder(cuerpo: unknown, estado = 200) {
  return new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

Deno.serve(async (peticion) => {
  // El navegador pregunta primero si puede llamar
  if (peticion.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  try {
    const URL_BASE = Deno.env.get("SUPABASE_URL")!;
    const CLAVE_PUBLICA = Deno.env.get("SUPABASE_ANON_KEY")!;
    const CLAVE_MAESTRA = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // ── 1. ¿Quién está llamando? ──
    const autorizacion = peticion.headers.get("Authorization");
    if (!autorizacion) {
      return responder({ error: "Hay que iniciar sesión." }, 401);
    }

    const comoElUsuario = createClient(URL_BASE, CLAVE_PUBLICA, {
      global: { headers: { Authorization: autorizacion } },
    });

    const { data: sesion } = await comoElUsuario.auth.getUser();
    if (!sesion?.user) {
      return responder({ error: "La sesión no es válida. Volvé a entrar." }, 401);
    }

    // ── 2. ¿Es el administrador? ──
    // Se pregunta con la sesión de quien llama, no con la clave maestra: así
    // la respuesta es la que da la base para ESE usuario.
    const { data: esSuper } = await comoElUsuario.rpc("soy_super");
    if (esSuper !== true) {
      return responder({ error: "Solo el administrador puede crear clientes." }, 403);
    }

    // ── 3. Los datos ──
    const { correo, clave, boda_id } = await peticion.json();

    if (!correo || typeof correo !== "string" || !correo.includes("@")) {
      return responder({ error: "El correo no es válido." }, 400);
    }
    if (!clave || typeof clave !== "string" || clave.length < 6) {
      return responder({ error: "La contraseña tiene que tener al menos 6 caracteres." }, 400);
    }
    if (!boda_id || typeof boda_id !== "string") {
      return responder({ error: "Falta elegir la boda." }, 400);
    }

    const conLlaveMaestra = createClient(URL_BASE, CLAVE_MAESTRA);

    // La boda tiene que existir: si no, quedaría un usuario sin poder entrar
    // a ningún lado y nadie se enteraría de por qué.
    const { data: laBoda } = await conLlaveMaestra
      .from("bodas").select("id, nombre").eq("id", boda_id).maybeSingle();

    if (!laBoda) {
      return responder({ error: "Esa boda no existe." }, 400);
    }

    // ── 4. Crear el usuario ──
    // email_confirm: true evita el correo de confirmación, que nunca llegaría
    // porque los correos de los clientes suelen ser inventados.
    const { data: creado, error: errorAlta } = await conLlaveMaestra.auth.admin.createUser({
      email: correo.trim().toLowerCase(),
      password: clave,
      email_confirm: true,
    });

    if (errorAlta) {
      const yaExiste = /already|registered|exists/i.test(errorAlta.message);
      return responder({
        error: yaExiste
          ? "Ya existe un usuario con ese correo. Usá otro, o asignalo con “Asignar cliente”."
          : errorAlta.message,
      }, 400);
    }

    // ── 5. Dejarlo asignado a su boda ──
    // Un disparador de la base ya le creó el perfil como 'novio' sin boda;
    // acá se le pone la suya.
    const { error: errorPerfil } = await conLlaveMaestra
      .from("perfiles")
      .upsert({ id: creado.user!.id, rol: "novio", boda_id });

    if (errorPerfil) {
      // Si no se pudo asignar, se borra el usuario recién creado. Mejor no
      // dejar a medias: un usuario que entra y no ve nada es peor que ninguno.
      await conLlaveMaestra.auth.admin.deleteUser(creado.user!.id);
      return responder({ error: "No se pudo asignar la boda: " + errorPerfil.message }, 500);
    }

    return responder({
      ok: true,
      correo: creado.user!.email,
      boda: laBoda.nombre,
    });
  } catch (e) {
    return responder({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
