// 云函数 login - 获取当前用户 openid
// 为什么需要它：小程序端拿不到 openid，只有云函数能通过 getWXContext 取到。
// openid 是微信给每个用户分配的固定 ID，用来区分「我」和「朋友」。
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async () => {
  const { OPENID } = cloud.getWXContext()
  return { openid: OPENID }
}
