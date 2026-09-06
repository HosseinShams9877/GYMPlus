import type { Metadata } from "next";

import { RoleDashboard } from "@/features/dashboard/components/role-dashboard";

export const metadata: Metadata = {
  title: "داشبورد | GymPlus+",
};

export default function DashboardPage() {
  return <RoleDashboard />;
}
