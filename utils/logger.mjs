import fs from "fs";
import path from "path";
import logSymbols from "log-symbols";

class Logger {
	constructor() {
		this.logsDir = "./logs";
		this.ensureLogsDir();
	}

	ensureLogsDir() {
		if (!fs.existsSync(this.logsDir)) {
			fs.mkdirSync(this.logsDir, { recursive: true });
		}
	}

	getTimestamp() {
		return new Date().toISOString();
	}

	getLogFileName() {
		const date = new Date();
		const day = String(date.getDate()).padStart(2, "0");
		const month = String(date.getMonth() + 1).padStart(2, "0");
		const year = date.getFullYear();
		return path.join(this.logsDir, `log_${day}_${month}_${year}.txt`);
	}

	writeToFile(message) {
		const logFile = this.getLogFileName();
		fs.appendFileSync(logFile, message + "\n", "utf8");
	}

	info(message) {
		const timestamp = this.getTimestamp();
		const formatted = `[${timestamp}] ${logSymbols.info} ${message}`;
		console.log(formatted);
		this.writeToFile(formatted);
	}

	success(message) {
		const timestamp = this.getTimestamp();
		const formatted = `[${timestamp}] ${logSymbols.success} ${message}`;
		console.log(formatted);
		this.writeToFile(formatted);
	}

	warning(message) {
		const timestamp = this.getTimestamp();
		const formatted = `[${timestamp}] ${logSymbols.warning} ${message}`;
		console.log(formatted);
		this.writeToFile(formatted);
	}

	error(message) {
		const timestamp = this.getTimestamp();
		const formatted = `[${timestamp}] ${logSymbols.error} ${message}`;
		console.log(formatted);
		this.writeToFile(formatted);
	}
}

export default new Logger();