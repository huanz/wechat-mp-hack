import fs from 'fs';
import path from 'path';
import events from 'events';
import request from 'request';
import WechatRequest from './util/request';
import Config from './util/config';
import Log from './util/log';

export default class Wechat extends events {
    constructor(username, pwd) {
        super();

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
            let filename = 'qrcode-login.png';
            let writeStream = fs.createWriteStream(filename);
            WechatRequest.get(`${Config.api.loginqrcode}?action=getqrcode&param=4300`).pipe(writeStream).on('error', reject);
            writeStream.on('finish', () => {
                this.emit('scan.login', filename);
                Log.info('请扫描二维码确认登录！');
                dologin(resolve, reject);
            });
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
        return new Promise((resolve, reject) => {
            let uploadImgs = [];
            let postNews = news.filter((item) => {
                let hasThumb = !!item.thumb;
                if (hasThumb) {
                    uploadImgs.push(item.thumb);
                }
                return hasThumb;
            });
            if (uploadImgs.length) {
                this.batchUpload(uploadImgs).then(results => {
                    let wechatNews = postNews.map((item, index) => {
                        Object.assign(item, results[index]);
                        return item;
                    });
                    this._operate_appmsg(wechatNews).then(resolve).catch(reject);
                }).catch(reject);
            } else {
                reject('至少有一篇新闻具有图片');
            }
        });
    }
    _operate_appmsg(wechatNews) {
        return WechatRequest({
            url: `${Config.api.operate_appmsg}?t=ajax-response&sub=create&type=10&token=${this.token}`,
            headers: {
                'Referer': `${Config.api.appmsg}?t=media/appmsg_edit&action=edit&type=10&isMul=1&isNew=1&token=${this.token}`
            },
            form: Object.assign({
                token: this.token,
                f: 'json',
                ajax: 1,
                random: Math.random(),
                count: wechatNews.length,
                AppMsgId: '',
            }, this._transformToMpParam(wechatNews))
        }).then(body => {
            if (body.base_resp.ret === 0) {
                return body.appMsgId;
            } else {
                let errorMap = {
                    '-206': '目前，服务负荷过大，请稍后重试。',
                    '-200': '登录态超时，请重新登录。',
                    '-99': '内容超出字数，请调整',
                    '-1': '系统错误，请注意备份内容后重试',
                    '-2': '参数错误，请注意备份内容后重试',
                    '-5': '服务错误，请注意备份内容后重试。',
                    '10801': '标题不能有违反公众平台协议、相关法律法规和政策的内容，请重新编辑。',
                    '10802': '作者不能有违反公众平台协议、相关法律法规和政策的内容，请重新编辑。',
                    '10803': '敏感链接，请重新添加。',
                    '10804': '摘要不能有违反公众平台协议、相关法律法规和政策的内容，请重新编辑。',
                    '10806': '正文不能有违反公众平台协议、相关法律法规和政策的内容，请重新编辑。',
                    '64506': '保存失败,链接不合法',
                    '64507': '内容不能包含链接，请调整',
                    '64508': '查看原文链接可能具备安全风险，请检查',
                    '64509': '正文中不能包含超过3个视频，请重新编辑正文后再保存。',
                    '64510': '内容不能包含语音，请调整',
                    '64511': '内容不能包多个语音，请调整',
                    '64512': '文章中语音错误,请使用语音添加按钮重新添加。',
                    '64513': '请从正文中选择封面，再尝试保存。',
                    '64514': '你没有权限使用话题卡片功能',
                    '64550': '请勿插入不合法的已群发的图文消息链接',
                    '200002': '参数错误，请注意备份内容后重试'
                };
                let msg = errorMap[body.base_resp.ret] || '';
                Log.error(msg);
                body.msg = msg;
                throw body;
            }
        });
    }
    /**
     * @desc 数组变成微信参数
     * title html
     */
    _transformToMpParam(arr) {
        let obj = {};
        arr.forEach((item, index) => {
            obj[`title${index}`] = item.title;
            obj[`content${index}`] = item.html;
            obj[`digest${index}`] = item.description;
            obj[`fileid${index}`] = item.fileid; // 图片微信id
            obj[`cdn_url${index}`] = item.cdn_url;
            obj[`digest${index}`] = item.description;
            obj[`sourceurl${index}`] = item.url;
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
        return Promise.all(arr.map(imgurl => this.filetransfer(imgurl)));
    }
    /**
     * @desc 上传图片
     */
    filetransfer(imgurl) {
        return new Promise((resolve, reject) => {
            let filename = path.join(Config.upload, Date.now() + '.png');
            let writeStream = fs.createWriteStream(filename);
            request(imgurl).pipe(writeStream).on('error', reject);
            writeStream.on('finish', () => {
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
                            fileid: body.content,
                            cdn_url: body.cdn_url
                        });
                    } else {
                        reject(body);
                    }
                }).catch(reject);
            });
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
            let filename = 'qrcode-safe.png';
            let writeStream = fs.createWriteStream(filename);
            WechatRequest.get(`${Config.api.safeqrcode}?action=check&type=msgs&ticket=${obj.ticket}&uuid=${obj.uuid}&msgid=${obj.operation_seq}`).pipe(writeStream).on('error', reject);
            writeStream.on('finish', () => {
                this.emit('scan.send', filename);
                Log.info('请扫描群发认证二维码！');
                douuid(resolve, reject);
            });
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
    /**
     * @desc 二维码解析
     */
    qrdecode(url) {
        return new Promise((resolve, reject) => {
            let formData = {};
            if(/^https?:\/\//.test(url)) {
                formData.url = url;
            } else {
                formData.qrcode = fs.createReadStream(url);
            }
            request({
                method: 'POST',
                url: 'http://tool.oschina.net/action/qrcode/decode',
                headers: {
                    'Host': 'tool.oschina.net',
                    'Referer': 'http://tool.oschina.net/qr?type=2',
                    'Origin': 'http://tool.oschina.net',
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/56.0.2924.87 Safari/537.36',
                    'Upgrade-Insecure-Requests': 1
                },
                json: true,
                formData: formData
            }, (e, r, body) => {
                e ? reject(e) : resolve(body[0]);
            });
        });
    }
}