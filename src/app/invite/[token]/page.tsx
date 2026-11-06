import { Invite } from "@/components/onboarding";
export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  return <Invite token={(await params).token} />;
}
