
## Installation

Clone the repository :

```bash
  git clone https://github.com/preetiguragol/asr-tts
```
Install dependencies: 
```bash
npm install
```

Set up your Deepgram API key:

Create an .env.local file in the root of the project.
Add your Deepgram API key to the .env file:

```bash
DEEPGRAM_API_KEY=your-api-key-here
```

Run the development server :
```bash
npm run dev
```

Run WebSocket Server :
```bash
node backend/sttServer.js
```

Generate Quality Reports :
```bash
node backend/generateReport.js
```