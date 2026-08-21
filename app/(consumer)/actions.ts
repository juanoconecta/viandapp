"use server";

import { createClient } from "@/lib/supabase/server";

export type EstadoFormularioInteres =
  | { status: "idle" }
  | { status: "ok" }
  | { status: "error"; mensaje: string };

export async function anotarseComoInteresada(
  _prevState: EstadoFormularioInteres,
  formData: FormData,
): Promise<EstadoFormularioInteres> {
  const nombre = String(formData.get("nombre") ?? "").trim();
  const contacto = String(formData.get("contacto") ?? "").trim();
  const zona = String(formData.get("zona") ?? "").trim();
  const instagram = String(formData.get("instagram") ?? "").trim();
  const mensaje = String(formData.get("mensaje") ?? "").trim();

  if (!nombre || !contacto) {
    return { status: "error", mensaje: "Completá al menos tu nombre y un contacto." };
  }

  const supabase = await createClient();

  const { error } = await supabase.from("interesados_viandera").insert({
    nombre,
    contacto,
    zona: zona || null,
    instagram: instagram || null,
    mensaje: mensaje || null,
  });

  if (error) {
    return {
      status: "error",
      mensaje: "No pudimos guardar tu anotación. Probá de nuevo en un rato.",
    };
  }

  return { status: "ok" };
}
