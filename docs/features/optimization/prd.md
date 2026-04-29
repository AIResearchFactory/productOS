# PRD: Application Performance Optimization (Idle Usage)

## Problem Statement
The application (productOS) consumes excessive CPU (up to 30%+) and Memory (600MB+) even when idle. This leads to system-wide lag and a poor user experience, especially when used as a PWA.

## User Persona
Assaf (Developer/Researcher) using the app for long periods, often leaving it open in the background.

## Success Metrics
- CPU usage < 5% when idle (backgrounded/no active tasks).
- Memory usage stabilized below 300MB for typical idle sessions.
- No system lag caused by the app when idle.

## User Stories
- As a user, I want the app to consume minimal resources when I'm not actively interacting with it, so my computer remains responsive.
- As a user, I want trace logs to be managed efficiently so they don't consume infinite memory over time.
- As a developer, I want background services (like workflow scheduling) to be lightweight and non-intrusive.

## Scope
### In-Scope
- Investigating and fixing resource leaks in the frontend (React).
- Optimizing SSE (Server-Sent Events) consumption and management.
- Capping and optimizing trace log storage in the UI.
- Reviewing backend background services for unnecessary overhead.
- Service worker optimization for PWA mode.

### Out-of-Scope
- Major architectural changes to the AI provider system (unless identified as the root cause).
- UI/UX redesign (unless needed for performance feedback).

## Acceptance Criteria
- [ ] Application CPU usage drops below 5% when idle for 5 minutes.
- [ ] Application memory usage does not grow indefinitely over time when idle.
- [ ] **Trace Logs**: Capped at 500 entries per session; Errors/Warnings always tracked; Info logs only tracked when panel is open.
- [ ] **Research Log**: Implements paging (chunks of 10); ensures recent entries (3-5) are always visible on load.
- [ ] SSE connections are consolidated into the `SharedEventSource` multiplexer.
- [ ] Background workflow scheduler tick interval increased to 60s.


## Edge Cases
- Many projects (>100) causing expensive disk scans.
- Flooding of trace logs from a long-running agent session.
- Browser tab suspension/hibernation affecting SSE stability.

## Dependencies
- `SharedEventSource` singleton in the frontend.
- `WorkflowSchedulerService` in the backend.
- `vite-plugin-pwa` configuration.

## Prioritized Implementation Slices
1. **MVP (Slice 1)**: Cap trace logs and optimize rendering. Ensure `TraceLogs` component doesn't process logs when not needed.
2. **Slice 2**: Review and optimize backend background tasks (scheduler, disk I/O).
3. **Slice 3**: Consolidate SSE connections (move trace logs to `SharedEventSource`).
4. **V2 (Slice 4)**: Implement PWA-specific optimizations (e.g., service worker caching strategies).

## API/Contract Assumptions
- Backend emits events via `/api/system/events` (multiplexed) and `/api/system/trace-logs` (dedicated).
- Frontend uses `appApi.listen` and `appApi.onTraceLog`.
