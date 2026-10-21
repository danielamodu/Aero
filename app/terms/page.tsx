import type { Metadata } from "next"
import { DocsHero, DocsShell, DocSection } from "@/components/aero/page-shell"

export const metadata: Metadata = {
  title: "Terms — Aero",
  description: "The terms governing your use of Aero.",
}

export default function TermsPage() {
  return (
    <DocsShell>
      <div className="mx-auto w-full max-w-3xl px-5 py-14 sm:py-20">
        <DocsHero
          eyebrow="Terms"
          title="The rules of the road"
          body="Last updated October 2026. Written to be read, not to be scrolled past."
        />

        <div className="mt-12">
          <DocSection id="service" eyebrow="The basics" title="What Aero is">
            <p>
              The currently available interactive Aero app is an Avalanche Fuji testnet
              sandbox. It supports wallet-authorized transfers of tUSDC, an on-chain handle
              registry, test bill presets, and mock yield interfaces. tUSDC has no cash value.
              Real biller payments, production stablecoin payments, and live third-party yield
              are not established by this application. These terms apply to the sandbox only.
            </p>
          </DocSection>

          <DocSection id="eligibility" eyebrow="Eligibility" title="Who can use Aero">
            <p>
              You must be of legal age in your jurisdiction and legally able to use digital
              asset services where you live. You&apos;re responsible for knowing whether
              that&apos;s you — availability varies by region, and some features may be
              limited during early access.
            </p>
          </DocSection>

          <DocSection id="custody" eyebrow="Custody" title="Your keys, your responsibility">
            <p>
              Your connected wallet provider controls access to its keys; the repository does
              not establish an Aero account recovery path. Payment transactions are authorized
              by your wallet. Yield deposits transfer test tokens to contracts and are subject
              to their code and owner configuration. Check recipients and transaction details
              before signing; blockchain transactions may be irreversible.
            </p>
          </DocSection>

          <DocSection id="yield" eyebrow="Yield & risk" title="Read this part twice">
            <p>
              Yield shown in the current sandbox is simulated by test contracts or mock
              markets. The repository does not establish a live Benqi or Trader Joe
              integration. Any future lending integration would carry contract, liquidity,
              market, and operational risks; no rate or return is guaranteed.
            </p>
            <p>
              Aero is not a bank. Test tokens are not deposits, are not insured, and have no
              cash value. Do not send real assets to sandbox contracts.
            </p>
          </DocSection>

          <DocSection id="conduct" eyebrow="Conduct" title="Acceptable use">
            <p>
              Don&apos;t use Aero for anything illegal — fraud, money laundering, sanctions
              evasion, or abuse of other users. Don&apos;t probe, spam, or attempt to disrupt
              the service. We may limit or suspend accounts that violate these terms or
              applicable law.
            </p>
          </DocSection>

          <DocSection id="availability" eyebrow="Availability" title="Things change">
            <p>
              Features, rates, routes, and supported regions may change as the product
              evolves, and the service may occasionally be unavailable during maintenance or
              network disruptions. We&apos;ll communicate major changes in advance where
              possible.
            </p>
          </DocSection>

          <DocSection id="liability" eyebrow="Liability" title="Limits, in plain terms">
            <p>
              To the maximum extent the law allows, Aero isn&apos;t liable for losses from
              market movements, third-party protocol failures, network outages, or your own
              lost keys and mistaken transfers. Our total liability is limited to the fees,
              if any, you paid us in the twelve months before the claim.
            </p>
          </DocSection>

          <DocSection id="contact" eyebrow="Contact" title="Questions about these terms">
            <p>
              For general contact, write to <span className="font-medium text-neutral-900">support@useaero.org</span>.
              The app does not provide a support ticket or response-time commitment. If any part of these terms is found unenforceable, the
              rest still stands.
            </p>
          </DocSection>
        </div>
      </div>
    </DocsShell>
  )
}
