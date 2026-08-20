import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return (
      <main className="grid min-h-screen place-items-center px-6">
        <p className="rounded-xl border p-8 text-muted-foreground">
          Clerk development configuration is required.
        </p>
      </main>
    );
  }
  return (
    <main className="grid min-h-screen place-items-center px-6">
      <SignIn signUpUrl={undefined} />
    </main>
  );
}
