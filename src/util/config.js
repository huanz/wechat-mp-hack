import * as fs from 'fs';
import * as path from 'path';

const HOST = 'mp.weixin.qq.com';
const BASEURL = `https://${HOST}`;

const API = {
    home: `${BASEURL}/cgi-bin/home`,
    bizlogin: `${BASEURL}/cgi-bin/bizlogin`,
    loginqrcode: `${BASEURL}/cgi-bin/loginqrcode`,
    operate_appmsg: `${BASEURL}/cgi-bin/operate_appmsg`,
    appmsg: `${BASEURL}/cgi-bin/appmsg`,
    filetransfer: `${BASEURL}/cgi-bin/filetransfer`,
    filepage: `${BASEURL}/cgi-bin/filepage`,
    masssend: `${BASEURL}/cgi-bin/masssend`,
    safeassistant: `${BASEURL}/misc/safeassistant`,
    safeqrconnect: `${BASEURL}/safe/safeqrconnect`,
    safeqrcode: `${BASEURL}/safe/safeqrcode`,
    safeuuid: `${BASEURL}/safe/safeuuid`
};

const Config = {
    host: HOST,
    baseurl: BASEURL,
    api: API,
    upload: path.join(process.cwd(), 'upload')
};

if (!fs.existsSync(Config.upload)) {
    fs.mkdir(Config.upload, () => {});
}

export default Config;