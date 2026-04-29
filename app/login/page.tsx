import type { Metadata } from "next";
import { Suspense } from "react";

import { LoginForm } from "@/components/auth/LoginForm";
import { SectionHeading } from "@/components/SectionHeading";

export const metadata: Metadata = {
  title: "Sign in to CutSwitch",
  description: "Manage your CutSwitch subscription, editing time, and app access.",
};

export default function LoginPage() {
  return (
    <main className="container-edge py-16 sm:py-24">
      <SectionHeading
        eyebrow="Account"
        title="Sign in to CutSwitch"
        subtitle="Manage your subscription, editing time, and app access."
        className="mx-auto text-center"
      />
      <div className="mt-8">
        <Suspense fallback={<div className="card mx-auto max-w-md p-6 text-sm text-white/65">Loading sign in...</div>}>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
