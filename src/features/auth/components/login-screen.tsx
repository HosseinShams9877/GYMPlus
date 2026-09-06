import { LoginForm } from "@/features/auth/components/login-form";
import { LoginShowcase } from "@/features/auth/components/login-showcase";

import styles from "./login-screen.module.css";

export function LoginScreen() {
  return (
    <main className={styles.page}>
      <section className={styles.panel}>
        <LoginShowcase />
      </section>

      <section className={styles.content} dir="rtl">
        <LoginForm />
      </section>
    </main>
  );
}
