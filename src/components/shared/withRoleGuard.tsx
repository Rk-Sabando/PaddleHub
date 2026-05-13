"use client";

import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import type { ComponentType} from "react";
import { useEffect } from "react";
import type { Role } from "@prisma/client";

type WithRoleGuardOptions = {
  fallback?: React.ReactNode;
  redirectTo?: string;
};

export function withRoleGuard<P extends object>(
  Component: ComponentType<P>,
  allowedRoles: Role[],
  options: WithRoleGuardOptions = {},
) {
  const { fallback = null, redirectTo = "/" } = options;

  return function GuardedComponent(props: P) {
    const { isLoaded, isSignedIn, user } = useUser();
    const router = useRouter();

    const role = (user?.publicMetadata?.role ?? null) as Role | null;
    const isAllowed = role !== null && allowedRoles.includes(role);

    useEffect(() => {
      if (!isLoaded) return;
      if (!isSignedIn || !isAllowed) router.replace(redirectTo);
    }, [isLoaded, isSignedIn, isAllowed, router]);

    if (!isLoaded || !isSignedIn || !isAllowed) return <>{fallback}</>;
    return <Component {...props} />;
  };
}
