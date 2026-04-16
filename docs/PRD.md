# Product Requirements Document

A competitive speed-trivia game where players race to answer Azure and GitHub Copilot questions correctly, with the fastest accurate responses earning points that persist across multiple game sessions.

**Experience Qualities**:
1. **Thrilling** - The combination of time pressure and leaderboard competition creates an adrenaline-inducing experience that keeps players on edge
2. **Rewarding** - Immediate feedback on correctness and speed, plus visible rank progression, provides satisfying dopamine hits for competitive achievers
3. **Educational** - Learning Azure and Copilot concepts through repetition and competition makes knowledge retention feel like a byproduct of fun rather than work

**Complexity Level**: Light Application (multiple features with basic state)
This is a focused competitive game with core mechanics (questions, timer, scoring, leaderboard) but doesn't require complex multi-view navigation or advanced state management beyond persisted scores and real-time updates.

## Essential Features

### Question Display & Answer Submission
- **Functionality**: Renders a multiple-choice question with 4 answer options related to Azure or GitHub Copilot, accepts user selection
- **Purpose**: Core gameplay mechanic that tests knowledge and reaction speed
- **Trigger**: User opens the game link for a new round
- **Progression**: Game loads → Timer starts automatically → Question displays with 4 options → User clicks answer → Immediate feedback shows (correct/incorrect + time taken) → Results display with leaderboard position
- **Success criteria**: Question text is clearly readable, all 4 options are clickable, timer starts exactly when question renders, only one answer can be selected, feedback appears within 100ms of selection

### Precision Timer System
- **Functionality**: Tracks elapsed time from question display to answer submission with millisecond precision
- **Purpose**: Creates competitive differentiation between players and adds urgency to decision-making
- **Trigger**: Timer starts automatically the instant the question renders on screen
- **Progression**: Question renders → Timer starts at 0.00s → Display updates every 100ms → User submits answer → Timer stops → Final time recorded and displayed
- **Success criteria**: Timer accuracy within 50ms margin of error, visible countdown updates smoothly, timer stops immediately on answer submission, time persists for leaderboard comparison

### Persistent Scoring & Sessions
- **Functionality**: Accumulates points across multiple game rounds, maintains user identity and score history
- **Purpose**: Builds long-term engagement and rivalry beyond single-session play
- **Trigger**: User completes their first question (auto-generates user profile if needed)
- **Progression**: First answer submitted → User profile created with unique ID → Score calculated (correctness + speed bonus) → Points added to cumulative total → Total displayed on results screen → Score persists for next round
- **Success criteria**: Scores survive page refresh, user identity remains consistent across sessions, point calculation is transparent and fair, historical performance is retrievable

### Live Leaderboard
- **Functionality**: Displays ranked list of all players sorted by total points, updates in real-time as rounds complete
- **Purpose**: Fuels competition by showing relative performance and creating aspirational targets
- **Trigger**: After user submits answer and results are processed
- **Progression**: Answer submitted → Server calculates new score → Database updates → Leaderboard recalculates rankings → User sees their position highlighted → Top performers visible
- **Success criteria**: Leaderboard shows minimum top 10 players, current user's rank is highlighted regardless of position, updates within 2 seconds of answer submission, ties are handled by fastest response time

### Question Management System
- **Functionality**: Serves 1-3 questions per round from a curated pool of Azure/Copilot topics
- **Purpose**: Ensures content variety and prevents memorization exploits
- **Trigger**: User starts a new round
- **Progression**: Round begins → Server randomly selects question(s) from pool → Question delivered to frontend → User completes question(s) → Round ends → Next round becomes available
- **Success criteria**: No duplicate questions within same round, questions rotate across sessions, difficulty feels consistent, all questions have verified correct answers

### Synchronized Questions (Fairness)
- **Functionality**: When the admin starts a quiz, the server selects a fixed set of questions and pins them to the game state. ALL connected players receive the exact same questions in the same order.
- **Purpose**: Ensures competitive fairness — every player answers identical questions, so the only differentiator is speed and knowledge.
- **Trigger**: Admin clicks "Start Quiz" in the Admin panel
- **Progression**: Admin starts quiz → Server selects 3 random questions from active category → Question IDs pinned to GameState → All players' `getQuestions` calls return the same pinned set → Players race through at their own pace → Admin stops quiz → Pinned questions cleared → Next start picks fresh random set
- **Success criteria**: All connected players see identical questions in identical order, new quiz start always picks a fresh random set, category changes clear stale pinned questions, stopping the quiz clears the pinned set

