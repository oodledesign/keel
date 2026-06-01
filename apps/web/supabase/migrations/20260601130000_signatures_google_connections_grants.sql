-- google_connections was created after the blanket signatures table grants; service_role
-- (used by Keel server admin client) needs explicit table privileges.

grant all on signatures.google_connections to postgres, service_role;
grant select, insert, update, delete on signatures.google_connections to authenticated;

notify pgrst, 'reload schema';
