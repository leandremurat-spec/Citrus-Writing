"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { changePassword, deleteAccount, updateProfile } from "@/lib/actions/auth";
import { downgradeToDrawer, openBillingPortal, startCheckout } from "@/lib/actions/billing";
import { updateWritingTargets } from "@/lib/actions/settings";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/password-rules";
import { formatPrice, perMonthCents, PLANS, type BillingInterval, type PlanId } from "@/lib/billing/plans";
import { formatNumber } from "@/lib/format";
import { legalHref, LEGAL_DOCUMENTS } from "@/content/legal";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Segmented, type SegmentedOption } from "@/components/ui/segmented";
import { CheckRow, Field, FormError, PasswordMeter } from "@/components/auth/auth-parts";
import { TitleDialog } from "@/components/binder/binder-dialogs";

/**
 * Everything about the account, on one page.
 *
 * Four cards rather than tabs: there are five things here in total, and a tab strip over five
 * short forms hides four of them to save a screenful of scrolling nobody minded. The plan card
 * comes first because it is the one that changes what the rest of the app will let you do.
 *
 * Anchors (`#plan`, `#targets`) are what the account menu links to, so a writer arriving from
 * "Writing targets" lands on the form rather than at the top of the page.
 */

const INTERVALS: SegmentedOption<BillingInterval>[] = [
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
];

export interface AccountUser {
  penName: string;
  email: string;
  plan: PlanId;
  planStatus: string;
  planRenewsAt: string | null;
  hasPassword: boolean;
  notifyStale: boolean;
  hasBillingAccount: boolean;
}

export interface AccountTargets {
  dailyGoal: number;
  sweetSpotMin: number;
  sweetSpotMax: number;
}

function Card({
  id,
  title,
  description,
  children,
  tone = "default",
}: {
  id?: string;
  title: string;
  description?: string;
  children: React.ReactNode;
  tone?: "default" | "brand" | "danger";
}) {
  return (
    <section
      id={id}
      className={cn(
        "scroll-mt-6 rounded-[2.5rem] p-6 sm:p-8",
        tone === "brand" && "bg-press-100",
        tone === "danger" && "bg-destructive/5 ring-1 ring-destructive/25",
        tone === "default" && "bg-card ring-1 ring-edge",
      )}
    >
      <h2 className={cn("font-heading text-2xl", tone === "brand" && "text-press-900")}>{title}</h2>
      {description && (
        <p className={cn("mt-2 max-w-[58ch] text-sm leading-relaxed", tone === "brand" ? "text-press-800" : "text-subtle")}>
          {description}
        </p>
      )}
      <div className="mt-5">{children}</div>
    </section>
  );
}

export function AccountSettings({
  user,
  targets,
  upgraded,
}: {
  user: AccountUser;
  targets: AccountTargets;
  /** Set when Stripe has just sent the writer back from a completed checkout. */
  upgraded: boolean;
}) {
  return (
    <div className="flex flex-col gap-4">
      {upgraded && (
        <p
          role="status"
          className="rounded-[2rem] bg-ochre-100 px-6 py-4 text-sm leading-relaxed text-ochre-900"
        >
          Thank you — your payment went through. If the plan below still says Drawer, give it a moment: the
          subscription is confirmed by Stripe, not by this page, so it lands a second or two after you do.
        </p>
      )}

      <PlanCard user={user} />
      <ProfileCard user={user} />
      <TargetsCard targets={targets} />
      <PasswordCard hasPassword={user.hasPassword} />
      <DangerCard email={user.email} />
      <LegalRow />
    </div>
  );
}

/**
 * The three documents, at the foot of the one page a signed-in writer visits about their
 * account rather than their manuscript.
 *
 * The marketing footer carries them too, but a writer inside the app never sees that footer —
 * and this is the page they are on when the questions those documents answer actually occur to
 * them: what am I being charged, what happens if I stop, what have you got of mine. Quiet, and
 * not in a card, because it is a signpost rather than a setting.
 */
function LegalRow() {
  return (
    <nav aria-label="Legal" className="flex flex-wrap items-center gap-x-6 gap-y-2 px-6 pt-1 pb-2 text-2xs text-subtle sm:px-8">
      {/* `doc`, not `document`: this is a client component, and the global is a real thing here. */}
      {LEGAL_DOCUMENTS.map((doc) => (
        <Link
          key={doc.slug}
          href={legalHref(doc.slug)}
          className="focus-ring rounded-full text-press transition-colors duration-tint ease-state hover:text-press-800"
        >
          {doc.title}
        </Link>
      ))}
    </nav>
  );
}

// ------------------------------------------------------------------- plan ---

