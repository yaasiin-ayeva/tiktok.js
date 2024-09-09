import puppeteer, { Browser, Page } from 'puppeteer';

/**
 * Mouse and touch gesture engine for puppeteer pages
 * @param page - The puppeteer page to use 
 */
export default class GestureEngine {
    private page: Page;

    public static instance: GestureEngine | null = null;

    constructor(page: Page) {
        this.page = page;
        if (!GestureEngine.instance) {
            GestureEngine.instance = this;
        } else {
            return GestureEngine.instance;
        }
    }

    /**
     * Waits for a random time between min and max milliseconds.
     * @param min Minimum time in milliseconds
     * @param max Maximum time in milliseconds
     */
    private async waitRandomTime(min: number, max: number) {
        const delay = Math.floor(Math.random() * (max - min + 1)) + min;
        await new Promise(resolve => setTimeout(resolve, delay));
    }

    /**
     * Scroll page
     * @param scrollAmount Scroll amount
     * @param stepDelay Step delay
     */
    async scrollPage(scrollAmount: number = 100, stepDelay: { min: number, max: number } = { min: 100, max: 500 }) {
        await this.page.evaluate((scrollAmount) => {
            window.scrollBy(0, scrollAmount);
        }, scrollAmount);

        await this.waitRandomTime(stepDelay.min, stepDelay.max);
    }

    /**
     * Move mouse to position x and y
     * @param x Position x
     * @param y Position y
     * @param moveDelay Move delay
     */
    async moveMouse(x: number, y: number, moveDelay: { min: number, max: number } = { min: 50, max: 200 }) {
        await this.page.mouse.move(x, y);
        await this.waitRandomTime(moveDelay.min, moveDelay.max);
    }

    /**
     * Click on element with selector
     * @param selector Element selector
     * @param clickDelay Click delay
     */
    async click(selector: string, clickDelay: { min: number, max: number } = { min: 100, max: 300 }) {
        await this.page.click(selector);
        await this.waitRandomTime(clickDelay.min, clickDelay.max);
    }

    /**
     * Type text on element
     * @param selector Element selector
     * @param text Text to type
     * @param typeDelay Type delay
     */
    async typeText(selector: string, text: string, typeDelay: { min: number, max: number } = { min: 50, max: 150 }) {
        await this.page.focus(selector);
        for (const char of text) {
            await this.page.keyboard.type(char);
            await this.waitRandomTime(typeDelay.min, typeDelay.max);
        }
    }

    /**
     * Smoothly navigate to url
     * @param url Url to navigate to
     */
    async goTo(url: string, gotoDelay: { min: number, max: number } = { min: 1000, max: 2000 }, waitUntil: 'load' | 'domcontentloaded' | 'networkidle2' | 'networkidle0' = 'networkidle0',) {
        await this.waitRandomTime(gotoDelay.min, gotoDelay.max);
        if (waitUntil) {
            await this.page.goto(url, { waitUntil, timeout: 0 });
        } else {
            await this.page.goto(url);
        }
    }
}
