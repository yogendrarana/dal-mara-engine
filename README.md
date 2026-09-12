# dal-mara-engine

> Pure, deterministic, zero-dependency functional TypeScript card game engine and Dal Mara Notation (DMN) parser for **Dal Mara**—a traditional Nepali trick-taking card game.

[![npm version](https://img.shields.io/npm/v/dal-mara-engine.svg)](https://www.npmjs.com/package/dal-mara-engine)

[![npm downloads](https://img.shields.io/npm/dm/dal-mara-engine)](https://www.npmjs.com/package/dal-mara-engine)


[![license](https://img.shields.io/npm/l/dal-mara-engine)](https://www.npmjs.com/package/dal-mara-engine)

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

### 4-Player Mode

```ts
import {
  createGame,
  dealFourPlayer,
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
const dealResult = dealFourPlayer(gameResult.state, { deck, seat: 0 });
if (!dealResult.success) {
  console.error("Deal failed:", dealResult.error);
  process.exit(1);
}

console.log("Current DMN:", dealResult.dmn);

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

### 2-Player Mode

In 2-player mode, dealing is split into two distinct steps with Turup declared in between:
1. **Deal Hands**: Dealer deals 6 cards to the opponent (non-dealer) and 6 cards to themselves (`dealTwoPlayerHands`).
2. **Establish Turup**: Non-dealer inspects their 6 cards and declares the Turup suit (`declareTurup`).
3. **Deal Stacks**: Only after Turup is established, the dealer deals the remaining 40 cards into the 8 hidden stacks (`dealTwoPlayerStacks`).

```ts
import {
  createGame,
  dealTwoPlayerHands,
  declareTurup,
  dealTwoPlayerStacks,
  getRemainingCards2P,
  createDeck,
  shuffleDeck,
} from "dal-mara-engine";

const game = createGame({
  mode: "2p",
  dealerSeat: 0,
  players: [{ seat: 0 }, { seat: 1 }],
});

const deck = shuffleDeck(createDeck());

// 1. Dealer deals initial 6-card hands (non-dealer first)
const handResult = dealTwoPlayerHands(game.state, { deck, seat: 0 });

// 2. Non-dealer (seat 1) declares Turup
const turupResult = declareTurup(handResult.state, { seat: 1, suit: "spades" });

// 3. Obtain the remaining 40 cards
const remaining40 = getRemainingCards2P(turupResult.state, deck);

// 4. Dealer deals the remaining 40 cards into 4 hidden stacks per player
const stackResult = dealTwoPlayerStacks(turupResult.state, { deck: remaining40, seat: 0 });

// Non-dealer now leads trick 1!
```

---

## Game Rules & Mechanics

For the official rules, trick-taking mechanics, Ghopte rounds, and winning conditions, see the dedicated specification:

👉 **[Dal Mara Official Rulebook (DAL_MARA_RULES.md)](docs/DAL_MARA_RULES.md)**

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

#### `dealFourPlayer(dmnOrState, payload): ActionResult`
Deals 13 cards to each player in 4-Player mode. Only the designated dealer can deal. The deck must contain exactly 52 cards. Automatically detects Ghoptes and sets up the opening trick or Ghopte round.

```ts
import { dealFourPlayer, createDeck, shuffleDeck } from "dal-mara-engine";

const deck = shuffleDeck(createDeck());
const result = dealFourPlayer(currentState, { deck, seat: 0 });
```

#### `dealTwoPlayerHands(dmnOrState, payload): ActionResult` *(2p mode only)*
Deals the initial 6 cards each (non-dealer first, then dealer) in 2-Player mode. Only the designated dealer can deal. The deck must contain exactly 52 cards. Sets the next turn player to the non-dealer so they can establish Turup.

```ts
import { dealTwoPlayerHands, createDeck, shuffleDeck } from "dal-mara-engine";

const deck = shuffleDeck(createDeck());
const result = dealTwoPlayerHands(currentState, { deck, seat: 0 });
```

#### `dealTwoPlayerStacks(dmnOrState, payload): ActionResult` *(2p mode only)*
Deals the remaining 40 cards into 4 hidden stacks per player (5 cards each, top face up). Only the designated dealer can deal, and **Turup must already be declared**. Accepts either 40 cards or a 52-card deck (from which hand cards are automatically filtered). If omitted, computes undealt cards automatically. Passes turn to the non-dealer to lead trick 1.

```ts
import { dealTwoPlayerStacks, getRemainingCards2P } from "dal-mara-engine";

const remainingCards = getRemainingCards2P(currentState, deck);
const result = dealTwoPlayerStacks(currentState, { deck: remainingCards, seat: 0 });
```

#### `getRemainingCards2P(dmnOrState, originalDeck?): Card[]`
Utility helper that returns the remaining cards not held in either player's hands. If `originalDeck` is provided, filters it while preserving the original shuffled order; otherwise returns undealt cards from a standard deck.

```ts
import { getRemainingCards2P } from "dal-mara-engine";

const remaining40 = getRemainingCards2P(currentState, originalDeck);
```

#### `declareTurup(dmnOrState, payload): ActionResult` *(2p mode only)*
Declares the Turup suit in 2-Player mode before stack dealing. Must be called by the non-dealer. Sets next turn to the dealer to deal stacks.

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

#### `playCard(dmnOrState, payload): ActionResult`
Plays a card for the active turn player.
- In `4p` mode with unresolved Ghoptes, automatically routes to Ghopte card submission.
- In `2p` mode, automatically checks and removes the card from hand or face-up stack (requires stacks to be dealt first).

```ts
import { playCard } from "dal-mara-engine";

const result = playCard(currentState, {
  seat: 1,
  card: "10s",
});
```

#### `dispatch(dmnOrState, action): ActionResult`
Unified action dispatcher. Dispatches any valid engine action (`DEAL_FOUR_PLAYER`, `DEAL_TWO_PLAYER_HANDS`, `DEAL_TWO_PLAYER_STACKS`, `DECLARE_TURUP`, `PICKUP_TURUP_CARD`, `PLAY_CARD`, `PLAY_GHOPTE`).

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
Calculates all legal moves for the given player seat based on hand, stacks, Ghoptes, and follow-suit rules.

```ts
import { getLegalMoves } from "dal-mara-engine";

const moves = getLegalMoves(currentState, 1);
// Returns: Array<{ card: Card, stackPosition?: number, stackId?: string }>
```


#### `isFinished(dmnOrState): boolean`
Returns `true` if the game has ended (all tricks completed).

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
