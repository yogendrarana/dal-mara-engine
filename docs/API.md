# Dal Mara Engine Public API Specification

Version: 1.0

---

# Purpose

This document defines the public API exposed by `dal-mara-engine`.

The engine is designed to be the single source of truth for every Dal Mara client (Web, React, React Native, Bots, Backend).

---

# Engine Entry Point

```ts
import { Engine, Game, DalMaraError } from "dal-mara-engine";
```

---

# Core Concepts

1. **Game**: Instance representing a single match with lifecycle management, rules validation, event dispatching, and notation serialization.
2. **State**: Immutable snapshot of the current game (`GameState`).
3. **Action**: Dispatched intent to mutate state (`PLAY_CARD`, `DECLARE_TURUP`, `PICKUP_TURUP_CARD`, `START_GAME`).
4. **Validation**: Result returned before or during dispatch (`ValidationResult`).
5. **Errors**: `DalMaraError` thrown for structural/programmatic failures.

---

# Game Modes

- `"4P"`: 4-Player Team Mode (Square seating: P0+P2 form Team 1, P1+P3 form Team 2).
- `"2P"`: 2-Player Head-to-Head Mode (6-card hand + 4 hidden face-down stacks per player).

```ts
export const GAME_MODES = {
  FOUR_PLAYER: "4P",
  TWO_PLAYER: "2P",
} as const;
```

---

# Creating a Game

`id`, `mode`, and the full `players` array are mandatory.

```ts
const game = Engine.createGame({
  id: "match-101",
  mode: "4P",
  players: [
    { id: "p1", name: "Alice" },
    { id: "p2", name: "Bob" },
    { id: "p3", name: "Charlie" },
    { id: "p4", name: "Dave" },
  ],
  dealerId: "p1", // optional (defaults to players[0].id)
  seed: 12345, // optional PRNG seed for deterministic shuffle
  ghopteResolutionOrder: "dealer-last", // "dealer-last" | "dealer-first"
});
```

---

# Starting a Game

```ts
const result = game.start();
if (!result.success) {
  console.error("Start failed:", result.error);
}
```

---

# Current State Inspection

```ts
const state = game.state;

game.id; // string
game.mode; // "4P" | "2P"
game.phase; // "LOBBY" | "TURUP_DECLARATION" | "GHOPTE" | "PLAYING" | "GAME_FINISHED"
game.dealerId; // string
game.dealerIndex; // number
game.currentPlayer; // Player | null
game.currentTrick; // Trick ({ leadSuit, cards, winnerId })
game.currentTurup; // Suit | null
game.scores; // Record<string, ScoreState>
game.isFinished; // boolean
game.winnerId; // string | null
```

---

# Getting Legal Moves

```ts
import { getLegalMoves, getLegalMoves4P, getLegalMoves2P } from "dal-mara-engine";

const legalMoves = game.getLegalMoves(game.currentPlayer.id);
// returns: LegalPlayableCard[]: { card: Card, fromStackIndex?: number, stackId?: string }
```

### Ghopte Phase Rules:
- Declarer must play their single 10.
- Non-declarers guess the face-down 10's suit and can play **any card** from their hand (no follow-suit requirement).

---

# Playing Actions

### 1. Play Card (4P or 2P)
```ts
game.playCard({
  playerId: "p1",
  cardId: "As",
  stackId: "stack-0", // optional (for 2P stack play)
  fromStackIndex: 0, // optional (for 2P stack play)
});
```

### 2. Declare Turup (2P mode only)
```ts
game.declareTurup({
  playerId: "p2",
  suit: "hearts",
});
```

### 3. Pickup Face-up Turup from Stack (2P mode only)
```ts
game.pickupTurupCard({
  playerId: "p1",
  stackId: "stack-2", // or stackIndex: 2
});
```

---

# Dal Mara Notation (DMN) - FEN Equivalent

DMN is a compact string format capturing the exact game state.

```ts
// Export DMN
const dmnStr = game.toDMN();
// Example: "v1/4P/PLAYING/D:0,T:1/TR:h/P0:Ah,Kh|P1:2s,3s|.../-/.../..."

// Restore from DMN
const restoredGame = Engine.fromDMN(dmnStr);
```

---

# Serialization & Replay

```ts
// JSON Serialization
const json = game.serialize();
const deserialized = Engine.deserialize(json);

// Action Replay
const replayData = game.exportReplay();
const replayedGame = Engine.playReplay(replayData);
```

---

# Events

```ts
game.on("GameStarted", (event) => console.log("Game started", event));
game.on("CardPlayed", (event) => console.log("Card played", event));
game.on("TurupCreated", (event) => console.log("Turup created", event));
game.on("GameFinished", (event) => console.log("Game over", event));

// Global event listener
const unsubscribe = game.onAny((event) => console.log("Event:", event.type));
```
