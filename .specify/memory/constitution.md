<!--
Sync Impact Report
- Version change: Initial adoption (Unratified Template) → 1.0.0
- List of modified principles:
  - [PRINCIPLE_1_NAME] → I. Multi-Tier Distributed Separation of Concerns (Clean Architecture)
  - [PRINCIPLE_2_NAME] → II. Contract-First & Schema Validation (Strict Protocol Decoupling)
  - [PRINCIPLE_3_NAME] → III. Real-Time Resilience & Offline-First Buffer Handling
  - [PRINCIPLE_4_NAME] → IV. Test-First & Multi-Tier Verification (TDD Non-Negotiable)
  - [PRINCIPLE_5_NAME] → V. Resource Budgets, Battery Efficiency & End-to-End Observability
- Added sections:
  - Architectural & Platform Standards (Garmin Fenix 7s, Android 16, Real-Time Web)
  - Development Workflow, Quality Gates & Latency Verification
- Removed sections:
  - None (scaffold placeholders replaced)
- Follow-up TODOs:
  - None
-->

# Running Activity Support System Constitution

## Core Principles

### I. Multi-Tier Distributed Separation of Concerns (Clean Architecture)
Every tier in the ecosystem—Garmin Connect IQ Watch App, Android 16 Companion Gateway, and Web Real-Time Application—MUST be architected as an autonomous, decoupled system following Clean/Hexagonal Architecture principles.
- Core domain models (running telemetry metrics, athlete sessions, bidirectional notification events) MUST remain completely independent of external frameworks, UI toolkits, and device SDKs.
- Device adapters (Garmin Connect IQ SDK, Android BLE/Location APIs, Web WebSockets) MUST reside exclusively in outer infrastructure layers and interact with domain use cases through strictly defined ports and interfaces.
- Business rules MUST NOT depend on whether data is transmitted over Bluetooth Low Energy, WebSockets, or HTTP REST.

### II. Contract-First & Schema Validation (Strict Protocol Decoupling)
All communication across tiers (Garmin ↔ Android, Android ↔ Web) MUST adhere to versioned, strictly typed schemas.
- Payloads for running activity telemetry (heart rate, pace, cadence, GPS, elevation, dynamics) and bidirectional notification events MUST have formal schema definitions shared or mirrored across codebases.
- Every ingestion boundary MUST validate incoming payloads before processing. Malformed or unrecognized packets MUST be handled gracefully without crashing the application lifecycle.
- Protocol breaking changes MUST follow explicit schema versioning to guarantee backward compatibility across differing release cycles between watch, mobile, and web clients.

### III. Real-Time Resilience & Offline-First Buffer Handling
The system MUST be resilient to transient network partitions, Bluetooth disconnections, and platform background task throttling.
- The Android Companion application MUST implement an offline-first persistent buffer (e.g., local transactional store) to queue telemetry data during cellular connectivity drops and stream it reliably once the connection is restored.
- Telemetry ingestion MUST be idempotent; duplicated packets arising from retries MUST NOT corrupt workout metrics.
- Bi-directional notifications (Web → Android → Garmin) MUST implement delivery state tracking (queued, dispatched, acknowledged, expired) with configurable Time-To-Live (TTL) to prevent stale alerts reaching the runner after critical context has passed.

### IV. Test-First & Multi-Tier Verification (TDD Non-Negotiable)
Test-Driven Development (TDD) is mandatory across all sub-projects and application layers.
- For all domain logic, state machines, protocol serialization/deserialization, and relay orchestrators, tests MUST be written before implementation code (Red-Green-Refactor).
- Unit tests MUST run in isolation without requiring physical hardware, utilizing test doubles for BLE peripherals, Connect IQ message channels, and network sockets.
- Integration tests MUST validate end-to-end contract compliance across serialization boundaries between Monkey C, Kotlin, and TypeScript components.
- Automated quality gates MUST reject any contribution that fails unit or contract test suites.

### V. Resource Budgets, Battery Efficiency & End-to-End Observability
Because running activities occur under strict physical and hardware constraints, every tier MUST adhere to strict resource and power budgets.
- The Garmin Watch app MUST respect Connect IQ heap limits for the Fenix 7s platform and minimize screen redraws and Bluetooth radio duty cycles to preserve battery life over long-duration activities.
- The Android app MUST adhere to Android 16 background execution limits, managing foreground service lifecycles responsibly and releasing wakelocks promptly.
- Structured logging and end-to-end correlation identifiers (Session ID, Telemetry Sequence ID, Notification Trace ID) MUST be included in all transmitted packets to enable real-time debugging and telemetry verification.

## Architectural & Platform Standards

### Platform Specifications & Responsibilities
- **Wearable Tier (Garmin Fenix 7s)**: Built using the Garmin Connect IQ SDK (Monkey C). Responsible for high-frequency sensor capture (HR, GPS, cadence, pace), local display for the runner, low-latency BLE transmission to the companion, and audio/haptic notification rendering.
- **Mobile Companion Gateway (Android 16)**: Built with modern Android standards (Kotlin, Jetpack Compose, Coroutines/Flow, Foreground Services). Responsible for BLE connection management via Connect IQ Mobile SDK, local SQLite/Room telemetry persistence, bidirectional cloud streaming (WebSockets / gRPC / HTTP), and background notification forwarding.
- **Web Dashboard Tier**: Built with modern web standards (TypeScript, reactive UI components, WebSocket streaming). Responsible for real-time telemetry visualization, session analytics, and user-initiated notification dispatch down to the runner.

### Security & Privacy
- All athlete telemetry and location data in transit MUST be encrypted using TLS 1.3 over WAN links and authenticated BLE channels over local links.
- Biometric and location data MUST comply with privacy-by-design standards; telemetry storage MUST support data retention policies and secure purging.

## Development Workflow, Quality Gates & Latency Verification

### Quality Gates & Static Analysis
- Every pull request MUST pass automated linting, type-checking, and unit test suites across all affected modules.
- End-to-end latency benchmarks MUST be monitored: telemetry from Garmin to Web MUST achieve sub-second average latency under stable network conditions, and notifications from Web to Garmin MUST dispatch within 1.5 seconds under active BLE connection.

### Pull Request & Review Standards
- PRs modifying protocol schemas or inter-app contracts MUST include synchronized contract tests or schema updates across all three tiers.
- Any change that increases Garmin memory usage or Android background battery consumption MUST be explicitly documented and justified with profiling evidence.

## Governance

This Constitution is the supreme architectural authority for the Running Activity Support System. All design specifications, implementation plans, and code reviews MUST comply with the principles and rules defined herein.

### Amendment Procedure
- Any amendment, addition, or removal of principles requires an explicit proposal (RFC), documenting the technical rationale, platform impact, and migration strategy.
- Amendments require consensus and review against real-world hardware and platform constraints.

### Versioning Policy
- **MAJOR**: Incompatible principle redefinitions, removal of fundamental architectural requirements, or major paradigm shifts.
- **MINOR**: Addition of new principles, sections, platform tiers, or material expansions to governance.
- **PATCH**: Wording improvements, non-semantic clarifications, or typo corrections.

**Version**: 1.0.0 | **Ratified**: 2026-10-21 | **Last Amended**: 2026-10-21
