# 朋友比分账本 · 后端 API 文档（设计稿 · 待确认）

> 状态：本文件为 **Step 3+ 的设计契约**，目前**仅 `GET /health` 已落地**，其余接口尚未实现。
> 你看完这版设计确认后，我再按「云函数 → Java REST」逐接口写 Controller/Service/Repository。
> 设计原则（依原 project instructions）：简单、清晰、安全、易维护；权限判断集中在后端；前端只做 UI 展示与入口控制。

---

## 1. 基础约定

| 项 | 值 |
|---|---|
| 本地 Base URL | `http://127.0.0.1:8080` |
| 认证方式 | `Authorization: Bearer <token>`（登录接口本身不需要） |
| 请求体 | `application/json` |
| 字符集 | UTF-8（服务端 JDBC 已配 `characterEncoding=UTF-8`） |

### 1.1 统一响应结构（扁平）
成功：
```json
{ "ok": true, "code": "OK", "msg": null, "openid": "oABC...", "nickname": "小晗子" }
```
失败：
```json
{ "ok": false, "code": "AUTH_INVALID", "msg": "token 无效或已过期" }
```
> 说明：为兼容前端既有解析（读 `r.ok` 判成败、其余字段平铺取），响应体**不套 `data` 外层**，业务字段直接平铺。

### 1.2 错误码

| code | HTTP | 含义 |
|---|---|---|
| `OK` | 200 | 成功 |
| `PARAM_INVALID` | 400 | 参数校验失败（如昵称超长、头像非法）|
| `AUTH_MISSING` | 401 | 缺 token |
| `AUTH_INVALID` | 401 | token 无效/过期 |
| `FORBIDDEN` | 403 | 无权限（如普通用户调管理员接口）|
| `NOT_FOUND` | 404 | 资源不存在 |
| `SYS_ERROR` | 500 | 服务端异常 |

---

## 2. 接口清单

### 2.1 登录 / 认证
#### `POST /api/auth/login`
替代原云函数 `login` + `initUser`。

- 请求：
  ```json
  { "code": "081abc..." }
  ```
  `code` 来自小程序 `wx.login()` 的临时登录凭证。
- 服务端流程：
  1. 用 `code` + `appid` + `secret` 调微信 `code2Session` 换 `openid`（secret 走环境变量 `WECHAT_SECRET`，**不入库**）。
  2. 查 `users` 表：不存在则**自动创建**，并据管理员白名单判定 `role`（白名单在 `WechatProperties` 配置，非前端传入）。
  3. 生成 token（后续 Step 4 细化；当前先用无状态 token 承载 openid）。
- 响应：
  ```json
  {
    "ok": true, "code": "OK", "msg": null,
    "token": "eyJ...", "openid": "oABC...",
    "user": { "openid": "oABC...", "nickname": "小晗子", "avatar": "avatar_01", "role": "user" }
  }
  ```

### 2.2 用户（需登录）
#### `GET /api/user/info`
返回当前用户资料。响应平铺 `user` 对象字段。

#### `PUT /api/user/profile`
修改头像 / 昵称（对应原 `updateProfile`）。

- 请求：
  ```json
  { "avatar": "avatar_03", "nickname": "新名字" }
  ```
- **后端强制校验**（防前端绕过）：
  - `avatar` 必须 ∈ 前端预置头像列表（`avatar_01`~`avatar_04`），否则 `PARAM_INVALID`。
  - `nickname`：`trim` 后非空、长度 ≤ 32，否则 `PARAM_INVALID`。
  - **`role` 字段忽略**：即使请求体带了 `role: "admin"` 也不生效，角色只能由后端白名单判定。
- 响应：`{ "ok": true, "code": "OK", "msg": null, "user": { ... } }`

#### `GET /api/user/list`  **（仅 admin）**
返回用户列表，供管理员端使用。普通用户调用返回 `FORBIDDEN`。

### 2.3 空间 Spaces（需登录）
#### `POST /api/spaces`
创建空间（对应原 `createSpace`）。
- 请求：`{ "name": "周末台球局", "playerAName": "我", "playerBName": "小晗子" }`
- 响应：返回含 `inviteCode`（6 位唯一邀请码）的空间对象。

#### `POST /api/spaces/join`
加入空间（对应原 `joinSpace`）。
- 请求：`{ "inviteCode": "AB12CD" }`

