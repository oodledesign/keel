'use client';

import { useState } from 'react';

import { useRouter } from 'next/navigation';

import { Button } from '@kit/ui/button';
import { Spinner } from '@kit/ui/spinner';

export function OpenPortalButton(props: { href: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  return (
    <Button
      disabled={pending}
      onClick={() => {
        setPending(true);
        router.push(props.href);
      }}
    >
      {pending ? (
        <>
          <Spinner className="mr-2 size-4 text-current" />
          Loading portal…
        </>
      ) : (
        'Open portal'
      )}
    </Button>
  );
}
