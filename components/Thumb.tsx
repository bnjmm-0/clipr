"use client";
import { useState } from "react";

// Miniature d'une vidéo de réseau social : les liens TikTok expirent après 6 h, on affiche alors un fond neutre.
export default function Thumb({ src, platform }: { src?: string; platform: string }) {
  const [broken, setBroken] = useState(!src);
  return broken
    ? <span className="thumbph"><img src={`/stats/logo-${platform}.png`} alt="" /></span>
    : <img className="thumbimg" src={src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} />;
}
