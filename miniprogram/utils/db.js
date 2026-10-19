// utils/db.js - 数据层：Java 后端 REST 接口 + 本地缓存 双写
//
// 设计思路（为什么这样写）：
// 1. 一切比赛记录都挂在「比赛空间」下，空间是共享数据的边界。
// 2. 后端 MySQL 是唯一事实来源（true source），本地 wx.setStorageSync 只是缓存，
//    保证打开 App 时秒开、离线也能看，网络恢复后再同步。
// 3. 原云函数 / 云数据库调用，统一收敛到 apiRequest（wx.request + Bearer token），
//    页面与其它模块的代码完全不用改，仍调用 ensureLogin / fetchUserSpaces / addRecord ...
//
// 字段归一化：后端主键是数据库自增 Long（JSON 里叫 id），而页面全部用字符串 _id
// 做索引与 === 比较（原云开发的 _id 是字符串）。所以这里统一把 id 复制成字符串 _id，
// 既保留 id 也补 _id，页面零改动即可工作。
const config = require('./config')
const stats = require('./stats')
const util = require('./util')

const KEY_SPACE = 'currentSpace'
const KEY_SPACES = 'mySpaces'          // 我参与的所有空间列表
const KEY_OPENID = 'myOpenid'
const KEY_TOKEN = 'myToken'            // 登录后后端签发的 token（Bearer）
const keyRecords = spaceId => 'records:' + spaceId

/* ---------- 后端 REST 请求封装 ---------- */
// method: GET/POST/PUT/DELETE；path: 以 / 开头的接口路径；body: 请求体（GET 用 query 拼在 path 上）
// opts.skipAuth: true 时不上 token（仅登录接口用）
// 约定：后端统一返回 { ok, code, msg, ...平铺字段 }，ok === false 或 HTTP 非 2xx 视为失败
async function apiRequest(method, path, body, opts) {
  opts = opts || {}
  // 没 token 时自动先登录一次（拿 code 换 token），保证页面调用无需关心登录时机
  if (!opts.skipAuth && !getToken()) {
    try { await ensureLogin() } catch (e) { /* 下面会因无 token 被后端拒，正常走失败分支 */ }
  }
  return new Promise((resolve, reject) => {
    const header = { 'content-type': 'application/json' }
    const token = getToken()
    if (token && !opts.skipAuth) header['Authorization'] = 'Bearer ' + token
    wx.request({
      url: config.API_BASE + path,
      method,
      data: body,
      header,
      success: res => {
        const data = res.data
        const success = res.statusCode >= 200 && res.statusCode < 300 && data && data.ok !== false
        if (success) {
          resolve(data)
          return
        }
        const msg = (data && data.msg) || ('请求失败 (HTTP ' + res.statusCode + ')')
        const err = new Error(msg)
        err.code = (data && data.code) || ('HTTP_' + res.statusCode)
        err.statusCode = res.statusCode
        reject(err)
      },
      fail: err => reject(err)
    })
  })
}

function getToken() {
  return wx.getStorageSync(KEY_TOKEN) || ''
}

// 手写 base64url 解码：微信小程序「真机」没有 atob（那是浏览器全局函数），
// 直接用它会出现「模拟器正常、真机解出空值」——因为 DevTools 模拟器是类浏览器环境有 atob，
// 真机微信客户端没有 → 抛错 → catch 返回 '' → myOpenid 为空 → 视角反转。
// 所以这里不依赖任何平台 API，按 6bit 分组自己还原。
const B64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
function base64UrlDecode(input) {
  const b64 = String(input).replace(/-/g, '+').replace(/_/g, '/').replace(/[^A-Za-z0-9+/]/g, '')
  let out = ''
  let buffer = 0
  let bits = 0
  for (let i = 0; i < b64.length; i++) {
    const idx = B64_CHARS.indexOf(b64.charAt(i))
    if (idx === -1) continue
    buffer = (buffer << 6) | idx
    bits += 6
    if (bits >= 8) {
      bits -= 8
      out += String.fromCharCode((buffer >> bits) & 0xff)
    }
  }
  return out
}

// 从 token 的 payload（base64url JSON，明文）里解出 openid，避免登录后再发一次请求。
// 这是自家签发的 token，格式固定为 { openid, exp }，两者均为 ASCII，解码安全且零成本。
function decodeTokenOpenid(token) {
  try {
    const p = String(token).split('.')[1]
    if (!p) return ''
    const json = JSON.parse(base64UrlDecode(p))
    return json.openid || ''
  } catch (e) {
    return ''
  }
}

