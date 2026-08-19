import { TutorChat } from "@/components/ai/TutorChat";

const DEMO_CONTEXT = {
  current_level: "N4" as const,
  recent_mistakes: [],
  current_topic: "〜てから",
  language_preference: "en" as const,
};

export default function TutorDemoPage() {
  return (
    <main className="relative min-h-screen overflow-hidden px-5 py-12 sm:px-8 lg:px-12">
      <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full border-[52px] border-vermilion/[0.035]" />
      <div className="mx-auto max-w-5xl">
        <nav className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-vermilion font-jp text-lg font-bold text-white shadow-stamp">日</span>
            <span className="font-bold tracking-[-0.02em]">NihongoBridge</span>
          </div>
          <span className="rounded-full border border-sumi/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-sumi/45 dark:border-white/10 dark:text-washi/40">AI tutor</span>
        </nav>

        <section className="mt-20 grid items-start gap-10 lg:grid-cols-[1.1fr_.9fr] lg:gap-20">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-vermilion">Grammar · N4</p>
            <h1 className="jp-text mt-5 text-5xl font-semibold tracking-tight sm:text-7xl">〜てから</h1>
            <p className="mt-5 max-w-xl text-xl leading-relaxed text-sumi/55 dark:text-washi/50">After doing… · once something is complete</p>
            <div className="mt-10 rounded-3xl border border-sumi/10 bg-white/55 p-6 shadow-paper dark:border-white/10 dark:bg-white/[0.035] sm:p-8">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-sumi/35 dark:text-washi/30">Formation</p>
              <p className="jp-text mt-3 text-2xl font-semibold">Verb て-form ＋ から</p>
              <div className="mt-7 border-l-2 border-vermilion/25 pl-5">
                <p className="jp-text text-lg leading-[2.1]">
                  <ruby>宿題<rt>しゅくだい</rt></ruby>をしてから、<ruby>映画<rt>えいが</rt></ruby>を<ruby>見<rt>み</rt></ruby>ます。
                </p>
                <p className="mt-2 text-sm text-sumi/50 dark:text-washi/45">After doing my homework, I’ll watch a movie.</p>
              </div>
            </div>
          </div>
          <aside className="rounded-3xl border border-sumi/10 bg-[#F1ECE1]/55 p-7 dark:border-white/10 dark:bg-white/[0.025]">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-vermilion">Hana’s note</p>
            <h2 className="mt-3 text-2xl font-bold tracking-tight">Need another explanation?</h2>
            <p className="mt-3 text-sm leading-relaxed text-sumi/55 dark:text-washi/50">
              Hana-sensei knows what you are studying and can explain it, make a fresh example, or quiz you without leaving the page.
            </p>
            <p className="mt-6 text-sm font-semibold">Open the tutor in the bottom-right corner.</p>
          </aside>
        </section>
      </div>

      <TutorChat
        context={DEMO_CONTEXT}
        topicLabel="〜てから"
        initialOpen
        demoMode
        storageKey="nihongobridge:tutor:demo:v1"
      />
    </main>
  );
}
