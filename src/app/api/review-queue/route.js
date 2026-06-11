import { NextResponse } from "next/server";
import { aspData } from "@/lib/data";
import { can, getSessionFromRequest } from "@/lib/auth";

export async function GET(request) {
  const session = getSessionFromRequest(request);
  return NextResponse.json({
    items: aspData.reviewQueue,
    permissions: {
      canReview: can(session.role, "review"),
      canArchive: can(session.role, "archive"),
    },
  });
}

export async function POST(request) {
  const session = getSessionFromRequest(request);
  if (!can(session.role, "review")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  return NextResponse.json(
    {
      error: "storage_not_configured",
      message: "Review mutations require the draft/review storage backend selected in the next implementation phase.",
    },
    { status: 501 },
  );
}
