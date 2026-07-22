import { listProjects } from "@/lib/db";
import { withActivity } from "@/lib/activity";
import { Dashboard } from "@/components/dashboard";

export const dynamic = "force-dynamic";

export default function Home() {
  const projects = withActivity(listProjects());
  return <Dashboard projects={projects} />;
}
