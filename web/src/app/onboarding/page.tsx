"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { workspaceApi } from "@/lib/api-client";

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = 1 | 2 | 3 | 4;

interface BetPreview {
  hypothesis: string;
  metric: string;
  target: string;
  duration: string;
  acceptance: string[];
  risks: string[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const KPI_OPTIONS = [
  "MRR",
  "DAU / MAU",
  "Day-7 Retention",
  "Activation Rate",
  "Conversion Rate",
  "NPS",
  "Other",
];

const KPI_TARGETS: Record<string, string> = {
  "MRR": "+15%",
  "DAU / MAU": "+20%",
  "Day-7 Retention": "+5 pp",
  "Activation Rate": "+12%",
  "Conversion Rate": "+8%",
  "NPS": "+10 points",
  "Other": "+10%",
};

function buildBetPreview(productName: string, kpi: string, betIdea: string): BetPreview {
  return {
    hypothesis: betIdea,
    metric: kpi,
    target: KPI_TARGETS[kpi] ?? "+10%",
    duration: "2 weeks",
    acceptance: [
      `${kpi} measured at day 7 and day 14 post-release`,
      "Improvement must be sustained, not a one-day spike",
      "Rollback plan documented before launch",
    ],
    risks: [
      "Implementation scope creep — timebox strictly to 2 weeks",
      `Confounding variables may obscure ${kpi} signal`,
    ],
  };
}

// ─── Animated Demo ────────────────────────────────────────────────────────────

const DEMO_STEPS = [
  {
    label: "Hypothesis",
    text: "Simplifying checkout will improve conversion rate",
    color: "text-primary",
  },
  {
    label: "Bet placed",
    text: "2 weeks · target: +5% conversion",
    color: "text-foreground",
  },
  {
    label: "Result",
    text: "+8.3% — driver was guest checkout, not UI redesign",
    color: "text-green-600 dark:text-green-400",
  },
  {
    label: "Learning",
    text: "Friction reduction > visual polish. Feeds into next bet.",
    color: "text-muted-foreground",
  },
] as const;

function BetLoopDemo() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setPhase((p) => (p + 1) % DEMO_STEPS.length), 2200);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/40">
        <div className="flex gap-1.5">
          <div className="size-2.5 rounded-full bg-border" />
          <div className="size-2.5 rounded-full bg-border" />
          <div className="size-2.5 rounded-full bg-border" />
        </div>
        <span className="text-xs text-muted-foreground mx-auto font-medium">
          PROZEN · Bet Loop
        </span>
      </div>

