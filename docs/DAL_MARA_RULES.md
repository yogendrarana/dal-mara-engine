# DALMARA_RULES.md

# Dal Mara Official Rulebook

> Version: 1.0
>
> This document serves as the official rules specification for the Dal Mara game engine and all Dal Mara clients. Whenever there is ambiguity, this document is considered the source of truth.

---

# 1. Introduction

Dal Mara is a traditional Nepali trick-taking card game played using a standard 52-card deck. "Dal" meaning "10" and "mara "meanig "killer". 

There are two official game modes:

- Four Player Mode (Team Game)
- Two Player Mode

Although both variants share the same objective and card ranking, they differ significantly in gameplay.

Unlike most trick-taking games, the objective is **not** to win the most tricks. Instead, players attempt to capture as many **10s** as possible.

Since there are only four 10s in the deck, every 10 is valuable.

---

# 2. Terminology

## Trick

One complete round where every player plays exactly one card.

---

## Lead Card

The first card played in a trick.

Its suit becomes the **Lead Suit**.

---

## Lead Suit

The suit of the first card played in a trick.

Players must follow this suit whenever possible.

---

## Turup

Turup is the Nepali term for **Trump**.

Turup cards defeat every non-Turup card regardless of rank.

The way Turup is determined differs between the two game modes.

---

## Trick Winner

The player who wins the current trick.

The trick winner leads the next trick.

---

## Captured Cards

Cards won by a player or team after winning a trick.

These cards get collected by the winner and remain face down until scoring and end of the game.

---

# 3. Cards

## Deck

A standard deck of 52 playing cards.

Four suits:

- Spades
- Hearts
- Diamonds
- Clubs

---

## Card Ranking

Highest to Lowest

A>K>Q>J>10>9>8>7>6>5>4>3>2

Ace is always the highest card.

Suits never have inherent priority.

---

# 4. Four Player Mode

## Players

Four players participate.

Players sit in square or diamond shape. Players sitting diagonally opposite each other form a team.

Example

Player A <-> Player C

Player B <-> Player D

---

## Objective

Capture as many 10s as possible.

There are four 10s in the deck.

Winning Conditions

- **All 13 rounds (tricks) must be played to completion.**
- If one team captures 3 or 4 tens → That team wins.
- If each team captures exactly 2 tens:
  - Team with the most total tricks wins.

---

# 5. Dealer

Choose a dealer randomly at first.

For next round two variants of determining next dealer can be chosen from losing team (turn by turn if same team loses consecutive games)

---

# 6. Dealing

Cards are dealt anticlockwise.

Distribution pattern:

First pass

- 5 cards to every player.

Remaining passes

- 4 cards to every player.

Continue until every card has been dealt.

---

# 7. First Player

The player immediately to the dealer's right i.e., in anticlock order starts the first trick.

Afterwards, the winner of each trick starts the next trick.

---

# 8. Ghopte

Before the first trick begins, every player examines their hand.

If a player has exactly **one card of a suit**, and that card is the **10**, a special round called **Ghopte** begins.

Example

Player owns ♦10 but no other Diamonds.

Ghopte is declared for that player.

Note that there can be multiple Ghopte declarations for all players who satisfies the condition. Same player can have multiple Ghopte declarations if he has multiple 10s with no other cards of that suit.

---

## Ghopte Procedure

1. All hands are scanned after dealing. All Ghoptes across all players are detected.
2. Ghoptes are resolved one by one in anti-clockwise sequence. The order in which ghopte cards are resolved can be configured as:
   - dealer-last (default)
   - dealer-first
3. For each Ghopte round:
   - The target suit is established by the Ghopte 10 suit and put face down on the table.
   - The other three players try to guess the suit of the Ghopte card and choose one potential winning card and place it face down. When all 4 players place their cards face down, they reveal the cards simultaneously and decide the winner.
   - The player with the highest legal card matching the target suit wins the trick and captures all 4 cards. If no other player matches the Ghopte suit, the player who declared Ghopte wins. 
4. Each Ghopte trick resolved counts as 1 of the 13 total rounds.
5. Once all Ghopte rounds are resolved, normal trick play continues.

---

# 9. Playing a Trick

The leader plays any card.

That card establishes the Lead Suit.

Every remaining player plays exactly one card and has to play same suite card as the Lead Suit if lead suite is present.

Play continues anticlockwise.

---

# 10. Turup in Four Player Mode

Turup does **not** exist at the start of the game.

Turup is created dynamically during play, and **fixed permanently** once it is established.

