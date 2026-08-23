export function esAdmin(email: string | null | undefined): boolean {
  const adminEmail = process.env.ADMIN_EMAIL;
  return Boolean(
    adminEmail && email && email.toLowerCase() === adminEmail.toLowerCase(),
  );
}
