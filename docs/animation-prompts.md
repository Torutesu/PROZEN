# PROZEN Animation Prompt Library

> For launch videos, onboarding walkthroughs, and in-product UI demos.

---

## Category Map

| # | Category | Purpose |
|---|---|---|
| A | Hero / Launch | Landing page hero loops and social snippets |
| B | Onboarding | First-session walkthrough animations |
| C | UI Micro-Interactions | Product-level interaction polish |
| D | Feature Demos | Explain key PROZEN capabilities |

---

## A - Hero / Launch

### A-1: Cursor Analogy Scene ("Cursor for PMs")

**Length**: 6-8s  
**Use**: LP hero loop / social opening

**Prompt (AI video generation / Runway, Sora, etc.)**
```text
A split-screen animation in a dark minimal SaaS UI.
Left panel labeled "Engineer" shows a code editor (Cursor-style)
with AI auto-completing lines of TypeScript code, fast and fluid.
Right panel labeled "PM" shows a PROZEN interface - a clean dark
chat input transforms into a structured "Bet Spec" card with fields:
Hypothesis, Constraints, Acceptance Criteria.
Both panels animate simultaneously at the same rhythm, mirroring
each other's energy. No voiceover. Monospace font labels.
Brand blue #1738BD accent glows on the PM side.
End frame: PROZEN wordmark fades in center.
Style: Minimal dark UI, subtle grain texture, smooth 60fps easing.
```

**Framer Motion implementation concept**
```text
- 2-column layout, full viewport height
- Left: code typing animation (stagger 0.03s per char)
- Right: chat input -> Bet Spec card layout animation (spring, stiffness: 200)
- Start both sides at the same time, same total duration (4s)
- Right card border gets brand glow only (box-shadow pulse)
```

---

### A-2: Before/After ("Jira Chaos -> PROZEN Clarity")

**Length**: 5s  
**Use**: LP scroll animation / onboarding intro

**Prompt**
```text
Before/After morph animation.
BEFORE: A chaotic Jira-like board with dozens of cluttered tickets,
sticky notes, status columns overflowing, gray and overwhelming.
Camera slowly zooms out, everything becomes noise.

AFTER: The chaos dissolves with a smooth wipe/blur transition.
A single clean PROZEN dashboard appears - one active Bet card in
the center, a hypothesis written clearly, a metric trend line
curving upward, one AI insight badge glowing softly.
Calm. Focused. Dark background, brand blue accents.

Tagline fades in: "Stop shipping features. Start validating bets."
```

---

### A-3: Logo Reveal (Launch Ending)

**Length**: 3s  
**Use**: Video end cards, email signatures, social clips

**Prompt**
```text
Typography animation. Dark background.
"PROZEN" lettermark appears letter by letter from left,
each letter drops in with a subtle spring bounce (overshoot 8%).
Below: subtitle "Profit x Kaizen" fades in at 60% opacity.
Then a single horizontal rule draws from left to right
in brand blue #1738BD.
Final frame holds for 1.5s.
Font: DM Sans Bold. Monochrome + single brand blue accent only.
No particle effects. No gradients. Clean.
```

---

## B - Onboarding

### B-1: Welcome Scene ("First Bet Spec in 5 Minutes")

**Length**: 8-10s  
**Use**: First-login modal / demo intro

**Prompt**
```text
Screen recording style animation of a PROZEN onboarding flow.

Step 1 (0-2s): Empty dark dashboard. A gentle prompt appears:
"Tell me about your product in your own words."
User types naturally: "We help solopreneurs automate invoicing.
Our retention dropped last quarter and I don't know why."

Step 2 (2-5s): AI thinking indicator (3 dots pulse in brand blue).
Text streams in, structured in real-time - not a wall of text,
but fields materializing: "Hypothesis:", "Constraints:",
"Acceptance Criteria:" - each field fades in sequentially.

Step 3 (5-8s): The chat disappears with a smooth collapse animation.
A polished Bet Spec card slides up from the bottom.
Headline: "Your first Bet Spec is ready."
A subtle confetti burst (brand blue + white only, minimal).

Duration counter in corner: "4m 32s"
```

---

### B-2: Context Pack Input

**Length**: 6s  
**Use**: Onboarding step-2 explanation

**Prompt**
```text
UI walkthrough animation showing Context Pack input.

A large textarea with placeholder "Describe your product,
users, and current challenges..."
User pastes a paragraph of natural language product description.

On submit: the text block animates and visually "collapses"
into a structured tree. Tags appear: [Target User], [Core Value],
[Current Friction], [Key Metrics]. Each tag pops in with a
spring animation (scale 0.8 -> 1.0, opacity 0 -> 1).

Final state: A clean "Context Pack" card with 4 structured
sections, checkmark icon in brand blue.
Label: "AI structured - 2 sec"
```

