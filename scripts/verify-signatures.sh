#!/bin/bash

# verify-signatures.sh
# Verifies Minisign signatures for release assets (.dmg, .app.tar.gz, etc)
# Usage: ./scripts/verify-signatures.sh [path/to/release/dir]

echo "🔒 Verifying release signatures..."

TARGET_DIR=${1:-"src-tauri/target/release/bundle"}
PUB_KEY=${TAURI_SIGNING_PUBLIC_KEY:-""}

if [ ! -d "$TARGET_DIR" ]; then
    echo "⚠️ Directory $TARGET_DIR does not exist. Skipping signature verification."
    exit 0
fi

# Check if minisign is installed
if ! command -v minisign &> /dev/null; then
    echo "⚠️ minisign could not be found. Please install it to verify signatures locally."
    echo "   macOS: brew install minisign"
    echo "   Linux: apt install minisign / pacman -S minisign"
    exit 0
fi

if [ -z "$PUB_KEY" ]; then
    echo "⚠️ TAURI_SIGNING_PUBLIC_KEY env var not set. Cannot mathematically verify signatures."
    echo "   Will only check if .sig files are generated."
    
    SIG_COUNT=$(find "$TARGET_DIR" -name "*.sig" | wc -l)
    if [ "$SIG_COUNT" -gt 0 ]; then
        echo "✅ Found $SIG_COUNT signature files. Generation works, but verification skipped due to missing public key."
        exit 0
    else
        echo "❌ No .sig files found in $TARGET_DIR!"
        exit 1
    fi
fi

# Verify each .sig file against its corresponding target file
FAIL_COUNT=0
SUCCESS_COUNT=0

for SIG_FILE in $(find "$TARGET_DIR" -name "*.sig"); do
    TARGET_FILE="${SIG_FILE%.sig}"
    
    if [ ! -f "$TARGET_FILE" ]; then
        echo "⚠️ Target file $TARGET_FILE not found for signature $SIG_FILE"
        continue
    fi
    
    echo "Verifying $TARGET_FILE..."
    if minisign -V -H -P "$PUB_KEY" -x "$SIG_FILE" -m "$TARGET_FILE"; then
        echo "✅ $TARGET_FILE verification passed."
        SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
    else
        echo "❌ $TARGET_FILE verification FAILED."
        FAIL_COUNT=$((FAIL_COUNT + 1))
    fi
done

if [ $FAIL_COUNT -gt 0 ]; then
    echo "❌ $FAIL_COUNT signatures failed verification!"
    exit 1
elif [ $SUCCESS_COUNT -eq 0 ]; then
    echo "⚠️ No signatures found to verify."
    exit 0
else
    echo "✅ All $SUCCESS_COUNT signatures verified successfully!"
    exit 0
fi
