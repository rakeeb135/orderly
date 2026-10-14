import type { CookieOptions } from "@supabase/ssr";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC = ["/", "/login", "/register", "/403"];
const HOME: Record<string, string> = { student: "/student/dashboard", mentor: "/mentor/dashboard", admin: "/admin/dashboard" };

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(list: { name: string; value: string; options: CookieOptions }[]) {
          list.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  // getUser() validates the JWT with Supabase Auth (never trust getSession() alone on the server).
  const { data: { user } } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC.includes(path) || path.startsWith("/auth/");

  if (!user) {
    if (isPublic) return response;
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  const { data: profile } = await supabase.from("profiles").select("role, is_active").eq("id", user.id).single();

  if (profile && !profile.is_active && !path.startsWith("/auth/")) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/deactivated";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (profile && (path === "/login" || path === "/register")) {
    const url = request.nextUrl.clone();
    url.pathname = HOME[profile.role];
    url.search = "";
    return NextResponse.redirect(url);
  }

  // Role gate: /student/*, /mentor/*, /admin/* only for the matching role (FR-02.2) -> 403 page.
  const area = ["student", "mentor", "admin"].find((r) => path === `/${r}` || path.startsWith(`/${r}/`));
  if (area && profile && profile.role !== area) {
    const url = request.nextUrl.clone();
    url.pathname = "/403";
    return NextResponse.rewrite(url, { status: 403 });
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
