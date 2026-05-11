// TODO: Recompute player ratings after match completion using ELO-style formula.
export function computeNewRating(playerRating: number, opponentRating: number, outcome: 0 | 1): number {
  const k = 24;
  const expected = 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400));
  return playerRating + k * (outcome - expected);
}
