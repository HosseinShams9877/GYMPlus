"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

import { LoginShowcase } from "./login-showcase";
import styles from "./login-screen.module.css";

type Step = "phone" | "password";

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
      <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function WarningIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M10 5.5v5M10 13.4h.01" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="10" cy="10" r="9" fill="currentColor" />
      <path d="m5.7 10.2 2.7 2.7 5.9-6" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Brand() {
  return (
    <div className={styles.formBrand}>
      <span className={styles.formBrandIcon}>
        <Image src="/assets/images/mingcute_fitness.png" alt="" width={36} height={36} aria-hidden="true" />
      </span>
      <strong>GymPlus+</strong>
      <span className={styles.formBrandBadge}>پنل مربی</span>
    </div>
  );
}

function validatePhone(phone: string) {
  return /^(\+98|0)?9\d{9}$/.test(phone.replace(/[^\d+]/g, ""));
}

export function ForgotPasswordScreen() {
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [serverError, setServerError] = useState("");
  const [serverMessage, setServerMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const phoneError = phoneTouched && !validatePhone(phone)
    ? phone.trim()
      ? "شماره موبایل صحیح نیست، دوباره امتحان کنید."
      : "شماره موبایل خود را وارد کنید."
    : "";
  const phoneIsValid = validatePhone(phone);

  const passwordRules = [
    { label: "حداقل ۸ کاراکتر باشد", passed: password.length >= 8 },
    { label: "حداقل یک حرف انگلیسی بزرگ داشته باشد", passed: /[A-Z]/.test(password) },
    { label: "حداقل یک حرف انگلیسی کوچک داشته باشد", passed: /[a-z]/.test(password) },
    { label: "حداقل یک عدد داشته باشد", passed: /\d/.test(password) },
  ];
  const passwordIsValid = passwordRules.every((rule) => rule.passed);
  const passwordsMatch = confirmation.length > 0 && password === confirmation;
  const codeIsValid = code.trim().length >= 4;
  const canSavePassword = codeIsValid && passwordIsValid && passwordsMatch;

  async function submitPhone(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPhoneTouched(true);
    setServerError("");
    setServerMessage("");

    if (!phoneIsValid) {
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("https://api.gympluspro.ir/api/v1/auth/password/reset/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });

      if (!response.ok) {
        throw new Error("reset_request_failed");
      }

      setServerMessage("کد بازیابی برای شماره موبایل شما ارسال شد.");
      setStep("password");
    } catch {
      setServerError("ارسال کد بازیابی انجام نشد. شماره موبایل را بررسی کنید.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function submitPassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setServerError("");
    setServerMessage("");

    if (!canSavePassword) {
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("https://api.gympluspro.ir/api/v1/auth/password/reset/confirm/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone,
          code,
          new_password: password,
        }),
      });

      if (!response.ok) {
        throw new Error("reset_confirm_failed");
      }

      setServerMessage("رمز عبور با موفقیت تغییر کرد. اکنون می‌توانید وارد شوید.");
    } catch {
      setServerError("تغییر رمز انجام نشد. کد تایید یا رمز جدید را بررسی کنید.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.panel}>
        <LoginShowcase />
      </section>

      <section className={styles.content} dir="rtl">
        <div className={`${styles.formShell} ${styles.forgotShell}`}>
          {step === "phone" ? (
            <Link className={styles.backLink} href="/login">
              <span className={styles.backArrow} aria-hidden="true">←</span>
              <span>بازگشت</span>
            </Link>
          ) : (
            <Brand />
          )}

          <div className={`${styles.formContent} ${styles.forgotContent}`}>
            <header className={styles.formHeader}>
              <h1>{step === "phone" ? "فراموشی رمز عبور" : "تعیین رمز عبور جدید"}</h1>
              <p>
                {step === "phone"
                  ? "لطفا شماره موبایل حساب خود را برای دریافت کد بازیابی وارد کنید."
                  : "کد تایید و رمز عبور جدید را وارد کنید."}
              </p>
            </header>

            {step === "phone" ? (
              <form className={`${styles.form} ${styles.forgotForm}`} noValidate onSubmit={submitPhone}>
                <div className={styles.field}>
                  <label className={`${styles.label} ${phoneError ? styles.labelError : ""} ${phone && !phoneError ? styles.labelActive : ""}`} htmlFor="recovery-phone">
                    شماره موبایل
                  </label>
                  <div className={`${styles.inputFrame} ${phoneError ? styles.inputFrameError : ""} ${phone && !phoneError ? styles.inputFrameActive : ""}`}>
                    <input
                      id="recovery-phone"
                      name="phone"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      placeholder="شماره موبایل خود را وارد کنید"
                      value={phone}
                      onBlur={() => setPhoneTouched(true)}
                      onChange={(event) => {
                        setPhone(event.target.value);
                        setServerError("");
                        if (phoneTouched) setPhoneTouched(false);
                      }}
                    />
                  </div>
                  {phoneError ? (
                    <p className={styles.errorText} role="alert">
                      <WarningIcon />
                      <span>{phoneError}</span>
                    </p>
                  ) : null}
                </div>
                {serverError ? <p className={styles.errorText}>{serverError}</p> : null}

                <button className={`${styles.submitButton} ${phoneIsValid ? styles.submitButtonActive : ""}`} type="submit" disabled={!phoneIsValid || isSubmitting}>
                  {isSubmitting ? "در حال ارسال..." : "ارسال کد بازیابی"}
                </button>
              </form>
            ) : (
              <form className={`${styles.form} ${styles.forgotForm}`} noValidate onSubmit={submitPassword}>
                {serverMessage ? <p className={styles.errorText}>{serverMessage}</p> : null}
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="reset-code">کد تایید</label>
                  <div className={styles.inputFrame}>
                    <input
                      id="reset-code"
                      name="code"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      placeholder="کد پیامک شده را وارد کنید"
                      value={code}
                      onChange={(event) => {
                        setCode(event.target.value);
                        setServerError("");
                      }}
                    />
                  </div>
                </div>
                <PasswordField
                  id="new-password"
                  label="رمز عبور جدید"
                  value={password}
                  visible={showPassword}
                  autoComplete="new-password"
                  onToggle={() => setShowPassword((current) => !current)}
                  onChange={setPassword}
                />
                <PasswordField
                  id="confirm-password"
                  label="تکرار رمز عبور جدید"
                  value={confirmation}
                  visible={showConfirmation}
                  autoComplete="new-password"
                  onToggle={() => setShowConfirmation((current) => !current)}
                  onChange={setConfirmation}
                />

                {password.length > 0 ? (
                  <div className={styles.passwordGuide}>
                    <div className={styles.strengthBars} aria-hidden="true">
                      {passwordRules.map((rule) => (
                        <span key={rule.label} className={rule.passed ? styles.strengthBarPassed : ""} />
                      ))}
                    </div>
                    <p>رمز عبور باید:</p>
                    <ul>
                      {passwordRules.map((rule) => (
                        <li key={rule.label} className={rule.passed ? styles.rulePassed : ""}>
                          <CheckIcon />
                          <span>{rule.label}</span>
                        </li>
                      ))}
                      <li className={passwordsMatch ? styles.rulePassed : ""}>
                        <CheckIcon />
                        <span>با تکرار رمز عبور یکسان باشد</span>
                      </li>
                    </ul>
                  </div>
                ) : null}

                <button className={`${styles.submitButton} ${canSavePassword ? styles.submitButtonActive : ""}`} type="submit" disabled={!canSavePassword || isSubmitting}>
                  {isSubmitting ? "در حال تغییر..." : "تغییر رمزعبور"}
                </button>
                {serverError ? <p className={styles.errorText}>{serverError}</p> : null}
              </form>
            )}
          </div>

          <span className={styles.forgotSpacer} aria-hidden="true" />
        </div>
      </section>
    </main>
  );
}

type PasswordFieldProps = {
  id: string;
  label: string;
  value: string;
  visible: boolean;
  autoComplete: string;
  onToggle: () => void;
  onChange: (value: string) => void;
};

function PasswordField({ id, label, value, visible, autoComplete, onToggle, onChange }: PasswordFieldProps) {
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>{label}</label>
      <div className={styles.inputFrame}>
        <button className={styles.leadingIcon} type="button" aria-label={visible ? "پنهان کردن رمز عبور" : "نمایش رمز عبور"} onClick={onToggle}>
          <EyeIcon />
        </button>
        <input
          id={id}
          name={id}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          placeholder={label}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
    </div>
  );
}
