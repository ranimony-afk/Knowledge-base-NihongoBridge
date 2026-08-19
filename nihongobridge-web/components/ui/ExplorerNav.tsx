import Link from "next/link";

import { ThemeToggle } from "@/components/ui/ThemeToggle";

export function ExplorerNav({ current }: { current: "dictionary" | "kanji" | "srs" }) {
  const links = [
    { href: "/dictionary", label: "Dictionary", id: "dictionary" },
    { href: "/kanji/水", label: "Kanji", id: "kanji" },
    { href: "/srs/demo", label: "SRS review", id: "srs" },
  ] as const;
  return (
    <header className="border-b border-sumi/10 bg-washi/90 px-4 py-3 backdrop-blur-xl dark:bg-[#141412]/90">
      <div className="mx-auto flex max-w-6xl items-center gap-4">
        <Link href="/dictionary" className="mr-auto flex items-center gap-2 font-bold">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-vermilion text-sm text-white">橋</span>
          <span className="hidden sm:inline">NihongoBridge</span>
        </Link>
        <nav aria-label="Explorer sections" className="flex items-center gap-1 overflow-x-auto">
          <Link
            href="/dashboard"
            className="whitespace-nowrap rounded-full px-3 py-2 text-xs font-semibold text-sumi/55 transition hover:bg-sumi/5 hover:text-sumi dark:text-washi/55 dark:hover:bg-white/10 dark:hover:text-washi sm:text-sm"
          >
            Dashboard
          </Link>
          {links.map((link) => (
            <Link
              key={link.id}
              href={link.href}
              aria-current={current === link.id ? "page" : undefined}
              className={`whitespace-nowrap rounded-full px-3 py-2 text-xs font-semibold transition sm:text-sm ${
                current === link.id
                  ? "bg-sumi text-washi dark:bg-washi dark:text-[#141412]"
                  : "text-sumi/55 hover:bg-sumi/5 hover:text-sumi dark:text-washi/60 dark:hover:bg-white/10 dark:hover:text-washi"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <ThemeToggle />
      </div>
    </header>
  );
}
