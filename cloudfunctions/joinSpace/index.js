// 云函数 joinSpace - 通过邀请码加入空间
// 为什么走云函数：加入 = 把自己写进空间的 members 数组。
// 如果允许前端直接改 members，任何用户都能把自己加进别人的空间，
// 所以必须由服务端校验「邀请码正确 + 空间未满 2 人」后才放行。
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command
const SPACES = 'spaces'

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) return { ok: false, code: 'NO_AUTH', msg: '未登录' }

  const inviteCode = String(event.inviteCode || '').trim().toUpperCase()
  if (inviteCode.length !== 6) {
    return { ok: false, code: 'BAD_CODE', msg: '邀请码是 6 位，请核对' }
  }

  const col = db.collection(SPACES)
  const res = await col.where({ inviteCode }).get()
  if (res.data.length === 0) {
    return { ok: false, code: 'NOT_FOUND', msg: '邀请码不存在，请核对' }
  }

  const space = res.data[0]

  // 已加入过就直接返回，幂等
  if (space.members.indexOf(OPENID) === -1) {
    if (space.members.length >= 2) {
      return { ok: false, code: 'FULL', msg: '这个空间已经有两个人啦' }
    }
    await col.doc(space._id).update({ data: { members: _.push([OPENID]) } })
    space.members.push(OPENID)
  }

  return { ok: true, space }
}
