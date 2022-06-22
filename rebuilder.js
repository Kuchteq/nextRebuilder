const Koa = require('koa');
const Router = require('koa-router');
const { projectName, rebuildRoute, properModels, navigationSlugs, reloadRoute, onlyFetchRoute, pathToProject, pathToConfig, strapiUrl } = require('./_settings.js');
const app = new Koa();
const router = new Router();
const { exec } = require("child_process");
const fs = require('fs');
const koaBody = require('koa-body');
const pm2 = require('pm2');
const axios = require('axios');

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
        if ((navigationSlugs.findIndex((a) => a == entry.slug) != -1) && model == 'navigation') {
            savePath = pathToConfig + entry.slug + ".json"
            entry = (await axios.get(strapiUrl + 'navigation/render/' + entry.slug)).data
        }
        else {
            savePath = pathToConfig + model + ".json"
        }
        console.log("Data Fetched")
        await new Promise(resolve => setTimeout(resolve, 2000));
        fs.writeFileSync(savePath, JSON.stringify(entry))
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
router.post(onlyFetchRoute, (ctx) => {
    axios.get(strapiUrl + properModel).then((response) => {
        fs.writeFile(pathToConfig, JSON.stringify(response.data.data), () => {
            console.log("Data Fetched")
        })

    })
    ctx.body = 'Data Fetched'
})

app
    .use(router.routes())
    .use(router.allowedMethods())
    .listen(4000);

console.log('Rebuilder started')