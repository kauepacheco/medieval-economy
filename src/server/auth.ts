import { LOCAL_OWNER_ID } from "../domain/content";
import { GameError } from "../domain/errors";

export function assertLocalDevelopment(env: NodeJS.ProcessEnv = process.env) {
  if (env.NODE_ENV === "production" || env.LOCAL_DEV_AUTH !== "true") {
    throw new GameError(403, "This prototype requires local development mode. Public authentication is not implemented.");
  }
}

export function requireLocalOwner(request: Request, env: NodeJS.ProcessEnv = process.env) {
  assertLocalDevelopment(env);
  const configured = new URL(env.APP_ORIGIN ?? "http://127.0.0.1:3000");
  const allowedHosts = ["127.0.0.1", "localhost", "[::1]"];
  if (configured.protocol !== "http:" || !allowedHosts.includes(configured.hostname) || configured.username || configured.password) throw new GameError(403, "Configure APP_ORIGIN with a local HTTP address.");
  const url = new URL(request.url);
  // Next.js normalizes request.url to localhost internally. Validate the actual
  // Host strictly, while allowing that internal loopback alias at the same port.
  if (url.protocol !== configured.protocol || !allowedHosts.includes(url.hostname) || url.port !== configured.port || request.headers.get("host") !== configured.host) throw new GameError(403, "Only the configured local address can access this village.");
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") throw new GameError(403, "Cross-site requests are not allowed.");
  if (request.method !== "GET" && request.headers.get("origin") !== configured.origin) throw new GameError(403, "A same-origin request is required.");
  return LOCAL_OWNER_ID;
}
