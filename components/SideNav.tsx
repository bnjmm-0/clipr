"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon from "./Icon";

type Item = { href: string; label: string; icon: string };
export default function SideNav({ groups }: { groups: { title: string; items: Item[] }[] }) {
  const path = usePathname();
  return (
    <>
      {groups.map((g) => g.items.length > 0 && (
        <div key={g.title}>
          <div className="navsec">{g.title}</div>
          {g.items.map((i) => (
            <Link key={i.href} href={i.href} className={`navlink ${path === i.href || path.startsWith(i.href + "/") ? "on" : ""}`}>
              <Icon name={i.icon} />{i.label}
            </Link>
          ))}
        </div>
      ))}
    </>
  );
}
