const axios = require('axios')

module.exports = async function (context, req) {
    context.log('JavaScript HTTP trigger function processed a request.');

    const speechRegion = process.env["speechRegion"];
    const speechKey = process.env["speechKey"];

    try{
        const tokenResponse = await axios.post(`https://${speechRegion}.api.cognitive.microsoft.com/sts/v1.0/issueToken`, null, {
            headers: {
                'Ocp-Apim-Subscription-Key': speechKey,
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });
    
        context.res = {
            status: 200,
            headers: {
                'Content-Type': 'application/json'
            },
            body: {
                token: tokenResponse.data,
                region: speechRegion
            }
        };
    }
    catch(err){
        context.log(err.message);
        context.res = {
            status: 401,
            message: "There was an error authorizing your speech key."
        }
    }
}