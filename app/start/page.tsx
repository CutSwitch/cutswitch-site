import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Logo } from "@/components/Logo";
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
        <aside className="relative hidden overflow-hidden bg-[#050611] lg:block" aria-hidden="true">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_24%_25%,rgba(255,218,153,0.22),transparent_18%),radial-gradient(circle_at_84%_78%,rgba(101,93,255,0.34),transparent_32%),linear-gradient(145deg,#050611_0%,#0a0820_44%,#12152b_100%)]" />
          <div className="absolute left-[10%] top-[18%] h-[64%] w-[72%] rounded-[44px] border border-white/10 bg-white/[0.035] shadow-[0_80px_180px_rgba(0,0,0,0.48)] backdrop-blur-sm" />
          <div className="absolute left-[18%] top-[28%] h-[46%] w-[58%] rounded-full bg-[radial-gradient(circle_at_40%_45%,rgba(101,93,255,0.72),rgba(83,40,214,0.2)_44%,transparent_70%)] blur-2xl" />
          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-[linear-gradient(to_top,rgba(101,93,255,0.22),transparent)]" />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(5,6,17,0.18),transparent_42%,rgba(5,6,17,0.2))]" />
          <div className="absolute bottom-10 left-10 right-10 rounded-3xl border border-white/10 bg-black/20 p-6 text-sm leading-relaxed text-white/70 shadow-2xl backdrop-blur-md">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-brand-light">CutSwitch trial</p>
            <p className="mt-3 max-w-sm">
              Start with 7 days free and 4 hours included. Pick the plan you’ll continue on after the trial.
            </p>
          </div>
        </aside>

        <section className="relative flex min-h-screen items-center justify-center overflow-hidden px-6 py-12 sm:px-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(101,93,255,0.2),transparent_46%),linear-gradient(180deg,#111427,#0d1020)]" aria-hidden="true" />

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
