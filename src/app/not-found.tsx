import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="label-section">404</p>
      <h1 className="font-serif text-2xl font-semibold">That page drifted out with the tide.</h1>
      <Link href="/" className="focus-ring rounded-sm text-sm text-press underline-offset-4 hover:underline">
        Back to your binder
      </Link>
    </main>
  );
}
