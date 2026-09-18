// 云函数 updateSpace - 更新双人名字
// 为什么走云函数：spaces 集合的写权限是关闭的（防止任何人乱改别人的空间），
// 改名必须由服务端校验「调用者确实是该空间成员」后才允许。
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const SPACES = 'spaces'

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) return { ok: false, code: 'NO_AUTH', msg: '未登录' }

  const spaceId = String(event.spaceId || '')
  if (!spaceId) return { ok: false, code: 'NO_SPACE', msg: '缺少空间 ID' }

  const playerAName = String(event.playerAName || '我').slice(0, 8)
  const playerBName = String(event.playerBName || '小晗子').slice(0, 8)

  const col = db.collection(SPACES)
  let res
  try {
    res = await col.doc(spaceId).get()
  } catch (e) {
    return { ok: false, code: 'NOT_FOUND', msg: '空间不存在' }
  }
  const space = res.data

  // 只允许空间成员改名
  if (space.members.indexOf(OPENID) === -1) {
    return { ok: false, code: 'NO_PERM', msg: '你不是这个空间的成员' }
  }

  await col.doc(spaceId).update({
    data: { playerAName, playerBName, updatedAt: db.serverDate() }
  })

  return { ok: true, space: Object.assign({}, space, { playerAName, playerBName }) }
}
