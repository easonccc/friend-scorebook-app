// 云函数 record - 比赛记录收口（增删改查 + 成员校验）
//
// 为什么需要它：
// 1. match_records 集合的安全规则 read/write 全 false（客户端不能直连），
//    所有读写都走本云函数，由服务端校验「调用者确实是该空间成员」。
// 2. 微信云数据库安全规则不能跨集合校验（无法在 records 规则里查 spaces.members），
//    所以成员校验必须在云函数代码里做：先查 spaces.doc(spaceId).members 是否含 OPENID。
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command
const RECORDS = 'match_records'
const SPACES = 'spaces'

// 校验 openid 是否为某空间成员
async function isMember(spaceId, openid) {
  if (!spaceId) return false
  const r = await db.collection(SPACES).doc(spaceId).get().catch(() => null)
  const members = r && r.data && r.data.members
  return !!(members && members.indexOf(openid) > -1)
}

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) return { ok: false, code: 'NO_AUTH', msg: '未登录' }

  const action = event.action || ''
  switch (action) {
    case 'list':   return await list(OPENID, event)
    case 'add':    return await add(OPENID, event)
    case 'update': return await update(OPENID, event)
    case 'delete': return await del(OPENID, event)
    default: return { ok: false, code: 'BAD_ACTION', msg: '未知 action: ' + action }
  }
}

/* ---------- list：拉某空间全部记录（倒序，分页） ---------- */
async function list(openid, event) {
  const spaceId = event.spaceId
  if (!(await isMember(spaceId, openid))) {
    return { ok: false, code: 'NO_PERM', msg: '你不是该空间成员' }
  }
  const col = db.collection(RECORDS)
  const MAX = 20
  let list = [], skip = 0
  for (;;) {
    const res = await col.where({ spaceId }).orderBy('time', 'desc').skip(skip).limit(MAX).get()
    list = list.concat(res.data)
    if (res.data.length < MAX) break
    skip += MAX
  }
  return { ok: true, list }
}

/* ---------- add：新增一场比赛 ---------- */
async function add(openid, event) {
  const spaceId = event.spaceId
  if (!(await isMember(spaceId, openid))) {
    return { ok: false, code: 'NO_PERM', msg: '你不是该空间成员' }
  }
  const a = Number(event.a) || 0
  const b = Number(event.b) || 0
  const data = {
    spaceId,
    type: String(event.type || '台球'),
    time: Number(event.time) || Date.now(),
    loc: String(event.loc || ''),
    duration: Number(event.duration) || 0,
    a, b,
    winner: a > b ? 'me' : a < b ? 'friend' : 'draw',
    creatorOpenid: openid,
    createdAt: db.serverDate(),
    updatedAt: db.serverDate()
  }
  const res = await db.collection(RECORDS).add({ data })
  return { ok: true, record: Object.assign({ _id: res._id }, data) }
}

/* ---------- update：编辑一场比赛 ---------- */
async function update(openid, event) {
  const spaceId = event.spaceId
  const id = event.id
  if (!spaceId || !id) return { ok: false, code: 'BAD_ARGS', msg: '缺少 spaceId/id' }
  if (!(await isMember(spaceId, openid))) {
    return { ok: false, code: 'NO_PERM', msg: '你不是该空间成员' }
  }
  const a = Number(event.a) || 0
  const b = Number(event.b) || 0
  const patch = {
    type: String(event.type || '台球'),
    time: Number(event.time) || Date.now(),
    loc: String(event.loc || ''),
    duration: Number(event.duration) || 0,
    a, b,
    winner: a > b ? 'me' : a < b ? 'friend' : 'draw',
    updatedAt: db.serverDate()
  }
  await db.collection(RECORDS).doc(id).update({ data: patch })
  return { ok: true, patch }
}

/* ---------- delete：删除一场比赛 ---------- */
async function del(openid, event) {
  const spaceId = event.spaceId
  const id = event.id
  if (!spaceId || !id) return { ok: false, code: 'BAD_ARGS', msg: '缺少 spaceId/id' }
  if (!(await isMember(spaceId, openid))) {
    return { ok: false, code: 'NO_PERM', msg: '你不是该空间成员' }
  }
  await db.collection(RECORDS).doc(id).remove()
  return { ok: true }
}
