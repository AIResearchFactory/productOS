# UX Specification: PWA Migration

## Summary
Standardizing the visual states for PWA integration, focusing mostly on the app installation prompt and the offline state fallback.

## Primary Flows
1. **PWA Installation**: Chrome will organically prompt desktop users. No bespoke "Install" button is necessary immediately unless requested later.
2. **Offline Fallback Flow**: If Axum server is disconnected or network goes completely down and assets are un-cached, `/offline.html` will seamlessly load.

## Screen States
- **Offline / Server Stopped**: 
  - Image: Personas Alex and Sarah looking confused in a scenic office.
  - Heading: "What did I forget in the sprint planning?"

## Handoff annotations for FE agent
Ensure `apple-mobile-web-app` elements are defined securely in the `index.html` head to ensure responsive standalone display.
