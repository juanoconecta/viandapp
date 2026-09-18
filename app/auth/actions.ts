"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { sanitizarRedirect } from "@/lib/auth/redirect";
import { resolverOrigin } from "@/lib/auth/origin";

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

export async function solicitarRecuperacion(
  _prevState: EstadoAuth,
  formData: FormData,
): Promise<EstadoAuth> {
  const email = String(formData.get("email") ?? "").trim();

  if (!email) {
    return { status: "error", mensaje: "Completá tu email." };
  }

  const supabase = await createClient();

  // La plantilla de mail de recuperación (Supabase Dashboard) apunta a
  // /auth/confirm con el token, no a este redirectTo — igual lo pasamos
  // por si algún día se vuelve a usar la plantilla default de Supabase.
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${await resolverOrigin()}/auth/actualizar-contrasena`,
  });

  // Mensaje siempre igual, exista o no la cuenta: evita que este formulario
  // se pueda usar para detectar qué emails están registrados.
  return {
    status: "verificar",
    mensaje:
      "Si existe una cuenta con ese email, te mandamos un link para restablecer tu contraseña.",
  };
}

export async function actualizarContrasena(
  _prevState: EstadoAuth,
  formData: FormData,
): Promise<EstadoAuth> {
  const password = String(formData.get("password") ?? "");
  const repetirPassword = String(formData.get("repetirPassword") ?? "");

  if (!password || !repetirPassword) {
    return { status: "error", mensaje: "Completá los dos campos." };
  }

  if (password.length < 6) {
    return {
      status: "error",
      mensaje: "La contraseña tiene que tener al menos 6 caracteres.",
    };
  }

  if (password !== repetirPassword) {
    return { status: "error", mensaje: "Las contraseñas no coinciden." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    return {
      status: "error",
      mensaje: "No pudimos actualizar tu contraseña. Pedí un link nuevo e intentá de nuevo.",
    };
  }

  redirect("/app");
}

export async function confirmarRecuperacion(
  _prevState: EstadoAuth,
  formData: FormData,
): Promise<EstadoAuth> {
  const tokenHash = String(formData.get("tokenHash") ?? "");
  const redirectTo = sanitizarRedirect(String(formData.get("redirect") ?? "/auth/actualizar-contrasena"));

  if (!tokenHash) {
    return { status: "error", mensaje: "Este link de recuperación no es válido." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    type: "recovery",
    token_hash: tokenHash,
  });

  if (error) {
    return {
      status: "error",
      mensaje: "Este link ya venció o ya fue usado. Pedí uno nuevo.",
    };
  }

  redirect(redirectTo);
}

export async function cerrarSesion() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

export async function iniciarSesionConGoogle(formData: FormData) {
  const redirectTo = sanitizarRedirect(String(formData.get("redirect") ?? "/app"));
  const origin = await resolverOrigin();

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
