# 我们又开打了 · 微信小程序

朋友之间的比赛比分小账本。默认台球，我 vs 小晗子，10 秒记一场；双方通过「比赛空间 + 邀请码」共享同一份战绩。

**v1.6 新增**：默认朋友空间（每次启动直接进入）、默认比赛类型（存云端，设置页可改）、比分直接输入（总局数自动相加）、自定义比赛类型按用户隔离（朋友添加的类型不会出现在你的类型列表里）。

技术栈：**微信小程序原生（WXML/WXSS/JS）+ 微信云开发**，无任何第三方依赖。

---

## 一、项目结构

```
friend-scorebook-app/
├── project.config.json        # 开发者工具项目配置（AppID 在这里改）
├── miniprogram/               # 小程序前端
│   ├── app.js                 # 云初始化 + 登录 + 全局状态（当前空间/记录）
│   ├── app.json               # 页面注册 + 自定义 TabBar
│   ├── app.wxss               # 全局主题（奶油米白 + 柔绿，胜负色）
│   ├── custom-tab-bar/        # 自定义 TabBar（中间凸起「记一场」）
│   ├── utils/
│   │   ├── config.js          # ★ 环境 ID 与集合名，改这里就行
│   │   ├── db.js              # 数据层：云数据库 + 本地缓存双写
│   │   ├── stats.js           # 统计计算（纯函数）
│   │   └── util.js            # emoji / 时间 / 邀请码
│   └── pages/
│       ├── index/             # 首页：双人 VS、最近战绩、记一场、最近比赛
│       ├── record/            # 记一场 / 编辑比赛（同一页面复用）
│       ├── stats/             # 统计：类型筛选、总战绩、胜率、趋势、比分
│       ├── detail/            # 比赛详情：查看 / 编辑 / 删除
│       ├── settings/          # 设置：双人改名、空间、邀请码、分享
│       └── join/              # 创建空间 / 邀请码加入
└── cloudfunctions/            # 云函数（服务端）
    ├── login/                 # 取 openid
    ├── createSpace/           # 创建空间（服务端生成唯一邀请码）
    ├── joinSpace/             # 邀请码加入（服务端校验 + 写入成员）
    └── updateSpace/           # 改双人名字（服务端校验成员身份）
```

---

## 二、部署步骤（约 5 分钟）