/* ---------- 用户身份 ---------- */
let loginPromise = null
// 登录并拿到 openid（先 wx.login 拿 code → 后端换 openid + 签发 token）。
// 每次启动都真实走一遍 wx.login（不靠缓存短路），保证微信登录一定触发；失败用 Toast 显式提示，避免被静默吞掉。
function ensureLogin() {
  if (loginPromise) return loginPromise
  loginPromise = doLogin().catch(e => {
    loginPromise = null // 失败允许下次重试
    const msg = (e && e.message) || '登录失败'
    wx.showToast({ title: msg, icon: 'none' })
    throw e
  })
  return loginPromise
}

function doLogin() {
  return new Promise((resolve, reject) => {
    wx.login({
      success: res => {
        if (!res.code) {
          reject(new Error('wx.login 未返回 code'))
          return
        }
        apiRequest('POST', '/api/auth/login', { code: res.code }, { skipAuth: true })
          .then(data => {
            const token = data && data.token
            if (!token) throw new Error('登录失败：未返回 token')
            wx.setStorageSync(KEY_TOKEN, token)
            const openid = decodeTokenOpenid(token)
            wx.setStorageSync(KEY_OPENID, openid)
            resolve(openid)
          })
          .catch(reject)
      },
      fail: err => reject(err)
    })
  })
}

function getOpenid() {
  return wx.getStorageSync(KEY_OPENID) || ''
}

/* ---------- 字段归一化（后端 id/Long → 前端 _id/字符串） ---------- */
function normalizeSpace(raw) {
  if (!raw) return raw
  return Object.assign({}, raw, { _id: String(raw.id) })
}
function normalizeSpaces(list) {
  return (list || []).map(normalizeSpace)
}
function normalizeRecord(raw) {
  if (!raw) return raw
  return Object.assign({}, raw, { _id: String(raw.id) })
}
function normalizeRecords(list) {
  return (list || []).map(normalizeRecord)
}
function mapSettings(s) {
  s = s || {}
  return {
    defaultType: s.defaultType || DEFAULT_SETTINGS.defaultType,
    defaultSpaceId: s.defaultSpaceId || '',
    customTypes: Array.isArray(s.customTypes) ? s.customTypes : []
  }
}

/* ---------- 比赛空间 ---------- */
function getCachedSpace() {
  return wx.getStorageSync(KEY_SPACE) || null
}

// 我参与的所有空间列表（多朋友：每个空间 = 我 + 一个朋友）
function getCachedSpaces() {
  return wx.getStorageSync(KEY_SPACES) || []
}

// 从后端拉取当前用户参与的所有空间（清缓存/换设备后本地空时恢复用）
// 写入本地缓存 + 同步到 globalData（records 用本地缓存，可能为空）
async function fetchUserSpaces() {
  const r = await apiRequest('GET', '/api/space/list')
  const list = normalizeSpaces(r.spaces)
  wx.setStorageSync(KEY_SPACES, list)
  const app = getApp()
  if (app) {
    app.globalData.spaces = list.map(s => Object.assign({}, s, {
      records: getCachedRecords(s._id)
    }))
  }
  return list
}

function cacheSpaces(list) {
  wx.setStorageSync(KEY_SPACES, list)
  return list
}

// 把 space 同步进空间列表（新增或更新），保证列表始终最新
function syncSpaceToList(space) {
  const list = getCachedSpaces()
  const i = list.findIndex(s => s._id === space._id)
  if (i > -1) list[i] = space
  else list.unshift(space)
  return cacheSpaces(list)
}

function cacheSpace(space) {
  wx.setStorageSync(KEY_SPACE, space)
  syncSpaceToList(space)
  const app = getApp()
  if (app) app.setSpace(space)
  // 后台拉双方真实资料（nickname/avatar），存到 space._members，供显示层用
  fetchMembers(space)
  return space
}

// 拉空间成员的真实资料（nickname/avatar），缓存到 space._members（含全局态同步）
// 显示层用：space._members 里按 openid 找双方资料；找不到的 openid 用 space.meName/friendName fallback
async function fetchMembers(space) {
  if (!space || !space.members || !space.members.length) return
  try {
    const r = await apiRequest('POST', '/api/user/members', { openids: space.members })
    const list = r.list || []
    space._members = list
    const app = getApp()
    if (app) {
      const sp = app.globalData.spaces && app.globalData.spaces.find(s => s._id === space._id)
      if (sp) sp._members = list
      if (app.globalData.space && app.globalData.space._id === space._id) {
        app.globalData.space._members = list
      }
    }
    return list
  } catch (e) {
    console.warn('拉成员资料失败:', e.errMsg || e)
  }
}

