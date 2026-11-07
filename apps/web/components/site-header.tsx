"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { Brand } from "@/components/brand";

const links = [
  { href: "#product", label: "Product" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#about", label: "About" },
] as const;

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className="auvra-site-header sticky top-0 z-50 border-b border-[#202024] bg-[#09090b]/95 backdrop-blur-lg">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between gap-4 px-5 sm:px-8 lg:px-12">
        <Brand />
        <nav
          aria-label="Public navigation"
          className="hidden items-center gap-8 md:flex"
        >
          {links.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-[14px] font-medium text-[#a1a1aa] transition-colors hover:text-white"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto hidden items-center gap-5 md:flex">
          <Link
            href="/login"
            className="text-[14px] font-medium text-[#a1a1aa] hover:text-white"
          >
            Sign in
          </Link>
          <Link
            href="/app/requests/new"
            className="auvra-header-cta inline-flex h-9 items-center gap-2 px-3.5 text-[14px] font-semibold transition-colors"
          >
            Get started <ArrowUpRight className="size-3.5" />
          </Link>
        </div>
        <button
          type="button"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-controls="mobile-site-nav"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          className="grid size-9 place-items-center rounded-lg border border-[#303035] text-[#dadadd] hover:bg-[#1b1b1e] md:hidden"
        >
          {open ? <X className="size-4" /> : <Menu className="size-4" />}
        </button>
      </div>
      {open && (
        <nav
          id="mobile-site-nav"
          aria-label="Mobile navigation"
          className="border-t border-[#27272a] bg-[#0f0f11] px-5 pb-5 pt-3 md:hidden"
        >
          <div className="mx-auto max-w-[1440px]">
            {links.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="block border-b border-[#222226] py-3 text-[15px] text-[#dedee2]"
              >
                {item.label}
              </Link>
            ))}
            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className="block py-3 text-[15px] text-[#dedee2]"
            >
              Sign in
            </Link>
            <Link
              href="/app/requests/new"
              onClick={() => setOpen(false)}
              className="auvra-header-cta mt-2 inline-flex h-10 items-center px-4 text-[15px] font-medium"
            >
              Get started
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
}
