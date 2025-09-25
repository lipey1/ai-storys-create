async function signup(email, password) {
    const body = {
        returnSecureToken: true,
        email: email,
        password: password,
        clientType: "CLIENT_TYPE_WEB"
    };

    const apiKey = process.env.FIREBASE_API_KEY;

    const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`, {
        "headers": {
          "accept-language": "pt-BR,pt;q=0.9",
        },
        "referrer": "",
        "body": JSON.stringify(body),
        "method": "POST"
      });

      const data = await response.json();
      return data;
}

export default signup;