import Link from 'next/link';

import { BookShell } from './_components/book-shell';

export default function BookNotFound() {
  return (
    <BookShell title="Booking not found" description={null}>
      <div className="rounded-2xl border border-black/10 bg-white p-8 text-center">
        <p className="font-medium">This scheduling link is unavailable.</p>
        <p className="mt-2 text-sm text-[color:var(--ozer-text-muted,#6B5B63)]">
          It may have been turned off, or the address may be incorrect.
        </p>
        <p className="mt-6">
          <Link href="https://ozer.so" className="underline-offset-2 hover:underline">
            Go to ozer.so
          </Link>
        </p>
      </div>
    </BookShell>
  );
}
