import { TikTokClient } from './client';
const dotenv = require('dotenv');
dotenv.config();
const { CLIENT, PASSWORD } = process.env;

(async () => {
    const clientId = CLIENT;
    const client = new TikTokClient();
    await client.authenticate(clientId, CLIENT, PASSWORD);
})();
