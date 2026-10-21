export function positionAssets(shares, sharePrice) {
  if (typeof shares !== "bigint") return undefined
  if (shares === 0n) return 0n
  if (typeof sharePrice !== "bigint") return undefined
  return (shares * sharePrice) / 1_000_000_000_000_000_000n
}

export function totalPortfolioAssets(...positions) {
  if (positions.some((value) => typeof value !== "bigint")) return undefined
  return positions.reduce((total, value) => total + value, 0n)
}
