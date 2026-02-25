# Application Update Task Plan

This document outlines the implementation and testing plan for the productOS update mechanism.

## 1. Configuration (`tauri.conf.json`)
- [x] **Enable Updater**: Ensure `plugins > updater > active` is set to `true`.
- [x] **Endpoint**: Set `endpoints` to point to the `latest.json` file in GitHub releases.
    - Current: `https://github.com/AssafMiron/ai-researcher/releases/latest/download/latest.json`
- [x] **Security**: Configure `pubkey` for signature verification of update bundles.

## 2. User Interface (Frontend)
- [x] **"About" Section**: A dedicated section in Global Settings.
    - Display current version using `@tauri-apps/api/app`.
    - "Check for Updates" manual button.
    - Display release notes (body) from the update metadata.
- [x] **Background Notifications**: Listen for `update-available` events from the backend.
    - Show a toast notification when an update is detected in the background.
    - Provide a quick link or instruction to the About section.
- [x] **Interactive Update Flow**:
    - "Update and Relaunch" button.
    - Progress indicator (percentage) during download.
    - Error messages for failed checks or installations.

## 3. Backend Logic (Rust)
- [x] **Periodic Check**: Background loop in `lib.rs` that checks for updates every 12 hours.
- [x] **Event Emission**: Emit `update-available` event whenever a new version is found.
- [x] **Integrity & Preservation**: (Existing) Logic in `UpdateManager` to preserve user data and verify installation integrity.

## 4. Download and Installation
- [x] **Standard Tauri Flow**: Use `@tauri-apps/plugin-updater`'s `downloadAndInstall()` which handles:
    - Downloading the appropriate bundle (DMG, AppImage, MSI, etc.)
    - Verifying the signature.
    - Preparing the update for the next launch.
- [x] **Relaunch**: Use `@tauri-apps/plugin-process`'s `relaunch()` to apply the update immediately.

## 5. Error Handling
- [x] **Network Failures**: Catch and display errors if the update server is unreachable.
- [x] **Signature Mismatch**: Tauri handles this internally; UI should display the failure.
- [x] **Retry Logic**: manual "Check Now" allows users to retry if a background check failed.

## 6. Testing Procedure (Manual)
To verify the mechanism works without a real release:
1. **Mock Update Server**: Set up a local HTTP server serving a `latest.json` with a version higher than the current `Cargo.toml`.
2. **Signature Verification**: Ensure the `pubkey` in `tauri.conf.json` matches the private key used to sign the mock update.
3. **Manual Check**: Go to Settings > About and click "Check Now".
4. **Download Simulation**: Observe the progress bar as the mock bundle downloads.
5. **Relaunch**: Verify the app restarts and shows the "new" version number.
