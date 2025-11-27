/**
 * !!! FIX FOR 'fs' ERROR !!!
 * If you see "Cannot find module 'fs'", run this in your terminal:
 * npm install --save-dev @types/node
 * * OTHER PREREQUISITES:
 * npm install playwright
 * npx playwright install
 */
import { test, expect, type Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path'; // Added path module for safe file paths
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Configure test to run with a visible browser
test.use({ headless: false });

// --- CONFIGURATION ---
const ACCOUNT_ID = process.env.STEAM_ACCOUNT_ID;

if (!ACCOUNT_ID) {
    throw new Error("❌ CONFIGURATION ERROR: STEAM_ACCOUNT_ID is missing. Please create a .env file and set your Steam ID.");
}

const STEAM_PAGE = `https://steamcommunity.com/id/${ACCOUNT_ID}/games/?tab=all`;

interface GameData {
    name: string;
    playtime: number | false;       // Hours (or false if 0)
    lastPlayed: number | false;     // Unix Timestamp (or false if never)
    myAchievements: number;
    totalAchievements: number;
}

/**
 * Helper: Scroll to bottom to trigger lazy loading
 */
async function scrollPage(page: Page) {
    console.log("Scrolling to load all games...");
    for (let i = 0; i < 8; i++) { 
        await page.keyboard.press("End");
        await page.waitForTimeout(1000);
    }
}

/**
 * Helper: Generate formatted timestamp (YYYY-MM-DD HHmm)
 */
function getTimestamp(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    
    return `${year}-${month}-${day} ${hours}${minutes}`;
}

test('Scrape Steam Games', async ({ page }) => {
    test.setTimeout(180000); // 3 minutes timeout

    // --- FILE SETUP ---
    const outputDir = 'scrape_results';
    const timestamp = getTimestamp();
    const fileName = `SteamScrape_${ACCOUNT_ID}_${timestamp}.json`;
    const outputPath = path.join(outputDir, fileName);

    // Ensure the directory exists
    if (!fs.existsSync(outputDir)){
        fs.mkdirSync(outputDir, { recursive: true });
    }

    // 1. Navigate
    console.log(`Targeting Steam Account: ${ACCOUNT_ID}`);
    console.log("Navigating...");
    await page.goto(STEAM_PAGE);

    // 2. Wait for Login
    console.log("\nPlease log in! Waiting up to 45 seconds for the games list to appear...");
    try {
        await expect(page.getByText('All Games').first()).toBeVisible({ timeout: 45000 });
        console.log("Login detected! Games list visible.");
    } catch (e) {
        console.log("Timed out waiting for login. Make sure you scanned the QR code.");
        return;
    }

    // 3. Scroll
    await scrollPage(page);

    // 4. Locate Games
    const specificGameRows = page.locator('div[role="button"]').filter({ has: page.locator('img') });
    const count = await specificGameRows.count();
    console.log(`\nFound ${count} games. Extracting data...`);

    // 5. Bulk Extraction (Browser-Side)
    const gamesData: GameData[] = await specificGameRows.evaluateAll((gameDivs: HTMLElement[]) => {
        return gameDivs.map((div: HTMLElement) => {
            
            // --- Helper Functions (Browser Context) ---
            const cleanText = (text: string, label: string) => text.replace(label, "").trim();

            const findTextInRow = (root: HTMLElement, searchText: string) => {
                const allEls = Array.from(root.querySelectorAll('*'));
                const labelEl = allEls.find(el => el.textContent?.trim() === searchText);
                if (labelEl && labelEl.parentElement) return labelEl.parentElement.innerText;
                return "N/A";
            };

            // Parse "1,003.9 hours" -> 1003.9
            const parsePlaytime = (str: string): number | false => {
                if (!str || str === "N/A" || str === "0 hours") return false;
                const cleanStr = str.replace(/,/g, '');
                let hours = 0;
                if (cleanStr.includes('minutes')) hours = parseFloat(cleanStr) / 60;
                else hours = parseFloat(cleanStr);
                
                if (isNaN(hours) || hours === 0) return false;
                return Math.round(hours * 100) / 100;
            };

            // Parse Date -> Unix Timestamp
            const parseLastPlayed = (str: string): number | false => {
                if (!str || str === "Never" || str === "N/A") return false;
                const now = new Date();
                let date: Date;

                if (str === "Today") date = now;
                else if (str === "Yesterday") {
                    date = new Date(now);
                    date.setDate(now.getDate() - 1);
                } else {
                    let dateStr = str;
                    if (!/\d{4}$/.test(dateStr)) dateStr += ` ${now.getFullYear()}`;
                    date = new Date(dateStr);
                }
                return Math.floor(date.getTime() / 1000);
            };

            // Parse "637/641" -> {my, total}
            const parseAchievements = (str: string) => {
                if (!str || str === "N/A") return { my: 0, total: 0 };
                const parts = str.split('/');
                if (parts.length === 2) return { my: parseInt(parts[0].trim()), total: parseInt(parts[1].trim()) };
                return { my: 0, total: 0 };
            };

            // --- Extraction ---
            let name = "N/A";
            const img = div.querySelector('img');
            if (img && img.alt) name = img.alt;
            else {
                const link = div.querySelector('a');
                if (link && link.innerText) name = link.innerText;
            }

            const rawPlaytime = findTextInRow(div, "TOTAL PLAYED");
            const playtime = parsePlaytime(rawPlaytime !== "N/A" ? cleanText(rawPlaytime, "TOTAL PLAYED") : "0 hours");

            const rawLastPlayed = findTextInRow(div, "LAST PLAYED");
            const lastPlayed = parseLastPlayed(rawLastPlayed !== "N/A" ? cleanText(rawLastPlayed, "LAST PLAYED") : "Never");

            const rawAch = findTextInRow(div, "ACHIEVEMENTS");
            const achievements = parseAchievements(rawAch !== "N/A" ? cleanText(rawAch, "ACHIEVEMENTS") : "N/A");

            return { name, playtime, lastPlayed, myAchievements: achievements.my, totalAchievements: achievements.total };
        });
    });

    // 6. Write JSON
    console.log(`Extracted ${gamesData.length} items. Writing to JSON...`);
    
    // Write using the new outputPath
    fs.writeFileSync(outputPath, JSON.stringify(gamesData, null, 2), { encoding: 'utf-8' });
    
    console.log(`Done! Saved to ${outputPath}`);
});