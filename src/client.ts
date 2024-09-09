import puppeteer, { Browser, Page } from 'puppeteer';
import * as crypto from 'crypto';
const fs = require('fs');
const path = require('path');
import { URLs, Paths } from './config';
import GestureEngine from './gesture-engine';

export class TikTokClient {
    private browser: Browser | null = null;
    private page: Page | null = null;
    private sessionBasePath: string;
    private headless: boolean;
    private gestureEngine: GestureEngine | null = null;

    constructor(sessionBasePath: string = Paths.sessionBase, headless: boolean = true) {
        this.sessionBasePath = sessionBasePath;
        this.headless = headless;
    }

    /**
     * Hash the client ID
     * @param clientId the client ID for which to hash
     * @returns the hashed client ID
     */
    private hashClientId(clientId: string): string {
        return crypto.createHash('sha256').update(clientId).digest('hex');
    }

    /**
     * Get the session folder path for each client
     * @param clientId the client ID for which to get the session folder path
     * @returns the session folder path
     */
    private getUserSessionPath(clientId: string): string {
        const hashedClientId = this.hashClientId(clientId);
        return path.join(this.sessionBasePath, hashedClientId);
    }

    /**
     * Get the session cookie file path for each client 
     * @param clientId the client ID for which to get the session file path
     * @returns the session cookie file path
     */
    private getSessionFilePath(clientId: string): string {
        return path.join(this.getUserSessionPath(clientId), Paths.cookiesFile);
    }

    /**
     * Initializes the browser for the given client.
     * @param clientId - The client ID for which to initialize the browser
     * @param params - Optional parameters for the browser initialization
     */
    async initialize(clientId: string, params: { headless?: boolean } = {}) {
        const userSessionPath = this.getUserSessionPath(clientId);
        const isHeadless = params.headless !== undefined ? params.headless : this.headless;

        this.browser = await puppeteer.launch({
            headless: isHeadless,
            userDataDir: userSessionPath, // Each user has a unique session directory
        });
        this.page = await this.browser.newPage();
        await this.page.goto(URLs.base);
        console.log(`Navigated to ${URLs.base} for client ${clientId}`);
        this.gestureEngine = new GestureEngine(this.page);
        // await this.gestureEngine!.goTo(URLs.base, { min: 1000, max: 2000 });
    }

