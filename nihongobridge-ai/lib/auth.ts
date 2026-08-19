import type { NextRequest } from "next/server";
import { createRemoteJWKSet } from "jose/jwks/remote";
import { jwtVerify } from "jose/jwt/verify";
import type { JWTPayload } from "jose";

export type SubscriptionTier = "free" | "premium";

export interface AuthenticatedUser {
  id: string;
  roles: string[];
  tier: SubscriptionTier;
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

function appMetadata(payload: JWTPayload): Record<string, unknown> {
  return payload.app_metadata && typeof payload.app_metadata === "object"
    ? payload.app_metadata as Record<string, unknown>
    : {};
}

function rolesFromPayload(payload: JWTPayload): string[] {
  const roles = new Set<string>();
  if (typeof payload.role === "string") roles.add(payload.role);
  const metadata = appMetadata(payload);
  if (typeof metadata.role === "string") roles.add(metadata.role);
  if (Array.isArray(metadata.roles)) {
    for (const role of metadata.roles) if (typeof role === "string") roles.add(role);
  }
  return [...roles];
}

function tierFromPayload(payload: JWTPayload): SubscriptionTier {
  const metadata = appMetadata(payload);
  const plan = metadata.subscription_tier ?? metadata.plan;
  return metadata.is_premium === true || plan === "premium" || plan === "pro"
    ? "premium"
    : "free";
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
    remoteJwks ??= createRemoteJWKSet(
      new URL(`${supabaseUrl}/auth/v1/.well-known/jwks.json`),
    );
    ({ payload } = await jwtVerify(token, remoteJwks, {
      issuer: process.env.SUPABASE_JWT_ISSUER ?? `${supabaseUrl}/auth/v1`,
      audience: "authenticated",
    }));
  } else {
    throw new AuthenticationError("JWT verification is not configured");
  }

  if (!payload.sub) throw new AuthenticationError("JWT subject is missing");
  return {
    id: payload.sub,
    roles: rolesFromPayload(payload),
    tier: tierFromPayload(payload),
  };
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
    const id = request.headers.get("x-user-id")?.trim();
    if (id) {
      const roles = request.headers
        .get("x-user-roles")
        ?.split(",")
        .map((role) => role.trim())
        .filter(Boolean) ?? [];
      const tier = request.headers.get("x-user-tier") === "premium" ? "premium" : "free";
      return { id, roles, tier };
    }
  }

  throw new AuthenticationError("Authentication required");
}

export function assertQuestionAuthor(user: AuthenticatedUser): void {
  if (!user.roles.some((role) => ["admin", "super_admin", "content_editor"].includes(role))) {
    throw new AuthenticationError("Question generation requires content editor access", 403);
  }
}

export function resetAuthState(): void {
  remoteJwks = undefined;
}
