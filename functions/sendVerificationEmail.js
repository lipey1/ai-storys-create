async function sendVerificationEmail(token, email) {
    const body = {
        requestType: "VERIFY_EMAIL",
        idToken: token,
        continueUrl: "https://app.vidgenie.ai"
    }

    const apiKey = process.env.FIREBASE_API_KEY;

    const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${apiKey}`, {
        "headers": {
          "accept-language": "pt-BR,pt;q=0.9",
          "content-type": "application/json",
        },
        "referrer": "",
        "body": JSON.stringify(body),
        "method": "POST"
      });

      const data = await response.json();
      return data;
}


export default sendVerificationEmail;