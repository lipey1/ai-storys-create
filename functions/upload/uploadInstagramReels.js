import path from "path";
import fs from "fs";

async function uploadInstagramReels(browser, videoPath, description) {
    try {
        const page = await browser.newPage();

        // Carrega os cookies do arquivo
        console.log(' ○'.green + ' Carregando cookies...');
        // const cookiesPath = path.join(process.cwd(), 'data', 'cookies_instagram.json');
        const cookiesPath = 'C:\\projects\\ai\\data\\cookies_instagram.json';

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
        await page.goto('https://business.facebook.com/latest/reels_composer/', {
            waitUntil: 'networkidle2',
            timeout: 120000
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

        await page.goto('https://business.facebook.com/latest/reels_composer/', {
            waitUntil: 'networkidle2',
            timeout: 120000
        });

        await page.waitForSelector('[aria-busy="false"] > span >div >div >div:nth-child(2)', {
            timeout: 120000
        });

        const elementsClick = await page.$$('[aria-busy="false"] > span >div >div >div:nth-child(2)');
        let elementClick;
        for (const element of elementsClick) {
            const textContent = await page.evaluate((element) => {
                return element.textContent;
            }, element);
            if (textContent.toLowerCase()
                .normalize("NFD")              // separa acento da letra
                .replace(/[\u0300-\u036f]/g, "") // remove os acentos
                .replace(/\s+/g, " ").includes('video')) { // normaliza espaços

                elementClick = element;
                break;
            }
        }

        if (!elementClick) {
            throw new Error('Input de video não encontrado');
        }

        console.log(' ○'.green + ' Input de video encontrado!');

        const [fileChooser] = await Promise.all([
            page.waitForFileChooser(),
            elementClick.click(),
        ]);

        await fileChooser.accept([videoPath]);
        console.log(' ○'.green + ' Arquivo selecionado com sucesso!');

        await page.waitForSelector('[contenteditable="true"]', { timeout: 120000 });

        // Combina descrição e hashtags
        await page.evaluate(async () => {
            const editor = document.querySelector('[contenteditable="true"]');
            if (editor) {
                editor.focus(); // coloca o cursor lá dentro
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        })

        await page.type('[contenteditable="true"]', description, { delay: 100 });

        for (const i of [1, 2, 3]) {
            await page.evaluate(async () => {
                let element = await new Promise((resolve, reject) => {
                    let interval = setInterval(() => {
                        const list = Array.from(document.querySelectorAll('div > div > div > div > [role="none"] > [role="button"] > span > div'));

                        let elementoComUmaDivFilha = null;

                        for (let i = 0; i < list.length; i++) {
                            const item = list[i];

                            // sobe até o ancestor [role="button"]
                            const button = item.closest('[role="button"]');

                            // verifica se existe e se NÃO tem aria-disabled="true"
                            if (!button || button.getAttribute('aria-disabled') === 'true') {
                                continue; // pula esse elemento
                            }

                            // pega apenas filhos div
                            const divFilhas = Array.from(item.children).filter(child => child.tagName.toLowerCase() === 'div');

                            // verifica se tem exatamente uma div filha
                            if (divFilhas.length === 1) {
                                const unicaDiv = divFilhas[0];

                                // verifica se a única div NÃO tem atributo role e tem data-auto-logging-component-type
                                if (!unicaDiv.hasAttribute('role') && unicaDiv.hasAttribute('data-auto-logging-component-type')) {
                                    const childElement = unicaDiv.querySelector("div > div");
                                    if (childElement) {
                                        if (childElement.hasAttribute('data-sscoverage-ignore')) {
                                            continue;
                                        }
                                        let textContent = childElement.textContent.toLowerCase()
                                            .normalize("NFD")              // separa acento da letra
                                            .replace(/[\u0300-\u036f]/g, "") // remove os acentos
                                            .replace(/\s+/g, " ");

                                        if (textContent) {
                                            elementoComUmaDivFilha = item;
                                            item.click();
                                        }
                                    }
                                }
                            }
                        }
                        if (elementoComUmaDivFilha) {
                            clearInterval(interval);
                            resolve(elementoComUmaDivFilha);
                        }
                    }, 2000);

                    setTimeout(() => {
                        clearInterval(interval);
                        resolve(false);
                    }, 120000)
                })

                return element;

            })
        }

        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 120000 });

        console.log(' ○'.green + ' Publicação de reel concluída!');

    } catch (error) {
        console.log(' ○'.red + ' Ocorreu um erro ao publicar vídeo no Instagram Reels:', error.message);
    } finally {
        try {
            await page.close();
            console.log(' ○'.blue + ' Página do Instagram Reels fechada com sucesso'.white);
        } catch { }
    }
}

export default uploadInstagramReels;