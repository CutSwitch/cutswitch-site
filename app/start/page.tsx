import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Logo } from "@/components/Logo";
import { StartHeroVisual } from "@/components/auth/StartHeroVisual";
import { StartTrialForm } from "@/components/auth/StartTrialForm";
import { buildTrialRedirectPath, sanitizeInternalPath, sanitizeStartPlan, sanitizeStartSource } from "@/lib/startFlow";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Start your free trial",
  description: "Enter your email to start a CutSwitch free trial.",
};

type StartPageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

function getParam(searchParams: StartPageProps["searchParams"], key: string) {
  const value = searchParams?.[key];
  return Array.isArray(value) ? value[0] : value;
}

export default async function StartPage({ searchParams }: StartPageProps) {
  const plan = sanitizeStartPlan(getParam(searchParams, "plan"));
  const source = sanitizeStartSource(getParam(searchParams, "source"));
  const next = sanitizeInternalPath(getParam(searchParams, "next"));
  const error = getParam(searchParams, "error");

  let signedIn = false;
  try {
    const supabase = createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    signedIn = Boolean(user);
  } catch {
    // If local auth env is missing, still render the page; the form will show a safe setup error.
  }

  if (signedIn) {
    redirect(buildTrialRedirectPath({ plan, source, next }));
  }

  return (
    <div data-start-page className="-my-10 min-h-screen bg-[#0d1020] text-white">
      <div className="grid min-h-screen lg:grid-cols-[minmax(0,0.96fr)_minmax(520px,1fr)]">
        <aside className="relative hidden min-h-screen overflow-hidden bg-[#050611] lg:block" aria-hidden="true">
          <StartHeroVisual />
        </aside>

        <section className="relative flex min-h-screen items-center justify-center overflow-hidden px-6 py-12 sm:px-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(101,93,255,0.2),transparent_46%),linear-gradient(180deg,#111427,#0d1020)]" aria-hidden="true" />
          <div
            className="absolute inset-0 bg-[url('/illust/start/start-hero-poster.jpg')] bg-cover bg-[position:42%_center] opacity-35 lg:hidden"
            aria-hidden="true"
          />
          <div className="absolute inset-0 bg-[#0d1020]/78 backdrop-blur-[1px] lg:hidden" aria-hidden="true" />

          <div className="relative w-full max-w-md text-center">
            <div className="mx-auto flex justify-center">
              <Logo markOnly className="pointer-events-auto scale-[1.35]" />
            </div>

            <h1 className="mt-10 text-3xl font-semibold tracking-tight text-white">Welcome</h1>
            <p className="mt-3 text-base text-white/58">Enter your email to get started.</p>

            {error ? (
              <div className="mt-6 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-200">
                That magic link could not be verified. Try sending a fresh one.
              </div>
            ) : null}

            <StartTrialForm plan={plan} source={source} next={next} />

            <div className="mt-8 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm text-white/50">
              <Link className="transition hover:text-white" href="/pricing">
                Back to pricing
              </Link>
              <span aria-hidden="true">·</span>
              <Link className="transition hover:text-white" href="/login?next=/pricing">
                Already have an account? Log in
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
