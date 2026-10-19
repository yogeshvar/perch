# Releasing Perch

Perch ships as an Apple-Silicon `.zip` on GitHub Releases, installed through a Homebrew tap.

- App repo: `yogeshvar/perch`
- Tap repo: `yogeshvar/homebrew-perch` (the cask lives at `Casks/perch.rb`; the copy in `homebrew/Casks/perch.rb` here is the template)

## Cut a release

1. Bump `version` in `package.json` (the zip name, the cask URL and the tag all derive from it).
2. Make sure the checks are green: `npm run typecheck && npm run test:coverage`.
3. Build the zip:

   ```sh
   npm run package
   ```

   This builds the UI, compiles `native/bin/GestureHelper` fresh (arm64, macOS 13+; it fails loudly if `swiftc` is missing),
   runs electron-builder, ad-hoc signs the helper and the app (`scripts/after-pack.cjs`), and prints the zip path, size and SHA-256.
   Output: `release/Perch-<version>-arm64.zip`. `npm run package:dir` builds only `release/mac-arm64/Perch.app`, which is faster for testing.
4. Smoke-test the unpacked zip before publishing. Unzip it somewhere under `/private/tmp` (not `/Applications`), then:

   ```sh
   codesign --verify --deep --strict --verbose=2 Perch.app
   Perch.app/Contents/MacOS/Perch --user-data-dir=/private/tmp/perch-smoke &
   # after ~8 s: /private/tmp/perch-smoke/perch.db exists and `pgrep -fl GestureHelper` shows a child
   ```
5. Create the GitHub release with the tag `vX.Y.Z` and attach the zip:

   ```sh
   gh release create vX.Y.Z release/Perch-X.Y.Z-arm64.zip --title "Perch X.Y.Z" --notes "..."
   ```
6. In the tap repo, edit `Casks/perch.rb`: set `version` and `sha256` (the SHA-256 printed by `npm run package`;
   re-check it against the uploaded asset with `shasum -a 256`). Keep `homebrew/Casks/perch.rb` in this repo in sync.
7. Test the install from the tap, then push the tap:

   ```sh
   brew style --cask yogeshvar/perch/perch
   brew install --cask yogeshvar/perch/perch
   brew uninstall --cask --zap perch
   ```

Users install with `brew install --cask yogeshvar/perch/perch`.

## Signing and notarization

There is no Apple Developer ID, so the app is **ad-hoc signed only** (`codesign --sign -`) and **not notarized**.
Consequences:

- Gatekeeper blocks the first launch of a downloaded copy. On macOS 15 and later: try to open it once, then System Settings,
  Privacy & Security, "Open Anyway". Older macOS: right-click the app and choose Open. Or run `xattr -dr com.apple.quarantine /Applications/Perch.app`.
  The cask's caveats say this; the cask does not strip quarantine itself.
- The cask would be rejected by the official `homebrew/cask` tap, which requires Gatekeeper-passing, notarized apps
  (`brew audit --cask --new` reports "Signature verification failed"). It is fine in a third-party tap.
- The ad-hoc signature changes with every build, so macOS treats each update as a new app and the **Accessibility permission
  (needed for the scroll gesture) has to be granted again after updating**. A stable Developer ID signature fixes this.

To notarize later:

1. Join the Apple Developer Program and create a "Developer ID Application" certificate.
2. In `package.json` `build.mac`, remove `identity: null`, set `hardenedRuntime: true` and an entitlements file
   (Electron needs `com.apple.security.cs.allow-jit` and `allow-unsigned-executable-memory`; node-pty and better-sqlite3 are
   loaded from `app.asar.unpacked`, so they must be signed too). Replace the ad-hoc `afterPack` hook with electron-builder's own signing,
   and sign `GestureHelper` with the same identity and `--options runtime`.
3. Store notarization credentials with `xcrun notarytool store-credentials`, then notarize and staple
   (`mac.notarize: true` with `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID` in the environment, or run `xcrun notarytool submit ... --wait` and `xcrun stapler staple Perch.app` yourself before zipping).
4. Drop the quarantine instructions from the cask caveats.

## Apple Silicon only

The zip is arm64 only: `GestureHelper` is compiled with `-target arm64-apple-macos13.0` and electron-builder targets `arm64`, and the cask says `depends_on arch: :arm64`.
The minimum macOS is 13 (Ventura), which is Electron 44's own minimum.
An Intel build would need: an `x64` (or `universal`) target in `build.mac.target`, a helper built for `x86_64` (or `lipo`-merged),
native modules rebuilt for x64 (`node-pty` and `better-sqlite3` both ship x64 prebuilds), a second zip named `Perch-<version>-x64.zip`,
and a cask with `on_arm` / `on_intel` blocks (separate `url` and `sha256`) in place of `depends_on arch: :arm64`.
