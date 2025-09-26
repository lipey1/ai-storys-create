import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import colors from 'colors';

async function test() {
    let browser;

    try {
        console.log(' ○'.green + ' Iniciando Puppeteer...');

        // Inicia o navegador
        browser = await puppeteer.launch({
            headless: false, // Mostra o navegador
            defaultViewport: null,
            args: [
                '--start-maximized',
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu'
            ]
        });

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

        // Procura por tags <video> na página
        console.log(' ○'.green + ' Procurando tags <video> na página...');

        try {
            // Aguarda até 30 segundos por tags de vídeo
            await page.waitForSelector('video', {
                timeout: 30000,
                visible: true
            });

            console.log(' ○'.green + ' Tags <video> encontradas!');

            // Extrai URLs dos vídeos
            const videoUrls = await page.evaluate(() => {
                const videos = document.querySelectorAll('video');
                const urls = [];

                videos.forEach((video, index) => {
                    // Tenta diferentes fontes de vídeo
                    if (video.src) {
                        urls.push({
                            index: index,
                            src: video.src,
                            type: 'src'
                        });
                    }

                    // Verifica sources dentro do video
                    const sources = video.querySelectorAll('source');
                    sources.forEach((source, sourceIndex) => {
                        if (source.src) {
                            urls.push({
                                index: index,
                                sourceIndex: sourceIndex,
                                src: source.src,
                                type: 'source'
                            });
                        }
                    });
                });

                return urls;
            });

            console.log(' ○'.yellow + ` Encontrados ${videoUrls.length} vídeos:`);
            videoUrls.forEach((video, i) => {
                console.log(' ○'.cyan + `  ${i + 1}. ${video.type} - ${video.src}`);
            });

            if (videoUrls.length > 0) {
                // Baixa o primeiro vídeo encontrado
                const firstVideo = videoUrls[0];
                console.log(' ○'.green + ` Baixando vídeo: ${firstVideo.src}`);

                // Cria pasta downloads se não existir
                const downloadsDir = path.join(process.cwd(), 'downloads');
                if (!fs.existsSync(downloadsDir)) {
                    fs.mkdirSync(downloadsDir, { recursive: true });
                }

                // Nome do arquivo baseado na URL
                const urlParts = firstVideo.src.split('/');
                const fileName = urlParts[urlParts.length - 1] || `video_${Date.now()}.mp4`;
                const filePath = path.join(downloadsDir, fileName);

                console.log(' ○'.yellow + ` Salvando em: ${filePath}`);

                // Baixa o vídeo
                const response = await page.goto(firstVideo.src);
                const buffer = await response.buffer();
                fs.writeFileSync(filePath, buffer);

                console.log(' ○'.green + ' Vídeo baixado com sucesso!');
                console.log(' ○'.cyan + ` Arquivo salvo: ${filePath}`);
                console.log(' ○'.cyan + ` Tamanho: ${(buffer.length / 1024 / 1024).toFixed(2)} MB`);

            } else {
                console.log(' ○'.red + ' Nenhum vídeo com URL válida encontrado');
            }

            console.log(' ○'.green + ' Download de vídeo concluído!');
            console.log(' ○'.yellow + ' O navegador permanecerá aberto. Feche manualmente quando terminar.');

        } catch (error) {
            console.log(' ○'.red + ' Tags <video> não encontradas ou erro no download:', error.message);
            console.log(' ○'.yellow + ' Verifique se há vídeos na página atual');
        }

    } catch (error) {
        console.error(' ○'.red + ' Erro:', error.message);
    } finally {
        // Fecha o navegador se ainda estiver aberto
        if (browser) {
            await browser.close();
        }
    }
}

test();