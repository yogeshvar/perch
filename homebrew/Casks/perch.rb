cask "perch" do
  version "0.1.0"
  sha256 "8a84272e70b7eed9b4f0b390ff061c6b98aaaf361eeb1c12fd0eff415d3bba0c"

  url "https://github.com/yogeshvar/perch/releases/download/v#{version}/Perch-#{version}-arm64.zip"
  name "Perch"
  desc "Pull-down shelf for notes, clipboard history and terminals"
  homepage "https://yogeshvar.github.io/perch/"

  livecheck do
    url :url
    strategy :github_latest
  end

  depends_on arch: :arm64
  depends_on macos: :ventura

  app "Perch.app"

  zap trash: [
    "~/Library/Application Support/Perch",
    "~/Library/Preferences/io.github.yogeshvar.perch.plist",
  ]

  caveats do
    unsigned_accessibility
    <<~EOS
      Perch is ad-hoc signed and not notarized by Apple, so macOS blocks the first launch.
      Open System Settings -> Privacy & Security and click "Open Anyway" after the first
      attempt (macOS 15 and later). On macOS 13 and 14 you can instead right-click Perch.app
      and choose Open. Or, on any version, run:

        xattr -dr com.apple.quarantine #{appdir}/Perch.app

      The scroll gesture needs Accessibility access: System Settings -> Privacy & Security ->
      Accessibility, then switch Perch on. macOS may ask for this again after an update.

      Press Command-Shift-L to open the shelf.
    EOS
  end
end
