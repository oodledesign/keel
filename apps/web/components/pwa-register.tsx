'use client';

import { useEffect } from 'react';

let reloadingForServiceWorkerUpdate = false;

export function PwaRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    void navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        void registration.update();
      })
      .catch(() => {
        /* ignore registration errors in dev */
      });

    const onControllerChange = () => {
      if (reloadingForServiceWorkerUpdate) {
        return;
      }

      reloadingForServiceWorkerUpdate = true;
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    return () => {
      navigator.serviceWorker.removeEventListener(
        'controllerchange',
        onControllerChange,
      );
    };
  }, []);

  return null;
}
