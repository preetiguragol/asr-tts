const fs = require("fs");

function generateReport() {
    const transcripts = fs.readFileSync("transcripts.csv", "utf-8").split("\n").length;
    const audioFiles = fs.readdirSync("public/audio").length;
    const ttsFiles = fs.readdirSync("public/tts_audio").length;

    return {
        total_transcriptions: transcripts,
        total_stt_audio_files: audioFiles,
        total_tts_audio_files: ttsFiles,
        timestamp: new Date().toISOString()
    };
}

fs.writeFileSync("qualityReport.json", JSON.stringify(generateReport(), null, 2));
console.log("✅ Quality report generated!");
