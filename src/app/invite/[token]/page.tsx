import { Invite } from "@/components/onboarding";
import { headers } from "next/headers";
import { getAuth } from "@/lib/auth";
export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const session = await getAuth().api.getSession({ headers: await headers() });
  return <Invite token={(await params).token} authenticated={!!session} />;
}
