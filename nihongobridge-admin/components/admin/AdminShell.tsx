"use client";

import {
  BookOpenText,
  ChevronRight,
  DatabaseZap,
  FileQuestion,
  Gauge,
  Image,
  Languages,
  LogOut,
  Menu,
  Newspaper,
  ScrollText,
  ShieldCheck,
  SpellCheck2,
  TestTube2,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";

import { demoAdmin } from "@/lib/demo-data";

const nav = [
  { href: "/admin", label: "Dashboard", icon: Gauge },
  { href: "/admin/dictionary", label: "Dictionary", icon: Languages },
  { href: "/admin/kanji", label: "Kanji", icon: SpellCheck2 },
  { href: "/admin/tests", label: "Tests", icon: TestTube2 },
  { href: "/admin/questions", label: "Questions", icon: FileQuestion },
  { href: "/admin/media", label: "Media", icon: Image },
  { href: "/admin/etl", label: "ETL Pipelines", icon: DatabaseZap },
  { href: "/admin/blog", label: "Blog", icon: Newspaper },
];

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const segments = pathname.split("/").filter(Boolean);

  return (
    <div className="min-h-dvh bg-paper text-ink">
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-slate-200 bg-[#202A38] text-white transition-transform lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 items-center gap-3 border-b border-white/10 px-5">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-admin font-jp font-bold">橋</span>
          <div>
            <p className="font-bold">NihongoBridge</p>
            <p className="text-[.65rem] uppercase tracking-[.2em] text-white/45">Admin CMS</p>
          </div>
          <button type="button" onClick={() => setMobileOpen(false)} aria-label="Close navigation" className="ml-auto grid h-9 w-9 place-items-center rounded-lg hover:bg-white/10 lg:hidden">
            <X size={18} />
          </button>
        </div>

        <nav className="admin-scrollbar flex-1 overflow-y-auto p-3" aria-label="Admin navigation">
          <p className="px-3 pb-2 pt-3 text-[.62rem] font-bold uppercase tracking-[.18em] text-white/35">Workspace</p>
          <ul className="space-y-1">
            {nav.map((item) => {
              const active = item.href === "/admin" ? pathname === item.href : pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                      active ? "bg-white text-[#202A38] shadow-sm" : "text-white/65 hover:bg-white/8 hover:text-white"
                    }`}
                  >
                    <Icon size={18} /> {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
          <p className="mt-6 px-3 pb-2 text-[.62rem] font-bold uppercase tracking-[.18em] text-white/35">Governance</p>
          <Link href="/admin#audit" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-white/65 hover:bg-white/8 hover:text-white">
            <ScrollText size={18} /> Audit log
          </Link>
        </nav>

        <div className="border-t border-white/10 p-4">
          <div className="flex items-center gap-3 rounded-xl bg-white/[.06] p-3">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-admin/90 text-xs font-bold">MT</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{demoAdmin.name}</p>
              <p className="mt-0.5 flex items-center gap-1 truncate text-[.65rem] text-white/45">
                <ShieldCheck size={11} /> {demoAdmin.role.replace("_", " ")}
              </p>
            </div>
            <button type="button" aria-label="Sign out" className="text-white/40 hover:text-white"><LogOut size={17} /></button>
          </div>
        </div>
      </aside>

      {mobileOpen ? <button type="button" aria-label="Close navigation backdrop" onClick={() => setMobileOpen(false)} className="fixed inset-0 z-40 bg-black/35 lg:hidden" /> : null}

      <div className="lg:pl-72">
        <header className="sticky top-0 z-30 flex h-16 items-center border-b border-slate-200 bg-paper/90 px-4 backdrop-blur-xl sm:px-6">
          <button type="button" onClick={() => setMobileOpen(true)} aria-label="Open navigation" className="mr-3 grid h-10 w-10 place-items-center rounded-lg border border-slate-200 bg-white lg:hidden">
            <Menu size={19} />
          </button>
          <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-sm text-slate-500">
            <Link href="/admin" className="font-medium hover:text-ink">Admin</Link>
            {segments.slice(1).map((segment, index) => (
              <span key={`${segment}-${index}`} className="flex min-w-0 items-center gap-1.5">
                <ChevronRight size={14} className="shrink-0 text-slate-300" />
                <span className="truncate capitalize text-ink">{segment.replaceAll("-", " ")}</span>
              </span>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800">
            <BookOpenText size={14} /> Demo workspace
          </div>
        </header>
        <div className="p-4 sm:p-6 xl:p-8">{children}</div>
      </div>
    </div>
  );
}
