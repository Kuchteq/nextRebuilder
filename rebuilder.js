const Koa = require('koa');
const Router = require('koa-router');
const { projectName, rebuildRoute, properModel, reloadRoute, onlyFetchRoute, pathToProject, pathToConfig, strapiUrl } = require('./_settings.js');
const app = new Koa();
const router = new Router();
const { exec } = require("child_process");
const fs = require('fs');
const koaBody = require('koa-body');
const pm2 = require('pm2');
const axios = require('axios')

router.post(rebuildRoute, koaBody(), (ctx, next) => {
    const model = ctx.request.body.model;
    if (model == properModel) {
        console.log('Webhook received, saving data');
        const entry = ctx.request.body.entry;
        fs.writeFile(pathToConfig, JSON.stringify(entry), () => {
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
            ctx.body = 'Build started'
        })
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