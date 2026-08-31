# Ozer Assistant Mac download

Files in this folder are served from the marketing site root
(`apps/web/public/` → `https://www.ozer.so/...`).

| File | Public URL |
|------|------------|
| `OzerAssistant-1.0.zip` | `https://www.ozer.so/downloads/OzerAssistant-1.0.zip` |
| `OzerAssistant-latest.zip` | `https://www.ozer.so/downloads/OzerAssistant-latest.zip` (redirects to the current versioned zip) |
| `appcast.xml` | `https://www.ozer.so/downloads/appcast.xml` |

## Zip

Drop the notarized Apple Silicon build at `OzerAssistant-1.0.zip` if it is
not already in the repo. When the version changes, add the new zip and point
the `OzerAssistant-latest.zip` redirect at it (see `apps/web/next.config.mjs`).

## Sparkle

`appcast.xml` is a valid empty RSS 2.0 channel titled **Ozer Assistant**.
Replace it with a real `<item>` (enclosure + `sparkle:edSignature`) after the
next notarized build. The feed is served as `application/xml` with
`Cache-Control: public, max-age=300`.

Do not commit a Sparkle private key. Do not add App Store badges here.

`/downloads/` is allowlisted as a static prefix so `app.ozer.so` does not
redirect these files to `/app`.