---

### B-3: Three-Layer Metrics Model

**Length**: 8s  
**Use**: Onboarding tutorial / LP feature explainer

**Prompt**
```text
Diagram reveal animation showing the 3-layer metric model.

Three rows appear sequentially from top to bottom,
each sliding in from the left with a 0.2s stagger:

Row 1 - "Bet" layer: A hypothesis card. Icon: target/bullseye.
Row 2 - "KPI" layer: A metric with trend line. Icon: chart.
Row 3 - "Activity" layer: A real-time event feed. Icon: pulse/heartbeat.

After all 3 appear, a vertical line connects them on the left.
Then an anomaly dot appears on Row 3 (red pulse).
An arrow animates upward: Row 3 -> Row 2 -> Row 1.
Each row highlights in sequence as the alert propagates.
Final state: Bet card glows with a notification badge.

Label at end: "Signals automatically reach your hypotheses."
```

---

## C - UI Micro-Interactions

### C-1: Bet Card Status Transition

**Length**: 1.5s  
**Use**: Feedback when bet status changes

**Prompt (Framer Motion)**
```text
Bet Spec card status transition animation.

States: Hypothesis -> Active -> Validated / Invalidated

Transition "Hypothesis -> Active":
- Pill badge text changes "Hypothesis" -> "Active"
- Badge background: gray -> brand blue (#1738BD)
- Card left border animates from 0 -> 3px solid brand blue
- Subtle scale pulse on the card: 1.0 -> 1.02 -> 1.0 (200ms)

Transition "Active -> Validated":
- Badge: brand blue -> green (#22C55E)
- Checkmark icon draws in (SVG stroke animation, 300ms)
- Card gets a soft green tint overlay (opacity 0 -> 0.04)

Transition "Active -> Invalidated":
- Badge: brand blue -> muted gray
- "x" icon fades in
- Card opacity: 1.0 -> 0.6 (de-emphasized, not deleted)

Easing: spring(stiffness: 300, damping: 28) throughout.
```

---

### C-2: AI Streaming -> Spec Card Crystallization

**Length**: 3s  
**Use**: Core Spec Agent interaction

**Prompt**
```text
The most important UI animation in PROZEN.

Phase 1 - Stream (0-1.5s):
Text streams into a chat bubble character by character,
monospace font, cursor blinking. Feels like watching AI think.
Background of bubble: very subtle shimmer/scan animation.

Phase 2 - Crystallize (1.5-2.2s):
The chat bubble dissolves with intent (not dramatic).
Particles drift toward structured positions.

Phase 3 - Materialize (2.2-3s):
A Bet Spec card assembles from those positions.
Fields snap into place one by one:
"Hypothesis" -> "Constraints" -> "Acceptance Criteria"
Each field border draws in left-to-right (1px brand blue line).
Final card has a subtle drop shadow and rests with spring ease.

This should feel like "thought becoming structure."
```

---

### C-3: Anomaly Alert

**Length**: 2s  
**Use**: Realtime activity anomaly notification

**Prompt**
```text
Anomaly detection notification animation.

A metric chart on screen. A line graph showing daily active users.
The latest data point suddenly spikes downward.

Step 1: Spike appears with sharp ease-in motion.
The anomalous point gets a red pulsing ring.

Step 2: A notification toast slides in from top-right.
Content: "DAU dropped 18% - may impact Bet #3 (Retention)"
Toast background: dark with a thin red left border.
Text: white / muted. Bold metric value.

Step 3: The toast auto-dismisses after 3s with slide-out.
The chart point remains marked with a small indicator.

Use red minimally - only ring and border.
Keep the rest in the dark brand palette.
```

---

### C-4: Chat Input Focus State

**Length**: 0.5s  
**Use**: Improve Spec Agent input engagement

**Prompt (CSS / Framer)**
```text
Chat input field focus animation.

Unfocused state:
- Placeholder text: "What are you trying to learn?" (muted, 40% opacity)
- Border: 1px solid rgba(255,255,255,0.1)
- Background: rgba(255,255,255,0.04)

Focus transition (300ms, ease-out):
- Border color: rgba(255,255,255,0.1) -> #1738BD
- Border width: 1px -> 1.5px
- Background: rgba(255,255,255,0.04) -> rgba(23,56,189,0.06)
- Subtle box-shadow: 0 0 0 3px rgba(23,56,189,0.15)
- Placeholder fades out slightly (40% -> 25%)

A small "Spec Agent" label appears top-right of input
with a green pulsing dot (AI is ready).

Feeling: premium, calm, inviting - not aggressive.
```

---

### C-5: Bet Card Expand / Collapse

**Length**: 0.4s  
**Use**: Transition from list item to detail state

