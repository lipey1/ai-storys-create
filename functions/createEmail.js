import Mailjs from "@cemalgnlts/mailjs";

async function createEmail() {
    console.log(' ○'.green + ' Criando email...'.white);
    const mailjs = new Mailjs();
    const account = await mailjs.createOneAccount();
    if (!account || !account.status) {
        throw new Error(account && account.message ? account.message : "Falha ao criar conta");
    }
    const { username, password } = account.data;
    console.log(' ○'.green + ' Email criado com sucesso!'.white);
    return { address: username, password };
}

export default createEmail;