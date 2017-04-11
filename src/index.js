import fs from 'fs';
import path from 'path';
import events from 'events';
import {
    createHash
} from 'crypto';
import request from 'request';
import WechatRequest from './util/request';
import Config from './util/config';
import Log from './util/log';
import {login} from './decorators/index';

const WECHATFILE = path.join(__dirname, '_data', 'wechat.json');

export default class Wechat extends events {
    constructor(username, pwd) {
        super();

        this.username = username;
        this.pwd = createHash('md5').update(pwd.substr(0, 16)).digest('hex');
        this.islogin = false;
        try {
            let data = JSON.parse(fs.readFileSync(WECHATFILE));
            this.data = data || {};
        } catch (error) {
            this.data = {};
        }
    }
    _startlogin(imgcode = '') {
        return WechatRequest({
            url: `${Config.api.bizlogin}?action=startlogin`,
            form: {
                username: this.username,
                pwd: this.pwd,
                imgcode: imgcode,
                f: 'json'
            }
        }).then(body => {
            if (body.base_resp.ret === 0) {
                return Config.baseurl + body.redirect_url;
            } else {
                // 200023 您输入的帐号或者密码不正确，请重新输入。
                // 200008 验证码
                if (body.base_resp.ret === 200008) {
                    let filename = 'verifycode.png';
                    let writeStream = fs.createWriteStream(filename);
                    WechatRequest.get(`${Config.api.verifycode}?username=${this.username}&r=${Date.now()}`).pipe(writeStream);
                    writeStream.on('finish', () => {
                        this.emit('vcode', filename);
                    });
                }
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
                    this.data.token = token[1];
                    Log.info('登录成功，token=' + this.data.token);
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
    _wechatData() {
        return new Promise((resolve, reject) => {
            WechatRequest.get(`${Config.api.masssendpage}?t=mass/send&token=${this.data.token}`, (e, r, body) => {
                if (e) {
                    reject(e);
                } else {
                    let ticketMatch = body.match(/ticket:"(\w+)"/);
                    let userNameMatch = body.match(/user_name:"(\w+)"/);
                    let massProtectMatch = body.match(/"protect_status":(\d+)/);
                    let operationMatch = body.match(/operation_seq:\s*"(\d+)"/);
                    if (ticketMatch && userNameMatch) {
                        this.data.ticket = ticketMatch[1];
                        this.data.user_name = userNameMatch[1];
                        if (operationMatch) {
                            this.data.operation_seq = operationMatch[1];
                        }
                        if (massProtectMatch && (2 & massProtectMatch[1]) === 2) {
                            // 群发保护
                            this.data.mass_protect = 1;
                        }
                        this.islogin = true;
                        resolve(this.data);
                        fs.writeFile(WECHATFILE, JSON.stringify(this.data), function () {

                        });
                    } else {
                        reject('解析wxdata失败');
                    }
                }
            });
        });
    }
    _loginstep(resolve, reject, imgcode) {
        this._startlogin(imgcode).then(redirectUrl => {
            this._checkLogin().then(() => {
                this._doLogin(redirectUrl).then(() => {
                    this._wechatData().then(resolve).catch(reject);
                }).catch(reject);
            }).catch(reject);
        }).catch(reject);
    }
    login(imgcode) {
        return new Promise((resolve, reject) => {
            if (this.islogin) {
                resolve(this.data);
            } else if (this.data.token) {
                let req = WechatRequest.get(Config.baseurl, (error, response, body) => {
                    if (error) {
                        this._loginstep(resolve, reject, imgcode);
                    } else {
                        let redirects = req._redirect.redirects;
                        if (redirects && redirects.length) {
                            let redirectUri = redirects[redirects.length - 1].redirectUri;
                            if (/token=(\d+)/.test(redirectUri)) {
                                this.islogin = true;
                                resolve(this.data);
                            } else {
                                this._loginstep(resolve, reject, imgcode);
                            }
                        } else {
                            this._loginstep(resolve, reject, imgcode);
                        }
                    }
                });
            } else {
                this._loginstep(resolve, reject);
            }
        });
    }
    /**
     * @desc 创建图文素材
     * @param news{array}                   消息列表
     * @param news[].title{string}          文章标题
     * @param news[].thumb{string}          文章缩略图
     * @param news[].description{string}    描述信息
     * @param news[].html{string}           文章内容
     * @param news[].url{string}            原文地址
     * @return appMsgId{Promise}
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
                this.parseNewsList(postNews).then(newsObj => {
                    this._operate_appmsg(newsObj, postNews.length).then(resolve).catch(reject);
                }).catch(reject);
            } else {
                reject('至少有一篇新闻具有图片');
            }
        });
    }
    parseNewsList(newsList) {
        return Promise.all(newsList.map((item, index) => this.parseNews(item, index))).then(paramArr => {
            return Object.assign.apply(Object, paramArr);
        });
    }
    parseNews(news, index) {
        let pattern = /<img[^>]+src=['"]([^'"]+)['"]+/g;
        let promiseArr = [];
        let imgs = [];
        let temp = null;
        while ((temp = pattern.exec(news.html)) !== null && imgs.indexOf(temp[1]) === -1 && !this.isLocalDomain(temp[1])) {
            promiseArr.push(this.uploadimg2cdn(temp[1]));
            imgs.push(temp[1]);
        }
        /**
         * @desc 上传缩略图
         */
        promiseArr.push(this.uploadimg2cdn(news.thumb));

        return Promise.all(promiseArr).then(urls => {
            imgs.forEach((imgurl, i) => {
                news.html = news.html.replace(new RegExp(imgurl, 'gi'), urls[i]);
            });
            news.cdn_url = urls[urls.length - 1];
            return this._newsToMpParam(news, index);
        })
    }
    isLocalDomain(url) {
        let localReg = [
            /^http(s)?:\/\/mmbiz\.qpic\.cn([\/?].*)*$/i,
            /^http(s)?:\/\/mmbiz\.qlogo\.cn([\/?].*)*$/i,
            /^http(s)?:\/\/m\.qpic\.cn([\/?].*)*$/i,
            /^http(s)?:\/\/mmsns\.qpic\.cn([\/?].*)*$/i,
            /^http(s)?:\/\/mp\.weixin\.qq\.com([\/?].*)*$/i,
            /^http(s)?:\/\/(a|b)(\d)+\.photo\.store\.qq\.com([\/?].*)*$/i
        ];
        return localReg.some(pattern => pattern.test(url));
    }
    _operate_appmsg(wechatNews, count) {
        let params = {
            token: this.data.token,
            f: 'json',
            ajax: 1,
            random: Math.random()
        };
        if (count) {
            params.count = count;
            Object.assign(params, wechatNews);
        } else {
            params.count = wechatNews.length;
            Object.assign(params, this._transformToMpParam(wechatNews));
        }
        return WechatRequest({
            url: `${Config.api.operate_appmsg}?t=ajax-response&sub=create&type=10&token=${this.data.token}`,
            headers: {
                'Referer': `${Config.api.appmsg}?t=media/appmsg_edit&action=edit&type=10&isMul=1&isNew=1&token=${this.data.token}`
            },
            form: params
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
            Object.assign(obj, this._newsToMpParam(item, index));
        });
        return obj;
    }
    _newsToMpParam(item, index) {
        let obj = {};
        obj[`title${index}`] = item.title;
        obj[`content${index}`] = item.html;
        obj[`digest${index}`] = item.description;
        obj[`fileid${index}`] = item.fileid || ''; // 图片微信id
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
        return obj;
    }
    /**
     * @desc 批量上传远程图片至公众号
     * @param arr{array}    远程图片地址
     */
    batchUpload(arr) {
        return Promise.all(arr.map(imgurl => this.filetransfer(imgurl)));
    }
    /**
     * @desc 上传单个远程图片至公众号
     * @param imgurl{string}    远程图片地址
     */
    filetransfer(imgurl) {
        return new Promise((resolve, reject) => {
            let filename = path.join(Config.upload, Date.now() + '.png');
            let writeStream = fs.createWriteStream(filename);
            request(imgurl).pipe(writeStream).on('error', reject);
            writeStream.on('finish', () => this.localUpload(filename).then(resolve).catch(reject));
        });
    }
    /**
     * @desc 上传本地图片至公众号
     * @param filepath{string}  本地图片地址
     */
    localUpload(filepath) {
        return WechatRequest({
            url: `${Config.api.filetransfer}?action=upload_material&f=json&scene=1&writetype=doublewrite&groupid=1&ticket_id=${this.data.user_name}&ticket=${this.data.ticket}&svr_time=${Math.floor(Date.now()/1000)}&seq=1&token=${this.data.token}`,
            headers: {
                'Referer': `${Config.api.filepage}?type=2&begin=0&count=12&t=media/img_list&token=${this.data.token}`
            },
            formData: {
                file: fs.createReadStream(filepath)
            }
        }).then(body => {
            if (body.base_resp.ret === 0) {
                return {
                    fileid: body.content,
                    cdn_url: body.cdn_url
                };
            } else {
                throw body;
            }
        });
    }
    /**
     * @desc 上传远程图片上传至cdn
     */
    uploadimg2cdn(imgurl) {
        return WechatRequest({
            url: `${Config.api.uploadimg2cdn}?token=${this.data.token}`,
            form: {
                imgurl: imgurl,
                t: 'ajax-editor-upload-img'
            }
        }).then(body => {
            if (body.errcode === 0) {
                return body.url;
            } else {
                throw body;
            }
        });
    }
    /**
     * @desc    群发消息
     * @param   appMsgId{string}
     * @param   groupid{number}     分组id，默认-1 所有用户
     */
    masssend(appmsgid, groupid = -1) {
        let params = {
            appmsgid: appmsgid,
            groupid: groupid
        };
        if (this.data.mass_protect) {
            return new Promise((resolve, reject) => {
                this.getticket().then(body => {
                    this.getuuid(body.ticket).then(uuid => {
                        params.uuid = uuid;
                        Object.assign(params, body);
                        this.checkuuid(params).then(res => {
                            params.code = res.code;
                            this.safesend(params).then(resolve).catch(reject);
                        }).catch(reject);
                    }).catch(reject);
                }).catch(reject);
            });
        } else {
            params.operation_seq = this.data.operation_seq;
            return this.safesend(params);
        }
    }
    /**
     * @desc 获取群发ticket
     */
    getticket() {
        Log.info('获取群发ticket');
        return WechatRequest({
            url: `${Config.api.safeassistant}?1=1&token=${this.data.token}`,
            form: {
                token: this.data.token,
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
            url: `${Config.api.safeqrconnect}?1=1&token=${this.data.token}`,
            form: {
                token: this.data.token,
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
                url: `${Config.api.safeuuid}?timespam=${Date.now()}&token=${this.data.token}`,
                form: {
                    token: this.data.token,
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
        return WechatRequest({
            url: `${Config.api.masssend}?t=ajax-response&token=${this.data.token}&req_need_vidsn=1&add_tx_video=1`,
            form: {
                token: this.data.token,
                f: 'json',
                ajax: 1,
                random: Math.random(),
                type: 10,
                appmsgid: obj.appmsgid,
                cardlimit: 1,
                sex: 0,
                groupid: obj.groupid,
                synctxweibo: 0,
                country: '',
                province: '',
                city: '',
                imgcode: '',
                direct_send: 1,
                operation_seq: obj.operation_seq,
                req_id: this._getid(32),
                req_time: Date.now(),
                code: obj.code || ''
            }
        }).then(body => {
            if (body.base_resp.ret === 0) {
                return body;
            } else {
                Log.error(body);
                throw body;
            }
        });
    }
    /**
     * @desc    发文本消息给某个用户
     * @param   tofakeid{string}    用户fakeid，可以在公众号后台singlesendpage页面url看到或者消息列表
     * @param   msg{string}         消息内容
     * @param   replyId{string}     回复消息id，可以消息列表看到，可选
     */
    singlesend(tofakeid, msg, replyId = '') {
        return WechatRequest({
            url: `${Config.api.singlesend}?t=ajax-response&f=json&token=${this.data.token}`,
            form: {
                token: this.data.token,
                f: 'json',
                ajax: 1,
                random: Math.random(),
                type: 1,
                content: msg,
                tofakeid: tofakeid,
                quickReplyId: replyId,
                imgcode: ''
            }
        }).then(body => {
            if (body.base_resp.ret === 0) {
                return body;
            } else {
                Log.error(body);
                throw body;
            }
        });
    }
    /**
     * @desc 获取公众号消息列表
     * @param   count{number}   消息条数
     * @param   day{number|string}  今天：0 昨天：1 前天：2 更早：3 最近5天：7 已收藏消息：star，默认：0
     * @return  msgs{Promise<Array<Object>>}
     * @return  msgs[].content      消息内容
     * @return  msgs[].date_time    消息时间
     * @return  msgs[].fakeid       用户fakeid
     * @return  msgs[].func_flag
     * @return  msgs[].has_reply
     * @return  msgs[].id           replyId
     * @return  msgs[].is_vip_msg
     * @return  msgs[].msg_status
     * @return  msgs[].multi_item{Array}
     * @return  msgs[].nick_name
     * @return  msgs[].refuse_reason
     * @return  msgs[].to_uin
     * @return  msgs[].type
     * @return  msgs[].wx_headimg_url   用户头像地址
     */
    @login()
    message(count, day = 0) {
        return new Promise((resolve, reject) => {
            let url = `${Config.api.message}?t=message/list&count=${count}&token=${this.data.token}`;
            url += day === 'star' ? '&action=star' : `&day=${day}`;
            WechatRequest.get(url, (e, r, body) => {
                if (e) {
                    reject(e);
                } else {
                    try {
                        let msgMatch = body.match(/{"msg_item":(\[[\s\S]*?\])}/);
                        let msgs = JSON.parse(msgMatch[1]);
                        resolve(msgs);
                    } catch (error) {
                        reject(error);
                    }
                }
            });
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
     * @param url{string}   远程图片地址/本地图片路径
     */
    qrdecode(url) {
        return new Promise((resolve, reject) => {
            let formData = {};
            if (/^https?:\/\//.test(url)) {
                formData.url = url;
            } else {
                try {
                    formData.qrcode = fs.createReadStream(url);
                } catch (error) {
                    reject(error);
                }
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