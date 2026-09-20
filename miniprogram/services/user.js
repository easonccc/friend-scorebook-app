// services/user.js - 用户体系接口调用封装
//
// 为什么单独一层：页面/入口都通过这里调用户接口，不直接 wx.request，
// 后续改接口、加缓存、统一错误处理只改这一处。
// 原 user 云函数（init/get/updateProfile/list）已迁移为 Java 后端 REST：
//   init/get      → GET  /api/user/info
//   updateProfile → PUT  /api/user/profile
//   list          → GET  /api/user/list   （仅管理员，权限在后端判定）
const db = require('../utils/db')

function api(method, path, body) {
  return db.apiRequest(method, path, body)
}

module.exports = {
  // 初始化/获取当前用户（onLaunch 调一次）
  init() { return api('GET', '/api/user/info').then(r => ({ user: r.user })) },
  // 取当前用户资料
  get() { return api('GET', '/api/user/info').then(r => ({ user: r.user })) },
  // 修改资料（nickname / avatar），后端再校验合法性
  updateProfile(patch) { return api('PUT', '/api/user/profile', patch).then(r => ({ user: r.user })) },
  // 管理员：查看普通用户列表
  listUsers() { return api('GET', '/api/user/list').then(r => ({ list: r.list })) }
}
