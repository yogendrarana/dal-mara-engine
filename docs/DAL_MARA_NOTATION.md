# Dal Mara Notation (DMN)

## Overview

Dal Mara Notation (DMN) represents the complete game state using a fixed-order, pipe-separated format.

<game> | <ghoptes> | <hands> | <stacks> | <move_number> | <trick> | <move_detail> | <next_move>

The fixed section order makes parsing deterministic while positional ordering avoids unnecessary identifiers where ownership or identity is already implied by position.

## Delimiters

|  Top-level section separator
/  Ordered collection separator
:  Multiple records belonging to the same collection item
,  Values within a record
-  Empty, false, or not applicable

## Card Format

Cards use uppercase face ranks and lowercase suits.

Examples:

As
Kh
Qd
Jc
10h
7s

Ranks:

A, K, Q, J, 10, 9, 8, 7, 6, 5, 4, 3, 2

Suits:

s = spades
h = hearts
d = diamonds
c = clubs

## 1. Game

Format:

<mode>,<dealer_position>,<turup_suit>

Examples:

4p,2,h
2p,0,s

Values:

mode:
2p | 4p

dealer_position:
0 | 1 | 2 | 3

turup_suit:
s | h | d | c

Example:

4p,2,h

Means:

- 4-player game
- Dealer is player position 2
- Hearts is the turup suit

## 2. Ghoptes

Ghoptes are applicable only in 4-player mode.

For 4-player games, ghoptes are grouped by player position:

<player_0_ghoptes>/<player_1_ghoptes>/<player_2_ghoptes>/<player_3_ghoptes>

A player with no ghoptes is represented by:

-

Multiple ghoptes belonging to the same player are separated by `:`.

Each ghopte is represented as:

<card>,<order>,<is_resolved>

Values:

order:
The ghopte resolution order determined by the game engine.

is_resolved:
- = unresolved
r = resolved

Example:

-/Kh,1,-:7s,1,-/Qd,2,-/-

This means:

- Player 0 has no ghoptes
- Player 1 has two ghoptes with resolution order 1
- Player 2 has one ghopte with resolution order 2
- Player 3 has no ghoptes

The `order` value determines ghopte resolution priority.

Multiple ghoptes belonging to the same player may have the same order. When it is that player's turn to resolve a ghopte, the player may choose any unresolved ghopte with that order.

The appearance order of multiple ghoptes within the same player's group does not determine their resolution order.

Across player groups, ghopte order generally follows the anti-clockwise player order, so order values should typically increase from left to right. The game engine determines and assigns the final resolution order.

For example:

-/Kh,1,-:7s,1,-/Qd,2,-/Js,3,-

The ghopte resolution sequence is:

1. Player 1 resolves either Kh or 7s
2. Player 2 resolves Qd
3. Player 3 resolves Js

For 2-player mode, ghoptes do not exist. The ghoptes section is:

-

## 3. Hands

Hands are grouped by player position and separated by `/`.

Format:

<player_0_cards>/<player_1_cards>/<player_2_cards>/<player_3_cards>

Example:

As,Qh,10d/7c,Js/Kd,8d/9s,Ad

Player ownership is determined by segment position:

Segment 0 = player 0
Segment 1 = player 1
Segment 2 = player 2
Segment 3 = player 3

When a player plays a card, that card is removed from the corresponding player's hand.

## 4. Stacks

Stacks are applicable only in 2-player mode.

Each player has 4 stacks, resulting in 8 positional stack slots.

Format:

<p0_stack_1>/<p0_stack_2>/<p0_stack_3>/<p0_stack_4>/<p1_stack_1>/<p1_stack_2>/<p1_stack_3>/<p1_stack_4>

The first 4 stacks belong to player 0.

The next 4 stacks belong to player 1.

Each stack initially contains 5 cards.

Cards are serialized from bottom to top.

Example:

7h,Kc,As,4d,10s

7h is the bottom card and 10s is the top card.

The last card is therefore the face-up card.

An empty stack is represented by: 

-

For 4-player mode, stacks are not applicable:

-

## 5. Move Number

A standalone integer representing the overall move number.

Format:

<move_number>

Example:

12

## 6. Trick

The trick section describes the current trick context.

Format:

<trick_number>,<play_number>,<ghopte_flag>

Examples:

3,2,-
5,1,g

Values:

- = normal trick
g = ghopte trick

trick_number represents the current trick number.

play_number represents the play position within the current trick.

## 7. Move Detail

The move detail represents the move that produced the current DMN state.

Format:

<player_position>,<card>,<makes_turup>

Examples:

2,4s,-
1,Kh,t

Values:

- = this move did not establish turup
t = this move established/made turup

## 8. Next Move

A standalone player position representing who must make the next move.

Format:

<next_move_player_position>

Example:

3

The initial DMN must populate next_move_player_position immediately when the game is created or the dealing is done.

For a 4-player game with ghoptes, next_move_player_position is the player whose unresolved ghopte has the next resolution order.

For example, if the first unresolved ghopte is:

7s,1,-

and belongs to player 1, then:

next_move_player_position = 1

If there are no ghoptes, next_move_player_position is the player next to the dealer in anti-clockwise order.

For subsequent game states, next_move_player_position represents the player expected to make the next valid move.

In 2-player mode, non dealer is the next_move_player_position

## Complete Format

<game> | <ghoptes> | <hands> | <stacks> | <move_number> | <trick> | <move_detail> | <next_move_player_position>

## Example

4p,2,h | -/Kh,2,-:7s,1,-/-/Qd,3,- | As,Qh,10d/7c,Js/Kd,8d/9s,Ad | -/-/-/-/-/-/-/- | 12 | 3,2,- | 2,4s,- | 3