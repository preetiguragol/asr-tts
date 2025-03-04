require("dotenv").config({ path: require("path").resolve(__dirname, "../.env.local") });
const { createClient, LiveTranscriptionEvents } = require("@deepgram/sdk");
const WebSocket = require("ws");
const fs = require("fs");
const path = require("path");
const wav = require("wav");

if (!process.env.DEEPGRAM_API_KEY) {
    console.error("ERROR: Deepgram API Key is missing!");
    process.exit(1);
}

const deepgram = createClient(process.env.DEEPGRAM_API_KEY);
const wss = new WebSocket.Server({ port: 5000 });

wss.on("connection", (ws) => {
    console.log("Client connected");

    // Prepare file paths
    const timestamp = Date.now();
    const audioFilePath = path.resolve(__dirname, `../public/audio/recording_${timestamp}.wav`);
    const transcriptDir = path.resolve(__dirname, "../public/transcript");
    const csvPath = path.resolve(transcriptDir, `transcripts.csv`);

    // Create transcript directory if it doesn't exist
    if (!fs.existsSync(transcriptDir)) {
        fs.mkdirSync(transcriptDir, { recursive: true });
    }

    const writer = new wav.FileWriter(audioFilePath, {
        channels: 1,
        sampleRate: 48000,
        bitDepth: 16,
    });

    const connection = deepgram.listen.live({
        model: "nova-3",
        language: "en-US",
        smart_format: true,
        punctuate: true,
        diarize: true,
        encoding: "linear16",
        sample_rate: 48000,
    });

    const transcriptData = [];

    connection.on(LiveTranscriptionEvents.Open, () => {
        console.log("Deepgram connection opened.");
        ws.send(JSON.stringify({ status: "ready" }));
    });

    connection.on(LiveTranscriptionEvents.Transcript, (data) => {
        if (data.channel.alternatives[0].transcript) {
            const transcriptEntry = {
                transcript: data.channel.alternatives[0].transcript,
                channel: data.channel,
            };
            transcriptData.push(transcriptEntry);
            ws.send(JSON.stringify(transcriptEntry));
        }
    });

    connection.on(LiveTranscriptionEvents.Close, () => {
        console.log("Deepgram connection closed.");

        // Prepare CSV content
        const csvContent = transcriptData
            .map((entry) =>
                entry.channel.alternatives[0].words
                    .map((word) => `Speaker ${word.speaker + 1},${word.start},${word.end},"${word.word}"`)
                    .join("\n")
            )
            .join("\n");

        // Create CSV file if not exists and add header
        const header = `Speaker,Start,End,Word\n`;
        if (!fs.existsSync(csvPath)) {
            fs.writeFileSync(csvPath, header);
        }

        // Append new transcript to the CSV file
        fs.appendFileSync(csvPath, `${csvContent}\n`);
        console.log(`Transcript appended to ${csvPath}`);

        writer.end();
    });

    connection.on(LiveTranscriptionEvents.Error, (err) => {
        console.error("Deepgram Error:", err.message);
    });

    ws.on("message", (message) => {
        if (message instanceof Buffer && message.length > 0) {
            connection.send(message);
            writer.write(message); // Save audio to file
        }
    });

    ws.on("close", () => {
        console.log("Client disconnected");
        connection.finish();
        writer.end();
    });
});

console.log("STT Server running on ws://localhost:5000");
