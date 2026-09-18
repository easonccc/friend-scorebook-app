// services/user.js - 用户体系云函数调用封装
//
// 为什么单独一层：页面/入口都通过这里调 user 云函数，不直接 wx.cloud.callFunction，
// 后续改接口、加缓存、统一错误处理只改这一处。
function call(action, data) {
  return wx.cloud.callFunction({
    name: 'user',
    data: Object.assign({ action }, data || {})
  }).then(res => {
    const r = res.result
    if (r && r.ok === false) {
      const err = new Error(r.msg || '操作失败')
      err.code = r.code
      throw err
    }
    return r
  })
}

module.exports = {
  // 初始化/获取当前用户（onLaunch 调一次）
  init() { return call('init') },
  // 取当前用户资料
  get() { return call('get') },
  // 修改资料（nickname / avatar），云函数再校验合法性
  updateProfile(patch) { return call('updateProfile', patch) },
  // 管理员：查看普通用户列表
  listUsers() { return call('list') }
}
