import { createHash } from "node:crypto";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";

export type UserIdentity = {
  ownerId: string;
  authMode: "local" | "oauth";
};

export type OidcConfig = {
  issuer: string;
  audience: string;
  jwksUri: string;
  authorizationServer: string;
  requiredScopes: string[];
};

export class AuthenticationError extends Error {
  constructor(message = "Authentication required") {
    super(message);
    this.name = "AuthenticationError";
  }
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} es obligatorio para el modo HTTP.`);
  return value;
}

export function loadOidcConfig(): OidcConfig {
  const issuer = requiredEnv("OIDC_ISSUER");
  const audience = requiredEnv("OIDC_AUDIENCE");
  const jwksUri = requiredEnv("OIDC_JWKS_URI");
  const authorizationServer = (process.env.OIDC_AUTHORIZATION_SERVER || issuer).trim();
  const requiredScopes = (process.env.OIDC_REQUIRED_SCOPES || "")
    .split(/[ ,]+/)
    .map((scope) => scope.trim())
    .filter(Boolean);
  return { issuer, audience, jwksUri, authorizationServer, requiredScopes };
}

export function localIdentity(): UserIdentity {
  const raw = (process.env.PLAN_VIEWER_LOCAL_USER || "ddadda69").trim();
  if (!raw) throw new Error("PLAN_VIEWER_LOCAL_USER no puede estar vacío.");
  const stable = createHash("sha256").update(`local\0${raw}`).digest("base64url");
  return { ownerId: `local:${stable}`, authMode: "local" };
}

export function extractBearerToken(header: string | undefined): string {
  if (!header) throw new AuthenticationError();
  const match = /^Bearer\s+([^\s]+)$/i.exec(header.trim());
  if (!match) throw new AuthenticationError("Authorization debe usar Bearer token.");
  return match[1];
}

function scopesFromPayload(payload: JWTPayload): Set<string> {
  const scopes = new Set<string>();
  if (typeof payload.scope === "string") {
    for (const scope of payload.scope.split(/\s+/)) if (scope) scopes.add(scope);
  }
  const scp = payload.scp;
  if (Array.isArray(scp)) {
    for (const scope of scp) if (typeof scope === "string") scopes.add(scope);
  } else if (typeof scp === "string") {
    for (const scope of scp.split(/\s+/)) if (scope) scopes.add(scope);
  }
  return scopes;
}

export class OidcIdentityVerifier {
  private readonly jwks;

  constructor(readonly config: OidcConfig) {
    this.jwks = createRemoteJWKSet(new URL(config.jwksUri));
  }

  async verifyAuthorizationHeader(header: string | undefined): Promise<UserIdentity> {
    const token = extractBearerToken(header);
    try {
      const { payload } = await jwtVerify(token, this.jwks, {
        issuer: this.config.issuer,
        audience: this.config.audience,
      });
      if (!payload.sub) throw new AuthenticationError("El token no contiene subject.");

      const scopes = scopesFromPayload(payload);
      const missing = this.config.requiredScopes.filter((scope) => !scopes.has(scope));
      if (missing.length) throw new AuthenticationError(`Faltan scopes requeridos: ${missing.join(", ")}.`);

      const stable = createHash("sha256")
        .update(`${this.config.issuer}\0${payload.sub}`)
        .digest("base64url");
      return { ownerId: `oauth:${stable}`, authMode: "oauth" };
    } catch (error) {
      if (error instanceof AuthenticationError) throw error;
      throw new AuthenticationError("Token OAuth inválido o caducado.");
    }
  }
}
