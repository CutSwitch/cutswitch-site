import type { Metadata } from "next";
import Link from "next/link";
import { SectionHeading } from "@/components/SectionHeading";

export const metadata: Metadata = {
  title: "Changelog",
  description: "Release notes and updates for CutSwitch.",
};

export default function ChangelogPage() {
  return (
    <div className="container-edge">
      <SectionHeading
        eyebrow="Changelog"
        title="Release notes"
        subtitle="A simple placeholder page. Replace with real entries as you ship."
      />

      <div className="mt-8 card p-6">
        <div className="text-sm font-semibold text-white/90">v1.0.0</div>
        <p className="mt-2 text-sm text-white/65">
          Initial release. Premium UI, fast workflow, and the first set of automation actions.
        </p>

        <div className="mt-6 gradient-line" />

        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <Link className="btn btn-secondary" href="/download">
            Download
          </Link>
          <Link className="btn btn-ghost" href="/support">
            Support
          </Link>
        </div>
      </div>
    </div>
  );
}
