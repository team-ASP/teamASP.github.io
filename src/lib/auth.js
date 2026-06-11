import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { aspData } from "@/lib/data";

const sessionCookieName = "asp_session";
const oauthStateCookieName = "asp_oauth_state";
const roleRank = { viewer: 0, editor: 1, maintainer: 2, admin: 3 };

function base64UrlEncode(value) {
  return Buffer.from(value).toString("base64url");
}

function base64UrlDecode(value) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function getSessionSecret() {
  return process.env.SESSION_SECRET || "";
}

export function isAuthConfigured() {
  return Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET && getSessionSecret());
}

export function getOAuthStateCookieName() {
  return oauthStateCookieName;
}

export function getSessionCookieName() {
  return sessionCookieName;
}

export function createOAuthState() {
  return randomBytes(24).toString("base64url");
}

export function getRequiredRole(action) {
  const map = {
    comment: "editor",
    draft: "editor",
    review: "maintainer",
    archive: "admin",
    admin: "admin",
  };
  return map[action] || "viewer";
}

export function can(role, action) {
  return roleRank[role] >= roleRank[getRequiredRole(action)];
}

export function getRoleForGitHubLogin(login) {
  const normalized = login.toLowerCase();
  const member = aspData.members.find((candidate) => candidate.github.toLowerCase() === normalized);
  return member?.siteRole || "editor";
}

export function signSession(payload) {
  const secret = getSessionSecret();
  if (!secret) throw new Error("SESSION_SECRET is required to sign sessions.");

  const body = base64UrlEncode(JSON.stringify(payload));
  const signature = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${signature}`;
}

export function verifySession(value) {
  const secret = getSessionSecret();
  if (!secret || !value) return null;

  const [body, signature] = value.split(".");
  if (!body || !signature) return null;

  const expected = createHmac("sha256", secret).update(body).digest("base64url");
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(signature);
  if (expectedBuffer.length !== actualBuffer.length || !timingSafeEqual(expectedBuffer, actualBuffer)) {
    return null;
  }

  const payload = JSON.parse(base64UrlDecode(body));
  if (payload.expiresAt && Date.now() > payload.expiresAt) return null;
  return payload;
}

export function getViewerSession() {
  return {
    authenticated: false,
    role: "viewer",
    organization: process.env.NEXT_PUBLIC_GITHUB_ORG || "team-ASP",
    editableScopes: [],
    authProvider: "github",
    authEnabled: process.env.NEXT_PUBLIC_AUTH_ENABLED === "true",
  };
}

export function getSessionFromRequest(request) {
  const token = request.cookies.get(sessionCookieName)?.value;
  const session = verifySession(token);
  if (!session) return getViewerSession();

  return {
    authenticated: true,
    role: session.role,
    login: session.login,
    name: session.name,
    avatarUrl: session.avatarUrl,
    organization: session.organization,
    editableScopes: session.editableScopes || [],
    authProvider: "github",
    authEnabled: true,
  };
}

export function buildEditableScopes(role) {
  if (role === "admin") return ["projects", "sessions", "tasks", "logs", "comments", "review", "archive", "admin"];
  if (role === "maintainer") return ["projects", "sessions", "tasks", "logs", "comments", "review"];
  if (role === "editor") return ["sessions", "tasks", "logs", "comments"];
  return [];
}
