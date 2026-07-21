import type { ReactNode } from "react";
import { ClerkProvider, RedirectToSignIn, SignedIn, SignedOut } from "@clerk/clerk-react";

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

/**
 * Wraps children in Clerk's provider. Not mounted into main.tsx yet —
 * Milestone 7 wires this into the app entry point.
 */
export function ClerkProviderWrapper({ children }: { children: ReactNode }) {
  return <ClerkProvider publishableKey={publishableKey}>{children}</ClerkProvider>;
}

/**
 * Gates children so they only render while signed in; otherwise redirects
 * to Clerk's sign-in flow. Not mounted anywhere yet — ready for Milestone 7.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  return (
    <>
      <SignedIn>{children}</SignedIn>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
    </>
  );
}
