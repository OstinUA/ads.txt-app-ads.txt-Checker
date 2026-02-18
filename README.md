# 🛡️ Ads.txt / App-ads.txt & Sellers.json Validator (Chrome Extension)

A comprehensive AdOps utility tool built for Chrome (Manifest V3). It automates the validation of `ads.txt` and `app-ads.txt` files, cross-references inventory against a `sellers.json` registry, and highlights syntax errors or configuration mismatches in real-time.

![Version](https://img.shields.io/badge/version-6.0.0-21aeb3)
![Platform](https://img.shields.io/badge/platform-Chrome_Extension-4285F4?logo=google-chrome&logoColor=white)
![Manifest](https://img.shields.io/badge/manifest-V3-2ea44f)
![Category](https://img.shields.io/badge/category-AdOps-orange)
![License](https://img.shields.io/badge/license-MIT-green)
![Repo Size](https://img.shields.io/github/repo-size/OstinUA/ads.txt-app-ads.txt-sellers.json-Lines-Checker)

## Key Features

### 1. Advanced Parsing & Validation
* **Smart Brand Parsing:** Intelligently extracts the core brand name from complex `sellers.json` URLs (e.g., handles `api.applovin.com` or `cdn.pubmatic.com` correctly by ignoring subdomains).
* **Soft 404 Detection:** Automatically detects when a server returns an HTML error page masquerading as a text file (prevents false positives).
* **Syntax Highlighting:** Flags critical errors, such as commented-out lines or invalid characters that would cause crawlers to ignore the record.
* **Owner Domain Validation:** Validates the `OWNERDOMAIN` field against the actual site URL (Returns: `MATCH`, `MISMATCH`, or `NOT FOUND`).

### 2. Sellers.json Cross-Reference
* **Inventory Matching:** Automatically fetches `sellers.json` (defaults to `adwmg.com`, configurable) with **local caching** (1-hour TTL) to optimize performance.
* **Discrepancy Detection:** Highlights `ads.txt` entries where the Seller ID is **missing** from the associated `sellers.json` file.
* **Real-time Filtering:** Filters lines to show only those related to the configured SSP/Brand.

### 3. UI & UX
* **Live Line Counters:** Tabs now display the exact count of valid lines for `ads.txt` and `app-ads.txt`.
* **Smart Status Badges:** Visual indicators for every line:
    * **(X)** Critical Syntax Error.
    * **(!)** ID Mismatch (Warning).
* **Last Modified Date:** Displays when the file was last updated on the server.
* **Configurable Settings:** Users can set a custom `sellers.json` URL via the settings panel.

## Technical Stack

* **JavaScript (ES6+):** Pure Vanilla JS, modular architecture with shared utilities.
* **Chrome APIs:**
    * `chrome.scripting`: For injecting analysis scripts into the active tab.
    * `chrome.storage.local`: For caching the `sellers.json` file.
    * `chrome.action`: For updating the dynamic badge counter.
* **CSS3:** Custom responsive layout with Flexbox and dark/light mode compatibility elements.

## Installation (Developer Mode)

1.  Clone or download this repository.
2.  Open Chrome and navigate to `chrome://extensions`.
3.  Enable **Developer mode** (toggle in the top right corner).
4.  Click **Load unpacked**.
5.  Select the folder containing `manifest.json`.

## Usage

1.  Navigate to any website (e.g., `nytimes.com`).
2.  The extension icon will update with a number indicating valid lines found for the configured SSP.
3.  Click the icon to open the popup:
    * **Tab 1 (sellers.json):** Shows matched records from the SSP's registry.
    * **Tab 2 (ads.txt):** Shows the site's ads.txt content with syntax highlighting.
    * **Tab 3 (app-ads.txt):** Same analysis for mobile app inventory.
4.  **Settings:** Click the `⠸` icon to change the target `sellers.json` URL or force refresh the cache.

## Project Structure

├── background.js      # Service worker: handles caching, badges, and timers
├── utils.js           # Shared logic: domain parsing, normalization (DRY principle)
├── manifest.json      # Extension configuration (V3)
├── popup.html         # Main UI structure
├── popup.css          # Styling (Tabs, Warnings, Badges)
└── popup.js           # Core UI logic, parsing, and rendering