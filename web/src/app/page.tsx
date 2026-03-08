import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <header className="border-b border-border/50 sticky top-0 z-40 bg-background/80 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <span className="font-bold text-primary text-lg tracking-tight">PROZEN</span>
          <div className="flex items-center gap-3">
            <Link
              href="/sign-in"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Sign in
            </Link>
            <Link
              href="/sign-up"
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
            >
              Get started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-24 pb-20 text-center">
        <p className="text-sm font-medium text-primary tracking-widest uppercase mb-4">
          Profit × Kaizen
        </p>
        <h1 className="text-5xl sm:text-6xl font-bold tracking-tight leading-tight mb-6">
          The environment where PMs
          <br />
          <span className="text-primary">focus on bets, not documents</span>
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed mb-10">
          Cursor removed the burden of writing code from engineers.
          PROZEN removes the burden of writing specs from PMs.
          What remains is the only thing that matters:{" "}
          <strong className="text-foreground">deciding what to bet on.</strong>
        </p>
        <div className="flex gap-3 justify-center flex-wrap">
          <Link
            href="/sign-up"
            className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
          >
            Start free — first Bet Spec in 5 min
          </Link>
          <Link
            href="/sign-in"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-6 py-3 text-sm font-medium hover:bg-muted transition-colors"
          >
            Sign in
          </Link>
        </div>
        <p className="text-xs text-muted-foreground mt-4">No credit card required</p>
      </section>

      {/* Analogy callout */}
      <section className="border-y border-border bg-card">
        <div className="max-w-6xl mx-auto px-6 py-10">
          <div className="grid sm:grid-cols-2 gap-px bg-border rounded-xl overflow-hidden">
            <div className="bg-card px-8 py-6">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-2">Engineer</p>
              <p className="text-2xl font-semibold mb-1">What to code</p>
              <p className="text-sm text-muted-foreground">→ Cursor solves this</p>
            </div>
            <div className="bg-card px-8 py-6">
              <p className="text-xs font-medium text-primary uppercase tracking-widest mb-2">PM</p>
              <p className="text-2xl font-semibold mb-1">What to build</p>
              <p className="text-sm text-primary">→ PROZEN solves this</p>
            </div>
          </div>
        </div>
      </section>

      {/* 3 Modules */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest text-center mb-4">
          Core Modules
        </p>
        <h2 className="text-3xl font-bold text-center mb-12">One continuous decision loop</h2>
        <div className="grid sm:grid-cols-3 gap-6">
          <ModuleCard
            label="Module A"
            title="Context Layer"
            description="Long-term product memory. Natural language input → AI-structured context pack. Every decision, rationale, and constraint — always retrievable."
            items={["Context Pack (AI-structured)", "Decision Log with rationale", "Version history + restore"]}
          />
          <ModuleCard
            label="Module B"
            title="Spec Agent"
            description="A thinking partner, not a doc generator. Chat with AI to turn your idea into a structured Bet Spec — hypothesis, constraints, acceptance criteria."
            items={["Conversation-as-Spec pipeline", "Bet Spec format (AI-native)", "GitHub Living Spec sync"]}
            highlight
          />
          <ModuleCard
            label="Module C"
            title="Signal → Decision Loop"
            description="From dashboards that show numbers to dashboards that speak to your hypotheses. Anomalies propagate upward to active bets automatically."
            items={["3-layer metric model", "Anomaly → hypothesis alert", "Bet accuracy retrospective"]}
          />
        </div>
      </section>

      {/* Bet lifecycle */}
      <section className="border-t border-border bg-card">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest text-center mb-4">
            The Bet Structure
          </p>
          <h2 className="text-3xl font-bold text-center mb-12">
            Close the hypothesis loop
          </h2>
          <div className="grid sm:grid-cols-4 gap-4">
            {[
              { step: "01", label: "Hypothesis", desc: "\"Shortening onboarding will improve 7-day retention\"" },
              { step: "02", label: "Bet", desc: "2 weeks · targeting +5% KPI improvement" },
              { step: "03", label: "Outcome", desc: "+2.3% — the driver was Y, not X" },
              { step: "04", label: "Learning", desc: "Informs the next bet. Context pack updated." },
            ].map((item, i) => (
              <div key={i} className="rounded-xl border border-border bg-background p-5 space-y-2">
                <p className="text-xs font-mono text-muted-foreground">{item.step}</p>
                <p className="font-semibold">{item.label}</p>
                <p className="text-sm text-muted-foreground italic leading-snug">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AI autonomous actions */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest text-center mb-4">
          AI Autonomous Actions
        </p>
        <h2 className="text-3xl font-bold text-center mb-12">
          Your PM co-pilot never sleeps
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            { trigger: "Every morning", action: "Previous day summary + today's bet focus" },
            { trigger: "Every evening", action: "Decision log review + unresolved questions" },
            { trigger: "Weekly", action: "Auto-generated bet accuracy retrospective" },
            { trigger: "Activity anomaly", action: "Layer 3 spike → Layer 1 hypothesis impact alert" },
            { trigger: "GitHub commit / PR", action: "Diff detection → Living Spec update proposal" },
            { trigger: "Pre-release", action: "Bet Spec completeness checklist" },
          ].map((item, i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-4 space-y-1">
              <p className="text-xs font-medium text-primary">{item.trigger}</p>
              <p className="text-sm text-muted-foreground">{item.action}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section className="border-t border-border bg-card">
        <div className="max-w-6xl mx-auto px-6 py-20 text-center">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-4">Pricing</p>
          <h2 className="text-3xl font-bold mb-2">Solo tier</h2>
          <div className="inline-block mt-6 rounded-2xl border border-primary/30 bg-primary/5 px-12 py-8 space-y-4">
            <p className="text-5xl font-bold">$99<span className="text-xl font-normal text-muted-foreground">/mo</span></p>
            <ul className="text-sm text-muted-foreground space-y-2 text-left">
              {["All 3 core modules", "GitHub integration", "AI-native Bet Spec format", "Unlimited context pack versions", "Daily AI digest"].map((f) => (
                <li key={f} className="flex items-center gap-2">
                  <span className="text-primary">✓</span> {f}
                </li>
              ))}
            </ul>
            <Link
              href="/sign-up"
              className="block w-full rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
            >
              Start free trial
            </Link>
          </div>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="max-w-6xl mx-auto px-6 py-20 text-center">
        <h2 className="text-3xl font-bold mb-4">
          Stop shipping features.
          <br />
          <span className="text-primary">Start validating bets.</span>
        </h2>
        <p className="text-muted-foreground mb-8">
          Your first Bet Spec draft in under 5 minutes.
        </p>
        <Link
          href="/sign-up"
          className="inline-flex items-center justify-center rounded-md bg-primary px-8 py-3 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
        >
          Get started free
        </Link>
      </section>

      <footer className="border-t border-border py-8">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between text-xs text-muted-foreground">
          <span className="font-bold text-foreground">PROZEN</span>
          <span>Profit × Kaizen · AI-native PM OS</span>
        </div>
      </footer>
    </div>
  );
}

function ModuleCard({
  label,
  title,
  description,
  items,
  highlight,
}: {
  label: string;
  title: string;
  description: string;
  items: string[];
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-6 space-y-4 ${
        highlight
          ? "border-primary/40 bg-primary/5"
          : "border-border bg-card"
      }`}
    >
      <div>
        <p className={`text-xs font-medium uppercase tracking-widest mb-1 ${highlight ? "text-primary" : "text-muted-foreground"}`}>
          {label}
        </p>
        <h3 className="font-semibold text-lg">{title}</h3>
      </div>
      <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item} className="text-sm flex items-start gap-2">
            <span className={highlight ? "text-primary" : "text-muted-foreground"}>·</span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
