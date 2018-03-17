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
import {
    login
} from './decorators/index';

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
    startlogin(imgcode = '') {
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
                return this.login_qrcode();
            } else {
                // 200023 您输入的帐号或者密码不正确，请重新输入。
                // 200008 验证码
                if (body.base_resp.ret === 200008) {
                    this.login_vcode();
                }
                throw body;
            }
        });
    }
    login_vcode() {
        return new Promise((resolve, reject) => {
            let filename = 'verifycode.png';
            let writeStream = fs.createWriteStream(filename);
            WechatRequest.get(`${Config.api.verifycode}?username=${this.username}&r=${Date.now()}`).pipe(writeStream).on('error', reject);
            writeStream.on('finish', () => {
                this.emit('vcode', filename);
                resolve(filename);
            });
        });
    }
    login_qrcode() {
        return new Promise((resolve, reject) => {
            let filename = 'qrcode-login.png';
            let writeStream = fs.createWriteStream(filename);
            WechatRequest.get(`${Config.api.loginqrcode}?action=getqrcode&param=4300`).pipe(writeStream).on('error', reject);
            writeStream.on('finish', () => {
                this.emit('scan.login', filename);
                Log.info('请扫描二维码确认登录！');
                resolve(filename);
            });
        })
    }
    checkLogin() {
        const chklogin = (resolve, reject) => {
            WechatRequest.getJSON(`${Config.api.loginqrcode}?action=ask&random=${Math.random()}`).then(body => {
                if (body.status === 1) {
                    resolve(body);
                } else {
                    setTimeout(() => {
                        chklogin(resolve, reject);
                    }, 3000);
                }
            }).catch(reject);
        };
        return new Promise(chklogin);
    }
    doLogin() {
        let loginAction = (resolve, reject) => {
            WechatRequest({
                url: `${Config.api.bizlogin}?action=login`,
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
                        fs.writeFile(WECHATFILE, JSON.stringify(this.data), function () {});
                    } else {
                        reject('解析wxdata失败');
                    }
                }
            });
        });
    }
    loginstep() {
        return this.checkLogin().then(() => this.doLogin().then(() => this._wechatData()));
    }
    loginchk() {
        return new Promise((resolve, reject) => {
            if (this.islogin) {
                resolve(this.data);
            } else if (this.data.token) {
                let req = WechatRequest.get(Config.baseurl, (error, response, body) => {
                    if (error) {
                        reject(error);
                    } else {
                        let redirects = req._redirect.redirects;
                        if (redirects && redirects.length) {
                            let redirectUri = redirects[redirects.length - 1].redirectUri;
                            if (/token=(\d+)/.test(redirectUri)) {
                                this.islogin = true;
                                resolve(this.data);
                            } else {
                                reject();
                            }
                        } else {
                            reject();
                        }
                    }
                });
            } else {
                reject();
            }
        });
    }
    /**
     * @desc 登录公众号
     * @param {string} imgcode - [可选]验证码
     * @return {Promise<object>} data
     */
    login(imgcode) {
        return new Promise((resolve, reject) => {
            this.loginchk().then(resolve).catch(() => {
                this.startlogin(imgcode).then(() => {
                    this.loginstep().then(resolve).catch(reject);
                }).catch(reject);
            });
        });
    }
    /**
     * 获取图文/视频素材列表
     * @param {number} type - 素材类型：图文素材-10 视频素材-15 默认-10
     * @param {number} begin - 从第几条开始 默认-0
     * @param {number} count - 返回条数 默认-10
     * @return {Promise<array>} - 素材列表
     * @return {number} [].app_id - 素材id appMsgId
     * @return {string} [].author - 作者
     * @return {string} [].title - 标题
     * @return {string} [].digest - 素材描述信息
     * @return {string} [].img_url - 图片地址
     * @return {number} [].file_id
     * @return {number} [].is_illegal
     * @return {number} [].is_sync_top_stories
     * @return {number} [].data_seq
     * @return {number} [].seq
     * @return {number} [].show_cover_pic
     * @return {string} [].create_time - 创建时间，单位秒
     * @return {string} [].update_time
     * @return {array} [].multi_item - 素材资源列表（一个素材下面有多个文章）
     * @return {string} [].multi_item[].author - 文章作者
     * @return {string} [].multi_item[].author_appid
     * @return {number} [].multi_item[].can_reward - 文章是否可打赏，0否
     * @return {string} [].multi_item[].cdn_url - 图片/视频地址
     * @return {string} [].multi_item[].cdn_url_back
     * @return {number} [].multi_item[].cover - 封面图片地址
     * @return {string} [].multi_item[].digest - 文章描述
     * @return {number} [].multi_item[].file_id
     * @return {string} [].multi_item[].free_content
     * @return {number} [].multi_item[].is_new_video
     * @return {number} [].multi_item[].need_open_comment
     * @return {boolean} [].multi_item[].only_fans_can_comment
     * @return {string} [].multi_item[].ori_white_list
     * @return {number} [].multi_item[].review_status
     * @return {number} [].multi_item[].reward_money
     * @return {string} [].multi_item[].reward_wording
     * @return {number} [].multi_item[].seq
     * @return {number} [].multi_item[].show_cover_pic
     * @return {number} [].multi_item[].smart_product
     * @return {string} [].multi_item[].source_url - 原文地址
     * @return {string} [].multi_item[].title - 文章标题
     * @return {array<string>} [].multi_item[].tags - 文章标签
     */
    @login
    appmsg(type = 10, begin = 0, count = 10) {
        return WechatRequest.getJSON(`${Config.api.appmsg}?begin=${begin}&count=${count}&type=${type}&token=${this.data.token}&action=${type === 15 ? 'list_video' : 'list_card'}`).then(body => {
            if (body.base_resp.ret === 0) {
                return body.app_msg_info.item;
            } else {
                throw body.base_resp.err_msg;
            }
        });
    }
    /**
     * 获取图片/语音素材列表
     * @param {number} type - 素材类型：图片素材-2 语音素材-3 默认-2
     * @param {number} begin - 从第几条开始 默认-0
     * @param {number} count - 返回条数 默认-10
     * @param {number} group_id - 图片素材专用，分组id 全部图片-0 未分组-1 文章配图-3 或者其它你自己新建的分组id
     * @return {Promise<array>} - 素材列表
     * @return {string} [].cdn_url - 资源地址
     * @return {number} [].file_id
     * @return {number} [].group_id - 分组id
     * @return {string} [].img_format - 图片类型：png...
     * @return {string} [].name - 资源名称，如：1488631877698.png
     * @return {number} [].seq
     * @return {string} [].size - 资源大小，如：749.4	K
     * @return {number} [].type
     * @return {number} [].update_time - 单位：秒
     * @return {string} [].video_cdn_id
     * @return {string} [].video_thumb_cdn_url
     */
    @login
    filepage(type = 2, begin = 0, count = 10, group_id = 0) {
        return WechatRequest.getJSON(`${Config.api.filepage}?begin=${begin}&count=${count}&type=${type}&token=${this.data.token}&group_id=${group_id}`).then(body => {
            if (body.base_resp.ret === 0) {
                return body.page_info.file_item;
            } else {
                throw body.base_resp.err_msg;
            }
        });
    }
    /**
     * 创建图文素材
     * @param {array} news - 消息列表
     * @param {string} news[].title - 文章标题
     * @param {string} news[].thumb - 文章缩略图
     * @param {string} news[].description - 描述信息
     * @param {string} news[].html - 文章内容
     * @param {string} news[].url - 原文地址
     * @param {number} [appMsgId] - 图文素材id，传此字段表示更新图文素材
     * @return {Promise<string>} appMsgId
     */
    @login
    operate_appmsg(news, appMsgId) {
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
                    this._operate_appmsg(newsObj, postNews.length, appMsgId).then(resolve).catch(reject);
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
         * 上传缩略图
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
    _operate_appmsg(wechatNews, count, appMsgId) {
        let params = {
            token: this.data.token,
            f: 'json',
            ajax: 1,
            random: Math.random()
        };
        if (appMsgId) {
            params.AppMsgId = appMsgId;
        }
        if (count) {
            params.count = count;
            Object.assign(params, wechatNews);
        } else {
            params.count = wechatNews.length;
            Object.assign(params, this._transformToMpParam(wechatNews));
        }
        return WechatRequest({
            url: `${Config.api.operate_appmsg}?t=ajax-response&sub=${appMsgId ? 'update' : 'create'}&type=10&token=${this.data.token}`,
            headers: {
                'Referer': `${Config.api.appmsg}?t=media/appmsg_edit&action=edit&type=10&isMul=1&isNew=1&token=${this.data.token}`
            },
            form: params
        }).then(body => {
            if (body.base_resp.ret === 0) {
                return body.appMsgId;
            } else {
                let msg = Log.msg(body.base_resp.ret);
                Log.error(msg);
                body.msg = msg;
                throw body;
            }
        });
    }
    /**
     * 数组变成微信参数
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
     * 批量上传远程图片至公众号
     * @param {array<string>} imgurls - 远程图片地址
     * @return {Promise<array>}
     */
    @login
    batchUpload(imgurls) {
        return Promise.all(imgurls.map(imgurl => this.filetransfer(imgurl)));
    }
    /**
     * 上传单个远程图片至公众号
     * @param {string} imgurl - 远程图片地址
     * @return {Promise<string>}
     */
    @login
    filetransfer(imgurl) {
        return new Promise((resolve, reject) => {
            let filename = path.join(Config.upload, Date.now() + '.png');
            let writeStream = fs.createWriteStream(filename);
            request(imgurl).pipe(writeStream).on('error', reject);
            writeStream.on('finish', () => this.localUpload(filename).then(resolve).catch(reject));
        });
    }
    /**
     * 上传本地图片至公众号
     * @param {string} filepath - 本地图片地址
     * @return {Promise<object>} res
     * @return {number} res.fileid - 资源id
     * @return {string} res.cdn_url - 资源链接地址
     */
    @login
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
     * 上传远程图片上传至cdn
     * @param {string} imgurl - 远程图片地址
     * @return {Promise<string>} - 微信cdn资源地址
     */
    @login
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
     * 群发消息
     * @param {number|string} appmsgid - 消息内容，图文消息-appmsgid 文字-文字内容 图片/语音/视频-fileid
     * @param {number} groupid - 分组id，默认-1 所有用户
     * @param {number} send_time - 定时群发，默认-0 不定时群发  定时群发设置定时时间戳（单位秒）
     * @param {number} type - 消息类型：图文消息-10 文字-1 图片-2 语音-3 视频-15 默认-10
     */
    @login
    masssend(appmsgid, groupid = -1, send_time = 0, type = 10) {
        let params = {
            groupid: groupid,
            send_time: send_time
        };
        if (type === 10) {
            params.appmsgid = appmsgid;
        } else if (type === 1) {
            params.content = appmsgid;
        } else {
            params.fileid = appmsgid;
        }
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
     * 获取图文素材文章临时预览链接
     * @param {number} appmsgid - 图文素材id
     * @param {number} itemidx - 文章在图文素材中的索引，从1开始 默认: 1
     * @return {Promise<string>} - 文章临时预览链接
     */
    @login
    preview_post(appmsgid, itemidx = 1) {
        return WechatRequest.getJSON(`${Config.api.appmsg}?action=get_temp_url&appmsgid=${appmsgid}&itemidx=${itemidx}&token=${this.data.token}`).then(body => {
            if (body.base_resp.ret === 0) {
                return body.temp_url;
            } else {
                throw body;
            }
        });
    }
    /**
     * 预览群发消息
     * @param {string} username - 预览人微信号/QQ号/手机号
     * @param {number|string} content - 预览内容，图文消息-appmsgid 文字-文字内容 图片/语音/视频-fileid
     * @param {number} type - 消息类型：图文消息-10 文字-1 图片-2 语音-3 视频-15 默认-10
     */
    @login
    preview_appmsg(username, content, type = 10) {
        let params = {
            token: this.data.token,
            f: 'json',
            ajax: 1,
            random: Math.random(),
            type: type,
            preusername: username,
            is_preview: 1
        };
        if (type === 10) {
            params.appmsgid = content;
        } else if (type === 1) {
            params.content = content;
        } else {
            params.fileid = content;
        }
        return WechatRequest({
            url: `${Config.api.operate_appmsg}?t=ajax-appmsg-preview&token=${this.data.token}&sub=preview&type=${type}`,
            form: params
        }).then(body => {
            if (body.base_resp.ret === 0) {
                return body;
            } else{
                let msg = Log.msg(body.base_resp.ret);
                body.base_resp.err_msg = msg;
                body.msg = msg;
                throw body;
            }
        });
    }
    /**
     * 获取群发ticket
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
            url: `${Config.api.masssend}?t=ajax-response&token=${this.data.token}${obj.send_time ? `&action=time_send` : ''}`,
            form: {
                token: this.data.token,
                f: 'json',
                ajax: 1,
                random: Math.random(),
                smart_product: 0,
                type: 10,
                appmsgid: obj.appmsgid,
                send_time: obj.send_time,
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
     * 发文本消息给某个用户
     * @param {string} tofakeid - 用户fakeid，可以在公众号后台singlesendpage页面url看到或者消息列表
     * @param {string} msg - 消息内容
     * @param {string} replyId - 回复消息id，可以消息列表看到，可选
     */
    @login
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
     * 获取公众号消息列表
     * @param {number} count - 消息条数
     * @param {number|string} day - 今天：0 昨天：1 前天：2 更早：3 最近5天：7 已收藏消息：star，默认：0
     * @return {array<object>} msgs
     * @return {string} msgs[].content - 消息内容
     * @return {string} msgs[].date_time - 消息时间
     * @return {string} msgs[].fakeid - 用户fakeid
     * @return {number} msgs[].func_flag
     * @return {number} msgs[].has_reply
     * @return {number} msgs[].id - replyId
     * @return {number} msgs[].is_vip_msg
     * @return {number} msgs[].msg_status
     * @return {array} msgs[].multi_item
     * @return {string} msgs[].nick_name
     * @return {string} msgs[].refuse_reason
     * @return {string} msgs[].source
     * @return {string} msgs[].to_uin
     * @return {number} msgs[].type
     * @return {string} msgs[].wx_headimg_url - 用户头像地址
     */
    @login
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
     * 二维码解析
     * @param {string} url - 远程图片地址/本地图片路径
     * @return {Promise<object>}
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
                    'User-Agent': Config.userAgent,
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