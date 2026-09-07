# dal-mara-engine

> Pure, deterministic, zero-dependency TypeScript card game engine and Dal Mara Notation (DMN) parser for **Dal Mara**—a traditional Nepali trick-taking card game.

[![npm version](https://img.shields.io/npm/v/dal-mara-engine.svg)](https://www.npmjs.com/package/dal-mara-engine)
[![license](https://img.shields.io/npm/l/dal-mara-engine.svg)](https://github.com/yogendrarana/dal-mara-engine)

---

## Overview

**Dal Mara** ("Dal" meaning *10*, "Mara" meaning *Killer*) is a celebrated traditional Nepali trick-taking card game played with a standard 52-card deck. Unlike games where the primary goal is capturing the maximum number of tricks, Dal Mara centers entirely on capturing the **four 10s** (`10s`, `10h`, `10d`, `10c`).

`dal-mara-engine` is a pure, headless, framework-agnostic implementation designed to be the single source of truth for:
- Web applications (React, Vue, Svelte, Solid)
- Mobile applications (React Native, Expo)
- Backend servers (Node.js, Bun, Deno, Socket.io, WebSockets)
- Headless AI bot runners & simulations

---

## Features

- **Zero Runtime Dependencies**: Pure TypeScript with 0 UI or framework dependencies.
- **Official Rules Engine**: Full compliance with the canonical Dal Mara rulebook:
  - **4-Player Team Mode (`4P`)**: 2 vs 2 diagonal team play, singleton 10 **Ghopte** guessing rounds, dynamic Turup creation, and same-trick Turup overrides.
  - **2-Player Mode (`2P`)**: Head-to-head match with 6-card hands, 4 hidden stacks per player, manual face-up Turup stack pickups, and upfront Turup declaration.
- **App-Controlled Shuffling**: Built-in Fisher-Yates deck utilities (`createDeck`, `shuffleDeck`). Applications retain control over deck shuffling and pass the deck to the engine on deal.
- **Legal Move Generator**: Built-in `game.getLegalMoves(playerId)` helper for driving UI interaction states, move validation, and AI bots.
- **Dal Mara Notation (DMN)**: FEN-equivalent compact snapshot format (`DMN1`) for instant state serialization and restoration over the network.
- **Deterministic Replay System**: Export action histories and re-run games step-by-step for game reviews, cheat detection, and testing.
- **Pub/Sub Event Bus**: Typed event dispatcher (`game.on`, `game.onAny`) for reactive audio, animations, and UI triggers.

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
import { Game, createDeck, shuffleDeck } from "dal-mara-engine";

// 1. Create a 4-player game
const game = Game.create({
  id: "match-101",
  mode: "4P",
  dealerPosition: 0,
  players: [
    { id: "p1", name: "Alice", position: 0, team: "red" },
    { id: "p2", name: "Bob", position: 1, team: "blue" },
    { id: "p3", name: "Charlie", position: 2, team: "red" },
    { id: "p4", name: "Dave", position: 3, team: "blue" },
  ],
});

// 2. Prepare and shuffle deck
const deck = shuffleDeck(createDeck());

// 3. Dealer deals the cards
const dealResult = game.deal({ deck, playerPosition: 0 });
if (!dealResult.success) {
  console.error("Deal failed:", dealResult.error);
}

// 4. Inspect game state and current turn
console.log("Current Phase:", game.phase); // "GHOPTE" or "PLAYING"
const activePlayer = game.currentPlayer;

// 5. Get legal moves for the current player
if (activePlayer) {
  const legalMoves = game.getLegalMoves(activePlayer.id);

  // 6. Play a card
  game.playCard({
    playerPosition: activePlayer.position,
    card: legalMoves[0].card,
  });
}
```

---

## Dal Mara Game Rules

### 1. Objective & Winning Conditions
- There are **four 10s** in the standard 52-card deck.
- **Instant Win**: The team or player that captures **3 or 4 tens** wins the game.
- **Tie-Breaker (2–2 on 10s)**: If each team/player captures exactly 2 tens, the winner is decided by the **most tricks won**.
- **Full Duration**: All 13 rounds (tricks) are played to completion before scoring is finalized.

### 2. Card Ranking
Ranks are strictly ordered from highest to lowest:
$$\text{A} > \text{K} > \text{Q} > \text{J} > \mathbf{10} > \text{9} > \text{8} > \text{7} > \text{6} > \text{5} > \text{4} > \text{3} > \text{2}$$
- **Ace** is always the highest card.
- **10** is the scoring card, ranked immediately below Jack and above 9.
- Suits have no inherent ranking priority over each other.

### 3. Turn Order & Anti-Clockwise Play
- Dealing, turn progression, and Ghopte resolution proceed **anti-clockwise**.
- The player seated immediately to the dealer's right leads the first trick.
- The winner of each trick leads the subsequent trick.

---

### 4. Four-Player Team Mode (`4P`)

#### Seating & Teams
- 4 players sit in a square or diamond formation.
- Diagonally opposite players form a team:
  - **Team 1**: Position 0 and Position 2
  - **Team 2**: Position 1 and Position 3

#### Dealing
- Handed out anti-clockwise starting from the player to the dealer's right.
- Deal distribution: 5 cards each on the first pass, followed by 4 cards, then 4 cards (13 cards total per player).

#### Ghopte (Singleton 10 Guessing Round)
- If a player holds **exactly one card of a suit, and that card is the 10** (a singleton 10, e.g., only ♦10 with no other Diamonds), a **Ghopte** round is declared before trick 1 begins.
- A player can have multiple Ghoptes (e.g., singleton ♠10 and singleton ♥10).
- **Procedure**:
  1. The declarer places their 10 face down on the table.
  2. The other 3 players attempt to guess the suit of the Ghopte card and place any card face down from their hand (no follow-suit requirement).
  3. Cards are revealed simultaneously.
  4. The player who played the highest card matching the 10's suit wins the trick and captures all 4 cards. If no opponent matched the suit, the declarer wins.
  5. Each resolved Ghopte trick counts as 1 of the 13 total rounds.
  6. Configurable resolution order: `"dealer-last"` (default) or `"dealer-first"`.

#### Follow-Suit Rule
- The lead card establishes the **Lead Suit**.
- All players holding at least one card of the Lead Suit **must follow suit**.
- Playing an off-suit card while holding the Lead Suit is illegal (`MUST_FOLLOW_SUIT`).

#### Dynamic Turup (Trump) & Same-Trick Override
- **No Initial Turup**: Turup does *not* exist when the game starts.
- **Creation**: When a player is void in the Lead Suit, the off-suit card they play establishes the **Turup suit**. From that moment, Turup cards defeat all non-Turup cards.
- **Same-Trick Override**: Within that **same trick only**, if a subsequent player is void in *both* the Lead Suit and the current Turup suit, they can play any other suit to **override** and become the new Turup suit.
- **Permanent Lock**: Once the trick that established Turup finishes, the final Turup suit is **permanently locked** for the remainder of the game.

#### Trick Resolution
1. Highest Turup card wins (if Turup cards were played).
2. Otherwise, highest card of the Lead Suit wins.

---

### 5. Two-Player Mode (`2P`)

#### Dealing & Setup
1. **Initial Hand**: Dealer deals 6 cards to opponent first, then 6 cards to dealer.
2. **Turup Declaration**: Opponent (non-dealer) inspects their 6-card hand and declares the Turup suit. Turup is fixed immediately and cannot be overridden.
3. **Hidden Stacks**: The remaining 40 cards are dealt into **4 personal stacks** per player (5 cards per stack). Only the top card of each stack is turned face up; cards underneath remain face down.

#### Manual Turup Stack Pickup
- Whenever a face-up stack card belongs to the Turup suit, the player **must pick it up into their hand** (`game.pickupTurupCard(...)`).
- A trick cannot begin until all face-up Turup cards on both players' stacks have been picked up into their hands.

#### Playing Tricks
- Players can play legal cards either from their **hand** or from the **face-up tops of their 4 stacks**.
- When a top stack card is played, the underlying card is revealed face up.
- Players must follow the Lead Suit if they possess matching cards in either their hand or any of their face-up stacks.

---

## Engine Public API Reference

### 1. `Game.create(options)`

Initializes a validated `Game` instance.

```ts
import { Game } from "dal-mara-engine";

const game = Game.create({
  id: "game-1",
  mode: "4P", // "4P" | "2P"
  dealerPosition: 0,
  players: [
    { id: "p1", name: "Alice", position: 0, team: "red" },
    { id: "p2", name: "Bob", position: 1, team: "blue" },
    { id: "p3", name: "Charlie", position: 2, team: "red" },
    { id: "p4", name: "Dave", position: 3, team: "blue" },
  ],
});

if ("success" in game && !game.success) {
  console.error("Validation error:", game.error);
}
```

---

### 2. Actions & Game Methods

#### `game.deal({ deck, playerPosition })`
Dispatches the `DEAL` action. Only the designated dealer can deal. The deck must contain exactly 52 cards.

```ts
import { createDeck, shuffleDeck } from "dal-mara-engine";

const deck = shuffleDeck(createDeck());
const result = game.deal({ deck, playerPosition: 0 });
```

#### `game.playCard({ playerPosition, card })`
Plays a card for the active turn player. In 2P mode, automatically plays from hand or face-up stack. During the `GHOPTE` phase, routes to Ghopte card submission.

```ts
const result = game.playCard({
  playerPosition: 1,
  card: "10s",
});
```

#### `game.declareTurup({ playerPosition, suit })` *(2P mode only)*
Declares the Turup suit during `TURUP_DECLARATION` phase.

```ts
const result = game.declareTurup({
  playerPosition: 1,
  suit: "hearts", // "spades" | "hearts" | "diamonds" | "clubs"
});
```

#### `game.pickupTurupCard({ playerPosition, card })` *(2P mode only)*
Picks up a face-up Turup card from the player's stacks into their hand.

```ts
const result = game.pickupTurupCard({
  playerPosition: 0,
  card: "Kh", // Must be of the declared Turup suit
});
```

#### `game.getLegalMoves(playerId)`
Calculates legal playable cards for the given player based on phase, hand, stacks, and follow-suit rules.

```ts
const moves = game.getLegalMoves("p1");
// Returns: Array<{ card: Card, stackPosition?: number, stackId?: string }>
```

---

### 3. State Getters & Inspection

```ts
game.id;                  // string: Game identifier
game.mode;                // "4P" | "2P"
game.phase;               // "DEAL" | "TURUP_DECLARATION" | "GHOPTE" | "PLAYING" | "END"
game.players;             // readonly Player[]
game.dealerPosition;      // PlayerPosition: 0 to 3 for 4P, 0 to 1 for 2P
game.currentPlayer;       // Player | null
game.currentTrick;        // Trick: { number, playNumber, leadSuit, leaderPosition, isGhopte, cards, nextLeaderPosition, winnerPosition }
game.currentTurup;        // Suit | null
game.scores;              // Record<string, ScoreState>: captured 10s and tricks
game.isFinished;          // boolean (true when phase === "END")
game.winnerTeam;          // string | null (team name in 4P or player ID in 2P)
game.state;               // Full immutable GameState snapshot
```

---

### 4. Deck & Card Utilities

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

// Generate standard 52-card deck (Array of string cards: "2s", "10h", "Ac", ...)
const deck = createDeck();

// Shuffle without mutating the original array
const shuffled = shuffleDeck(deck);

// Parse card string to its suit and rank
const details = parseCard("10s"); // { suit: "spades", rank: "10" }
const suit = getCardSuit("10s");  // "spades"
const rank = getCardRank("10s");  // "10"

// Compare card ranks (positive if cardA > cardB)
const ace = "Ah";
const ten = "10s";
const comparison = compareCardRanks(ace, ten); // > 0
```

---

### 5. Event Subscriptions

Subscribe to engine events for triggering UI sound effects, animations, and announcements:

```ts
// Subscribe to specific events
const unsubscribeStarted = game.on("TurnStarted", (event) => {
  console.log("Turn started for player:", event.payload.playerId);
});

const unsubscribeCardPlayed = game.on("CardPlayed", (event) => {
  console.log("Card played:", event.payload.card, "by", event.payload.playerId);
});

const unsubscribeTurup = game.on("TurupCreated", (event) => {
  console.log("Turup established:", event.payload.suit);
});

// Subscribe to all events
const unsubscribeAll = game.onAny((event) => {
  console.log("Event:", event.type, event.payload);
});
```

#### Available Events
| Event Name | Description |
|---|---|
| `CardsDealt` | Cards dealt and initial phase transitions |
| `TurnStarted` | Active turn player switched |
| `CardPlayed` | Card played to the current trick |
| `TurupDeclared` | Turup chosen by opponent in 2P mode |
| `TurupCreated` | Turup first created by void play in 4P mode |
| `TurupChanged` | Turup overridden by void play in the same trick |
| `GhopteStarted` | Game entered Ghopte resolution phase |
| `GameFinished` | Game finished, winner evaluated |

### 6. Dal Mara Notation (DMN)

Dal Mara Notation (`DMN1`) is a self-contained game state snapshot format (similar to chess FEN) designed for network transmission and instant game state reconstruction. Every DMN string encodes the complete game state — including player hands — so a full `Game` can be reconstructed without any database lookup.

```ts
import { fromDMN, Game } from "dal-mara-engine";

// Export current snapshot to DMN1 string
const dmnString = game.toDMN();

// Reconstruct a full playable Game from any DMN snapshot
const restoredGame = fromDMN(dmnString);
// or: Game.fromDMN(dmnString)
```

**DMN1 Format**:
```
DMN1 G:<GameInfo> H:<Hands> M:<MoveInfo> T:<TrickInfo> C:<CardInfo>
```

| Section | Format | Description |
|---------|--------|-------------|
| **G** | `<Mode>,<Dealer>,<TrumpSuit>` | Game mode (`4P`/`2P`), dealer position, trump suit (`s`/`h`/`d`/`c`/`-`) |
| **H** | `[P0:<Cards>],[P1:<Cards>],...` | Current remaining cards per player (engine `Card` string format) |
| **M** | `<MoveNumber>,<TrickNumber>,<TrickPlay>` | Total cards played, current trick number, cards played in trick |
| **T** | `<TrickLeader>,<NextTrickLeader>,<IsGhopte>` | Trick leader position, next player position, ghopte flag |
| **C** | `<Card>,<PlayedBy>,<IsGhopte>,<IsTurup>,[<TrickCards>]` | Last played card, who played it, flags, all cards in current trick |

**Example** (initial state after deal):
```
DMN1 G:4P,0,- H:[P0:2s,3s,...],[P1:...],[P2:...],[P3:...] M:0,0,0 T:1,-,0 C:-,-,0,0,[]
```

**Example** (mid-game, trick 7):
```
DMN1 G:4P,0,s H:[P0:6c,10h],[P1:3s,7d],... M:27,7,3 T:1,-,0 C:10s,3,0,1,[7h,Qs,10s]
```

A 4-player game generates **53 snapshots**: 1 initial (after deal) + 52 card plays.

### 7. Serialization & Replay Engine

#### JSON State Serialization
```ts
import { Game } from "dal-mara-engine";

// Serialize full game state to JSON
const json = game.serialize();

// Deserialize and revive into active Game instance
const revivedGame = Game.deserialize(json);
```

#### Replay Engine
Export game actions to replay matches step-by-step with 100% determinism:

```ts
import { Game } from "dal-mara-engine";

// Export replay action log
const replayData = game.exportReplay();

// Re-run match from start to reconstruct final state
const replayedGame = Game.playReplay(replayData);
```

---

## Error Handling

All validation checks return `{ success: false, error: DalMaraError }` instead of throwing unhandled exceptions during normal play.

```ts
import { ENGINE_ERROR_CODES } from "dal-mara-engine";

const result = game.playCard({ playerPosition: 0, card: "2s" });
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

---

## Contributing & Development

```bash
# Clone the repository
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
