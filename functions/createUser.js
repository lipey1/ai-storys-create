import { fstat } from "fs";
import createEmail from "./createEmail.js";
import getInbox, { getToken, readMessage } from "./inbox.js";
import openLink from "./openLink.js";
import postUser from "./postUser.js";
import randomString from "./randomString.js";
import sendVerificationEmail from "./sendVerificationEmail.js";
import signup from "./signup.js";
import fs from "fs";
import path from "path";

async function createUser(browser) {
	const { address, password } = await createEmail();
	console.log(' ○'.green + ' Email:Senha => '.white + `${address}:${password}`);
	const user = await signup(address, password);
	const { idToken, refreshToken, localId, email } = user;
	if (!idToken, !refreshToken || !localId || !email) {
		throw new Error('Falha ao criar usuário');
	}
	const firstName = "Minecraft_" + randomString(10);
	const lastName = "Biblico_" + randomString(10);
	const userPost = await postUser(idToken, email, localId, firstName, lastName);
	if (!userPost) {
		throw new Error('Falha ao postar usuário');
	}
	console.log(' ○'.green + ' Usuário postado com sucesso!'.white);
	const emailSend = await sendVerificationEmail(idToken, email);
	if (!emailSend) {
		throw new Error('Falha ao enviar email de verificação');
	}
	console.log(' ○'.green + ' Email de verificação enviado com sucesso!'.white);
	const linkVerification = await new Promise((resolve, reject) => {
		setTimeout(() => {
			reject(new Error('Timeout ao buscar link de verificação'));
		}, 300000);
		setInterval(async () => {
			const inbox = await getInbox(address, password);
			if (inbox.length > 0) {
				// Pegar token para ler conteúdo completo dos emails
				const token = await getToken(address, password);

				for (const email of inbox) {
					if (email.subject.toLowerCase().includes('verify')) {
						// Ler conteúdo completo do email
						const emailContent = await readMessage(token, email.id);

						// Extrair link de verificação do HTML
						if (emailContent && emailContent.html) {
							const htmlContent = emailContent.html[0];
							const linkMatch = htmlContent.match(/href='([^']*verifyEmail[^']*)'/);
							if (linkMatch) {
								const verificationLink = linkMatch[1].replace(/&amp;/g, '&');
								resolve(verificationLink);
							}
						}
						break;
					}
				}
			}
		}, 5000);
	})

	console.log(' ○'.green + ' Link de verificação: '.white + `${linkVerification}`.blue);
	const linkOpened = await openLink(browser, linkVerification);
	if (!linkOpened) {
		throw new Error('Falha ao abrir link de verificação');
	}
	console.log(' ○'.green + ' Link de verificação aberto com sucesso!'.white);

	const userData = {
		displayName: firstName + ' ' + lastName,
		email: email,
		refreshToken: refreshToken,
		accessToken: idToken,
		id: localId
	}

	const dir = path.join(process.cwd(), 'accounts.txt');
	const read = fs.readFileSync(dir, 'utf8');
	fs.writeFileSync('accounts.txt', read + '\n' + `${email}:${password}`);

	console.log(' ○'.green + ' Email de verificação recebido com sucesso!'.white);
	return userData;
}

export default createUser;