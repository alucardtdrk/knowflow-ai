import { AuthForm } from "@/components/auth-form";
export const dynamic = "force-dynamic";
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string | string[] }>;
}) {
  const { invite } = await searchParams;
  const redirectTo =
    typeof invite === "string" && /^[a-f0-9]{64}$/.test(invite)
      ? `/invite/${invite}`
      : "/app";
  return (
    <AuthForm
      configured={
        !!process.env.DATABASE_URL && !!process.env.BETTER_AUTH_SECRET
      }
      redirectTo={redirectTo}
    />
  );
}
