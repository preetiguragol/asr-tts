
# ASR using Deepgram

This is a Next.js app that records audio via microphone, streams it to Deepgram for real-time transcription with speaker diarization, and saves both the audio and transcripts in CSV format for analysis and can generate a quality report.

## Features

- Live Audio Recording: Record audio directly from the browser.
- Real-time Transcription: Uses Deepgram API for accurate and fast transcription with speaker diarization.
- CSV Export: Saves transcripts in a CSV file with speaker labels and timestamps.
- Quality Report: Generates a JSON report with transcription stats and timing info.

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