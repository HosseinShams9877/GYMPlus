import type { Metadata } from "next";

import { CoachDashboard } from "@/features/dashboard/components/coach-dashboard";

export const metadata: Metadata = {
  title: "شاگردان من",
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function StudentsPage() {
  return <CoachDashboard page="students" />;
}
