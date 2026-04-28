import type { Metadata } from "next";

import { AccountDashboard } from "@/components/account/AccountDashboard";
import { SectionHeading } from "@/components/SectionHeading";

export const metadata: Metadata = {
  title: "Account",
  description: "Manage your CutSwitch subscription, transcript hours, and app access.",
};

export default function AccountPage() {
  return (
    <main className="container-edge py-16 sm:py-24">
      <SectionHeading
        eyebrow="Account"
        title="Your CutSwitch dashboard"
        subtitle="See your plan, transcript-hour usage, billing, and Mac app access in one place."
      />

      <div className="mt-8">
        <AccountDashboard />
      </div>
    </main>
  );
}
