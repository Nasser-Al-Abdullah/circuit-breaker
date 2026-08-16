import { describe, expect, it, vi } from "vitest";
import CircuitBreaker from "../src/circuit-breaker.js";
import { CircuitState } from "../src/enums/circuit-state.js";

describe("CircuitBreaker", () => {
  it("starts in CLOSED state", () => {
    const breaker = new CircuitBreaker();

    expect(breaker.state).toBe(CircuitState.CLOSED);
  });

  it("allows successful requests while CLOSED", async () => {
    const breaker = new CircuitBreaker();

    const service = vi.fn().mockResolvedValue("Success");

    const result = await breaker.execute(service);

    expect(result).toBe("Success");
    expect(breaker.state).toBe(CircuitState.CLOSED);
    expect(breaker.failureCount).toBe(0);
    expect(service).toHaveBeenCalledTimes(1);
  });

  it("increments failure count when a request fails", async () => {
    const breaker = new CircuitBreaker();

    const service = vi.fn().mockRejectedValue(new Error("Service failed"));

    await expect(breaker.execute(service)).rejects.toThrow("Service failed");

    expect(breaker.failureCount).toBe(1);
    expect(breaker.state).toBe(CircuitState.CLOSED);
  });

  it("opens the circuit after reaching failure threshold", async () => {
    const breaker = new CircuitBreaker();

    const service = vi.fn().mockRejectedValue(new Error("Service failed"));

    for (let i = 0; i < breaker.failureThreshold; i++) {
      await expect(breaker.execute(service)).rejects.toThrow();
    }

    expect(breaker.state).toBe(CircuitState.OPEN);
    expect(breaker.failureCount).toBe(0);
  });

  it("rejects requests immediately while OPEN", async () => {
    const breaker = new CircuitBreaker();

    const service = vi.fn().mockRejectedValue(new Error("Service failed"));

    for (let i = 0; i < breaker.failureThreshold; i++) {
      await expect(breaker.execute(service)).rejects.toThrow();
    }

    service.mockClear();

    await expect(breaker.execute(service)).rejects.toThrow();

    expect(service).not.toHaveBeenCalled();
  });

  it("resets failure count after a successful request", async () => {
    const breaker = new CircuitBreaker();

    const failingService = vi
      .fn()
      .mockRejectedValueOnce(new Error("Failed"))
      .mockResolvedValueOnce("Success");

    await expect(breaker.execute(failingService)).rejects.toThrow();

    expect(breaker.failureCount).toBe(1);

    await expect(breaker.execute(failingService)).resolves.toBe("Success");

    expect(breaker.failureCount).toBe(0);
    expect(breaker.state).toBe(CircuitState.CLOSED);
  });
});
