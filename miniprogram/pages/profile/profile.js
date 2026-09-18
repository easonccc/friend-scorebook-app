// pages/profile/profile.js - 个人资料：选头像 / 改昵称
const app = getApp()
const userService = require('../../services/user')
const config = require('../../utils/config')

Page({
  data: {
    nickname: '',
    avatar: 'avatar_01',
    avatarEmoji: '🐼',
    avatarList: config.AVATARS,   // 头像白名单（与云函数一致）
    role: 'user',
    saving: false
  },

  onShow() {
    // 每次进入刷新最新资料（不依赖 globalData.user 是否就绪）
    userService.get().then(r => {
      const u = r.user || {}
      this.setData({
        nickname: u.nickname || '我',
        avatar: u.avatar || 'avatar_01',
        avatarEmoji: this.emojiOf(u.avatar),
        role: u.role || 'user'
      })
      // 顺带同步到全局
      app.globalData.user = u
    }).catch(err => {
      wx.showToast({ title: err.message || '加载失败', icon: 'none' })
    })
  },

  emojiOf(key) {
    const hit = config.AVATARS.find(a => a.key === key)
    return hit ? hit.emoji : '🐼'
  },

  onNameInput(e) { this.setData({ nickname: e.detail.value }) },

  pickAvatar(e) {
    const key = e.currentTarget.dataset.key
    this.setData({ avatar: key, avatarEmoji: this.emojiOf(key) })
  },

  async save() {
    if (this.data.saving) return
    const nickname = (this.data.nickname || '').trim().slice(0, 8) || '我'
    this.setData({ saving: true })
    try {
      // 只传 nickname + avatar，role 不可改（云函数也不接受）
      const r = await userService.updateProfile({ nickname, avatar: this.data.avatar })
      // 同步全局态
      if (app.globalData.user) {
        app.globalData.user.nickname = nickname
        app.globalData.user.avatar = this.data.avatar
      }
      wx.showToast({ title: '已保存', icon: 'none' })
      setTimeout(() => wx.navigateBack({ delta: 1 }), 600)
    } catch (e) {
      wx.showToast({ title: e.message || '保存失败', icon: 'none', duration: 2500 })
    } finally {
      this.setData({ saving: false })
    }
  },

  goBack() {
    wx.navigateBack({ delta: 1 })
  }
})
