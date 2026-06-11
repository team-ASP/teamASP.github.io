import { Suspense } from "react";
import { WorkspaceClient } from "@/components/workspace-client";
import { aspData } from "@/lib/data";

export const metadata = {
  title: "Workspace | ASP Study Hub",
};

export default function WorkspacePage() {
  return (
    <Suspense fallback={<main className="workspace-shell"><section className="workspace-main">Workspace 로딩 중</section></main>}>
      <WorkspaceClient data={aspData} />
    </Suspense>
  );
}
