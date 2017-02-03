import * as fs from 'fs';
import WechatRequest from './util/request';
import Config from './util/config';
import * as Log from './util/log';

export default class Wechat {
    constructor(username, pwd) {
        this.username = username;
        this.pwd = pwd;
        this.startlogin();
    }
    startlogin() {
        let _this = this;
        WechatRequest({
            url: `${Config.api.bizlogin}?action=startlogin`,
            form: {
                username: this.username,
                pwd: this.pwd,
                imgcode: '',
                f: 'json'
            }
        }).then(body => {
            if (body.base_resp.ret === 0) {
                let redirectUrl = Config.baseurl + body.redirect_url;
                WechatRequest.getJSON(redirectUrl).then(() => {
                    WechatRequest.get(`${Config.api.loginqrcode}?action=getqrcode&param=4300`).on('response', () => {
                        Log.info('请扫描二维码确认登录！');
                        this._checkLogin().then(() => {
                            Log.info('完成扫描，开始登录');
                            this.login(redirectUrl);
                        });
                    }).pipe(fs.createWriteStream('qrcode.jpg')).on('error', Log.error);
                });
            } else {
                Log.error(body);
            }
        });
    }
    _checkLogin() {
        const dologin = (resolve) => {
            WechatRequest.getJSON(`${Config.api.loginqrcode}?action=ask&token=&lang=zh_CN&token=&lang=zh_CN&f=json&ajax=1&random=${Math.random()}`).then(body => {
                if (body.status === 1) {
                    resolve(body);
                } else {
                    setTimeout(() => {
                        dologin(resolve);
                    }, 3000);
                }
            });
        };
        return new Promise((resolve, reject) => {
            dologin(resolve);
        });
    }
    login(referer) {
        WechatRequest({
            url: `${Config.api.bizlogin}?action=login&token=&lang=zh_CN`,
            headers: {
                'Referer': referer
            },
            form: {
                token: '',
                lang: 'zh_CN',
                f: 'json',
                ajax: 1,
                random: Math.random()
            }
        }).then(res => {
            let token = null;
            if (res.base_resp.ret === 0 && (token = res.redirect_url.match(/token=(\d+)/))) {
                this.token = token[1];
                Log.info('登录成功，token=' + this.token);
                let cookies = WechatRequest.cookies();
                this.ticket = {
                    ticket: cookies.ticket,
                    ticket_id: cookies.ticket_id
                };
            } else if (res.base_resp.ret === -1) {
                this.login(referer);
            } else {
                Log.error(res);
            }
        });
    }
    /**
     * @desc 创建图文素材
     */
    operate_appmsg() {
        WechatRequest({
            url: `${Config.api.operate_appmsg}?t=ajax-response&sub=create&type=10&token=${this.token}&lang=zh_CN`,
            headers: {
                'Referer': `${Config.api.appmsg}?t=media/appmsg_edit&action=edit&type=10&isMul=1&isNew=1&lang=zh_CN&token=${this.token}`
            },
            form: {
                token: this.token,
                lang: 'zh_CN',
                f: 'json',
                ajax: 1,
                random: Math.random(),
                count: 1, // 文章数量
                title0: 'title',
                content0: '内容',
                digest0: '描述',
                fileid0: 100000004,
                cdn_url0: '图片地址',
                music_id0: '',
                video_id0: '',
                show_cover_pic0: 0,
                shortvideofileid0: '',
                vid_type0: '',
                copyright_type0: 0,
                need_open_comment0: 1,
                only_fans_can_comment0: 0,
                sourceurl0: '原文地址',
                fee0: 0,
                voteid0: '',
                voteismlt0: '',
                ad_id0: ''
            }
        }).then(body => {

        });
    }
    /**
     * @desc 上传图片
     */
    filetransfer() {
        WechatRequest({
            url: `${Config.api.filetransfer}?action=upload_material&f=json&scene=1&writetype=doublewrite&groupid=1&ticket_id=${this.ticket.ticket_id}&ticket=${this.ticket.ticket}&svr_time=${Math.floor(Date.now()/1000)}&lang=zh_CN&seq=1&token=${this.token}&lang=zh_CN`,
            headers: {
                'Referer': `${Config.api.filepage}?type=2&begin=0&count=12&t=media/img_list&lang=zh_CNtoken=${this.token}`
            },
            multipart: {
                body: fs.createReadStream('qrcode.jpg')
            }
        }).then(body => {

        });
    }
}