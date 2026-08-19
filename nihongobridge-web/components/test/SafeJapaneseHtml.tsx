"use client";

import DOMPurify from "dompurify";
import { useEffect, useMemo, useState } from "react";

interface SafeJapaneseHtmlProps {
  html: string;
  showFurigana?: boolean;
  className?: string;
}

export function SafeJapaneseHtml({
  html,
  showFurigana = true,
  className = "",
}: SafeJapaneseHtmlProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const sanitized = useMemo(() => {
    if (!mounted) return escapeHtml(plainJapanese(html)).replaceAll("\n", "<br>");
    return DOMPurify.sanitize(html.replaceAll("\n", "<br>"), {
      ALLOWED_TAGS: ["ruby", "rt", "rp", "span", "br", "p", "em", "strong", "mark"],
      ALLOWED_ATTR: ["class", "lang"],
    });
  }, [html, mounted]);

  return (
    <div
      className={`jp-text ${showFurigana ? "" : "furigana-hidden"} ${className}`}
      lang="ja"
      dangerouslySetInnerHTML={{ __html: sanitized }}
    />
  );
}

function plainJapanese(value: string): string {
  return value
    .replace(/<rt\b[^>]*>[\s\S]*?<\/rt>/gi, "")
    .replace(/<rp\b[^>]*>[\s\S]*?<\/rp>/gi, "")
    .replace(/<[^>]+>/g, "");
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
