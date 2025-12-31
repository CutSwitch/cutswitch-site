import { ImageResponse } from "next/og";
import { siteConfig } from "@/lib/site";

export const runtime = "edge";

export const size = {
  width: 1200,
  height: 600,
};

export const contentType = "image/png";

export default function TwitterImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          position: "relative",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: 80,
          background: siteConfig.brand.bg,
          color: "white",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(900px circle at 20% 10%, rgba(101,93,255,0.22), transparent 55%), radial-gradient(700px circle at 70% 30%, rgba(185,192,255,0.16), transparent 55%), radial-gradient(600px circle at 50% 80%, rgba(75,60,255,0.12), transparent 55%)",
          }}
        />

        <div style={{ position: "relative" }}>
          <div
            style={{
              fontSize: 54,
              fontWeight: 700,
              letterSpacing: -1,
              lineHeight: 1.1,
            }}
          >
            {siteConfig.name}
            <span style={{ color: siteConfig.brand.highlight }}>.</span>
          </div>
          <div style={{ fontSize: 26, opacity: 0.85, marginTop: 16 }}>{siteConfig.tagline}</div>
          <div style={{ fontSize: 18, opacity: 0.7, marginTop: 16, maxWidth: 900 }}>
            Voice-driven multicam edits for Final Cut Pro. Import XML, add per-speaker audio, export a new timeline.
          </div>
        </div>
      </div>
    ),
    size
  );
}
