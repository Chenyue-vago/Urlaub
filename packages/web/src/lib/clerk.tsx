import type { ReactNode } from "react";
import { ClerkProvider, SignedIn, SignedOut, SignIn } from "@clerk/clerk-react";

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

/**
 * Wraps children in Clerk's provider. Mounted at the app root in main.tsx.
 */
export function ClerkProviderWrapper({ children }: { children: ReactNode }) {
  // The app is served under Vite's BASE_URL ('/Urlaub/' on GitHub Pages, '/' in
  // dev). Point Clerk's post-auth redirects there; otherwise it defaults to '/'
  // and lands outside the deployed subpath (a 404 on Pages).
  const base = import.meta.env.BASE_URL;
  return (
    <ClerkProvider
      publishableKey={publishableKey}
      signInFallbackRedirectUrl={base}
      signUpFallbackRedirectUrl={base}
      afterSignOutUrl={base}
    >
      {children}
    </ClerkProvider>
  );
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
