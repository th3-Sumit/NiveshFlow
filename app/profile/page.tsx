import { AppShell } from "@/app/components/app-shell";
import { ProfileForm } from "@/app/components/profile/profile-form";
import { DangerZone } from "@/app/components/profile/danger-zone";
import { Card, CardContent } from "@/app/components/ui/card";
import { requireCurrentUser } from "@/app/lib/data";

type ProfileSearchParams = {
  error?: string;
  updated?: string;
};

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<ProfileSearchParams>;
}) {
  const [user, params] = await Promise.all([requireCurrentUser(), searchParams]);

  return (
    <AppShell title="Profile" user={user}>
      <section className="grid w-full min-w-0 gap-6 py-8 lg:grid-cols-[0.72fr_1.28fr]">
        <Card className="h-fit p-0">
          <CardContent className="p-7">
            <div className="flex flex-col items-center text-center">
              <div className="flex size-24 items-center justify-center overflow-hidden rounded-full border-4 border-teal-50 bg-primary text-3xl font-semibold text-white shadow-sm">
                {user.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    alt={user.name}
                    className="size-full object-cover"
                    src={user.avatarUrl}
                  />
                ) : (
                  user.name.slice(0, 1).toUpperCase()
                )}
              </div>
              <h1 className="mt-5 text-3xl font-semibold">{user.name}</h1>
              <p className="mt-2 text-sm font-bold text-slate-500">
                {user.role === "super_admin" ? "Super admin" : "Personal workspace"}
              </p>
              <div className="mt-6 grid w-full gap-3 text-left">
                <div className="rounded-3xl border border-slate-200/80 bg-white/65 p-4">
                  <p className="text-xs font-bold uppercase text-slate-400">
                    Email
                  </p>
                  <p className="mt-1 break-all font-semibold">{user.email}</p>
                </div>
                <div className="rounded-3xl border border-slate-200/80 bg-white/65 p-4">
                  <p className="text-xs font-bold uppercase text-slate-400">
                    Phone
                  </p>
                  <p className="mt-1 font-semibold">{user.phone}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <ProfileForm
          error={params.error}
          updated={Boolean(params.updated)}
          user={user}
        />
        <DangerZone protectedAccount={user.role === "super_admin"} />
      </section>
    </AppShell>
  );
}
