import logger from "./logger.mjs";

class RequestQueue {
	constructor(maxConcurrent = 30, requestsPerSecond = 40) {
		this.maxConcurrent = maxConcurrent;
		this.requestsPerSecond = requestsPerSecond;
		this.activeRequests = 0;
		this.queue = [];
		this.requestTimestamps = [];
	}

	async waitForRateLimit() {
		const now = Date.now();
		const oneSecondAgo = now - 1000;

		// Remove old timestamps
		this.requestTimestamps = this.requestTimestamps.filter(ts => ts > oneSecondAgo);

		// If we've hit the rate limit, wait
		if (this.requestTimestamps.length >= this.requestsPerSecond) {
			const oldestTimestamp = this.requestTimestamps[0];
			const waitTime = oldestTimestamp + 1000 - now;
			if (waitTime > 0) {
				await new Promise(resolve => setTimeout(resolve, waitTime));
				return this.waitForRateLimit(); // Recursive call to check again
			}
		}

		this.requestTimestamps.push(now);
	}

	async add(requestFn) {
		return new Promise((resolve, reject) => {
			this.queue.push({ fn: requestFn, resolve, reject });
			this.process();
		});
	}

	async process() {
		if (this.activeRequests >= this.maxConcurrent || this.queue.length === 0) {
			return;
		}

		this.activeRequests++;
		const { fn, resolve, reject } = this.queue.shift();

		try {
			await this.waitForRateLimit();
			const result = await fn();
			resolve(result);
		} catch (error) {
			reject(error);
		} finally {
			this.activeRequests--;
			this.process();
		}
	}
}

export default RequestQueue;