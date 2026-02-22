#!/bin/bash
# icloud-nosync.sh — Prevent iCloud from syncing heavy build directories
# Uses macOS .nosync convention: iCloud skips any folder ending in .nosync
# A symlink from the original name ensures tools still work normally

setup_nosync() {
  local dir="$1"
  if [ -L "$dir" ]; then
    return 0  # Already a symlink, nothing to do
  elif [ -d "$dir" ]; then
    mv "$dir" "${dir}.nosync"
  else
    mkdir -p "${dir}.nosync"
  fi
  ln -s "${dir}.nosync" "$dir"
}

setup_nosync "node_modules"
setup_nosync ".next"
