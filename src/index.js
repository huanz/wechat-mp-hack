import * as fs from 'fs';
import WechatRequest from './util/request';
import Config from './util/config';
import * as Log from './util/log';

/**
* { errcode: 405,
  code: '',
  appname: '',
  redirect_uri: '',
  key: '',
  pass_ticket: 'PukefQN',
  card_name: '',
  check_status: 0,
  confirm_resp:
   { redirect_uri: '',
     component_status: 0,
     component_pre_auth_code: '',
     component_appid: '',
     bizuin: '',
     open_component_uin: 0,
     open_mp_appid: '',
     open_mp_uin: 0,
     open_biz_mp_mchid: 0,
     biz_mp_uin: 0,
     biz_mp_appid: '',
     biz_mp_mchid: 0 } }
*/

export default class Wechat {
    constructor(username, pwd) {
        this.username = username;
        this.pwd = pwd;
        this.startlogin();
    }
    startlogin() {
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
                        }).catch(Log.error);
                    }).pipe(fs.createWriteStream('qrcode-login.jpg')).on('error', Log.error);
                });
            } else {
                Log.error(body);
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
        return new Promise(dologin);
    }
    login(referer) {
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

                /**
                 * @desc test
                 */
                this.masssend(100000007);
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
            url: `${Config.api.operate_appmsg}?t=ajax-response&sub=create&type=10&token=${this.token}`,
            headers: {
                'Referer': `${Config.api.appmsg}?t=media/appmsg_edit&action=edit&type=10&isMul=1&isNew=1&token=${this.token}`
            },
            form: {
                token: this.token,
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
            url: `${Config.api.filetransfer}?action=upload_material&f=json&scene=1&writetype=doublewrite&groupid=1&ticket_id=${this.ticket.ticket_id}&ticket=${this.ticket.ticket}&svr_time=${Math.floor(Date.now()/1000)}&seq=1&token=${this.token}`,
            headers: {
                'Referer': `${Config.api.filepage}?type=2&begin=0&count=12&t=media/img_listtoken=${this.token}`
            },
            multipart: {
                body: fs.createReadStream('qrcode.jpg')
            }
        }).then(body => {

        });
    }
    /**
     * @desc 群发
     */
    masssend(msgid) {
        Log.info('开始群发');
        WechatRequest({
            url: `${Config.api.masssend}?action=check_ad&token=${this.token}`,
            form: {
                token: this.token,
                f: 'json',
                ajax: 1,
                random: Math.random(),
                appmsg_id: msgid
            }
        }).then(body => {
            if (body.base_resp.ret === 0) {
                Log.info(body);
                this.getuuid();
            } else {
                Log.error(body);
            }
        });
    }
    getuuid() {
        Log.info('获取群发ticket');
        WechatRequest({
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
                Log.info(body);
                WechatRequest({
                    url: `${Config.api.safeqrconnect}?1=1&token=${this.token}`,
                    form: {
                        token: this.token,
                        f: 'json',
                        ajax: 1,
                        random: Math.random(),
                        state: 0,
                        login_type: 'safe_center',
                        type: 'json',
                        ticket: body.ticket
                    }
                }).then(res => {
                    Log.info(res);
                    WechatRequest.get(`${Config.api.safeqrcode}?action=check&type=msgs&ticket=${body.ticket}&uuid=${res.uuid}&msgid=${body.operation_seq}`).on('response', () => {
                        Log.info('请扫描群发认证二维码！');
                        this._checkuuid(res.uuid).then(result => {
                            Log.info('成功扫描群发认证二维码！');
                            this.safesend(res.uuid, result);
                        });
                    }).pipe(fs.createWriteStream('qrcode-safe.jpg')).on('error', Log.error);
                });
            } else {
                Log.error(body);
            }
        });
    }
    _checkuuid(uuid) {
        let douuid = (resolve, reject) => {
            WechatRequest({
                url: `${Config.api.safeuuid}?timespam=${Date.now()}&token=${this.token}`,
                form: {
                    token: this.token,
                    f: 'json',
                    ajax: 1,
                    random: Math.random(),
                    uuid: uuid,
                    action: 'json',
                    type: 'json'
                }
            }).then(body => {
                if (body.errcode == 405) {
                    resolve(body);
                } else {
                    setTimeout(() => {
                        douuid(resolve, reject);
                    }, 3000);
                }
            }).catch(reject);
        };
        return new Promise(douuid);
    }
    safesend(uuid, obj) {
        WechatRequest({
            url: `${Config.api.safeassistant}?1=1&token=${this.token}`,
            form: {
                token: this.token,
                f: 'json',
                ajax: 1,
                random: Math.random(),
                action: 'get_uuid',
                uuid: uuid
            }
        }).then(res => {
            Log.info(res);
            if (res.base_resp.ret === 0) {

            } else {
                Log.error(res);
            }
            // WechatRequest({
            //     url: `${Config.api.masssend}?t=ajax-response&token=${this.token}&req_need_vidsn=1&add_tx_video=1`,
            //     form: {
            //         token: this.token,
            //         f: 'json',
            //         ajax: 1,
            //         random: Math.random(),
            //         type: 10,
            //         appmsgid: 100000007,
            //         cardlimit: 1,
            //         sex: 0,
            //         groupid: -1,
            //         synctxweibo: 0,
            //         country: '',
            //         province: '',
            //         city: '',
            //         imgcode: '',
            //         operation_seq: 424698275,
            //         req_id: '3ExDAtpwy5GxBqGIbqsFLf6teEA1BxT1',
            //         req_time: Date.now(),
            //         reprint_confirm: 1,
            //         code: '50f9b0e5de46998ea5d7c777f1b519a5',
            //         list: {"list":[{"article_title":"你应该知道的 setTimeout 秘密","source_bizuin":3018162350,"source_msgid":2651551668,"source_idx":1,"source_title":"你应该知道的 setTimeout 秘密","source_url":"http:\/\/mp.weixin.qq.com\/s?__biz=MzAxODE2MjM1MA==&mid=2651551668&idx=1&sn=d2dbdbe0bf8d3ef0171b6d7792a7919d&chksm=8025a075b7522963f48e06a6b6d5c4a2a15ab3e859d959ecd7005b21a26f24e7f9600d30e3cb#rd","idx":1,"source_auth_type":1,"source_auth_stat":0,"source_type":1,"article_url":"http:\/\/mp.weixin.qq.com\/s?__biz=MzIyMTcwODcyMg==&mid=100000007&idx=1&sn=f8b12ea9e231217ca7d51e479c4bdc1e&chksm=6839e9da5f4e60cc13b9a79fd604cd64bdb198b85c4611bfcf1a57f7c392e4d875e503ffed36#rd","white_list_status":110}]}
            //     }
            // }).then(result => {
            //     if (result.base_resp.ret === 0) {

            //     } else {
            //         Log.error(result);
            //     }
            // });
        });
    }
}