export const siteConfig = {
  name: "CutSwitch",
  tagline: "Switch cuts. Stay in flow.",
  description:
    "CutSwitch auto-switches Final Cut Pro multicam edits by who's speaking, with subscription plans based on editing time.",
  domain: "cutswitch.com",
  emails: {
    support: "support@cutswitch.com",
    feedback: "feedback@cutswitch.com",
    affiliate: "affiliate@cutswitch.com",
  },
  brand: {
    bg: "#0E1020",
    button: "#655DFF",
    highlight: "#B9C0FF",
    shadow: "#8F9BFF",
    edge: "#4B3CFF",
  },
} as const;

export type PlanKey = "monthly" | "yearly" | "lifetime";

export const planLabels: Record<PlanKey, string> = {
  monthly: "Monthly",
  yearly: "Yearly",
  lifetime: "Lifetime",
};

export const planBadges: Partial<Record<PlanKey, string>> = {
  yearly: "Best value",
  lifetime: "Own it",
};

export const supportLinks = {
  terms: "/terms",
  privacy: "/privacy",
  refunds: "/refunds",
  press: "/press",
  account: "/account",
} as const;
