# productOS Beta Install Guide (First-Time Users)

If this is your first time installing `productOS`, your operating system may show security prompts. This is expected for unsigned beta apps.

Only proceed if you downloaded from the official release page:

- https://github.com/AIResearchFactory/productOS/releases

---

## Windows (SmartScreen / Unknown Publisher)

If Windows shows **"Windows protected your PC"**:

1. Click **More info**
2. Click **Run anyway**
3. If User Account Control appears, click **Yes**
4. Continue the installer

If Windows or antivirus still blocks launch:

5. Right-click the installer file → **Properties**
6. If you see **Unblock**, check it and click **Apply**
7. Run the installer again

---

## macOS (Gatekeeper / Unidentified Developer)

If macOS says the app cannot be opened:

### Method A: Privacy & Security

1. Try opening the app once (to trigger the block)
2. Open **System Settings** → **Privacy & Security**
3. Scroll to the Security section
4. Find the blocked app notice and click **Open Anyway**
5. Confirm launch in the next dialog

### Method B: Control-click Open

1. In Finder, locate the app
2. **Control-click** (right-click) the app
3. Click **Open**
4. In the warning dialog, click **Open**

If macOS quarantine still blocks launch, run in Terminal:

```bash
xattr -dr com.apple.quarantine "/Applications/productOS.app"
```

Then launch the app again.

---

## Troubleshooting

- Make sure you downloaded the correct artifact for your OS/architecture.
- Re-download if the file appears corrupted.
- If installation still fails, open an issue with:
  - OS version
  - exact error message
  - screenshot (if possible)

Issues page:

- https://github.com/AIResearchFactory/productOS/issues
