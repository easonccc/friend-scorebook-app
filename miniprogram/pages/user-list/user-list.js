// pages/user-list/user-list.js - 管理员：查看普通用户
const userService = require('../../services/user')
const config = require('../../utils/config')
const app = getApp()

Page({
  data: {
    list: [],
    loading: true
  },

  onShow() {
    this.load()
  },

  async load() {
    try {
      const r = await userService.listUsers()
      const myOpenid = app.globalData.openid
      const list = (r.list || []).map(u => {
        const hit = config.AVATARS.find(a => a.key === u.avatar)
        return {
          _id: u._id,
          nickname: u.nickname || '我',
          emoji: hit ? hit.emoji : '🐼',
          role: u.role || 'user',
          openidTail: (u.openid || '').slice(-6),
          isMe: u.openid === myOpenid
        }
      })
      this.setData({ list, loading: false })
    } catch (e) {
      // 非管理员会被云函数拒绝（NO_PERM），这里兜底提示
      this.setData({ loading: false })
      wx.showToast({ title: e.message || '无权查看', icon: 'none', duration: 2500 })
    }
  },

  goBack() {
    wx.navigateBack({ delta: 1 })
  }
})
