import { redirect } from "next/navigation";
import { sql } from "drizzle-orm";
import { rows } from "@/lib/db";
import { requireActor } from "@/lib/access";
import { AppError } from "@/lib/errors";
import { Onboarding } from "@/components/onboarding";
export const dynamic = "force-dynamic";
export default async function AppHome() {
  if (!process.env.DATABASE_URL || !process.env.BETTER_AUTH_SECRET)
    redirect("/login");
  let actor;
  try {
    actor = await requireActor();
  } catch (e) {
    if (e instanceof AppError && e.status === 401) redirect("/login");
    throw e;
  }
  const [team] = await rows<{ team_id: string }>(
    sql`SELECT team_id FROM team_members WHERE user_id=${actor.userId} ORDER BY team_id LIMIT 1`,
  );
  if (team) redirect(`/app/${team.team_id}`);
  const [user] = await rows<{ name: string }>(
    sql`SELECT name FROM "user" WHERE id=${actor.userId}`,
  );
  return <Onboarding name={user.name} />;
}
