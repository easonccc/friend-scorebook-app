# 联调指南（前端 miniprogram 接入 Java 后端）

> 适用场景：在「微信开发者工具」里把 `miniprogram` 跑起来，连本机 `backend`（Spring Boot + MySQL）。
> 后端已完成从云开发到普通 Java 后端的迁移（Step1~Step6），前端数据层已切到 REST 接口、页面零改动。

## 1. 起后端（Spring Boot + MySQL）

前置：Java 26、Maven 3.9+、本地 MySQL（库名 `scorebook`，root 密码 `ayang1874`）。

```bash
cd backend
# 首次或 schema 变更后重新打包（离线）
rm -rf target && mvn -o -DskipTests package

# 启动（dev 兜底模式：未配 WECHAT_SECRET 也能登录联调）
DB_PASSWORD=ayang1874 \
APP_ADMIN_OPENIDS=user_admin_001 \
APP_TOKEN_SECRET=<任意一长串随机串> \
java -jar target/friend-scorebook-backend-0.0.1-SNAPSHOT.jar --server.port=8080
```

- 启动后访问 `http://localhost:8080/swagger-ui.html`（302 重定向正常即代表服务起来了）。
- `sql.init.mode=always` 会在每次启动执行 `schema.sql`，建表/加字段自动完成，无需手建库表。

## 2. 微信登录的开发兜底（重要）

后端 `WechatService.code2Session` 有两种模式：

| 模式 | 触发条件 | 行为 |
|---|---|---|
| **开发兜底** | `wechat.secret` 是占位符（`changeme`/空） | 不真正调微信，直接返回固定身份 `dev_openid_001`，可本地联调 |
| **真实登录** | 启动带了 `WECHAT_SECRET=<真实小程序密钥>` | 走微信 `code2session`，拿到真实 openid |

也就是说：**不配真实 AppSecret 也能在开发者工具里把整条链路跑通**（登录→token→空间/比赛/设置）。
想用真实微信号登录，见第 4 节「生产/真机」。

## 3. 开发者工具配置（miniprogram）

1. 用微信开发者工具打开本仓库的 `miniprogram` 目录。
2. **勾选「不校验合法域名…」**（详情 → 本地设置），否则 `http://localhost:8080` 会被拦截。
3. 确认 `miniprogram/utils/config.js` 里 `API_BASE: 'http://localhost:8080'`。
   - 真机预览/上线要改成 **https 域名**，并在小程序后台「开发设置 → 服务器域名 → request 合法域名」加入该域名。
4. 点「编译」，首次会触发 `wx.login()` → `/api/auth/login` → 拿到 token → 进入首页。

> 前端 `utils/db.js` 已自动在请求头带 `Authorization: Bearer <token>`；`openid` 由 token 解出，页面无需改动。

## 4. 生产 / 真机要真正走微信登录

开发兜底只是本地联调用，真机必须配真实密钥：

1. **appid 对齐**：确认后端 `wechat.appid`（默认 `wx6bdd20d03a50b7bf`）与开发者工具里打开项目的 appid 一致，不一致就改 appid 或换项目。
2. **注入真实 AppSecret**：微信公众平台 → 开发 → 开发管理 → 开发设置 → AppSecret（点「重置」获取）：
   ```bash
   DB_PASSWORD=ayang1874 \
   APP_TOKEN_SECRET=<密钥> \
   WECHAT_SECRET=<真实小程序密钥> \
   java -jar target/friend-scorebook-backend-0.0.1-SNAPSHOT.jar --server.port=8080
   ```
3. 本地想测管理员视角：把 `APP_ADMIN_OPENIDS` 设成 `dev_openid_001`（兜底身份）即可。

> 安全：AppSecret 只走环境变量，不要写进仓库或提交 git。

## 5. 快速自测（curl）

```bash
B=http://localhost:8080
TOK=$(curl -s -H "content-type: application/json" -d '{"code":"x"}' $B/api/auth/login | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")
H="Authorization: Bearer $TOK"
curl -s -H "$H" $B/api/user/info | python3 -m json.tool            # 用户信息
curl -s -H "$H" $B/api/space/list | python3 -m json.tool          # 我的空间
curl -s -H "$H" -X PUT -H "content-type: application/json" -d '{"defaultType":"台球"}' $B/api/settings | python3 -m json.tool
```

## 6. 接口速查

| 前端调用 | 方法 | 路径 |
|---|---|---|
| 登录 | POST | `/api/auth/login` |
| 用户信息 | GET | `/api/user/info` |
| 改资料 | PUT | `/api/user/profile` |
| 用户列表(管理员) | GET | `/api/user/list` |
| 批量成员资料 | POST | `/api/user/members` |
| 空间列表 | GET | `/api/space/list` |
| 创建空间 | POST | `/api/space/create` |
| 加入空间 | POST | `/api/space/join` |
| 空间详情 | GET | `/api/space/{id}` |
| 改空间名 | PUT | `/api/space/{id}` |
| 比赛列表 | GET | `/api/match/list?spaceId=` |
| 记比赛 | POST | `/api/match/create` |
| 改比赛 | PUT | `/api/match/{id}` |
| 删比赛 | DELETE | `/api/match/{id}` |
| 我的设置 | GET/PUT | `/api/settings` |

所有接口统一返回 `{ ok, code, msg, …平铺字段 }`，`ok===false` 视为失败。
