import axios from 'axios';
import mongoose from 'mongoose';
import tvModel from './models/tv.mjs';
import deleteDuplicate from './utils/deleteDuplicate.mjs';
import logger from './utils/logger.mjs';
import RequestQueue from './utils/requestQueue.mjs';
import { database, apiKey, baseUrl, language, total } from './config.mjs';
import latestId from './utils/latestId.mjs';

const TV = mongoose.model('TV', tvModel);
const requestQueue = new RequestQueue(25, 40);

// Connect to MongoDB
async function connectDatabase() {
	try {
		await mongoose.connect(database);
		logger.success('Connected to MongoDB');
	} catch (err) {
		logger.error(`Failed to connect to MongoDB: ${err.message}`);
		process.exit(1);
	}
}

// Fetch show data from TMDB API with rate limiting
async function fetchShowData(showId) {
	return requestQueue.add(async () => {
		try {
			const response = await axios.get(
				`${baseUrl}${showId}?api_key=${apiKey}&language=${language}`,
				{ timeout: 10000 }
			);
			logger.success(`Fetched show ID: ${showId} - ${response.data.name}`);
			return response.data;
		} catch (error) {
			if (error.response?.status === 404) {
				logger.warning(`404 Not Found - Show ID: ${showId} - Show may have been deleted or is unavailable`);
			} else if (error.response?.status === 429) {
				logger.error(`Rate limited (429) - Show ID: ${showId} - Waiting before retry`);
			} else if (error.code === 'ECONNABORTED') {
				logger.error(`Timeout - Show ID: ${showId} - Request took too long`);
			} else {
				logger.error(`Error fetching Show ID ${showId}: ${error.message}`);
			}
			throw error;
		}
	});
}

// Save show data to MongoDB
async function saveShowToDatabase(showData) {
	try {
		const existingShow = await TV.findOne({ id: showData.id });

		if (existingShow) {
			await TV.updateOne({ id: showData.id }, showData);
			logger.info(`Updated show ID: ${showData.id} - ${showData.name}`);
		} else {
			const newShow = new TV(showData);
			await newShow.save();
			logger.success(`Saved new show ID: ${showData.id} - ${showData.name}`);
		}
	} catch (error) {
		logger.error(`Failed to save show to database: ${error.message}`);
		throw error;
	}
}

// Process multiple show IDs in parallel
async function processMultipleShows(showIds) {
	const promises = showIds.map(id =>
		fetchShowData(id)
			.then(data => saveShowToDatabase(data))
			.catch(err => {
				// Don't re-throw 404 errors, just log them
				if (err.response?.status !== 404) {
					logger.error(`Failed to process show ID ${id}: ${err.message}`);
				}
				return null;
			})
	);

	return Promise.all(promises);
}

// Get the last ID already processed
async function getLastProcessedId() {
	try {
		const lastDocument = (await TV.find({}).sort({ _id: -1 }).limit(1))[0];
		return lastDocument?.id ?? 0;
	} catch (error) {
		logger.error(`Failed to get last processed ID: ${error.message}`);
		return 0;
	}
}

// Main execution
async function main() {
	try {
		logger.info('='.repeat(50));
		logger.info('TMDB Scraper Started');
		logger.info('='.repeat(50));

		// Fetch latest ID from TMDB
		logger.info('Fetching latest ID from TMDB...');
		await latestId();

		// Connect to database
		await connectDatabase();

		// Read the updated latestId.json
		const fs = await import('fs');
		const updatedTotal = fs.readFileSync('latestId.json', 'utf8');
		const maxId = parseInt(updatedTotal);
		const batchSize = 100;
		const lastProcessedId = await getLastProcessedId();

		logger.info(`Latest ID from TMDB: ${maxId}`);
		logger.info(`Last processed ID in database: ${lastProcessedId}`);
		logger.info(`Starting from ID: ${lastProcessedId + 1}`);

		let successCount = 0;
		let errorCount = 0;
		const startTime = Date.now();

		// Process shows in batches
		for (let i = lastProcessedId + 1; i <= maxId; i += batchSize) {
			const batchEnd = Math.min(i + batchSize - 1, maxId);
			const batch = [];

			for (let j = i; j <= batchEnd; j++) {
				batch.push(j);
			}

			logger.info(`Processing batch: ${i} to ${batchEnd} (${batch.length} shows)`);

			const results = await processMultipleShows(batch);

			const batchSuccess = results.filter(r => r !== null).length;
			const batchSkipped = results.filter(r => r === null).length;

			successCount += batchSuccess;
			errorCount += batchSkipped;

			logger.info(`Batch completed - Success: ${batchSuccess}, Failed/Skipped: ${batchSkipped}`);

			// Optional: Add a small delay between batches to be extra safe with rate limiting
			if (i + batchSize <= maxId) {
				await new Promise(resolve => setTimeout(resolve, 500));
			}
		}

		// Delete duplicates
		logger.info('Removing duplicate entries...');
		await deleteDuplicate();

		const endTime = Date.now();
		const duration = ((endTime - startTime) / 1000 / 60).toFixed(2);

		logger.info('='.repeat(50));
		logger.success('TMDB Scraper Completed Successfully');
		logger.info(`Total Processed: ${successCount + errorCount}`);
		logger.info(`Successfully Saved: ${successCount}`);
		logger.info(`Failed/Skipped: ${errorCount}`);
		logger.info(`Duration: ${duration} minutes`);
		logger.info('='.repeat(50));

		process.exit(0);
	} catch (error) {
		logger.error(`Fatal error: ${error.message}`);
		logger.error(error.stack);
		process.exit(1);
	}
}

// Run main function
main();