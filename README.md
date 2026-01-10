# Tab Limiter for Sites

Chrome extension to limit the number of open tabs per site.

## Setup

1. Open Chrome and navigate to `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked** and select this folder.

## Usage

1. Click **Details** on the extension and open **Extension options**.
2. Add site hostnames (exact match) and a tab limit for each.
3. Save your settings. When the limit is reached, the newest tab for that site will be closed.

Suspended tab URLs (like `chrome-extension://.../suspended.html#...&uri=https://example.com`) are counted toward the original site.
