import type { Metadata } from "next";
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
    <div data-start-page className="-my-10 min-h-screen bg-white text-zinc-950 dark:bg-[#0e101f] dark:text-white">
      <div className="grid min-h-screen lg:grid-cols-[minmax(0,0.95fr)_minmax(520px,1fr)]">
        <aside className="relative hidden overflow-hidden bg-[#05040b] lg:block" aria-hidden="true">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_18%,rgba(255,232,172,0.75),transparent_12%),radial-gradient(circle_at_64%_25%,rgba(240,194,127,0.48),transparent_20%),radial-gradient(circle_at_42%_62%,rgba(185,28,255,0.82),transparent_26%),radial-gradient(circle_at_20%_82%,rgba(31,44,255,0.82),transparent_30%),linear-gradient(135deg,#05040b_0%,#090717_42%,#120824_100%)]" />
          <div className="absolute -left-[28%] top-[18%] h-[86%] w-[78%] rounded-full border border-white/16 bg-[linear-gradient(135deg,rgba(255,255,255,0.16),rgba(255,255,255,0.02)_38%,rgba(101,93,255,0.24)_72%,rgba(0,0,0,0)_100%)] blur-[1px]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_12%,rgba(255,255,255,0.24),transparent_8%),linear-gradient(90deg,rgba(0,0,0,0.2),transparent_55%)]" />
        </aside>

        <section className="relative flex min-h-screen items-center justify-center px-6 py-12 sm:px-10">
          <div className="absolute inset-x-0 top-0 h-48 bg-[radial-gradient(circle_at_50%_0%,rgba(101,93,255,0.12),transparent_60%)] lg:hidden" aria-hidden="true" />

          <div className="relative w-full max-w-md text-center">
            <div className="mx-auto flex justify-center">
              <Logo markOnly className="pointer-events-auto scale-[1.45]" />
            </div>

            <h1 className="mt-10 text-3xl font-semibold tracking-tight text-zinc-950 dark:text-white">Welcome</h1>
            <p className="mt-3 text-base text-zinc-500 dark:text-white/58">Enter your email to get started.</p>

            {error ? (
              <div className="mt-6 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-200">
                That magic link could not be verified. Try sending a fresh one.
              </div>
            ) : null}

            <StartTrialForm plan={plan} source={source} next={next} />
          </div>
        </section>
      </div>
    </div>
  );
}
