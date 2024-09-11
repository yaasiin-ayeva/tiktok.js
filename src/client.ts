import { Browser, Page } from 'puppeteer';
import * as crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { URLs, Paths } from './config';
import GestureEngine from './gesture-engine';
import puppeteerExtra from 'puppeteer-extra';
import pluginStealth from 'puppeteer-extra-plugin-stealth';
import randomUserAgent from 'random-useragent';

declare global {
    interface Window {
        chrome: any;
    }
}

const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/73.0.3683.75 Safari/537.36';

export class TikTokClient {
    private browser: Browser | null = null;
    private page: Page | null = null;
    private gestureEngine: GestureEngine | null = null;

    constructor(
        private sessionBasePath: string = Paths.sessionBase,
        private headless: boolean = true
    ) { }

    private hashClientId(clientId: string): string {
        return crypto.createHash('sha256').update(clientId).digest('hex');
    }

    private getUserSessionPath(clientId: string): string {
        return path.join(this.sessionBasePath, this.hashClientId(clientId));
    }

    private getSessionFilePath(clientId: string): string {
        return path.join(this.getUserSessionPath(clientId), Paths.cookiesFile);
    }

    async initialize(clientId: string, params: { headless?: boolean } = {}) {
        const userSessionPath = this.getUserSessionPath(clientId);
        const isHeadless = params.headless !== undefined ? params.headless : this.headless;

        puppeteerExtra.use(pluginStealth());

        this.browser = await puppeteerExtra.launch({
            headless: isHeadless,
            userDataDir: userSessionPath,
        });

        const userAgent = randomUserAgent.getRandom() || USER_AGENT;
        this.page = await this.browser.newPage();
        await this.page.setUserAgent(userAgent);
        await this.page.setJavaScriptEnabled(true);
        await this.page.setDefaultNavigationTimeout(0);

        await this.page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => false });
            if (!window.chrome) window.chrome = {};
            if (!window.chrome.runtime) window.chrome.runtime = {};
            Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
            Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
        });

        await this.page.goto(URLs.base, { waitUntil: 'networkidle2', timeout: 0 });
        console.log(`Navigated to ${URLs.base} for client ${clientId}`);

        this.gestureEngine = new GestureEngine(this.page);
    }

    async close() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
            this.page = null;
        }
    }

    private async saveSession(clientId: string) {
        if (!this.page) throw new Error("Browser not initialized.");
        const cookies = await this.page.cookies();
        const sessionFilePath = this.getSessionFilePath(clientId);
        fs.mkdirSync(path.dirname(sessionFilePath), { recursive: true });
        fs.writeFileSync(sessionFilePath, JSON.stringify(cookies, null, 2));
        console.log(`Session cookies saved for client ${clientId}.`);
    }

    private async loadSession(clientId: string) {
        const sessionFilePath = this.getSessionFilePath(clientId);
        if (fs.existsSync(sessionFilePath)) {
            const cookies = JSON.parse(fs.readFileSync(sessionFilePath, 'utf8'));
            if (this.page) {
                await this.page.setCookie(...cookies);
                console.log(`Session cookies loaded for client ${clientId}.`);
            }
            return cookies;
        }
        return null;
    }

    async authenticate(clientId: string, password: string) {
        await this.close();
        await this.initialize(clientId, { headless: false });

        const cookies = await this.loadSession(clientId);
        const currentUrl = this.page?.url() || '';

        if (cookies && cookies.length > 0 && !currentUrl.includes(URLs.login)) {
            console.log('Session cookies loaded, no need to authenticate again.');
            return;
        }

        console.log(`Logging in user: ${clientId}`);
        await this.page.goto(URLs.login);
        await this.gestureEngine!.typeText('input[name="username"]', clientId);
        await this.gestureEngine!.typeText('input[type="password"]', password);
        await this.gestureEngine!.click('button[type="submit"]');
        console.log('Attempting login and CAPTCHA resolution if necessary.');

        await this.page.waitForNavigation();

        const newUrl = this.page.url();
        if (!newUrl.includes('login')) {
            console.log('Login successful, session saved.');
            await this.saveSession(clientId);
        } else {
            console.log('Login failed or CAPTCHA still required.');
        }
    }

    async finalizeSession(clientId: string) {
        await this.saveSession(clientId);
        await this.close();
    }

    async toggleHeadless(clientId: string) {
        await this.close();
        this.headless = !this.headless;
        await this.initialize(clientId, { headless: this.headless });
        console.log(`Switched to ${this.headless ? 'headless' : 'non-headless'} mode for client ${clientId}`);
    }

    async postVideo(videoPath: string, description: string) {
        if (!this.page) throw new Error("Browser not initialized.");

        await this.page.goto(URLs.upload_creator_center, { waitUntil: 'networkidle2' });

        await this.gestureEngine!.click('button[aria-label="Select video"]');
        console.log('Clicked "Select video" button.');

        const [fileChooser] = await Promise.all([
            this.page.waitForFileChooser(),
            this.gestureEngine!.click('button[aria-label="Select video"]'),
        ]);
        await fileChooser.accept([path.resolve(videoPath)]);
        console.log('Video file selected.');

        await this.page.waitForSelector('.info-progress-num', { visible: true });
        await this.page.waitForFunction(() => {
            const progressText = document.querySelector('.info-progress-num')?.textContent;
            return progressText === '100%';
        });
        console.log('Video upload complete.');

        await this.page.focus('.public-DraftEditor-content[contenteditable="true"]');
        await this.page.click('.public-DraftEditor-content[contenteditable="true"]');
        await this.gestureEngine!.typeText('.public-DraftEditor-content[contenteditable="true"]', description);
        console.log('Entered description and tags.');

        await this.gestureEngine!.scrollPage(300, { min: 100, max: 500 });
        await this.page.focus('input[name="postSchedule"][value="schedule"]');

        await this.page.click('.TUXSelect-button');

        await this.page.waitForSelector('.TUXSelect-buttonText');
        const options = await this.page.$$('.TUXSelect-buttonText');

        for (const option of options) {
            const optionText = await this.page.evaluate(el => el.textContent.trim(), option);
            if (optionText === "Everyone") {
                await option.click();
                console.log('Selected "Everyone".');
                break;
            }
        }

        await this.page.click('.button-group button:first-child');
        console.log('Clicked the "Post" button.');

        await this.page.waitForSelector('.common-modal-header', { visible: true });
        console.log('Video posted successfully.');
    }
    async searchTag(tag: string): Promise<string[]> {
        if (!this.page) throw new Error("Browser not initialized.");
    
        const searchUrl = `${URLs.base}tag/${encodeURIComponent(tag)}`;
        await this.page.goto(searchUrl, { waitUntil: 'networkidle2' });
        console.log(`Navigated to tag search: ${searchUrl}`);
    
        await new Promise(resolve => setTimeout(resolve, 5000));
    
        console.log(`Fetching your results for tag ${tag}. This will take approximately 2 mins`);
    
        for (let i = 0; i < 10; i++) {
            console.log(`Scrolling... (${i + 1}/10)`); // Message simple à chaque défilement.
            await this.gestureEngine!.scrollPage(5000);
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    
        const results = await this.page.evaluate(() => {
            const itemList = document.querySelector('div[data-e2e="challenge-item-list"]');
            if (!itemList) return [];
    
            const individualPosts = itemList.querySelectorAll('div > div > div');
    
            return Array.from(individualPosts).map(post => {
                const lastDiv = post.querySelector('div > div > div:last-child');
                const link = lastDiv?.querySelector('a');
                return link ? link.href : '';
            }).filter(href => href);
        });
    
        console.log(`Total fetched posts: ${results.length} for tag: ${tag}`);
        return results;
    }
    
}