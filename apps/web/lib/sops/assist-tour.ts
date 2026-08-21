import type { Driver } from 'driver.js';
import 'driver.js/dist/driver.css';

export type SopAssistTourStep = {
  element?: string;
  title: string;
  description: string;
};

async function waitForElement(
  selector: string,
  attempts = 12,
  delayMs = 150,
): Promise<Element | null> {
  for (let i = 0; i < attempts; i += 1) {
    const target = document.querySelector(selector);
    if (target) return target;
    await new Promise((resolve) => window.setTimeout(resolve, delayMs));
  }
  return null;
}

/**
 * Thin driver.js helper matching ProductTour styling for dynamic SOP steps.
 * Skips highlight when element is missing or selector is unset.
 */
export async function highlightSopAssistStep(params: {
  step: SopAssistTourStep;
  onDone?: () => void;
}): Promise<Driver | null> {
  if (!params.step.element) {
    return null;
  }

  const target = await waitForElement(params.step.element);
  if (!target) {
    return null;
  }

  const { driver } = await import('driver.js');

  const driverObj = driver({
    showProgress: false,
    animate: true,
    allowClose: true,
    skipMissingElement: true,
    overlayOpacity: 0.55,
    stagePadding: 8,
    stageRadius: 10,
    popoverClass: 'ozer-driver-popover',
    nextBtnText: 'Done',
    prevBtnText: 'Back',
    doneBtnText: 'Done',
    steps: [
      {
        element: params.step.element,
        popover: {
          title: params.step.title,
          description: params.step.description,
          side: 'bottom',
          align: 'start',
          onNextClick: (_el, _step, { driver: activeDriver }) => {
            params.onDone?.();
            activeDriver.destroy();
          },
        },
      },
    ],
    onDestroyStarted: (_el, _step, { driver: activeDriver }) => {
      activeDriver.destroy();
    },
  });

  driverObj.drive();
  return driverObj;
}
