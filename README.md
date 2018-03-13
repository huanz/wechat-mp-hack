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
API.login().then(data => {
    console.log(data);
}).catch(console.error.bind(console));
```

#### loginchk

检测是否已经登录

```javascript
try {
    let islogin = await API.loginchk();
    console.log('已登录');
} catch(e) {
    console.log('未登录');
}
```

#### appmsg

获取图文/视频素材列表

```javascript
/**
 * 获取图文/视频素材列表
 * @param {number} type - 消息类型：图文消息-10 视频消息-15 默认-10
 * @param {number} begin - 从第几条开始 默认-0
 * @param {number} count - 返回条数 默认-10
 * @return {Promise<array>} - 素材列表
 * @return {number} [].app_id - 素材id appMsgId
 * @return {string} [].author - 作者
 * @return {string} [].create_time - 创建时间，单位秒
 * @return {number} [].data_seq
 * @return {string} [].digest - 素材描述信息
 * @return {number} [].file_id
 * @return {string} [].img_url - 图片地址
 * @return {number} [].is_illegal
 * @return {number} [].is_sync_top_stories
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
API.appmsg().then((items) => {
    console.log(items);
}).catch(console.error.bind(console));
```

#### filepage

获取图片/语音素材列表

```javascript
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
API.filepage().then((files) => {
    console.log(files);
}).catch(console.error.bind(console)); 
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
 * @return {Promise<object>} res
 * @return {number} res.fileid - 资源id
 * @return {string} res.cdn_url - 资源链接地址
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
 * @return {Promise<string>} - 微信cdn资源地址
 */
```

#### preview_post

获取图文素材文章临时预览链接

```javascript
/**
 * 获取图文素材文章临时预览链接
 * @param {number} appmsgid - 图文素材id
 * @param {number} itemidx - 文章在图文素材中的索引，从1开始 默认: 1
 * @return {Promise<string>} - 文章临时预览链接
 */
API.preview_post(100000126, 2).then(post_url => {
    console.log(post_url);
}).catch(console.error.bind(console));
```

#### preview_appmsg

预览群发消息

```javascript
/**
 * 预览群发消息
 * @param {string} username - 预览人微信号/QQ号/手机号
 * @param {number|string} content - 预览内容，图文消息-appmsgid 文字-content 图片/语音/视频-fileid
 * @param {number} type - 消息类型：图文消息-10 文字-1 图片-2 语音-3 视频-15 默认-10
 */
API.preview_appmsg('Zaker-yhz', 100000126).then(res => {
    console.log('预览发送成功');
}).catch(console.error.bind(console));
```

#### masssend

群发消息

```javascript
/**
 * 群发消息
 * @param {string} appMsgId
 * @param {number} groupid - 分组id，默认-(-1) 所有用户
 * @param {number} send_time - 定时群发，默认-0 不定时群发  定时群发设置定时时间戳（单位秒）
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