"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { sanitizarRedirect } from "@/lib/auth/redirect";

export type EstadoAuth =
  | { status: "idle" }
  | { status: "error"; mensaje: string }
  | { status: "verificar"; mensaje: string };

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
  const { data, error } = await supabase.auth.signUp({
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

  if (!data.session) {
    return {
      status: "verificar",
      mensaje: "Te mandamos un mail para confirmar tu cuenta. Revisá tu casilla.",
    };
  }

  redirect("/app");
}

export async function cerrarSesion() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

export async function iniciarSesionConGoogle(formData: FormData) {
  const redirectTo = sanitizarRedirect(String(formData.get("redirect") ?? "/app"));
  const headersList = await headers();
  const host = headersList.get("host");
  const protocol = host?.startsWith("localhost") ? "http" : "https";
  const origin = `${protocol}://${host}`;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback?redirect=${encodeURIComponent(redirectTo)}`,
    },
  });

  if (error || !data.url) {
    redirect("/login?error=oauth");
  }

  redirect(data.url);
}