function PlanCard({ user }: { user: AccountUser }) {
  const router = useRouter();
  const [interval, setInterval] = React.useState<BillingInterval>("yearly");
  const [pending, setPending] = React.useState(false);
  const plan = PLANS[user.plan];
  const serial = user.plan === "SERIAL";

  const renews = user.planRenewsAt ? new Date(user.planRenewsAt) : null;

  const upgrade = async () => {
    setPending(true);
    const response = await startCheckout({ interval });
    if (!response.ok) {
      toast.error(response.error);
      setPending(false);
      return;
    }
    if (response.kind === "redirect") {
      window.location.href = response.url;
      return;
    }
    toast.success("You are on Serial.", { description: "No payment provider is configured, so nothing was charged." });
    setPending(false);
    router.refresh();
  };

  const portal = async () => {
    setPending(true);
    const response = await openBillingPortal();
    setPending(false);
    if (!response.ok) {
      toast.error(response.error);
      return;
    }
    window.location.href = response.url;
  };

  const downgrade = async () => {
    setPending(true);
    const response = await downgradeToDrawer();
    setPending(false);
    if (!response.ok) {
      toast.error(response.error);
      return;
    }
    toast.success("Back on Drawer. Nothing was deleted.");
    router.refresh();
  };

  return (
    <Card
      id="plan"
      tone={serial ? "brand" : "default"}
      title={plan.name + " plan"}
      description={
        serial
          ? user.planStatus === "PAST_DUE"
            ? "Your last payment did not go through. Serial stays on while the card is retried — update it from the billing portal."
            : renews
              ? "Renews " + renews.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) + "."
              : "Unlimited serials, the buffer, codex ties and whole-serial export."
          : "One serial, the whole writing surface, twenty versions a chapter and chapter export. Serial adds the buffer, scheduling, codex ties and arc export."
      }
    >
      {serial ? (
        <div className="flex flex-wrap gap-2.5">
          {user.hasBillingAccount ? (
            <Button disabled={pending} onClick={() => void portal()} className="h-10">
              Manage billing <ExternalLink />
            </Button>
          ) : (
            <Button variant="outline" disabled={pending} onClick={() => void downgrade()} className="h-10">
              Switch back to Drawer
            </Button>
          )}
          <Button variant="ghost" render={<Link href="/pricing" />} nativeButton={false} className="h-10">
            Compare the plans
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2.5">
          <Segmented size="sm" label="Billing interval" options={INTERVALS} value={interval} onChange={setInterval} />
          <Button disabled={pending} onClick={() => void upgrade()} className="h-10">
            <Sparkles />
            {pending
              ? "Opening checkout…"
              : "Upgrade — " + formatPrice(perMonthCents("SERIAL", interval)) + " a month"}
          </Button>
        </div>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------- profile ---

function ProfileCard({ user }: { user: AccountUser }) {
  const router = useRouter();
  const [penName, setPenName] = React.useState(user.penName);
  const [email, setEmail] = React.useState(user.email);
  const [notifyStale, setNotifyStale] = React.useState(user.notifyStale);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  const dirty = penName !== user.penName || email !== user.email || notifyStale !== user.notifyStale;

  return (
    <Card title="Who you are" description="Your pen name goes on exports. Nothing here is shown to anyone else.">
      <form
        className="flex max-w-lg flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (pending || !dirty) return;
          setPending(true);
          setError(null);
          void (async () => {
            const response = await updateProfile({ penName, email, notifyStale });
            setPending(false);
            if (!response.ok) {
              setError(response.error);
              return;
            }
            toast.success("Saved.");
            router.refresh();
          })();
        }}
      >
        <Field
          id="cw-acc-name"
          label="Pen name"
          type="text"
          autoComplete="nickname"
          required
          value={penName}
          onChange={(event) => setPenName(event.target.value)}
        />
        <Field
          id="cw-acc-email"
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <CheckRow id="cw-acc-notify" checked={notifyStale} onChange={setNotifyStale}>
          Email me when a chapter has sat untouched for too long. Nothing else, ever.
        </CheckRow>
        <FormError message={error} />
        <Button type="submit" disabled={pending || !dirty} className="h-10 self-start">
          {pending ? "Saving…" : "Save"}
        </Button>
      </form>
    </Card>
  );
}

// ---------------------------------------------------------------- targets ---

function TargetsCard({ targets }: { targets: AccountTargets }) {
  const router = useRouter();
  const [dailyGoal, setDailyGoal] = React.useState(String(targets.dailyGoal));
  const [min, setMin] = React.useState(String(targets.sweetSpotMin));
  const [max, setMax] = React.useState(String(targets.sweetSpotMax));
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  return (
    <Card
      id="targets"
      title="Writing targets"
      description="The daily goal drives the streak; the sweet spot is the band the chapter footer measures against. Both follow your account, not this device."
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (pending) return;
          setPending(true);
          setError(null);
          void (async () => {
            const response = await updateWritingTargets({
              dailyGoal: Number(dailyGoal),
              sweetSpotMin: Number(min),
              sweetSpotMax: Number(max),
            });
            setPending(false);
            if (!response.ok) {
              setError(response.error);
              return;
            }
            toast.success("Targets saved.");
            router.refresh();
          })();
        }}
      >
        <div className="grid max-w-lg gap-4 sm:grid-cols-3">
          <Field
            id="cw-goal"
            label="Daily goal"
            type="number"
            min={0}
            max={50000}
            step={50}
            required
            value={dailyGoal}
            onChange={(event) => setDailyGoal(event.target.value)}
          />
          <Field
            id="cw-spot-min"
            label="Sweet spot from"
            type="number"
            min={0}
            max={50000}
            step={100}
            required
            value={min}
            onChange={(event) => setMin(event.target.value)}
          />
          <Field
            id="cw-spot-max"
            label="…to"
            type="number"
            min={0}
            max={50000}
            step={100}
            required
            value={max}
            onChange={(event) => setMax(event.target.value)}
          />
        </div>
        <p className="text-2xs text-subtle">
          A chapter between {formatNumber(Number(min) || 0)} and {formatNumber(Number(max) || 0)} words reads as in the
          band.
        </p>
        <FormError message={error} />
        <Button type="submit" disabled={pending} className="h-10 self-start">
          {pending ? "Saving…" : "Save targets"}
        </Button>
      </form>
    </Card>
  );
}

