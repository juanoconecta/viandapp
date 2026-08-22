"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type EstadoAuth =
  | { status: "idle" }
  | { status: "error"; mensaje: string };

// Solo permite rutas internas (un único "/" inicial) para evitar open
// redirects si el campo oculto `redirect` fue manipulado en el cliente
// (ej. `//evil.com` es protocol-relative y redirect() lo trataría como
// externo). Defensa en profundidad: app/login/page.tsx ya sanitiza esto
// al armar el form.
function sanitizarRedirect(valor: string): string {
  if (valor.startsWith("/") && !valor.startsWith("//")) {
    return valor;
  }
  return "/app";
}

export async function iniciarSesion(
  _prevState: EstadoAuth,
  formData: FormData,
): Promise<EstadoAuth> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const redirectTo = sanitizarRedirect(String(formData.get("redirect") ?? "/app"));

  if (!email || !password) {
    return { status: "error", mensaje: "Completá tu email y tu contraseña." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { status: "error", mensaje: "Email o contraseña incorrectos." };
  }

  redirect(redirectTo);
}

export async function registrarse(
  _prevState: EstadoAuth,
  formData: FormData,
): Promise<EstadoAuth> {
  const nombre = String(formData.get("nombre") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!nombre || !email || !password) {
    return { status: "error", mensaje: "Completá todos los campos." };
  }

  if (password.length < 6) {
    return {
      status: "error",
      mensaje: "La contraseña tiene que tener al menos 6 caracteres.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { nombre } },
  });

  if (error) {
    if (error.message.toLowerCase().includes("already registered")) {
      return {
        status: "error",
        mensaje: "Ya existe una cuenta con ese email. Iniciá sesión.",
      };
    }
    return {
      status: "error",
      mensaje: "No pudimos crear tu cuenta. Probá de nuevo.",
    };
  }

  redirect("/app");
}

export async function cerrarSesion() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