### Admin Score Reset
- **Functionality**: Admin can reset player scores to zero — individually, for a selection of players, or for all players at once. Optionally scoped to a specific category.
- **Purpose**: Allows fresh starts for new game sessions, tournament rounds, or correcting scoring issues
- **Trigger**: Admin uses the Score Management section in the Admin panel
- **Progression**: Admin selects scope (all / selected users) → Optional category filter → Confirms action → Server resets scores → SignalR broadcasts `scoresReset` → Leaderboards refresh automatically
- **Success criteria**: Global reset zeroes all users' totalScore/gamesPlayed/fastestTimeMs and deletes all categoryScores, selected reset only affects chosen users, category-scoped reset only deletes that category's scores without touching global stats, confirmation required before destructive action

## Edge Case Handling

- **Network interruption during answer** - Timer freezes, answer queued locally, auto-submits when connection restored with original timestamp
- **Page refresh mid-question** - Question resets but marks attempt as "abandoned" (no penalty), user can restart
- **Multiple browser tabs/windows** - Only first active session counts, others show "Game in progress elsewhere" warning
- **Tied scores with identical times** - Tiebreaker uses submission timestamp (earlier player ranks higher)
- **User closes tab before answering** - Treated as abandoned attempt, no score change, can return anytime
- **Rapid clicking/spam** - Only first click registers, subsequent clicks ignored until next question
- **Invalid/corrupted questions** - Error screen with "Skip question" option, no penalty applied

## Design Direction

The design should evoke the intensity of a game show meets the precision of a developer tool—think high-stakes quiz show energy wrapped in modern developer aesthetics. Colors should pulse with urgency during active gameplay but shift to celebratory or contemplative tones based on performance. The interface must feel instantly responsive, almost twitchy, reflecting the millisecond-precision competition at its core.

## Color Selection

A bold, high-contrast palette inspired by Azure's cloud blue and GitHub's signature colors, with electric accents for urgency and competitive moments.

- **Primary Color**: Azure Blue `oklch(0.55 0.18 245)` - Represents Azure branding and conveys trust and technical authority while maintaining high energy
- **Secondary Colors**: 
  - Deep Space Gray `oklch(0.25 0.02 265)` - Grounds the interface with developer-tool sophistication
  - GitHub Black `oklch(0.15 0 0)` - Anchors important UI elements and text with maximum contrast
