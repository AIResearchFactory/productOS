# UX Spec: Performance Optimization

## Primary User Flow
1. User opens productOS.
2. User performs tasks (chat, research).
3. Trace logs accumulate.
4. User leaves app idle.
5. App should automatically reduce background activity (e.g., lower polling frequency, stop processing logs for closed sections).

## Screen States
- **Trace Logs Section**: 
    - Capped at 500 lines per session.
    - "Show More" button to load an additional 1000 lines from history.
    - Errors and Warnings are always captured in the background and shown with a priority badge.
- **Research Log Section**:
    - Paged view (10 items per page).
    - "Load More" button at the bottom of the timeline to fetch older entries.
    - Virtualized list for large log history.
- **Idle State**: 
    - Subtle indicator if the app is in "Low Power" or "Idle" mode (optional, maybe too much for now).

## Interaction Notes
- **Log Capping**: When logs exceed the threshold, older logs are discarded from memory.
- **SSE Management**: Listeners should be detached when components are unmounted or hidden.

## UI Copy Draft
- "Logs are capped to the last 1000 entries for performance."
- "Application is currently idle. Background tasks reduced." (Optional)
