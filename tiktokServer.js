import express from 'express';
import { OAuthTicTok } from '@innovatespace/tiktok';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.TIKTOK_PORT || 3000;

// Configurações do TikTok
const clientKey = process.env.TIKTOK_APP_CLIENT_KEY;
const clientSecret = process.env.TIKTOK_APP_CLIENT_SECRET;
const redirectUri = process.env.TIKTOK_REDIRECT_URI;

// Inicializa OAuth
const oauth = new OAuthTicTok(clientKey, clientSecret);

// Estado para CSRF protection
let currentState = null;

// Rota principal
app.get('/', (req, res) => {
    res.send(`
        <html>
            <head>
                <title>TikTok Login</title>
                <style>
                    body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
                    .container { max-width: 600px; margin: 0 auto; }
                    .btn { background: #ff0050; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 20px; }
                    .btn:hover { background: #e6004a; }
                    .status { padding: 20px; margin: 20px 0; border-radius: 5px; }
                    .success { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
                    .error { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>🎵 TikTok Login System</h1>
                    <p>Clique no botão abaixo para fazer login no TikTok</p>
                    <a href="/login" class="btn">🚀 Fazer Login no TikTok</a>
                    <p><small>Porta: ${PORT} | Redirect URI: ${redirectUri}</small></p>
                </div>
            </body>
        </html>
    `);
});

// Rota de login - gera URL de autorização
app.get('/login', async (req, res) => {
    try {
        console.log('🔗 Gerando URL de autorização...');

        // Gera state para CSRF protection
        currentState = Math.random().toString(36).substring(2, 15) +
            Math.random().toString(36).substring(2, 15);

        const authData = await oauth.getRedirectUri({
            scope: ['video.publish', 'video.upload'],
            redirect_uri: redirectUri,
            state: currentState,
            code_challenge_method: 'sha256'
        });


        console.log('✅ URL gerada, redirecionando...');
        console.log('🎵 State:', currentState);

        // Redireciona automaticamente para o TikTok
        res.redirect(authData.url);

    } catch (error) {
        console.error('❌ Erro ao gerar URL:', error.message);
        res.status(500).send(`
            <div class="container">
                <h1>❌ Erro</h1>
                <div class="status error">
                    <strong>Erro:</strong> ${error.message}
                </div>
                <a href="/" class="btn">🏠 Voltar</a>
            </div>
        `);
    }
});

// Rota de callback - recebe o código
app.get('/callback', async (req, res) => {
    try {
        const { code, state } = req.query;

        console.log('📥 Callback recebido!');
        console.log('🔑 Code:', code);
        console.log('🎵 State:', state);
        console.log('🎯 State esperado:', currentState);

        // Verifica se o state confere (proteção CSRF)
        if (state !== currentState) {
            throw new Error('State inválido - possível ataque CSRF');
        }

        if (!code) {
            throw new Error('Código de autorização não fornecido');
        }

        console.log('🔄 Trocando código por token...');

        // Troca código por token - parâmetros corretos
        const tokenData = await oauth.exchangeCodeForToken({
            code: code,
            redirect_uri: redirectUri,
            grant_type: "authorization_code"
        });

        console.log('✅ Token obtido!');
        console.log('🎯 Access Token:', tokenData.access_token?.substring(0, 20) + '...');

        // Salva token em arquivo
        const tokenFile = path.join(process.cwd(), 'data', 'token.txt');
        const tokenContent = `${tokenData.access_token}:${tokenData.refresh_token}`;

        // Garante que o diretório existe
        const dir = path.dirname(tokenFile);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        // Salva o token
        fs.writeFileSync(tokenFile, tokenContent);
        console.log('💾 Token salvo em:', tokenFile);

        // Limpa o state
        currentState = null;

        // Resposta de sucesso
        res.send(`
            <html>
                <head>
                    <title>Login Concluído</title>
                    <style>
                        body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
                        .container { max-width: 600px; margin: 0 auto; }
                        .status { padding: 20px; margin: 20px 0; border-radius: 5px; background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
                        .btn { background: #ff0050; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 20px; }
                        .btn:hover { background: #e6004a; }
                        .token { background: #f8f9fa; padding: 10px; border-radius: 5px; font-family: monospace; word-break: break-all; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <h1>🎉 Login Concluído!</h1>
                        <div class="status">
                            <strong>✅ Sucesso!</strong> Token obtido e salvo com sucesso!
                        </div>
                        <p><strong>Token salvo em:</strong> data/token.txt</p>
                        <div class="token">${tokenData.access_token}</div>
                        <p><small>Você pode fechar esta janela e usar o token em seus projetos.</small></p>
                        <a href="/" class="btn">🏠 Voltar</a>
                    </div>
                </body>
            </html>
        `);

    } catch (error) {
        console.error('❌ Erro no callback:', error.message);
        res.status(500).send(`
            <html>
                <head>
                    <title>Erro no Login</title>
                    <style>
                        body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
                        .container { max-width: 600px; margin: 0 auto; }
                        .status { padding: 20px; margin: 20px 0; border-radius: 5px; background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
                        .btn { background: #ff0050; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 20px; }
                        .btn:hover { background: #e6004a; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <h1>❌ Erro no Login</h1>
                        <div class="status">
                            <strong>Erro:</strong> ${error.message}
                        </div>
                        <a href="/" class="btn">🔄 Tentar Novamente</a>
                    </div>
                </body>
            </html>
        `);
    }
});

// Rota para verificar token
app.get('/token', (req, res) => {
    try {
        const tokenFile = path.join(process.cwd(), 'data', 'token.txt');

        if (!fs.existsSync(tokenFile)) {
            return res.json({
                success: false,
                message: 'Token não encontrado',
                file: tokenFile
            });
        }

        const token = fs.readFileSync(tokenFile, 'utf8').trim();

        res.json({
            success: true,
            token: token,
            file: tokenFile,
            length: token.length
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Inicia o servidor
app.listen(PORT, () => {
    console.log('🎵 TikTok Login Server');
    console.log('=====================');
    console.log(`🚀 Servidor rodando em: http://localhost:${PORT}`);
    console.log(`🔗 Redirect URI: ${redirectUri}`);
    console.log('');
    console.log('📋 Como usar:');
    console.log('1. Acesse: http://localhost:' + PORT);
    console.log('2. Clique em "Fazer Login no TikTok"');
    console.log('3. Autorize o app no TikTok');
    console.log('4. Token será salvo automaticamente em data/token.txt');
    console.log('');
    console.log('🔍 Verificar token: http://localhost:' + PORT + '/token');
    console.log('');

    if (!clientKey || !clientSecret) {
        console.log('⚠️ ATENÇÃO: Configure suas credenciais no arquivo .env!');
        console.log('   TIKTOK_APP_CLIENT_KEY=seu_client_key');
        console.log('   TIKTOK_APP_CLIENT_SECRET=seu_client_secret');
        console.log('   TIKTOK_PORT=3000');
    } else {
        console.log('✅ Credenciais carregadas!');
        console.log('🔑 Client Key:', clientKey.substring(0, 10) + '...');
    }
});
