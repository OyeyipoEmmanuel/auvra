import Image from "next/image";
import Link from "next/link";

export function Brand({
  compact = false,
  tone = "light",
}: {
  compact?: boolean;
  tone?: "light" | "dark";
}) {
  return (
    <Link
      href="/"
      className="group inline-flex items-center gap-2"
      aria-label="Auvra home"
    >
      <span className="relative block size-8 overflow-hidden">
        <Image
          src="/auvra-brand.png"
          alt=""
          width={104}
          height={36}
          priority
          className="absolute -left-[5px] -top-[2px] h-[36px] w-[104px] max-w-none object-contain object-left mix-blend-screen"
        />
      </span>
      {!compact && (
        <span
          className={`text-[18px] font-semibold tracking-[-0.055em] ${tone === "dark" ? "text-zinc-950" : "text-white"}`}
        >
          Auvra<span className="text-[var(--brand-light)]">.</span>
        </span>
      )}
    </Link>
  );
}
