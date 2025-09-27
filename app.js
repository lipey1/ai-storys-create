import createUser from "./functions/createUser.js";
import dotenv from "dotenv";
import colors from "colors";
import openPage from "./functions/openPage.js";
import fs from "fs";
import path from "path";
import os from "os";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import uploadVideo from "./functions/uploadVideo.js";
import addWaterMark from "./functions/addWaterMark.js";
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
        this.addWaterMark = addWaterMark;
        this.uploadVideo = uploadVideo;
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

        let cycleCount = 0;
        const maxCycles = process.env.MAX_CYCLES ? parseInt(process.env.MAX_CYCLES) : 0; // 0 = infinito

        console.log(' ○'.green + ' Iniciando ciclo contínuo de geração de vídeos...'.white);
        if (maxCycles > 0) {
            console.log(' ○'.blue + ` Configurado para executar ${maxCycles} ciclos`.white);
        } else {
            console.log(' ○'.blue + ' Configurado para executar ciclos infinitos (Ctrl+C para parar)'.white);
        }

        while (true) {
            cycleCount++;
            console.log('\n' + '='.repeat(60).cyan);
            console.log(' ○'.green + ` INICIANDO CICLO ${cycleCount}`.white);
            console.log('='.repeat(60).cyan);

            try {
                // Criar usuário
                console.log(' ○'.green + ' Criando usuário...'.white);
                const userData = await this.createUser(browser);
                console.log(' ○'.green + ' Usuário criado com sucesso!'.white);

                // Gerar vídeo
                console.log(' ○'.green + ' Abrindo página...'.white);
                const result = await this.openPage(browser, userData);

                if (result.success) {
                    console.log(' ○'.green + ' Vídeo gerado com sucesso!'.white);
                    const videoPath = await this.addWaterMark(result.filePath);
                    try {
                        fs.unlinkSync(result.filePath);
                        console.log(' ○'.green + ' Arquivo do vídeo original removido com sucesso!'.white);
                    } catch { }
                    console.log(' ○'.green + ' Vídeo com marca d\'água gerado com sucesso!'.white);
                    console.log(' ○'.blue + ` Arquivo salvo: ${videoPath}`.white);
                    console.log(' ○'.blue + ' Fazendo upload do vídeo...'.white);
                    await this.uploadVideo(browser, videoPath);
                } else {
                    console.log(' ○'.red + ' Falha na geração do vídeo'.white);
                }

                // Verificar se deve continuar
                if (maxCycles > 0 && cycleCount >= maxCycles) {
                    console.log(' ○'.blue + ` Todos os ${maxCycles} ciclos foram concluídos!`.white);
                    break;
                }

                // Aguardar antes do próximo ciclo
                const waitTime = process.env.CYCLE_DELAY ? parseInt(process.env.CYCLE_DELAY) : 10000;
                console.log(' ○'.blue + ` Aguardando ${waitTime / 1000} segundos antes do próximo ciclo...`.white);
                await new Promise(resolve => setTimeout(resolve, waitTime));

            } catch (error) {
                // Verificar se é erro de timeout da API de email
                if (error.message && error.message.includes('fetch failed') && 
                    error.cause && error.cause.code === 'UND_ERR_CONNECT_TIMEOUT' &&
                    error.cause.message && error.cause.message.includes('api.mail.tm')) {
                    
                    console.log(' ○'.yellow + ' Houve um erro ao acessar a API de email (timeout)'.white);
                    console.log(' ○'.blue + ' Pulando para o próximo ciclo...'.white);
                    
                    // Aguardar menos tempo para erro de API
                    const apiErrorDelay = process.env.API_ERROR_DELAY ? parseInt(process.env.API_ERROR_DELAY) : 5000; // 5 segundos padrão
                    console.log(' ○'.blue + ` Aguardando ${apiErrorDelay / 1000} segundos antes do próximo ciclo...`.white);
                    await new Promise(resolve => setTimeout(resolve, apiErrorDelay));
                } else {
                    console.log(' ○'.red + ` Erro no ciclo ${cycleCount}: ${error.message}`.white);

                    // Aguardar antes de tentar novamente
                    const retryDelay = process.env.RETRY_DELAY ? parseInt(process.env.RETRY_DELAY) : 30000; // 30 segundos padrão
                    console.log(' ○'.yellow + ` Aguardando ${retryDelay / 1000} segundos antes de tentar novamente...`.white);
                    await new Promise(resolve => setTimeout(resolve, retryDelay));
                }
            }
        }

        console.log('\n' + '='.repeat(60).green);
        console.log(' ○'.green + ' TODOS OS CICLOS CONCLUÍDOS!'.white);
        console.log('='.repeat(60).green);

        await browser.close();
    }
}

export default App;

process.on("unhandledRejection", (reason, promise) => {
    if (reason?.code === "UND_ERR_CONNECT_TIMEOUT") {
        console.log(' ○'.red + ` Erro ao acessar a API de email: ${error.message}`.white);
        return;
    }
    console.log(' ○'.red + ` Erro: ${error.stack}`.white);

});

// Captura erros não tratados no geral
process.on("uncaughtException", (error) => {
    if (error?.code === "UND_ERR_CONNECT_TIMEOUT") {
        console.log(' ○'.red + ` Erro ao acessar a API de email: ${error.message}`.white);
        return;
    }
    console.log(' ○'.red + ` Erro: ${error.stack}`.white);
});

const app = new App();
app.start();