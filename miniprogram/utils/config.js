// utils/config.js - 全局配置
// 需要修改的东西集中在这里，改一处全局生效

module.exports = {
  // Java 后端基地址（替代原 wx.cloud 云函数 / 云数据库）。
  // 本地开发：http://localhost:8080（开发者工具需勾选「不校验合法域名」）。
  // 真机预览 / 上线：改为可访问的 https 域名，并在小程序后台配置 request 合法域名。
  API_BASE: 'http://localhost:8080',

  // 云开发环境 ID（已弃用，保留字段避免其它文件报错）。
  // 留空 = 使用小程序账号下唯一的默认环境；
  // 若有多个环境，请在微信开发者工具「云开发」控制台复制环境 ID 填进来
  CLOUD_ENV: '',

  // 数据库集合名
  DB: {
    // 比赛记录集合
    records: 'match_records',
    // 比赛空间集合
    spaces: 'spaces',
    // 用户设置集合（一人一条，_id = openid）：
    // 存默认比赛类型 / 默认朋友空间 / 我的自定义比赛类型
    settings: 'user_settings'
  },

  // 预置头像白名单（与 user 云函数 AVATARS 保持一致）
  // 前端选头像 UI 从这里渲染，提交时只传 key 给云函数
  AVATARS: [
    { key: 'avatar_01', emoji: '🐼' },
    { key: 'avatar_02', emoji: '🐨' },
    { key: 'avatar_03', emoji: '🦊' },
    { key: 'avatar_04', emoji: '🐰' },
    { key: 'avatar_05', emoji: '🦁' },
    { key: 'avatar_06', emoji: '🐯' },
    { key: 'avatar_07', emoji: '🐵' },
    { key: 'avatar_08', emoji: '🐸' },
    { key: 'avatar_09', emoji: '🐷' },
    { key: 'avatar_10', emoji: '🐮' },
    { key: 'avatar_12', emoji: '🐶' },
    { key: 'avatar_13', emoji: '🐱' },
    { key: 'avatar_14', emoji: '🐭' },
    { key: 'avatar_15', emoji: '🐹' },
    { key: 'avatar_16', emoji: '🐻' },
    { key: 'avatar_17', emoji: '🐻‍❄️' },
  ],

  // 内置比赛类型（默认台球，第一个）
  TYPES: [
    { key: '台球', emoji: '🎱' },
    { key: '麻将', emoji: '🀄' },
    { key: '羽毛球', emoji: '🏸' },
    { key: '乒乓球', emoji: '🏓' },
    { key: '篮球', emoji: '🏀' },
    { key: '足球', emoji: '⚽' },
    { key: '斗地主', emoji: '🃏' }
  ]
}
