import type { JWTPayload } from "jose";
import { createRemoteJWKSet } from "jose/jwks/remote";
import { jwtVerify } from "jose/jwt/verify";
import { NextResponse, type NextRequest } from "next/server";

const roles = new Set(["super_admin", "content_editor", "reviewer"]);
let jwks: ReturnType<typeof createRemoteJWKSet> | undefined;

export async function middleware(request: NextRequest) {
  if (demoAllowed()) {
    return withIdentity(request, {
      id: "00000000-0000-4000-8000-000000009001",
      role: "super_admin",
    });
  }

  try {
    const token = bearer(request) ?? request.cookies.get("sb-access-token")?.value;
    if (!token) return unauthorized(request);
    const payload = await verifyToken(token);
    const role = adminRole(payload);
    if (!payload.sub || !role) return forbidden(request);
    if (!authorizedForRoute(role, request)) return forbidden(request);
    return withIdentity(request, { id: payload.sub, role });
  } catch {
    return unauthorized(request);
  }
}

function demoAllowed(): boolean {
  return (
    process.env.ADMIN_DEMO_MODE === "true" ||
    (process.env.NODE_ENV !== "production" && process.env.ADMIN_DEMO_MODE !== "false")
  );
}

function bearer(request: NextRequest): string | null {
  const value = request.headers.get("authorization");
  return value?.startsWith("Bearer ") ? value.slice(7).trim() : null;
}

async function verifyToken(token: string): Promise<JWTPayload> {
  const secret = process.env.SUPABASE_JWT_SECRET;
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  if (secret) {
    return (
      await jwtVerify(token, new TextEncoder().encode(secret), {
        algorithms: ["HS256"],
        audience: "authenticated",
      })
    ).payload;
  }
  if (!url) throw new Error("Auth not configured");
  jwks ??= createRemoteJWKSet(new URL(`${url}/auth/v1/.well-known/jwks.json`));
  return (
    await jwtVerify(token, jwks, {
      issuer: process.env.SUPABASE_JWT_ISSUER ?? `${url}/auth/v1`,
      audience: "authenticated",
    })
  ).payload;
}

function adminRole(payload: JWTPayload): string | null {
  const metadata = payload.app_metadata;
  const role =
    metadata && typeof metadata === "object" && typeof Reflect.get(metadata, "role") === "string"
      ? String(Reflect.get(metadata, "role"))
      : typeof payload.admin_role === "string"
        ? payload.admin_role
        : null;
  return role && roles.has(role) ? role : null;
}

function authorizedForRoute(role: string, request: NextRequest): boolean {
  if (role === "super_admin" || request.method === "GET" || request.method === "HEAD") return true;
  const path = request.nextUrl.pathname;
  if (role === "reviewer") {
    return path.startsWith("/api/admin/reviews") && ["POST", "PATCH"].includes(request.method);
  }
  // Editors may manage content, questions, media, tests, and blog, but not execute ETL.
  return !path.startsWith("/api/admin/etl") && !path.startsWith("/api/admin/roles");
}

function withIdentity(request: NextRequest, identity: { id: string; role: string }) {
  const headers = new Headers(request.headers);
  headers.set("x-admin-user-id", identity.id);
  headers.set("x-admin-role", identity.role);
  return NextResponse.next({ request: { headers } });
}

function unauthorized(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  const url = new URL("/login", request.url);
  url.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(url);
}

function forbidden(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Admin role required" }, { status: 403 });
  }
  return NextResponse.redirect(new URL("/login?error=forbidden", request.url));
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
