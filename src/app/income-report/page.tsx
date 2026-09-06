import type { Metadata } from "next";

import { CoachDashboard } from "@/features/dashboard/components/coach-dashboard";

export const metadata: Metadata = {
  title: "گزارش درآمد",
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function IncomeReportPage() {
  return <CoachDashboard page="income" />;
}
