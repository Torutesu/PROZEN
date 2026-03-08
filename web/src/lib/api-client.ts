// Typed API client for PROZEN backend.
// Uses Clerk's getToken() for auth — pass the token from useAuth().

const API_URL =
  process.env["NEXT_PUBLIC_API_URL"] ?? "http://127.0.0.1:8787";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(
  path: string,
  options: RequestInit & { token?: string | null } = {},
): Promise<T> {
  const { token, ...init } = options;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init.headers as Record<string, string> | undefined),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, { ...init, headers });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as {
      code?: string;
      message?: string;
    };
    throw new ApiError(
      res.status,
      body.code ?? "unknown_error",
      body.message ?? `HTTP ${res.status}`,
    );
  }

  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Context Pack
// ---------------------------------------------------------------------------

export interface ContextPackIngestResponse {
  job_id: string;
  status: string;
  provisional_version: {
    context_pack_id: string;
    version: number;
    version_id: string;
    created_at: string;
  };
}

export interface ContextPackData {
  context_pack_id: string;
  current_version: number;
  data: unknown;
}

export interface VersionListItem {
  id: string;
  versionNumber: number;
  summary: string;
  source: string;
  createdBy: string;
  createdAt: string;
}

export interface PaginatedVersions {
  total: number;
  limit: number;
  offset: number;
  items: VersionListItem[];
}

export function contextPackApi(
  workspaceId: string,
  productId: string,
  token: string | null,
) {
  const base = `/api/v1/workspaces/${workspaceId}/products/${productId}`;
  return {
    ingest: (input: string, tags?: string[]) =>
      request<ContextPackIngestResponse>(`${base}/context-pack/ingest`, {
        method: "POST",
        body: JSON.stringify({ input, ...(tags ? { tags } : {}) }),
        token,
      }),
    getCurrent: () =>
      request<ContextPackData>(`${base}/context-pack`, { token }),
    getVersions: (limit = 50, offset = 0) =>
      request<PaginatedVersions>(
        `${base}/context-pack/versions?limit=${limit}&offset=${offset}`,
        { token },
      ),
    restore: (version: number) =>
      request(`${base}/context-pack/restore`, {
        method: "POST",
        body: JSON.stringify({ version }),
        token,
      }),
  };
}

// ---------------------------------------------------------------------------
// Decision Logs
// ---------------------------------------------------------------------------

export interface DecisionLog {
  id: string;
  workspaceId: string;
  productId: string;
  title: string;
  decision: string;
  rationale: string;
  alternatives: string[];
  evidenceLinks: string[];
  createdBy: string;
  createdAt: string;
}

export interface PaginatedDecisionLogs {
  total: number;
  limit: number;
  offset: number;
  items: DecisionLog[];
}

export interface CreateDecisionLogInput {
  title: string;
  decision: string;
  rationale: string;
  alternatives?: string[];
  evidenceLinks?: string[];
}

export function decisionLogApi(
  workspaceId: string,
  productId: string,
  token: string | null,
) {
  const base = `/api/v1/workspaces/${workspaceId}/products/${productId}`;
  return {
    list: (limit = 50, offset = 0) =>
      request<PaginatedDecisionLogs>(
        `${base}/decision-logs?limit=${limit}&offset=${offset}`,
        { token },
      ),
    get: (id: string) =>
      request<DecisionLog>(`${base}/decision-logs/${id}`, { token }),
    create: (input: CreateDecisionLogInput) =>
      request<DecisionLog>(`${base}/decision-logs`, {
        method: "POST",
        body: JSON.stringify(input),
        token,
      }),
  };
}

// ---------------------------------------------------------------------------
// Metrics (M3)
// ---------------------------------------------------------------------------

export type MetricLayer = "bet" | "kpi" | "activity";