#### `GET /api/spaces`
返回「我参与的空间」列表（按 `members` 含当前 openid 过滤）。

#### `GET /api/spaces/{spaceId}`
空间详情 + 成员列表。

#### `PUT /api/spaces/{spaceId}`
更新空间名称 / 对局方名（创建者或管理员）。

### 2.4 对局记录 Records（需登录）
均挂在某个 `spaceId` 下（对应原 `record` 云函数 list/add/update/delete）。
#### `GET /api/spaces/{spaceId}/records`
列表，支持 `?from=&to=` 按 epoch 毫秒时间范围筛选。
#### `POST /api/spaces/{spaceId}/records`
新增：
```json
{ "type": "台球", "time": 1695000000000, "loc": "某某球房",
  "duration": 90, "a": 3, "b": 2, "winner": "a" }
```
`winner` 取值 `a | b | draw`。
#### `PUT /api/spaces/{spaceId}/records/{recordId}`
更新单条。
#### `DELETE /api/spaces/{spaceId}/records/{recordId}`
删除单条。

### 2.5 用户设置（需登录）
对应原 `user_settings` 集合。
#### `GET /api/user/settings`
返回 `{ "defaultType": "台球", "defaultSpaceId": "12", "customTypes": ["台球","麻将"] }`。
#### `PUT /api/user/settings`
更新默认类型 / 默认空间 / 自定义类型列表。

### 2.6 健康检查（无需登录）
#### `GET /health`
```json
{ "ok": true, "code": "OK", "msg": null, "status": "up" }
```
> ✅ 已实现并验证通过。

---

## 3. 权限矩阵

| 接口 | 登录 | 管理员 |
|---|---|---|
| `GET /health` | 否 | 否 |
| `POST /api/auth/login` | 否 | 否 |
| `GET /api/user/info` | 是 | 否 |
| `PUT /api/user/profile` | 是 | 否 |
| `GET /api/user/list` | 是 | **是** |
| `POST /api/spaces` / `join` / `GET` | 是 | 否 |
| `GET /api/spaces/{id}` | 是 | 否 |
| `PUT /api/spaces/{id}` | 是 | 创建者或管理员 |
| `records` 增删改查 | 是 | 否（空间成员即可）|
| `user/settings` | 是 | 否 |

权限判断集中点在：`LoginInterceptor`（校验 token→openid）+ Service 层按 `role` 判定（如 `user/list`）。**前端 `role` 仅用于 UI 展示与入口控制，不作安全依据。**

---

## 4. 与原云函数对应关系

| 原云函数 | 新 REST 接口 |
|---|---|
| `login` + `initUser` | `POST /api/auth/login` |
| `user.get` / `getUserInfo` | `GET /api/user/info` |
| `user.updateProfile` | `PUT /api/user/profile` |
| `user.list` | `GET /api/user/list`（admin）|
| `createSpace` | `POST /api/spaces` |
| `joinSpace` | `POST /api/spaces/join` |
| `getSpaces` | `GET /api/spaces` |
| `updateSpace` | `PUT /api/spaces/{id}` |
| `record.list` | `GET /api/spaces/{id}/records` |
| `record.add` | `POST /api/spaces/{id}/records` |
| `record.update` | `PUT /api/spaces/{id}/records/{rid}` |
| `record.delete` | `DELETE /api/spaces/{id}/records/{rid}` |
| （原 `user_settings` 集合）| `GET/PUT /api/user/settings` |

---

## 5. 数据流（登录 → 业务）

```
小程序 wx.login()
      ↓ code
POST /api/auth/login
      ↓
后端 code2Session(appid+secret) → openid
      ↓
查/建 users（判管理员白名单 → role）
      ↓
签发 token（承载 openid）
      ↓
前端存 token，后续请求带 Authorization: Bearer <token>
      ↓
LoginInterceptor 校验 token → 取出 openid → 绑定到请求上下文
      ↓
Controller → Service（含 role 校验）→ Repository → MySQL
```

---

### 待你确认的点
1. 接口路径与字段命名是否贴合你前端 `services/user.js` / `utils/db.js` 的现有调用习惯？
2. token 方案：先用「无状态签名 token（含 openid + 过期时间）」够不够？还是要接 Redis 做吊销？（当前不引 Redis，保持简单）
3. 管理员白名单先留空、后期再配？

确认后我从 **Step 3：`POST /api/auth/login` + `GET/PUT /api/user/*`** 开始落地。
