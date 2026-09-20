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
        // 昵称为空时【留空】，让输入框显示「点这里可一键填入微信昵称」的引导，
        // 而不是预填「我」——否则用户以为昵称已设置，不会去点框触发微信昵称填充
        nickname: u.nickname || '',
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

  // 微信昵称一键填入（input type=nickname 官方回调）。
  // 坑：微信在受控 input 上「使用微信昵称」回填的昵称【不会可靠同步】到 setData 变量
  // （开发者工具/部分机型 e.detail.nickname 为空），这里只做显示兜底，
  // 真正可靠的值以 save 时从 input 真实读取为准（见 readInputValue）。
  onNickname(e) {
    const n = (e.detail && e.detail.nickname) || ''
    if (n) this.setData({ nickname: n })
  },

  // 失焦兜底：从 input 真实 DOM 读当前值，覆盖受控不同步导致的旧值
  onNicknameBlur() {
    this.readInputValue('#nickname-input').then(v => { if (v) this.setData({ nickname: v }) })
  },

  // 用 createSelectorQuery 读取 input 当前真实值（兼容 bindnickname 受控不同步问题）
  readInputValue(id) {
    return new Promise((resolve) => {
      wx.createSelectorQuery().in(this)
        .select(id)
        .fields({ properties: ['value'] })
        .exec((res) => {
          const v = (res && res[0] && res[0].value) || ''
          resolve(v)
        })
    })
  },

  pickAvatar(e) {
    const key = e.currentTarget.dataset.key
    this.setData({ avatar: key, avatarEmoji: this.emojiOf(key) })
  },

  async save() {
    if (this.data.saving) return
    // 关键修复：从 input 真实读取最新值，避免 bindnickname 受控不同步导致传旧值（"传参没变"的根因）
    const real = await this.readInputValue('#nickname-input')
    const nickname = (real || this.data.nickname || '').trim()
    if (!nickname) {
      wx.showToast({ title: '昵称不能为空', icon: 'none' })
      return
    }
    if (nickname.length > 32) {
      wx.showToast({ title: '昵称最多 32 字', icon: 'none' })
      return
    }
    this.setData({ saving: true, nickname })
    try {
      // 只传 nickname + avatar，role 不可改（后端也不接受，防越权）
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
  },

  // 管理员入口：跳转到用户管理列表（入口仅在 role===admin 时显示）
  goAdmin() {
    wx.navigateTo({ url: '/pages/user-list/user-list' })
  }
})
