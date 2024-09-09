import puppeteer, { Browser, Page } from 'puppeteer';
import * as crypto from 'crypto';
const fs = require('fs');
const path = require('path');

export class TikTokClient {
    private browser: Browser | null = null;
    private page: Page | null = null;
    private sessionBasePath: string;

    constructor(sessionBasePath: string = './.tiktokjs_auth/sessions') {
        this.sessionBasePath = sessionBasePath;
    }

    // Function to hash the clientId using SHA-256
    private hashClientId(clientId: string): string {
        return crypto.createHash('sha256').update(clientId).digest('hex');
    }

    // Get the session folder path for each client
    private getUserSessionPath(clientId: string): string {
        const hashedClientId = this.hashClientId(clientId);
        return path.join(this.sessionBasePath, hashedClientId);
    }

    // Use the hashed clientId to name the session cookie file
    private getSessionFilePath(clientId: string): string {
        return path.join(this.getUserSessionPath(clientId), 'cookies.json');
    }

    // Initialize Puppeteer with user-specific session
    async initialize(clientId: string, params: { headless: boolean } = { headless: true }) {
        const userSessionPath = this.getUserSessionPath(clientId);
        this.browser = await puppeteer.launch({
            ...params,
            userDataDir: userSessionPath, // Each user has a unique session directory
        });
        this.page = await this.browser.newPage();
        await this.page.goto('https://www.tiktok.com/');
        console.log(`Navigated to https://www.tiktok.com/ for client ${clientId}`);
    }

    // Close the browser session
    async close() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
            this.page = null;
        }
    }

    // Save session cookies to a file for a specific client
    private async saveSession(clientId: string) {
        if (!this.page) throw new Error("Browser not initialized.");
        const cookies = await this.page.cookies();
        const sessionFilePath = this.getSessionFilePath(clientId);
        fs.mkdirSync(path.dirname(sessionFilePath), { recursive: true });
        fs.writeFileSync(sessionFilePath, JSON.stringify(cookies, null, 2));
        console.log(`Session cookies saved for client ${clientId}.`);
    }

    // Load session cookies from a file for a specific client
    private async loadSession(clientId: string) {
        const sessionFilePath = this.getSessionFilePath(clientId);
        if (fs.existsSync(sessionFilePath)) {
            const cookiesString = fs.readFileSync(sessionFilePath, 'utf8');
            const cookies = JSON.parse(cookiesString);
            if (this.page) {
                await this.page.setCookie(...cookies);
                console.log(`Session cookies loaded for client ${clientId}.`);
            }
            return cookies;
        }
        return null;
    }

    // Authenticate user with given credentials, saving the session if successful
    async authenticate(clientId: string, username: string, password: string) {
        // Close the browser if it is already open to ensure a fresh session
        await this.close();

        // Start a new session for this user
        await this.initialize(clientId, { headless: false });

        // Load session if it exists
        const cookies = await this.loadSession(clientId);
        const currentUrl = this.page.url();

        // If session cookies are found and the user is logged in, skip re-authentication
        if (cookies && cookies.length > 0 && !currentUrl.includes('https://www.tiktok.com/login/phone-or-email/email')) {
            console.log('Session cookies loaded, no need to authenticate again.');
            return;
        }

        // Perform login if no session exists
        console.log(`Logging in user: ${clientId}`);
        await this.page.goto('https://www.tiktok.com/login/phone-or-email/email');
        await this.page.type('input[name="username"]', username);
        await this.page.type('input[type="password"]', password);

        await this.page.click('button[type="submit"]');
        console.log('Please solve the captcha manually if presented.');

        // Wait for login to complete
        await this.page.waitForNavigation();

        // Check if login was successful and save the session
        const newUrl = this.page.url();
        if (!newUrl.includes('login')) {
            console.log('Login successful, session saved.');
            await this.saveSession(clientId);
        } else {
            console.log('Login failed or captcha required.');
        }
    }

    // Finalize the session by saving it and closing the browser
    async finalizeSession(clientId: string) {
        await this.saveSession(clientId);
        await this.close();
    }
}
