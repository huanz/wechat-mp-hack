const HOST = 'mp.weixin.qq.com';
const BASEURL = `https://${HOST}`;

const API = {
    home: `${BASEURL}/cgi-bin/home`,
    bizlogin: `${BASEURL}/cgi-bin/bizlogin`,
    loginqrcode: `${BASEURL}/cgi-bin/loginqrcode`,
    operate_appmsg: `${BASEURL}/cgi-bin/operate_appmsg`,
    appmsg: `${BASEURL}/cgi-bin/appmsg`,
    filetransfer: `${BASEURL}/cgi-bin/filetransfer`,
    filepage: `${BASEURL}/cgi-bin/filepage`
};

const Config = {
    host: HOST,
    baseurl: BASEURL,
    api: API
};

export default Config;