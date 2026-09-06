import { ForgotPasswordScreen } from "@/features/auth/components/forgot-password-screen";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function ForgotPasswordPage() {
  return <ForgotPasswordScreen />;
}
