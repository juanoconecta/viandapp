-- Rollback de 202609050001_crm_integrado.sql
-- Revierte exactamente lo que esa migración crea, en orden inverso. No
-- toca ninguna tabla/columna preexistente (vianderas, viandas, pedidos,
-- interesados_viandera) más allá de quitarles los triggers/funciones que
-- la migración les agregó. Nunca correr sin haber confirmado antes que
-- hay un backup restaurable del proyecto.

begin;

drop view if exists public.crm_contactos_resumen;

drop trigger if exists crm_vincular_pedido_consentido_trigger on public.pedidos;
drop function if exists public.crm_vincular_pedido_consentido();

drop trigger if exists crm_sincronizar_viandera_trigger on public.vianderas;
drop function if exists public.crm_sincronizar_viandera();

drop trigger if exists crm_sincronizar_interesado_trigger on public.interesados_viandera;
drop function if exists public.crm_sincronizar_interesado();

drop trigger if exists crm_contactos_set_updated_at on public.crm_contactos;

drop table if exists public.crm_interacciones;
drop table if exists public.crm_tareas;
drop table if exists public.crm_notas;
drop table if exists public.crm_contacto_pedidos;
drop table if exists public.crm_contactos;

drop function if exists public.crm_normalizar_contacto(text);

commit;
