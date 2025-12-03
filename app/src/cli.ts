/*
    Steam Library Scraper - CLI
    Copyright (C) 2025 Allard van der Willik - YourPlantDad
    License: GPLv3
*/

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { spawn } from 'child_process';
import { runConversion } from './json-to-md';

// --- PATH CONFIGURATION ---
const APP_DIR = path.resolve(__dirname, '..');
const ROOT_DIR = path.resolve(APP_DIR, '..'); 
const SETTINGS_PATH = path.join(ROOT_DIR, 'scraper-settings.json');

interface Settings {
    steamAccountID: string;
}

// --- UTILS ---

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const question = (query: string): Promise<string> => {
    return new Promise(resolve => rl.question(query, resolve));
};

function loadSettings(): Settings | null {
    if (fs.existsSync(SETTINGS_PATH)) {
        try {
            return JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf-8'));
        } catch (e) {
            console.error(`\nERROR reading settings file: ${SETTINGS_PATH}`);
            console.error(`   The JSON file may be corrupted.`);
            return null;
        }
    }
    return null;
}

function saveSettings(settings: Settings) {
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2), 'utf-8');
    console.log(`Settings saved to ${SETTINGS_PATH}`);
}

async function getSteamID(): Promise<string> {
    const settings = loadSettings();
    
    // If settings file exists and has an ID, use it automatically or ask to confirm
    if (settings?.steamAccountID) {
        // Optional: You could just return it immediately if you trust setup.bat
        // or keep this check to allow changing it.
        return settings.steamAccountID;
    }

    // Fallback if file is empty or missing
    console.log('\nSteam ID not found in settings.');
    console.log('Please enter your Steam Custom URL ID.');
    const newID = await question('Steam ID: ');
    
    if (!newID.trim()) {
        console.log("ID cannot be empty.");
        return getSteamID(); 
    }

    saveSettings({ steamAccountID: newID.trim() });
    return newID.trim();
}

async function runScraper(accountID: string) {
    console.log("\nLaunching Scraper...");
    
    return new Promise<void>((resolve, reject) => {
        const childEnv = { 
            ...process.env, 
            STEAM_ACCOUNT_ID: accountID 
        };

        const npmCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';

        const scrapeProcess = spawn(npmCmd, [
            'playwright', 'test', 'src/steam-library-scraper.spec.ts'
        ], {
            stdio: 'inherit',
            cwd: APP_DIR, 
            env: childEnv,
            shell: true
        });

        scrapeProcess.on('close', (code) => {
            if (code === 0) {
                console.log("Scraping complete.");
                resolve();
            } else {
                console.error(`\nSCRAPER FAILED with exit code ${code}.`);
                resolve(); 
            }
        });

        scrapeProcess.on('error', (err) => {
            console.error(`\nFAILED to start scraper process: ${err.message}`);
            resolve();
        });
    });
}

// --- MAIN MENU ---

async function main() {
    console.clear();
    console.log("========================================");
    console.log("     STEAM LIBRARY SCRAPER & EXPORT     ");
    console.log("========================================");

    // If for some reason settings are missing, get them once at startup
    let currentID = (loadSettings()?.steamAccountID) || "";
    if (!currentID) {
        currentID = await getSteamID();
    } else {
        console.log(`\nWelcome back, ${currentID}!`);
    }

    while (true) {
        console.log("\nWhat would you like to do?");
        console.log("1. Scrape my Steam library");
        console.log("2. Generate Markdown files from previous scrape");
        console.log("3. Scrape and create Markdown files");
        console.log("4. Change Steam ID");
        console.log("5. Exit");

        const choice = await question('\nEnter choice (1-5): ');

        if (choice === '1') {
            try { await runScraper(currentID); } catch (e) {}
        
        } else if (choice === '2') {
            await runConversion();
        
        } else if (choice === '3') {
            try { 
                await runScraper(currentID);
                await runConversion();
            } catch (e) {}
        
        } else if (choice === '4') {
            // Force re-entry of ID
            console.log('\nEnter new Steam ID:');
            const newID = await question('Steam ID: ');
            if (newID.trim()) {
                saveSettings({ steamAccountID: newID.trim() });
                currentID = newID.trim();
            }
        } else if (choice === '5') {
            console.log("Bye!");
            rl.close();
            process.exit(0);
        } else {
            console.log("Invalid choice.");
        }
    }
}

main();