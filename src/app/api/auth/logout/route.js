import { NextResponse } from "next/server";
import { getSessionCookieName } from "@/lib/auth";

export async function POST(request) {
  const origin = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;
  const response = NextResponse.redirect(new URL("/", origin), 303);
  response.cookies.delete(getSessionCookieName());
  return response;
}

export async function GET(request) {
  return POST(request);
}
