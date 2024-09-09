import { Page } from 'puppeteer';

/**
 * Mouse and touch gesture engine for puppeteer pages
 * @param page - The puppeteer page to use 
 */
export default class GestureEngine {
    private static instance: GestureEngine | null = null;

    constructor(private page: Page) {
        if (GestureEngine.instance) {
            return GestureEngine.instance;
        }
        GestureEngine.instance = this;
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

    async scrollPage(scrollAmount: number = 100, { min = 100, max = 500 }: { min?: number, max?: number } = {}) {
        const scrollInterval = setInterval(async () => {
            await this.page.evaluate(amount => window.scrollBy(0, amount), scrollAmount);
            await this.waitRandomTime(min, max);
        }, 1000);

        await this.waitRandomTime(2000, 3000);
        clearInterval(scrollInterval);
    }

    async typeText(selector: string, text: string, typeDelay: { min: number, max: number } = { min: 50, max: 150 }) {
        await this.page.waitForSelector(selector);
        await this.page.focus(selector);
        for (const char of text) {
            await this.page.keyboard.type(char);
            await this.waitRandomTime(typeDelay.min, typeDelay.max);
        }
    }

    async click(selector: string) {
        await this.page.waitForSelector(selector);
        await this.page.click(selector);
    }

    static getInstance(page: Page) {
        if (!GestureEngine.instance) {
            GestureEngine.instance = new GestureEngine(page);
        }
        return GestureEngine.instance;
    }
}
