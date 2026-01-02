import { MetadataRoute } from "next";
import { getBaseUrl } from "@/lib/env";

const routes = [
  "/",
  "/pricing",
  "/download",
  "/support",
  "/affiliates",
  "/terms",
  "/privacy",
  "/cookies",
  "/security",
  "/affiliate-terms",
  "/refunds",
  "/press",
  "/account",
  "/checkout/success",
  "/checkout/canceled",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = getBaseUrl();
  const now = new Date();

  return routes.map((path) => ({
    url: `${baseUrl}${path}`,
    lastModified: now,
    changeFrequency: path === "/" ? "weekly" : "monthly",
    priority: path === "/" ? 1 : 0.7,
  }));
}
