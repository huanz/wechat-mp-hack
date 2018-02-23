import fs from 'fs';
import path from 'path';
import request from 'request';
import FileCookieStore from 'tough-cookie-filestore';
import Config from './config';
import Log from './log';

const COOKIEFILE = path.join(__dirname, '..', '_data', 'cookies.json');

let cookieStore = null;
try {
    cookieStore = new FileCookieStore(COOKIEFILE);
} catch (error) {
    fs.writeFileSync(COOKIEFILE, '');
    cookieStore = new FileCookieStore(COOKIEFILE);
}
let j = request.jar(cookieStore);
let r = request.defaults({
    method: 'POST',
    headers: {
        'Referer': Config.baseurl,
        'Host': Config.host,
        'User-Agent': Config.userAgent,
        'X-Requested-With': 'XMLHttpRequest'
    },
    json: true,
    jar: j,
    qs: {
        lang: 'zh_CN'
    },
    followAllRedirects: true,
    followOriginalHttpMethod: true
});

const WechatRequest = (options) => {
    return new Promise((resolve, reject) => {
        r(options, (e, r, body) => {
            if (e) {
                reject(e);
                Log.error(e);
            } else {
                resolve(body);
            }
        });
    });
};

WechatRequest.get = (...options) => {
    return r.get(...options);
};

WechatRequest.getJSON = (url, options) => {
    return WechatRequest(Object.assign({
        method: 'GET',
        url: url,
        qs: {
            f: 'json',
            ajax: 1
        }
    }, options));
};

WechatRequest.cookies = () => {
    let cookies = j.getCookies(Config.baseurl);
    let obj = {};
    cookies.forEach(c => {
        obj[c.key] = c.value;
    });
    return obj;
};

export default WechatRequest;