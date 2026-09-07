"use client";

// =============================================================
// GymPlus+ Coach — saved-program list with three tabs
//   همه            : every card (templates + student programs)
//   شاگردان        : cards sent/assigned to a student
//   برنامه‌های کلی  : reusable templates + not-yet-assigned plans
// Cards are ProgramCard components; «ارسال برای شاگرد» opens the
// same student-selection dialog used by «ساخت برنامه جدید».
// =============================================================

import { useState } from "react";

import type { ProgramDomain } from "../program.types";
import { PrmConfirm, PrmEmpty } from "./programShared";
import { ProgramCard, type AthletePick, type PlanCardSource } from "./ProgramCard";
import { StudentSelectDialog } from "./StudentSelectDialog";

import styles from "../program.module.css";

export type { PlanCardItem, PlanCardSource, AthletePick } from "./ProgramCard";

type TabId = "all" | "students" | "templates";

const isStudentCard = (item: PlanCardSource) => Boolean(item.athleteName || item.athlete);

/** Same heading the card shows, so the confirm names what the user sees. */
const cardHeading = (item: PlanCardSource) =>
  Boolean(item.athleteName || item.athlete)
    ? `برنامه ${item.athleteName || "شاگرد"}`
    : item.title || "برنامه بدون عنوان";

export function ProgramList({
  kind,
  items,
  students,
  onEdit,
  onClone,
  onPreview,
  onDelete,
  onSend,
}: {
  kind: ProgramDomain;
  items: PlanCardSource[];
  students: AthletePick[];
  onEdit: (item: PlanCardSource) => void;
  onClone: (item: PlanCardSource) => void;
  onPreview: (item: PlanCardSource) => void;
  onDelete: (item: PlanCardSource) => void;
  onSend: (item: PlanCardSource, athleteId: number) => void;
}) {
  const [tab, setTab] = useState<TabId>("all");
  const [deleting, setDeleting] = useState<PlanCardSource | null>(null);
  // «ارسال برای شاگرد» target whose student dialog is open.
  const [sending, setSending] = useState<PlanCardSource | null>(null);

  const countStudents = items.filter(isStudentCard).length;
  const countTemplates = items.length - countStudents;

  const tabs: Array<{ id: TabId; label: string; count: number }> = [
    { id: "all", label: "همه", count: items.length },
    { id: "students", label: "شاگردان", count: countStudents },
    { id: "templates", label: "برنامه‌های کلی", count: countTemplates },
  ];

  const visible = items.filter((item) =>
    tab === "all" ? true : tab === "students" ? isStudentCard(item) : !isStudentCard(item),
  );

  if (!items.length) {
    return (
      <div className={styles.prmListEmpty}>
        <PrmEmpty
          icon={kind === "workout" ? "training" : "food"}
          title={kind === "workout" ? "برنامه تمرینی ندارید" : "برنامه غذایی ندارید"}
          hint="با «ساخت برنامه کلی» یک الگو بسازید یا با «ساخت برنامه جدید» برای شاگرد برنامه بسازید."
        />
      </div>
    );
  }

  return (
    <div className={styles.prmList}>
      <div className={styles.prmListFilters}>
        <div className={styles.prmListTabs} role="tablist" aria-label="فیلتر برنامه‌ها">
          {tabs.map(({ id, label, count }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              className={`${styles.prmListTab} ${tab === id ? styles.prmListTabActive : ""}`}
              onClick={() => setTab(id)}
            >
              {label}
              <span className={styles.prmListTabCount}>{count.toLocaleString("fa-IR")}</span>
            </button>
          ))}
        </div>
      </div>

      {!visible.length ? (
        <div className={styles.prmListEmpty}>
          <PrmEmpty
            icon={tab === "students" ? "training" : "copy"}
            title={tab === "students" ? "هنوز برنامه‌ای برای شاگرد نفرستاده‌اید" : "برنامه کلی ندارید"}
            hint={
              tab === "students"
                ? "روی «ارسال برای شاگرد» یک برنامه کلی بفرستید تا اینجا بیاید."
                : "با دکمه «ساخت برنامه کلی» یک برنامه بدون شاگرد بسازید."
            }
          />
        </div>
      ) : (
        <div className={styles.prmCards}>
          {visible.map((item) => (
            <ProgramCard
              key={item.uid}
              kind={kind}
              item={item}
              onEdit={onEdit}
              onClone={onClone}
              onPreview={onPreview}
              onDelete={setDeleting}
              onSend={setSending}
            />
          ))}
        </div>
      )}

      {deleting ? (
        <PrmConfirm
          title="حذف برنامه؟"
          tone="red"
          description={
            <>
              آیا از حذف برنامه «{cardHeading(deleting)}» مطمئن هستید؟
              {deleting.local ? (
                <> این قالب فقط از فهرست «برنامه‌های کلی» حذف می‌شود؛ برنامه‌هایی که قبلاً از آن ساخته‌اید دست‌نخورده می‌مانند.</>
              ) : deleting.sentAt ? (
                <> این برنامه قبلاً برای شاگرد ارسال شده و حذف آن روی نسخهٔ ارسال‌شده اثر ندارد.</>
              ) : (
                <> این برنامه برای همیشه حذف می‌شود.</>
              )}
            </>
          }
          confirmLabel="تأیید حذف"
          onCancel={() => setDeleting(null)}
          onConfirm={() => {
            const target = deleting;
            setDeleting(null);
            onDelete(target);
          }}
        />
      ) : null}

      {/* «ارسال برای شاگرد» — same student dialog as «ساخت برنامه جدید»;
          picking a student opens the builder pre-loaded instead of sending
          immediately, so the coach can review before the program goes out. */}
      {sending ? (
        <StudentSelectDialog
          students={students}
          title="ارسال برای شاگرد"
          subtitle={sending.title || "برنامه بدون عنوان"}
          note={`«${sending.title || "این برنامه"}» برای کدام شاگرد ساخته و ارسال شود؟ نسخهٔ اصلی دست‌نخورده می‌ماند؛ در برنامه‌ساز می‌توانید پیش از ارسال آن را بررسی یا ویرایش کنید.`}
          onPick={(student) => {
            const target = sending;
            setSending(null);
            onSend(target, student.id);
          }}
          onClose={() => setSending(null)}
        />
      ) : null}
    </div>
  );
}
