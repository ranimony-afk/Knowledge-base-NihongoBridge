import { ShieldAlert } from "lucide-react";

export default function LoginPage() {
  return (
    <main className="grid min-h-dvh place-items-center bg-paper p-6">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-panel">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-red-50 text-admin">
          <ShieldAlert size={26} />
        </span>
        <h1 className="mt-5 text-2xl font-bold">Admin access required</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">
          Sign in through NihongoBridge with a super admin, content editor, or reviewer account.
        </p>
        <p className="mt-5 rounded-xl bg-slate-50 p-3 text-xs text-slate-500">
          Local development uses ADMIN_DEMO_MODE=true.
        </p>
      </section>
    </main>
  );
}
