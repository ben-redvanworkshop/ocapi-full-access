const fetch = require('node-fetch');
const fs = require('fs');   
const querystring = require('querystring');

const CLIENT_ID = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const FULL_ACCESS = true;

(async() => {
    let token = await getToken(CLIENT_ID);
    console.log(token);
    if (!token.access_token) {
        return;
    }

    let ocapi = setupOcapi(token.access_token);

    let dataAPI = await ocapi.getMetaAPI('data');
    let dataCurrentVersion = (dataAPI.versions.filter(version => version.status === 'current')[0] || dataAPI.versions.pop()).name;

    let shopAPI = await ocapi.getMetaAPI('shop');
    let shopCurrentVersion = (shopAPI.versions.filter(version => version.status === 'current')[0] || shopAPI.versions.pop()).name;

    // silly hack for when data api returned 19_5 and shop returned 19_8, but was incomplete
    dataCurrentVersion = [dataCurrentVersion, shopCurrentVersion].sort()[0];
    shopCurrentVersion = dataCurrentVersion;

    let dataSwagger = await ocapi.getMetaAPI('data/' + dataCurrentVersion);
    fs.writeFileSync('data_output.json', JSON.stringify(makeOcapiOutput(dataSwagger, FULL_ACCESS, CLIENT_ID)));

    let shopSwagger = await ocapi.getMetaAPI('shop/' + shopCurrentVersion);
    fs.writeFileSync('shop_output.json', JSON.stringify(makeOcapiOutput(shopSwagger, FULL_ACCESS, CLIENT_ID)));

})()

function makeOcapiOutput(json, fullAccess, client_id){
    let resources = [];
    Object.keys(json.paths).forEach(function(path){
        if (fullAccess || Object.keys(json.paths[path]).filter(p => { return p === "get" || p === "post"}).length) {
            let resource = {
                resource_id: path.replace(/{\w*}/g, "*"),
                methods: fullAccess ? Object.keys(json.paths[path]) : Object.keys(json.paths[path]).filter(p => { return p === "get" || p === "post" }),
                read_attributes: "(**)"
            };

            if (fullAccess) {
                resource.write_attributes = "(**)";
            }
            resources.push(resource);
        }
    })

    let output = {};
    output._v = json.info.version;
    output.clients = [{
        client_id: client_id,
        resources: resources
    }];

    return output;
}

function setupOcapi(access_token) {
    return {
        getMetaAPI: async function getMetaAPI(apiname) {
            let response = await fetch('https://demo-ocapi.demandware.net/s/-/dw/meta/v1/rest/' + apiname, {
                headers: {
                    'Authorization': 'Bearer ' + access_token
                }
            })

            return await response.json();
        }
    }
}


async function getToken(client_id) {
    let response = await fetch('https://account.demandware.com/dw/oauth2/access_token', {
        method: 'post',
        body: querystring.stringify({'grant_type': 'client_credentials'}),
        headers: {
            'Authorization': 'Basic ' + new Buffer(client_id + ':' + client_id).toString('base64'),
            'Content-Type': 'application/x-www-form-urlencoded',
        }
    });
    return await response.json();
}
