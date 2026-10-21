import type { Metadata } from "next"
import { DocsHero, DocsShell, DocSection } from "@/components/aero/page-shell"

export const metadata: Metadata = {
  title: "Docs — Aero",
  description: "How to send, pay, and earn with Aero on Avalanche.",
}

export default function DocsPage() {
  return (
    <DocsShell>
      <div className="mx-auto w-full max-w-3xl px-5 py-14 sm:py-20">
        <DocsHero
          eyebrow="Documentation"
          title="Aero, explained plainly"
          body="Aero is building digital-dollar payments, everyday payment experiences, and yield on eligible stablecoins. Today’s interactive app is a Fuji testnet sandbox using worthless test tokens and simulated services."
        />

        <div className="mt-12">
          <DocSection id="getting-started" eyebrow="Start here" title="Getting started">
            <p>
              <strong className="font-semibold text-neutral-900">1. Connect a wallet.</strong>{" "}
              The sandbox connects your browser wallet to Avalanche Fuji. This is not an Aero
              account or account-recovery system.
            </p>
            <p>
              <strong className="font-semibold text-neutral-900">2. Claim test tokens.</strong>{" "}
              The faucet provides tUSDC, a test token with no cash value. Fuji AVAX is needed
              from your wallet for network fees.
            </p>
            <p>
              <strong className="font-semibold text-neutral-900">3. Try a test transfer.</strong>{" "}
              Register a handle in the on-chain Fuji registry, then send tUSDC to a registered
              handle or wallet address. Your wallet prompts you to authorize the transaction.
            </p>
          </DocSection>

          <DocSection id="send" eyebrow="Send" title="Pay people, not addresses">
            <p>
              The Fuji demo includes an on-chain username registry and a wallet-signed tUSDC
              payment flow. A handle resolves to its current registered wallet address when
              the payment contract executes. Transactions require Fuji AVAX for gas and are
              visible on the public testnet.
            </p>
            <p>
              This demo does not hold funds for unregistered recipients or provide a claim
              escrow. Check the displayed handle or address before signing; blockchain
              transfers may be irreversible.
            </p>
          </DocSection>

          <DocSection id="pay" eyebrow="Pay" title="Bill payment is a product direction">
            <p>
              The current interface has a few bill-like presets. Selecting one fills in a
              recipient, amount, and memo, then uses the same ordinary tUSDC transfer flow.
              There is no connected utility, landlord, merchant, or biller service.
            </p>
            <p>
              Bill tracking, due dates, biller confirmation, reversals, and disputes are not
              implemented. Connecting everyday bill-payment providers remains part of the
              intended Pay experience.
            </p>
          </DocSection>

          <DocSection id="earn" eyebrow="Earn" title="Yield is simulated in the sandbox">
            <p>
              The standalone AeroVault increases a share index using a configured mock rate.
              The AeroRouter source routes assets across adapters, but the supplied integrated
              deployment script uses mock QiToken markets. Idle wallet balances are not
              automatically supplied, and no live Benqi or Trader Joe market integration is
              established by this repository.
            </p>
            <p>
              Displayed mock rates are not live market quotes or expected returns. Router
              withdrawals are synchronous and may revert when an adapter cannot return the
              requested liquidity; there is no reserved liquid balance or withdrawal queue.
            </p>
            <p>
              Real yield on eligible stablecoins is an intended product pillar. It must remain
              disabled for real assets until supported markets, liquidity behavior, ownership
              controls, independent security review, and deployments are approved.
            </p>
          </DocSection>

          <DocSection id="network" eyebrow="Network" title="The current app runs on Fuji">
            <p>
              The current consumer sandbox is configured for Avalanche Fuji (chain ID
              43113). This repository contains no implemented Aero cross-chain messaging or
              ICM/Warp payment flow. The Aero L1 initiative is separate from the working
              consumer sandbox integration.
            </p>
            <p>
              Wallet connection and network switching are visible parts of the sandbox. Users
              need Fuji AVAX for testnet transaction fees. Mainnet networks and production
              assets are not enabled here.
            </p>
          </DocSection>

          <DocSection id="security" eyebrow="Security" title="Your keys, your dollars">
            <p>
              The sandbox connects to a wallet whose keys are managed by the wallet provider.
              Payment transactions are authorized by that wallet. Deposits move test tokens
              into contracts, so those tokens are subject to contract code and owner
              configuration. The repository contains no Aero key recovery or account recovery
              mechanism.
            </p>
            <p>
              Never share wallet recovery material or sign a transaction you do not
              understand. Only use worthless test tokens in the sandbox.
            </p>
          </DocSection>

          <DocSection id="testnet" eyebrow="Testnet" title="Try it on Fuji first">
            <p>
              The live testnet runs at{" "}
              <a href="https://testnet.useaero.org" className="font-medium text-aero-800 hover:underline">
                testnet.useaero.org
              </a>{" "}
              on Avalanche Fuji (chain ID 43113). Everything there uses worthless test
              dollars — perfect for learning the ropes.
            </p>
            <p>
              <strong className="font-semibold text-neutral-900">1. Get gas.</strong>{" "}
              Grab Fuji AVAX from faucet.avax.network — you need a little for transaction fees.
            </p>
            <p>
              <strong className="font-semibold text-neutral-900">2. Claim test dollars.</strong>{" "}
              Hit “Claim 10,000 tUSDC” in the app (once every 24 hours per wallet).
            </p>
            <p>
              <strong className="font-semibold text-neutral-900">3. Claim a handle, then play.</strong>{" "}
              Register a @username on-chain, send test tokens, try the bill presets, and
              inspect the mock router or vault. These are testnet contracts and mock markets,
              not production financial services. Check the current deployment and contract
              status before using the sandbox; testnet deployments may change.
            </p>
            <p>
              <strong className="font-semibold text-neutral-900">Need test dollars two ways.</strong>{" "}
              Claim 10,000 tUSDC from the in-app faucet, or “buy” a pack with the sandbox
              card screen — no card processor or charge is involved; the contract transfers
              pre-funded tUSDC from a testnet inventory.
              Owe someone off-app? Send them your link:{" "}
              <span className="font-mono text-[15px] text-neutral-900">useaero.org/pay/@you/25</span>
            </p>
          </DocSection>

          <DocSection id="support" eyebrow="Contact" title="Email contact">
            <p>
              Stuck on something? Write to <span className="font-medium text-neutral-900">support@useaero.org</span> with
              The repository does not provide a support ticket, dispute case, or response-time
              service level.
            </p>
          </DocSection>
        </div>
      </div>
    </DocsShell>
  )
}
