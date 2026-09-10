"use client";

import { useEffect } from "react";

import {
  MODE_LABEL,
  goalLabel,
  type ProgramDay,
  type ProgramExercise,
  type ProgramFoodItem,
  type ProgramMeal,
} from "../program.types";
import type { PlanCardSource } from "./ProgramCard";
import { PrmIcon } from "./programShared";

import styles from "../program.module.css";

const fa = (value: string | number | null | undefined) =>
  value == null || value === ""
    ? "—"
    : String(value).replace(/\d/g, (digit) => "۰۱۲۳۴۵۶۷۸۹"[Number(digit)]);
const valueOrDash = (value: string | number | null | undefined, suffix = "") =>
  value == null || value === "" ? "—" : `${fa(value)}${suffix}`;

function ExercisePreview({
  exercise,
  index,
}: {
  exercise: ProgramExercise;
  index: number;
}) {
  const details = exercise.setDetails?.length
    ? exercise.setDetails
    : Array.from({ length: Math.max(1, exercise.sets || 1) }, () => ({
        reps: exercise.reps,
        weight: exercise.weight,
      }));
  return (
    <article className={styles.prmFullPreviewItem}>
      <header>
        <span>{fa(index + 1)}</span>
        <div>
          <b>{exercise.name || "حرکت بدون نام"}</b>
          <small>
            {fa(exercise.sets)} ست ·{" "}
            {valueOrDash(exercise.restSec, " ثانیه استراحت")}
          </small>
        </div>
      </header>
      <div className={styles.prmFullPreviewSets}>
        {details.map((detail, setIndex) => (
          <span key={setIndex}>
            <b>ست {fa(setIndex + 1)}</b>
            <small>{valueOrDash(detail.reps ?? exercise.reps, " تکرار")}</small>
            <small>
              {valueOrDash(detail.weight ?? exercise.weight, " کیلوگرم")}
            </small>
          </span>
        ))}
      </div>
      {exercise.note ? (
        <p className={styles.prmFullPreviewNote}>
          <PrmIcon name="user" size={15} /> یادداشت مربی: {exercise.note}
        </p>
      ) : null}
      {exercise.alternative ? (
        <p className={styles.prmFullPreviewAlternative}>
          جایگزین: <b>{exercise.alternative}</b>
        </p>
      ) : null}
    </article>
  );
}

function FoodPreview({
  item,
  index,
}: {
  item: ProgramFoodItem;
  index: number;
}) {
  return (
    <article className={styles.prmFullPreviewFood}>
      <span className={styles.prmFullPreviewFoodIndex}>{fa(index + 1)}</span>
      <div>
        <b>{item.name || "ماده غذایی بدون نام"}</b>
        <small>
          {fa(item.amount)} {item.unit || "گرم"}
          {item.alternative ? ` · جایگزین: ${item.alternative}` : ""}
        </small>
        {item.note ? <em>یادداشت مربی: {item.note}</em> : null}
      </div>
      <dl>
        <span>
          <dt>کالری</dt>
          <dd>{valueOrDash(item.kcal)}</dd>
        </span>
        <span>
          <dt>پروتئین</dt>
          <dd>{valueOrDash(item.protein, " گرم")}</dd>
        </span>
        <span>
          <dt>کربوهیدرات</dt>
          <dd>{valueOrDash(item.carbs, " گرم")}</dd>
        </span>
        <span>
          <dt>چربی</dt>
          <dd>{valueOrDash(item.fat, " گرم")}</dd>
        </span>
      </dl>
    </article>
  );
}

export function ProgramPreview({
  item,
  onClose,
}: {
  item: PlanCardSource;
  onClose: () => void;
}) {
  const workout = item.draft.domain === "workout";
  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", close);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", close);
    };
  }, [onClose]);

  return (
    <div
      className={styles.prmFullPreview}
      role="dialog"
      aria-modal="true"
      aria-label={`پیش‌نمایش ${item.title || "برنامه"}`}
    >
      <header className={styles.prmFullPreviewHead}>
        <div>
          <span className={styles.prmFullPreviewBrand}>GymPlus+</span>
          <small>نمایش برنامه از دید شاگرد</small>
        </div>
        <button type="button" onClick={onClose} aria-label="بستن پیش‌نمایش">
          <PrmIcon name="close" size={22} />
        </button>
      </header>
      <main className={styles.prmFullPreviewBody}>
        <section className={styles.prmFullPreviewHero}>
          <div>
            <small>{workout ? "برنامه تمرینی" : "برنامه غذایی"}</small>
            <h2>{item.title || "برنامه بدون عنوان"}</h2>
            <p>
              {item.athleteName
                ? `برای ${item.athleteName}`
                : "پیش‌نمایش برنامه کلی"}
            </p>
          </div>
          <div className={styles.prmFullPreviewMeta}>
            <span>
              <small>هدف</small>
              <b>
                {item.goal
                  ? goalLabel(item.goal, item.draft.domain)
                  : MODE_LABEL[item.mode]}
              </b>
            </span>
            <span>
              <small>مدت</small>
              <b>{fa(item.durationWeeks || 4)} هفته</b>
            </span>
            <span>
              <small>{workout ? "روزها" : "وعده‌ها"}</small>
              <b>{fa(item.draft.structure.length)}</b>
            </span>
          </div>
        </section>
        <div className={styles.prmFullPreviewSections}>
          {workout
            ? (item.draft.structure as ProgramDay[]).map((day, dayIndex) => (
                <section key={day.key} className={styles.prmFullPreviewSection}>
                  <header>
                    <span>{fa(dayIndex + 1)}</span>
                    <div>
                      <h3>{day.name || `روز ${fa(dayIndex + 1)}`}</h3>
                      <small>{fa(day.exercises.length)} حرکت</small>
                    </div>
                  </header>
                  <div className={styles.prmFullPreviewItems}>
                    {day.exercises.length ? (
                      day.exercises.map((exercise, index) => (
                        <ExercisePreview
                          key={exercise.key}
                          exercise={exercise}
                          index={index}
                        />
                      ))
                    ) : (
                      <p className={styles.prmFullPreviewEmpty}>
                        حرکتی برای این روز ثبت نشده است.
                      </p>
                    )}
                  </div>
                </section>
              ))
            : (item.draft.structure as ProgramMeal[]).map((meal, mealIndex) => (
                <section
                  key={meal.key}
                  className={styles.prmFullPreviewSection}
                >
                  <header>
                    <span>{fa(mealIndex + 1)}</span>
                    <div>
                      <h3>{meal.name || `وعده ${fa(mealIndex + 1)}`}</h3>
                      <small>
                        {fa(meal.items.length)} ماده غذایی ·{" "}
                        {fa(
                          meal.items.reduce(
                            (sum, row) => sum + (row.kcal || 0),
                            0,
                          ),
                        )}{" "}
                        کالری
                      </small>
                    </div>
                  </header>
                  <div className={styles.prmFullPreviewItems}>
                    {meal.items.length ? (
                      meal.items.map((food, index) => (
                        <FoodPreview key={food.key} item={food} index={index} />
                      ))
                    ) : (
                      <p className={styles.prmFullPreviewEmpty}>
                        ماده غذایی برای این وعده ثبت نشده است.
                      </p>
                    )}
                  </div>
                </section>
              ))}
        </div>
      </main>
      <footer className={styles.prmFullPreviewFoot}>
        <span>این پیش‌نمایش فقط خواندنی است.</span>
        <button
          type="button"
          className={styles.prmBtnPrimary}
          onClick={onClose}
        >
          بستن پیش‌نمایش
        </button>
      </footer>
    </div>
  );
}
