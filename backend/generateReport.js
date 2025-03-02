require("dotenv").config({ path: require("path").resolve(__dirname, "../.env.local") });
const { createClient, LiveTranscriptionEvents } = require("@deepgram/sdk");
const WebSocket = require("ws");
const fs = require("fs");
const path = require("path");
const wav = require("wav");

// Check for Deepgram API Key
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

      
        const header = `Speaker,Start,End,Word\n`;
        if (!fs.existsSync(csvPath)) {
            fs.writeFileSync(csvPath, header);
        }

     
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
            writer.write(message); 
        }
    });

    ws.on("close", () => {
        console.log("Client disconnected");
        connection.finish();
        writer.end();
    });
});

console.log("STT Server running on ws://localhost:5000");


const transcriptsPath = path.resolve(__dirname, "../public/transcript/transcripts.csv");
const sttAudioDir = path.resolve(__dirname, "../public/audio");
const reportPath = path.resolve(__dirname, "../qualityReport.json");

function getEarliestFileTime(dir) {
    const files = fs.readdirSync(dir);
    if (files.length === 0) return null;

    return files
        .map((file) => ({
            file,
            time: fs.statSync(path.join(dir, file)).birthtime
        }))
        .sort((a, b) => a.time - b.time)[0].time;
}

function getFirstTranscriptTime(firstAudioTime) {
    if (!fs.existsSync(transcriptsPath)) return null;
    if (!firstAudioTime) return null;  

    const lines = fs.readFileSync(transcriptsPath, "utf-8").split("\n").filter(Boolean);
    if (lines.length <= 1) return null;  


    const firstLine = lines[1].split(",");
    const startTime = parseFloat(firstLine[1]) * 1000;  

   
    const realTimestamp = new Date(firstAudioTime.getTime() + startTime);
    return realTimestamp;
}

function generateReport() {
    const transcripts = fs.existsSync(transcriptsPath)
        ? fs.readFileSync(transcriptsPath, "utf-8").split("\n").filter(Boolean).length - 1  // Exclude header
        : 0;
    const audioFiles = fs.existsSync(sttAudioDir) ? fs.readdirSync(sttAudioDir).length : 0;

    const firstAudioTime = getEarliestFileTime(sttAudioDir);
    const firstTranscriptTime = getFirstTranscriptTime(firstAudioTime);

    const timeToFirstResponse = firstAudioTime && firstTranscriptTime
        ? `${(firstTranscriptTime - firstAudioTime) / 1000}s`  
        : "N/A";

    return {
        total_transcriptions: transcripts,
        total_stt_audio_files: audioFiles,
        first_audio_timestamp: firstAudioTime?.toISOString() || "N/A",
        first_transcript_timestamp: firstTranscriptTime?.toISOString() || "N/A",
        time_to_first_response: timeToFirstResponse,
        report_generated_at: new Date().toISOString()
    };
}

// Write report to JSON file
fs.writeFileSync(reportPath, JSON.stringify(generateReport(), null, 2));
console.log("✅ Quality report generated at:", reportPath);
