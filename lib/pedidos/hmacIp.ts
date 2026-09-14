import { createHmac } from "node:crypto";

export function hmacIp(ip: string, secreto: string): string {
  return createHmac("sha256", secreto).update(ip).digest("hex");
}
