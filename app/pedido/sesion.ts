"use server";

import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "viandapp_sesion";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function asegurarSesionPedido(): Promise<string> {
  const cookieStore = await cookies();
  const currentValue = cookieStore.get(COOKIE_NAME)?.value;

  if (currentValue && UUID_PATTERN.test(currentValue)) {
    return currentValue;
  }

  const sessionId = randomUUID();

  // Opaque, server-issued secondary rate-limit signal; never authentication
  // and never the IP security boundary.
  cookieStore.set(COOKIE_NAME, sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });

  return sessionId;
}
