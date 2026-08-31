'use client';

import { useEffect } from 'react';

import { installShoppingOfflineNavigation } from '~/lib/meals/shopping-offline-navigation';

let reloadingForServiceWorkerUpdate = false;

export function PwaRegister() {
  useEffect(() => {
    const uninstallShoppingOffline = installShoppingOfflineNavigation();

    if (!('serviceWorker' in navigator)) {
      return () => {
        uninstallShoppingOffline();
      };
    }

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

    navigator.serviceWorker.addEventListener(
      'controllerchange',
      onControllerChange,
    );

    return () => {
      uninstallShoppingOffline();
      navigator.serviceWorker.removeEventListener(
        'controllerchange',
        onControllerChange,
      );
    };
  }, []);

  return null;
}
