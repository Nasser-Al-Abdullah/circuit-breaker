import "dotenv/config";

import CircuitBreaker from "./circuit-breaker.js";
import miningProvider from "./mining-service.js";

const miningCircuitBreaker = new CircuitBreaker({
  serviceName: "mining-service",
});

for (let requestNumber = 1; requestNumber <= 20; requestNumber++) {
  try {
    const result = await miningCircuitBreaker.execute(() => miningProvider());

    console.log(
      `Request #${requestNumber}`,
      "\nresult:",
      result,
      "\nstate:",
      miningCircuitBreaker.state,
      "\nfailureCount:",
      miningCircuitBreaker.failureCount,
      "\nopenedAt:",
      miningCircuitBreaker.openedAt,
      "\nfailureThreshold:",
      miningCircuitBreaker.failureThreshold,
    );
  } catch (error) {
    console.log(
      `Request #${requestNumber} failed`,
      "\nerror:",
      error instanceof Error ? error.message : error,
      "\nstate:",
      miningCircuitBreaker.state,
      "\nfailureCount:",
      miningCircuitBreaker.failureCount,
      "\nopenedAt:",
      miningCircuitBreaker.openedAt,
      "\nfailureThreshold:",
      miningCircuitBreaker.failureThreshold,
    );
  }

  await new Promise((resolve) => setTimeout(resolve, 2000));

  console.log("\n\nNext request...\n");
}
