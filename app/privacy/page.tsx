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
          <DocSection id="custody" eyebrow="Testnet" title="Public chain data and wallet access">
            <p>
              The current app connects a browser wallet to Avalanche Fuji and reads public
              testnet data. Wallet addresses and transactions are public on-chain. Wallet
              connection does not create an Aero account. Deposits move test tokens into
              contracts; the app does not provide wallet-key recovery.
            </p>
          </DocSection>

          <DocSection id="collect" eyebrow="Collection" title="What we collect">
            <p>
              <strong className="font-semibold text-neutral-900">Waitlist info</strong> — if
              you join the waitlist, the app requests your email address and a desired username;
              referral information may also be submitted.
            </p>
            <p>
              <strong className="font-semibold text-neutral-900">Browser data</strong> — the
              testnet UI stores some activity, contacts, notices, and preferences in browser
              local storage.
            </p>
            <p>
              <strong className="font-semibold text-neutral-900">Service data</strong> — the
              app uses wallet, RPC, hosting, database, email, and analytics providers as
              configured. Those providers may process request and connection metadata under
              their own terms.
            </p>
          </DocSection>

          <DocSection id="use" eyebrow="Use" title="What we use it for">
            <p>
              The waitlist service uses submitted details to record signups, confirm email,
              manage referrals, and send configured announcements. The testnet UI reads public
              chain data and stores presentation preferences in your browser.
            </p>
          </DocSection>

          <DocSection id="sharing" eyebrow="Sharing" title="Who else sees it">
            <p>
              Configured service providers may process data needed to operate the site and
              waitlist. Public blockchain data — transaction amounts, addresses, and
              timestamps — is visible to everyone by design.
            </p>
          </DocSection>

          <DocSection id="rights" eyebrow="Rights" title="Your controls">
            <p>
              For waitlist data questions or removal requests, write to{" "}
              <span className="font-medium text-neutral-900">support@useaero.org</span>.
              The repository does not provide a consumer account or account-deletion flow.
              On-chain records cannot be deleted by the app.
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
