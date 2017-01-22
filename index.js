const fs = require('fs');
const request = require('request');

const MP_HOST = 'https://mp.weixin.qq.com';
const Config = {
    urls: {
        login: `${MP_HOST}/cgi-bin/bizlogin?action=startlogin`,
    },
    agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/55.0.2883.95 Safari/537.36'
}

class Wechat {
    constructor(username, pwd) {
        this.username = username;
        this.pwd = pwd;
        this.login();
    }
    login() {
        let _this = this;
        request({
            method: 'POST',
            url: Config.urls.login,
            headers: {
                'Referer': MP_HOST,
                'User-Agent': Config.agent,
                'X-Requested-With': 'XMLHttpRequest'
            },
            form: {
                username: this.username,
                pwd: this.pwd,
                imgcode: '',
                f: 'json'
            },
            json: true,
            jar: true
        }, function (e, r, body) {
            if (body.base_resp.ret === 0) {
                request.get(MP_HOST + body.redirect_url, {
                    jar: true,
                }, function (e, r, body) {
                    request.get('https://mp.weixin.qq.com/cgi-bin/loginqrcode?action=getqrcode&param=4300', {
                        jar: true,
                    }).on('response', function () {
                        _this._checkLogin(function () {
                            request({
                                method: 'POST',
                                url: 'https://mp.weixin.qq.com/cgi-bin/bizlogin?action=login&token=&lang=zh_CN',
                                headers: {
                                    'Referer': MP_HOST,
                                    'User-Agent': Config.agent,
                                    'X-Requested-With': 'XMLHttpRequest'
                                },
                                form: {
                                    token: '',
                                    lang: 'zh_CN',
                                    f: 'json',
                                    ajax: 1,
                                    random: Math.random()
                                },
                                json: true,
                                jar: true,
                                followRedirect: true,
                                followAllRedirects: true
                            }, function (e, r, body) {
                                console.log(body);
                            });
                        });
                    }).pipe(fs.createWriteStream('qrcode.jpg'));
                });
            }
        });
    }
    _checkLogin(callback) {
        let _this = this;
        request.get('https://mp.weixin.qq.com/cgi-bin/loginqrcode?action=ask&token=&lang=zh_CN&token=&lang=zh_CN&f=json&ajax=1&random=' + Math.random(), {
            jar: true,
            json: true
        }, function (e, r, body) {
            if (body.status === 1) {
                callback();
            } else {
                setTimeout(() => {
                    _this._checkLogin(callback);
                }, 3000);
            }

        });
    }
}