-- ═══════════════════════════════════════════════════════════════════════════
--  PASO 4 · VER Y RECORDAR EL ACCESO DE CADA CLIENTE
--
--  Correr esto una sola vez, igual que los anteriores.
--  Se puede correr varias veces sin romper nada.
--
--  Hace dos cosas:
--    1. Deja ver qué cliente entra a cada boda (su correo)
--    2. Guarda el correo y la contraseña para poder reenviárselos
--
--  ⚠️ SOBRE GUARDAR LA CONTRASEÑA
--  La contraseña de verdad la guarda Supabase como una huella imposible de
--  revertir; eso no cambia. Lo que se guarda acá es una COPIA aparte, para
--  poder reenviarla cuando el cliente la olvide.
--
--  Guardar contraseñas en texto es mala práctica en general. Se hace acá
--  porque son cuentas descartables: correos inventados, claves generadas por
--  el propio panel, que solo abren la lista de invitados de una boda y que
--  nadie reusa en otro lado. Aun así, la tabla es ILEGIBLE para todos menos
--  para el administrador: ni siquiera el cliente puede leer la suya.
-- ═══════════════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────────────
--  1. QUÉ CLIENTE ENTRA A CADA BODA
-- ───────────────────────────────────────────────────────────────────────────

create or replace function public.clientes_de(la_boda uuid)
returns table (
  correo         text,
  creado         timestamptz,
  ultimo_ingreso timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  -- Solo el administrador. Sin esto, un cliente podría pedir los correos de
  -- los clientes de otra boda.
  if not public.soy_super() then
    raise exception 'Solo el administrador puede ver esto';
  end if;

  return query
  select u.email::text, u.created_at, u.last_sign_in_at
  from public.perfiles p
  join auth.users u on u.id = p.id
  where p.boda_id = la_boda and p.rol = 'novio'
  order by u.created_at asc;
end;
$$;

revoke all on function public.clientes_de(uuid) from public;
grant execute on function public.clientes_de(uuid) to authenticated;


-- ───────────────────────────────────────────────────────────────────────────
--  2. LA COPIA DEL ACCESO
--
--  Una tabla aparte, y no una columna en `perfiles`, justamente para que sea
--  fácil de cerrar: acá adentro no entra nadie que no sea el administrador.
-- ───────────────────────────────────────────────────────────────────────────

create table if not exists public.accesos (
  correo      text primary key,
  boda_id     uuid references public.bodas (id) on delete cascade,
  clave       text not null,
  actualizado timestamptz not null default now()
);

create index if not exists accesos_boda_idx on public.accesos (boda_id);

alter table public.accesos enable row level security;

-- Una sola política, y solo para el administrador. Los clientes no tienen
-- NINGUNA: para ellos esta tabla no existe.
drop policy if exists "accesos: solo el administrador" on public.accesos;

create policy "accesos: solo el administrador"
  on public.accesos for all to authenticated
  using (public.soy_super())
  with check (public.soy_super());


notify pgrst, 'reload schema';


-- ───────────────────────────────────────────────────────────────────────────
--  3. COMPROBACIÓN
--
--     Lee las tablas directamente en vez de llamar a clientes_de(). Esa
--     función exige ser administrador, y el editor de SQL no corre como tu
--     usuario sino como el dueño de la base: se negaría a sí misma, y como
--     todo el texto corre junto, el error desharía también lo de arriba.
--
--     La columna `clave` va a estar vacía hasta que crees un cliente nuevo
--     desde el panel, o le generes una contraseña nueva.
-- ───────────────────────────────────────────────────────────────────────────

select b.nombre                as boda,
       u.email                 as correo,
       a.clave,
       u.last_sign_in_at       as ultimo_ingreso
from public.bodas b
left join public.perfiles p on p.boda_id = b.id and p.rol = 'novio'
left join auth.users u      on u.id = p.id
left join public.accesos a  on lower(a.correo) = lower(u.email)
order by b.fecha;
