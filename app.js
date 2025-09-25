import createUser from "./functions/createUser.js";
import dotenv from "dotenv";
import colors from "colors";
import openPage from "./functions/openPage.js";
import fs from "fs";
import path from "path";
import os from "os";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
dotenv.config();

class App {
    constructor() {
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

        this.executablePath = executablePath;
        this.createUser = createUser;
        this.openPage = openPage;
    }

    async start() {
        puppeteer.use(StealthPlugin());
        const browser = await puppeteer.launch({
            executablePath: this.executablePath,
            headless: false,
            defaultViewport: null,
            args: ['--start-maximized'],
            protocolTimeout: 1800000
        });

        console.log(' ○'.green + ' Criando usuário...'.white);
        const userData = await this.createUser(browser);
        console.log(' ○'.green + ' Usuário criado com sucesso!'.white);

        console.log(' ○'.green + ' Abrindo página...'.white);
        await this.openPage(browser, userData);
        console.log(' ○'.green + ' Página aberta com sucesso!'.white);
    }
}

export default App;

const app = new App();
app.start();