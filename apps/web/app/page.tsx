import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { Brand } from "@/components/brand";
import { LandingHero } from "@/components/landing-hero";
import { MarketingMotion } from "@/components/marketing-motion";
import { MarketingProductDemo } from "@/components/marketing-product-demo";
import {
  AboutRow,
  Eyebrow,
  OperationsPreview,
  ProcurementPreview,
  TreasuryPreview,
} from "@/components/marketing-previews";
import { MarketingStory, Reveal } from "@/components/marketing-story";
import { SiteHeader } from "@/components/site-header";

export default function Home() {
  return (
    <main className="auvra-marketing min-h-screen overflow-x-clip text-[#fafafa]">
      <MarketingMotion />
      <SiteHeader />
      <LandingHero />

      <section
        id="product"
        className="auvra-product-section scroll-mt-20"
      >
        <div className="auvra-shell">
          <Reveal>
            <div className="auvra-section-intro">
              <Eyebrow>Inside Auvra</Eyebrow>
              <span>01 / THE WORKSPACE</span>
            </div>
            <div className="auvra-product-heading">
              <h2>
                From a sentence
                <br />
                <span>to a system.</span>
              </h2>
              <p>
                One place to understand the plan, review the quote, and follow the work. The
                complexity stays behind the scenes; the decisions stay with you.
              </p>
            </div>
          </Reveal>
          <div
            data-auvra-drift="26"
            className="auvra-product-float"
          >
            <MarketingProductDemo />
          </div>
          <p className="auvra-product-note">
            Illustrative product preview. Live supplier purchases and settlement are not enabled in
            the current demo.
          </p>
        </div>
      </section>

      <section
        id="how-it-works"
        className="auvra-story-section scroll-mt-20"
      >
        <div className="auvra-shell">
          <Reveal>
            <div className="auvra-section-intro">
              <Eyebrow>The process</Eyebrow>
              <span>02 / HOW IT WORKS</span>
            </div>
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-end">
              <div>
                <h2 className="auvra-display-title mt-7 max-w-[900px]">
                  One request<span className="text-[#b195ff]">.</span>
                  <br />
                  <span className="text-[#7d7d88]">An entire operation.</span>
                </h2>
              </div>
              <p className="max-w-md text-[17px] leading-7 text-[#a6a4b2]">
                The customer buys an outcome. Auvra is responsible for turning that outcome into a
                scoped plan, the right specialist work, and a reviewable result.
              </p>
            </div>
          </Reveal>
          <MarketingStory />
        </div>
      </section>

      <section
        id="operations"
        className="auvra-feature-section auvra-feature-section-tinted scroll-mt-20"
      >
        <div className="auvra-shell grid gap-14 lg:grid-cols-[.72fr_1.28fr] lg:items-start lg:gap-20">
          <Reveal>
            <Eyebrow>Autonomous operations</Eyebrow>
            <h2 className="mt-5 text-[clamp(2.7rem,4.8vw,4.6rem)] font-medium leading-[1.01] tracking-[-.06em]">
              Built to handle the work behind the work.
            </h2>
            <p className="mt-6 max-w-md text-[16px] leading-7 text-[#9b9ba5]">
              Auvra breaks work into dependencies, evaluates supplier fit, tracks each step, and
              keeps exceptions visible instead of hiding them behind a progress bar.
            </p>
            <Link
              href="/app/operations"
              className="mt-8 inline-flex items-center gap-2 text-[15px] font-medium text-[#c7b0fb] hover:text-white"
            >
              Explore the workspace <ArrowUpRight className="size-4" />
            </Link>
          </Reveal>
          <Reveal className="auvra-feature-art">
            <div
              data-auvra-drift="18"
              className="auvra-drift-layer"
            >
              <OperationsPreview />
            </div>
          </Reveal>
        </div>
      </section>

      <section className="auvra-feature-section">
        <div className="auvra-shell grid gap-14 lg:grid-cols-[1.15fr_.85fr] lg:items-center lg:gap-20">
          <Reveal className="auvra-feature-art order-2 lg:order-1">
            <div
              data-auvra-drift="-18"
              className="auvra-drift-layer"
            >
              <ProcurementPreview />
            </div>
          </Reveal>
          <Reveal className="order-1 lg:order-2">
            <Eyebrow>Specialist procurement</Eyebrow>
            <h2 className="mt-5 text-[clamp(2.7rem,4.8vw,4.6rem)] font-medium leading-[1.01] tracking-[-.06em]">
              The right minds for every job.
            </h2>
            <p className="mt-6 max-w-md text-[16px] leading-7 text-[#9b9ba5]">
              Auvra uses NEAR Agent Market as its supplier network. The manager checks capability,
              published terms, availability, and the approved budget before a job can be placed.
            </p>
            <p className="mt-5 max-w-md border-l-2 border-[#544066] pl-4 text-[14px] leading-5 text-[#85858e]">
              Catalog discovery and quoting work today. Paid supplier hiring remains behind funding
              and approval gates.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="auvra-feature-section auvra-feature-section-tinted">
        <div className="auvra-shell">
          <Reveal>
            <div className="grid gap-6 lg:grid-cols-[.9fr_1.1fr] lg:items-end">
              <div>
                <Eyebrow>Treasury & accounting</Eyebrow>
                <h2 className="mt-5 text-[clamp(2.7rem,5vw,4.9rem)] font-medium leading-[1.01] tracking-[-.06em]">
                  Every dollar
                  <br />
                  accounted for.
                </h2>
              </div>
              <p className="max-w-xl text-[16px] leading-7 text-[#9b9ba5]">
                A quote is an estimate. Funding is a liability. Supplier commitments become costs
                only when settled. Auvra separates each stage so profit is never mistaken for money
                received.
              </p>
            </div>
          </Reveal>
          <Reveal className="auvra-feature-art mt-14">
            <div
              data-auvra-drift="14"
              className="auvra-drift-layer"
            >
              <TreasuryPreview />
            </div>
          </Reveal>
        </div>
      </section>

      <section
        id="about"
        className="auvra-feature-section scroll-mt-20"
      >
        <div className="auvra-shell grid gap-12 lg:grid-cols-[.8fr_1.2fr] lg:gap-20">
          <Reveal>
            <Eyebrow>Built on NEAR</Eyebrow>
            <h2 className="mt-5 text-[clamp(2.7rem,4.8vw,4.6rem)] font-medium leading-[1.01] tracking-[-.06em]">
              A company with a verifiable backbone.
            </h2>
          </Reveal>
          <Reveal>
            <p className="max-w-2xl text-[17px] leading-8 text-[#a1a1aa]">
              Auvra hires specialized external workers through NEAR Agent Market, while the customer
              works with Auvra as a single accountable service company.
            </p>
            <div className="mt-9 border-t border-[#303035]">
              <AboutRow
                title="NEAR Agent Market"
                detail="Real supplier discovery and observed pricing support scoping and quotes."
              />
              <AboutRow
                title="Payment controls"
                detail="Customer funding and supplier purchases are separate, approval-gated workflows."
              />
              <AboutRow
                title="Onchain receipts"
                detail="A narrow Rust NEAR contract for project and settlement proofs is planned; it is not yet deployed."
              />
            </div>
          </Reveal>
        </div>
      </section>

      <section className="auvra-final-section">
        <div
          className="auvra-final-grid"
          aria-hidden="true"
        />
        <div className="auvra-shell">
          <Reveal>
            <div className="auvra-final-content">
              <p className="auvra-kicker">Start with the outcome</p>
              <h2>
                Make room for
                <br />
                <span>what&apos;s next.</span>
              </h2>
              <p>
                Tell us the outcome. We&apos;ll help turn it into an operation you can understand,
                approve, and follow.
              </p>
              <Link
                href="/app/requests/new"
                className="auvra-action auvra-action-primary"
              >
                <span>Start a request</span>
                <span className="auvra-action-icon">
                  <ArrowUpRight size={18} />
                </span>
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      <footer className="auvra-footer">
        <div className="auvra-shell grid gap-12 py-16 md:grid-cols-[2fr_1fr_1fr]">
          <div>
            <Brand />
            <p className="mt-3 max-w-xs text-[14px] leading-5 text-[#85858e]">
              Describe what you need. Auvra manages the work.
            </p>
          </div>
          <div className="flex flex-col gap-2 text-[14px] text-[#a1a1aa]">
            <Link
              href="#product"
              className="hover:text-white"
            >
              Product
            </Link>
            <Link
              href="#how-it-works"
              className="hover:text-white"
            >
              How it works
            </Link>
            <Link
              href="#about"
              className="hover:text-white"
            >
              About
            </Link>
          </div>
          <div className="flex flex-col gap-2 text-[14px] text-[#a1a1aa]">
            <Link
              href="/login"
              className="hover:text-white"
            >
              Sign in
            </Link>
            <Link
              href="/app/requests/new"
              className="hover:text-white"
            >
              Get started
            </Link>
            <a
              href="https://market.near.ai/"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white"
            >
              NEAR Agent Market <ArrowUpRight className="inline size-3" />
            </a>
          </div>
        </div>
        <div
          className="auvra-footer-wordmark"
          aria-hidden="true"
        >
          AUVRA
        </div>
        <div className="auvra-shell auvra-footer-bottom">
          <span>© 2026 Auvra</span>
          <span>Development sandbox · no live supplier spend</span>
        </div>
      </footer>
    </main>
  );
}
