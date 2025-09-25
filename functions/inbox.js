import Mailjs from "@cemalgnlts/mailjs";

export async function getToken(address, password) {
	const mailjs = new Mailjs();
	const login = await mailjs.login(address, password);
	if (!login || !login.status) return null;
	return login.data && login.data.token ? login.data.token : null;
}

export async function listMessagesWithClient(mailjs) {
	const messages = await mailjs.getMessages();
	return messages && messages.status ? (messages.data || []) : [];
}

export async function listMessages(token) {
	const mailjs = new Mailjs();
	mailjs.token = token;
	return await listMessagesWithClient(mailjs);
}

export async function readMessage(token, id) {
	const mailjs = new Mailjs();
	mailjs.token = token;
	const detail = await mailjs.getMessage(id);
	return detail && detail.status ? detail.data : null;
}

export default async function getInbox(address, password) {
	const mailjs = new Mailjs();
	const login = await mailjs.login(address, password);
	if (!login || !login.status) throw new Error("Falha ao autenticar no Mail.tm");
	const list = await mailjs.getMessages();
	return list && list.status ? (list.data || []) : [];
}


