"use client";
import { useState, useEffect, useRef } from "react";

export default function AudioRecorder() {
    const [recording, setRecording] = useState(false);
    const [transcript, setTranscript] = useState([]);
    const socketRef = useRef(null);
    const audioContextRef = useRef(null);
    const sourceRef = useRef(null);
    const processorRef = useRef(null);
    const audioChunksRef = useRef([]);

    useEffect(() => {
        if (recording) startRecording();
        else stopRecording();
        return () => stopRecording();
    }, [recording]);

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    sampleRate: 48000,
                    channelCount: 1,
                },
            });

            socketRef.current = new WebSocket("ws://localhost:5000");
            socketRef.current.binaryType = "arraybuffer";

            // WebSocket Keep-Alive: Ping every 30 seconds
            const heartbeat = setInterval(() => {
                if (socketRef.current?.readyState === WebSocket.OPEN) {
                    socketRef.current.send(JSON.stringify({ type: "ping" }));
                }
            }, 30000);

            socketRef.current.onclose = () => clearInterval(heartbeat);

            audioContextRef.current = new AudioContext({ sampleRate: 48000 });
            sourceRef.current = audioContextRef.current.createMediaStreamSource(stream);
            processorRef.current = audioContextRef.current.createScriptProcessor(4096, 1, 1);

            sourceRef.current.connect(processorRef.current);
            processorRef.current.connect(audioContextRef.current.destination);

            socketRef.current.onmessage = (event) => {
                const data = JSON.parse(event.data);
                if (data.status === "ready") {
                    console.log("Server ready - sending audio");
                } else if (data.transcript) {
                    const speakerIndex = data.channel?.alternatives[0]?.words?.[0]?.speaker;
                    const speaker = speakerIndex + 1;
                    setTranscript((prev) => [
                        ...prev,
                        { speaker: `Speaker ${speaker}`, text: data.channel.alternatives[0].transcript },
                    ]);
                }
            };

            processorRef.current.onaudioprocess = (e) => {
                if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;

                const pcmData = convertFloat32ToInt16(e.inputBuffer.getChannelData(0));
                audioChunksRef.current.push(pcmData);
                socketRef.current.send(pcmData);
            };
        } catch (error) {
            console.error("Error accessing microphone:", error);
        }
    };

    const stopRecording = () => {
        if (processorRef.current) {
            processorRef.current.disconnect();
            sourceRef.current?.disconnect();
        }

        if (audioContextRef.current && audioContextRef.current.state !== "closed") {
            audioContextRef.current.close();
        }

        if (socketRef.current) {
            socketRef.current.close();
            console.log("WebSocket closed");
        }

       
        if (audioChunksRef.current.length > 0) {
            fetch("/api/save-audio", {
                method: "POST",
                body: JSON.stringify(audioChunksRef.current),
            });
            audioChunksRef.current = [];
        }
    };

    const convertFloat32ToInt16 = (buffer) => {
        const int16Buffer = new Int16Array(buffer.length);
        for (let i = 0; i < buffer.length; i++) {
            int16Buffer[i] = Math.min(1, buffer[i]) * 32767;
        }
        return int16Buffer;
    };

    return (
        <div className="p-4">
            <button
                onClick={() => setRecording(!recording)}
                className="bg-blue-500 text-white p-2 rounded"
            >
                {recording ? "Stop Recording" : "Start Recording"}
            </button>
            <h3 className="mt-4">Transcript:</h3>
            <div className="space-y-2">
                {transcript.map((entry, index) => (
                    <div key={index} className="p-2 rounded bg-gray-100">
                        <strong className="text-blue-600">{entry.speaker}:</strong> {entry.text}
                    </div>
                ))}
            </div>
        </div>
    );
}