// 取某空间里指定 openid 的资料（nickname + avatarEmoji），找不到返回 null
function memberOf(space, openid) {
  if (!space || !space._members) return null
  return space._members.find(m => m.openid === openid) || null
}

// 当前用户视角的双方资料：me=当前登录用户，friend=对手。
// 返回 { isCreator, me, friend, meAvatar, frAvatar }
// 数据库存 a=创建者分/playerA 分/winner me=创建者赢；isCreator 决定前端是否需要翻转比分视角。
// 兼容旧数据：优先读新字段（playerAName/playerBName/creatorOpenid），缺失时回退旧字段。
function pairOf(space, openid) {
  // 调用方可能传入空 openid（如 globalData.openid 在登录完成前尚未就绪），
  // 这里回退到本地已登录的 openid，避免「当前用户视角」错乱导致 me/friend 整体反转。
  const me = openid || getOpenid()
  const meUser = memberOf(space, me)
  const friendOpenid = (space && space.members || []).find(m => m !== me)
  const frUser = memberOf(space, friendOpenid)
  const creatorView = util.isCreatorOf(space, me)
  const aName = space && (space.playerAName != null ? space.playerAName : space.meName)
  const bName = space && (space.playerBName != null ? space.playerBName : space.friendName)
  const result = {
    isCreator: creatorView,
    me: (meUser && meUser.nickname) || (creatorView ? aName : bName) || '我',
    friend: (frUser && frUser.nickname) || (creatorView ? bName : aName) || '朋友',
    meAvatar: util.avatarEmojiOf(meUser && meUser.avatar),
    frAvatar: util.avatarEmojiOf(frUser && frUser.avatar)
  }
  return result
}

// 切换当前空间：恢复该空间的本地缓存记录，并后台拉一次云端最新
async function switchSpace(spaceId) {
  const list = getCachedSpaces()
  const space = list.find(s => s._id === spaceId)
  if (!space) throw new Error('找不到该空间')
  const app = getApp()
  app.globalData.space = space
  app.globalData.records = getCachedRecords(spaceId)
  wx.setStorageSync(KEY_SPACE, space)
  // 后台同步云端（朋友新记的比赛会一起过来）+ 拉双方资料
  fetchMembers(space)
  try {
    const records = await fetchRecords(spaceId)
    app.globalData.records = records
    space.records = records
  } catch (e) {
    console.warn('同步云端失败:', e.errMsg || e)
  }
  return space
}

// 创建空间（后端：服务端生成唯一邀请码）
async function createSpace({ name, playerAName, playerBName }) {
  const r = await apiRequest('POST', '/api/space/create', { name, playerAName, playerBName })
  return cacheSpace(normalizeSpace(r.space))
}

// 加入空间（后端：服务端校验邀请码 + 把自己加进 members）
async function joinSpace(inviteCode) {
  const r = await apiRequest('POST', '/api/space/join', { inviteCode })
  return cacheSpace(normalizeSpace(r.space))
}

// 更新双人名字（后端：服务端校验成员身份后更新空间）
async function updateSpace({ playerAName, playerBName }) {
  const space = getCachedSpace()
  if (!space || !space._id) throw new Error('当前没有比赛空间')
  const r = await apiRequest('PUT', '/api/space/' + space._id, { playerAName, playerBName })
  return cacheSpace(normalizeSpace(r.space))
}

/* ---------- 比赛记录 ----------
 * 增删改查全部走 /api/match/*（成员校验在后端 Service 里做）。本地缓存仍保留，保证秒开/离线可看。
 */
function getCachedRecords(spaceId) {
  return wx.getStorageSync(keyRecords(spaceId)) || []
}

// 从后端拉取该空间全部记录，写入缓存后返回
async function fetchRecords(spaceId) {
  const r = await apiRequest('GET', '/api/match/list?spaceId=' + encodeURIComponent(spaceId))
  const list = normalizeRecords(r.list)
  wx.setStorageSync(keyRecords(spaceId), list)
  touchSpaceRecords(spaceId, list)
  return list
}

// 新增一场比赛：后端校验成员后写入，成功再更新本地缓存
async function addRecord({ spaceId, type, time, loc, duration, a, b, amount }) {
  const r = await apiRequest('POST', '/api/match/create', { spaceId, type, time, loc, duration, a, b, amount })
  const record = normalizeRecord(r.record)
  const list = getCachedRecords(spaceId)
  list.unshift(record)
  wx.setStorageSync(keyRecords(spaceId), list)
  touchSpaceRecords(spaceId, list)
  return record
}

