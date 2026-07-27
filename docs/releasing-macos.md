# Releasing Pi Desktop for macOS

Pi Desktop is distributed outside the Mac App Store. Every public build must be
signed with an Apple Developer ID Application certificate, notarized by Apple,
stapled, and accepted by Gatekeeper. The release scripts fail closed if any of
those checks do not pass.

## GitHub release secrets

Configure the `release` environment with:

- `MAC_CSC_LINK`: base64-encoded Developer ID Application `.p12`
- `MAC_CSC_KEY_PASSWORD`: password for that `.p12`
- `APPLE_ID`: Apple Developer account email
- `APPLE_APP_SPECIFIC_PASSWORD`: app-specific password for notarization
- `APPLE_TEAM_ID`: Apple Developer team ID

The release workflow runs for version tags. It tests the repository, builds both
the DMG installer and ZIP update payload, notarizes them, validates Gatekeeper,
uploads the assets to a draft, and only then publishes the release.

```sh
git tag v0.9.3
git push origin v0.9.3
```

## Local verification

With the same credentials available in the environment:

```sh
bun run release:mac
bun run release:verify
```

Do not upload files from `dist/release` with `gh release upload` directly.
`bun run release:assets v0.9.3` repeats the signing and notarization checks before
uploading.

The DMG is the user-facing installer. `latest-mac.yml`, the ZIP, and blockmap
files are support files used by the in-app updater; they are not alternate
installers.
