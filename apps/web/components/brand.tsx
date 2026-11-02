import Image from "next/image";
import Link from "next/link";

export function Brand({ compact = false, tone = "light" }: { compact?: boolean; tone?: "light" | "dark" }) {
  return (
    <Link href="/" className="group flex items-center gap-2.5" aria-label="Auvra home">
      <span className="relative block size-9 overflow-hidden rounded-lg bg-violet-600/10">
        <Image src="/auvra-brand.png" alt="" width={112} height={38} priority className="absolute left-0 top-0 h-[38px] w-[112px] max-w-none object-contain object-left" />
      </span>
      {!compact && <span className={`text-lg font-semibold tracking-[-0.04em] ${tone === "dark" ? "text-zinc-950" : "text-white"}`}>Auvra<span className="text-violet-500">.</span></span>}
    </Link>
  );
}
