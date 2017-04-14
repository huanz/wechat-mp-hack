# wechat-mp-hack

无需微信认证即可实现微信公众号自动群发图文消息。

## 使用

```shell
npm i wechat-mp-hack --save
```

```javascript
const Wechat = require('wechat-mp-hack');
const API = new Wechat('公众号账号', '公众号密码');
```

> `1.1.0`版本后不再需要把调用方法包裹在 `login`回调后执行，调用下列核心方式时会自动处理登录。

### events

#### scan.login

登录认证二维码

```javascript
API.once('scan.login', (filepath) => {
    // 登录二维码图片地址
    console.log(filepath);
});
```

#### scan.send

开启群发认证保护后调用群发接口需要微信扫描二维码

```javascript
API.on('scan.send', (filepath) => {
    // 群发认证二维码地址
    console.log(filepath);
});
```

#### vcode 

登录验证码

```javascript
API.once('vcode', (filepath) => {
    // 验证码图片地址
    console.log(filepath);
});
```

### methods

#### login

登录接口

```javascript
/**
 * @desc 登录公众号
 * @param {string} imgcode - [可选]验证码
 * @return {Promise<object>} data
 */
API.login()
```

#### operate_appmsg

创建图文素材

```javascript
/**
 * 创建图文素材
 * @param {array} news - 消息列表
 * @param {string} news[].title - 文章标题
 * @param {string} news[].thumb - 文章缩略图
 * @param {string} news[].description - 描述信息
 * @param {string} news[].html - 文章内容
 * @param {string} news[].url - 原文地址
 * @return {Promise} appMsgId
 */
API.operate_appmsg(news).then((appMsgId) => {
    console.log(appMsgId);
}).catch(console.error.bind(console));
```

#### batchUpload

批量上传远程图片至公众号

```javascript
/**
 * 批量上传远程图片至公众号
 * @param {array<string>} imgurls - 远程图片地址
 */
API.batchUpload(['http://wesbos.com/wp-content/uploads/2016/09/dead-zone.png']).then((results) => {
    // results[0].fileid;
    // results[0].cdn_url;
});
```

#### filetransfer

上传单个远程图片至公众号

```javascript
/**
 * 上传单个远程图片至公众号
 * @param {string} imgurl - 远程图片地址
 */
API.filetransfer('http://wesbos.com/wp-content/uploads/2016/09/dead-zone.png').then((result) => {
	console.log(result);
});
```

#### localUpload

上传本地图片至公众号

```javascript
/**
 * 上传本地图片至公众号
 * @param {string} filepath - 本地图片地址
 */
API.localUpload('qrcode-safe.png').then((result) => {
	console.log(result);
});
```

####  uploadimg2cdn

上传远程图片上传至cdn

```javascript
/**
 * 上传远程图片上传至cdn
 * @param {string} imgurl - 远程图片地址
 * @return {Promise<string>}
 */
```

#### masssend

群发消息

```javascript
/**
 * 群发消息
 * @param {string} appMsgId
 * @param {number} groupid - 分组id，默认-1 所有用户
 */
API.masssend(appMsgId).then(() => {
    console.log('success');
}).catch(console.error.bind(console));
```

#### singlesend

发文本消息给某个用户

```javascript
/**
 * 发文本消息给某个用户
 * @param {string} tofakeid - 用户fakeid，可以在公众号后台singlesendpage页面url看到或者消息列表
 * @param {string} msg - 消息内容
 * @param {string} replyId - 回复消息id，可以消息列表看到，可选
 */
API.singlesend('osl8HwPBTCsVbquNsnYbUfOQH8sM', '哈哈哈哈', 425131038).then(res => {
    console.log(res);
}).catch(console.error.bind(console));
```

#### message

获取公众号消息列表

```javascript
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
API.message(1).then(msgs => {
    console.log(msgs);
}).catch(console.error.bind(console)); 
```

#### qrdecode

二维码解析

```javascript
/**
 * 二维码解析
 * @param {string} url - 远程图片地址/本地图片路径
 * @return {Promise<object>}
 */
API.qrdecode('qrcode-login.png').then((result) => {
    console.log(result.text);
}).catch(console.error.bind(console)); 
```