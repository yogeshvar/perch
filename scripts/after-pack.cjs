// electron-builder afterPack hook: ad-hoc sign the app (there is no Developer ID).
// Runs after the .app is assembled and before it is zipped. Helper first, then the whole bundle.
const { execFileSync } = require('node:child_process')
const { chmodSync, existsSync } = require('node:fs')
const { join } = require('node:path')

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return
  const app = join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`)
  const helper = join(app, 'Contents/Resources/GestureHelper')
  if (!existsSync(helper)) throw new Error(`GestureHelper missing from the bundle: ${helper}`)
  const sign = (target, extra = []) =>
    execFileSync('codesign', ['--force', ...extra, '--sign', '-', target], { stdio: 'inherit' })
  // node-pty's prebuilt spawn-helper ships without the execute bit; its fallback path needs it.
  const prebuilt = join(app, 'Contents/Resources/app.asar.unpacked/node_modules/node-pty/prebuilds/darwin-arm64/spawn-helper')
  if (existsSync(prebuilt)) chmodSync(prebuilt, 0o755)
  sign(helper)
  sign(app, ['--deep'])
  execFileSync('codesign', ['--verify', '--deep', '--strict', '--verbose=2', app], { stdio: 'inherit' })
}
