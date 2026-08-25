import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { Request, Response } from "express";
import {
  AuthenticationError,
  OidcIdentityVerifier,
  loadOidcConfig,
  localIdentity,
  type OidcConfig,
} from "./identity.js";
import { createServer } from "./server.js";
import { createStorage, type PlanStorage } from "./storage/index.js";

function parsePort(): number {
  const port = Number.parseInt(process.env.PORT ?? "3001", 10);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error(`PORT inválido: ${process.env.PORT}`);
  return port;
}

function publicBaseUrl(port: number): string {
  const configured = process.env.PUBLIC_BASE_URL?.trim();
  const value = (configured || `http://localhost:${port}`).replace(/\/+$/g, "");
  const url = new URL(value);
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:") {
    throw new Error("PUBLIC_BASE_URL debe usar HTTPS en producción.");
  }
  return value;
}

function metadataDocument(baseUrl: string, config: OidcConfig) {
  return {
    resource: `${baseUrl}/mcp`,
    authorization_servers: [config.authorizationServer],
    bearer_methods_supported: ["header"],
    resource_name: "Plan Viewer Plugin",
    ...(config.requiredScopes.length ? { scopes_supported: config.requiredScopes } : {}),
  };
}

function unauthorized(res: Response, baseUrl: string, error?: AuthenticationError): void {
  const metadataUrl = `${baseUrl}/.well-known/oauth-protected-resource/mcp`;
  const description = (error?.message || "Authentication required").replace(/["\\]/g, "");
  res.setHeader(
    "WWW-Authenticate",
    `Bearer error="invalid_token", error_description="${description}", resource_metadata="${metadataUrl}"`,
  );
  res.status(401).json({ error: "invalid_token", error_description: description });
}

export async function startStreamableHTTPServer(storage: PlanStorage): Promise<void> {
  const port = parsePort();
  const baseUrl = publicBaseUrl(port);
  const oidcConfig = loadOidcConfig();
  const verifier = new OidcIdentityVerifier(oidcConfig);
  const app = createMcpExpressApp({ host: "0.0.0.0" });

  app.get("/healthz", (_req: Request, res: Response) => {
    res.status(200).json({ ok: true, service: "plan-viewer-plugin", version: "0.2.0", storage: storage.backend });
  });

  const serveMetadata = (_req: Request, res: Response) => {
    res.setHeader("Cache-Control", "public, max-age=300");
    res.status(200).json(metadataDocument(baseUrl, oidcConfig));
  };
  app.get("/.well-known/oauth-protected-resource", serveMetadata);
  app.get("/.well-known/oauth-protected-resource/mcp", serveMetadata);

  app.all("/mcp", async (req: Request, res: Response) => {
    let identity;
    try {
      identity = await verifier.verifyAuthorizationHeader(req.get("authorization"));
    } catch (error) {
      if (error instanceof AuthenticationError) {
        unauthorized(res, baseUrl, error);
        return;
      }
      console.error("Error de autenticación:", error);
      res.status(500).json({ error: "server_error", error_description: "Authentication service unavailable" });
      return;
    }

    const server = createServer({ storage, identity });
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });

    res.on("close", () => {
      transport.close().catch(() => {});
      server.close().catch(() => {});
    });

    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      console.error("MCP error:", error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: { code: -32603, message: "Internal server error" },
          id: null,
        });
      }
    }
  });

  const httpServer = app.listen(port, (error?: Error) => {
    if (error) {
      console.error("No se pudo iniciar el servidor:", error);
      process.exit(1);
    }
    console.log(`Plan Viewer Plugin MCP escuchando en ${baseUrl}/mcp`);
  });

  const shutdown = () => {
    httpServer.close(() => {
      storage.close().finally(() => process.exit(0));
    });
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

export async function startStdioServer(storage: PlanStorage): Promise<void> {
  const server = createServer({ storage, identity: localIdentity() });
  await server.connect(new StdioServerTransport());
}

async function main(): Promise<void> {
  const stdio = process.argv.includes("--stdio");
  const storage = createStorage(stdio ? "stdio" : "http");
  if (stdio) {
    await startStdioServer(storage);
  } else {
    await startStreamableHTTPServer(storage);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
