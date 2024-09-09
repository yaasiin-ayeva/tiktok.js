# tiktok.js
A Tiktok client library for NodeJS that connects through the TikTok Web browser app

## Installation

```bash
npm install tiktok.js
```

## How to run the script

Kindly set you environment variables from the `.env.test` file.
```bash
cp .env.test .env
```

Replace the CLIENT and PASSWORD variables in the `.env` file with your credentials and run the following command:

```bash	
ts-node src/test.ts
```

## Usage
```ts
import { TikTokClient } from './client';
const dotenv = require('dotenv');
dotenv.config();
const { CLIENT, PASSWORD } = process.env;

(async () => {
    const clientId = CLIENT;
    const client = new TikTokClient();
    await client.authenticate(clientId, CLIENT, PASSWORD);
})();
```

## TODO
- Complete Authentication
- Complete Session Management
- Complete Session Finalization
- Complete Session Refresh
- Complete Session Deletion & Cleanup
- Add upload function
- Add native post schedule function
- Add download function
- Add get function
- Add delete function
- Add search function