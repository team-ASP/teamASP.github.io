import { WorkspaceClient } from "@/components/workspace-client";
import { aspData } from "@/lib/data";

export const metadata = {
  title: "Workspace | ASP Study Hub",
};

export default function WorkspacePage() {
  return <WorkspaceClient data={aspData} />;
}
