"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import styles from "./login-screen.module.css";

type FormState = {
  email: string;
  password: string;
  remember: boolean;
};

type FieldErrors = {
  email?: string;
  password?: string;
};

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx="12"
        cy="12"
        r="3"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
    </svg>
  );
}

function WarningIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M10 5.5v5M10 13.4h.01"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CheckboxIcon({ checked }: { checked: boolean }) {
  return checked ? (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path
        d="M4 10.5 8 14l8-8"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ) : null;
}

function validateEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validatePhone(phone: string) {
  return /^(\+98|0)?9\d{9}$/.test(phone.replace(/[^\d+]/g, ""));
}

export function LoginForm() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>({
    email: "",
    password: "",
    remember: false,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [touched, setTouched] = useState<Record<keyof FormState, boolean>>({
    email: false,
    password: false,
    remember: false,
  });
  const [submittedOnce, setSubmittedOnce] = useState(false);

  useEffect(() => {
    const message = sessionStorage.getItem("gymplus_auth_message");
    if (message) {
      setServerError(message);
      sessionStorage.removeItem("gymplus_auth_message");
    }
  }, []);

  const hasContent = form.email.length > 0 || form.password.length > 0;

  const derivedErrors = useMemo(() => {
    const nextErrors: FieldErrors = {};

    if ((touched.email || submittedOnce) && !form.email.trim()) {
      nextErrors.email = "شماره موبایل یا ایمیل را وارد کنید.";
    } else if (
      (touched.email || submittedOnce) &&
      !validateEmail(form.email) &&
      !validatePhone(form.email)
    ) {
      nextErrors.email = "شماره موبایل یا ایمیل صحیح نیست، دوباره امتحان کنید.";
    }

    if ((touched.password || submittedOnce) && !form.password.trim()) {
      nextErrors.password = "رمز عبور را وارد کنید.";
    } else if ((touched.password || submittedOnce) && form.password.length < 8) {
      nextErrors.password = "رمز عبور باید حداقل ۸ کاراکتر باشد.";
    }

    return nextErrors;
  }, [form.email, form.password, submittedOnce, touched.email, touched.password]);

  const activeErrors = {
    email: errors.email ?? derivedErrors.email,
    password: errors.password ?? derivedErrors.password,
  };

  const isValid =
    Boolean(form.email.trim()) &&
    Boolean(form.password.trim()) &&
    !activeErrors.email &&
    !activeErrors.password;

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
    setServerError("");
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
  event.preventDefault();
  setSubmittedOnce(true);
  setTouched({
    email: true,
    password: true,
    remember: true,
  });

  if (!form.email.trim() || !form.password.trim()) {
    return;
  }

  if ((!validateEmail(form.email) && !validatePhone(form.email)) || form.password.length < 8) {
    return;
  }

  // ============================================================
  // 🟢 حالت توسعه (Development) - بدون نیاز به سرور
  // ============================================================
  /*
  if (process.env.NODE_ENV === "development") {
    // اطلاعات کاربر مربی (Coach)
    const mockUser = {
      id: 34,
      phone: "09120000002",
      full_name: "محمد فلاحی",
      role: "coach",
    };

    localStorage.setItem("gymplus_access", "dev-token-123");
    localStorage.setItem("gymplus_refresh", "dev-refresh-456");
    localStorage.setItem("gymplus_user", JSON.stringify(mockUser));

    setErrors({});
    router.push("/dashboard");
    return;
  }
    */
  // ============================================================

  setIsSubmitting(true);
  try {
    const response = await fetch("https://api.gympluspro.ir/api/v1/auth/login/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: form.email,
        password: form.password,
      }),
    });

    if (!response.ok) {
      throw new Error("login_failed");
    }

    const payload = (await response.json()) as {
      access?: string;
      refresh?: string;
      user?: { full_name?: string; phone?: string; role?: string };
    };

    if (payload.access) {
      localStorage.setItem("gymplus_access", payload.access);
    }
    if (payload.refresh) {
      localStorage.setItem("gymplus_refresh", payload.refresh);
    }
    if (payload.user) {
      localStorage.setItem("gymplus_user", JSON.stringify(payload.user));
    }

    setErrors({});
    const requestedPath = new URLSearchParams(window.location.search).get("next");
    const safePath = requestedPath?.startsWith("/") && !requestedPath.startsWith("//") ? requestedPath : "/dashboard";
    router.push(safePath);
  } catch {
    setErrors({
      email: "اطلاعات ورود صحیح نیست یا حسابی با این شماره پیدا نشد.",
      password: "رمز اشتباه وارد شده، دوباره امتحان کنید.",
    });
    setServerError("ورود با سرور انجام نشد. لطفا اطلاعات حساب خود را بررسی کنید.");
  } finally {
    setIsSubmitting(false);
  }
}

  return (
    <div className={styles.formShell}>
      <div className={styles.formBrand}>
        <span className={styles.formBrandIcon}>
          <Image
            src="/assets/images/mingcute_fitness.png"
            alt=""
            width={36}
            height={36}
            aria-hidden="true"
          />
        </span>
        <strong>GymPlus+</strong>
        <span className={styles.formBrandBadge}>پنل مربی</span>
      </div>

      <div className={styles.formContent}>
        <header className={styles.formHeader}>
          <h1>خوش اومدین</h1>
          <p>برای ورود به حساب خود لطفا شماره موبایل و رمز خود را وارد کنید.</p>
        </header>

        <form className={styles.form} noValidate onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label
              className={`${styles.label} ${activeErrors.email ? styles.labelError : ""} ${
                form.email ? styles.labelActive : ""
              }`}
              htmlFor="email"
            >
              شماره موبایل یا ایمیل
            </label>
            <div
              className={`${styles.inputFrame} ${
                activeErrors.email ? styles.inputFrameError : ""
              } ${form.email && !activeErrors.email ? styles.inputFrameActive : ""}`}
            >
              <input
                id="email"
                name="email"
                type="text"
                inputMode="tel"
                autoComplete="username"
                placeholder="شماره موبایل خود را وارد کنید"
                value={form.email}
                onBlur={() => setTouched((current) => ({ ...current, email: true }))}
                onChange={(event) => updateField("email", event.target.value)}
              />
            </div>
            {activeErrors.email ? (
              <p className={styles.errorText} role="alert">
                <WarningIcon />
                <span>{activeErrors.email}</span>
              </p>
            ) : null}
          </div>

          <div className={styles.field}>
            <label
              className={`${styles.label} ${activeErrors.password ? styles.labelError : ""}`}
              htmlFor="password"
            >
              رمز عبور
            </label>
            <div
              className={`${styles.inputFrame} ${
                activeErrors.password ? styles.inputFrameError : ""
              } ${form.password && !activeErrors.password ? styles.inputFrameActive : ""}`}
            >
              <button
                className={styles.leadingIcon}
                type="button"
                aria-label={showPassword ? "پنهان کردن رمز عبور" : "نمایش رمز عبور"}
                onClick={() => setShowPassword((current) => !current)}
              >
                <EyeIcon />
              </button>
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="رمز خود را وارد کنید"
                value={form.password}
                onBlur={() => setTouched((current) => ({ ...current, password: true }))}
                onChange={(event) => updateField("password", event.target.value)}
              />
            </div>
            {activeErrors.password ? (
              <p className={styles.errorText} role="alert">
                <WarningIcon />
                <span>{activeErrors.password}</span>
              </p>
            ) : null}
          </div>

          <div className={styles.formMeta}>
            <label className={styles.checkboxLabel}>
              <span>مرا بخاطر بسپار</span>
              <button
                className={`${styles.checkbox} ${form.remember ? styles.checkboxChecked : ""}`}
                type="button"
                aria-pressed={form.remember}
                onClick={() => updateField("remember", !form.remember)}
              >
                <CheckboxIcon checked={form.remember} />
              </button>
            </label>

            <Link className={styles.forgotLink} href="/forgot-password">
              فراموشی رمز عبور
            </Link>
          </div>

          <button
            className={`${styles.submitButton} ${
              hasContent && isValid ? styles.submitButtonActive : ""
            }`}
            type="submit"
            disabled={!isValid || isSubmitting}
          >
            {isSubmitting ? <><span className={styles.buttonSpinner} aria-hidden="true" />در حال ورود</> : "ورود به پنل"}
          </button>
          {serverError ? <p className={styles.errorText}>{serverError}</p> : null}
        </form>
      </div>

      <footer className={styles.formFooter}>
        <Link href="#">شرایط و خدمات</Link>
        <span className={styles.footerDot}>•</span>
        <Link href="#">حریم خصوصی</Link>
      </footer>
    </div>
  );
}
