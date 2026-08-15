# dal-mara-engine

> Pure, deterministic, framework-independent game engine and Dal Mara Notation (DMN) parser for **Dal Mara**—a traditional Nepali trick-taking card game.

## Features

- **Framework Independent**: Pure TypeScript engine with 0 runtime UI dependencies.
- **Game Modes**: Supports both **4-Player Team Mode (`4P`)** and **2-Player Mode (`2P`)**.
- **Dal Mara Notation (DMN)**: FEN-equivalent compact snapshot notation format for state export and instant restoration.
- **Deterministic & Replayable**: Seeded PRNG shuffle algorithm enabling action recording, exports, and exact game replay playback.
- **Rules Resolution**: Strict follow-suit enforcement, dynamic Turup creation & same-trick override, face-down Ghopte guessing round, manual 2P Turup card stack pickup, and 10s counting score resolution across 13 full rounds.
- **Legal Move Helper**: `getLegalMoves(playerId)`, `getLegalMoves4P(state, playerId)`, `getLegalMoves2P(state, playerId)` helper functions for UIs, hint generators, and AI bots.

## Installation

```bash
bun add dal-mara-engine
# or
npm install dal-mara-engine
```

## Quick Start

```ts
import { Engine } from "dal-mara-engine";

// Create 4-player game with pre-configured players
const game = Engine.createGame({
  id: "game-101",
  mode: "4P",
  seed: 42,
  players: [
    { id: "p1", name: "Alice" },
    { id: "p2", name: "Bob" },
    { id: "p3", name: "Charlie" },
    { id: "p4", name: "Dave" },
  ],
  dealerId: "p1",
});

// Start the game
game.start();

// Get legal moves for the active turn player
const activePlayer = game.currentPlayer;
if (activePlayer) {
  const moves = game.getLegalMoves(activePlayer.id);

  // Play a card
  game.playCard({
    playerId: activePlayer.id,
    cardId: moves[0].card.id,
  });
}

// Export FEN snapshot (Dal Mara Notation)
const dmnStr = game.toDMN();
console.log(dmnStr); // e.g. "v1/4P/PLAYING/D:0,T:1/TR:NONE/P0:...|P1:.../-/.../..."

// Restore game snapshot from DMN
const restoredGame = Engine.fromDMN(dmnStr);
```

## License

MIT