### 1. 准备 AppID
在 [微信公众平台](https://mp.weixin.qq.com) 注册小程序，拿到 AppID。
打开 `project.config.json`，把 `"appid": "touristappid"` 换成你的真实 AppID。
（用「测试号」也能体验，但云开发必须用真实 AppID。）

### 2. 导入项目
微信开发者工具 → 导入项目 → 选择本目录 `friend-scorebook-app/` → AppID 填你的 → 确定。

### 3. 开通云开发
工具栏点「云开发」→ 开通（首次会创建环境）。
环境 ID 会形如 `xxx-xxxxxx`。**如果只有一个环境，`utils/config.js` 里 `CLOUD_ENV` 留空即可**；多个环境时把目标环境 ID 填进去。

### 4. 创建数据库集合 + 配置权限（关键！）
云开发控制台 → 数据库 → 创建三个集合：

| 集合名 | 用途 | 权限 |
|--------|------|------|
| `spaces` | 比赛空间（成员/邀请码/名字） | 自定义安全规则（见下） |
| `poop_records` | 比赛记录（前端直接读写） | 自定义安全规则（见下） |
| `user_settings` | 用户设置（默认类型/默认空间/自定义类型） | 自定义安全规则（见下） |

> 集合名在 `utils/config.js` 的 `DB` 里统一定义。想改名（比如 `poop_records` → `records`），改这一处，并同步改集合权限规则里的名字即可。

**spaces 安全规则**（创建者可读、成员可读，写入全部走云函数）：
```json
{
  "read": "doc.creator == auth.openid || auth.openid in doc.members",
  "write": false
}
```

**poop_records 安全规则**（只有该空间的成员能读写自己空间的记录，非成员看不到）：
```json
{
  "read": "auth.openid in get(`database.collection('spaces').doc(doc.spaceId)`).data.members",
  "write": "auth.openid in get(`database.collection('spaces').doc(doc.spaceId)`).data.members"
}
```

**user_settings 安全规则**（一人一条，`_id` 就是自己的 openid，只能读写自己的）：
```json
{
  "read": "auth.openid == doc._id",
  "write": "auth.openid == doc._id"
}
```

> 这条规则是「类型隔离」的核心：每个用户的默认类型、自定义比赛类型都存在自己的 `user_settings` 文档里，朋友添加的「飞盘」「滑板」不会出现在你的类型选择器里，互相完全不影响。

### 5. 上传云函数
在开发者工具的资源管理器中，展开 `cloudfunctions`，对 **login / createSpace / joinSpace / updateSpace** 四个目录分别：
右键 → 「上传并部署：云端安装依赖」。
（云函数目录不能放在 `miniprogram/` 里，工具才能识别，本项目已按此结构放好。）

### 6. 运行
编译即可。首次打开会引导「创建 / 加入空间」：

- **创建**：自己建空间，生成 6 位邀请码 → 设置页分享给朋友
- **加入**：朋友输入邀请码（或直接点分享卡片），双方进入同一空间

---

## 三、数据是怎么同步的

```
记录一条比赛：
  前端 (record 页) → 云数据库 poop_records（add）→ 成功 → 写本地缓存 wx.setStorageSync
                       ↓
朋友打开 App → 首页/统计 onShow → 从云数据库拉取该空间全部记录 → 覆盖本地缓存 → 渲染
```

- **云数据库是唯一事实来源**，本地缓存只用于秒开和离线查看。
- 首页/统计支持**下拉刷新**，手动拉到最新；后续版本可以加云开发「实时数据推送」(`watch`) 做到真正的秒级同步，第一版刻意不引入，保证简单可靠。
- 记录里只存 `winner: 'me' | 'friend' | 'draw'`（角色），不存姓名——所以改名字后所有历史战绩、统计自动跟随，无需重算。

## 四、数据模型

```
spaces（比赛空间）——共享数据的边界，一个空间 = 一对朋友
  _id, name, inviteCode, meOpenid(创建者=我), meName, friendName,
  members: [openid, openid]（最多 2 人）, createdAt

poop_records（比赛记录）——挂在空间下，双方实时同步
  _id, spaceId(归属空间), type(比赛类型), time(时间戳),
  loc(地点，可空), duration(分钟，0=不记), a(我得分), b(朋友得分),
  winner('me'/'friend'/'draw', 由逻辑自动算好),
  createdAt, updatedAt

user_settings（用户设置）——一人一条，_id = openid，纯属个人偏好
  _id(=openid), defaultType(默认比赛类型), defaultSpaceId(默认朋友空间),
  customTypes([我的自定义比赛类型，上限 10 个]), updatedAt
```

为什么这样设计：
- **一切以空间为边界**：查询、权限、同步都按 `spaceId` 过滤，天然隔离不同朋友对。
- **个人偏好和共享数据分开存**：记录/空间是两个人共享的（按 spaceId 鉴权），默认类型/自定义类型是纯个人的（按 openid 鉴权）。所以「谁跟谁记什么」互不干扰——朋友新建的比赛类型只进他的 `user_settings`，你看不到也不会被影响；但历史记录里他记的「飞盘 8:5」你照样能正常看到（类型只是个字符串）。
- **`user_settings._id = openid`**：一人一条、天然唯一，安全规则 `auth.openid == doc._id` 一行搞定权限，不需要云函数。
- **记录里只存 `winner` 角色**不存姓名——改名后所有历史战绩、统计自动跟随，无需重算。
- **openid 做身份**：微信给每个用户分配的唯一 ID，云函数自动获取，不需要注册登录。

## 五、v1.6 新功能速览

| 功能 | 入口 | 存储 |
|------|------|------|
| 默认朋友空间 | 设置页/首页弹层 → 「设为默认」；启动时优先进入默认空间 | `user_settings.defaultSpaceId` |
| 默认比赛类型 | 设置页 → 默认比赛类型 → 选择（新开记录默认用它） | `user_settings.defaultType` |
| 比分直接输入 | 记录页点比分数字直接键入，总局数自动相加、胜者自动判断 | 无需存储 |
| 自定义类型隔离 | 记录页/设置页添加自定义类型，只进自己的列表 | `user_settings.customTypes` |

> 第一个创建/加入的空间会自动设为默认空间，新手无感。

## 六、以后想换成自己的后端？

- 前端 `utils/db.js` 是唯一的数据出入口，所有页面都不直接碰数据库。
- 换成 Java/Node 后端时，只需把 `db.js` 里的函数逐个替换成 HTTP 请求（如 `POST /records`、`GET /records?spaceId=xx`），页面代码一行不用改。
- 空间权限（谁是成员、能不能读记录）从「云开发安全规则」迁移到你后端的鉴权中间件即可，业务逻辑完全一致。

## 七、已知取舍

- **集合名 `poop_records`**：按你的要求命名（字面意思是「便便记录」😄）。介意的话改 `utils/config.js` 一处即可，记得同步更新数据库里的集合名与安全规则。
- **分享卡片**：设置页「分享给朋友加入」走微信分享，朋友点卡片直达加入页并自动识别邀请码。
- **「记一场」Tab**：自定义 TabBar 中间凸起按钮，点它走 `navigateTo` 打开记录页，所以同一页面天然支持「带 ?id= 进入编辑模式」。
