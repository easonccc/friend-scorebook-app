// utils/util.js - 通用小工具：emoji、时间格式化、邀请码生成
const config = require('./config')

// 比赛类型 -> emoji（自定义类型统一用 🎯）
function emojiOf(type) {
  const hit = config.TYPES.find(t => t.key === type)
  return hit ? hit.emoji : '🎯'
}

// 用户头像标识 -> emoji（avatar_01 → 🐼），供双人显示用；未知返回 🐼
function avatarEmojiOf(key) {
  const hit = config.AVATARS.find(a => a.key === key)
  return hit ? hit.emoji : '🐼'
}

// 当前用户是否为该空间创建者（用于比分视角转换）
// 兼容旧数据：优先 creatorOpenid，缺失回退 meOpenid
function isCreatorOf(space, openid) {
  const creator = space && (space.creatorOpenid != null ? space.creatorOpenid : space.meOpenid)
  return !!(creator && openid && creator === openid)
}

// 把一条记录转成「当前用户视角」：me=当前用户，a=当前用户分
// 数据库存的是绝对角色（a=创建者分, winner me=创建者赢）。
// 当前用户=创建者时原样；当前用户=朋友时交换 a/b 并翻转 winner。
function toMyView(r, creatorView) {
  if (creatorView || !r) return r
  const w = r.winner === 'me' ? 'friend' : r.winner === 'friend' ? 'me' : 'draw'
  return Object.assign({}, r, { a: r.b, b: r.a, winner: w })
}

// 类型列表 = 内置类型 + 我添加的自定义类型（来自 user_settings，按用户隔离）
// + 「自定义」添加入口。customTypes 传空数组即只显示内置。
function typeList(customTypes) {
  const mine = (customTypes || []).map(k => ({ key: k, emoji: '🎯', mine: true }))
  return config.TYPES.concat(mine).concat([{ key: '自定义', emoji: '✨' }])
}

function pad(n) {
  return n < 10 ? '0' + n : '' + n
}

// 时间戳 -> 友好文案：今天 14:30 / 昨天 19:20 / 8月18日 12:00
function fmtTime(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  const now = new Date()
  const sameDay = (a, b) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  const hm = pad(d.getHours()) + ':' + pad(d.getMinutes())
  if (sameDay(d, now)) return '今天 ' + hm
  const yest = new Date(now.getTime() - 24 * 3600 * 1000)
  if (sameDay(d, yest)) return '昨天 ' + hm
  const md = (d.getMonth() + 1) + '月' + d.getDate() + '日'
  if (d.getFullYear() === now.getFullYear()) return md + ' ' + hm
  return d.getFullYear() + '年' + md + ' ' + hm
}

// 时间戳 -> datetime-local 可用的字符串（记录页时间编辑用）
function toLocalInput(ts) {
  const d = new Date(ts)
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
    'T' + pad(d.getHours()) + ':' + pad(d.getMinutes())
}

// 生成 6 位邀请码（去掉易混淆的 0/O/1/I）
function genInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

// 时长分钟数 -> 文案（0 = 不记录）
function fmtDuration(min) {
  if (!min) return ''
  if (min < 60) return min + ' 分钟'
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? h + ' 小时 ' + m + ' 分' : h + ' 小时'
}

module.exports = { emojiOf, avatarEmojiOf, isCreatorOf, toMyView, typeList, fmtTime, toLocalInput, genInviteCode, fmtDuration }
