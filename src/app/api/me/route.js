import { createCsrfToken, getCsrfCookieName, getSessionFromRequest } from "@/lib/auth";
import { jsonResponse } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const session = getSessionFromRequest(request);
  const responseSession = { ...session };
  let createdCsrfToken = "";

  if (session.authenticated && !session.csrfToken) {
    createdCsrfToken = createCsrfToken();
    responseSession.csrfToken = createdCsrfToken;
  }

  const response = jsonResponse(responseSession);

  if (createdCsrfToken) {
    response.cookies.set(getCsrfCookieName(), createdCsrfToken, {
      httpOnly: false,
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
  }

  return response;
}
