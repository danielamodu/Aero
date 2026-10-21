"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useAccount, useSignMessage } from "wagmi"
import { Button } from "@/components/ui/button"
import { FUJI_CHAIN_ID } from "@/lib/testnet"

type LinkedWallet = {
  id: string
  address: string
  is_primary: boolean
  linked_at: string
}

type IdentityState = {
  authenticated: boolean
  account?: { id: string; status: string; wallets: LinkedWallet[] }
  absoluteExpiresAt?: string
  reauthenticatedAt?: string | null
}

const EMPTY_WALLETS: LinkedWallet[] = []

function csrfToken() {
  const item = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("__Host-aero_csrf="))
  return item ? decodeURIComponent(item.slice("__Host-aero_csrf=".length)) : ""
}

async function responseError(response: Response) {
  try {
    const data = await response.json()
    return typeof data.error === "string"
      ? data.error
      : "Identity request could not be completed."
  } catch {
    return "Identity service is unavailable."
  }
}

export function IdentityControl() {
  const { address, chainId, isConnected } = useAccount()
  const { signMessageAsync } = useSignMessage()
  const [state, setState] = useState<IdentityState | null>(null)
  const [proofWalletId, setProofWalletId] = useState("")
  const [pending, setPending] = useState("")
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [unavailable, setUnavailable] = useState(false)
  const [sessionExpired, setSessionExpired] = useState(false)
  const lastTouch = useRef(0)
  const hadAuthenticatedSession = useRef(false)
  const proofWalletIdRef = useRef("")

  useEffect(() => {
    proofWalletIdRef.current = proofWalletId
  }, [proofWalletId])

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/identity/session", {
        cache: "no-store",
        credentials: "same-origin",
      })
      if (response.status >= 500) {
        setUnavailable(true)
        setState({ authenticated: false })
        if (hadAuthenticatedSession.current) setSessionExpired(true)
        hadAuthenticatedSession.current = false
        return
      }
      const next = (await response.json()) as IdentityState
      setState(next)
      setUnavailable(false)
      if (next.authenticated) {
        hadAuthenticatedSession.current = true
        setSessionExpired(false)
      }
      if (
        next.authenticated &&
        next.account?.wallets.length &&
        !next.account.wallets.some(
          (wallet) => wallet.id === proofWalletIdRef.current
        )
      ) {
        const nextProof =
          next.account.wallets.find((wallet) => wallet.is_primary)?.id ??
          next.account.wallets[0].id
        proofWalletIdRef.current = nextProof
        setProofWalletId(nextProof)
      }
      if (!next.authenticated && hadAuthenticatedSession.current) {
        setSessionExpired(true)
        setNotice("Your Aero session has expired. Sign in again.")
        hadAuthenticatedSession.current = false
      }
    } catch {
      setUnavailable(true)
      setState({ authenticated: false })
      if (hadAuthenticatedSession.current) setSessionExpired(true)
      hadAuthenticatedSession.current = false
    }
  }, [])

  useEffect(() => {
    // This starts a server request; state updates happen only when its response arrives.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (!state?.authenticated) return
    const touchIfActive = () => {
      if (
        document.visibilityState !== "visible" ||
        Date.now() - lastTouch.current < 4 * 60_000
      )
        return
      const token = csrfToken()
      if (!token) return
      lastTouch.current = Date.now()
      void fetch("/api/identity/touch", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json", "x-aero-csrf": token },
        body: "{}",
      })
        .then((response) => {
          if (response.status === 401) void refresh()
        })
        .catch(() => {})
    }
    window.addEventListener("pointerdown", touchIfActive, { passive: true })
    window.addEventListener("keydown", touchIfActive)
    return () => {
      window.removeEventListener("pointerdown", touchIfActive)
      window.removeEventListener("keydown", touchIfActive)
    }
  }, [refresh, state?.authenticated])

  const wallets = state?.account?.wallets ?? EMPTY_WALLETS
  const selectedProof = wallets.find((wallet) => wallet.id === proofWalletId)

  const prove = async (input: {
    purpose: "login" | "link_wallet" | "reauthenticate" | "revoke_wallet"
    address?: string
    proofWalletId?: string
    subjectWalletId?: string
    operation?: "switch_primary"
    signerAddress: string
    label: string
  }): Promise<boolean> => {
    if (chainId !== FUJI_CHAIN_ID) {
      setError("Switch your connected wallet to Avalanche Fuji before signing.")
      return false
    }
    setPending(input.label)
    setError("")
    setNotice("")
    try {
      const csrf = csrfToken()
      const challengeResponse = await fetch("/api/identity/challenge", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "content-type": "application/json",
          ...(csrf ? { "x-aero-csrf": csrf } : {}),
        },
        body: JSON.stringify({
          purpose: input.purpose,
          address: input.address,
          proofWalletId: input.proofWalletId,
          subjectWalletId: input.subjectWalletId,
          operation: input.operation,
        }),
      })
      if (!challengeResponse.ok)
        throw new Error(await responseError(challengeResponse))
      const challenge = (await challengeResponse.json()) as {
        challengeId: string
        message: string
      }
      const signature = await signMessageAsync({
        message: challenge.message,
        account: input.signerAddress as `0x${string}`,
      })
      const verifyResponse = await fetch("/api/identity/verify", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "content-type": "application/json",
          ...(csrf ? { "x-aero-csrf": csrf } : {}),
        },
        body: JSON.stringify({
          challengeId: challenge.challengeId,
          message: challenge.message,
          signature,
        }),
      })
      if (!verifyResponse.ok)
        throw new Error(await responseError(verifyResponse))
      await refresh()
      return true
      setNotice(
        input.purpose === "login"
          ? "Sign-in checked. If no Aero account is available, this session stays unauthenticated; account creation is closed."
          : "Wallet proof completed. This signed message did not submit a transaction or authorize token transfers."
      )
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Wallet proof was not completed."
      )
      return false
    } finally {
      setPending("")
    }
  }

  const postSessionAction = async (path: string, label: string) => {
    const csrf = csrfToken()
    if (!csrf) {
      setError("Session expired. Sign in again.")
      await refresh()
      return
    }
    setPending(label)
    setError("")
    setNotice("")
    try {
      const response = await fetch(path, {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json", "x-aero-csrf": csrf },
        body: "{}",
      })
      if (!response.ok) throw new Error(await responseError(response))
      if (path.endsWith("/logout")) {
        setState({ authenticated: false })
        setSessionExpired(false)
        hadAuthenticatedSession.current = false
        setNotice("Signed out of your Aero account.")
      } else {
        setNotice(
          label === "rotate"
            ? "This session was rotated."
            : "Other Aero sessions were revoked."
        )
        await refresh()
      }
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Identity request could not be completed."
      )
    } finally {
      setPending("")
    }
  }

  const authenticated = Boolean(state?.authenticated && state.account)
  const connectedLinked = Boolean(
    address &&
    wallets.some(
      (wallet) => wallet.address.toLowerCase() === address.toLowerCase()
    )
  )

  return (
    <section
      className="mb-5 rounded-2xl border border-neutral-200 bg-white px-4 py-3.5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]"
      aria-label="Aero account identity"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-neutral-900">
              Aero account
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${authenticated ? "bg-emerald-50 text-emerald-700" : "bg-neutral-100 text-neutral-600"}`}
            >
              {unavailable
                ? "Identity unavailable"
                : authenticated
                  ? "Authenticated"
                  : sessionExpired
                    ? "Session expired"
                    : "Wallet connection only"}
            </span>
            {isConnected && address && (
              <span className="font-mono text-xs text-neutral-500">
                {address.slice(0, 6)}…{address.slice(-4)}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs leading-relaxed text-neutral-500">
            {authenticated
              ? `Verified wallet${wallets.length === 1 ? "" : "s"}: ${wallets.length}. Aero sessions cannot authorize transfers.`
              : "Connecting a wallet does not sign in. Fuji account creation is closed."}
          </p>
        </div>

        {!authenticated && isConnected && address && (
          <Button
            disabled={
              Boolean(pending) || chainId !== FUJI_CHAIN_ID || unavailable
            }
            onClick={() =>
              void prove({
                purpose: "login",
                address,
                signerAddress: address,
                label: "sign in",
              })
            }
            className="h-9 rounded-full bg-aero-800 px-4 text-sm text-white hover:bg-aero-900"
          >
            {pending === "sign in" ? "Waiting for wallet…" : "Sign in to Aero"}
          </Button>
        )}

        {authenticated && (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={Boolean(pending)}
              onClick={() =>
                void postSessionAction(
                  "/api/identity/logout-others",
                  "logout others"
                )
              }
              className="h-9 rounded-full px-3 text-xs"
            >
              Revoke other sessions
            </Button>
            <Button
              variant="outline"
              disabled={Boolean(pending)}
              onClick={() =>
                void postSessionAction("/api/identity/rotate", "rotate")
              }
              className="h-9 rounded-full px-3 text-xs"
            >
              Rotate session
            </Button>
            <Button
              variant="ghost"
              disabled={Boolean(pending)}
              onClick={() =>
                void postSessionAction("/api/identity/logout", "logout")
              }
              className="h-9 rounded-full px-3 text-xs text-neutral-600"
            >
              Sign out
            </Button>
          </div>
        )}
      </div>

      {authenticated && wallets.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-neutral-100 pt-3">
          <label
            className="text-xs text-neutral-500"
            htmlFor="identity-proof-wallet"
          >
            Wallet for security proof
          </label>
          <select
            id="identity-proof-wallet"
            value={proofWalletId}
            onChange={(event) => setProofWalletId(event.target.value)}
            className="h-8 max-w-[260px] rounded-lg border border-neutral-200 bg-white px-2 font-mono text-xs text-neutral-700"
          >
            {wallets.map((wallet) => (
              <option key={wallet.id} value={wallet.id}>
                {wallet.is_primary ? "Primary · " : ""}
                {wallet.address.slice(0, 8)}…{wallet.address.slice(-6)}
              </option>
            ))}
          </select>
          {address && !connectedLinked && (
            <Button
              variant="outline"
              disabled={
                Boolean(pending) || !selectedProof || chainId !== FUJI_CHAIN_ID
              }
              onClick={async () => {
                if (!selectedProof) return
                const reauthenticated = await prove({
                  purpose: "reauthenticate",
                  proofWalletId: selectedProof.id,
                  signerAddress: selectedProof.address,
                  label: "reauthenticate",
                })
                if (reauthenticated)
                  await prove({
                    purpose: "link_wallet",
                    address,
                    proofWalletId: selectedProof.id,
                    signerAddress: address,
                    label: "link wallet",
                  })
              }}
              className="h-8 rounded-full px-3 text-xs"
            >
              {pending === "reauthenticate" || pending === "link wallet"
                ? "Wallet proof pending…"
                : "Reauthenticate and link connected wallet"}
            </Button>
          )}
          {wallets.map((wallet) => (
            <span key={wallet.id} className="flex flex-wrap items-center gap-1">
              {!wallet.is_primary && (
                <Button
                  variant="ghost"
                  disabled={
                    Boolean(pending) ||
                    !selectedProof ||
                    chainId !== FUJI_CHAIN_ID
                  }
                  onClick={() =>
                    selectedProof &&
                    void prove({
                      purpose: "reauthenticate",
                      proofWalletId: selectedProof.id,
                      subjectWalletId: wallet.id,
                      operation: "switch_primary",
                      signerAddress: selectedProof.address,
                      label: "change primary",
                    })
                  }
                  className="h-8 rounded-full px-2 text-xs text-neutral-600"
                >
                  {pending === "change primary"
                    ? "Primary change pending…"
                    : "Make primary"}
                </Button>
              )}
              {wallets.length > 1 && (
                <Button
                  variant="ghost"
                  disabled={
                    Boolean(pending) ||
                    !selectedProof ||
                    chainId !== FUJI_CHAIN_ID
                  }
                  onClick={() =>
                    selectedProof &&
                    void prove({
                      purpose: "revoke_wallet",
                      proofWalletId: selectedProof.id,
                      subjectWalletId: wallet.id,
                      signerAddress: selectedProof.address,
                      label: "revoke wallet",
                    })
                  }
                  className="h-8 rounded-full px-2 text-xs text-rose-700"
                >
                  {pending === "revoke wallet"
                    ? "Revocation pending…"
                    : `Revoke ${wallet.address.slice(0, 6)}…`}
                </Button>
              )}
            </span>
          ))}
        </div>
      )}

      <p className="mt-2 text-[11px] leading-relaxed text-neutral-400">
        Signing a wallet proof confirms control for this Aero account action. It
        is not a blockchain transaction, token approval, or transfer
        authorization.
      </p>
      {error && (
        <p role="alert" className="mt-2 text-sm text-rose-700">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="mt-2 text-sm text-neutral-600">
          {notice}
        </p>
      )}
      {state?.absoluteExpiresAt && (
        <p className="mt-1 text-[10px] text-neutral-400">
          Absolute session expiry:{" "}
          {new Date(state.absoluteExpiresAt).toLocaleString()}
        </p>
      )}
    </section>
  )
}
