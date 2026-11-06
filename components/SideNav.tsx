"use client";
import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon from "./Icon";

type Item = { href: string; label: string; icon: string };
export default function SideNav({ groups }: { groups: { title: string; items: Item[] }[] }) {
  const path = usePathname();
  const nav = useRef<HTMLElement>(null);
  // Sur écran étroit, le menu défile horizontalement : on ramène l'onglet actif dans la vue.
  useEffect(() => {
    const el = nav.current, on = el?.querySelector<HTMLElement>(".navlink.on");
    if (!el || !on) return;
    const id = requestAnimationFrame(() => {
      if (el.scrollWidth <= el.clientWidth) return;
      const r = on.getBoundingClientRect(), b = el.getBoundingClientRect();
      el.scrollTo({ left: el.scrollLeft + r.left - b.left - (b.width - r.width) / 2, behavior: "smooth" });
    });
    return () => cancelAnimationFrame(id);
  }, [path]);
  return (
    <nav className="sidenav" ref={nav} aria-label="Menu principal">
      {groups.map((g) => g.items.length > 0 && (
        <div key={g.title} className="navgrp">
          <div className="navsec">{g.title}</div>
          {g.items.map((i) => (
            <Link key={i.href} href={i.href} className={`navlink ${path === i.href || path.startsWith(i.href + "/") ? "on" : ""}`}>
              <Icon name={i.icon} />{i.label}
            </Link>
          ))}
        </div>
      ))}
    </nav>
  );
}
