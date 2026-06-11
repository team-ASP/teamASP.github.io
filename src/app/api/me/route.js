import { NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";

export async function GET(request) {
  return NextResponse.json(getSessionFromRequest(request));
}
