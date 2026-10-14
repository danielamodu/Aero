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
              Aero provides a self-custodied payments app on Avalanche: sending USDC to
              @usernames, paying bills and people from your balance, and automatically
              routing idle funds to third-party lending markets to earn yield. Using the
              app means you accept these terms.
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
              Your funds are self-custodied: you control the keys. Aero cannot move your
              money, freeze it, or recover it if you lose your recovery details. Back them
              up offline, never share them, and double-check every recipient — settled
              blockchain transactions can&apos;t be reversed by anyone, including us.
            </p>
          </DocSection>

          <DocSection id="yield" eyebrow="Yield & risk" title="Read this part twice">
            <p>
              Yield comes from independent third-party lending markets (such as Benqi and
              Trader Joe), not from Aero. Rates are variable, set by markets, and can fall —
              including to zero. Lending involves smart-contract risk: bugs, exploits, and
              market events can lose funds despite audits and track records.
            </p>
            <p>
              Aero is not a bank. Balances aren&apos;t deposits, aren&apos;t insured, and
              nothing here is investment advice or a guaranteed return. Only keep funds in
              Aero that you can afford to have exposed to these risks.
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
              Write to <span className="font-medium text-neutral-900">support@useaero.org</span> and
              a human will answer. If any part of these terms is found unenforceable, the
              rest still stands.
            </p>
          </DocSection>
        </div>
      </div>
    </DocsShell>
  )
}
