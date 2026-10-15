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
          body="Everything you need to send money, pay bills, and earn yield — no crypto background required."
        />

        <div className="mt-12">
          <DocSection id="getting-started" eyebrow="Start here" title="Getting started">
            <p>
              <strong className="font-semibold text-neutral-900">1. Claim your @username.</strong>{" "}
              Usernames are free and first-come, first-served. It becomes your address, your
              payment link, and your identity in one.
            </p>
            <p>
              <strong className="font-semibold text-neutral-900">2. Add dollars.</strong>{" "}
              Fund your balance with USDC on Avalanche. What you deposit is what you can spend —
              a dollar in is a dollar out.
            </p>
            <p>
              <strong className="font-semibold text-neutral-900">3. Send your first payment.</strong>{" "}
              Type any @username and an amount. It settles in under a second, and the other
              person gets a notification — not a transaction hash to decode.
            </p>
          </DocSection>

          <DocSection id="send" eyebrow="Send" title="Pay people, not addresses">
            <p>
              Every Aero user has a @username. Sending to one is like tagging someone in a
              message: type the name, confirm the amount, done. Settlement on Avalanche
              finalizes in under a second.
            </p>
            <p>
              The recipient doesn&apos;t need Aero. If they&apos;re not on it yet, they get a
              claim link to collect the funds with a username of their own. Nothing is ever
              lost to a mistyped address, because there are no addresses to mistype.
            </p>
          </DocSection>

          <DocSection id="pay" eyebrow="Pay" title="One balance for real life">
            <p>
              Your Aero balance pays rent, utilities, merchants, and freelancers directly. Add
              a bill once and it&apos;s tracked with due dates; pay it in a tap when
              you&apos;re ready.
            </p>
            <p>
              Payees don&apos;t need Aero or any crypto knowledge — on their end it arrives
              like any normal payment. And because earning never pauses, your money keeps
              working right up until the moment it&apos;s spent.
            </p>
          </DocSection>

          <DocSection id="earn" eyebrow="Earn" title="Savings that run themselves">
            <p>
              Any USDC sitting in your balance is automatically supplied to established
              Avalanche lending markets such as Benqi and Trader Joe. An agent watches the
              rates around the clock and routes funds to wherever pays best.
            </p>
            <p>
              Rates are variable and change with the markets — the number you see in the app
              is always the live best available rate, not a promise. A liquid reserve is kept
              back so spending and withdrawals are always instant, even while the rest earns.
            </p>
            <p>
              Like all DeFi, lending carries smart-contract risk. Aero only routes to large,
              audited, battle-tested markets — never experimental vaults — but you should
              understand the tradeoff. See the Terms for the full risk disclosure.
            </p>
          </DocSection>

          <DocSection id="network" eyebrow="Network" title="What happens under the hood">
            <p>
              Aero runs on Avalanche, a network of 80+ interconnected blockchains (L1s).
              A routing layer built on Avalanche Warp Messaging moves funds between them to
              find the fastest execution and the best yield.
            </p>
            <p>
              You never pick a chain, hold gas tokens, or approve network switches. There is
              no gas to understand and no &quot;wrong network&quot; to send on — Aero absorbs
              all of that complexity.
            </p>
          </DocSection>

          <DocSection id="security" eyebrow="Security" title="Your keys, your dollars">
            <p>
              Aero is self-custodied: you hold the keys, which means nobody — not even Aero —
              can move your money without you. Back up your recovery details somewhere safe
              and offline; if you lose them, there is no password reset that can recover
              funds.
            </p>
            <p>
              Never share recovery details with anyone, including people claiming to be Aero
              support. Support will never ask for them.
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
              Register a @username on-chain, send to friends (add a note — it travels
              on-chain with the payment), pay the demo bills, and park funds in the
              auto-router or the mock vault. Contracts are unverified experiments —
              expect resets between testnet phases.
            </p>
            <p>
              <strong className="font-semibold text-neutral-900">Need test dollars two ways.</strong>{" "}
              Claim 10,000 tUSDC daily from the in-app faucet, or “buy” a pack with the
              sandbox card checkout — no real charge, settled from the on-chain till.
              Owe someone off-app? Send them your link:{" "}
              <span className="font-mono text-[15px] text-neutral-900">useaero.org/pay/@you/25</span>
            </p>
          </DocSection>

          <DocSection id="support" eyebrow="Support" title="Talk to a human">
            <p>
              Stuck on something? Write to <span className="font-medium text-neutral-900">support@useaero.org</span> with
              your @username and what you were trying to do. Real people reply — usually
              within a day.
            </p>
          </DocSection>
        </div>
      </div>
    </DocsShell>
  )
}
