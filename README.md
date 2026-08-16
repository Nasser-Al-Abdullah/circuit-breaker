# Circuit Breaker

A small TypeScript implementation of the **Circuit Breaker pattern**, built to explore backend reliability, failure isolation, asynchronous service calls, state transitions, concurrency control, and deterministic unit testing.

The project simulates an unreliable mining service and demonstrates how a circuit breaker can prevent repeated requests from reaching a failing dependency.

---

## Why?

When an external dependency becomes unhealthy, continuously sending requests to it can negatively affect both the application and the dependency itself.

Potential consequences include:

- Increased latency
- Resource consumption
- Request pileups
- Cascading failures
- Additional load on an already unhealthy dependency

A circuit breaker protects the application by temporarily stopping requests to an unhealthy dependency and periodically testing whether the dependency has recovered.

---

## Circuit States

The implementation uses three states:

```text
                    Failure threshold reached
                ┌───────────────────────────────┐
                │                               ▼
            ┌───────┐                       ┌──────┐
            │ CLOSED│                       │ OPEN │
            └───┬───┘                       └──┬───┘
                │                               │
                │ Success                       │ Recovery timeout
                │                               │
                │                               ▼
                │                         ┌───────────┐
                └─────────────────────────│ HALF_OPEN │
                                          └─────┬─────┘
                                                │
                                      ┌─────────┴─────────┐
                                      │                   │
                                   Success              Failure
                                      │                   │
                                      ▼                   ▼
                                   CLOSED               OPEN
```

### CLOSED

The dependency is considered healthy.

Requests are allowed through normally. Consecutive failures are tracked, and once the configured `failureThreshold` is reached, the circuit transitions to `OPEN`.

A successful request resets the failure count.

### OPEN

The dependency is considered unhealthy.

Requests are rejected immediately without calling the underlying service.

The circuit remains `OPEN` until the configured `openStateTimeout` has elapsed.

### HALF_OPEN

The circuit tests whether the dependency has recovered.

Only one recovery probe is allowed through at a time.

- Successful probe → `CLOSED`
- Failed probe → `OPEN`

---

## Example

The circuit breaker wraps an asynchronous operation:

```typescript
const result = await circuitBreaker.execute(() => miningService());
```

The caller does not need to manually track failures or circuit state. The circuit breaker manages that responsibility.

---

## Configuration

The implementation supports configuration through environment variables.

Create a `.env` file:

```env
OPEN_STATE_TIMEOUT=4000
FAILURE_THRESHOLD=2
```

### `OPEN_STATE_TIMEOUT`

The amount of time, in milliseconds, the circuit remains `OPEN` before allowing a recovery probe.

### `FAILURE_THRESHOLD`

The number of consecutive failures required to open the circuit.

---

## Project Structure

```text
circuit-breaker/
├── src/
│   ├── circuit-breaker.ts
│   ├── mining-service.ts
│   ├── index.ts
│   └── enums/
│       └── circuit-state.ts
│
├── tests/
│   └── circuit-breaker.test.ts
│
├── .env
├── package.json
├── package-lock.json
└── tsconfig.json
```

---

## Running the Project

Install dependencies:

```bash
npm install
```

Run the simulation:

```bash
npx tsx src/index.ts
```

The simulation generates requests against an unreliable mining service and prints the circuit's state as requests are processed.

Example:

```text
Request #1 failed
error: Mining service call failed
state: CLOSED
failureCount: 1
openedAt: undefined
failureThreshold: 2

Request #2 failed
error: Mining service call failed
state: OPEN
failureCount: 0
openedAt: 1755292800000
failureThreshold: 2

Request #3 failed
error: Circuit is open for service: mining-service
state: OPEN
failureCount: 0
openedAt: 1755292800000
failureThreshold: 2

Circuit is half-open for service: mining-service
Mining service call succeeded
Circuit closed for service: mining-service
state: CLOSED
failureCount: 0
openedAt: undefined
```

---

# Engineering Concepts

## 1. Circuit Breaker Pattern

The project implements a three-state circuit breaker:

- `CLOSED`
- `OPEN`
- `HALF_OPEN`

The implementation handles:

- Failure thresholds
- Recovery timeouts
- State transitions
- Recovery probes
- Immediate rejection while `OPEN`

---

## 2. State Machine

The circuit breaker is modeled as a state machine:

```text
CLOSED → OPEN
OPEN → HALF_OPEN
HALF_OPEN → CLOSED
HALF_OPEN → OPEN
```

Each state has different behavior when a request arrives.

This makes the state transitions explicit and keeps the behavior of each state easy to reason about.

---

## 3. Asynchronous Programming

The circuit breaker wraps asynchronous service operations using Promises and `async/await`.

The simulated mining service represents an external dependency that can either resolve successfully or reject with an error.

```text
Service Call
     │
     ├── Success → Promise resolves
     │
     └── Failure → Promise rejects
```

This models the asynchronous nature of real external API and service calls.

---

## 4. Failure Handling

The circuit breaker distinguishes between:

- Successful service calls
- Failed service calls
- Requests rejected because the circuit is `OPEN`
- Successful recovery probes
- Failed recovery probes

The underlying service error is propagated back to the caller while the circuit breaker updates its internal state.

---

## 5. Consecutive Failure Tracking

Failures are tracked while the circuit is `CLOSED`.

For example, with:

```text
FAILURE_THRESHOLD=3
```

the sequence becomes:

```text
Failure → 1
Failure → 2
Failure → 3
             ↓
           OPEN
```

A successful request resets the failure count.

---

## 6. Time-Based State Transitions

