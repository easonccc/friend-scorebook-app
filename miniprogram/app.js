// app.js - 全局入口
// 职责：初始化云开发、获取用户 openid、加载本地缓存的比赛空间
const config = require('./utils/config')
const userService = require('./services/user')

App({
  globalData: {
    openid: '',          // 当前用户 openid（云函数返回）
    settings: null,      // 我的用户设置 { defaultType, defaultSpaceId, customTypes }
    spaces: [],          // 我参与的所有空间列表（每个 = 我 + 一个朋友，含 records 快照）
    space: null,         // 当前比赛空间 { _id, name, inviteCode, meName, friendName, members, creator }
    records: [],         // 当前空间的比赛记录（内存缓存，页面直接读）
    syncing: false       // 正在从云端拉取数据
  },

  onLaunch() {
    // 1. 初始化云开发。CLOUD_ENV 留空 = 使用小程序默认环境
    if (!wx.cloud) {
      console.error('当前基础库版本过低，请使用 2.2.3 以上版本以使用云能力')
      return
    }
    wx.cloud.init({
      env: config.CLOUD_ENV || undefined,
      traceUser: true
    })

    // 2. 取 openid + 恢复本地空间，并行进行
    this.restoreSession()
  },

  // 恢复登录态与本地缓存的空间（每次冷启动调用一次）
  async restoreSession() {
    const db = require('./utils/db')
    try {
      // 先取 openid（云函数），失败不阻塞页面
      db.ensureLogin().then(openid => {
        this.globalData.openid = openid
        // 初始化/获取用户资料（含 role，走 services/user.js）
        userService.init().then(r => {
          this.globalData.user = r.user
          console.log('[app] 当前用户:', r.user)
        }).catch(err => console.warn('[app] user.init 失败:', err.message || err))
      }).catch(err => {
        console.warn('获取 openid 失败（可能未登录/云环境未开通）:', err.errMsg || err)
      })

      // 恢复空间列表（多朋友）：每个空间附带各自的记录缓存
      const spaces = wx.getStorageSync('mySpaces') || []
      if (spaces.length) {
        // 本地有缓存：秒开渲染
        this.globalData.spaces = spaces.map(s => Object.assign({}, s, {
          records: wx.getStorageSync('records:' + s._id) || []
        }))
      } else {
        // 本地无缓存（清缓存/换设备）：从云端恢复空间列表
        db.fetchUserSpaces().then(list => {
          this.globalData.spaces = list.map(s => Object.assign({}, s, {
            records: wx.getStorageSync('records:' + s._id) || []
          }))
          // 选默认/第一个空间并拉取记录
          const s = db.getCachedSettings()
          const target = (s.defaultSpaceId && list.find(x => x._id === s.defaultSpaceId)) || list[0] || null
          if (target) {
            this.globalData.space = target
            this.globalData.records = target.records || []
            db.fetchRecords(target._id).then(records => {
              this.globalData.records = records
              target.records = records
            }).catch(() => {})
          }
        }).catch(err => console.warn('云端恢复空间失败:', err.errMsg || err))
      }

      // 恢复我的用户设置（默认类型 / 默认空间 / 自定义类型），并后台刷新云端最新
      this.globalData.settings = db.getCachedSettings()
      db.fetchUserSettings().then(s => {
        this.globalData.settings = s
      }).catch(() => {})

      // 恢复当前空间：优先「默认朋友空间」，没有默认（或默认空间已不在列表）再用上次的
      const settings = this.globalData.settings
      const cached = wx.getStorageSync('currentSpace')
      const preferId = settings.defaultSpaceId
      const hasDefault = preferId && this.globalData.spaces.some(s => s._id === preferId)
      const targetId = hasDefault ? preferId : (cached && cached._id)
      const target = targetId ? this.globalData.spaces.find(s => s._id === targetId) : null
      if (target) {
        this.globalData.space = target
        this.globalData.records = target.records
      } else if (cached && cached._id) {
        this.globalData.space = cached
        this.globalData.records = wx.getStorageSync('records:' + cached._id) || []
      }
    } catch (e) {
      console.warn('恢复本地会话失败:', e)
    }
  },

  // 切到指定空间：更新全局态 + 写本地缓存 + 同步空间列表
  setSpace(space) {
    this.globalData.space = space
    wx.setStorageSync('currentSpace', space)
    // 更新/追加到空间列表
    const list = this.globalData.spaces
    const i = list.findIndex(s => s._id === space._id)
    const item = Object.assign({}, space, { records: space.records || this.globalData.records })
    if (i > -1) list[i] = item
    else list.unshift(item)
    this.globalData.spaces = list
    wx.setStorageSync('mySpaces', list)
  },

  // 更新内存中的双人名字（改名后全局即时生效，持久化由 db.updateSpace 负责）
  setNames(playerAName, playerBName) {
    if (!this.globalData.space) return
    this.globalData.space.playerAName = playerAName
    this.globalData.space.playerBName = playerBName
    wx.setStorageSync('currentSpace', this.globalData.space)
    // 同步到空间列表中的对应项
    const list = this.globalData.spaces
    const i = list.findIndex(s => s._id === this.globalData.space._id)
    if (i > -1) {
      list[i].playerAName = playerAName
      list[i].playerBName = playerBName
      wx.setStorageSync('mySpaces', list)
    }
  }
})
