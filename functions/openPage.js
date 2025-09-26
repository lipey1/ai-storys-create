import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';

// Função para aguardar download começar e terminar
async function waitForDownload(downloadPath, page, timeout = 600000) { // 10 minutos timeout
    return new Promise((resolve) => {
        console.log(' ○'.blue + ' Aguardando download começar...'.white);
        
        // Lista inicial de arquivos
        const initialFiles = fs.existsSync(downloadPath) ? fs.readdirSync(downloadPath) : [];
        console.log(' ○'.blue + ` Arquivos iniciais na pasta: ${initialFiles.length}`.white);
        
        let checkCount = 0;
        const maxChecks = timeout / 3000; // Verificar a cada 3 segundos
        let downloadStarted = false;
        let lastFileSize = 0;
        let stableCount = 0;
        
        const checkInterval = setInterval(() => {
            checkCount++;
            
            try {
                // Verificar se a página ainda está ativa
                if (page && page.isClosed()) {
                    console.log(' ○'.red + ' Página foi fechada durante o monitoramento'.white);
                    clearInterval(checkInterval);
                    resolve({ success: false, fileName: null, reason: 'page_closed' });
                    return;
                }
                
                if (!fs.existsSync(downloadPath)) {
                    console.log(' ○'.yellow + ` Verificação ${checkCount}: Pasta de download não existe ainda`.white);
                    return;
                }
                
                const currentFiles = fs.readdirSync(downloadPath);
                const newFiles = currentFiles.filter(file => !initialFiles.includes(file));
                
                if (newFiles.length > 0 && !downloadStarted) {
                    console.log(' ○'.green + ` Download iniciado! Arquivo detectado: ${newFiles.join(', ')}`.white);
                    downloadStarted = true;
                }
                
                if (downloadStarted && newFiles.length > 0) {
                    // Verificar se o download terminou
                    for (const fileName of newFiles) {
                        const filePath = path.join(downloadPath, fileName);
                        
                        try {
                            const stats = fs.statSync(filePath);
                            const currentSize = stats.size;
                            
                            if (currentSize > 0) {
                                if (currentSize === lastFileSize) {
                                    stableCount++;
                                    console.log(' ○'.blue + ` Arquivo estável há ${stableCount} verificações (${(currentSize / 1024 / 1024).toFixed(2)} MB)`.white);
                                    
                                    // Se o arquivo está estável por 3 verificações (9 segundos), consideramos completo
                                    if (stableCount >= 3) {
                                        console.log(' ○'.green + ` Download concluído: ${fileName} (${(currentSize / 1024 / 1024).toFixed(2)} MB)`.white);
                                        
                                        const fileInfo = {
                                            fileName: fileName,
                                            filePath: filePath,
                                            fileSize: currentSize,
                                            fileSizeMB: (currentSize / 1024 / 1024).toFixed(2),
                                            downloadDate: new Date(stats.birthtime).toISOString(),
                                            fileExtension: path.extname(fileName)
                                        };
                                        
                                        clearInterval(checkInterval);
                                        resolve({ success: true, ...fileInfo });
                                        return;
                                    }
                                } else {
                                    stableCount = 0;
                                    lastFileSize = currentSize;
                                    console.log(' ○'.blue + ` Download em progresso: ${(currentSize / 1024 / 1024).toFixed(2)} MB`.white);
                                }
                            }
                            
                        } catch (error) {
                            console.log(' ○'.yellow + ` Erro ao verificar arquivo ${fileName}: ${error.message}`.white);
                        }
                    }
                } else if (!downloadStarted) {
                    console.log(' ○'.blue + ` Verificação ${checkCount}/${maxChecks}: Aguardando download começar...`.white);
                }
                
                // Timeout
                if (checkCount >= maxChecks) {
                    console.log(' ○'.red + ' Timeout: Download não foi concluído no tempo esperado'.white);
                    clearInterval(checkInterval);
                    resolve({ success: false, fileName: null });
                }
                
            } catch (error) {
                console.log(' ○'.red + ` Erro durante verificação ${checkCount}: ${error.message}`.white);
            }
        }, 3000); // Verificar a cada 3 segundos
    });
}

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
            const interval = setInterval(async () => {
                const elements = await page.$$('mat-option');
                if (elements.length > 0) {
                    clearInterval(interval);
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

        // Aguardar download começar e terminar
        const downloadResult = await waitForDownload(downloadPath, page);
        
        if (downloadResult.success) {
            console.log(' ○'.green + ` Download concluído: ${downloadResult.fileName}`.white);
            console.log(' ○'.green + ` Tamanho: ${downloadResult.fileSizeMB} MB`.white);
        } else {
            console.log(' ○'.red + ' Timeout: Download não foi concluído no tempo esperado'.white);
        }

        // Aguardar um pouco mais para garantir que todas as operações terminaram
        console.log(' ○'.blue + ' Aguardando operações finalizarem...'.white);
        await new Promise(resolve => setTimeout(resolve, 5000));

        return downloadResult;
    } catch (error) {
        throw new Error('Erro ao abrir link: ' + error.message);
    } finally {
        // Verificar se a página ainda existe antes de tentar fechar
        if (page && !page.isClosed()) {
            try {
                await page.close();
                console.log(' ○'.blue + ' Página fechada com sucesso'.white);
            } catch (closeError) {
                console.log(' ○'.yellow + ` Aviso: Erro ao fechar página: ${closeError.message}`.white);
            }
        } else {
            console.log(' ○'.blue + ' Página já estava fechada'.white);
        }
    }
}

export default openPage;
