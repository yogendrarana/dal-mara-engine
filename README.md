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
  dealerId: "p1",
  players: [
    { id: "p1", name: "Alice", position: 0 },
    { id: "p2", name: "Bob", position: 1 },
    { id: "p3", name: "Charlie", position: 2 },
    { id: "p4", name: "Dave", position: 3 },
  ],
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

// Export Dal Mara Notation (DMN)
const dmnStr = game.toDMN();
console.log(dmnStr); // e.g. "DMN1 4 0 1 1 0 1 0 0 0 AS"

// Restore game snapshot from DMN
const restoredGame = Engine.fromDMN(dmnStr);
```

## License

MIT
