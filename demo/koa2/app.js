const Koa = require('koa');
const Wechat = require('co-wechat');
const WechatHack = require('wechat-mp-hack');

const Config = {
    token: 'THE TOKEN',
    appid: 'THE APPID',
    encodingAESKey: 'THE ENCODING AES KEY'
};
const API = new WechatHack('公众号账号', '公众号密码');
const handle = async (content, message, needSend = false) => {
    let res = '';
    switch(content) {
        case '上传':
            // 上传素材
            let appMsgId = await API.operate_appmsg([{
                title: '这是一个测试图文素材',
                thumb: 'https://www.baidu.com/img/superlogo_c4d7df0a003d3db9b65e9ef0fe6da1ec.png',
                description: '这里是图文素材的描述',
                html: '<p>这是文章的html内容</p>',
                url: 'https://www.noonme.com' // 文章链接地址
            }]);
            let temp_url = await API.preview_post(appMsgId);
            res = `素材创建成功，第一篇文章查看地址：${temp_url}`; 
            break;
        case '列表':
            // 素材列表
            let lists = await API.appmsg(10, 0, 5);
            res = lists.map(item => {
                return {
                    title: item.title,
                    description: item.digest,
                    picurl: item.img_url,
                    url: ''
                };
            });
            break;
        case '群发':
            // 群发最新的图文素材
            let lists = await API.appmsg(10, 0, 1);
            let send = await API.masssend(lists[0].app_id);
            res = '群发成功';
            break;
    }
    if (needSend) {
        await API.singlesend(message.FromUserName, res);
    }
    return res;
};

const app = new Koa();

app.use(Wechat(Config).middleware(async (message, ctx) => {
    // 消息内容
    const content = (message.Content || '').trim();
    // 获取素材列表
    if (['上传', '列表', '群发'].includes(content)) {
        try {
            const islogin = await API.loginchk();
            const res = await handle(content, message);
            return res;
        } catch (error) {
            // 发送登录认证地址
            const qrfilepath = await API.startlogin();
            const result = await API.qrdecode(qrfilepath);

            // 开始检测登录状态
            API.loginstep().then(() => {
                // 登录成功
                handle(content, message, true);
            });
            return result.text;
        }
    }
}));

app.listen(3000, () => {
    console.log('服务启动成功');
});