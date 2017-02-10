# wechat-mp-hack

无需微信认证即可实现微信公众号自动群发图文消息。

## 使用

```
npm i wechat-mp-hack --save
```

```
const Wechat = require('wechat-mp-hack');
const API = new Wechat('公众号账号', '公众号密码');

/**
 * @desc 登录认证二维码
 */
API.once('scan.login', (filepath) => {
    // 登录二维码图片地址
    console.log(filepath);
});

/**
 * @desc 开启群发认证保护后需要微信扫描二维码
 */
API.on('scan.send', (filepath) => {
    // 群发认证二维码地址
    console.log(filepath);
});

/**
 * @desc 登录公众号
 */
API.login().then((data) => {
    /**
     * @desc 批量上传远程图片至公众号
     * @param imgurls{array}    远程图片地址
     */
    API.batchUpload(['http://wesbos.com/wp-content/uploads/2016/09/dead-zone.png']).then((results) => {
        // results[0].fileid;
        // results[0].cdn_url;
    });

    /**
     * @desc 上传单个远程图片至公众号
     * @param imgurl{string}    远程图片地址
     */
    API.filetransfer('http://wesbos.com/wp-content/uploads/2016/09/dead-zone.png').then((result) => {
        console.log(result);
    });

    /**
     * @desc 上传本地图片至公众号
     * @param filepath{string}  本地图片地址
     */
    API.localUpload('qrcode-safe.png').then((result) => {
        console.log(result);
    });

    /**
     * @desc 创建图文素材
     * @param news{array}                   消息列表
     * @param news[].title{string}          文章标题
     * @param news[].thumb{string}          文章缩略图
     * @param news[].description{string}    描述信息
     * @param news[].html{string}           文章内容
     * @param news[].url{string}            原文地址
     */
    API.operate_appmsg(news).then((appMsgId) => {
        console.log(appMsgId);
    }).catch(e => {
        console.error(e);
    });

    /**
     * @desc 群发消息
     * @param appMsgId{string}
     */
    API.masssend(appMsgId).then(() => {
        console.log('success');
    }).catch(e => {
        console.error(e);
    });
});

/**
 * @desc 二维码解析
 * @param url{string}   远程图片地址/本地图片路径
 */
API.qrdecode('qrcode-login.png').then((result) => {
    console.log(result.text);
});
```