**Prompt (Framer Motion)**
```text
Bet card expand animation using layout animations.

Collapsed state:
- Card height ~72px, showing: status badge + hypothesis (1 line) + date

Expand trigger: click anywhere on card

Expand animation (layout: true, spring stiffness: 200, damping: 24):
- Card height expands to show all fields
- Hidden content fades in with opacity 0 -> 1, translateY 8px -> 0
- Stagger: Hypothesis -> Constraints -> Acceptance Criteria -> Linked Metrics
  (each section 60ms apart)
- Expand icon (chevron) rotates 0deg -> 180deg

Collapse: reverse sequence with the same spring.

Critical: surrounding cards should shift smoothly with layout animation.
No sudden jumps.
```

---

### C-6: Daily Briefing Entrance

**Length**: 2s  
**Use**: Morning dashboard intro animation

**Prompt**
```text
Morning briefing panel entrance animation.

Context: User opens PROZEN at 9am.
A "Today's Focus" panel slides down from the top of the screen
(not a modal - part of the main layout).

Animation:
- Panel enters with translateY(-100%) -> translateY(0),
  spring(stiffness: 180, damping: 22)
- Content reveals in sequence (80ms stagger):
  1. Date label ("Monday, March 9")
  2. AI summary text (word-by-word stream, 25ms/word)
  3. Active Bets section (slides up from 12px below)
  4. "One thing to decide today:" prompt

- Left edge of panel uses a thin brand blue (#1738BD) line
- AI avatar icon pulses gently (scale 1.0 -> 1.05 -> 1.0, 2s loop)

Feeling: briefing from a thoughtful partner, not an alert.
```

---

## D - Feature Demo Videos

### D-1: GitHub Integration -> Living Spec Update

**Length**: 8s  
**Use**: Feature explainer / LP section

**Prompt**
```text
Feature demo animation: Living Spec.

Scene setup: PROZEN Bet Spec open on screen.
Title: "Shorten onboarding -> improve 7-day retention"

Event (2s mark):
A GitHub commit notification appears bottom-left as a small badge:
"New commit: Remove 3-step email verification - @john"
It enters with subtle slide-up and stays for 1.5s.

AI processing (3-4s):
A thin progress bar pulses across the top of the Spec card.
Label: "Analyzing diff..."

Proposal appears (5-7s):
A diff-style overlay fades in on Acceptance Criteria.
Red strikethrough: old criterion
Green addition: updated criterion matching implementation
An "Accept" button glows in brand blue. "Dismiss" is muted gray.

Final frame: user clicks Accept.
The diff resolves with a smooth merge animation.
Badge appears: "Spec updated - version 1.3"

Feeling: GitHub-native, developer-familiar, PM-readable.
```

---

### D-2: Bet Accuracy Retrospective

**Length**: 10s  
**Use**: Weekly feature explainer / differentiation story

**Prompt**
```text
Weekly Bet accuracy retrospective animation.

A report card UI enters with a page-turn effect.
Title: "Weekly Bet Review - Week 9"

Section 1 - Accuracy chart (0-3s):
A horizontal bar chart renders left-to-right for 5 Bets.
Each bar: green (validated) / gray (ongoing) / red (invalidated)
Accuracy score counts up from 0% to 67%.

Section 2 - Key learning card (3-6s):
Fades in. Contains: "The driver was Y, not X."
Quote style with brand blue left border.
Subtitle: "Onboarding length mattered less than confirmation speed."

Section 3 - Next cycle suggestion (6-9s):
AI badge appears. Text streams:
"Suggested focus for next sprint:
Reduce email confirmation latency.
Predicted retention impact: +3.1%"

The report has a subtle paper texture.
Feels like a real retrospective, not a static dashboard.
```

---

## Tooling Guide

| Tool | Best Use |
|---|---|
| **Framer Motion** | C-1 to C-6 (direct product implementation) |
| **Lottie / After Effects** | A-3, B-2, B-3 (loop animations) |
| **Runway / Kling AI** | A-1, A-2 (high-fidelity video generation) |
| **Motion Canvas** | D-1, D-2 (code-based explainer videos) |
| **ScreenStudio / Rotato** | B-1, D-1 (screen recording style) |

---

## Tone and Feel Rules

```text
DO:
- Use spring easing (stiffness 180-300, damping 22-28), avoid linear motion
- Use dark background (#0A0A0A base) + brand blue (#1738BD) accent
- Reveal information progressively, not all at once
- Show AI thinking states clearly (streaming / processing)

DON'T:
- Overuse particle effects or gradients
- Over-bounce (keep overshoot <= 10%)
- Overuse multiple accent colors (prefer one accent)
- Make text appear all at once (use fade or stream)
```
