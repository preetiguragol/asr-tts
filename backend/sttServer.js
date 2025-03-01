require("dotenv").config({ path: require("path").resolve(__dirname, "../.env.local") });
const { createClient, LiveTranscriptionEvents } = require("@deepgram/sdk");
const WebSocket = require("ws");

if (!process.env.DEEPGRAM_API_KEY) {
    console.error("ERROR: Deepgram API Key is missing!");
    process.exit(1);
}

const deepgram = createClient(process.env.DEEPGRAM_API_KEY);
const wss = new WebSocket.Server({ port: 5000 });

wss.on("connection", (ws) => {
    console.log("Client connected");

    const connection = deepgram.listen.live({
        model: "nova-3",
        language: "en-US",
        smart_format: true,
        punctuate: true,
        diarize: true,
        encoding: "linear16",  
        sample_rate: 48000 
    });

    connection.on(LiveTranscriptionEvents.Open, () => {
        console.log("Deepgram connection opened.");
    });

    connection.on(LiveTranscriptionEvents.Transcript, (data) => {
        console.log("Transcript Event Triggered:", JSON.stringify(data, null, 2));  

        const transcript = data.channel.alternatives[0]?.transcript;
        if (transcript && transcript.trim().length > 0) {
            console.log("Received Transcript:", transcript);
            ws.send(JSON.stringify({ transcript })); 
        }
    });

    connection.on(LiveTranscriptionEvents.Metadata, (data) => {
        console.log("Deepgram Metadata:", JSON.stringify(data, null, 2));
    });

    connection.on(LiveTranscriptionEvents.Close, () => {
        console.log(" Deepgram connection closed.");
    });

    connection.on(LiveTranscriptionEvents.Error, (err) => {
        console.error("Deepgram Error:", err);
    });

    ws.on("message", (message) => {
        if (message.length > 500) {  
            console.log(`Sending ${message.length} bytes to Deepgram...`);
            connection.send(message);
        } else {
            console.warn("Ignoring empty audio chunk!");
        }
    });

    ws.on("close", () => {
        console.log("Client disconnected");
        connection.finish();
    });
});

console.log(" STT Server running on ws://localhost:5000");