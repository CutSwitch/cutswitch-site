"use client";

import { useEffect, useState } from "react";

const POSTER = "/illust/start/start-hero-poster.jpg";

export function StartHeroVisual() {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return (
    <div
      className="absolute inset-0 overflow-hidden bg-[#090b1d]"
      aria-hidden="true"
      style={{
        backgroundImage: `url(${POSTER})`,
        backgroundSize: "cover",
        backgroundPosition: "42% center",
      }}
    >
      {reducedMotion ? (
        <img
          src={POSTER}
          alt=""
          className="h-full w-full object-cover object-[42%_center]"
          loading="eager"
          draggable={false}
        />
      ) : (
        <video
          className="h-full w-full scale-[1.03] object-cover object-[42%_center]"
          aria-hidden="true"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster={POSTER}
        >
          <source src="/illust/start/start-hero.av1.webm" type='video/webm; codecs="av01.0.05M.08"' />
          <source src="/illust/start/start-hero.vp9.webm" type='video/webm; codecs="vp9"' />
          <source src="/illust/start/start-hero.mp4" type="video/mp4" />
        </video>
      )}

      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_45%,transparent_0%,rgba(3,5,18,0.1)_46%,rgba(3,5,18,0.58)_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(5,6,17,0)_0%,rgba(5,6,17,0.06)_54%,rgba(13,16,32,0.92)_100%)]" />
      <div className="absolute inset-x-0 bottom-0 h-1/3 bg-[linear-gradient(to_top,rgba(3,5,18,0.42),transparent)]" />
    </div>
  );
}
