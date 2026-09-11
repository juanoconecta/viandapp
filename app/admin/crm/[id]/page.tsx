import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { esAdmin } from "@/lib/auth/admin";
import { obtenerDetalleContacto } from "@/lib/crm/consultas";
import DetalleContacto from "@/components/admin/crm/DetalleContacto";

export default async function AdminCrmDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!esAdmin(user?.email)) {
    redirect("/app");
  }

  const { id } = await params;
  const detalle = await obtenerDetalleContacto(id);
  if (!detalle) notFound();

  return <DetalleContacto detalle={detalle} />;
}
