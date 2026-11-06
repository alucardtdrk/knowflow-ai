import { redirect, notFound } from "next/navigation";
import { Workspace } from "@/components/workspace";
import { loadWorkspace } from "@/app/actions";
import { AppError } from "@/lib/errors";
export const dynamic = "force-dynamic";
export default async function Team({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  let data;
  try {
    data = await loadWorkspace((await params).teamId);
  } catch (e) {
    if (e instanceof AppError && e.status === 401) redirect("/login");
    notFound();
  }
  return <Workspace key={data.scope.teamId} initial={data} />;
}
