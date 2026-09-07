"use client";

// =============================================================
// GymPlus+ Coach — compact program card (shared workout/nutrition)
// A full-width single-row horizontal bar:
//
//   [icon] [program name] [badge آماده/ارسالشده] [tag قالب کلی/شاگرد]
//          ..................  [delete] [edit?] [preview] [clone] [CTA]
//
//   • Template / unsent (کلی):  icon 🏋️ workout | 🥗 nutrition,
//     title = program name, badge «آماده», tag «قالب کلی»,
//     orange CTA «ارسال برای شاگرد» (opens the student dialog).
//   • Sent to a student:        icon 👤 for BOTH domains,
//     title = «برنامه [name]», badge «ارسال‌شده» (green), tag «شاگرد»,
//     orange CTA «ویرایش» (edit → save auto-resends). No ✏️ icon here.
//
// No progress/counts meta — one line only. The delete icon asks the list
// for a confirmation dialog before anything is removed.
// =============================================================

import type { PlanMode, ProgramDomain, ProgramDraft } from "../program.types";
import { PrmBadge, PrmIcon, type PrmIconName } from "./programShared";

import styles from "../program.module.css";

export type AthletePick = { id: number; name: string; phone?: string };

/** Lightweight visual payload shared by server plans and local templates. */
export type PlanCardItem = {
  id: number;
  title: string;
  mode: PlanMode;
  goal?: string | null;
  sentAt?: string | null;
  athleteName?: string | null;
  athlete?: number | null;
  durationWeeks?: number;
  doneCount: number;
  totalCount: number;
};

const GOAL_LABELS: Record<string, string> = {
  fat_loss: "کاهش چربی",
  muscle_gain: "افزایش عضله",
  maintenance: "حفظ وزن",
  cut: "کات",
  volume: "حجم",
  strength: "قدرت",
  endurance: "استقامت",
  general: "عمومی",
};
/** Card + the full source draft so list actions can edit/clone/preview/delete. */
export type PlanCardSource = PlanCardItem & {
  uid: string;
  local: boolean; // true → localStorage reusable template (no server id)
  draft: ProgramDraft;
};

export function ProgramCard({
  kind,
  item,
  onEdit,
  onClone,
  onPreview,
  onDelete,
  onSend,
}: {
  kind: ProgramDomain;
  item: PlanCardSource;
  onEdit: (item: PlanCardSource) => void;
  onClone: (item: PlanCardSource) => void;
  onPreview: (item: PlanCardSource) => void;
  onDelete: (item: PlanCardSource) => void;
  onSend: (item: PlanCardSource) => void;
}) {
  const isStudent = Boolean(item.athleteName || item.athlete);
  const sent = Boolean(item.sentAt);

  // Type icon: 🏋️/🥗 for reusable/general programs, 👤 for a student program.
  const icon: PrmIconName = isStudent ? "user" : kind === "workout" ? "training" : "food";
  const fallbackTitle = kind === "workout" ? "برنامه بدون عنوان" : "برنامه غذایی بدون عنوان";
  const heading = isStudent ? `برنامه ${item.athleteName || "شاگرد"}` : item.title || fallbackTitle;

return (
  <article className={styles.prmCard2}>
    {/* ===== ردیف بالا ===== */}
    <div className={styles.prmCard2Top}>
      {/* آیکون سمت راست (در RTL) */}
      <span
        className={`${styles.prmCard2Icon} ${isStudent ? styles.prmCard2IconSent : ""}`}
        aria-hidden="true"
      >
        <PrmIcon name={icon} size={18} />
      </span>

      <div className={styles.prmCard2TopMain}>
        <div className={styles.prmCard2TitleRow}>
          {/* بج اول باشه تا سمت چپِ عنوان قرار بگیره */}
          <PrmBadge tone={sent ? "green" : "orange"}>
            {sent ? "ارسال‌شده" : "آماده"}
          </PrmBadge>
          <b>{heading}</b>
        </div>

        <span className={styles.prmCard2Sub}>
          {isStudent
            ? `برای ${item.athleteName || "شاگرد"}`
            : "برنامه کلی"}
          {item.goal
            ? ` · هدف ${GOAL_LABELS[item.goal] || item.goal}`
            : ""}
          {item.totalCount > 0
            ? ` · از ${item.doneCount} از ${item.totalCount} وعده تکمیل`
            : ""}
        </span>
      </div>
    </div>

    {/* خط جداکننده */}
    <div className={styles.prmCard2Divider} />

    {/* ===== ردیف پایین ===== */}
    <div className={styles.prmCard2Foot}>
      {/* دکمه اصلی سمت راست */}
      {isStudent ? (
        <button
          type="button"
          className={`${styles.prmBtnPrimary} ${styles.prmCard2Cta}`}
          onClick={() => onEdit(item)}
        >
          <PrmIcon name="edit" size={14} />
          ویرایش
        </button>
      ) : (
        <button
          type="button"
          className={`${styles.prmBtnPrimary} ${styles.prmCard2Cta}`}
          onClick={() => onSend(item)}
        >
          <PrmIcon name="send" size={14} />
          استفاده برای شاگرد
        </button>
      )}

      <span className={styles.prmCard2Icons}>
        <button
          type="button"
          className={`${styles.prmIconBtn} ${styles.prmCard2Delete}`}
          onClick={() => onDelete(item)}
          title="حذف"
          aria-label="حذف برنامه"
        >
          <PrmIcon name="trash" size={15} />
        </button>

        {!isStudent && (
          <button
            type="button"
            className={styles.prmIconBtn}
            onClick={() => onEdit(item)}
            title="ویرایش"
            aria-label="ویرایش برنامه"
          >
            <PrmIcon name="edit" size={15} />
          </button>
        )}

        <button
          type="button"
          className={styles.prmIconBtn}
          onClick={() => onPreview(item)}
          title="پیش‌نمایش"
          aria-label="پیش‌نمایش برنامه"
        >
          <PrmIcon name="eye" size={15} />
        </button>

        <button
          type="button"
          className={styles.prmIconBtn}
          onClick={() => onClone(item)}
          title="کپی"
          aria-label="کپی برنامه"
        >
          <PrmIcon name="copy" size={15} />
        </button>
      </span>
    </div>
  </article>
);
}
