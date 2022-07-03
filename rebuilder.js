const Koa = require('koa');
const Router = require('koa-router');
const { projectName, rebuildRoute, properModels, navigationSlugs, reloadRoute, onlyFetchRoute, pathToProject, pathToConfig, strapiUrl, locales } = require('./_settings.js');
const app = new Koa();
const router = new Router();
const { exec } = require("child_process");
const fs = require('fs');
const koaBody = require('koa-body');
// const pm2 = require('pm2');
const axios = require('axios');
const contentURL = `http://dev1.strona.agency/strapi/api/`;

const ask = axios.create({
    baseURL: contentURL,
    params: { populate: "deep" }
});
const triggerRebuild = async () => {
    console.log('Data saved, starting rebuild')
    exec(`cd ${pathToProject} && npm run build`, (error, stdout, stderr) => {
        if (error) {
            console.log(`error: ${error.message}`);
        }
        if (stderr) {
            console.log(`stderr: ${stderr}`);
        }
        console.log(`Rebuild successfull`);
        pm2.restart(projectName, () => setTimeout(() => {
            console.log('PM2 restarted')
            pm2.disconnect();
        }, 1000));
    })
}
router.post(rebuildRoute, koaBody(), async (ctx, next) => {
    const model = ctx.request.body.model;
    if (properModels.findIndex((a) => a == model) != -1) {
        console.log('Webhook received, saving data');
        let entry = ctx.request.body.entry;
        let savePath = ''
        let response = {};
        if ((navigationSlugs.findIndex((a) => a == entry.slug) != -1) && model == 'navigation') {
            savePath = pathToConfig + entry.slug + ".json"
            for (let locale of locales) {
                response[locale] = (await ask.get('navigation/render/' + entry.slug, { params: { "locale": locale } })).data
            }
        }
        else {
            savePath = pathToConfig + model + ".json"
            for (let locale of locales) {
                response[locale] = (await ask.get('shared', { params: { "locale": locale } })).data.data
            }
        }

        console.log("Data Fetched")
        await new Promise(resolve => setTimeout(resolve, 1000));

        fs.writeFileSync(savePath, JSON.stringify(response))
        await triggerRebuild()
        ctx.body = 'Triggered rebuild'
    }
    else {
        ctx.throw(403)
    }

});

router.post(reloadRoute, (ctx) => {
    pm2.restart(projectName, () => setTimeout(() => {
        console.log('PM2 restarted')
        pm2.disconnect();
    }, 1000));
    ctx.body = 'PM2 restarted'
})
router.post(onlyFetchRoute, async (ctx) => {
    let sharedResponse = {}
    for (let slug of navigationSlugs) {
        let navResponse = {};
        savePath = pathToConfig + slug + ".json"
        for (let locale of locales) {
            navResponse[locale] = (await ask.get('navigation/render/' + slug, { params: { "locale": locale } })).data
        }
        fs.writeFileSync(savePath, JSON.stringify(navResponse))
    }
    for (let locale of locales) {
        sharedResponse[locale] = (await ask.get('shared', { params: { "locale": locale } })).data.data
    }
    savePath = pathToConfig + "shared.json"
    fs.writeFileSync(savePath, JSON.stringify(sharedResponse))
    ctx.body = 'Data Fetched'
})

app
    .use(router.routes())
    .use(router.allowedMethods())
    .listen(4000);

console.log('Rebuilder started')