      <div className="p-6 space-y-4">
        <p className="text-xs text-muted-foreground uppercase tracking-wider">
          Sample: e-commerce checkout
        </p>
        {DEMO_STEPS.map((s, i) => (
          <div
            key={s.label}
            className={cn(
              "flex items-start gap-3 transition-all duration-500",
              i <= phase ? "opacity-100" : "opacity-25",
            )}
          >
            <div
              className={cn(
                "mt-0.5 size-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all duration-300",
                i < phase
                  ? "bg-primary border-primary"
                  : i === phase
                    ? "border-primary bg-primary/10"
                    : "border-border",
              )}
            >
              {i < phase && (
                <svg className="size-3 text-primary-foreground" fill="none" viewBox="0 0 12 12">
                  <path
                    d="M2 6l3 3 5-5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </div>
            <div className="space-y-0.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {s.label}
              </p>
              <p
                className={cn(
                  "text-sm font-medium transition-colors duration-300",
                  i === phase ? s.color : "text-muted-foreground",
                )}
              >
                {s.text}
              </p>
            </div>
          </div>
        ))}
        {phase === DEMO_STEPS.length - 1 && (
          <div className="pt-2 border-t border-border">
            <p className="text-xs text-primary font-medium animate-pulse">
              ↻ Learning feeds into next bet automatically
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Step 1: Demo ─────────────────────────────────────────────────────────────

function StepDemo({ onNext }: { onNext: () => void }) {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <p className="text-xs font-medium text-primary uppercase tracking-widest">Step 1 of 4</p>
        <h1 className="text-2xl font-bold tracking-tight">This is the PROZEN bet loop</h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Every shipped feature starts as a hypothesis. PROZEN turns that into a structured
          bet — tracks what happened, and why. The learning feeds your next decision automatically.
        </p>
      </div>

      <BetLoopDemo />

      <div className="space-y-3">
        <Button className="w-full" size="lg" onClick={onNext}>
          Set up your product →
        </Button>
        <button
          className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
          onClick={onNext}
        >
          Skip intro
        </button>
      </div>
    </div>
  );
}

// ─── Step 2: Product Info ─────────────────────────────────────────────────────

function StepProduct({
  productName,
  setProductName,
  productDesc,
  setProductDesc,
  kpi,
  setKpi,
  onNext,
}: {
  productName: string;
  setProductName: (v: string) => void;
  productDesc: string;
  setProductDesc: (v: string) => void;
  kpi: string;
  setKpi: (v: string) => void;
  onNext: () => void;
}) {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <p className="text-xs font-medium text-primary uppercase tracking-widest">Step 2 of 4</p>
        <h1 className="text-2xl font-bold tracking-tight">Tell us about your product</h1>
        <p className="text-sm text-muted-foreground">
          This becomes your product context — the brain PROZEN reasons from.
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">
            Product name <span className="text-destructive">*</span>
          </label>
          <input
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
            placeholder="e.g. PROZEN"
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
            autoFocus
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">One-liner</label>
          <textarea
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm min-h-[72px] focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground resize-none"
            placeholder="e.g. AI-native PM OS for solopreneurs who ship bets, not docs"
            value={productDesc}
            onChange={(e) => setProductDesc(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Main KPI right now</label>
          <select
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            value={kpi}
            onChange={(e) => setKpi(e.target.value)}
          >
            {KPI_OPTIONS.map((k) => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select>
        </div>
      </div>

      <Button
        className="w-full"
        size="lg"
        disabled={!productName.trim()}
        onClick={onNext}
      >
        Next →
      </Button>
    </div>
  );
}

// ─── Step 3: First Bet ────────────────────────────────────────────────────────

function StepFirstBet({
  productName,
  kpi,
  betIdea,
  setBetIdea,
  generating,
  betPreview,
  onGenerate,
  onNext,
  onSkip,
}: {
  productName: string;
  kpi: string;
  betIdea: string;
  setBetIdea: (v: string) => void;
  generating: boolean;
  betPreview: BetPreview | null;
  onGenerate: () => void;
  onNext: () => void;
  onSkip: () => void;
}) {
  if (betPreview) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <p className="text-xs font-medium text-primary uppercase tracking-widest">Step 3 of 4</p>
          <h1 className="text-2xl font-bold tracking-tight">Your first Bet is ready</h1>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <div className="size-2 rounded-full bg-primary" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {productName} · Bet Draft
            </span>
            <span className="ml-auto text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
              draft
            </span>
          </div>

          <div className="space-y-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Hypothesis</p>
              <p className="text-sm font-medium">{betPreview.hypothesis}</p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Metric</p>
                <p className="text-sm font-medium">{betPreview.metric}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Target</p>
                <p className="text-sm font-medium text-primary">{betPreview.target}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Duration</p>
                <p className="text-sm font-medium">{betPreview.duration}</p>
              </div>
            </div>

            <div>
              <p className="text-xs text-muted-foreground mb-1.5">Acceptance criteria</p>
              <ul className="space-y-1">
                {betPreview.acceptance.map((a, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs">
                    <span className="text-primary mt-0.5 shrink-0">✓</span>
                    <span>{a}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="text-xs text-muted-foreground mb-1.5">Risks</p>
              <ul className="space-y-1">
                {betPreview.risks.map((r, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs">
                    <span className="text-muted-foreground mt-0.5 shrink-0">⚠</span>
                    <span className="text-muted-foreground">{r}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <Button className="w-full" size="lg" onClick={onNext}>
          Save and continue →
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <p className="text-xs font-medium text-primary uppercase tracking-widest">Step 3 of 4</p>
        <h1 className="text-2xl font-bold tracking-tight">What are you betting on?</h1>
        <p className="text-sm text-muted-foreground">
          Describe the hypothesis you are currently working on. PROZEN will generate
          your first Bet Spec.
        </p>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium">
          Your hypothesis <span className="text-destructive">*</span>
        </label>
        <textarea
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm min-h-[100px] focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground resize-none"
          placeholder="e.g. Simplifying the onboarding flow will improve day-7 retention"
          value={betIdea}
          onChange={(e) => setBetIdea(e.target.value)}
          autoFocus
          disabled={generating}
        />
      </div>

      <div className="space-y-2">
        <Button
          className="w-full"
          size="lg"
          disabled={!betIdea.trim() || generating}
          onClick={onGenerate}
        >
          {generating ? (
            <span className="flex items-center gap-2">
              <span className="size-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              Generating Bet Spec…
            </span>
          ) : (
            "Generate my first Bet →"
          )}
        </Button>
        <button
          className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
          onClick={onSkip}
          disabled={generating}
        >
          Skip — I&apos;ll add a bet later
        </button>
      </div>
    </div>
  );
}

// ─── Step 4: Done ─────────────────────────────────────────────────────────────

function StepDone({
  productName,
  hasBet,
  saving,
  error,
  warnings,
  canContinue,
  onFinish,
}: {
  productName: string;
  hasBet: boolean;
  saving: boolean;
  error: string | null;
  warnings: string[];
  canContinue: boolean;
  onFinish: () => void;
}) {
  return (
    <div className="space-y-8 text-center">
      <div className="space-y-4">
        <div className="size-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
          <svg className="size-8 text-primary" fill="none" viewBox="0 0 24 24">
            <path
              d="M5 13l4 4L19 7"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <div className="space-y-2">
          <p className="text-xs font-medium text-primary uppercase tracking-widest">All set</p>
          <h1 className="text-2xl font-bold tracking-tight">
            {productName || "Your product"} is ready
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Your workspace is being set up. One click to open your Bet Board.
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive text-left">
          {error}
        </div>
      )}
      {warnings.length > 0 && (
        <div className="rounded-md border border-yellow-500/40 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-700 dark:text-yellow-400 text-left space-y-1">
          <p className="font-medium">Setup completed with warnings.</p>
          <ul className="list-disc pl-5 space-y-0.5">
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-xl border border-border bg-card p-4 text-left space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          We&apos;ll set up
        </p>
        <div className="space-y-1.5">
          {[
            "Your workspace",
            `Product: ${productName || "—"}`,
            ...(hasBet ? ["First Bet drafted"] : []),
          ].map((item) => (
            <div key={item} className="flex items-center gap-2 text-sm">
              <span className="text-primary">✓</span>
              <span>{item}</span>
            </div>
          ))}
        </div>
      </div>

      <Button
        className="w-full"
        size="lg"
        onClick={onFinish}
        disabled={saving}
      >
        {saving ? (
          <span className="flex items-center gap-2">
            <span className="size-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
            Setting up your workspace…
          </span>
        ) : (
          canContinue ? "Continue to Bet Board →" : "Open Bet Board →"
        )}
      </Button>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter();
  const { getToken } = useAuth();

  // Guard: redirect if user already has a workspace
  useEffect(() => {
    async function checkExistingWorkspace() {
      try {
        const token = await getToken();
        const { workspaceApi } = await import("@/lib/api-client");
        const res = await workspaceApi(token).list();
        if (res.items.length > 0) {
          const ws = res.items[0]!;
          router.replace(`/workspaces/${ws.id}`);
        }
      } catch {
        // If check fails, let user proceed with onboarding
      }
    }
    void checkExistingWorkspace();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [step, setStep] = useState<Step>(1);
  const [productName, setProductName] = useState("");
  const [productDesc, setProductDesc] = useState("");
  const [kpi, setKpi] = useState(KPI_OPTIONS[0]!);
  const [betIdea, setBetIdea] = useState("");
  const [generating, setGenerating] = useState(false);
  const [betPreview, setBetPreview] = useState<BetPreview | null>(null);
  const [skipFirstBet, setSkipFirstBet] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [redirectPath, setRedirectPath] = useState<string | null>(null);

  function handleGenerateBet() {
    if (!betIdea.trim()) return;
    setSkipFirstBet(false);
    setGenerating(true);
    setTimeout(() => {
      setBetPreview(buildBetPreview(productName, kpi, betIdea.trim()));
      setGenerating(false);
    }, 1800);
  }

  async function handleFinish() {
    if (redirectPath) {
      router.push(redirectPath);
      return;
    }
    setSaving(true);
    setError(null);
    setWarnings([]);
    try {
      const token = await getToken();
      const result = await workspaceApi(token).setupOnboarding({
        workspaceName: productName.trim() || "My Workspace",
        productName: productName.trim() || "My Product",
        productDescription: productDesc.trim() || undefined,
        mainKpi: kpi || undefined,
        firstBetIdea: betIdea.trim() || undefined,
        skipFirstBet: skipFirstBet || betIdea.trim().length === 0,
      });

      const nextPath = `/workspaces/${result.workspace.id}/products/${result.product.id}/bets`;

      if (result.warnings.length > 0) {
        setWarnings(result.warnings.map((w) => `[${w.step}] ${w.message}`));
        setRedirectPath(nextPath);
        setSaving(false);
        return;
      }

      router.push(nextPath);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to set up workspace. Please try again.");
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Top progress bar */}
      <div className="fixed top-0 left-0 right-0 h-0.5 bg-muted z-50">
        <div
          className="h-full bg-primary transition-all duration-700 ease-out"
          style={{ width: `${(step / 4) * 100}%` }}
        />
      </div>

      {/* Wordmark */}
      <div className="fixed top-4 left-6 z-40">
        <span className="text-sm font-bold text-primary tracking-tight">PROZEN</span>
      </div>

      <div className="max-w-lg mx-auto px-6 py-20">
        {step === 1 && <StepDemo onNext={() => setStep(2)} />}
        {step === 2 && (
          <StepProduct
            productName={productName}
            setProductName={setProductName}
            productDesc={productDesc}
            setProductDesc={setProductDesc}
            kpi={kpi}
            setKpi={setKpi}
            onNext={() => setStep(3)}
          />
        )}
        {step === 3 && (
          <StepFirstBet
            productName={productName}
            kpi={kpi}
            betIdea={betIdea}
            setBetIdea={setBetIdea}
            generating={generating}
            betPreview={betPreview}
            onGenerate={handleGenerateBet}
            onNext={() => setStep(4)}
            onSkip={() => {
              setSkipFirstBet(true);
              setStep(4);
            }}
          />
        )}
        {step === 4 && (
          <StepDone
            productName={productName}
            hasBet={!skipFirstBet && !!betIdea.trim()}
            saving={saving}
            error={error}
            warnings={warnings}
            canContinue={redirectPath !== null}
            onFinish={() => void handleFinish()}
          />
        )}
      </div>
    </div>
  );
}
