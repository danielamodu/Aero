import test from "node:test"
import assert from "node:assert/strict"
import { positionAssets, totalPortfolioAssets } from "../lib/router-portfolio.mjs"

test("partial router position read failures remain unavailable", () => {
  assert.equal(positionAssets(undefined, 1_000_000n), undefined)
  assert.equal(positionAssets(1_000_000_000_000_000_000n, undefined), undefined)
  assert.equal(totalPortfolioAssets(20_000_000n, undefined), undefined)
})

test("successful zero router reads remain a genuine zero balance", () => {
  assert.equal(positionAssets(0n, 1_000_000n), 0n)
  assert.equal(positionAssets(0n, undefined), 0n)
  assert.equal(totalPortfolioAssets(0n, 0n), 0n)
})

test("successful positions aggregate using normalized 18-decimal shares", () => {
  assert.equal(positionAssets(2_000_000_000_000_000_000n, 1_000_000n), 2_000_000n)
  assert.equal(totalPortfolioAssets(3n, 2n), 5n)
})
