import type { Metadata } from "next";

import { CoachDashboard } from "@/features/dashboard/components/coach-dashboard";

export const metadata: Metadata = {
  title: "تنظیمات",
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function SettingsPage() {
  return <CoachDashboard page="settings" />;
}
