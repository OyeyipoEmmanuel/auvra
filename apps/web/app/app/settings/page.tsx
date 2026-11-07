import { signOut } from "@/auth";
import { WorkspaceHeader } from "@/components/workspace-ui";
import { Button } from "@/components/ui/button";
import { requirePageUser } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export default async function SettingsPage() {
  const sessionUser = await requirePageUser();
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: sessionUser.id },
    select: {
      name: true,
      email: true,
      role: true,
      accounts: { select: { provider: true, providerAccountId: true } },
    },
  });
  return (
    <main className="mx-auto max-w-[900px] px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
      <WorkspaceHeader
        title="Settings"
        description="Your account and the controls available in this workspace."
      />
      <div className="mt-8 divide-y divide-[var(--ws-border)] border-y border-[var(--ws-border)]">
        <SettingRow
          label="Name"
          value={user.name || "Not provided"}
        />
        <SettingRow
          label="Email"
          value={user.email || "Not provided"}
        />
        <SettingRow
          label="Access"
          value={user.role.toLowerCase()}
        />
        <SettingRow
          label="Sign-in provider"
          value={user.accounts.map((account) => account.provider).join(", ") || "Not linked"}
        />
      </div>
      <section className="mt-10">
        <h2 className="text-[15px] font-semibold">Connected services</h2>
        <p className="mt-1 text-[14px] text-[#92929b]">
          Auvra keeps customer sign-in separate from marketplace buyer access.
        </p>
        <div className="mt-4 divide-y divide-[var(--ws-border)] rounded-lg border border-[var(--ws-border)]">
          <SettingRow
            label="NEAR wallet"
            value="Not linked"
          />
          <SettingRow
            label="Marketplace purchasing"
            value="Disabled in development sandbox"
          />
        </div>
      </section>
      <section className="mt-10">
        <h2 className="text-[15px] font-semibold">Treasury and notifications</h2>
        <p className="mt-2 text-[14px] leading-5 text-[#92929b]">
          Spend policies, approval thresholds, and notification preferences will become editable
          when their server-side controls are implemented. No settings are implied by this screen.
        </p>
      </section>
      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/" });
        }}
        className="mt-10 border-t border-[var(--ws-border)] pt-6"
      >
        <Button
          type="submit"
          variant="outline"
          size="sm"
        >
          Sign out
        </Button>
      </form>
    </main>
  );
}

function SettingRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 px-4 py-4 text-[14px] sm:grid-cols-[180px_1fr] sm:items-center">
      <span className="text-[#85858e]">{label}</span>
      <span className="break-all capitalize text-[#e4e4e7]">{value}</span>
    </div>
  );
}
