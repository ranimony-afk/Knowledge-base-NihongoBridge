import Link from "next/link";

import { ThemeToggle } from "@/components/ui/ThemeToggle";

export function DashboardNav() {
  return (
    <header className="border-b border-sumi/10 bg-washi/90 px-4 py-3 backdrop-blur-xl dark:bg-[#141412]/90">
      <div className="mx-auto flex max-w-7xl items-center gap-3">
        <Link href="/dashboard" className="mr-auto flex items-center gap-2 font-bold">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-vermilion text-sm text-white">橋</span>
          <span className="hidden sm:inline">NihongoBridge</span>
        </Link>
        <nav aria-label="Primary" className="flex items-center gap-1 overflow-x-auto">
          <Link href="/dashboard" aria-current="page" className="rounded-full bg-sumi px-3 py-2 text-xs font-semibold text-washi dark:bg-washi dark:text-[#141412] sm:text-sm">Dashboard</Link>
          <Link href="/dictionary" className="rounded-full px-3 py-2 text-xs font-semibold text-sumi/55 hover:bg-sumi/5 dark:text-washi/55 dark:hover:bg-white/10 sm:text-sm">Dictionary</Link>
          <Link href="/kanji/水" className="rounded-full px-3 py-2 text-xs font-semibold text-sumi/55 hover:bg-sumi/5 dark:text-washi/55 dark:hover:bg-white/10 sm:text-sm">Kanji</Link>
          <Link href="/test/demo/results" className="rounded-full px-3 py-2 text-xs font-semibold text-sumi/55 hover:bg-sumi/5 dark:text-washi/55 dark:hover:bg-white/10 sm:text-sm">Tests</Link>
        </nav>
        <ThemeToggle />
      </div>
    </header>
  );
}
