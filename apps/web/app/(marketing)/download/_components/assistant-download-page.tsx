import Link from 'next/link';

import { Download } from 'lucide-react';

import { Button } from '@kit/ui/button';

import { OZER_ASSISTANT_DOWNLOAD } from '~/lib/marketing/assistant-download';
import {
  marketingBodyText,
  marketingBtnGradient,
  marketingBtnOutline,
  marketingCard,
  marketingEyebrow,
  marketingMutedText,
} from '~/lib/marketing/marketing-ui';

export function AssistantDownloadPage() {
  const download = OZER_ASSISTANT_DOWNLOAD;

  return (
    <main className="marketing-shell relative overflow-hidden">
      <section className="relative mx-auto flex w-full max-w-3xl flex-col items-center px-6 pt-24 pb-20 text-center md:pt-28">
        <span className={marketingEyebrow}>Ozer Assistant for Mac</span>

        <h1 className="font-heading mt-6 text-4xl leading-tight font-bold text-[var(--workspace-shell-text)] md:text-5xl">
          Meeting transcription and activity on your Mac
        </h1>

        <p
          className={`mt-5 max-w-xl text-base leading-relaxed md:text-lg ${marketingBodyText}`}
        >
          Ozer Assistant records meetings, labels speakers, and turns action
          items into tasks. It also captures app and website activity on your
          Mac so you can assign studio time to clients and projects.
        </p>

        <div className="mt-8 flex flex-col items-center gap-3">
          <Button asChild size="lg" className={marketingBtnGradient}>
            <a
              href={download.latestFilePath}
              download={download.fileName}
              data-test="assistant-mac-download"
            >
              <Download className="mr-1.5 h-4 w-4" aria-hidden />
              Download for Mac
            </a>
          </Button>

          <p className={`text-sm ${marketingMutedText}`}>
            Version {download.versionLabel} · {download.requirementsLabel}
          </p>
        </div>

        <div
          className={`${marketingCard} mt-12 w-full max-w-xl space-y-4 p-6 text-left`}
        >
          <h2 className="font-heading text-lg font-semibold text-[var(--workspace-shell-text)]">
            Install
          </h2>
          <ol
            className={`list-decimal space-y-2 pl-5 text-sm leading-relaxed ${marketingBodyText}`}
          >
            <li>Download the zip and unzip it.</li>
            <li>Drag Ozer Assistant to Applications.</li>
            <li>Open the app and sign in with your Ozer account.</li>
          </ol>
          <p className={`text-sm leading-relaxed ${marketingMutedText}`}>
            Requires {download.minOs} and {download.architecture}. The build is
            notarized (Developer ID: {download.developerName},{' '}
            {download.developerTeamId}), so Gatekeeper should accept it.
          </p>
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Button asChild variant="outline" className={marketingBtnOutline}>
            <Link href="/features/desktop-assistant">Meetings</Link>
          </Button>
          <Button asChild variant="outline" className={marketingBtnOutline}>
            <Link href="/features/activity">Activity tracking</Link>
          </Button>
          <Button asChild variant="outline" className={marketingBtnOutline}>
            <Link href="/features/dictation">Dictation</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