    /**
     * Closes the browser.
     * @returns a promise that resolves when the browser is closed
     */
    async close() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
            this.page = null;
        }
    }

    /**
     * Saves session cookies for the given client.
     * @param clientId the client ID for which to save the session
     */
    private async saveSession(clientId: string) {
        if (!this.page) throw new Error("Browser not initialized.");
        const cookies = await this.page.cookies();
        const sessionFilePath = this.getSessionFilePath(clientId);
        fs.mkdirSync(path.dirname(sessionFilePath), { recursive: true });
        fs.writeFileSync(sessionFilePath, JSON.stringify(cookies, null, 2));
        console.log(`Session cookies saved for client ${clientId}.`);
    }

    /**
     * Loads session cookies for the given client.
     * @param clientId the client ID for which to load the session
     * @returns a promise that resolves to an array of cookies for the client
     */
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

    /**
     * Authenticates a user with the given credentials.
     * @param clientId the client ID for which to authenticate (used to save the session)
     * @param password the password for the user
     * @returns a promise that resolves when the authentication is complete
     */
    async authenticate(clientId: string, password: string) {

        // Close the browser if it is already open to ensure a fresh session
        await this.close();

        // Start a new session for this user
        await this.initialize(clientId, { headless: false });

        // Load session if it exists
        const cookies = await this.loadSession(clientId);
        const currentUrl = this.page.url();

        if (cookies && cookies.length > 0 && !currentUrl.includes(URLs.login)) {
            console.log('Session cookies loaded, no need to authenticate again.');
            return;
        }

        // Perform login if no session exists
        console.log(`Logging in user: ${clientId}`);
        await this.page.goto(URLs.login);
        // await this.gestureEngine!.goTo(URLs.base, { min: 1000, max: 2000 }, null);

        await this.gestureEngine!.typeText('input[name="username"]', clientId);
        await this.gestureEngine!.typeText('input[type="password"]', password);
        await this.gestureEngine!.click('button[type="submit"]');
        console.log('Please solve the captcha manually if presented.');

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

    /**
     * Forces in saving the session for the given client and closes the browser.
     * @param clientId The client ID for which to save the session.
     */
    async finalizeSession(clientId: string) {
        await this.saveSession(clientId);
        await this.close();
    }

    /**
     * Toggles between headless and non-headless mode for the given client.
     * This actually closes the browser and opens a new one with the new mode.
     * @param clientId The client ID for which to toggle headless mode.
     */
    async toggleHeadless(clientId: string) {
        await this.close();
        this.headless = !this.headless;
        await this.initialize(clientId, { headless: this.headless });
        console.log(`Switched to ${this.headless ? 'headless' : 'non-headless'} mode for client ${clientId}`);
    }

    /**
     * Posts a video on schedule.
     * @param videoPath - The path of the video file to upload
     * @param description - The description and tags for the video
     * @param scheduleDate - The date to schedule the post (YYYY-MM-DD)
     * @param scheduleTime - The time to schedule the post (HH:mm)
     */
    async postScheduledVideo(videoPath: string, description: string, scheduleDate: string, scheduleTime: string) {
        if (!this.page) throw new Error("Browser not initialized.");

        // Navigate to the upload page
        // await this.gestureEngine!.goTo(URLs.upload_creator_center, { min: 1000, max: 2000 }, 'networkidle2');
        await this.page.goto(URLs.upload_creator_center, { waitUntil: 'networkidle2' });

        // Click the "Select video" button
        await this.gestureEngine!.click('button[aria-label="Select video"]');
        // await this.page.click('button[aria-label="Select video"]');
        console.log('Clicked "Select video" button.');

        // Upload video by selecting the file
        const [fileChooser] = await Promise.all([
            this.page.waitForFileChooser(),
            this.gestureEngine!.click('button[aria-label="Select video"]'),
            // this.page.click('button[aria-label="Select video"]'),
        ]);
        await fileChooser.accept([path.resolve(videoPath)]);
        console.log('Video file selected.');

        // Wait for the video to finish uploading (progress bar reaches 100%)
        await this.page.waitForSelector('.info-progress-num', { visible: true });
        await this.page.waitForFunction(() => {
            const progressText = document.querySelector('.info-progress-num')?.textContent;
            return progressText === '100%';
        });
        console.log('Video upload complete.');

        // Enter description and tags
        await this.page.focus('.public-DraftEditor-content[contenteditable="true"]');
        await this.page.click('.public-DraftEditor-content[contenteditable="true"]');
        await this.gestureEngine!.typeText('.public-DraftEditor-content[contenteditable="true"]', description);
        // await this.page.keyboard.type(description);
        console.log('Entered description and tags.');

        await this.gestureEngine!.scrollPage(300, { min: 100, max: 500 });
        await this.page.focus('input[name="postSchedule"][value="schedule"]');

        // Select the "Schedule" option
        await this.gestureEngine!.click('input[name="postSchedule"][value="schedule"]');
        // await this.page.click('input[name="postSchedule"][value="schedule"]');
        console.log('Selected schedule option.');

        // // Set the date
        // await this.page.focus('input[id=":r35:"]');
        // await this.page.keyboard.type(scheduleDate);
        // console.log(`Scheduled date set to ${scheduleDate}.`);

        // // Set the time
        // await this.page.focus('input[id=":r34:"]');
        // await this.page.keyboard.type(scheduleTime);
        // console.log(`Scheduled time set to ${scheduleTime}.`);

        // Set the date (Using class selector as fallback)
        // use current date as selector to prevent using dynamic ids selectors 
        const currentDateString = new Date().toISOString().split('T')[0];
        await this.page.focus(`input.TUXTextInputCore-input[value="${currentDateString}"]`);
        await this.page.keyboard.type(scheduleDate);

        // Set the time (Using class selector as fallback)
        // await this.page.focus('input.TUXTextInputCore-input[value="07:50"]');
        // await this.page.keyboard.type(scheduleTime);

        // Click the "Post" button to schedule the video
        await this.page.click('button[type="button"] .TUXButton-label:contains("Post")');
        console.log('Clicked the "Post" button.');

        // Wait for confirmation that the video has been scheduled
        await this.page.waitForSelector('.common-modal-header', { visible: true });
        console.log('Video scheduled successfully.');
    }
}
