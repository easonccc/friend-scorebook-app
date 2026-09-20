# Step 1 概览：Java 后端脚手架

> 分支：`test/java-migration`（commit `78b160a`）
> 范围：仅脚手架，可独立启动。未触碰数据库 / 业务接口 / 前端。

## 交付的文件

| 文件 | 作用 |
|------|------|
| `backend/pom.xml` | Spring Boot 4.1.0 / Java 26 / web + validation + lombok；JPA + MySQL 注释保留到 Step 2 |
| `backend/src/main/java/com/scorebook/ScorebookApplication.java` | 启动类 |
| `backend/src/main/java/com/scorebook/common/Result.java` | 扁平统一响应体 `{ ok, code, msg, 平铺字段 }`，与小程序前端契约一致（前端用 `r.ok === false` 判错、数据平铺取） |
| `backend/src/main/java/com/scorebook/config/WechatProperties.java` | 读取 `wechat.appid` / `wechat.secret`（`secret` 走环境变量 `WECHAT_SECRET`，不入库） |
| `backend/src/main/java/com/scorebook/config/WebConfig.java` | CORS + 登录拦截器注册 |
| `backend/src/main/java/com/scorebook/interceptor/LoginInterceptor.java` | **占位放行**，Step 4 接入 token → openid 校验 |
| `backend/src/main/java/com/scorebook/controller/HealthController.java` | `/health` 仅用于验证脚手架可启动 |
| `backend/src/main/resources/application.properties` | `server.port=8080` + 微信配置 |
| `backend/.gitignore` | 忽略 `target/` 等构建产物 |

## 验证结果
- `mvn -DskipTests package` 通过，产物 `target/friend-scorebook-backend-0.0.1-SNAPSHOT.jar`。
- `java -jar ... --server.port=8080` 启动后 `GET /health` 返回：
  ```json
  {"code":"OK","msg":null,"ok":true,"status":"up"}
  ```
  说明统一响应结构、Spring 装配、CORS/拦截器配置均正常。

## 排查中发现的沙箱干扰（重要）
- 本运行环境注入了 `SERVER__PORT=53964` / `SERVER__HOST=127.0.0.1`（WorkBuddy/CodeBuddy 运行时）。
- Spring Boot 宽松绑定将 `SERVER__PORT`（双下划线）映射为 `server.port`，优先级高于 `application.properties`，因此在本环境默认端口是 53964。
- 验证时用 CLI `--server.port=8080` 覆盖即可。**你本机没有该变量，`application.properties` 的 8080 会正常生效**，无需改代码。

## 下一步（需你确认）
- **Step 2**：MySQL 初始化（`schema.sql`）+ 4 张表 JPA 实体 + 数据源配置。
- ⚠️ 开始 Step 2 前请确认**本地 MySQL 服务已启动**（当前环境 MySQL 客户端在，但 server 未运行）。
