import "server-only";

import { hmacIp } from "./hmacIp";

export function hmacIpDesdeEnv(ip: string): string {
  const secreto = process.env.RATE_LIMIT_SECRET;
  if (!secreto) {
    throw new Error("RATE_LIMIT_SECRET no configurado.");
  }
  return hmacIp(ip, secreto);
}
