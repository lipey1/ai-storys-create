import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';

async function openPage(browser, userData) {
    let page;
    try {
        console.log(' ○'.green + ' Abrindo link de verificação...'.white);

        page = await browser.newPage();

        // Cria sessão CDP para controlar comportamento do Chrome
        const client = await page.target().createCDPSession();

        // Define a pasta de downloads
        const downloadPath = path.resolve(process.cwd() + '/downloads');
        if (!fs.existsSync(downloadPath)) {
            fs.mkdirSync(downloadPath, { recursive: true });
        }

        await client.send('Page.setDownloadBehavior', {
            behavior: 'allow',
            downloadPath: downloadPath,
        });

        await page.goto("https://app.vidgenie.ai/");

        const firebaseLogin = await page.evaluate(async (data) => {
            return await new Promise((resolve, reject) => {
                const userData = {
                    apiKey: data.apiKey,
                    appName: "[DEFAULT]",
                    createdAt: String(Date.now()),
                    displayName: data.displayName,
                    email: data.email,
                    emailVerified: true,
                    isAnonymous: false,
                    lastLoginAt: String(Date.now()),
                    photoURL: "",
                    providerData: [],
                    stsTokenManager: {
                        refreshToken: data.refreshToken,
                        accessToken: data.accessToken,
                        expirationTime: Date.now() + 3600 * 1000
                    },
                    uid: data.id
                };

                const userKey = `firebase:authUser:${data.apiKey}:[DEFAULT]`;

                // VERIFIQUE ESTES NOMES NA ABA "APPLICATION" > "INDEXEDDB"
                const dbName = 'firebaseLocalStorageDb';
                const storeName = 'firebaseLocalStorage';

                console.log(`Tentando abrir o banco de dados: ${dbName}`);

                const request = indexedDB.open(dbName);

                request.onerror = (event) => {
                    console.error("Erro ao abrir o IndexedDB:", event.target.error);
                    resolve(false);
                };

                request.onsuccess = (event) => {
                    console.log("Banco de dados aberto com sucesso.");
                    const db = event.target.result;

                    if (!db.objectStoreNames.contains(storeName)) {
                        console.error(`A tabela (Object Store) "${storeName}" não foi encontrada.`);
                        console.error(`Tabelas disponíveis:`, [...db.objectStoreNames]);
                        db.close();
                        resolve(false);
                        return;
                    }

                    // Inicia uma transação de leitura e escrita
                    const transaction = db.transaction([storeName], 'readwrite');
                    const store = transaction.objectStore(storeName);

                    // Cria o objeto no formato exato que o Firebase espera
                    const dataToStore = {
                        fbase_key: userKey,
                        value: userData
                    };

                    // Usa .put() para inserir ou atualizar o registro
                    const putRequest = store.put(dataToStore);

                    putRequest.onsuccess = () => {
                        console.log("%cDados do usuário inseridos/atualizados com sucesso!", "color: green; font-weight: bold;");
                        console.log("Agora, ATUALIZE A PÁGINA para que a aplicação leia os novos dados.");
                        resolve(true);
                    };

                    putRequest.onerror = (event) => {
                        console.error("Erro ao inserir os dados:", event.target.error);
                        resolve(false);
                    };

                    transaction.oncomplete = () => {
                        console.log("Transação concluída.");
                        db.close();
                    };
                };
            });
        }, { ...userData, apiKey: process.env.FIREBASE_API_KEY });

        if (!firebaseLogin) {
            throw new Error('Falha ao alterar o login doFirebase');
        }

        await page.goto(`https://app.vidgenie.ai/story-video/simple-workflow?category=${process.env.CATEGORY_VIDEOS}`, { waitUntil: 'networkidle0' });

        // Selecionar idioma português
        console.log(' ○'.green + ' Selecionando idioma português...'.white);

        // Clicar no campo de idioma
        const languageField = await page.waitForSelector('[placeholder*="language" i]', { timeout: 10000 });
        await languageField.click();

        // Aguardar as opções aparecerem e selecionar português
        const languageElements = await new Promise(resolve => {
            setTimeout(() => {
                resolve(false)
            }, 60000)
            setInterval(async () => {
                const elements = await page.$$('mat-option');
                if (elements.length > 0) {
                    resolve(elements)
                }
            }, 1000)
        });

        if (!languageElements) {
            throw new Error('Language elements not found')
        }

        // Usar evaluate para encontrar e clicar no elemento correto
        await page.evaluate((language) => {
            const elements = document.querySelectorAll('mat-option');
            for (const element of elements) {
                const span = element.querySelector('span > span');
                if (span && span.textContent.toLowerCase().includes(language)) {
                    element.click();
                    return true;
                }
            }
            return false;
        }, process.env.LANGUAGE_VIDEOS);
        console.log(' ○'.green + ' Idioma selecionado!'.white);

        // Encontrar div com textContent igual ao ART_STYLE
        const artStyleDiv = await page.evaluate((artStyle) => {
            const divs = document.querySelectorAll('div');
            for (const div of divs) {
                if (div.textContent?.trim() === artStyle) {
                    div.click()
                    return true;
                }
            }
            return null;
        }, process.env.ART_STYLE);

        if (artStyleDiv) {
            console.log(' ○'.green + ' Arte configurada encontrada!'.white);
        } else {
            console.log(' ○'.red + ` ART_STYLE (${process.env.ART_STYLE}) não encontrada!`.white);
        }

        const generateScriptButton = await page.waitForSelector('.flex-none.w-40.relative.mdc-button.mdc-button--unelevated.mat-mdc-unelevated-button.mat-primary.mat-mdc-button-base', { timeout: 30000 });
        await generateScriptButton.click();
        console.log(' ○'.green + ' Geração de script iniciada...'.white);
        const confirmButtonGenerateScript = await page.waitForSelector('#CONFIRM_ACTION_BUTTON', { timeout: 180000 });
        await confirmButtonGenerateScript.click();
        console.log(' ○'.green + ' Geração de script confirmada...'.white);
        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 });

        const createFullVideo = await page.waitForSelector('.mat-mdc-tooltip-trigger.w-44.flex-none.relative.font-normal.mdc-button.mdc-button--unelevated.mat-mdc-unelevated-button.mat-primary.mat-mdc-button-base.ng-star-inserted', { timeout: 60000 });
        await createFullVideo.click();
        const confirmButtonCreateFullVideo = await page.waitForSelector('#CONFIRM_ACTION_BUTTON', { timeout: 30000 });
        await confirmButtonCreateFullVideo.click();
        console.log(' ○'.green + ' Criação de vídeo iniciada...'.white);
        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 });

        await page.waitForSelector('[mat-ripple-loader-class-name="mat-mdc-button-ripple"]', { timeout: 1800000 });
        const viewVideo = await page.evaluate(() => {
            return new Promise((resolve) => {
              const interval = setInterval(() => {
                const spans = document.querySelectorAll('[mat-ripple-loader-class-name="mat-mdc-button-ripple"] > span');
                for (const span of spans) {
                  if (span?.textContent?.trim().toLowerCase().includes('view')) {
                    span.click();
                    clearTimeout(timeout);  // não precisa mais do timeout
                    clearInterval(interval); // para o loop
                    resolve(true);
                    break;
                  }
                }
              }, 1000);
              const timeout = setTimeout(() => {
                clearInterval(interval); // limpa intervalo se deu timeout
                resolve(false);
              }, 1800000); // 30 minutos
            });
          });
          

        if (!viewVideo) {
            throw new Error('Falha ao visualizar vídeo');
        }

        console.log(' ○'.green + ' Visualização de vídeo iniciada...'.white);
        await new Promise(resolve => setTimeout(resolve, 211000));

        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 });

        // Aguardar botões de download aparecerem
        await page.waitForSelector('.action-button.bg-white.relative.mdc-button.mdc-button--outlined.mat-mdc-outlined-button.mat-primary.mat-mdc-button-base.ng-star-inserted', { timeout: 120000 });

        // Encontrar e clicar no botão de download
        const downloadSuccess = await page.evaluate(() => {
            return new Promise((resolve) => {
                const interval = setInterval(() => {
                        const spans = document.querySelectorAll('.action-button.bg-white.relative.mdc-button.mdc-button--outlined.mat-mdc-outlined-button.mat-primary.mat-mdc-button-base.ng-star-inserted > span');
                    for (const span of spans) {
                        console.log(span, span?.textContent?.trim().toLowerCase())
                        if (span && span.textContent?.trim().toLowerCase().includes('download')) {
                            span.click();
                            clearInterval(interval);
                            resolve(true);
                            return;
                        }
                    }
                }, 1000);
                setTimeout(() => {
                    clearInterval(interval);
                    resolve(false);
                }, 120000);
            });
        });

        if (!downloadSuccess) {
            throw new Error('Falha ao baixar vídeo');
        }

        console.log(' ○'.green + ' Download de vídeo iniciado...'.white);
        console.log(' ○'.green + ` Arquivo será salvo em: ${process.cwd()}/downloads`.white);

        await new Promise(resolve => setTimeout(resolve, 211000));

        return true;
    } catch (error) {
        throw new Error('Erro ao abrir link: ' + error.message);
    } finally {
        await page?.close();
    }
}

export default openPage;
