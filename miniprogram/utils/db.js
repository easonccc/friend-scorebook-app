// utils/db.js - 数据层：云数据库 + 本地缓存 双写
//
// 设计思路（为什么这样写）：
// 1. 一切比赛记录都挂在「比赛空间」下，空间是共享数据的边界。
// 2. 云数据库是唯一事实来源（true source），本地 wx.setStorageSync 只是缓存，
//    保证打开 App 时秒开、离线也能看，网络恢复后再同步。
// 3. 空间相关写操作（创建/加入/改名）走云函数，因为要生成唯一邀请码、
//    做服务端校验；比赛记录的增删改直接走客户端数据库（配合安全规则控制权限）。
const config = require('./config')
const stats = require('./stats')
const util = require('./util')

const KEY_SPACE = 'currentSpace'
const KEY_SPACES = 'mySpaces'          // 我参与的所有空间列表
const KEY_OPENID = 'myOpenid'
const keyRecords = spaceId => 'records:' + spaceId

/* ---------- 云函数调用封装 ---------- */
function callFn(name, data) {
  return wx.cloud.callFunction({ name, data }).then(res => {
    const r = res.result
    if (r && r.ok === false) {
      const err = new Error(r.msg || '操作失败')
      err.code = r.code
      throw err
    }
    return r
  })
}

/* ---------- 用户身份 ---------- */
let openidPromise = null
// 取当前用户 openid（登录云函数），结果缓存，避免重复调用
function ensureLogin() {
  if (openidPromise) return openidPromise
  const cached = wx.getStorageSync(KEY_OPENID)
  if (cached) {
    openidPromise = Promise.resolve(cached)
    return openidPromise
  }
  openidPromise = callFn('login').then(r => {
    if (!r || !r.openid) throw new Error('未获取到 openid')
    wx.setStorageSync(KEY_OPENID, r.openid)
    return r.openid
  }).catch(e => {
    openidPromise = null // 失败允许重试
    throw e
  })
  return openidPromise
}

function getOpenid() {
  return wx.getStorageSync(KEY_OPENID) || ''
}

/* ---------- 比赛空间 ---------- */
function getCachedSpace() {
  return wx.getStorageSync(KEY_SPACE) || null
}

// 我参与的所有空间列表（多朋友：每个空间 = 我 + 一个朋友）
function getCachedSpaces() {
  return wx.getStorageSync(KEY_SPACES) || []
}

// 从云端拉取当前用户参与的所有空间（清缓存/换设备后本地空时恢复用）
// 写入本地缓存 + 同步到 globalData（records 用本地缓存，可能为空）
async function fetchUserSpaces() {
  const r = await callFn('getSpaces', {})
  const list = r.spaces || []
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
    const r = await callFn('user', { action: 'getMembers', openids: space.members })
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
  const meUser = memberOf(space, openid)
  const friendOpenid = (space && space.members || []).find(m => m !== openid)
  const frUser = memberOf(space, friendOpenid)
  const creatorView = util.isCreatorOf(space, openid)
  const aName = space && (space.playerAName != null ? space.playerAName : space.meName)
  const bName = space && (space.playerBName != null ? space.playerBName : space.friendName)
  return {
    isCreator: creatorView,
    me: (meUser && meUser.nickname) || (creatorView ? aName : bName) || '我',
    friend: (frUser && frUser.nickname) || (creatorView ? bName : aName) || '朋友',
    meAvatar: util.avatarEmojiOf(meUser && meUser.avatar),
    frAvatar: util.avatarEmojiOf(frUser && frUser.avatar)
  }
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

// 创建空间（云函数：服务端生成唯一邀请码）
async function createSpace({ name, playerAName, playerBName }) {
  const r = await callFn('createSpace', { name, playerAName, playerBName })
  return cacheSpace(r.space)
}

// 加入空间（云函数：服务端校验邀请码 + 把自己加进 members）
async function joinSpace(inviteCode) {
  const r = await callFn('joinSpace', { inviteCode })
  return cacheSpace(r.space)
}

// 更新双人名字（云函数：服务端校验成员身份后更新空间）
async function updateSpace({ playerAName, playerBName }) {
  const space = getCachedSpace()
  if (!space || !space._id) throw new Error('当前没有比赛空间')
  const r = await callFn('updateSpace', { spaceId: space._id, playerAName, playerBName })
  return cacheSpace(r.space)
}

/* ---------- 比赛记录 ----------
 * 增删改查全部走 record 云函数（match_records 集合安全规则全 false，
 * 客户端不能直连，成员校验在云函数里做）。本地缓存仍保留，保证秒开/离线可看。
 */
function getCachedRecords(spaceId) {
  return wx.getStorageSync(keyRecords(spaceId)) || []
}

// 从云端拉取该空间全部记录，写入缓存后返回
async function fetchRecords(spaceId) {
  const r = await callFn('record', { action: 'list', spaceId })
  const list = r.list || []
  wx.setStorageSync(keyRecords(spaceId), list)
  touchSpaceRecords(spaceId, list)
  return list
}

// 新增一场比赛：云函数校验成员后写入，成功再更新本地缓存
async function addRecord({ spaceId, type, time, loc, duration, a, b }) {
  const r = await callFn('record', { action: 'add', spaceId, type, time, loc, duration, a, b })
  const record = r.record
  const list = getCachedRecords(spaceId)
  list.unshift(record)
  wx.setStorageSync(keyRecords(spaceId), list)
  touchSpaceRecords(spaceId, list)
  return record
}

// 更新一场比赛：云函数校验成员后修改，再同步本地缓存
async function updateRecord(spaceId, id, { type, time, loc, duration, a, b }) {
  const r = await callFn('record', { action: 'update', spaceId, id, type, time, loc, duration, a, b })
  const patch = r.patch
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
  await callFn('record', { action: 'delete', spaceId, id })
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
 * 1. user_settings 集合一条文档 = 一个用户，_id 直接用 openid（天然唯一，绝不重复）。
 * 2. 安全规则 "auth.openid == doc._id"：每个用户只能读写自己的文档，
 *    所以「自定义比赛类型」按用户隔离 —— 朋友添加的类型不会出现在我的类型列表里。
 * 3. 云端为唯一事实来源 + 本地缓存（与比赛记录同一套思路）。
 * 4. 结构简单（就三个字段），直接用 doc.set 全量写入，不需要云函数。
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

// 从云端拉取我的设置；没有文档（新用户）返回默认值，不报错
async function fetchUserSettings() {
  try {
    const openid = await ensureLogin()
    const db = wx.cloud.database()
    const res = await db.collection(config.DB.settings).doc(openid).get()
    const raw = res.data || {}
    return cacheSettings({
      defaultType: raw.defaultType || DEFAULT_SETTINGS.defaultType,
      defaultSpaceId: raw.defaultSpaceId || '',
      customTypes: Array.isArray(raw.customTypes) ? raw.customTypes : []
    })
  } catch (e) {
    // 文档不存在 / 网络失败：返回本地缓存（或默认值）
    return getCachedSettings()
  }
}

// 保存我的设置（patch 局部更新，云端全量 set），先写本地再写云端
async function saveUserSettings(patch) {
  const next = Object.assign({}, getCachedSettings(), patch, { updatedAt: Date.now() })
  cacheSettings(next)
  const openid = await ensureLogin()
  const db = wx.cloud.database()
  await db.collection(config.DB.settings).doc(openid).set({ data: next })
  return next
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
