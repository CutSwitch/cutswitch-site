import type { Metadata } from "next";

import { AdminForbidden, AdminShell } from "@/components/admin/AdminShell";
import { requireAdminPage } from "@/lib/admin/auth";
import { getAdminNavCounts } from "@/lib/admin/data";

export const metadata: Metadata = {
  title: "Admin",
  description: "CutSwitch founder/operator dashboard.",
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const auth = await requireAdminPage("/admin");

  if (!auth.ok) {
    return <AdminForbidden />;
  }

  const navCounts = await getAdminNavCounts();

  return <AdminShell navCounts={navCounts}>{children}</AdminShell>;
}
