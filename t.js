async function main() {

    const el = Array.from(document.querySelectorAll('[placeholder]')).find(e => e.getAttribute('placeholder')?.toLowerCase().includes('language'));
    el.click()

    const languageElements = await new Promise(resolve => {
        setTimeout(() => {
            resolve(false)
        }, 60000)
        setInterval(() => {
            const elements = document.querySelectorAll('mat-option');
            if (elements.length > 0) {
                resolve(elements)
            }
        }, 1000)
    });

    if (!languageElements) {
        throw new Error('Language elements not found')
    }

    for (const element of languageElements) {
        const span = element.querySelector('span > span');
        if (span && span.textContent.toLowerCase().includes('portuguese')) {
            element.click(); // clica na opção English
            break; // se quiser parar no primeiro
        }
    }

    console.log(languageElements)
}

main()