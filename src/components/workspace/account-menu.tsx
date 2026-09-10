"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, Settings, Sparkles, User } from "lucide-react";
import { toast } from "sonner";

import { signOut } from "@/lib/actions/auth";
import { PLANS, type PlanId } from "@/lib/billing/plans";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Who is signed in, and the way out.
 *
 * One component for both the Library's own bar and the workspace header, because the two
 * disagreeing about where "Sign out" lives would be a small, constant annoyance. The trigger
 * is the writer's initials rather than an avatar: there is no image to upload in this app, and
 * a generic silhouette says less than two letters do.
 */

export interface AccountMenuUser {
  penName: string;
  email: string;
  plan: PlanId;
}

/** "Wren Ashcombe" → "WA"; "wren" → "WR". Two letters, always, so the circle never jumps. */
function initials(penName: string): string {
  const words = penName.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "??";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

export function AccountMenu({ user, className }: { user: AccountMenuUser; className?: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [signingOut, setSigningOut] = React.useState(false);

  const plan = PLANS[user.plan];

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={"Account — signed in as " + user.penName}
            className={cn(
              "size-8 bg-press-100 font-semibold text-press-800 hover:bg-press-200 hover:text-press-900",
              className,
            )}
          />
        }
      >
        <span className="text-2xs">{initials(user.penName)}</span>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex flex-col gap-0.5">
            <span className="truncate text-sm font-medium text-foreground">{user.penName}</span>
            <span className="truncate text-2xs font-normal text-subtle">{user.email}</span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          <DropdownMenuItem render={<Link href="/account" />}>
            <User />
            Account
          </DropdownMenuItem>
          <DropdownMenuItem render={<Link href="/account#targets" />}>
            <Settings />
            Writing targets
          </DropdownMenuItem>
          <DropdownMenuItem render={<Link href={user.plan === "SERIAL" ? "/account#plan" : "/pricing"} />}>
            <Sparkles />
            <span className="flex-1">{plan.name} plan</span>
            {user.plan === "DRAWER" && <span className="text-3xs text-press">Upgrade</span>}
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          <DropdownMenuItem
            disabled={signingOut}
            onClick={() => {
              setSigningOut(true);
              void (async () => {
                const response = await signOut();
                if (!response.ok) {
                  toast.error(response.error);
                  setSigningOut(false);
                  return;
                }
                // replace, not push: the workspace this writer just left must not be one Back
                // press away, and there is nothing behind them worth returning to.
                router.replace("/");
                router.refresh();
              })();
            }}
          >
            <LogOut />
            {signingOut ? "Signing out…" : "Sign out"}
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
