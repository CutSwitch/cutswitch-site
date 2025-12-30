export const siteConfig = {
  name: "CutSwitch",
  tagline: "Switch cuts. Stay in flow.",
  description:
    "CutSwitch is a premium Mac app for editors who want the speed of muscle memory with the polish of automation. Download, try it free, and buy a license in minutes.",
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
  changelog: "/changelog",
  press: "/press",
  account: "/account",
} as const;
