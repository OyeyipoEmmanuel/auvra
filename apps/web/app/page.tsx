import Link from "next/link";
import { ArrowDown, ArrowUpRight } from "lucide-react";

import { Brand } from "@/components/brand";
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
    <main className="min-h-screen overflow-x-clip bg-[#09090b] text-[#fafafa]">
      <SiteHeader />
      <section
        className="marketing-grid relative overflow-hidden border-b border-[#27272a]"
        aria-labelledby="hero-title"
      >
        <div className="mx-auto max-w-[1440px] px-5 pb-14 pt-24 sm:px-8 sm:pt-32 lg:px-12 lg:pt-36">
          <h1
            id="hero-title"
            className="hero-enter hero-enter-2 mt-7 max-w-[1150px] text-[clamp(3.6rem,8.25vw,8rem)] font-medium leading-[.92] tracking-[-.075em]"
          >
            <span className="block">The company</span>
            <span className="block">
              that runs itself<span className="text-[var(--brand-light)]">.</span>
            </span>
          </h1>
          <div className="hero-enter hero-enter-3 mt-8 flex flex-col gap-8 sm:mt-10 lg:flex-row lg:items-end lg:justify-between">
            <p className="max-w-[640px] text-[17px] leading-7 text-[#aaaab3] sm:text-xl sm:leading-8">
              From customer requests to agent hiring, execution, and payments. Auvra manages the
              entire operation.
            </p>
            <div className="flex shrink-0 flex-wrap items-center gap-2 sm:gap-3">
              <Link
                href="/app/requests/new"
                className="inline-flex h-11 items-center gap-2 rounded-lg bg-[var(--brand)] px-4 text-[15px] font-medium text-white transition-colors hover:bg-[#7437e6] sm:px-5"
              >
                Get started <ArrowUpRight className="size-4" />
              </Link>
              <Link
                href="#how-it-works"
                className="inline-flex h-11 items-center gap-2 rounded-lg border border-[#39393f] bg-[#161619] px-4 text-[15px] font-medium text-[#e8e8eb] transition-colors hover:bg-[#202024] sm:px-5"
              >
                See how it works <ArrowDown className="size-3.5" />
              </Link>
            </div>
          </div>
          <div
            id="product"
            className="hero-enter hero-enter-4 mt-20 scroll-mt-24 sm:mt-24"
          >
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-[13px] text-[#8b8b95]">
              <span>THE AUVRA WORKSPACE</span>
              <span>One request, one accountable operation</span>
            </div>
            <MarketingProductDemo />
            <p className="mt-4 text-[13px] text-[#72727b]">
              Illustrative product preview. Live supplier purchases and settlement are not enabled
              in the current demo.
            </p>
          </div>
        </div>
      </section>

      <section
        id="how-it-works"
        className="scroll-mt-20 border-b border-[#27272a] py-24 sm:py-32 lg:py-36"
      >
        <div className="mx-auto max-w-[1344px] px-5 sm:px-8 lg:px-12">
          <Reveal>
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-end">
              <div>
                <Eyebrow>How Auvra works</Eyebrow>
                <h2 className="mt-5 max-w-[800px] text-[clamp(2.8rem,5.6vw,5.4rem)] font-medium leading-[.98] tracking-[-.065em]">
                  One request.
                  <br />
                  <span className="text-[#7d7d88]">An entire operation.</span>
                </h2>
              </div>
              <p className="max-w-md text-[16px] leading-7 text-[#9b9ba5]">
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
        className="scroll-mt-20 border-b border-[#27272a] bg-[#0f0f11] py-24 sm:py-32"
      >
        <div className="mx-auto grid max-w-[1344px] gap-14 px-5 sm:px-8 lg:grid-cols-[.72fr_1.28fr] lg:items-start lg:gap-20 lg:px-12">
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
          <Reveal>
            <OperationsPreview />
          </Reveal>
        </div>
      </section>

      <section className="border-b border-[#27272a] py-24 sm:py-32">
        <div className="mx-auto grid max-w-[1344px] gap-14 px-5 sm:px-8 lg:grid-cols-[1.15fr_.85fr] lg:items-center lg:gap-20 lg:px-12">
          <Reveal className="order-2 lg:order-1">
            <ProcurementPreview />
          </Reveal>
          <Reveal className="order-1 lg:order-2">
            <Eyebrow>Specialist procurement</Eyebrow>
            <h2 className="mt-5 text-[clamp(2.7rem,4.8vw,4.6rem)] font-medium leading-[1.01] tracking-[-.06em]">
              The right agents. Hired automatically.
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

      <section className="border-b border-[#27272a] bg-[#0f0f11] py-24 sm:py-32">
        <div className="mx-auto max-w-[1344px] px-5 sm:px-8 lg:px-12">
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
          <Reveal className="mt-14">
            <TreasuryPreview />
          </Reveal>
        </div>
      </section>

      <section
        id="about"
        className="scroll-mt-20 border-b border-[#27272a] py-24 sm:py-32"
      >
        <div className="mx-auto grid max-w-[1344px] gap-12 px-5 sm:px-8 lg:grid-cols-[.8fr_1.2fr] lg:gap-20 lg:px-12">
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

      <section className="py-24 sm:py-32">
        <div className="mx-auto max-w-[1344px] px-5 sm:px-8 lg:px-12">
          <Reveal>
            <div className="border-t border-[#3d2e55] pt-8">
              <p className="text-[13px] font-medium uppercase tracking-[.14em] text-[#9a7bdb]">
                Start with the outcome
              </p>
              <div className="mt-7 flex flex-col gap-10 lg:flex-row lg:items-end lg:justify-between">
                <h2 className="max-w-[900px] text-[clamp(3rem,6.4vw,6.2rem)] font-medium leading-[.96] tracking-[-.07em]">
                  Auvra. The company
                  <br />
                  that runs itself.
                </h2>
                <Link
                  href="/app/requests/new"
                  className="inline-flex h-11 shrink-0 items-center gap-2 self-start rounded-lg bg-[var(--brand)] px-5 text-[15px] font-medium text-white transition-colors hover:bg-[#7437e6] lg:self-auto"
                >
                  Get started <ArrowUpRight className="size-4" />
                </Link>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <footer className="border-t border-[#27272a] bg-[#0f0f11]">
        <div className="mx-auto grid max-w-[1344px] gap-8 px-5 py-10 sm:px-8 md:grid-cols-[1fr_auto_auto] lg:px-12">
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
        <div className="mx-auto flex max-w-[1344px] flex-wrap justify-between gap-2 border-t border-[#27272a] px-5 py-5 text-[13px] text-[#71717a] sm:px-8 lg:px-12">
          <span>© 2026 Auvra</span>
          <span>Development sandbox · no live supplier spend</span>
        </div>
      </footer>
    </main>
  );
}
