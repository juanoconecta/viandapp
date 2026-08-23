import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { esAdmin } from "@/lib/auth/admin";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const esRutaApp = pathname === "/app" || pathname.startsWith("/app/");
  const esRutaViandera =
    pathname === "/viandera" || pathname.startsWith("/viandera/");
  const esRutaAdmin = pathname === "/admin" || pathname.startsWith("/admin/");

  const redirigirCon = (destino: string, extra?: (url: URL) => void) => {
    const url = new URL(destino, request.url);
    extra?.(url);
    const response = NextResponse.redirect(url);
    supabaseResponse.cookies
      .getAll()
      .forEach((cookie) => response.cookies.set(cookie));
    return response;
  };

  if (!user && (esRutaApp || esRutaViandera || esRutaAdmin)) {
    return redirigirCon("/login", (url) =>
      url.searchParams.set("redirect", pathname),
    );
  }

  if (user && esRutaAdmin && !esAdmin(user.email)) {
    return redirigirCon("/app");
  }

  if (user && esRutaViandera) {
    const { data: vianderaPropia } = await supabase
      .from("vianderas")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!vianderaPropia) {
      const vianderasIdPendiente = user.user_metadata?.vianderas_id as
        | string
        | undefined;
      let vinculada = false;

      if (vianderasIdPendiente) {
        const admin = createAdminClient();
        const { data: reclamada } = await admin
          .from("vianderas")
          .update({ user_id: user.id })
          .eq("id", vianderasIdPendiente)
          .is("user_id", null)
          .select("id")
          .maybeSingle();
        vinculada = Boolean(reclamada);
      }

      if (!vinculada) {
        return redirigirCon("/app");
      }
    }
  }

  return supabaseResponse;
}
