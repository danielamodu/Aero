import type { Metadata } from "next"
import { DocsHero, DocsShell, DocSection } from "@/components/aero/page-shell"

export const metadata: Metadata = {
  title: "Privacy — Aero",
  description: "How Aero collects, uses, and protects your information.",
}

export default function PrivacyPage() {
  return (
    <DocsShell>
      <div className="mx-auto w-full max-w-3xl px-5 py-14 sm:py-20">
        <DocsHero
          eyebrow="Privacy"
          title="Your money is yours. So is your data."
          body="Last updated October 2026. Plain language first, lawyers second."
        />

        <div className="mt-12">
          <DocSection id="custody" eyebrow="The short version" title="We can't see your money">
            <p>
              Aero is self-custodied: your funds live in wallets you control, routed through
              public Avalanche lending markets. We never hold your dollars, and on-chain
              activity is public by nature of the blockchain — not something we collect.
            </p>
          </DocSection>

          <DocSection id="collect" eyebrow="Collection" title="What we collect">
            <p>
              <strong className="font-semibold text-neutral-900">Account info</strong> — your
              @username and contact details, so we can run your account and reach you about it.
            </p>
            <p>
              <strong className="font-semibold text-neutral-900">Usage info</strong> — how you
              use the app (features touched, errors hit), so we can fix bugs and improve the
              experience. This is aggregated where possible.
            </p>
            <p>
              <strong className="font-semibold text-neutral-900">Device info</strong> — basic
              device and app-version details for compatibility and fraud prevention.
            </p>
          </DocSection>

          <DocSection id="use" eyebrow="Use" title="What we use it for">
            <p>
              Operating your account, processing the payments you initiate, keeping the app
              secure, meeting legal obligations, and — with your permission — telling you
              about new features. That&apos;s the whole list. We don&apos;t sell personal
              data, and we don&apos;t share it with advertisers.
            </p>
          </DocSection>

          <DocSection id="sharing" eyebrow="Sharing" title="Who else sees it">
            <p>
              A small set of service providers (hosting, analytics, customer support tooling)
              process data on our behalf under contract, and only as instructed. We disclose
              information when the law requires it. Public blockchain data — transaction
              amounts, addresses, timestamps — is visible to everyone by design.
            </p>
          </DocSection>

          <DocSection id="rights" eyebrow="Rights" title="Your controls">
            <p>
              Ask for a copy of your data, correct it, or delete your account and associated
              personal data at any time by writing to{" "}
              <span className="font-medium text-neutral-900">support@useaero.org</span>.
              Note that on-chain records can&apos;t be deleted by anyone — that&apos;s how
              blockchains work.
            </p>
          </DocSection>

          <DocSection id="changes" eyebrow="Changes" title="If this policy changes">
            <p>
              We&apos;ll update this page and, for material changes, notify you in the app or
              by email before they take effect. Continued use after that point means
              you&apos;ve accepted the update.
            </p>
          </DocSection>
        </div>
      </div>
    </DocsShell>
  )
}
