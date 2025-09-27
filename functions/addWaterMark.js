import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import path from 'path';
import colors from 'colors';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';

// Carrega configurações do arquivo config.json
function loadConfig() {
    try {
        ffmpeg.setFfmpegPath(ffmpegInstaller.path);
        const configData = fs.readFileSync('config.json', 'utf8');
        return JSON.parse(configData);
    } catch (error) {
        console.log(' ○'.red + ' Erro ao carregar config.json:'.white + error.message);
        process.exit(1);
    }
}

// Verifica se o FFmpeg está instalado
async function checkFFmpeg() {
    return new Promise((resolve) => {
        ffmpeg.getAvailableFormats((err, formats) => {
            if (err) {
                console.log(' ○'.red + ' FFmpeg não encontrado. Instale o FFmpeg primeiro.'.white);
                console.log(' ○'.yellow + ' Download: https://ffmpeg.org/download.html'.white);
                resolve(false);
            } else {
                console.log(' ○'.green + ' FFmpeg encontrado'.white);
                resolve(true);
            }
        });
    });
}

// Verifica se os arquivos necessários existem
function checkFiles(config, videoPath) {
    const watermarkPath = config.watermark.image;

    if (!fs.existsSync(watermarkPath)) {
        console.log(' ○'.red + ` Arquivo de marca d'água não encontrado: ${watermarkPath}`.white);
        return false;
    }

    if (!fs.existsSync(videoPath)) {
        console.log(' ○'.red + ` Arquivo de vídeo não encontrado: ${videoPath}`.white);
        return false;
    }

    if (!fs.existsSync(watermarkPath)) {
        console.log(' ○'.red + ` Arquivo de marca d'água não encontrado: ${watermarkPath}`.white);
        return false;
    }

    console.log(' ○'.green + ' Todos os arquivos encontrados'.white);
    return true;
}

// Aplica marca d'água usando fluent-ffmpeg
async function applyWatermarkWithFluentFFmpeg(config, videoPath) {
    const { watermark, ffmpeg: ffmpegConfig } = config;

    return new Promise((resolve, reject) => {
        // Posicionamento da marca d'água
        let xPosition, yPosition;

        if (watermark.position.x === 'center') {
            xPosition = '(W-w)/2';
        } else {
            xPosition = watermark.position.x;
        }

        yPosition = watermark.position.y;

        // Tamanho da marca d'água
        let scaleFilter = '';
        if (watermark.size.height === 'auto') {
            scaleFilter = `scale=${watermark.size.width}:-1`;
        } else {
            scaleFilter = `scale=${watermark.size.width}:${watermark.size.height}`;
        }

        // Aplicar escala se especificada
        if (watermark.scale !== 1.0) {
            scaleFilter += `,scale=iw*${watermark.scale}:ih*${watermark.scale}`;
        }

        // Configurar opacidade se especificada
        if (watermark.opacity && watermark.opacity < 1.0) {
            scaleFilter += `,format=rgba,colorchannelmixer=aa=${watermark.opacity}`;
        }

        const fileNameWithoutExtension = path.basename(videoPath, path.extname(videoPath));
        const extension = path.extname(videoPath);
        const newName = `${fileNameWithoutExtension}_with_watermark${extension}`;
        const downloadPath = path.join(process.cwd(), 'downloads', newName);

        const command = ffmpeg()
            .input(videoPath)
            .input(watermark.image)
            .complexFilter([
                `[1:v]${scaleFilter}[watermark]`,
                `[0:v][watermark]overlay=${xPosition}:${yPosition}:format=auto,format=yuv420p`
            ])
            .videoCodec(ffmpegConfig.codec)
            .addOption(`-preset ${ffmpegConfig.preset}`)
            .addOption(`-crf ${ffmpegConfig.crf}`)
            .audioCodec('copy')
            .output(downloadPath)
            .on('start', (commandLine) => {
                console.log(' ○'.blue + ' Comando FFmpeg: '.white + commandLine);
            })
            .on('progress', (progress) => {
            })
            .on('end', () => {
                console.log(' ○'.green + ' Marca d\'água aplicada com sucesso!'.white);
                console.log(' ○'.blue + ' Arquivo de saída:'.white + downloadPath);

                // Verifica se o arquivo foi criado
                if (fs.existsSync(downloadPath)) {
                    const stats = fs.statSync(downloadPath);
                    const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
                    console.log(' ○'.blue + ' Tamanho do arquivo:'.white + `${fileSizeMB} MB`);
                }

                resolve(downloadPath);
            })
            .on('error', (err) => {
                console.log(' ○'.red + ' Erro ao processar vídeo:'.white + err.message);
                console.log(' ○'.red + err.message);

                if (err.message.includes('ffmpeg')) {
                    console.log(' ○'.yellow + ' Dicas:'.white);
                    console.log('- Verifique se o FFmpeg está instalado corretamente'.yellow);
                    console.log('- Verifique se os caminhos dos arquivos estão corretos'.yellow);
                    console.log('- Verifique se há espaço suficiente no disco'.yellow);
                }

                reject(err);
            });

        command.run();
    });
}

// Função principal para aplicar marca d'água
async function applyWatermark(videoPath) {
    // Carrega configurações
    console.log(' ○'.yellow + ' Carregando configurações do arquivo config.json...'.white);
    const config = loadConfig();
    console.log(' ○'.green + ' Configurações carregadas'.white);

    // Verifica FFmpeg
    console.log(' ○'.yellow + ' Verificando FFmpeg...'.white);
    const ffmpegAvailable = await checkFFmpeg();
    if (!ffmpegAvailable) return;

    // Verifica arquivos
    console.log(' ○'.yellow + ' Verificando arquivos...'.white);
    const filesExist = checkFiles(config, videoPath);
    if (!filesExist) return;

    // Aplica marca d'água
    console.log(' ○'.yellow + ' Aplicando marca d\'água...'.white);
    console.log(' ○'.gray + ' Isso pode levar alguns minutos dependendo do tamanho do vídeo...'.white);

    try {
        return await applyWatermarkWithFluentFFmpeg(config, videoPath);
    } catch (error) {
        console.log(' ○'.red + ' Erro ao processar vídeo:'.white + error.message);
    }
}

// Função para mostrar informações da configuração
function showConfigInfo(config, videoPath) {
    const fileNameWithoutExtension = path.basename(videoPath, path.extname(videoPath));
    const extension = path.extname(videoPath);
    const newName = `${fileNameWithoutExtension}_with_watermark${extension}`;

    console.log(' ○'.cyan + ' Configurações Atuais:'.white);
    console.log(' ○'.blue + ' Vídeo de entrada:'.white + videoPath);
    console.log(' ○'.blue + ' Vídeo de saída:'.white + newName);
    console.log(' ○'.blue + ' Marca d\'água:'.white + config.watermark.image);
    console.log(' ○'.blue + ' Posição:'.white + `x: ${config.watermark.position.x}, y: ${config.watermark.position.y}px`);
    console.log(' ○'.blue + ' Tamanho:'.white + `${config.watermark.size.width}x${config.watermark.size.height}`);
    console.log(' ○'.blue + ' Opacidade:'.white + config.watermark.opacity);
    console.log(' ○'.blue + ' Escala:'.white + config.watermark.scale);
}

async function addWaterMark(videoPath) {
    try {
        const config = loadConfig();
        showConfigInfo(config, videoPath);
        return await applyWatermark(videoPath);
    } catch (error) {
        console.error(colors.red('Erro fatal:'), error.message);
        process.exit(1);
    }
}

export default addWaterMark;