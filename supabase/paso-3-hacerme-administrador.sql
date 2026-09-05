-- ═══════════════════════════════════════════════════════════════════════════
--  PASO 3 · DARTE PERMISOS DE ADMINISTRADOR
--
--  Correr esto DESPUÉS de crear tu usuario en Authentication → Users.
--
--  Al crearse, todo usuario nuevo entra como 'novio' (cliente). Esto asciende
--  al PRIMER usuario de la base —vos— a administrador, para que veas todas
--  las bodas y puedas crear clientes.
--
--  Se puede correr varias veces sin romper nada.
-- ═══════════════════════════════════════════════════════════════════════════


-- 1. Por si el perfil no se creó solo, se crea ahora.
insert into public.perfiles (id, rol)
select id, 'novio' from auth.users
on conflict (id) do nothing;


-- 2. El primer usuario que se creó en esta base pasa a ser el administrador.
--    Se lo busca por fecha de creación en vez de por correo para que no haya
--    que editar este texto ni equivocarse escribiendo el mail.
update public.perfiles
set rol = 'super',
    boda_id = null          -- el administrador no pertenece a ninguna boda
where id = (select id from auth.users order by created_at asc limit 1);


-- 3. Comprobación.
--    Tiene que devolver UNA fila, con tu correo y la palabra 'super'.
--    Si dice 'novio', el paso 2 no encontró al usuario: revisá que lo hayas
--    creado en Authentication → Users.
select u.email,
       p.rol,
       case when p.rol = 'super'
            then 'Listo: sos el administrador'
            else 'Todavía no es administrador'
       end as estado
from public.perfiles p
join auth.users u on u.id = p.id
order by u.created_at asc;