// 更新一场比赛：后端校验成员后修改，再同步本地缓存
async function updateRecord(spaceId, id, { type, time, loc, duration, a, b, amount }) {
  const r = await apiRequest('PUT', '/api/match/' + id, { type, time, loc, duration, a, b, amount })
  const patch = normalizeRecord(r.record)
  const list = getCachedRecords(spaceId)
  const i = list.findIndex(rec => rec._id === id)
  if (i > -1) {
    list[i] = Object.assign({}, list[i], patch)
    wx.setStorageSync(keyRecords(spaceId), list)
    touchSpaceRecords(spaceId, list)
  }
  return patch
}

// 删除一场比赛
async function deleteRecord(spaceId, id) {
  await apiRequest('DELETE', '/api/match/' + id)
  const list = getCachedRecords(spaceId).filter(r => r._id !== id)
  wx.setStorageSync(keyRecords(spaceId), list)
  touchSpaceRecords(spaceId, list)
}

// 把某空间的最新记录列表同步到内存空间对象（统计页「全部朋友」合并用）
function touchSpaceRecords(spaceId, list) {
  const app = getApp()
  const sp = app && app.globalData.spaces ? app.globalData.spaces.find(s => s._id === spaceId) : null
  if (sp) sp.records = list
  if (app && app.globalData.space && app.globalData.space._id === spaceId) {
    app.globalData.records = list
  }
}

/* ---------- 用户设置（默认比赛类型 / 默认朋友空间 / 我的自定义类型） ----------
 * 设计要点：
 * 1. user_settings 一条 = 一个用户，openid 当主键（天然唯一，绝不重复）。
 * 2. 后端按 openid 隔离：每个用户只能读写自己的设置，「自定义比赛类型」互不影响。
 * 3. 后端为唯一事实来源 + 本地缓存（与比赛记录同一套思路）。
 */
const KEY_SETTINGS = 'mySettings'
const DEFAULT_SETTINGS = {
  defaultType: '台球',     // 默认比赛类型：新开记录默认用它
  defaultSpaceId: '',      // 默认朋友空间：每次启动优先进入
  customTypes: []          // 我自己添加的比赛类型（每个用户独立）
}

function getCachedSettings() {
  const s = wx.getStorageSync(KEY_SETTINGS) || {}
  return {
    defaultType: s.defaultType || DEFAULT_SETTINGS.defaultType,
    defaultSpaceId: s.defaultSpaceId || '',
    customTypes: Array.isArray(s.customTypes) ? s.customTypes : []
  }
}

function cacheSettings(s) {
  wx.setStorageSync(KEY_SETTINGS, s)
  const app = getApp()
  if (app) app.globalData.settings = s
  return s
}

// 从后端拉取我的设置；没有文档（新用户）返回默认值，不报错
async function fetchUserSettings() {
  try {
    const r = await apiRequest('GET', '/api/settings')
    const s = mapSettings(r.settings)
    return cacheSettings(s)
  } catch (e) {
    // 网络失败：返回本地缓存（或默认值）
    return getCachedSettings()
  }
}

// 保存我的设置（patch 局部更新），先写本地再写后端
async function saveUserSettings(patch) {
  const next = Object.assign({}, getCachedSettings(), patch, { updatedAt: Date.now() })
  cacheSettings(next)
  const r = await apiRequest('PUT', '/api/settings', {
    defaultType: next.defaultType,
    defaultSpaceId: next.defaultSpaceId,
    customTypes: next.customTypes
  })
  return cacheSettings(mapSettings(r.settings))
}

// 添加一个自定义比赛类型（存进我的 user_settings，用户间互不影响）
async function addCustomType(name) {
  const n = String(name || '').trim().slice(0, 8)
  if (!n) throw new Error('类型名不能为空')
  const cur = getCachedSettings()
  if (cur.customTypes.indexOf(n) > -1) return cur          // 已添加过
  if (config.TYPES.some(t => t.key === n)) return cur      // 与内置类型重名
  if (cur.customTypes.length >= 10) throw new Error('自定义类型最多 10 个')
  return saveUserSettings({ customTypes: cur.customTypes.concat(n) })
}

module.exports = {
  apiRequest,
  ensureLogin,
  getOpenid,
  getCachedSpace,
  getCachedSpaces,
  fetchUserSpaces,
  cacheSpaces,
  cacheSpace,
  switchSpace,
  createSpace,
  joinSpace,
  updateSpace,
  getCachedRecords,
  fetchRecords,
  addRecord,
  updateRecord,
  deleteRecord,
  fetchMembers,
  memberOf,
  pairOf,
  getCachedSettings,
  fetchUserSettings,
  saveUserSettings,
  addCustomType
}
