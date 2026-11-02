import Link from "next/link";
import { ArrowLeft, LockKeyhole } from "lucide-react";

import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { signIn } from "@/auth";

export default function Login() {
  const googleConfigured = Boolean(process.env.AUTH_SECRET && process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);

  return (
    <main className="violet-haze grid min-h-screen place-items-center px-5 py-12">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl border border-white/[.09] bg-[#101012] shadow-2xl shadow-black/50 lg:grid-cols-[1.05fr_.95fr]">
        <div className="relative hidden min-h-[620px] border-r border-white/[.08] p-10 lg:block"><div className="grid-noise absolute inset-0"/><div className="relative"><Brand/><div className="mt-36"><p className="font-mono text-xs uppercase tracking-[.18em] text-violet-300">Controlled autonomy</p><h1 className="mt-6 text-6xl leading-[.94] tracking-[-.065em]">Your outcomes.<br/><span className="text-zinc-600">Handled end to end.</span></h1><p className="mt-7 max-w-md text-sm leading-7 text-zinc-500">One secure identity for your briefs, approvals, reports, and operating history.</p></div></div></div>
        <div className="flex min-h-[560px] items-center p-7 sm:p-12"><div className="w-full"><Link href="/" className="inline-flex items-center gap-2 text-xs text-zinc-600 hover:text-white"><ArrowLeft className="size-3.5"/>Back to Auvra</Link><h2 className="mt-12 text-3xl font-medium tracking-[-.045em]">Welcome to Auvra.</h2><p className="mt-3 text-sm leading-6 text-zinc-500">Sign in to request services, approve quotes, and follow every outcome through delivery.</p><Card className="mt-8 p-4">{googleConfigured ? <form action={async () => { "use server"; await signIn("google", { redirectTo: "/app" }); }}><Button type="submit" size="lg" className="w-full"><span className="grid size-5 place-items-center rounded-full bg-white font-bold text-[#4285F4]">G</span>Continue with Google</Button></form> : <div className="rounded-xl border border-amber-300/15 bg-amber-300/[.05] p-4"><p className="text-sm font-medium text-amber-200">Google sign-in needs configuration</p><p className="mt-2 text-xs leading-5 text-zinc-500">Add Auvra&apos;s Auth.js secret, Google OAuth client ID, and Google OAuth client secret to <code className="text-zinc-300">.env.local</code>, then restart the development server.</p></div>}</Card><p className="mt-6 flex items-center justify-center gap-2 text-center text-[11px] leading-5 text-zinc-700"><LockKeyhole className="size-3.5"/>Secure server-issued session. No password stored by Auvra.</p></div></div>
      </div>
    </main>
  );
}
