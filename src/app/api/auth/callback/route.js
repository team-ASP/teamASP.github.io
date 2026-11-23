import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import {
  buildEditableScopes,
  createCsrfToken,
  getCsrfCookieName,
  getOAuthStateCookieName,
  getRoleForGitHubLogin,
  getSessionCookieName,
  isAuthConfigured,
  signSession,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

function safeStateMatch(a, b) {
  if (!a || !b) return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

async function fetchGitHubJson(url, options) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "asp-study-hub",
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GitHub request failed: ${response.status} ${body}`);
  }

  return response.json();
}

export async function GET(request) {
  const url = new URL(request.url);
  const origin = process.env.NEXT_PUBLIC_SITE_URL || url.origin;

  if (!isAuthConfigured()) {
    return NextResponse.redirect(new URL("/governance?auth=not-configured", origin));
  }

  const state = url.searchParams.get("state");
  const expectedState = request.cookies.get(getOAuthStateCookieName())?.value;
  const code = url.searchParams.get("code");

  if (!safeStateMatch(state, expectedState) || !code) {
    const failed = NextResponse.redirect(new URL("/governance?auth=invalid-state", origin));
    failed.cookies.delete(getOAuthStateCookieName());
    return failed;
  }

  try {
    const callbackUrl = new URL("/api/auth/callback", origin);
    const tokenResponse = await fetchGitHubJson("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: callbackUrl.toString(),
      }),
    });

    if (!tokenResponse.access_token) {
      throw new Error("GitHub did not return an access token.");
    }

    const user = await fetchGitHubJson("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
    });

    const org = process.env.NEXT_PUBLIC_GITHUB_ORG || "team-ASP";
    const membership = await fetchGitHubJson(`https://api.github.com/orgs/${org}/memberships/${user.login}`, {
      headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
    });

    if (membership.state !== "active") {
      return NextResponse.redirect(new URL("/governance?auth=not-member", origin));
    }

    const role = getRoleForGitHubLogin(user.login);
    const sessionValue = signSession({
      login: user.login,
      name: user.name || user.login,
      avatarUrl: user.avatar_url,
      role,
      organization: org,
      editableScopes: buildEditableScopes(role),
      expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 7,
    });

    const response = NextResponse.redirect(new URL("/governance?auth=success", origin));
    response.cookies.delete(getOAuthStateCookieName());
    response.cookies.set(getSessionCookieName(), sessionValue, {
      httpOnly: true,
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
    response.cookies.set(getCsrfCookieName(), createCsrfToken(), {
      httpOnly: false,
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
    return response;
  } catch (error) {
    console.error("OAuth callback failed:", error instanceof Error ? error.message : "unknown_error");
    const failed = NextResponse.redirect(new URL("/governance?auth=failed", origin));
    failed.cookies.delete(getOAuthStateCookieName());
    return failed;
  }
}
