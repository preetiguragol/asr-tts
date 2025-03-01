"use client";
import { useState, useEffect, useRef } from "react";

export default function AudioRecorder() {
    const [recording, setRecording] = useState(false);
    const [transcript, setTranscript] = useState([]);
    const socketRef = useRef(null);
    const mediaRecorderRef = useRef(null);

    useEffect(() => {
        if (recording) {
            startRecording();
        } else {
            stopRecording();
        }

        return () => stopRecording(); // Cleanup on unmount
    }, [recording]);

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });

            socketRef.current = new WebSocket("ws://localhost:5000");

            socketRef.current.onopen = () => console.log(" Connected to WebSocket");
            socketRef.current.onerror = (error) => console.error("WebSocket Error:", error);

            socketRef.current.onmessage = (event) => {
                const data = JSON.parse(event.data);
                if (data.transcript && data.transcript.trim().length > 0) {
                    console.log("Received Transcript:", data.transcript); 
                    setTranscript((prev) => [...prev, data.transcript]);
                }
            };

            mediaRecorderRef.current.ondataavailable = async (event) => {
                if (event.data.size > 500) {  // ✅ Prevent sending silent chunks
                    socketRef.current?.send(event.data);
                    console.log("Sent audio chunk to server, size:", event.data.size);
                } else {
                    console.warn("Ignoring empty audio chunk!");
                }
            };

            mediaRecorderRef.current.start(1000); // Record in 1-second chunks
        } catch (error) {
            console.error(" Error accessing microphone:", error);
        }
    };

    const stopRecording = () => {
        mediaRecorderRef.current?.stop();

        if (socketRef.current) {
            setTimeout(() => {
                socketRef.current?.close();
                console.log(" Closed WebSocket after delay");
            }, 5000);
        }
    };

    return (
        <div className="p-4">
            <button onClick={() => setRecording(!recording)} className="bg-blue-500 text-white p-2 rounded">
                {recording ? "Stop Recording" : "Start Recording"}
            </button>
            <h3>Transcript:</h3>
            <pre>{JSON.stringify(transcript, null, 2)}</pre>
        </div>
    );
}