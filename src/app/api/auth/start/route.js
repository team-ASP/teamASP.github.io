import { NextResponse } from "next/server";
import { createOAuthState, getOAuthStateCookieName, isAuthConfigured } from "@/lib/auth";

export async function GET(request) {
  if (!isAuthConfigured()) {
    return NextResponse.json(
      {
        error: "auth_not_configured",
        message: "GitHub auth needs GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, and SESSION_SECRET.",
      },
      { status: 503 },
    );
  }

  const state = createOAuthState();
  const origin = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;
  const callbackUrl = new URL("/api/auth/callback", origin);
  const authorizeUrl = new URL("https://github.com/login/oauth/authorize");
  authorizeUrl.searchParams.set("client_id", process.env.GITHUB_CLIENT_ID);
  authorizeUrl.searchParams.set("redirect_uri", callbackUrl.toString());
  authorizeUrl.searchParams.set("scope", "read:org");
  authorizeUrl.searchParams.set("state", state);

  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set(getOAuthStateCookieName(), state, {
    httpOnly: true,
    maxAge: 10 * 60,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  return response;
}
