# 真机名字反转：根因 + 修复（定案）

> 现象：模拟器「人物-当前空间」正常，真机「我/朋友」整体反转；真机登录昵称正确、`/health` 通。
> 本文替代此前「WECHAT_SECRET 兜底」的旧结论（该结论已排除）。

## 结论（已定案）

根因在**前端**：`miniprogram/utils/db.js` 的 `decodeTokenOpenid()` 用 `atob()` 解 JWT payload，
而**微信小程序真机不支持 `atob`**（它是浏览器全局函数；微信开发者工具模拟器是类浏览器环境，所以有）。于是真机解出空值：

```
真机登录 → myToken 正常写入
→ decodeTokenOpenid() 调 atob() → 真机 atob undefined → 抛错 → catch 返回 ''
→ wx.setStorageSync('myOpenid','')  →  globalData.openid = ''
→ pairOf: isCreatorOf(space,'') = false  →  「我/朋友」整体反转
```

服务端 token 本身有效（所以登录 toast 昵称正确、`/health` 通），问题纯粹出在前端取不到 openid。

**判据**（Storage 对比证据）：
- 模拟器 `myOpenid = oPNMExmLegq0xuVZRFBHJvbkjTqk`（真实 openid）✅
- 真机 `myOpenid` 为空 / 异常 ❌

> 为什么排除「服务器 `WECHAT_SECRET` 仍是 `changeme`」：模拟器能拿到**真实 openid**，说明服务端密钥是好的
> （否则模拟器也会拿到兜底的 `dev_openid_001`）。真机昵称正确也说明 token 有效。

## 修复（已完成）

改 `miniprogram/utils/db.js`：
1. 新增手写 `base64UrlDecode()`，`decodeTokenOpenid()` 不再用 `atob`（零平台 API 依赖，6bit 分组还原）。
2. 删除 `pairOf` 里临时的 `[pairOf-rev]` 诊断日志。

**仅前端改动，不需要重启/重部署后端。** 开发者工具里对真机重新编译调试、重新登录即生效。
（已用 Node 实测：该解码器还原 `oPNMExmLegq0xuVZRFBHJvbkjTqk` 正确。）

## 验证

1. 真机重新登录后，Storage 里 `myOpenid` 应等于你的真实 openid（模拟器 / 真机一致）。
2. 首页 / 统计 / 设置「人物-当前空间」的「我/朋友」不再反转。

## 平台坑（避免再犯）

微信小程序**真机没有 `atob` / `btoa`**，但 DevTools 模拟器有 → 任何依赖它们的代码都会「模拟器正常、真机异常」。替代方案：
- 手写 base64 解码（本项目已采用）；
- 或用 `wx.base64ToArrayBuffer`。

## 可选加固（需重部署）

让 `/api/auth/login` 的返回体增加 `openid` 字段（`AuthController` 现在只返回 `token`），前端直接用服务端给的 openid，
彻底不依赖客户端解码。若要做：改后端 → 重建 jar（`mvn -DskipTests package`）→ 部署到宝塔。

## 附：宝塔部署环境变量清单（与本次 bug 无关，部署时别漏）

| 变量 | 说明 |
|---|---|
| `WECHAT_SECRET` | 微信小程序 AppSecret（真实值）|
| `DB_USERNAME` / `DB_PASSWORD` | 服务器 MySQL 专用用户 `scorebook` / `ayang1874`（**不是 root**）|
| `APP_TOKEN_SECRET` | token 签名密钥，生产改成随机长串 |
| `APP_ADMIN_OPENIDS` | 管理员 openid 白名单（逗号分隔）|
