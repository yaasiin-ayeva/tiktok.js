import { TikTokClient } from './client';
const dotenv = require('dotenv');
dotenv.config();
const { CLIENT, PASSWORD } = process.env;

(async () => {
    const client = new TikTokClient();
    await client.authenticate(CLIENT, PASSWORD);
    await client.postScheduledVideo(
        'video.mp4',
        'This is a sample description with #tags',
        '2024-09-09',
        '08:00'
    );
})();
