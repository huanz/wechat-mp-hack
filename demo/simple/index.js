const Wechat = require('wechat-mp-hack');

(async () => {
    const API = new Wechat('公众号账号', '公众号密码');

    API.once('scan.login', (filepath) => {
        // 登录二维码图片地址
        console.log(filepath);
        console.log('请用手机微信扫描二维码确认登录');
    });
    API.once('scan.send', (filepath) => {
        // 群发二维码图片地址
        console.log(filepath);
        console.log('请用手机微信扫描二维码确认群发');
    });

    // 上传素材
    const appMsgId = await API.operate_appmsg([{
        title: '这是一个测试图文素材',
        thumb: 'https://www.baidu.com/img/superlogo_c4d7df0a003d3db9b65e9ef0fe6da1ec.png',
        description: '这里是图文素材的描述',
        html: '<p>这是文章的html内容</p>',
        url: 'https://www.noonme.com' // 文章原文链接地址
    }, {
        title: '这是第二篇文章',
        thumb: 'https://www.baidu.com/img/superlogo_c4d7df0a003d3db9b65e9ef0fe6da1ec.png',
        description: '这里是文章的描述',
        html: '<p>这是文章的html内容</p><p><img src="https://www.baidu.com/img/superlogo_c4d7df0a003d3db9b65e9ef0fe6da1ec.png"/></p>'
    }]);

    // 预览一下这个群发图文素材
    const p = await API.preview_appmsg('Zaker-yhz', appMsgId, 10);

    // 群发
    // const send = await API.masssend(appMsgId);
})();