export interface MetricRecord {
  id: string;
  workspaceId: string;
  productId: string;
  name: string;
  description: string | null;
  layer: MetricLayer;
  unit: string | null;
  direction: "increase" | "decrease";
  targetValue: number | null;
  baselineValue: number | null;
  betSpecId: string | null;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReadingRecord {
  id: string;
  metricId: string;
  value: number;
  recordedAt: string;
  source: string;
  note: string | null;
  createdBy: string;
}

export interface AnomalyRecord {
  id: string;
  metricId: string;
  metricName?: string;
  readingId: string | null;
  severity: "low" | "medium" | "high";
  direction: "above_target" | "below_target";
  baselineValue: number | null;
  actualValue: number;
  deviationPct: number | null;
  impactNarrative: string | null;
  isResolved: boolean;
  createdAt: string;
}

export interface AddReadingResponse {
  reading: ReadingRecord;
  anomaly?: AnomalyRecord;
}

export function metricApi(
  workspaceId: string,
  productId: string,
  token: string | null,
) {
  const base = `/api/v1/workspaces/${workspaceId}/products/${productId}`;
  return {
    list: (layer?: MetricLayer) =>
      request<{ total: number; items: MetricRecord[] }>(
        `${base}/metrics${layer ? `?layer=${layer}&limit=100` : "?limit=100"}`,
        { token },
      ),
    create: (input: {
      name: string;
      layer: MetricLayer;
      unit?: string;
      direction?: "increase" | "decrease";
      baselineValue?: number;
      targetValue?: number;
      description?: string;
    }) =>
      request<MetricRecord>(`${base}/metrics`, {
        method: "POST",
        body: JSON.stringify(input),
        token,
      }),
    addReading: (metricId: string, value: number, note?: string) =>
      request<AddReadingResponse>(`${base}/metrics/${metricId}/readings`, {
        method: "POST",
        body: JSON.stringify({ value, ...(note ? { note } : {}) }),
        token,
      }),
    getAnomalies: (includeResolved = false) =>
      request<{ total: number; items: AnomalyRecord[] }>(
        `${base}/anomalies?includeResolved=${includeResolved}`,
        { token },
      ),
    resolveAnomaly: (anomalyId: string) =>
      request(`${base}/anomalies/${anomalyId}/resolve`, {
        method: "POST",
        body: "{}",
        token,
      }),
  };
}

// ---------------------------------------------------------------------------
// Spec Agent (Bets)
// ---------------------------------------------------------------------------

export interface BetSpecMeta {
  id: string;
  title: string;
  status: string;
  currentVersionId: string | null;
  conversationId: string | null;
  outcomeNote: string | null;
  learningSummary: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CompleteBetResponse {
  ok: boolean;
  learning_summary: string;
  next_bet_hypothesis?: string | null;
}

export interface BetSpecView {
  id: string;
  title: string;
  status: string;
  hypothesis?: string;
  problemStatement?: string;
  userSegment?: string;
  constraints?: string[];
  acceptanceCriteria?: Array<{ criterion: string; metric?: string; target?: number }>;
  expectedImpact?: Array<{ metricName: string; expectedDelta: number; unit?: string }>;
  risks?: string[];
  timeboxWeeks?: number;
}

export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export interface CreateBetResponse {
  bet_spec_id: string;
  conversation_id: string;
  agent_reply: string;
  agent_state: string;
  spec?: unknown;
}

export interface SendMessageResponse {
  agent_reply: string;
  agent_state: string;
  new_version_id?: string;
  new_version_number?: number;
  spec?: unknown;
}

export interface PaginatedBets {
  total: number;
  limit: number;
  offset: number;
  items: BetSpecMeta[];
}

// ---------------------------------------------------------------------------
// Workspace & Product (M5)
// ---------------------------------------------------------------------------

export interface WorkspaceRecord {
  id: string;
  name: string;
  ownerUserId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProductRecord {
  id: string;
  workspaceId: string;
  name: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface OnboardingSetupWarning {
  step: "context_pack" | "first_bet";
  code: string;
  message: string;
}

export interface OnboardingSetupResponse {
  workspace: WorkspaceRecord;
  product: ProductRecord;
  bet_spec_id: string | null;
  warnings: OnboardingSetupWarning[];
}

export function workspaceApi(token: string | null) {
  return {
    list: () =>
      request<{ total: number; items: WorkspaceRecord[] }>("/api/v1/workspaces", { token }),
    create: (name: string) =>
      request<WorkspaceRecord>("/api/v1/workspaces", {
        method: "POST",
        body: JSON.stringify({ name }),
        token,
      }),
    get: (workspaceId: string) =>
      request<WorkspaceRecord>(`/api/v1/workspaces/${workspaceId}`, { token }),
    listProducts: (workspaceId: string) =>
      request<{ total: number; items: ProductRecord[] }>(
        `/api/v1/workspaces/${workspaceId}/products`,
        { token },
      ),
    createProduct: (workspaceId: string, name: string) =>
      request<ProductRecord>(`/api/v1/workspaces/${workspaceId}/products`, {
        method: "POST",
        body: JSON.stringify({ name }),
        token,
      }),
    updateProduct: (workspaceId: string, productId: string, patch: { name?: string; status?: string }) =>
      request<ProductRecord>(`/api/v1/workspaces/${workspaceId}/products/${productId}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
        token,
      }),
    setupOnboarding: (input: {
      workspaceName?: string;
      productName: string;
      productDescription?: string;
      mainKpi?: string;
      firstBetIdea?: string;
      skipFirstBet: boolean;
    }) =>
      request<OnboardingSetupResponse>("/api/v1/workspaces/onboarding/setup", {
        method: "POST",
        body: JSON.stringify(input),
        token,
      }),
  };
}

// ---------------------------------------------------------------------------
// GitHub Living Spec (M4)
// ---------------------------------------------------------------------------

export interface GitHubConnection {
  connection_id: string;
  repository: string;
  webhook_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface GitHubConnectionStatus {
  connected: boolean;
  connection: GitHubConnection | null;
}

export interface GitHubSyncEvent {
  id: string;
  event_type: string;
  repository: string;
  ref: string | null;
  commit_sha: string | null;
  pr_number: number | null;
  pr_title: string | null;
  diff_summary: string | null;
  analysis: {
    summary: string;
    affectedBets: Array<{
      betSpecId: string;
      sections: string[];
      reason: string;
      suggestedUpdate: string;
    }>;
    confidence: "low" | "medium" | "high";
  } | null;
  status: string;
  proposal_status: "pending" | "accepted" | "dismissed";
  retry_count: number;
  next_attempt_at: string | null;
  last_error: string | null;
  created_at: string;
  processed_at: string | null;
}

export function githubApi(
  workspaceId: string,
  productId: string,
  token: string | null,
) {
  const base = `/api/v1/workspaces/${workspaceId}/products/${productId}`;
  return {
    getConnection: () =>
      request<GitHubConnectionStatus>(`${base}/github-connections`, { token }),
    connect: (repository: string, accessToken: string, webhookUrl: string) =>
      request<{ connection_id: string; repository: string; is_active: boolean; created_at: string }>(
        `${base}/github-connections`,
        {
          method: "POST",
          body: JSON.stringify({ repository, accessToken, webhookUrl }),
          token,
        },
      ),
    disconnect: () =>
      request<{ disconnected: boolean; connection_id: string }>(
        `${base}/github-connections`,
        { method: "DELETE", token },
      ),
    listEvents: (limit = 20, offset = 0) =>
      request<{ total: number; limit: number; offset: number; items: GitHubSyncEvent[] }>(
        `${base}/github-sync-events?limit=${limit}&offset=${offset}`,
        { token },
      ),
    resolveProposal: (eventId: string, action: "accept" | "dismiss") =>
      request<{ event_id: string; proposal_status: string }>(
        `${base}/github-sync-events/${eventId}`,
        { method: "PATCH", body: JSON.stringify({ action }), token },
      ),
  };
}

export function betApi(
  workspaceId: string,
  productId: string,
  token: string | null,
) {
  const base = `/api/v1/workspaces/${workspaceId}/products/${productId}`;
  return {
    list: (limit = 50, offset = 0) =>
      request<PaginatedBets>(`${base}/bets?limit=${limit}&offset=${offset}`, { token }),
    get: (betId: string) =>
      request<{ meta: BetSpecMeta; spec: unknown }>(`${base}/bets/${betId}`, { token }),
    create: (title: string, message: string) =>
      request<CreateBetResponse>(`${base}/bets`, {
        method: "POST",
        body: JSON.stringify({ title, message }),
        token,
      }),
    sendMessage: (betId: string, message: string) =>
      request<SendMessageResponse>(`${base}/bets/${betId}/messages`, {
        method: "POST",
        body: JSON.stringify({ message }),
        token,
      }),
    getConversation: (betId: string) =>
      request<{ messages: ConversationMessage[]; agent_state: string }>(
        `${base}/bets/${betId}/conversation`,
        { token },
      ),
    updateStatus: (betId: string, status: string) =>
      request(`${base}/bets/${betId}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
        token,
      }),
    complete: (betId: string, outcomeNote: string) =>
      request<CompleteBetResponse>(`${base}/bets/${betId}/complete`, {
        method: "POST",
        body: JSON.stringify({ outcomeNote }),
        token,
      }),
    getRecommendation: () =>
      request<{ recommendation: NextBetRecommendation | null }>(`${base}/bets/recommendation`, { token }),
    getReadiness: (betId: string) =>
      request<ReadinessReport>(`${base}/bets/${betId}/readiness`, { token }),
  };
}

export interface NextBetRecommendation {
  betSpecId: string;
  title: string;
  nextBetHypothesis: string;
  learningSummary?: string | null;
  updatedAt: string;
}

export type ReadinessCheckStatus = "pass" | "warn" | "fail";

export interface ReadinessCheck {
  id: string;
  label: string;
  status: ReadinessCheckStatus;
  message: string;
}

export interface ReadinessReport {
  betSpecId: string;
  title: string;
  score: number;
  readyToShip: boolean;
  checks: ReadinessCheck[];
  generatedAt: string;
}

export interface DailyBriefingRecord {
  id: string;
  workspaceId: string;
  productId: string;
  briefingDate: string;
  content: string;
  activeBets: number;
  openAnomalies: number;
  generatedAt: string;
}

export function briefingApi(
  workspaceId: string,
  productId: string,
  token: string | null,
) {
  const base = `/api/v1/workspaces/${workspaceId}/products/${productId}`;
  return {
    getToday: () => request<DailyBriefingRecord>(`${base}/daily-briefing`, { token }),
  };
}

// ---------------------------------------------------------------------------
// Reviews (evening_review, weekly_retro)
// ---------------------------------------------------------------------------

export interface ProductReviewRecord {
  id: string;
  workspaceId: string;
  productId: string;
  reviewType: string;
  reviewDate: string;
  content: string;
  metadata: Record<string, unknown>;
  generatedAt: string;
}

export function reviewApi(
  workspaceId: string,
  productId: string,
  token: string | null,
) {
  const base = `/api/v1/workspaces/${workspaceId}/products/${productId}`;
  return {
    getEveningReview: () =>
      request<ProductReviewRecord>(`${base}/reviews/evening_review`, { token }),
    getWeeklyRetro: () =>
      request<ProductReviewRecord>(`${base}/reviews/weekly_retro`, { token }),
  };
}
