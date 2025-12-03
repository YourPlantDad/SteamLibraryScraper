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
const SETTINGS_PATH = path.join(ROOT_DIR, 'scraper-settings.json');
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
    name: string;
    steam_appid: number;
    header_image?: string;
    short_description?: string;
    detailed_description?: string;
    developers?: string[];
    publishers?: string[];
    release_date?: { 
        coming_soon: boolean; 
        date: string; 
    };
    metacritic?: { 
        score: number; 
        url?: string; 
    };
    categories?: { 
        id: number; 
        description: string; 
    }[];
    genres?: { 
        id: string; 
        description: string; 
    }[];
    platforms?: {
        windows: boolean;
        mac: boolean;
        linux: boolean;
    };
    controller_support?: "full" | "partial" | "none";
    required_age?: number | string;
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

/**
 * Renders a template string by evaluating expressions inside ${...}
 * @param template The string containing ${jsCode}
 * @param context An object containing variables available to the template
 */
function renderTemplate(template: string, context: any): string {
    return template.replace(/\$\{([\s\S]+?)\}/g, (match, code) => {
        try {
            // Create a function that has access to the keys of the context object
            const keys = Object.keys(context);
            const values = Object.values(context);
            
            // "code" is the string inside the brackets, e.g., "game.name"
            const func = new Function(...keys, `return ${code};`);
            
            // Execute the function with the values
            const result = func(...values);
            return result === undefined || result === null ? "" : String(result);
        } catch (e) {
            console.error(`\nTemplate Error evaluating: "${code}"`);
            return match; // Return the raw ${...} string if it fails so user can debug
        }
    });
}

// --- DEFAULT TEMPLATE (Fallback) ---
const DEFAULT_TEMPLATE = `---
title: "[[${"game.name".replace(/"/g, '\\"')}]]"
releaseDate: \${releaseDateStr}
developers:
\${storeData?.developers?.map(d => toWikiLink(d)).join('\\n') || ""}
publishers:
\${storeData?.publishers?.map(p => toWikiLink(p)).join('\\n') || ""}
genres:
\${storeData?.genres?.map(g => toWikiLink(g.description)).join('\\n') || ""}
url: https://store.steampowered.com/app/\${game.steamAppID}
released: \${isReleased}
metacriticRating: \${storeData?.metacritic?.score || 0}
played: \${playtime > 0}
playtimeHours: \${playtime}
achievementsTotal: \${game.totalAchievements}
achievementsUnlocked: \${game.myAchievements}
completionRate: \${completionRate}%
personalRating: 0
type: game
platform: steam
id: \${game.steamAppID}
tags: 
  - steamgame
  - \${playtime > 0 ? (playtime > 2 ? "status/playing" : "status/backlog") : "status/wishlist"}
image: \${storeData?.header_image || ""}
---
![Cover](\${storeData?.header_image || ""})

> [!summary] Description
> \${summary}

# My Stats
- **Status**: \${playtime > 0 ? (playtime > 2 ? "Playing" : "Backlog") : "Wishlist/Backlog"}
- **Playtime**: \${formatDuration(playtime * 3600000)} (\${playtime} hours)
- **Last Played**: \${game.lastPlayed ? new Date(Number(game.lastPlayed) * 1000).toLocaleDateString() : "Never"}
- **Completion**: \${completionRate}% (\${game.myAchievements}/\${game.totalAchievements})

# Links
- [Steam Store](https://store.steampowered.com/app/\${game.steamAppID})
- [ProtonDB (Linux/Deck Compatibility)](https://www.protondb.com/app/\${game.steamAppID})
- [SteamDB](https://steamdb.info/app/\${game.steamAppID}/)
`;