## How Turup is Created

When a player has no cards of the Lead Suit, they may play any card from another suit.

The **first time** this happens in a game, the off-suit card played creates Turup:

- That card's suit becomes the Turup suit for the **rest of the game**.

## Turup Override (Same Trick Only)

Turup can be overridden, but **only within the same trick in which it was declared**:

- A player who has neither the Lead Suit nor the newly declared Turup suit may play any other suit.
- That new suit overrides the earlier Turup declaration.
- This override can chain if subsequent players are also void in both suits.

Once the trick that created Turup is complete, Turup is **permanently fixed** for the entire rest of the game.

No further Turup changes are possible after that trick ends.

---

Example

Lead

♦A

Player owns

♠10

♠8

♥A

No Diamonds.

The player plays

♠10

Spades immediately become Turup.

From this moment,

every Spade defeats every non-Spade.

Example

♠2 defeats

♦A

♥A

♣A

---

# 11. Overriding Turup

This is the defining mechanic of Dal Mara.

Suppose

Lead

♦A

Player 2

♠10

Turup becomes Spades.

Now Player 3 owns

No Diamonds.

No Spades.

Player 3 plays

♥2

Hearts immediately replace Spades as Turup.

Player 2's Spade immediately loses trump status.

Now Hearts defeat every non-Heart.

This process may occur multiple times within the same trick.

Every new valid Turup replaces the previous Turup.

Only the **final Turup** determines the winner.

---

# 12. Winning the Trick

If no Turup exists

Highest card of the Lead Suit wins.

If Turup exists

Highest Turup wins.

If multiple Turup cards are played

Highest ranked Turup wins.

The winner

- captures every card played
- starts the next trick

---

# 13. Team Play

Partners cooperate.

Example

Player A leads

♥A

Partner holds

♥10

Partner intentionally plays

♥10

Since Ace wins,

their team safely captures the valuable 10.

Winning tricks is important,

but protecting and capturing 10s is the primary objective.

---



# 15. End of Game

Count captured 10s.

If one team captured 3 or 4 tens that team wins.

Otherwise

If both teams captured, 2 tens, the team with the most tricks wins.

---

# 16. Two Player Mode

The two-player variant uses different gameplay mechanics.

---

## Objective

Capture as many 10s as possible.

Winning Conditions

Capture

3 or 4 tens

or

If tied 2–2,

player with the most tricks wins.

---

# 17. Initial Deal

Dealer deals

Opponent (first)

6 cards.

Dealer

6 cards.

---

# 18. Declaring Turup

The non-dealer examines the initial six cards.

They choose one suit.

That suit becomes Turup.

Unlike the four-player game,

Turup is fixed before the normal trick begins immediately after dealing 6 cards each.

It also never changes just like in four player mode once declared.

---

# 19. Building the Hidden Stacks

After Turup has been declared, the remaining cards are dealt into four personal stacks.

Each player owns four stacks.

Each stack contains face-down cards.

Only the top card of every stack is face up.

Players may always see

- their hand
- four face-up cards on their own stacks
- four face-up cards on the opponent's stacks

Cards beneath remain hidden.

--- 

# 20. Turup Pickup in 2-Player Mode

Whenever a face-up stack card belongs to the Turup suit,

**the player manually picks it into their hand** by choosing to pick up that card.

Apps must present the player with the option to pick up Turup face-up cards.

A new round cannot begin until **all face-up Turup cards** on both players' stacks have been picked up.

---

# 21. Playing

Gameplay proceeds similarly to the four-player game.

The winner of each trick leads the next.

Players must follow suit whenever possible.

Turup remains fixed.

There are no Turup overrides in 2 player mode.

---

# 22. Winning a Trick

If no Turup is played,

Highest Lead Suit wins.

Otherwise,

Highest Turup wins.

Winner captures every card.

Winner leads the next trick.

---

# 23. End of Game

Count captured 10s.

Player capturing

3 or 4 tens

wins.

If both players captured

2 tens,

player with the most tricks wins.

---

# 24. Rule Priority

When multiple rules apply, they are resolved in the following order.

1. Game Mode Rules
2. Turn Order
3. Follow Suit Requirement
4. Turup Rules
5. Card Ranking
6. Trick Resolution
7. Scoring

---

# 25. Implementation Notes

The software implementation should treat this document as the canonical rulebook.

All game engines, web clients, mobile clients, AI players, replay systems, and automated tests must follow these rules exactly.

No implementation should redefine or duplicate the game rules outside the game engine.
