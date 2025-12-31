import type { Metadata } from "next";
import Link from "next/link";
import { SectionHeading } from "@/components/SectionHeading";

export const metadata: Metadata = {
  title: "Demo",
  description: "Watch the CutSwitch walkthrough demo with sound.",
};

export default function DemoPage() {
  return (
    <div className="container-edge">
      <SectionHeading
        eyebrow="Demo"
        title="How to use CutSwitch (with sound)"
        subtitle="This page is the full walkthrough. The home page uses a muted looping preview so it can autoplay everywhere."
      />

      <div className="mt-8">
        <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-4 shadow-soft">
          <div className="flex items-center gap-2 border-b border-white/10 bg-black/25 px-4 py-3 rounded-2xl">
            <span className="h-2.5 w-2.5 rounded-full bg-white/25" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/25" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/25" />
            <div className="ml-3 text-[11px] font-semibold text-white/55">CutSwitch demo</div>
            <div className="ml-auto text-[11px] text-white/35">sound on</div>
          </div>

          <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-black/25">
            <video
              className="h-full w-full"
              src="/videos/demo.mp4"
              controls
              playsInline
              preload="metadata"
            />
          </div>

          <div className="mt-4 flex flex-col gap-2 text-sm text-white/65">
            <div>
              • If the video is silent, export a version with audio and replace{" "}
              <span className="font-mono text-white/80">/public/videos/demo.mp4</span>.
            </div>
            <div>
              • Want to go back?{" "}
              <Link className="underline decoration-white/20 hover:decoration-white/60" href="/">
                Return home
              </Link>
              .
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