// --------------------------------------------------------------- password ---

function PasswordCard({ hasPassword }: { hasPassword: boolean }) {
  const [current, setCurrent] = React.useState("");
  const [next, setNext] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  return (
    <Card
      title={hasPassword ? "Change your password" : "Set a password"}
      description={
        hasPassword
          ? "Changing it signs out every other browser you are signed in on. This one stays."
          : "You signed up with a provider, so there is no password on this account yet. Setting one gives you a second way in."
      }
    >
      <form
        className="flex max-w-lg flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (pending) return;
          setPending(true);
          setError(null);
          void (async () => {
            const response = await changePassword({ currentPassword: current, newPassword: next });
            setPending(false);
            if (!response.ok) {
              setError(response.error);
              return;
            }
            setCurrent("");
            setNext("");
            toast.success(hasPassword ? "Password changed." : "Password set.");
          })();
        }}
      >
        {hasPassword && (
          <Field
            id="cw-pass-current"
            label="Current password"
            type="password"
            autoComplete="current-password"
            required
            value={current}
            onChange={(event) => setCurrent(event.target.value)}
          />
        )}
        <Field
          id="cw-pass-next"
          label="New password"
          type="password"
          autoComplete="new-password"
          placeholder={"At least " + MIN_PASSWORD_LENGTH + " characters"}
          required
          minLength={MIN_PASSWORD_LENGTH}
          value={next}
          onChange={(event) => setNext(event.target.value)}
        >
          <PasswordMeter value={next} />
        </Field>
        <FormError message={error} />
        <Button type="submit" disabled={pending} className="h-10 self-start">
          {pending ? "Saving…" : hasPassword ? "Change password" : "Set password"}
        </Button>
      </form>
    </Card>
  );
}

// ----------------------------------------------------------------- danger ---

function DangerCard({ email }: { email: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);

  return (
    <Card
      tone="danger"
      title="Delete your account"
      description="Every serial, chapter, version and codex entry goes with it, and none of it can be recovered. Export anything you want to keep first."
    >
      <Button variant="destructive" className="h-10" onClick={() => setOpen(true)}>
        Delete account
      </Button>

      {/*
        The same one-field confirmation `deleteNovel` uses, for a strictly worse outcome: a
        novel at least has snapshots behind it, and this takes the snapshots too. Typing the
        address is checked on the server — a dialog that can be clicked through is not a
        confirmation.
      */}
      <TitleDialog
        open={open}
        onOpenChange={setOpen}
        heading="Delete your account"
        description={"This cannot be undone. Type " + email + " to confirm."}
        label="Email"
        initialValue=""
        submitLabel="Delete everything"
        onSubmit={async (value) => {
          const response = await deleteAccount({ confirmEmail: value });
          if (!response.ok) {
            toast.error(response.error);
            return false;
          }
          router.replace("/");
          router.refresh();
        }}
      />
    </Card>
  );
}
