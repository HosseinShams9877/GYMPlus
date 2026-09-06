import type { Metadata } from "next";

import { CoachDashboard } from "@/features/dashboard/components/coach-dashboard";

export const metadata: Metadata = {
  title: "برنامه غذایی",
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function NutritionProgramPage() {
  return <CoachDashboard page="nutrition" />;
}
