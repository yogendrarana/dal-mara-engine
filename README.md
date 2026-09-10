# dal-mara-engine

> Pure, deterministic, zero-dependency functional TypeScript card game engine and Dal Mara Notation (DMN) parser for **Dal Mara**—a traditional Nepali trick-taking card game.

[![npm version](https://img.shields.io/npm/v/dal-mara-engine.svg)](https://www.npmjs.com/package/dal-mara-engine)
[![license](https://img.shields.io/npm/l/dal-mara-engine.svg)](https://github.com/yogendrarana/dal-mara-engine)

---

## Overview

**Dal Mara** (*"Dal"* meaning *10*, *"Mara"* meaning *Killer*) is a celebrated traditional Nepali trick-taking card game played with a standard 52-card deck. Unlike games where the primary goal is capturing trick count, Dal Mara centers entirely on capturing the **four 10s** (`10s`, `10h`, `10d`, `10c`).

`dal-mara-engine` is a pure, headless, framework-agnostic implementation designed around a **functional state-transition architecture**:
- **Authoritative DMN State**: Dal Mara Notation (DMN) is the canonical serialization format.
- **Pure State Transitions**: No mutable class state. The engine behaves as a deterministic state machine:
  $$\text{Current State / DMN} + \text{Action} \longrightarrow \{\, \text{dmn},\; \text{state} \,\}$$
- **Multi-Platform Support**: Ideal for Web (React, Vue, Svelte), Mobile (React Native, Flutter bridges), Servers (Node.js, Bun, Deno, WebSockets), and headless AI bot simulations.

---

## Features

- **Zero Runtime Dependencies**: Pure TypeScript with 0 UI or framework dependencies.
- **Functional Architecture**: No mutable classes or hidden internal states. Every action takes a `dmn` string or `GameState` object and returns `{ dmn, state }`.
- **Dal Mara Notation (DMN)**: Canonical, 8-section pipe-separated snapshot format (similar to chess FEN) for compact network transmission, persistence, and instant rehydration.
- **Official Rules Engine**: Full compliance with canonical Dal Mara rules:
  - **4-Player Team Mode (`4p`)**: 2 vs 2 diagonal team play, singleton 10 **Ghopte** guessing rounds, dynamic Turup creation, and same-trick Turup overrides.
  - **2-Player Mode (`2p`)**: Head-to-head match with 6-card hands, 4 hidden stacks per player, face-up Turup stack pickups, and upfront Turup declaration.
- **App-Controlled Shuffling**: Built-in Fisher-Yates deck utilities (`createDeck`, `shuffleDeck`). Applications manage shuffling entropy and pass the deck to the engine on deal.
- **Legal Move Generator**: Built-in `getLegalMoves(dmnOrState, seat)` helper for driving UI interaction states, move validation, and AI bot runners.
- **Externalized Scoring**: Scoring functions (`evaluateGameWinner4P`, `evaluateGameWinner2P`, `updateScoreOnTrickWon`) are pure utilities that evaluate game winners from trick history.

---

## Installation

```bash
# npm
npm install dal-mara-engine

# bun
bun add dal-mara-engine

# pnpm
pnpm add dal-mara-engine
```

---

## Quick Start

```ts
import {
  createGame,
  deal,
  playCard,
  getCurrentPlayer,
  getLegalMoves,
  createDeck,
  shuffleDeck,
} from "dal-mara-engine";

// 1. Initialize a 4-player game (returns initial DMN and state)
const gameResult = createGame({
  mode: "4p", // "4p" | "2p"
  dealerSeat: 0,
  players: [
    { seat: 0, team: "red" },
    { seat: 1, team: "blue" },
    { seat: 2, team: "red" },
    { seat: 3, team: "blue" },
  ],
});

if (!gameResult.success) {
  console.error("Game creation failed:", gameResult.error);
  process.exit(1);
}

// 2. Prepare and shuffle deck
const deck = shuffleDeck(createDeck());

// 3. Dealer deals the cards (pure transition: pass state or DMN string)
const dealResult = deal(gameResult.state, { deck, seat: 0 });
if (!dealResult.success) {
  console.error("Deal failed:", dealResult.error);
  process.exit(1);
}

console.log("Current DMN:", dealResult.dmn);
console.log("Phase:", dealResult.state.game.phase); // "GHOPTE" or "PLAYING"

// 4. Inspect current player turn
const activePlayer = getCurrentPlayer(dealResult.state);

// 5. Query legal moves for the active player
if (activePlayer) {
  const legalMoves = getLegalMoves(dealResult.state, activePlayer.seat);

  // 6. Play a card (returns new { dmn, state })
  const playResult = playCard(dealResult.state, {
    seat: activePlayer.seat,
    card: legalMoves[0].card,
  });

  if (playResult.success) {
    console.log("Next DMN:", playResult.dmn);
    console.log("Move Number:", playResult.state.moveNumber);
  }
}
```


---

## Dal Mara Game Rules

### 1. Objective & Winning Conditions
- There are **four 10s** in the standard 52-card deck (`10s`, `10h`, `10d`, `10c`).
- **Instant Win**: The team or player that captures **3 or 4 tens** wins the game.
- **Tie-Breaker (2–2 on 10s)**: If each team/player captures exactly 2 tens, the winner is decided by the **most tricks won**.
- All 13 rounds (tricks) are played to completion before scoring is finalized.

### 2. Card Ranking & Format
Ranks are strictly ordered from highest to lowest:
$$\text{A} > \text{K} > \text{Q} > \text{J} > \mathbf{10} > \text{9} > \text{8} > \text{7} > \text{6} > \text{5} > \text{4} > \text{3} > \text{2}$$
- **Ace** is always the highest card.
- **10** is the scoring card, ranked immediately below Jack and above 9.
- Cards use uppercase face ranks (`A`, `K`, `Q`, `J`) and lowercase suits (`s`, `h`, `d`, `c`), e.g., `As`, `10h`, `Kd`, `2c`.

### 3. Turn Order & Anti-Clockwise Play
- Dealing, turn progression, and Ghopte resolution proceed **anti-clockwise**.
- The player seated immediately to the dealer's right leads the first trick.
- The winner of each trick leads the subsequent trick.

---

### 4. Four-Player Team Mode (`4p`)

#### Seating & Teams
- 4 players sit in a square or diamond formation.
- Diagonally opposite players form a team:
  - **Team 02**: Seat 0 and Seat 2
  - **Team 13**: Seat 1 and Seat 3

#### Dealing
- Handed out anti-clockwise starting from the player to the dealer's right.
- Deal distribution: 5 cards each on the first pass, followed by 4 cards, then 4 cards (13 cards total per player).

#### Ghopte (Singleton 10 Guessing Round)
- If a player holds **exactly one card of a suit, and that card is the 10** (a singleton 10, e.g., only ♦10 with no other Diamonds), a **Ghopte** round is declared before trick 1 begins.
- A player can hold multiple Ghoptes (e.g., singleton ♠10 and singleton ♥10).
- **Procedure**:
  1. The declarer places their 10 face down on the table.
  2. The other 3 players attempt to guess the suit of the Ghopte card and place any card face down from their hand (no follow-suit requirement).
  3. Cards are revealed simultaneously.
  4. The player who played the highest card matching the 10's suit wins the trick and captures all 4 cards. If no opponent matched the suit, the declarer wins.
  5. Each resolved Ghopte trick counts as 1 of the 13 total rounds.

#### Follow-Suit Rule
- The lead card establishes the **Lead Suit**.
- All players holding at least one card of the Lead Suit **must follow suit**.
- Playing an off-suit card while holding the Lead Suit is illegal (`MUST_FOLLOW_SUIT`).

#### Dynamic Turup & Same-Trick Override
- **No Initial Turup**: Turup (*trump*) does *not* exist when the game starts.
- **Creation**: When a player is void in the Lead Suit, the off-suit card they play establishes the **Turup suit**. From that moment, Turup cards defeat all non-Turup cards.
- **Same-Trick Override**: Within that **same trick only**, if a subsequent player is void in *both* the Lead Suit and the current Turup suit, they can play any other suit to **override** and establish a new Turup suit.
- **Permanent Lock**: Once the trick that established Turup finishes, the final Turup suit is **permanently locked** for the remainder of the game.

#### Trick Resolution
1. Highest Turup card wins (if any Turup cards were played).
2. Otherwise, highest card of the Lead Suit wins.

---

### 5. Two-Player Mode (`2p`)

#### Dealing & Setup
1. **Initial Hand**: Dealer deals 6 cards to opponent (seat 1) first, then 6 cards to dealer (seat 0).

2. **Turup Declaration**: Opponent inspects their 6-card hand and declares the Turup suit upfront (`declareTurup(...)`). Turup is fixed immediately and cannot be overridden.
3. **Hidden Stacks**: The remaining 40 cards are dealt into **4 personal stacks** per player (5 cards per stack). Only the top card of each stack is turned face up; cards underneath remain face down.

#### Manual Turup Stack Pickup
- Whenever a face-up stack card belongs to the declared Turup suit, the player **must pick it up into their hand** (`pickupTurupCard(...)`).
- A trick cannot begin until all face-up Turup cards on both players' stacks have been picked up into their hands.

#### Playing Tricks
- Players can play legal cards either from their **hand** or from the **face-up tops of their 4 stacks**.
- When a top stack card is played, the underlying card is revealed face up.
- Players must follow the Lead Suit if they possess matching cards in either their hand or any of their face-up stacks.

---

## Functional Engine API Reference

All engine action and query functions accept either a serialized **DMN string** or a **`GameState` object** (`dmnOrState: string | GameState`).

### Result Type

```ts
export type ActionResult =
  | { readonly success: true; readonly dmn: string; readonly state: GameState }
  | { readonly success: false; readonly error: EngineError };
```

---

### 1. Game Initialization

#### `createGame(options): ActionResult`
Initializes a new game and produces the initial DMN string and `GameState` snapshot (pre-deal state).

```ts
import { createGame } from "dal-mara-engine";

const result = createGame({
  mode: "4p", // "4p" | "2p"
  dealerSeat: 0, // 0..3 (4p) or 0..1 (2p)
  players: [
    { seat: 0, team: "red" },
    { seat: 1, team: "blue" },
    { seat: 2, team: "red" },
    { seat: 3, team: "blue" },
  ],
});
```

---

### 2. Actions & State Transitions

#### `deal(dmnOrState, payload): ActionResult`
Deals cards to players. Only the designated dealer can deal. The deck must contain exactly 52 cards.

```ts
import { deal, createDeck, shuffleDeck } from "dal-mara-engine";

const deck = shuffleDeck(createDeck());
const result = deal(currentState, { deck, seat: 0 });
```

#### `playCard(dmnOrState, payload): ActionResult`
Plays a card for the active turn player.
- In `4p` mode during the `GHOPTE` phase, automatically routes to Ghopte card submission.
- In `2p` mode, automatically checks and removes the card from hand or face-up stack.

```ts
import { playCard } from "dal-mara-engine";

const result = playCard(currentState, {
  seat: 1,
  card: "10s",
});
```

#### `declareTurup(dmnOrState, payload): ActionResult` *(2p mode only)*
Declares the Turup suit during the `TURUP_DECLARATION` phase.

```ts
import { declareTurup } from "dal-mara-engine";

const result = declareTurup(currentState, {
  seat: 1,
  suit: "hearts", // "spades" | "hearts" | "diamonds" | "clubs"
});
```

#### `pickupTurupCard(dmnOrState, payload): ActionResult` *(2p mode only)*
Picks up a face-up Turup card from a player's stack into their hand.

```ts
import { pickupTurupCard } from "dal-mara-engine";

const result = pickupTurupCard(currentState, {
  seat: 0,
  card: "Kh",
});
```

#### `dispatch(dmnOrState, action): ActionResult`
Unified action dispatcher. Dispatches any valid engine action (`DEAL`, `DECLARE_TURUP`, `PICKUP_TURUP_CARD`, `PLAY_CARD`, `PLAY_GHOPTE`).

```ts
import { dispatch, ACTION_TYPES } from "dal-mara-engine";

const result = dispatch(currentState, {
  type: ACTION_TYPES.PLAY_CARD,
  payload: { seat: 0, card: "As" },
});
```

---

### 3. Inspection & Query Functions

#### `getCurrentPlayer(dmnOrState): Player | null`
Returns the `Player` whose turn it currently is (derived from `state.nextMoveSeat`).

```ts
import { getCurrentPlayer } from "dal-mara-engine";

const activePlayer = getCurrentPlayer(currentState);
console.log("Active player seat:", activePlayer?.seat);
```

#### `getLegalMoves(dmnOrState, seat): LegalPlayableCard[]`
Calculates all legal moves for the given player seat based on phase, hand, stacks, and follow-suit rules.

```ts
import { getLegalMoves } from "dal-mara-engine";

const moves = getLegalMoves(currentState, 1);
// Returns: Array<{ card: Card, stackPosition?: number, stackId?: string }>
```


#### `isFinished(dmnOrState): boolean`
Returns `true` if the game has reached the `END` phase (all 13 rounds completed).

```ts
import { isFinished } from "dal-mara-engine";

if (isFinished(currentState)) {
  console.log("Game completed!");
}
```

---

### 4. `GameState` Object Structure

The `GameState` object is the parsed in-memory representation of Dal Mara Notation:

```ts
interface GameState {
  // Section 1: Game
  readonly game: {
    readonly mode: "4p" | "2p";
    readonly dealerSeat: Seat;
    readonly turup: Suit | null;
    readonly phase: "DEAL" | "TURUP_DECLARATION" | "GHOPTE" | "PLAYING" | "END";
  };

  // Player roster
  readonly players: readonly Player[];

  // Section 3: Hands (keyed by Seat 0..3)
  readonly hands: Record<Seat, readonly Card[]>;

  // Section 2: Ghoptes (4p only)
  readonly ghoptes: readonly Ghopte[];

  // Section 4: Stacks (2p only, 4 stacks per player)
  readonly stacks: Record<Seat, readonly PlayerStack[]>;

  // Section 5: Move Number (total cards played)
  readonly moveNumber: number;

  // Section 6: Current Trick
  readonly trick: {
    readonly number: number;
    readonly playNumber: number;
    readonly leadSuit: Suit | null;
    readonly isGhopte: boolean;
    readonly cards: readonly PlayedCard[];
  };

  // Section 7: Move Detail (the move that produced this state)
  readonly moveDetail: {
    readonly seat: Seat | null;
    readonly card: Card | null;
    readonly makesTurup: boolean;
  };

  // Section 8: Next Move Seat
  readonly nextMoveSeat: Seat;
}
```

---

## Dal Mara Notation (DMN)

Dal Mara Notation (DMN) is a fixed-order, pipe-separated state representation designed for deterministic serialization, network transmission, and rehydration:

```
<game> | <ghoptes> | <hands> | <stacks> | <move_number> | <trick> | <move_detail> | <next_move_seat>
```

### Parsing & Serialization

```ts
import { parseDMN, serializeDMN } from "dal-mara-engine";

// Parse a DMN string into a GameState object
const state = parseDMN(dmnString);

// Serialize a GameState object back into a canonical DMN string
const canonicalDmn = serializeDMN(state);
```

### Format Specification

| # | Section | Format | Example | Description |
|---|---------|--------|---------|-------------|
| **1** | `<game>` | `<mode>,<dealer>,<turup>` | `4p,2,h` | Mode (`4p`/`2p`), dealer seat (`0`..`3`), Turup suit (`s`/`h`/`d`/`c` or `-`) |
| **2** | `<ghoptes>` | `<p0>/<p1>/<p2>/<p3>` or `-` | `-/Kh,1,-:7s,1,-/Qd,2,-/-` | 4P Ghoptes grouped by player, `:` separated for multiple (`<card>,<order>,<resolved: r/->`). `-` in 2p. |
| **3** | `<hands>` | `<p0>/<p1>/<p2>/<p3>` | `As,Qh,10d/7c,Js/Kd,8d/9s,Ad` | Cards currently held in each player's hand, separated by commas |
| **4** | `<stacks>` | 8 `/`-separated slots or `-` | `7h,Kc,As,4d,10s/...` | 2P personal stacks (4 for P0, 4 for P1), ordered bottom-to-top (last card is face up). `-` in 4p. |
| **5** | `<move_number>` | `<integer>` | `12` | Total cards played across the game (0 to 52) |
| **6** | `<trick>` | `<num>,<play>,<lead>,<ghopte>,<cards>` | `3,2,h,-,1:Kh/2:4h` | Trick number, play number (1..4), lead suit, Ghopte flag (`g`/`-`), and trick cards (`<seat>:<card>/...` or `-`) |
| **7** | `<move_detail>` | `<seat>,<card>,<makes_turup>` | `2,4s,-` | Move that created this state: player seat, card played, and Turup establishment flag (`t`/`-`), or `-,-,-` |
| **8** | `<next_move>` | `<seat>` | `3` | Player seat expected to play next |


### Delimiters
- `|` Top-level section separator
- `/` Ordered collection separator (player hands, ghopte groups, stack slots, trick cards)
- `:` Record association (multiple ghoptes per player, `<pos>:<card>` in trick cards)
- `,` Field values within a record
- `-` Empty, false, or not applicable

---

## Scoring & Winner Evaluation

Scoring is externalized as pure utility functions, keeping `GameState` lean while providing full winner resolution:

```ts
import {
  evaluateGameWinner4P,
  evaluateGameWinner2P,
  updateScoreOnTrickWon,
  countTensInCards,
  createInitialScoreState,
} from "dal-mara-engine";

// 1. Initialize score trackers
const scores = {
  0: createInitialScoreState(),
  1: createInitialScoreState(),
  2: createInitialScoreState(),
  3: createInitialScoreState(),
};

// 2. Update score when a trick completes
const winnerPos = 0;
scores[winnerPos] = updateScoreOnTrickWon(scores[winnerPos], winnerPos, completedTrick);

// 3. Evaluate winner for 4P game
const result = evaluateGameWinner4P({
  scores,
  players: gameState.players,
});

console.log("Winner Team:", result.winnerTeam); // e.g. "red" or "02"
console.log("Reason:", result.reason);          // e.g. "red wins with 3 tens"
```

---

## Deck & Card Utilities

```ts
import {
  createDeck,
  shuffleDeck,
  createCard,
  compareCardRanks,
  parseCard,
  getCardSuit,
  getCardRank,
} from "dal-mara-engine";

// Standard 52-card deck
const deck = createDeck();

// Pure Fisher-Yates shuffle (returns a new array)
const shuffled = shuffleDeck(deck);

// Parse card
const { suit, rank } = parseCard("10s"); // { suit: "spades", rank: "10" }

// Compare card ranks (returns positive if cardA > cardB)
const isHigher = compareCardRanks("Ah", "10s") > 0; // true
```

---

## State Serialization (JSON)

For debugging or persisting full `GameState` objects as JSON:

```ts
import { serializeState, deserializeState } from "dal-mara-engine";

// Serialize to formatted JSON
const json = serializeState(gameState);

// Deserialize JSON back to GameState
const restoredState = deserializeState(json);
```

---

## Error Handling

All validation checks return `{ success: false, error: DalMaraError }` instead of throwing unhandled exceptions during gameplay:

```ts
import { playCard, ENGINE_ERROR_CODES } from "dal-mara-engine";

const result = playCard(currentState, { seat: 0, card: "2s" });

if (!result.success) {

  switch (result.error.code) {
    case ENGINE_ERROR_CODES.MUST_FOLLOW_SUIT:
      console.warn("You must follow the lead suit!");
      break;
    case ENGINE_ERROR_CODES.NOT_PLAYER_TURN:
      console.warn("Not your turn!");
      break;
    default:
      console.error(result.error.message);
  }
}
```

### Common Error Codes
| Code | Description |
|---|---|
| `MUST_FOLLOW_SUIT` | Player attempted to play an off-suit card while holding the lead suit |
| `NOT_PLAYER_TURN` | Player attempted to move out of turn |
| `CARD_NOT_OWNED` | Card is not present in player hand or face-up stack |
| `INVALID_TURUP_DECLARATION` | Turup declaration made by wrong player or with invalid suit |
| `INVALID_GHOPTE_SUBMISSION` | Invalid card submitted during Ghopte resolution |
| `INVALID_DMN` | Malformed Dal Mara Notation string |
| `INVALID_DECK` | Deck passed to deal does not contain 52 distinct cards |

---

## Contributing & Development

```bash
# Clone repository
git clone https://github.com/yogendrarana/dal-mara-engine.git

# Install dependencies
npm install

# Run test suite
npm test

# Typecheck
npm run typecheck

# Format & Lint
npm run check
```

---

## License

MIT © [Yogendra Rana](https://github.com/yogendrarana)