- **Accent Color**: Electric Lime `oklch(0.82 0.21 135)` - Explosive highlight for correct answers, timer urgency, and CTAs; creates visceral excitement
- **Foreground/Background Pairings**: 
  - Background (Deep Space Gray #2A2D3A): White text (#FFFFFF) - Ratio 12.6:1 ✓
  - Primary (Azure Blue #4A90E2): White text (#FFFFFF) - Ratio 4.9:1 ✓
  - Accent (Electric Lime #C5F542): Deep Space Gray (#2A2D3A) - Ratio 11.8:1 ✓
  - Card surfaces (Soft Slate `oklch(0.32 0.02 260)`): White text - Ratio 10.2:1 ✓

## Font Selection

Typography should feel sharp, technical, and competitive—like developer tools with the energy of a sports broadcast scoreboard.

- **Typographic Hierarchy**:
  - **H1 (Round Title)**: Space Grotesk Bold / 42px / -0.02em letter spacing / 110% line height - Commands attention for "Round 3" announcements
  - **H2 (Question Text)**: Space Grotesk Medium / 28px / -0.01em / 135% - Ensures readability under pressure while maintaining technical aesthetic
  - **Body (Answer Options)**: JetBrains Mono Regular / 18px / normal / 150% - Code-friendly monospace reinforces developer context
  - **UI Labels (Timer, Score)**: Space Grotesk SemiBold / 16px / 0em / 120% - Clean hierarchy for system information
  - **Leaderboard (Player Names)**: JetBrains Mono Medium / 16px / normal / 140% - Monospace creates aligned, scannable lists
  - **Caption (Timestamps)**: JetBrains Mono Regular / 13px / normal / 120% - Technical precision for metadata

## Animations

Animations should heighten the sense of speed and competition—snappy transitions that match the rapid-fire gameplay, with celebratory moments of delight for victories and subtle kinetic feedback that makes every interaction feel responsive and alive.

**Timer Pulse**: Timer text subtly scales 1.02x and glows when crossing 5-second threshold (turns amber), then 10-second threshold (turns red) using smooth color transitions and scale transform.

**Answer Selection**: Selected option scales to 1.03x with a 150ms spring animation and shows a crisp border expansion, unselected options fade to 60% opacity simultaneously.

**Correct Answer Reveal**: Winning option animates with a green glow that radiates outward (box-shadow expansion) over 400ms, followed by a satisfying checkmark that draws in using stroke-dashoffset animation.

**Incorrect Feedback**: Wrong selection shakes horizontally 4px over 300ms (3 oscillations) with a red tint, then fades while correct answer simultaneously pulses once to guide learning.

**Leaderboard Entry**: User's row slides in from the right with a 350ms ease-out, then pulses with a subtle highlight (background color flash) to draw attention to position.

**Score Counter**: Points animate incrementally using a counting-up effect over 800ms with an ease-out curve, creating satisfying numerical progression.

**Round Transition**: Current question fades out (200ms) → brief "Processing..." state with subtle spinner → new question fades in from slight downward motion (300ms slide + fade).

## Component Selection

**Components**:
- **Card** (shadcn) - Contains question, answer options, and timer; elevated with strong shadow for focus; background uses `--card` with glass-like subtle border
- **Button** (shadcn) - Answer options styled as large interactive buttons; primary variant for active state, ghost variant for unselected; includes hover scale and active press states
- **Badge** (shadcn) - Displays round number, user rank, point deltas; uses destructive variant for time pressure warnings, default for neutral info
- **Progress** (shadcn) - Visual timer bar that depletes as time elapses; color shifts from blue → amber → red based on elapsed time
- **Separator** (shadcn) - Divides question section from leaderboard; subtle with low opacity
- **Table** (shadcn) - Leaderboard structure with sticky header; current user row highlighted with accent background tint
- **Skeleton** (shadcn) - Loading states for question content and leaderboard data; maintains layout stability
- **Alert** (shadcn) - Error messages for network issues or invalid states; destructive variant with clear recovery actions

**Customizations**:
- **Timer Display Component** - Custom component showing MM:SS.ms format with large bold numerals; integrates Progress bar below number display
- **Answer Grid** - Custom 2x2 grid layout for 4 answer options using Tailwind grid; maintains consistent spacing and touch targets (min 56px height)
- **Rank Badge** - Custom component for top 3 positions showing trophy icons (gold/silver/bronze) using Phosphor icons with gradient backgrounds
- **Score Delta Indicator** - Custom animated component showing +X points that floats upward and fades out after answer submission

**States**:
- **Buttons (Answer Options)**: Default (white background, border, hover lifts), Hover (scale 1.02, shadow increases), Active/Selected (Azure blue background, white text, thick border), Disabled (after answer submitted, 40% opacity, no hover), Correct (green background with glow), Incorrect (red background with shake)
- **Timer**: Normal (blue text), Warning (amber text at 5s, subtle pulse), Critical (red text at 10s, faster pulse, progress bar accelerates visually)
- **Leaderboard Row**: Default (subtle background), Current User (accent tint background, bold text, left border highlight), Top 3 (gradient background fading from gold/silver/bronze)

**Icon Selection**:
- Timer: Clock (Phosphor regular weight)
- Correct Answer: CheckCircle (Phosphor fill weight for celebration)
- Incorrect Answer: XCircle (Phosphor fill weight)
- Leaderboard Rank: Trophy (Phosphor fill for top 3)
- Round Start: Lightning (Phosphor fill for energy)
- Score Increase: TrendUp (Phosphor regular)
- Refresh/Retry: ArrowClockwise (Phosphor regular)

**Spacing**:
- Container padding: `p-6` (24px) on mobile, `p-8` (32px) on desktop
- Card internal padding: `p-6`
- Answer button gap: `gap-4` (16px) between options
- Leaderboard row padding: `py-3 px-4`
- Section spacing: `space-y-6` between major sections (question → results → leaderboard)
- Icon-to-text spacing: `gap-2` (8px) for inline icon+label pairs

**Mobile**:
- Answer grid switches from 2x2 to 1x4 vertical stack below 640px
- Timer repositions from top-right to top-center with larger text (48px → 56px)
- Leaderboard shows top 5 instead of top 10, with "View Full Leaderboard" expansion
- Card padding reduces to `p-4`, font sizes scale down 10% (42px → 38px for H1)
- Bottom navigation/action buttons become sticky footer with full-width CTAs
- Touch targets expand to minimum 44px height for all interactive elements
