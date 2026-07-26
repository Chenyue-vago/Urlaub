export interface AuthIdentity {
  clerkId: string;
  email: string;
}

export interface Authenticator {
  authenticate(bearerToken: string): Promise<AuthIdentity>;
}
