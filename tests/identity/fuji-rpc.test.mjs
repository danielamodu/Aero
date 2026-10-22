import test from "node:test"
import assert from "node:assert/strict"
import { createServer } from "node:http"
import { checkFujiAddressIsEoa } from "../../lib/identity/fuji-eoa.mjs"

function jsonRpcResult(id, result) {
  return { jsonrpc: "2.0", id, result }
}

async function withRpc(handler, run) {
  const server = createServer(async (request, response) => {
    let raw = ""
    for await (const chunk of request) raw += chunk
    let body
    try {
      body = JSON.parse(raw)
    } catch {
      response.writeHead(400).end()
      return
    }
    const single = Array.isArray(body) ? body[0] : body
    const outcome = await handler(single)
    response.setHeader("content-type", "application/json")
    if (outcome.status) {
      response.writeHead(outcome.status).end(JSON.stringify(outcome.body ?? {}))
      return
    }
    response.end(JSON.stringify(jsonRpcResult(single.id, outcome.result)))
  })
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve))
  const { port } = server.address()
  try {
    return await run(`http://127.0.0.1:${port}`)
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
}

test("Fuji RPC classifies an empty-code response as an EOA", async () => {
  await withRpc(
    async (request) => {
      if (request.method === "eth_chainId") return { result: "0xa869" }
      if (request.method === "eth_getCode") return { result: "0x" }
      return { status: 400 }
    },
    async (rpcUrl) => {
      assert.equal(
        await checkFujiAddressIsEoa("0x000000000000000000000000000000000000dEaD", {
          rpcUrl,
          timeoutMs: 1000,
        }),
        true
      )
    }
  )
})

test("Fuji RPC rejects deployed bytecode as a contract", async () => {
  await withRpc(
    async (request) => {
      if (request.method === "eth_chainId") return { result: "0xa869" }
      if (request.method === "eth_getCode") return { result: "0x60006000" }
      return { status: 400 }
    },
    async (rpcUrl) => {
      assert.equal(
        await checkFujiAddressIsEoa("0x4f88395a2cf38645ba2016b6abf5ad084c19c369", {
          rpcUrl,
          timeoutMs: 1000,
        }),
        false
      )
    }
  )
})

test("a wrong-chain RPC is rejected instead of being treated as EOA evidence", async () => {
  await withRpc(
    async (request) => {
      if (request.method === "eth_chainId") return { result: "0x1" }
      if (request.method === "eth_getCode") return { result: "0x" }
      return { status: 400 }
    },
    async (rpcUrl) => {
      await assert.rejects(
        checkFujiAddressIsEoa("0x000000000000000000000000000000000000dEaD", {
          rpcUrl,
          timeoutMs: 1000,
        }),
        /IDENTITY_FUJI_RPC_CHAIN_MISMATCH/
      )
    }
  )
})

test("malformed bytecode responses and transport failures never prove EOA", async () => {
  await withRpc(
    async (request) => {
      if (request.method === "eth_chainId") return { result: "0xa869" }
      if (request.method === "eth_getCode") return { result: "0xzz" }
      return { status: 400 }
    },
    async (rpcUrl) => {
      await assert.rejects(
        checkFujiAddressIsEoa("0x000000000000000000000000000000000000dEaD", {
          rpcUrl,
          timeoutMs: 1000,
        })
      )
    }
  )

  await withRpc(
    async (request) => {
      if (request.method === "eth_chainId") return { result: "0xa869" }
      if (request.method === "eth_getCode") return { result: null }
      return { status: 400 }
    },
    async (rpcUrl) => {
      await assert.rejects(
        checkFujiAddressIsEoa("0x000000000000000000000000000000000000dEaD", {
          rpcUrl,
          timeoutMs: 1000,
        }),
        /IDENTITY_FUJI_RPC_RESPONSE_INVALID/
      )
    }
  )

  await withRpc(
    async () => ({ status: 500, body: { error: "unavailable" } }),
    async (rpcUrl) => {
      await assert.rejects(
        checkFujiAddressIsEoa("0x000000000000000000000000000000000000dEaD", {
          rpcUrl,
          timeoutMs: 1000,
        }),
        /IDENTITY_FUJI_RPC_UNAVAILABLE/
      )
    }
  )

  await assert.rejects(
    checkFujiAddressIsEoa("0x000000000000000000000000000000000000dEaD", {
      rpcUrl: "http://127.0.0.1:1",
      timeoutMs: 1000,
    }),
    /IDENTITY_FUJI_RPC_UNAVAILABLE/
  )
})

test("missing Fuji RPC configuration is a configuration failure, not an EOA", async () => {
  const previous = process.env.AERO_FUJI_RPC_URL
  delete process.env.AERO_FUJI_RPC_URL
  try {
    await assert.rejects(
      checkFujiAddressIsEoa("0x000000000000000000000000000000000000dEaD"),
      /IDENTITY_FUJI_RPC_UNCONFIGURED/
    )
  } finally {
    if (previous === undefined) delete process.env.AERO_FUJI_RPC_URL
    else process.env.AERO_FUJI_RPC_URL = previous
  }
})

test(
  "live Fuji RPC classifies the approved test USDC as contract and a no-code address as EOA",
  { skip: process.env.AERO_TEST_FUJI_RPC_URL ? false : "set AERO_TEST_FUJI_RPC_URL for a live read-only check" },
  async () => {
    const rpcUrl = process.env.AERO_TEST_FUJI_RPC_URL
    assert.equal(
      await checkFujiAddressIsEoa("0x4f88395a2cf38645ba2016b6abf5ad084c19c369", {
        rpcUrl,
        timeoutMs: 10000,
      }),
      false
    )
    assert.equal(
      await checkFujiAddressIsEoa("0x000000000000000000000000000000000000dEaD", {
        rpcUrl,
        timeoutMs: 10000,
      }),
      true
    )
  }
)