The circuit breaker does not maintain a background timer to transition from `OPEN` to `HALF_OPEN`.

Instead, it records the timestamp at which the circuit opened:

```typescript
openedAt = Date.now();
```

When another request arrives, the circuit calculates:

```text
current time - openedAt
```

If the configured `OPEN_STATE_TIMEOUT` has elapsed, the circuit transitions to `HALF_OPEN`.

This keeps the implementation simple and avoids maintaining background timers for inactive circuits.

---

## 7. Concurrency Control

While `HALF_OPEN`, only one recovery probe is allowed to execute at a time.

The intended behavior is:

```text
HALF_OPEN

Request A → allowed
Request B → rejected
Request C → rejected
Request D → rejected
```

The implementation tracks whether a recovery probe is currently in flight using:

```typescript
halfOpenRequestInFlight;
```

This prevents multiple simultaneous requests from reaching a dependency while its recovery is being tested.

---

## 8. Unit Testing

The project uses **Vitest** for unit testing.

The tests use controlled mock services rather than relying on the randomly failing mining service, keeping the tests deterministic.

Tests cover behaviors such as:

- Initial `CLOSED` state
- Successful requests
- Failure counting
- Failure threshold
- `CLOSED → OPEN`
- Requests rejected while `OPEN`
- Preventing the underlying service from being called while `OPEN`
- `OPEN → HALF_OPEN`
- Successful recovery
- Failed recovery
- `HALF_OPEN → CLOSED`
- `HALF_OPEN → OPEN`
- Single recovery probe behavior

Run the test suite:

```bash
npx vitest
```

Or run the tests once:

```bash
npx vitest run
```

---

## 9. Mocking and Test Doubles

The circuit breaker accepts the protected operation as a function:

```typescript
breaker.execute(() => miningService());
```

This keeps the circuit breaker independent from the underlying service implementation and makes it straightforward to replace the service with a controlled test double.

A successful service can be mocked with:

```typescript
const service = vi.fn().mockResolvedValue("Success");
```

A failing service can be mocked with:

```typescript
const service = vi.fn().mockRejectedValue(new Error("Service unavailable"));
```

This allows the circuit breaker to be tested independently from the simulated mining service.

---

## 10. Error Propagation

The circuit breaker does not silently consume errors from the underlying service.

When the service fails:

1. The failure is recorded.
2. The circuit state is updated if necessary.
3. The original error is propagated back to the caller.

This keeps circuit management separate from application-level error handling.

---

## 11. Separation of Concerns

The project separates the main responsibilities:

```text
CircuitBreaker
      ↓
Circuit state and failure handling

Mining Service
      ↓
Simulated external dependency

Index
      ↓
Request simulation

Tests
      ↓
Behavior verification
```

The circuit breaker does not depend on the mining service directly. It accepts an asynchronous operation and manages the reliability behavior around it.

---

# Design Decisions

## Process-Local State

The circuit breaker maintains its state in memory and is scoped to a single application instance.

This keeps the implementation simple and avoids introducing distributed coordination that is unnecessary for this project.

## Lazy `OPEN → HALF_OPEN` Transition

The circuit breaker does not use a background timer.

Instead, the transition is evaluated when a new request arrives by comparing the current time with `openedAt`.

This avoids maintaining timers for circuits that may not receive another request.

## Single Recovery Probe

Only one request is allowed through while `HALF_OPEN`.

This prevents multiple concurrent requests from reaching a dependency that is currently being tested for recovery.

## Function-Based Dependency

The circuit breaker accepts the protected operation as a function rather than depending directly on a specific service.

This keeps the implementation reusable and makes deterministic testing straightforward.

---

# Distributed Systems Considerations

The current implementation is intentionally process-local.

If multiple application instances were running:

```text
                    Load Balancer
                    /           \
                   /             \
            Instance A       Instance B
                 ↓                 ↓
          Circuit Breaker   Circuit Breaker
                 ↓                 ↓
                  \               /
                   \             /
                    External Service
```

Each application instance would maintain its own circuit state.

For a distributed system, shared state could potentially be introduced using something such as Redis.

However, this introduces additional concerns:

- Distributed state
- Consistency
- Network failures
- Availability
- Synchronization
- Additional infrastructure

For this project, keeping the circuit breaker process-local keeps the implementation focused and easy to reason about.

---

# Current Status

- [x] `CLOSED` state
- [x] `OPEN` state
- [x] `HALF_OPEN` state
- [x] Configurable failure threshold
- [x] Configurable recovery timeout
- [x] Consecutive failure counting
- [x] Circuit opening after reaching the failure threshold
- [x] Immediate rejection while `OPEN`
- [x] Timestamp-based timeout handling
- [x] `OPEN → HALF_OPEN` transition
- [x] Successful recovery probe
- [x] Failed recovery probe
- [x] Single recovery probe guard
- [x] Simulated unreliable external service
- [x] Unit testing setup
- [ ] Complete unit test suite
- [ ] Configuration validation
- [ ] Custom circuit-breaker errors
- [ ] Failure classification
- [ ] Observability and metrics
- [ ] Distributed circuit state
- [ ] Generic return types instead of `Promise<any>`

---

# Future Improvements

Potential improvements include:

- Complete unit test suite
- Configuration validation
- Constructor-based configuration
- Generic return types
- Custom circuit-breaker errors
- Failure classification
- Request/probe timeout handling
- Logging abstraction
- Metrics and observability
- Event-based state notifications
- Distributed circuit-breaker state
- Integration testing

---

# Technologies

- TypeScript
- Node.js
- Vitest
- dotenv
