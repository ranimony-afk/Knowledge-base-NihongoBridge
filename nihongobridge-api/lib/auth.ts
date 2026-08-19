import type { NextRequest } from "next/server";
import {
  createRemoteJWKSet,
  jwtVerify,
  type JWTPayload,
} from "jose";

export interface AuthenticatedUser {
  id: string;
  roles: string[];
}

export class AuthenticationError extends Error {
  constructor(
    message: string,
    readonly status: 401 | 403 = 401,
  ) {
    super(message);
  }
}

let remoteJwks: ReturnType<typeof createRemoteJWKSet> | undefined;

function rolesFromPayload(payload: JWTPayload): string[] {
  const roles = new Set<string>();
  if (typeof payload.role === "string") roles.add(payload.role);
  const metadata = payload.app_metadata;
  if (metadata && typeof metadata === "object") {
    const role = Reflect.get(metadata, "role");
    const metadataRoles = Reflect.get(metadata, "roles");
    if (typeof role === "string") roles.add(role);
    if (Array.isArray(metadataRoles)) {
      for (const value of metadataRoles) if (typeof value === "string") roles.add(value);
    }
  }
  return [...roles];
}

async function verifyBearer(token: string): Promise<AuthenticatedUser> {
  const secret = process.env.SUPABASE_JWT_SECRET;
  const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, "");
  let payload: JWTPayload;

  if (secret) {
    ({ payload } = await jwtVerify(token, new TextEncoder().encode(secret), {
      algorithms: ["HS256"],
      audience: "authenticated",
    }));
  } else if (supabaseUrl) {
    remoteJwks ??= createRemoteJWKSet(new URL(`${supabaseUrl}/auth/v1/.well-known/jwks.json`));
    ({ payload } = await jwtVerify(token, remoteJwks, {
      issuer: process.env.SUPABASE_JWT_ISSUER ?? `${supabaseUrl}/auth/v1`,
      audience: "authenticated",
    }));
  } else {
    throw new AuthenticationError("JWT verification is not configured");
  }

  if (!payload.sub) throw new AuthenticationError("JWT subject is missing");
  return { id: payload.sub, roles: rolesFromPayload(payload) };
}

export async function authenticateRequest(request: NextRequest): Promise<AuthenticatedUser> {
  const authorization = request.headers.get("authorization");
  if (authorization?.startsWith("Bearer ")) {
    try {
      return await verifyBearer(authorization.slice(7).trim());
    } catch (error) {
      if (error instanceof AuthenticationError) throw error;
      throw new AuthenticationError("Invalid or expired access token");
    }
  }

  if (
    process.env.NODE_ENV !== "production" &&
    process.env.ALLOW_INSECURE_USER_HEADER === "true"
  ) {
    const id = request.headers.get("x-user-id");
    if (id) {
      const roles = request.headers
        .get("x-user-roles")
        ?.split(",")
        .map((role) => role.trim())
        .filter(Boolean) ?? [];
      return { id, roles };
    }
  }

  throw new AuthenticationError("Authentication required");
}

export function assertUserAccess(authenticated: AuthenticatedUser, requestedUserId: string): void {
  if (authenticated.id !== requestedUserId && !isAdmin(authenticated)) {
    throw new AuthenticationError("You cannot access another user's data", 403);
  }
}

export function assertAdmin(authenticated: AuthenticatedUser): void {
  if (!isAdmin(authenticated)) throw new AuthenticationError("Admin access required", 403);
}

export function isAdmin(authenticated: AuthenticatedUser): boolean {
  return authenticated.roles.some((role) =>
    ["admin", "super_admin", "content_editor"].includes(role),
  );
}

export function resetAuthState(): void {
  remoteJwks = undefined;
}
