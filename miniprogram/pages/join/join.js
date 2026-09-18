// pages/join/join.js - 创建空间 / 加入空间
// 从分享卡片进来时，onLoad 会收到 ?code=XXX 自动预填
const app = getApp()
const db = require('../../utils/db')
const userService = require('../../services/user')

Page({
  data: {
    // 创建（多朋友：只需给新朋友起个名字，我的名字沿用当前设置）
    friendName: '',
    meName: '我',  // 当前用户昵称，用于创建空间提示文案
    // 加入
    code: '',
    creating: false,
    joining: false
  },

  onLoad(options) {
    if (options.code) {
      this.setData({ code: options.code.trim().toUpperCase() })
    }
  },

  onShow() {
    // 刷新当前用户昵称用于提示文案（不依赖 globalData.user 是否就绪），与 profile 页一致
    userService.get().then(r => {
      const u = r.user || {}
      this.setData({ meName: u.nickname || '我' })
      app.globalData.user = u
    }).catch(() => {
      this.setData({ meName: (app.globalData.user && app.globalData.user.nickname) || '我' })
    })
  },

  // 新朋友名字
  onNameInput(e) { this.setData({ friendName: e.detail.value }) },
  onCodeInput(e) { this.setData({ code: e.detail.value.trim().toUpperCase() }) },

  async onCreate() {
    if (this.data.creating) return
    // meName 由 onShow 从 users 表同步到 this.data.meName
    const meName = this.data.meName || '我'
    const friendName = (this.data.friendName || '').trim().slice(0, 8) || '小晗子'
    const name = meName + ' & ' + friendName

    this.setData({ creating: true })
    wx.showLoading({ title: '创建中…', mask: true })
    try {
      const space = await db.createSpace({ name, playerAName: meName, playerBName: friendName })
      // 第一个空间自动设为默认空间（每次启动直接进入）
      if (!db.getCachedSettings().defaultSpaceId) {
        db.saveUserSettings({ defaultSpaceId: space._id }).catch(() => {})
      }
      wx.hideLoading()
      wx.showToast({ title: '🎉 空间建好啦！', icon: 'none' })
      setTimeout(() => wx.switchTab({ url: '/pages/index/index' }), 800)
    } catch (e) {
      wx.hideLoading()
      console.error('创建失败:', e)
      wx.showToast({ title: '创建失败：' + (e.errMsg || e.message || '网络异常'), icon: 'none', duration: 2500 })
    } finally {
      this.setData({ creating: false })
    }
  },

  async onJoin() {
    if (this.data.joining) return
    const code = this.data.code
    if (code.length !== 6) {
      wx.showToast({ title: '邀请码是 6 位，再核对下？', icon: 'none' })
      return
    }
    this.setData({ joining: true })
    wx.showLoading({ title: '加入中…', mask: true })
    try {
      const space = await db.joinSpace(code)
      // 第一个空间自动设为默认空间
      if (!db.getCachedSettings().defaultSpaceId) {
        db.saveUserSettings({ defaultSpaceId: space._id }).catch(() => {})
      }
      wx.hideLoading()
      wx.showToast({ title: '🎉 加入成功！', icon: 'none' })
      setTimeout(() => wx.switchTab({ url: '/pages/index/index' }), 800)
    } catch (e) {
      wx.hideLoading()
      console.error('加入失败:', e)
      wx.showToast({ title: '加入失败：' + (e.msg || e.message || '邀请码不存在'), icon: 'none', duration: 2500 })
    } finally {
      this.setData({ joining: false })
    }
  },

  // 分享自己的空间（如果有）
  onShareAppMessage() {
    const code = (app.globalData.space || {}).inviteCode
    return {
      title: '🎱 来加入我们的比赛空间，一起记战绩！',
      path: '/pages/join/join' + (code ? '?code=' + code : '')
    }
  },

  goBack() {
    wx.navigateBack({ delta: 1 })
  }
})
