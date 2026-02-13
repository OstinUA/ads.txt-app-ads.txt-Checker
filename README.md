# 🛡️ Ads.txt / App-ads.txt & Sellers.json Validator (Chrome Extension)

A comprehensive AdOps utility tool built for Chrome (Manifest V3). It automates the validation of `ads.txt` and `app-ads.txt` files, cross-references inventory against a `sellers.json` registry, and highlights syntax errors or configuration mismatches in real-time.

![Version](https://img.shields.io/badge/version-6.0.0-3e5f8a)
![Platform](https://img.shields.io/badge/platform-Chrome_Extension-4285F4?logo=google-chrome&logoColor=white)
![Manifest](https://img.shields.io/badge/manifest-V3-2ea44f)
![Category](https://img.shields.io/badge/category-AdOps-orange)
![License](https://img.shields.io/badge/license-MIT-green)
![Repo Size](https://img.shields.io/github/repo-size/OstinUA/ads.txt-app-ads.txt-sellers.json-Lines-Checker)

## Key Features

### 1. File Validation & Parsing
* **Dual-File Check:** Automatically fetches and parses both `ads.txt` and `app-ads.txt` for the current domain.
* **Syntax Highlighting:** Detects and flags critical syntax errors (e.g., lines starting with invalid characters) that would cause crawlers to ignore the record.
* **Owner Domain Validation:** Checks the `OWNERDOMAIN` field against the actual site domain to ensure authorization (Returns: `OK`, `MISMATCH`, or `MISSING`).

### 2. Sellers.json Cross-Reference
* **Inventory Matching:** Automatically fetches `sellers.json` (defaults to `yoursite.com`, configurable) and caches it.
* **Discrepancy Detection:** Highlights `ads.txt` entries where the Seller ID is **missing** from the associated `sellers.json` file (Logic Warning).
* **Brand Filtering:** One-click filter to show only lines related to a specific SSP/Brand.

### 3. UI & UX
* **Smart Badge:** Displays the count of valid matched lines directly on the extension icon.
* **Tabbed Interface:** Separate views for `sellers.json` matches, `ads.txt`, and `app-ads.txt`.
* **Last Modified Date:** Displays when the file was last updated on the server.
* **Configurable Settings:** Users can set a custom `sellers.json` URL via the settings panel.

## Technical Stack

* **JavaScript (ES6+):** Pure Vanilla JS, no external frameworks.
* **Chrome APIs:**
    * `chrome.scripting`: For injecting analysis scripts into the active tab.
    * `chrome.storage.local`: For caching the `sellers.json` file to reduce network requests.
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
        * **Red (X):** Critical Syntax Error.
        * **Pink (!):** ID Mismatch (ID exists in text but not in sellers.json).
    * **Tab 3 (app-ads.txt):** Same analysis for mobile app inventory.
4.  **Settings:** Click the `⠸` icon to change the target `sellers.json` URL (Default: `https://yoursite.com/sellers.json`).

## Validation Logic Details

The extension performs the following checks on every line:

```javascript
// Example Logic Flow
if (line.includes(brand)) {
    // 1. Syntax Check
    if (line_starts_with_invalid_char) {
        mark_critical_error("Ignored by crawlers");
    }
    
    // 2. ID Validation
    const sellerId = extract_id(line);
    if (!sellersJson.contains(sellerId)) {
        mark_warning("ID not found in sellers.json");
    }
}```

## Project Structure

├── background.js      # Service worker: handles caching, badges, and timers
├── content_script.js  # Injects into page to fetch local files
├── manifest.json      # Extension configuration (V3)
├── popup.html         # Main UI structure
├── popup.css          # Styling (Tabs, Warnings, Badges)
└── popup.js           # Core UI logic, parsing, and rendering