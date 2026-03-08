import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-background px-6 text-center">
      <div className="max-w-2xl space-y-8">
        <div className="space-y-2">
          <p className="text-sm font-medium text-primary tracking-widest uppercase">
            Profit × Kaizen
          </p>
          <h1 className="text-5xl font-bold tracking-tight">PROZEN</h1>
          <p className="text-xl text-muted-foreground">
            AI-native Product Management OS for solopreneurs.
          </p>
        </div>

        <p className="text-muted-foreground leading-relaxed">
          Stop juggling scattered docs, stale metrics, and forgotten decisions.
          PROZEN keeps your product context alive — so you can ship what matters.
        </p>

        <div className="flex gap-3 justify-center">
          <Link
            href="/sign-up"
            className="inline-flex items-center justify-center rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
          >
            Get started free
          </Link>
          <Link
            href="/sign-in"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-5 py-2.5 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            Sign in
          </Link>
        </div>
      </div>
    </main>
  );
}
