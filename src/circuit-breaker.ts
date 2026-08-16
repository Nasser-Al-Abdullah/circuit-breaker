import { CircuitState } from "./enums/circuit-state.js";

export default class CircuitBreaker {
  serviceName: string = "default-service";
  state: CircuitState = CircuitState.CLOSED;

  openedAt: number | undefined;

  failureThreshold: number = parseInt(process.env.FAILURE_THRESHOLD || "3");

  failureCount: number = 0;

  lockHalfOpenToOneRequest: boolean = false;

  constructor(options?: { serviceName?: string }) {
    if (options?.serviceName) {
      this.serviceName = options.serviceName;
    }
  }

  async execute(operation: () => Promise<any>): Promise<any> {
    this.transitionToHalfOpenIfReady();

    switch (this.state) {
      case CircuitState.OPEN: {
        return Promise.reject(
          new Error(`Circuit is open for service: ${this.serviceName}`),
        );
      }

      case CircuitState.HALF_OPEN: {
        if (this.lockHalfOpenToOneRequest) {
          return Promise.reject(
            new Error(
              `Circuit is half-open and locked for service: ${this.serviceName}`,
            ),
          );
        }

        this.lockHalfOpenToOneRequest = true;

        return operation()
          .then((result) => {
            this.closeCircuit();
            return result;
          })
          .catch((error) => {
            this.openCircuit();
            return Promise.reject(error);
          })
          .finally(() => {
            this.lockHalfOpenToOneRequest = false;
          });
      }

      case CircuitState.CLOSED: {
        return operation()
          .then((result) => {
            this.resetCircuitState();
            return result;
          })
          .catch((error) => {
            this.failureCount++;

            if (this.failureCount >= this.failureThreshold) {
              this.openCircuit();
            }

            return Promise.reject(error);
          });
      }
    }
  }

  private closeCircuit() {
    this.state = CircuitState.CLOSED;
    this.resetCircuitState();

    console.log(`Circuit closed for service: ${this.serviceName}`);
  }

  private resetCircuitState() {
    this.failureCount = 0;
    this.openedAt = undefined;

    console.log(`Circuit state reset for service: ${this.serviceName}`);
  }

  private openCircuit() {
    this.state = CircuitState.OPEN;
    this.resetCircuitState();
    this.openedAt = Date.now();

    console.log(`Circuit opened for service: ${this.serviceName}`);
  }

  private transitionToHalfOpenIfReady() {
    const isCircuitNotClosed = this.state !== CircuitState.CLOSED;

    const elapsedOpenTime = this.openedAt ? Date.now() - this.openedAt : 0;

    const openStateTimeout = parseInt(process.env.OPEN_STATE_TIMEOUT || "5000");

    if (isCircuitNotClosed && elapsedOpenTime >= openStateTimeout) {
      this.state = CircuitState.HALF_OPEN;

      console.log(`Circuit is half-open for service: ${this.serviceName}`);
    }
  }
}
