import type { ReactNode } from "react";
import { ClerkProvider, SignedIn, SignedOut, SignIn } from "@clerk/clerk-react";

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

/**
 * Wraps children in Clerk's provider. Mounted at the app root in main.tsx.
 */
export function ClerkProviderWrapper({ children }: { children: ReactNode }) {
  return <ClerkProvider publishableKey={publishableKey}>{children}</ClerkProvider>;
}

/**
 * Gates children so they only render while signed in; otherwise shows
 * Clerk's own <SignIn/> UI centered on the page (this is a single-page app
 * with no separate /sign-in route).
 */
export function AuthGate({ children }: { children: ReactNode }) {
  return (
    <>
      <SignedIn>{children}</SignedIn>
      <SignedOut>
        <div className="auth-gate">
          <SignIn routing="hash" />
        </div>
      </SignedOut>
    </>
  );
}
