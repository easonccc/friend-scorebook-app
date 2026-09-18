// 云函数 createSpace - 创建比赛空间
// 为什么走云函数：邀请码必须在服务端生成并保证唯一（多个用户同时创建时
// 前端各自随机生成可能撞码）。同时服务端可以直接用 OPENID 标记创建者，
// 不需要前端传身份，防止伪造。
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const SPACES = 'spaces'

// 生成 6 位邀请码（去掉易混淆的 0/O/1/I）
function genCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let s = ''
  for (let i = 0; i < 6; i++) s += chars.charAt(Math.floor(Math.random() * chars.length))
  return s
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) return { ok: false, code: 'NO_AUTH', msg: '未登录' }

  const name = String(event.name || '').slice(0, 12) || '我们的空间'
  const playerAName = String(event.playerAName || '我').slice(0, 8)   // A 方（创建者）名
  const playerBName = String(event.playerBName || '小晗子').slice(0, 8) // B 方（朋友）名

  // 生成不重复的邀请码（最多重试 5 次）
  let inviteCode = ''
  for (let i = 0; i < 5; i++) {
    inviteCode = genCode()
    const dup = await db.collection(SPACES).where({ inviteCode }).count()
    if (dup.total === 0) break
  }

  const doc = {
    name,
    inviteCode,
    creatorOpenid: OPENID,   // 创建者 openid（客观标识，= playerA）
    playerAName,              // A 方名（创建者）
    playerBName,              // B 方名（朋友）
    members: [OPENID],        // 空间成员，决定谁能读写这个空间的记录
    createdAt: db.serverDate()
  }

  const res = await db.collection(SPACES).add({ data: doc })
  return { ok: true, space: Object.assign({ _id: res._id }, doc) }
}
