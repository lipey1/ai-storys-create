import genDescription from "./genDescription.js";
import uploadInstagramReels from "./uploadInstagramReels.js";
import uploadInstagramStories from "./uploadInstagramStories.js";
import uploadTikTok from "./uploadTikTok.js";
import fs from "fs";
import path from "path";

async function uploadVideo(browser, videoPath) {
    try {
        const description = await genDescription(videoPath);
        if (process.env.UPLOAD_TIKTOK === 'true' || process.env.UPLOAD_TIKTOK === 'yes') {
            await uploadTikTok(browser, videoPath, description);
        }

        if (process.env.UPLOAD_INSTAGRAM_REELS === 'true' || process.env.UPLOAD_INSTAGRAM_REELS === 'yes') {
            await uploadInstagramReels(browser, videoPath, description);
        }

        if (process.env.UPLOAD_INSTAGRAM_STORIES === 'true' || process.env.UPLOAD_INSTAGRAM_STORIES === 'yes') {
            await uploadInstagramStories(browser, videoPath);
        }
    } catch {
        console.log(' ○'.red + ' Erro ao fazer upload do vídeo, erro:'.white + error.message);
    } finally {
        try {
            await browser.close();
            console.log(' ○'.blue + ' Browser fechado com sucesso'.white);
        } catch { }
        try {
            fs.unlinkSync(videoPath);
            console.log(' ○'.blue + ' Arquivo do vídeo removido com marca d\'água com sucesso'.white);
        } catch { }
    }
}

export default uploadVideo;