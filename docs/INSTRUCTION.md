
# Dal Mara 4-Player Game Flow and Engine Responsibilities

## 1. Core Architectural Boundary

The Dal Mara game engine is responsible **only for the game itself**.

The application is responsible for everything that happens **before a game starts**, including:

* Creating rooms
* Room codes
* Joining/leaving rooms
* Player presence
* Player readiness
* Team selection
* Drag-and-drop team assignment
* Position/seating assignment
* Dealer selection
* Starting the game
* URLs/routes
* Networking
* Persistence
* UI state
* Animations

**Do not implement lobby, room, matchmaking, player joining, team selection, or player management inside the game engine.**

By the time `Game.create()` is called, the application has already finalized all players, their positions, their teams, and the dealer.

The engine receives a complete and valid game configuration and starts the actual Dal Mara game.


# Dal Mara 4-Player App → Game Flow (so you understand UI logic too, which you dont have to implement at all, jut write engine flow, and apis that supports this flow)

1. **Room/Lobby**

   * User creates a room and shares the room code.
   * Other 3 players join.
   * App shows the two teams.
   * Players choose their preferred team and the app assigns positions.
   * One player is selected as the dealer.
   * Once everyone is ready, any player can click **Start Game**.

2. **Start Game**

   * App calls `Game.create()` with the 4 finalized players, their positions/teams, and the dealer.
   * If creation fails, UI show the error in the lobby.
   * If successful, app receives the `Game` and moves everyone to the game board.
   * URL now includes the room ID and game ID like `www.example.com/room?id=abc&gameId=xyz`.

3. **Waiting for Deal**

   * Game starts in `DEAL` phase after game instance is created.
   * Only the dealer sees **Shuffle** and **Deal** buttons.
   * Dealer can shuffle as many times as they want (each shuffle updates the rngState).
   * Dealer eventually clicks **Deal** which accepts shuffled deck, and deals the cards to the players.

4. **After Deal**

   * Game deals the cards and determines all ghoptes and the correct order of play.
   * App receives the updated game state.
   * If there are ghoptes, game enters `GHOPTE`; otherwise it enters `PLAY`.
   * App uses the state to show whose turn it is.

5. **Ghopte**

   * Players with ghopte play their ghopte face down in the order determined by the game.
   * App sends each player's action to the game.
   * Game validates the action and determines who plays next.
   * After all ghoptes are completed, the winner of the last ghopte leads the first normal trick.

6. **Normal Play**

   * Players take turns playing cards.
   * App sends every card-play action to the game.
   * Game validates the move, resolves tricks, determines the next player, and maintains the score/history.
   * App simply renders the updated state.

7. **Game Finished**

   * After the final trick, the game calculates the final score.
   * Game enters `END`.
   * App displays the result/score screen.

**Important:** The app controls everything around the game (room, players, teams, UI, routing). The `Game` controls everything from **Start Game onward that involves Dal Mara rules**.
