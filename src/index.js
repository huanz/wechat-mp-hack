import * as fs from 'fs';
import request from 'request';
import async from 'async';
import WechatRequest from './util/request';
import Config from './util/config';
import * as Log from './util/log';

export default class Wechat {
    constructor(username, pwd) {
        this.username = username;
        this.pwd = pwd;
    }
    _startlogin() {
        return WechatRequest({
            url: `${Config.api.bizlogin}?action=startlogin`,
            form: {
                username: this.username,
                pwd: this.pwd,
                imgcode: '',
                f: 'json'
            }
        }).then(body => {
            if (body.base_resp.ret === 0) {
                return Config.baseurl + body.redirect_url;
            } else {
                throw body;
            }
        });
    }
    _checkLogin() {
        const dologin = (resolve, reject) => {
            WechatRequest.getJSON(`${Config.api.loginqrcode}?action=ask&f=json&ajax=1&random=${Math.random()}`).then(body => {
                if (body.status === 1) {
                    resolve(body);
                } else {
                    setTimeout(() => {
                        dologin(resolve, reject);
                    }, 3000);
                }
            }).catch(reject);
        };
        return new Promise((resolve, reject) => {
            WechatRequest.get(`${Config.api.loginqrcode}?action=getqrcode&param=4300`).on('response', () => {
                Log.info('请扫描二维码确认登录！');
                dologin(resolve, reject);
            }).pipe(fs.createWriteStream('qrcode-login.jpg')).on('error', reject);
        });
    }
    _doLogin(referer) {
        let loginAction = (resolve, reject) => {
            WechatRequest({
                url: `${Config.api.bizlogin}?action=login`,
                headers: {
                    'Referer': referer
                },
                form: {
                    f: 'json',
                    ajax: 1,
                    random: Math.random()
                }
            }).then(body => {
                let token = null;
                if (body.base_resp.ret === 0 && (token = body.redirect_url.match(/token=(\d+)/))) {
                    this.token = token[1];
                    Log.info('登录成功，token=' + this.token);
                    resolve(token[1]);
                } else if (body.base_resp.ret === -1) {
                    loginAction(resolve, reject);
                } else {
                    reject(body);
                }
            });
        };
        return new Promise(loginAction);
    }
    _wxdata() {
        return new Promise((resolve, reject) => {
            WechatRequest.get(`${Config.api.home}?t=home/index&lang=zh_CN&token=${this.token}`, (e, r, body) => {
                if (e) {
                    reject(e);
                } else {
                    let ticketMatch = body.match(/ticket:"(\w+)"/);
                    let userNameMatch = body.match(/user_name:"(\w+)"/);
                    if (ticketMatch && userNameMatch) {
                        this.wxdata = {
                            ticket: ticketMatch[1],
                            user_name: userNameMatch[1]
                        };
                        resolve(this.wxdata);
                    } else {
                        reject('解析wxdata失败');
                    }
                }
            });
        });
    }
    login() {
        return new Promise((resolve, reject) => {
            if (this.token) {
                resolve(this.token);
            } else {
                this._startlogin().then(redirectUrl => {
                    this._checkLogin().then(() => {
                        this._doLogin(redirectUrl).then(() => {
                            this._wxdata().then(resolve).catch(reject);
                        }).catch(reject);
                    }).catch(reject);
                }).catch(reject);
            }
        });
    }
    /**
     * @desc 创建图文素材
     * @param {Array<Object>} news
     */
    operate_appmsg(news) {
        WechatRequest({
            url: `${Config.api.operate_appmsg}?t=ajax-response&sub=create&type=10&token=${this.token}`,
            headers: {
                'Referer': `${Config.api.appmsg}?t=media/appmsg_edit&action=edit&type=10&isMul=1&isNew=1&token=${this.token}`
            },
            form: Object.assign({
                token: this.token,
                f: 'json',
                ajax: 1,
                random: Math.random(),
                count: news.length
            }, this._transformToMpParam(news))
        }).then(body => {

        });
    }
    /**
     * @desc 数组变成微信参数
     * title html
     */
    _transformToMpParam(arr) {
        let obj = {};
        arr.map((item, index) => {
            obj[`title${index}`] = item.title;
            obj[`content${index}`] = item.html;
            obj[`digest${index}`] = item.description;
            obj[`fileid${index}`] = item.fileid; // 图片微信id
            obj[`cdn_url${index}`] = item.cdn_url;
            obj[`digest${index}`] = item.description;
            obj[`sourceurl{index}`] = item.url;
            obj[`show_cover_pic${index}`] = 0;
            obj[`need_open_comment${index}`] = 1;
            obj[`music_id${index}`] = '';
            obj[`video_id${index}`] = '';
            obj[`shortvideofileid${index}`] = '';
            obj[`copyright_type${index}`] = '';
            obj[`only_fans_can_comment${index}`] = '';
            obj[`fee${index}`] = '';
            obj[`voteid${index}`] = '';
            obj[`voteismlt${index}`] = '';
            obj[`ad_id${index}`] = '';
        });
        return obj;
    }
    /**
     * @desc 批量上传图片至公众号
     */
    batchUpload(arr) {
        async.every(arr, (imgurl, callback) => {

        });
    }
    /**
     * @desc 上传图片
     */
    filetransfer(imgurl) {
        return new Promise((resolve, reject) => {
            let filename = Date.now() + '.png';
            request(imgurl).on('response', () => {
                WechatRequest({
                    url: `${Config.api.filetransfer}?action=upload_material&f=json&scene=1&writetype=doublewrite&groupid=1&ticket_id=${this.wxdata.user_name}&ticket=${this.wxdata.ticket}&svr_time=${Math.floor(Date.now()/1000)}&seq=1&token=${this.token}`,
                    headers: {
                        'Referer': `${Config.api.filepage}?type=2&begin=0&count=12&t=media/img_list&token=${this.token}`
                    },
                    formData: {
                        file: fs.createReadStream(filename)
                    }
                }).then(body => {
                    if (body.base_resp.ret === 0) {
                        resolve({
                            content: body.content,
                            cdn_url: body.cdn_url
                        });
                    } else {
                        reject(body);
                    }
                }).catch(reject);
            }).pipe(fs.createWriteStream(filename)).on('error', reject);
        });
    }
    /**
     * @desc 群发
     */
    masssend(appmsgid) {
        this.getticket().then(body => {
            this.getuuid(body.ticket).then(uuid => {
                let params = Object.assign({
                    uuid: uuid
                }, body);
                this.checkuuid(params).then(res => {
                    params.code = res.code;
                    params.appmsgid = appmsgid;
                    this.safesend(params);
                }).catch(Log.error);
            }).catch(Log.error);
        }).catch(Log.error);
    }
    /**
     * @desc 获取群发ticket
     */
    getticket() {
        Log.info('获取群发ticket');
        return WechatRequest({
            url: `${Config.api.safeassistant}?1=1&token=${this.token}`,
            form: {
                token: this.token,
                f: 'json',
                ajax: 1,
                random: Math.random(),
                action: 'get_ticket'
            }
        }).then(body => {
            if (body.base_resp.ret === 0) {
                Log.info('群发ticket获取成功');
                return {
                    ticket: body.ticket,
                    operation_seq: body.operation_seq
                };
            } else {
                Log.info('群发ticket获取失败');
                throw body;
            }
        });
    }
    getuuid(ticket) {
        return WechatRequest({
            url: `${Config.api.safeqrconnect}?1=1&token=${this.token}`,
            form: {
                token: this.token,
                f: 'json',
                ajax: 1,
                random: Math.random(),
                state: 0,
                login_type: 'safe_center',
                type: 'json',
                ticket: ticket
            }
        }).then(body => {
            if (body.uuid) {
                Log.info('成功获取uuid');
                return body.uuid;
            } else {
                throw body;
            }
        });
    }
    checkuuid(obj) {
        let douuid = (resolve, reject) => {
            WechatRequest({
                url: `${Config.api.safeuuid}?timespam=${Date.now()}&token=${this.token}`,
                form: {
                    token: this.token,
                    f: 'json',
                    ajax: 1,
                    random: Math.random(),
                    uuid: obj.uuid,
                    action: 'json',
                    type: 'json'
                }
            }).then(body => {
                if (body.errcode == 405) {
                    Log.info('成功扫描群发认证二维码！');
                    resolve(body);
                } else {
                    setTimeout(() => {
                        douuid(resolve, reject);
                    }, 3000);
                }
            }).catch(reject);
        };
        return new Promise((resolve, reject) => {
            WechatRequest.get(`${Config.api.safeqrcode}?action=check&type=msgs&ticket=${obj.ticket}&uuid=${obj.uuid}&msgid=${obj.operation_seq}`).on('response', () => {
                Log.info('请扫描群发认证二维码！');
                douuid(resolve, reject);
            }).pipe(fs.createWriteStream('qrcode-safe.jpg')).on('error', reject);
        });
    }
    safesend(obj) {
        WechatRequest({
            url: `${Config.api.masssend}?t=ajax-response&token=${this.token}&req_need_vidsn=1&add_tx_video=1`,
            form: {
                token: this.token,
                f: 'json',
                ajax: 1,
                random: Math.random(),
                type: 10,
                appmsgid: obj.appmsgid,
                cardlimit: 1,
                sex: 0,
                groupid: -1,
                synctxweibo: 0,
                country: '',
                province: '',
                city: '',
                imgcode: '',
                direct_send: 1,
                operation_seq: obj.operation_seq,
                req_id: this._getid(32),
                req_time: Date.now(),
                code: obj.code
            }
        }).then(result => {
            if (result.base_resp.ret === 0) {
                Log.info('群发成功');
            } else {
                Log.error(result);
            }
        });
    }
    _getid(len) {
        let id = '';
        let str = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        for (let i = 0; i < len; i++) {
            id += str.charAt(Math.floor(Math.random() * str.length));
        }
        return id;
    }
}