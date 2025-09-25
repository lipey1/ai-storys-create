import puppeteer from 'puppeteer';

async function openLink(browser, verificationLink) {
    let page;
    try {
        console.log(' ○'.green + ' Abrindo link de verificação...'.white)

        page = await browser.newPage();
        await page.goto(verificationLink);

        const currentPath = await page.evaluate(() => window.location.pathname);
        const result = await new Promise(async (resolve) => {
            setTimeout(() => {
                resolve(false);
            }, 300000);
            setInterval(async () => {
                try {
                    const actualPath = await page.evaluate(() => window.location.pathname);
                    const element = await page.$('body > oq-root > oq-auth-action-base > oq-auth-action-verify-email > div > div:nth-child(2) > div:nth-child(2)');
                    const text = await element?.evaluate(el => el.textContent);

                    if (actualPath !== currentPath && actualPath == '/auth/sign-in') {
                        resolve(true);
                    }

                    if (text?.toLocaleLowerCase().includes('failed')) {
                        resolve(false);
                    }

                    if (text?.toLocaleLowerCase().includes('verified')) {
                        resolve(true);
                    }
                } catch { }
            }, 2000);
        });

        if (!result) {
            return false;
        }

        console.log(' ○'.green + ' Email verificado com sucesso!'.white);
        return result;
    } catch (error) {
        throw new Error('Erro ao abrir link: ' + error.message);
    } finally {
        await page?.close();
    }
}

export default openLink;
