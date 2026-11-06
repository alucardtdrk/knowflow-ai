import { AuthForm } from "@/components/auth-form";
export const dynamic = "force-dynamic";
export default function Login() {
  return (
    <AuthForm
      configured={
        !!process.env.DATABASE_URL && !!process.env.BETTER_AUTH_SECRET
      }
    />
  );
}
