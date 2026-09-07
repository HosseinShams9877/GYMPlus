"use client";

// =============================================================
// GymPlus+ Coach — student picker used by every dialog that
// targets a student:
//   • «ارسال برای شاگرد» on a program card
//   • step 1 of «ساخت برنامه جدید» (انتخاب شاگرد)
// A full-screen-friendly PrmModal with a search box, rows showing
// avatar-initial + name + phone, and an «انصراف» footer.
// Styling lives in ../program.module.css.
// =============================================================

import { useState, type ReactNode } from "react";

import { PrmIcon, PrmModal, PrmModalHead, PrmNotice } from "./programShared";

import styles from "../program.module.css";

export type StudentRow = { id: number; name: string; phone?: string };

export function StudentSelectDialog({
  students,
  title = "انتخاب شاگرد",
  subtitle,
  note,
  onPick,
  onClose,
}: {
  students: StudentRow[];
  title?: string;
  subtitle?: string;
  note?: ReactNode;
  onPick: (student: StudentRow) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const trimmed = query.trim();
  const q = trimmed.toLocaleLowerCase("fa");
  const hasStudents = students.length > 0;
  const filtered = q
    ? students.filter(
        (student) =>
          student.name.toLocaleLowerCase("fa").includes(q) ||
          (student.phone ?? "").toLocaleLowerCase("fa").includes(q),
      )
    : students;

  return (
    <PrmModal onClose={onClose} small>
      <PrmModalHead title={title} subtitle={subtitle} onClose={onClose} />
      <div className={styles.prmWizBody}>
        {note ? <p className={styles.prmWizHint}>{note}</p> : null}

        {hasStudents ? (
          <div className={styles.prmSearch}>
            <PrmIcon name="search" size={16} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="جستجوی نام یا شمارهٔ شاگرد…"
              aria-label="جستجوی شاگرد"
            />
          </div>
        ) : null}

        {!hasStudents ? (
          <PrmNotice tone="orange">
            لیست شاگردان هنوز در دسترس نیست (وب‌سرویس /coach/athletes پاسخ نمی‌دهد). بعد از برقراری آن دوباره تلاش کنید.
          </PrmNotice>
        ) : filtered.length ? (
          <div className={styles.prmWizStudents}>
            {filtered.map((student) => (
              <button
                key={student.id}
                type="button"
                className={styles.prmWizStudent}
                onClick={() => onPick(student)}
              >
                <i className={styles.prmAthDot}>{student.name.trim().charAt(0) || "؟"}</i>
                <span className={styles.prmWizStudentBody}>
                  <b>{student.name}</b>
                  {student.phone ? (
                    <small>
                      <PrmIcon name="phone" size={11} /> {student.phone}
                    </small>
                  ) : (
                    <small>شماره در دسترس نیست</small>
                  )}
                </span>
                <PrmIcon name="caret" size={16} />
              </button>
            ))}
          </div>
        ) : (
          <PrmNotice tone="orange">شاگردی با «{trimmed}» پیدا نشد.</PrmNotice>
        )}

        <div className={styles.prmConfirmActions}>
          <button type="button" className={styles.prmBtn} onClick={onClose}>
            انصراف
          </button>
        </div>
      </div>
    </PrmModal>
  );
}
