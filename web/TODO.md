# Frontend rebuild: Vue 3 + modern CSS

Tracks the move from the React/Tailwind frontend to Vue. The core viewing
experience (dashboard, unified camera view, review) comes first. Everything
else is in the backlog at the bottom.

Legend: `[x]` done, `[ ]` to do, `[~]` partly done (see note).

## Phase 0: Scaffold and integration

- [x] Vite + Vue 3 + TypeScript (`vue-tsc`), ESLint (`eslint-plugin-vue`), Prettier
- [x] Same dev proxy table and `PROXY_HOST` workflow as before
- [x] `/BASE_PATH/` build so nginx ingress rewriting keeps working
- [x] Dockerfile web build step updated (no Monaco workers)
- [x] CI script names kept (`lint`, `build`, `e2e:build`, `e2e`, `i18n:extract:ci`)
- [x] Self-hosted fonts (Inter, JetBrains Mono): no CDN calls from an NVR

## Phase 1: Design system and shell

- [x] Tokens from the redesign template in `src/styles/tokens.css`, no raw colors in components
- [x] Cascade layers, reset, focus ring, reduced motion
- [x] UI kit: IconButton, OverlayButton, SegmentedToggle, CountPill, StatusDot, DetectionTag, SnapshotBadge, PopoverMenu (Popover API), MenuItem, ToggleSwitch, LoadingSpinner, SkeletonBlock, EmptyState
- [x] Shell: rail sidebar that becomes a bottom tab bar on phones, page header, status bar with CPU / GPU / storage / uptime and health
- [x] Account menu with logout
- [ ] Language picker in the account menu
- [ ] Light theme (tokens are ready for a `[data-theme]` override)

## Phase 2: Data layer

- [x] fetch wrapper with CSRF header, credentials and login redirect
- [x] `useQuery` stale-while-revalidate cache that keeps previous data on key change
- [x] Single `/ws` connection with camera_activity expansion and topic subscriptions
- [x] Camera activity (objects, motion, enabled, offline) and feature toggles over ws
- [x] i18n via i18next reusing `public/locales`, plus `npm run i18n:check`
- [ ] Respect `ui.time_format` / `ui.date_style` everywhere (done for times, not dates)

## Phase 3: Players

- [x] MSE session ported from the React player (codec negotiation, buffering, catch-up rate, stall detection, reconnect)
- [x] WebRTC session
- [x] jsmpeg session (canvas sized by CSS, no resize observer)
- [x] Refcounted live stream pool with linger, park and resume
- [x] Transport fallback chain MSE > WebRTC > jsmpeg without unmounting
- [x] HLS recording player that only rebuilds its source when a seek leaves the loaded window
- [x] Two-way talk (microphone backchannel over WebRTC)
- [x] Playback speed, volume, snapshot and picture in picture on the recording bar
- [ ] Recording playback quality picker (main / sub / auto)
- [x] Player stats overlay
- [x] Record now (on demand event), snapshot download, admin camera switches in the settings menu
- [ ] Live transcription overlay

## Phase 4: Dashboard

- [x] Fit-all grid sized so every camera is visible, scrolling list mode
- [x] Smart streaming (still image until activity, then live) and always-on mode
- [x] Tile overlay: status dot, name, clock, detection chips, snapshot / record / expand
- [x] Recent activity panel, becomes a thumbnail strip on tablets
- [x] Tile expands into the camera view with a View Transition, reusing its live stream
- [x] Camera groups (picker, ?group= links, admin create / edit / delete)
- [x] Tile menu: camera power, tile audio, stats, notification snoozing
- [ ] Drag to reorder groups and tiles
- [ ] Birdseye tile
- [ ] Drag to reorder / custom layouts

## Phase 5: Unified camera view and seamless switching

- [x] CameraStage: persistent live, recording and preview layers, never unmounted
- [x] Frame hold: the current frame freezes on screen until the next layer has painted
- [x] Fixed stage geometry from the camera config, no layout shift between sources
- [x] Live stays warm for 60s after leaving it, so returning to live is a resume
- [x] Recordings pre-attached while live, so the first scrub back is a seek
- [x] Live / recording hysteresis, mode decided once on release instead of on every drag move
- [x] Live edge measured against now and the latest recording, not a stale window end
- [x] Recordings that catch up to the edge hand over to live automatically
- [x] Camera switching inside the view keeps the page mounted and the timestamp
- [x] Canvas timeline: motion, recording gaps, review spans, ticks; hourly cached data
- [x] Playhead dragging with auto-scroll, tap to seek on touch, zoom levels
- [x] Keyboard: space, left / right arrows, L for live, F for fullscreen
- [x] Stage controls: play / pause / skip, jump to live, detect / record / snapshot toggles, mute, stream picker, low bandwidth, background play, fullscreen
- [~] Camera strip shows refreshing stills; showing the other cameras at the same recorded time is still to do
- [x] Date range beyond the last 24 hours
- [x] Export and share-timestamp actions
- [x] Timeline / Events / Detail side panel
- [ ] Debug replay
- [x] PTZ controls (pad, presets, click and box zoom, keyboard)
- [ ] Pinch / wheel zoom on the stage

## Phase 6: Review

- [x] Alerts / detections tabs with unreviewed counts
- [x] Camera filter, show reviewed toggle, mark all reviewed
- [x] Cards grouped by day with hover preview clips and infinite scroll
- [x] Opening a card plays it in the camera view
- [x] Label and zone filters (camera view and dashboard activity)
- [ ] Motion review tab
- [ ] Multi-select with bulk actions

## Phase 7: Auth

- [x] Login page (`/login`) and return to the original page afterwards
- [ ] First time login help text

## Phase 8: Tests

- [x] Unit tests: VOD seek mapping, live / recording hysteresis, grid layout, query keys
- [x] E2E (desktop and mobile): dashboard, camera view, review, shell
- [x] E2E with real media (ffmpeg fixtures, fake go2rtc MSE): asserts no frame without content during switches, no layout shift, one live connection across live > recording > live, tile handoff without reconnecting
- [ ] Verify against a real Frigate server: run `PROXY_HOST=<host>:5000 npm run dev` and work through the checklist below

### Manual checklist against a live server

- [ ] Dashboard tiles go live on activity and hover; "Always" keeps them live
- [ ] Opening a tile is instant and keeps playing (no spinner)
- [ ] Scrub back an hour, play, then press Live: no black frame either way
- [ ] Leave the view on recent footage for several minutes: no periodic flash
- [ ] Switch cameras while viewing a recording: same moment on the new camera
- [ ] Phone layout: tab bar, stage, timeline, review cards
- [ ] Behind auth (port 8971): login, redirect back, logout

## Backlog: pages not yet rebuilt

These were removed with the React app and can be recovered from git history
(`git show <commit>:web/src/...`). They show as disabled items in the sidebar.

- [ ] Explore (search, tracked object details, semantic search)
- [ ] Exports
- [ ] Settings (UI settings, camera settings, masks / zones, users, notifications, enrichments)
- [ ] Config editor
- [ ] System metrics and logs
- [ ] Face library, classification models
- [ ] Chat
- [ ] Debug replay, motion search
- [ ] Setup wizard
