// 云函数 getSpaces - 拉取当前用户参与的所有比赛空间
// 为什么需要它：清缓存/换设备后本地 storage 空，必须能从云端恢复空间列表。
// spaces 集合安全规则 read=false，客户端不能直查，必须走云函数。
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const SPACES = 'spaces'

exports.main = async () => {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) return { ok: false, code: 'NO_AUTH', msg: '未登录' }

  // members 是数组，where({members: OPENID}) 匹配数组中含 OPENID 的文档
  const r = await db.collection(SPACES).where({ members: OPENID }).get()
  return { ok: true, spaces: r.data }
}
