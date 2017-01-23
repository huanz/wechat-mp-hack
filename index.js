const fs = require('fs');
const request = require('request');

const MP_HOST = 'mp.weixin.qq.com';
const MP_URL = `https://${MP_HOST}`;

const j = request.jar();
const mpRequest = request.defaults({
    headers: {
        'Referer': MP_URL,
        'Host': MP_HOST,
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/55.0.2883.95 Safari/537.36',
        'X-Requested-With': 'XMLHttpRequest'
    },
    json: true,
    jar: true
});

class Wechat {
    constructor(username, pwd) {
        this.username = username;
        this.pwd = pwd;
        this.login();
    }
    login() {
        let _this = this;
        mpRequest({
            method: 'POST',
            url: `${MP_URL}/cgi-bin/bizlogin?action=startlogin`,
            form: {
                username: this.username,
                pwd: this.pwd,
                imgcode: '',
                f: 'json'
            }
        }, function (e, r, body) {
            if (body.base_resp.ret === 0) {
                let redirectUrl = MP_URL + body.redirect_url;
                request.get(redirectUrl, function (e, r, body) {
                    mpRequest.get(`${MP_URL}/cgi-bin/loginqrcode?action=getqrcode&param=4300`).on('response', function () {
                        console.log('请扫描二维码确认登录！');
                        _this._checkLogin(function () {
                            mpRequest({
                                method: 'POST',
                                url: `${MP_URL}/cgi-bin/bizlogin?action=login&token=&lang=zh_CN`,
                                headers: {
                                    'Referer': redirectUrl
                                },
                                form: {
                                    token: '',
                                    lang: 'zh_CN',
                                    f: 'json',
                                    ajax: 1,
                                    random: Math.random()
                                }
                            }, function (e, r, body) {
                                let token = null;
                                if (body.base_resp.ret === 0 && (token = body.redirect_url.match(/token=(\d+)/))) {
                                    _this.token = token[1];
                                    console.log('登录成功，token=' + _this.token);
                                    _this.getTicket();
                                } else {
                                    console.log(body);
                                }
                            });
                        });
                    }).pipe(fs.createWriteStream('qrcode.jpg'));
                });
            }
        });
    }
    _checkLogin(callback) {
        let _this = this;
        mpRequest.get(`${MP_URL}/cgi-bin/loginqrcode?action=ask&token=&lang=zh_CN&token=&lang=zh_CN&f=json&ajax=1&random=${Math.random()}`, function (e, r, body) {
            if (body.status === 1) {
                callback(body);
            } else {
                setTimeout(() => {
                    _this._checkLogin(callback);
                }, 3000);
            }
        });
    }
    /**
     * @desc 获取微信ticket
     */
    getTicket() {
        let _this = this;
        mpRequest.get(`${MP_URL}/cgi-bin/home?t=home/index&lang=zh_CN&token=${this.token}`, function (e, r, body) {
            let ticketMatch = body.match(/ticket:"(\w+)"/);
            let ticketIdMatch = body.match(/user_name:"(\w+)"/);
            if (ticketMatch && ticketIdMatch) {
                _this.ticket = {
                    ticket: ticketMatch[1],
                    ticket_id: ticketIdMatch[1]
                };
                console.log('ticket:' + ticketMatch[1]);
            }
        });
    }
    operate_appmsg() {
        mpRequest({
            method: 'POST',
            url: `${MP_URL}/cgi-bin/operate_appmsg?t=ajax-response&sub=create&type=10&token=${this.token}&lang=zh_CN`,
            headers: {
                'Referer': `${MP_URL}/cgi-bin/appmsg?t=media/appmsg_edit&action=edit&type=10&isMul=1&isNew=1&lang=zh_CN&token=${this.token}`
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
        }, function () {

        });
    }
    /**
     * @desc 上传图片
     */
    filetransfer() {
        mpRequest({
            method: 'POST',
            url: `${MP_URL}//cgi-bin/filetransfer?action=upload_material&f=json&scene=1&writetype=doublewrite&groupid=1&ticket_id=${this.ticket.ticket_id}&ticket=${this.ticket.ticket}&svr_time=${Math.floor(Date.now()/1000)}&lang=zh_CN&seq=1&token=${this.token}&lang=zh_CN`,
            headers: {
                'Referer': `${MP_URL}/cgi-bin/filepage?type=2&begin=0&count=12&t=media/img_list&lang=zh_CNtoken=${this.token}`
            },
            multipart: {
                body: fs.createReadStream('qrcode.jpg')
            }
        }, function () {

        });
    }
}