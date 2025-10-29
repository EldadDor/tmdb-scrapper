import dotenv from "dotenv";
import fs from "fs";
dotenv.config();

const database = process.env.DATABASE;
const apiKey = process.env.API_KEY;
const baseUrl = "https://api.themoviedb.org/3/tv/";
const language = 'en-US';

let total = "1";

// Try to read the existing latestId.json file
try {
	if (fs.existsSync('latestId.json')) {
		total = fs.readFileSync('latestId.json', 'utf8');
	}
} catch (error) {
	console.error('Error reading latestId.json:', error.message);
}

export { database, apiKey, baseUrl, language, total };