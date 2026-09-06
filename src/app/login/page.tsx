import { LoginScreen } from "@/features/auth/components/login-screen";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function LoginPage() {
  return <LoginScreen />;
}
