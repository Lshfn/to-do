#!/bin/bash
set -euo pipefail
if [[ "$(uname -s)" != Darwin ]]; then
  echo 'Build Daily on macOS with Xcode Command Line Tools installed (xcode-select --install).' >&2
  exit 1
fi
project_dir="$(cd "$(dirname "$0")/.." && pwd)"
build_dir="$project_dir/macos/build"
app_dir="$build_dir/Daily.app"
mkdir -p "$app_dir/Contents/MacOS" "$app_dir/Contents/Resources"
# Build for the current Mac architecture. No package downloads are required.
xcrun swiftc -O -swift-version 5 -target "$(uname -m)-apple-macosx12.0" \
  -framework AppKit -framework WebKit \
  "$project_dir/macos/Daily.swift" -o "$app_dir/Contents/MacOS/Daily"
cp "$project_dir/macos/Info.plist" "$app_dir/Contents/Info.plist"
for asset in index.html style.css app.js; do
  cp "$project_dir/$asset" "$app_dir/Contents/Resources/$asset"
done
codesign --force --sign - "$app_dir"
/usr/bin/ditto -c -k --sequesterRsrc --keepParent "$app_dir" "$build_dir/Daily-macOS.zip"
echo "Built $app_dir"
echo "Run: open \"$app_dir\""
