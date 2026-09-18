// 云函数 user - 用户体系：身份 + 权限集中校验
//
// 设计要点（为什么这样写）：
// 1. openid 由云函数 getWXContext 取，前端不传，无法伪造。
// 2. role 永远由 ADMIN_OPENIDS 判定，前端传 role 也不生效，防止提权。
// 3. 单函数多 action（init/get/updateProfile/list），权限校验集中。
// 4. 头像只存标识（avatar_01...），云函数再用白名单校验，防绕过前端。
//
// 拿你的 openid（A 方式）：
//   部署本云函数后，在云开发控制台「云函数 → user → 云端测试」
//   传 { "action": "init" }，看返回的 user.openid 和日志 [user] openid = ...
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command
const USERS = 'users'

// ====== 管理员 openid 白名单 ======
const ADMIN_OPENIDS = ['oPNMExmLegq0xuVZRFBHJvbkjTqk']

// ====== 预置头像白名单（与前端 utils/config.js 的 AVATARS 的 key 保持一致） ======
const AVATARS = [
  'avatar_01', 'avatar_02', 'avatar_03', 'avatar_04',
  'avatar_05', 'avatar_06', 'avatar_07', 'avatar_08',
  'avatar_09', 'avatar_10', 'avatar_12', 'avatar_13',
  'avatar_14', 'avatar_15', 'avatar_16', 'avatar_17'
]

// ====== 新用户随机昵称池（仅创建时随机一次，之后不再覆盖） ======
const NICKS = [
  '小橘子', '发呆中', '球球', '路过的猫', '小奶猫', '打盹的熊',
  '橘子皮', '冒泡中', '小汤圆', '路过的人', '发球的鱼', '摸鱼中',
  '小星星', '路过的风', '小馒头', '打哈欠的猫', '泡泡', '小蘑菇',
  '溜达中', '小饼干', '小可乐', '打盹中', '弹弹', '路过的小熊'
]
function randomNick() {
  return NICKS[Math.floor(Math.random() * NICKS.length)]
}

function isAdmin(openid) {
  return ADMIN_OPENIDS.indexOf(openid) > -1
}

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  // 👇 拿 openid 就看这行日志（云开发控制台 → 云函数 → user → 日志）
  console.log('[user] openid =', OPENID, '| action =', event.action)
  if (!OPENID) return { ok: false, code: 'NO_AUTH', msg: '未登录' }

  const action = event.action || ''
  switch (action) {
    case 'init':          return await initUser(OPENID)
    case 'get':           return await getUser(OPENID)
    case 'updateProfile': return await updateProfile(OPENID, event)
    case 'list':          return await listUsers(OPENID)
    case 'getMembers':    return await getMembers(event)
    default: return { ok: false, code: 'BAD_ACTION', msg: '未知 action: ' + action }
  }
}

/* ---------- getMembers：批量查多个用户的公开资料（nickname/avatar） ----------
 * 用于空间列表/比赛记录显示双方真实头像与昵称。
 * 只返回 nickname + avatar（公开资料，不返 role 等敏感字段）。
 * 未注册（无 users 文档）的 openid 不在返回里，前端用 space 名字 fallback。
 */
async function getMembers(event) {
  const openids = Array.isArray(event.openids) ? event.openids.filter(Boolean) : []
  if (!openids.length) return { ok: true, list: [] }
  const r = await db.collection(USERS).where({ _id: _.in(openids) }).limit(20).get()
  const list = r.data.map(u => ({
    openid: u._id,
    nickname: u.nickname || '我',
    avatar: u.avatar || 'avatar_01'
  }))
  return { ok: true, list }
}

/* ---------- init：首次进入查/建用户 ----------
 * 小程序 onLaunch 调一次：查 users.doc(openid)
 *   不存在 → 建（role 据 ADMIN_OPENIDS 判定，默认 nickname/avatar）
 *   存在   → 管理员名单有变化时同步修正 role，返回用户资料
 */
async function initUser(openid) {
  const col = db.collection(USERS)
  const res = await col.doc(openid).get().catch(() => null)

  if (res && res.data) {
    const role = isAdmin(openid) ? 'admin' : 'user'
    if (res.data.role !== role) {
      await col.doc(openid).update({ data: { role, updatedAt: db.serverDate() } })
      res.data.role = role
    }
    return { ok: true, user: res.data }
  }

  // 新用户：nickname 随机生成一次（之后用户改名不会被覆盖）
  const role = isAdmin(openid) ? 'admin' : 'user'
  const doc = {
    _id: openid,
    openid,
    nickname: randomNick(),
    avatar: 'avatar_01',
    role,
    createdAt: db.serverDate(),
    updatedAt: db.serverDate()
  }
  try {
    await col.add({ data: doc })
  } catch (e) {
    // 并发竞态兜底：同 openid 两个 init 同时进到这步，第二个 add 会因 _id 重复失败，
    // 此时回查一次返回已建好的用户，避免抛错
    const r2 = await col.doc(openid).get().catch(() => null)
    if (r2 && r2.data) return { ok: true, user: r2.data }
    throw e
  }
  return { ok: true, user: doc }
}

/* ---------- get：取当前用户 ---------- */
async function getUser(openid) {
  const res = await db.collection(USERS).doc(openid).get().catch(() => null)
  return res && res.data
    ? { ok: true, user: res.data }
    : { ok: false, code: 'NOT_FOUND', msg: '用户不存在' }
}

/* ---------- updateProfile：改 nickname / avatar ----------
 * 只能改自己（openid 来自云函数，不由前端决定）。
 * avatar 必须命中白名单；nickname 必须 trim 后非空、≤8 字符。
 * role / openid 不可改。
 */
async function updateProfile(openid, event) {
  const patch = {}

  if (event.nickname !== undefined) {
    const n = String(event.nickname).trim().slice(0, 8)
    if (!n) return { ok: false, code: 'BAD_NICKNAME', msg: '昵称不能为空' }
    patch.nickname = n
  }

  if (event.avatar !== undefined) {
    if (AVATARS.indexOf(event.avatar) === -1) {
      return { ok: false, code: 'BAD_AVATAR', msg: '头像不合法' }
    }
    patch.avatar = event.avatar
  }

  if (!Object.keys(patch).length) {
    return { ok: false, code: 'EMPTY', msg: '没有可更新字段' }
  }
  patch.updatedAt = db.serverDate()

  await db.collection(USERS).doc(openid).update({ data: patch })
  return { ok: true, user: Object.assign({ openid }, patch) }
}

/* ---------- list：仅管理员 ----------
 * admin 入口「查看普通用户」用。普通用户调直接拒绝。
 */
async function listUsers(openid) {
  if (!isAdmin(openid)) {
    return { ok: false, code: 'NO_PERM', msg: '仅管理员可查看用户列表' }
  }
  const r = await db.collection(USERS).limit(100).get()
  return { ok: true, list: r.data }
}
