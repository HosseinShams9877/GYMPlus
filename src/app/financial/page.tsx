import type { Metadata } from "next";

import { CoachDashboard } from "@/features/dashboard/components/coach-dashboard";

export const metadata: Metadata = {
  title: "حسابداری و مالی",
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function FinancialPage() {
  return <CoachDashboard page="financial" />;
}
