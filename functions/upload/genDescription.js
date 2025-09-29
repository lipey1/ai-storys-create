import { GoogleGenAI } from "@google/genai";
import fs from "fs";
import path from "path";
import colors from "colors";


async function genDescription(videoPath) {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const videoBuffer = fs.readFileSync(videoPath);

    let responseDescription = null;
    try {
        responseDescription = await ai.models.generateContent({
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
    } catch {
        console.log(' ○'.red + ' Erro ao gerar descrição, gerando descrição aleatória...'.white);
        console.log(' ○'.red + ' Erro: '.white + error.message);
        const descriptions = fs.readFileSync(path.join(process.cwd(), 'data', 'descriptions.json'), 'utf8');
        const descriptionsArray = JSON.parse(descriptions);
        const randomDescription = descriptionsArray[Math.floor(Math.random() * descriptionsArray.length)];
        responseDescription = {
            candidates: [
                {
                    content: { parts: [{ text: randomDescription }] }
                }
            ]
        }
        console.log(' ○'.red + ' Descrição aleatória: '.white + randomDescription);
    }

    // Processa a resposta JSON do Gemini
    const responseData = responseDescription.candidates[0].content.parts[0].text;
    console.log(' ○'.green + ' Descrição gerada:'.white);
    console.log(' ○'.cyan + ` ${responseData}`.white);
    return responseData;
}

export default genDescription;