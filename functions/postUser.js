async function postUser(token, email, id, firstName, lastName) {
    const body = {
        _id: id,
        __typename: "User",
        firstName: firstName,
        lastName: lastName,
        email: email,
        isInviteMode: false
    }

    const response = await fetch("https://prod-backend.vidgenie.ai/api/user", {
        "headers": {
          "accept-language": "pt-BR,pt;q=0.9",
          "authorization": `Bearer ${token}`,
          "content-type": "application/json",
        },
        "body": JSON.stringify(body),
        "method": "POST"
      });

      const data = await response.json();
      return data;
    
}

export default postUser;