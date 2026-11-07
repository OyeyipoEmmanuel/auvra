import Link from "next/link";
import { ArrowLeft, ArrowUpRight, LockKeyhole } from "lucide-react";

import { Brand } from "@/components/brand";
import { signIn } from "@/auth";

export default function Login() {
  const googleConfigured = Boolean(
    process.env.AUTH_SECRET && process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET,
  );
  return (
    <main className="min-h-screen bg-[#09090b] text-white">
      <header className="mx-auto flex h-16 max-w-[1320px] items-center justify-between border-b border-[#27272a] px-5 sm:px-8 lg:px-12">
        <Brand />
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-[14px] text-[#9b9ba5] transition-colors hover:text-white"
        >
          <ArrowLeft className="size-3.5" />
          Back to site
        </Link>
      </header>
      <div className="mx-auto grid min-h-[calc(100vh-65px)] max-w-[1320px] lg:grid-cols-[minmax(0,1fr)_460px]">
        <section className="order-2 flex flex-col justify-between px-5 py-16 sm:px-8 lg:order-1 lg:px-12 lg:py-20">
          <div>
            <p className="text-[13px] font-medium uppercase tracking-[.14em] text-[#a682f1]">
              The company that runs itself
            </p>
            <h1 className="mt-7 max-w-[650px] text-[clamp(3.1rem,5.3vw,5.7rem)] font-medium leading-[.98] tracking-[-.065em]">
              One account.
              <br />
              Every outcome<span className="text-[#a682f1]">.</span>
            </h1>
            <p className="mt-7 max-w-lg text-[16px] leading-7 text-[#a1a1aa]">
              Your briefs, scopes, decisions, and project history stay in one workspace. Auvra keeps
              the operational work connected from the first request onward.
            </p>
          </div>
          <div className="mt-16 max-w-xl border-t border-[#303035] pt-6">
            <div className="grid grid-cols-3 gap-5 text-[13px] text-[#9b9ba5]">
              <span>
                <b className="mb-2 block font-medium text-[#e4e4e7]">01 / Describe</b>State the
                outcome you need.
              </span>
              <span>
                <b className="mb-2 block font-medium text-[#e4e4e7]">02 / Review</b>See the scope
                and quote.
              </span>
              <span>
                <b className="mb-2 block font-medium text-[#e4e4e7]">03 / Track</b>Follow recorded
                project state.
              </span>
            </div>
          </div>
        </section>
        <section className="order-1 flex items-center border-b border-[#27272a] bg-[#0f0f11] px-5 py-14 sm:px-8 lg:order-2 lg:border-b-0 lg:border-l lg:px-12">
          <div className="w-full">
            <p className="text-[13px] font-medium uppercase tracking-[.14em] text-[#a682f1]">
              Customer workspace
            </p>
            <h2 className="mt-4 text-[30px] font-medium tracking-[-.045em]">Sign in to Auvra</h2>
            <p className="mt-3 text-[15px] leading-6 text-[#9898a2]">
              Continue securely with your Google account.
            </p>
            <div className="mt-9">
              {googleConfigured ? (
                <form
                  action={async () => {
                    "use server";
                    await signIn("google", { redirectTo: "/app" });
                  }}
                >
                  <button
                    type="submit"
                    className="flex cursor-pointer h-11 w-full items-center justify-center gap-3 rounded-lg bg-white px-4 text-[15px] font-medium text-[#18181b] transition-colors hover:bg-[#e9e9ed]"
                  >
                    <span
                      aria-hidden="true"
                      className="font-bold text-[#4285f4]"
                    >
                      G
                    </span>
                    Continue with Google <ArrowUpRight className="ml-auto size-4 text-[#74747c]" />
                  </button>
                </form>
              ) : (
                <div className="rounded-lg border border-[#4b3829] bg-[#201914] p-4">
                  <p className="text-[15px] font-medium text-[#f1dfbe]">
                    Google sign-in needs configuration
                  </p>
                  <p className="mt-2 text-[14px] leading-5 text-[#b0a49b]">
                    Add the Auth.js secret, Google OAuth client ID, and client secret to the server
                    environment, then restart the development server.
                  </p>
                </div>
              )}
            </div>
            <div className="mt-7 flex items-start gap-2 border-t border-[#303035] pt-5 text-[13px] leading-5 text-[#85858e]">
              <LockKeyhole className="mt-0.5 size-3.5 shrink-0" />
              Auvra uses a secure server session. Signing in does not connect a wallet or authorize
              supplier spending.
            </div>
            <p className="mt-14 text-[13px] text-[#696971]">
              Development sandbox · Live purchasing disabled
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