// --- MAIN FUNCTION ---
export async function runConversion() {
    console.log("\nStarting JSON to Markdown Conversion...");

    // 1. Load Settings
    let template = DEFAULT_TEMPLATE;
    if (fs.existsSync(SETTINGS_PATH)) {
        try {
            const settings = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf-8'));
            if (settings.markdownTemplate) {
                console.log("Loaded custom Markdown template from settings.");
                template = settings.markdownTemplate;
            }
        } catch (e) {
            console.error("Could not read settings file. Using default template.");
        }
    }

    // 2. Load Data
    const jsonPath = findLatestJsonFile(INPUT_DIR);
    if (!jsonPath) {
        console.error(`No JSON files found in ${INPUT_DIR}. Please run the scraper first.`);
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
    console.log(`Note: This will take about ${formatDuration(totalEstimatedTime)} to avoid hitting Steam rate limits.`);

    let updateStep = 0;
    if (games.length >= 100) {
        updateStep = Math.ceil(games.length / 10);
    } else if (games.length >= 10) {
        updateStep = 10;
    }

    // 3. Process Games
    for (const [index, game] of games.entries()) {
        const safeName = sanitizeFilename(game.name);
        const fileName = `${safeName}.md`;
        const filePath = path.join(OUTPUT_DIR, fileName);

        // Smart Skip Check
        if (fs.existsSync(filePath)) {
            const existingContent = fs.readFileSync(filePath, 'utf-8');
            // Basic check to see if we already enriched this file 
            // (Assumes standard template uses cover_url or image property)
            if (existingContent.includes('image: "http') || existingContent.includes('cover_url: "http')) {
                process.stdout.write(`\r[${index + 1}/${games.length}] Skipping: ${game.name} (Already enriched)   `);
                continue;
            }
        }

        process.stdout.write(`\n[${index + 1}/${games.length}] Processing: ${game.name}... `);
        
        let storeData: SteamStoreData | null = null;
        if (game.steamAppID) {
            storeData = await fetchSteamDetails(game.steamAppID);
        }

        // --- Data Prep for Template ---
        const playtime = game.playtime === false ? 0 : game.playtime;
        
        const completionRate = game.totalAchievements > 0 
            ? Math.round((game.myAchievements / game.totalAchievements) * 100) 
            : 0;

        // Date Logic
        let releaseDateStr = "";
        let isReleased = false;
        if (storeData?.release_date) {
            isReleased = !storeData.release_date.coming_soon;
            const parsedDate = new Date(storeData.release_date.date);
            if (!isNaN(parsedDate.getTime())) {
                releaseDateStr = parsedDate.toISOString().split('T')[0];
            } else {
                releaseDateStr = storeData.release_date.date;
            }
        }

        // Steam Features (Flattened List)
        const steamFeatures = storeData?.categories?.map(c => c.description) || [];
        if (storeData?.controller_support === "full") steamFeatures.push("Full Controller Support");

        // Description Cleanup
        let summary = storeData?.short_description || "";
        summary = summary
            .replace(/&quot;/g, '"')
            .replace(/&amp;/g, '&')
            .replace(/<br>/g, '\n')
            .replace(/(<([^>]+)>)/gi, "");

        // Template Helpers
        const toWikiLink = (val: string) => `  - "[[${val.replace(/"/g, '\\"')}]]"`;

        // 4. Context Creation
        const context = {
            game,
            storeData,
            playtime,
            completionRate,
            releaseDateStr,
            isReleased,
            steamFeatures,
            summary,
            // Functions accessible in template
            formatDuration,
            toWikiLink,
            // Common JS objects
            Math,
            Date
        };

        // 5. Generate Content
        const fileContent = renderTemplate(template, context);

        fs.writeFileSync(filePath, fileContent);
        
        if (storeData) console.log("Enriched");
        else console.log("Basic Info Only");

        if (updateStep > 0 && (index + 1) % updateStep === 0 && index + 1 !== games.length) {
            const gamesRemaining = games.length - (index + 1);
            const timeRemaining = gamesRemaining * DELAY_MS;
            const percentComplete = Math.round(((index + 1) / games.length) * 100);
            console.log(`\n--- ${percentComplete}% Complete. Estimated time remaining: ${formatDuration(timeRemaining)} ---\n`);
        }

        await sleep(DELAY_MS);
    }

    const absoluteFolderPath = path.resolve(OUTPUT_DIR);
    console.log(`\n\nSuccess! Files saved to:`);
    console.log(absoluteFolderPath);
}

// Allows running directly via `npx ts-node src/json-to-md.ts` if needed
if (require.main === module) {
    runConversion();
}