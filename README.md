# Steam Library Scraper
A fast tool to scrape your Steam game library stats into a generic JSON format using [Playwright](https://playwright.dev/).

## Security & Privacy
**Is this safe? Yes.** _But that's exactly what any malicious actor would say..._ This script runs entirely on your local machine. I (the creator) have zero access to your account. I cannot see your password, your QR code, or your library data. Nothing is sent to any external server. You are logging into Steam directly. Playwright simply opens a standard Chromium browser instance on your computer. When you scan the QR code, you are authenticating directly with Valve's servers, exactly the same as if you opened Chrome or Firefox yourself.

### Common Sense Disclaimer
While this script is safe, you should always use common sense when running code from the internet:
- **Read the code.** The logic is contained in `steam-library-scraper.spec.ts`. It is open-source specifically so you can verify that it only scrapes text and does not steal data.
- **Verify the URL.** When the browser opens, check the address bar to ensure you are truly on steamcommunity.com before scanning your QR code.

**If you have doubts, don't run it. Security is your responsibility.**

## Usage Guide
Follow these steps carefully. You do not need to be a programmer to use this!
### Step 0: Pre-requisites
Before you start, make sure you have **Node.js** installed on your computer.
1. Open your terminal (Command Prompt on Windows, Terminal on Mac) and type `node -v`.
2. If it gives you an error, download and install the "LTS" version from [nodejs.org](https://nodejs.org/).
3. Restart your computer if you just installed it.

### Step 1: Install the Tool
1. Download this folder to your computer.
2. Open the folder in your file explorer.
3. Right-click anywhere in the empty space of the folder and select **"Open in Terminal"** (or "Open PowerShell window here").
4. In the black window that pops up, type the following command and press **Enter**:
    ```bash
    npm install && npx playwright install
    ```
    _(This might take a minute as it downloads the necessary browser tools)._

### Step 2: Configure your Settings
1. Find the file named .env.example in the folder.
2. Rename this file to just .env (Remove the .example part).
    - **Note for Windows Users:** If you don't see the .example extension, check `View > Show > File name extensions` in your file explorer.
3. Open the .env file using Notepad or any text editor.
4. Replace `YOUR_ID_HERE` with your own Steam Custom ID.
    - **Where do I find this?** Go to your Steam Profile in a web browser. Your ID is the text at the end of the URL: steamcommunity.com/id/YOUR_ID_HERE.

### Step 3: Run the Scraper
1. Go back to that Terminal/PowerShell window from Step 1.
2. Type this command and press Enter:
    ```Bash
    npm run scrape
    ```

### Step 4: Login & Wait
1. A real browser window (Chromium) will open automatically.
2. It will load the Steam login page. Scan the QR Code using the Steam Mobile App on your phone.
3. Do not touch the mouse after scanning.
4. The script will automatically detect you are logged in, scroll through your games, and save the data.
5. When it says "Done!", check inside the `scrape_results` folder for a new file named SteamScrape_[YourID].json.

## Example Output
```JSON
[
  {
    "name": "The Binding of Isaac: Rebirth",
    "playtime": 1003.9,
    "lastPlayed": 1689552000,   //Last played in Unix Timecode
    "myAchievements": 637,
    "totalAchievements": 641
  },
  {
    "name": "Half-Life 2",
    "playtime": false,          //false is displayed when the game has not been played
    "lastPlayed": false,
    "myAchievements": 0,
    "totalAchievements": 33
  }
]
```
