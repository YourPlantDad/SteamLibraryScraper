/*
    JSON to Markdown Converter
    Copyright (C) 2025 Allard van der Willik - YourPlantDad
    License: GPLv3
*/

import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';

// --- CONFIGURATION ---
const ROOT_DIR = path.resolve(__dirname, '..', '..');
const INPUT_DIR = path.join(ROOT_DIR, 'output', 'raw_data');
const OUTPUT_DIR = path.join(ROOT_DIR, 'output', 'obsidian_library');
const DELAY_MS = 1200; 

// --- INTERFACES ---
interface GameData {
    name: string;
    steamAppID: number;
    playtime: number | false;
    lastPlayed: number | false;
    myAchievements: number;
    totalAchievements: number;
}

interface SteamStoreData {
    header_image?: string;
    short_description?: string;
    developers?: string[];
    publishers?: string[];
    release_date?: { date: string };
    metacritic?: { score: number };
    genres?: { description: string }[];
}

// --- HELPERS ---
function sanitizeFilename(name: string): string {
    return name.replace(/[<>:"/\\|?*]/g, '').trim();
}

function findLatestJsonFile(dir: string): string | null {
    if (!fs.existsSync(dir)) return null;
    
    const files = fs.readdirSync(dir)
        .filter(f => f.endsWith('.json') && f.includes('SteamScrape'))
        .map(f => ({ name: f, time: fs.statSync(path.join(dir, f)).mtime.getTime() }))
        .sort((a, b) => b.time - a.time);

    return files.length > 0 ? path.join(dir, files[files.length - 1].name) : null;
}

function fetchSteamDetails(appId: number): Promise<SteamStoreData | null> {
    return new Promise((resolve) => {
        if (!appId || appId === 0) {
            resolve(null);
            return;
        }

        const url = `https://store.steampowered.com/api/appdetails?appids=${appId}`;

        https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    if (json[appId] && json[appId].success) {
                        resolve(json[appId].data);
                    } else {
                        resolve(null);
                    }
                } catch (e) {
                    resolve(null);
                }
            });
        }).on('error', (err) => {
            resolve(null);
        });
    });
}

function formatDuration(ms: number): string {
    const totalSeconds = Math.ceil(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    const minStr = minutes === 1 ? "1 minute" : `${minutes} minutes`;
    const secStr = seconds === 1 ? "1 second" : `${seconds} seconds`;

    return `${minStr} and ${secStr}`;
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// --- MAIN FUNCTION ---
export async function runConversion() {
    console.log("\n🔄 Starting JSON to Markdown Conversion...");

    const jsonPath = findLatestJsonFile(INPUT_DIR);
    if (!jsonPath) {
        console.error(`❌ No JSON files found in ${INPUT_DIR}. Please run the scraper first.`);
        if (!fs.existsSync(INPUT_DIR)) fs.mkdirSync(INPUT_DIR, { recursive: true });
        return;
    }
    console.log(`Reading data from: ${jsonPath}`);

    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    const rawData = fs.readFileSync(jsonPath, 'utf-8');
    const games: GameData[] = JSON.parse(rawData);

    const totalEstimatedTime = games.length * DELAY_MS;
    console.log(`Found ${games.length} games.`);
    console.log(`⚠️  Note: This will take about ${formatDuration(totalEstimatedTime)} to avoid hitting Steam rate limits.`);

    let updateStep = 0;
    if (games.length >= 100) {
        updateStep = Math.ceil(games.length / 10);
    } else if (games.length >= 10) {
        updateStep = 10;
    }

    for (const [index, game] of games.entries()) {
        const safeName = sanitizeFilename(game.name);
        const fileName = `${safeName}.md`;
        const filePath = path.join(OUTPUT_DIR, fileName);

        // Smart Skip Check
        if (fs.existsSync(filePath)) {
            const existingContent = fs.readFileSync(filePath, 'utf-8');
            if (existingContent.includes('cover_url: "http')) {
                process.stdout.write(`\r[${index + 1}/${games.length}] Skipping: ${game.name} (Already enriched)   `);
                continue;
            }
        }

        process.stdout.write(`\n[${index + 1}/${games.length}] Processing: ${game.name}... `);
        
        let storeData: SteamStoreData | null = null;
        if (game.steamAppID) {
            storeData = await fetchSteamDetails(game.steamAppID);
        }

        const playtime = game.playtime === false ? 0 : game.playtime;
        const lastPlayed = game.lastPlayed === false ? "Never" : new Date((game.lastPlayed as number) * 1000).toISOString().split('T')[0];
        
        const completionRate = game.totalAchievements > 0 
            ? Math.round((game.myAchievements / game.totalAchievements) * 100) 
            : 0;

        const image = storeData?.header_image || "";
        const developers = storeData?.developers ? `\n  - ${storeData.developers.join('\n  - ')}` : "";
        const genres = storeData?.genres ? `\n  - ${storeData.genres.map(g => g.description).join('\n  - ')}` : "";
        const releaseDate = storeData?.release_date?.date || "";
        
        let description = storeData?.short_description || "";
        description = description.replace(/"/g, '\\"');

        const fileContent = `---
type: game
name: "${game.name.replace(/"/g, '\\"')}"
steamAppId: ${game.steamAppID}
playtime_hours: ${playtime}
last_played: ${lastPlayed}
achievements_unlocked: ${game.myAchievements}
achievements_total: ${game.totalAchievements}
completion_rate: ${completionRate}%
cover_url: "${image}"
developers:${developers}
genres:${genres}
release_date: "${releaseDate}"
---
![Cover](${image})

${description}
`;
        fs.writeFileSync(filePath, fileContent);
        
        if (storeData) console.log("✅ Enriched");
        else console.log("⚪ Basic Info Only");

        if (updateStep > 0 && (index + 1) % updateStep === 0 && index + 1 !== games.length) {
            const gamesRemaining = games.length - (index + 1);
            const timeRemaining = gamesRemaining * DELAY_MS;
            const percentComplete = Math.round(((index + 1) / games.length) * 100);
            console.log(`\n--- ${percentComplete}% Complete. Estimated time remaining: ${formatDuration(timeRemaining)} ---\n`);
        }

        await sleep(DELAY_MS);
    }

    const absoluteFolderPath = path.resolve(OUTPUT_DIR);
    console.log(`\n\n✅ Success! Files saved to:`);
    console.log(absoluteFolderPath);
}

// Allows running directly via `npx ts-node src/json-to-md.ts` if needed
if (require.main === module) {
    runConversion();
}