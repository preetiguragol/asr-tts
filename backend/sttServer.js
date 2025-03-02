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
        sample_rate: 48000,
    });

    connection.on(LiveTranscriptionEvents.Open, () => {
        console.log("Deepgram connection opened.");
        ws.send(JSON.stringify({ status: "ready" }));

        connection.on(LiveTranscriptionEvents.Transcript, (data) => {
            if (data.channel.alternatives[0].transcript) {
                const transcriptData = {
                    transcript: data.channel.alternatives[0].transcript,
                    channel: data.channel,
                };
                ws.send(JSON.stringify(transcriptData));
            }
        });

        connection.on(LiveTranscriptionEvents.Metadata, (data) => {
            console.log("Deepgram Metadata:", JSON.stringify(data, null, 2));
        });

        connection.on(LiveTranscriptionEvents.Close, () => {
            console.log("Deepgram connection closed.");
        });

        connection.on(LiveTranscriptionEvents.Error, (err) => {
            console.error("Deepgram Error:", err.message);
        });

        ws.on("message", (message) => {
            if (message instanceof Buffer && message.length > 0) {
                connection.send(message);
            }
        });

        ws.on("close", () => {
            console.log("Client disconnected");
            connection.finish();
        });
    });
});

console.log("STT Server running on ws://localhost:5000");
