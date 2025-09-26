import fs from 'fs';
import path from 'path';
import colors from 'colors';
import { GoogleGenAI } from "@google/genai";

async function uploadVideo(browser, videoName) {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    // Cria uma nova página
    const page = await browser.newPage();

    // Carrega os cookies do arquivo
    console.log(' ○'.green + ' Carregando cookies...');
    const cookiesPath = path.join(process.cwd(), 'data', 'cookies.json');

    if (!fs.existsSync(cookiesPath)) {
        console.error(' ○'.red + ' Arquivo de cookies não encontrado:', cookiesPath);
        return;
    }

    const cookiesData = fs.readFileSync(cookiesPath, 'utf8');
    const rawCookies = JSON.parse(cookiesData);

    console.log(' ○'.yellow + ` ${rawCookies.length} cookies carregados`);

    // Filtra e limpa os cookies para o Puppeteer
    console.log(' ○'.green + ' Limpando cookies...');
    const cleanCookies = rawCookies
        .filter(cookie => {
            // Remove cookies com domínios inválidos ou valores vazios
            return cookie.domain && cookie.name && cookie.value;
        })
        .map(cookie => {
            // Limpa campos problemáticos
            const cleanCookie = {
                name: cookie.name,
                value: cookie.value,
                domain: cookie.domain,
                path: cookie.path || '/',
                secure: cookie.secure || false,
                httpOnly: cookie.httpOnly || false
            };

            // Adiciona sameSite apenas se for válido
            if (cookie.sameSite && cookie.sameSite !== null) {
                cleanCookie.sameSite = cookie.sameSite;
            }

            // Adiciona expirationDate se existir
            if (cookie.expirationDate) {
                cleanCookie.expires = cookie.expirationDate;
            }

            return cleanCookie;
        });

    console.log(' ○'.green + ` ${cleanCookies.length} cookies limpos e prontos`);

    // Navega para o TikTok primeiro
    console.log(' ○'.green + ' Navegando para o TikTok...');
    await page.goto('https://www.tiktok.com', {
        waitUntil: 'networkidle2',
        timeout: 30000
    });

    // Define os cookies limpos
    console.log(' ○'.green + ' Definindo cookies limpos...');

    try {
        await page.setCookie(...cleanCookies);
        console.log(' ○'.green + ' Cookies definidos com sucesso!');
    } catch (cookieError) {
        console.log(' ○'.red + ' Erro ao definir alguns cookies, tentando individualmente...');

        // Tenta definir cookies um por um para identificar o problemático
        let successCount = 0;
        for (const cookie of cleanCookies) {
            try {
                await page.setCookie(cookie);
                successCount++;
            } catch (error) {
                console.log(' ○'.red + ` Cookie problemático: ${cookie.name} - ${error.message}`);
            }
        }

        console.log(' ○'.green + `${successCount}/${cleanCookies.length} cookies definidos com sucesso`);
    }

    // Recarrega a página para aplicar os cookies
    console.log(' ○'.green + ' Recarregando página com cookies...');
    await page.goto('https://www.tiktok.com/tiktokstudio/upload?from=webapp', {
        waitUntil: 'networkidle2',
        timeout: 30000
    });

    // Aguarda o input de upload aparecer
    console.log(' ○'.green + ' Aguardando input de upload aparecer...');

    try {
        // Aguarda até 30 segundos pelo input de upload
        await page.waitForSelector('input[type="file"]', {
            timeout: 180000,
        });

        console.log(' ○'.green + ' Input de upload encontrado!');

        // Caminho do vídeo local
        const videoPath = path.join(process.cwd(), 'downloads', videoName);

        // Verifica se o arquivo existe
        if (!fs.existsSync(videoPath)) {
            console.error(' ○'.red + ' Arquivo de vídeo não encontrado:', videoPath);
            return;
        }

        console.log(' ○'.green + ' Fazendo upload do vídeo...');
        console.log(' ○'.yellow + ' Arquivo:', videoPath);

        // Faz upload do arquivo
        const fileInput = await page.$('input[type="file"]');
        await fileInput.uploadFile(videoPath);
        console.log(' ○'.green + ' Upload do vídeo concluído!');

        await page.waitForSelector('.public-DraftEditor-content', { timeout: 180000 });

        // Lê o arquivo de vídeo
        const videoBuffer = fs.readFileSync(videoPath);
        console.log(' ○'.green + ` Arquivo de vídeo lido: ${(videoBuffer.length / 1024 / 1024).toFixed(2)} MB`.white);

        const responseDescription = await ai.models.generateContent({
            model: process.env.GEMINI_MODEL,
            contents: [
                {
                    role: 'user',
                    parts: [
                        {
                            text: `
                            Cria uma descrição viral, curta e envolvente para um vídeo curto que será postado em redes sociais.
                            O texto deve ser atrativo, com linguagem que chame a atenção do público.

                            Explique brevemente o conteúdo do vídeo de forma clara.

                            Inclua hashtags relevantes e populares (#) para aumentar o alcance.

                            Use tags virais como fyp, fy e tags relacionadas ao tema do vídeo.

                            O estilo deve ser moderno, natural e voltado para engajamento.

                            O vídeo te mandei como anexo!

                            Deve seguir esse modelo aqui:

                            [TEXTO]

                            [HASHTAGS]

                            ATENÇÃO!, quero apenas uma descrição e não escreva a palavra descrição ou tags!`
                        },
                        {
                            inlineData: {
                                mimeType: 'video/mp4',
                                data: videoBuffer.toString('base64')
                            }
                        }
                    ]
                }
            ],
            responseMimeType: 'application/json',
            responseSchema: { descricao: 'string', hashtags: 'array' },
        });

        // Processa a resposta JSON do Gemini
        const responseData = responseDescription.candidates[0].content.parts[0].text;
        console.log(' ○'.green + ' Descrição gerada:'.white);
        console.log(' ○'.cyan + ` ${responseData}`.white);
        // Combina descrição e hashtags
        await page.evaluate(async (text) => {
            const editor = document.querySelector('.public-DraftEditor-content');
            if (editor) {
                editor.focus(); // coloca o cursor lá dentro

                // Seleciona todo o conteúdo e apaga
                document.execCommand('selectAll', false, null);
                document.execCommand('delete', false, null);
                await new Promise(resolve => setTimeout(resolve, 2000));

                // Divide em blocos de 15
                const parts = text.match(/.{1,15}/g) || [];

                for (const part of parts) {
                    document.execCommand('insertText', false, part);
                    await new Promise(r => setTimeout(r, 250));
                }
            }

        }, responseData)

        await page.waitForSelector('[data-e2e="post_video_button"]', { timeout: 120000 });

        const resultButtonPublish = await new Promise(async (resolve, reject) => {
            let interval = setInterval(async () => {
                const result = await page.evaluate(() => {
                    const publishButton = document.querySelector(
                        '[data-e2e="post_video_button"]:not([data-disabled="true"])'
                    );
                    if (publishButton) {
                        publishButton.click();
                        return true;
                    }
                })
                if (result) {
                    clearInterval(interval);
                    resolve(true);
                }
            }, 2000);
            setTimeout(() => {
                clearInterval(interval);
                resolve(false);
            }, 300000);
        })

        if (!resultButtonPublish) {
            throw new Error('Falha ao publicar vídeo');
        }

        const resultConfirmButtonPublish = await new Promise(async (resolve, reject) => {
            let interval = setInterval(async () => {
                const actualPath = await page.evaluate(() => window.location.pathname);
                if (actualPath.includes('/tiktokstudio/content')) {
                    clearInterval(interval);
                    resolve(true);
                }
                const result = await page.evaluate(() => {
                    const confirmButtonPublish = document.querySelector('.TUXButton--primary');
                    if (confirmButtonPublish) {
                        confirmButtonPublish.click();
                        return true;
                    }

                });
                if (result) {
                    clearInterval(interval);
                    resolve(true);
                }
            }, 2000);
            setTimeout(() => {
                clearInterval(interval);
                resolve(false);
            }, 300000);
        })

        if (!resultConfirmButtonPublish) {
            throw new Error('Falha ao confirmar publicação');
        }

        let resultPublish = await new Promise(resolve => {
            let interval = setInterval(async () => {
                let actualPath = await page.evaluate(() => window.location.pathname);
                if (actualPath.includes('/tiktokstudio/content')) {
                    resolve(true);
                    clearInterval(interval);
                }
            }, 2000);
            setTimeout(() => {
                clearInterval(interval);
                resolve(false);
            }, 180000);
        });

        if (!resultPublish) {
            throw new Error('Falha ao publicar vídeo');
        }


        console.log(' ○'.green + ' Vídeo publicado com sucesso!'.white);
        try {
            await fs.unlinkSync(videoPath);
            console.log(' ○'.green + ' Arquivo do vídeo removido com sucesso!'.white);
        } catch (error) {
            console.log(' ○'.red + ' Erro ao remover arquivo do vídeo:', error.message);
        }

    } catch (error) {
        console.log(' ○'.red + ' Ocorreu um erro:', error.message);
    } finally {
        try {
            await page.close();
            console.log(' ○'.blue + ' Página fechada com sucesso'.white);
        } catch { }
    }

    try {
        await page.close();
    } catch { }
}

export default uploadVideo;