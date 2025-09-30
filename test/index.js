import uploadInstagramReels from "../functions/upload/uploadInstagramReels.js";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import os from "os";
import fs from "fs";
import path from "path";
import colors from "colors";
import uploadInstagramStorys from "../functions/upload/uploadInstagramStories.js";
import uploadShorts from "../functions/upload/uploadShorts.js";
import genDescription from "../functions/upload/genDescription.js";
import dotenv from "dotenv";
dotenv.config({path: path.resolve('..', '.env')});

async function test() {
    function getChromeExecutablePath() {
        const platform = os.platform();
        switch (platform) {
            case 'win32':
                return getWindowsChromeExecutablePath();
            case 'darwin':
                return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
            case 'linux':
                return '/usr/bin/google-chrome';
            default:
                console.error('Could not find browser.');
                return null;
        }
    }

    function getWindowsChromeExecutablePath() {
        const programFilesPath = process.env.ProgramFiles || '';
        const programFilesx86Path = process.env['ProgramFiles(x86)'] || '';
        if (programFilesx86Path) {
            if (fs.existsSync(path.join(programFilesx86Path, 'Google', 'Chrome', 'Application', 'chrome.exe'))) {
                return path.join(programFilesx86Path, 'Google', 'Chrome', 'Application', 'chrome.exe');
            }
        } if (programFilesPath) {
            if (fs.existsSync(path.join(programFilesPath, 'Google', 'Chrome', 'Application', 'chrome.exe'))) {
                return path.join(programFilesPath, 'Google', 'Chrome', 'Application', 'chrome.exe');
            }
        } else {
            return null;
        }
    }

    const executablePath = getChromeExecutablePath();
    if (!executablePath) {
        return console.log(' ○'.red + ' Não foi possível encontrar o caminho do Chrome'.white);
    }

    puppeteer.use(StealthPlugin());
    const browser = await puppeteer.launch({
        executablePath: executablePath,
        headless: false,
        defaultViewport: null,
        args: ['--start-maximized'],
        protocolTimeout: 1800000
    });

    const videoPath = path.resolve('C:\\projects\\ai\\downloads\\6Ji5onukymie_final_video_68da9cce4f8d01687d9f7a38_with_watermark.mp4');
    if (!fs.existsSync(videoPath)) {
        return console.log(' ○'.red + ' Arquivo de vídeo não encontrado: '.white + videoPath);
    }
    const description = await genDescription(videoPath);
    console.log(description);
    await uploadShorts(browser, videoPath, description);
}

test();