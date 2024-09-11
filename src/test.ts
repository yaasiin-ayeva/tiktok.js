import { TikTokClient } from './client';
const dotenv = require('dotenv');
dotenv.config();
const { CLIENT, PASSWORD } = process.env;

(async () => {
    const client = new TikTokClient();
    await client.authenticate(CLIENT, PASSWORD);
    /*await client.postVideo(
        'video.mp4',
        'This is a sample description with #tags',
    ); */
    const results = await client.searchTag('recre');
    console.log(results);
})();
