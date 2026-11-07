import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

import { prisma } from "@/lib/prisma";

const googleConfigured = Boolean(
  process.env.AUTH_SECRET && process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET,
);

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: googleConfigured ? [Google] : [],
  pages: { signIn: "/login" },
  session: { strategy: "database" },
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider !== "google") return false;
      return Boolean(profile?.sub && profile.email_verified);
    },
    async session({ session, user }) {
      session.user.id = user.id;
      session.user.role = user.role;
      return session;
    },
  },
});
