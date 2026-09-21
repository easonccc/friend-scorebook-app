// pages/settings/settings.js - 设置：人物（当前空间）/ 默认比赛类型 / 我的比赛空间 / 邀请分享
// 多朋友扩展：空间列表支持切换 + 设为默认空间（存云端 user_settings，换设备也在）
const app = getApp()
const db = require('../../utils/db')
const util = require('../../utils/util')
const config = require('../../utils/config')
const userService = require('../../services/user')

Page({
  data: {
    hasSpace: false,
    meName: '我',
    friendName: '小晗子',
    meAvatar: '🐼',       // 当前空间「我」的真实头像
    frAvatar: '🐨',       // 当前空间「朋友」的真实头像
    inviteCode: '',
    spaceItems: [],        // 我的空间列表 [{ id, name, sub, cur, isDef }]
    saving: false,
    // 默认比赛类型（存云端 user_settings）
    defaultType: '台球',
    defaultTypeEmoji: '🎱',
    typeSheet: false,      // 类型选择弹层
    typeOptions: [],        // 内置 + 我的自定义类型 + 自定义入口
    // 当前登录用户（资料 + 管理员判断）
    isAdmin: false,
    nickname: '我',
    avatarEmoji: '🐼'
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 3, hidden: false, spaceOn: !!(app.globalData.space) })
    }
    this.load()
    this.syncUser()
    // 刷新当前空间双方资料（朋友改了名字/头像后这里能拿到最新）
    const space = app.globalData.space
    if (space && space._id) {
      db.fetchMembers(space).then(() => this.load()).catch(() => {})
    }
    // 后台刷新云端设置（换设备后默认类型/自定义类型同步过来）
    db.fetchUserSettings().then(() => this.load()).catch(() => {})
  },

  // 同步当前用户资料（含 role，用于显示管理员入口）
  syncUser() {
    const apply = (u) => {
      if (!u) return
      app.globalData.user = u
      this.setData({
        isAdmin: u.role === 'admin',
        nickname: u.nickname || '我',
        avatarEmoji: this.avatarEmoji(u.avatar)
      })
    }
    apply(app.globalData.user)
    // 兜底：全局还没就绪时主动拉一次
    userService.get().then(r => apply(r.user)).catch(() => {})
  },

  avatarEmoji(key) {
    const hit = config.AVATARS.find(a => a.key === key)
    return hit ? hit.emoji : '🐼'
  },

  goProfile() {
    wx.navigateTo({ url: '/pages/profile/profile' })
  },

  goUserList() {
    wx.navigateTo({ url: '/pages/user-list/user-list' })
  },

  // 弹框打开/关闭时隐藏/恢复自定义 TabBar（防止框架级图层盖住底部抽屉）
  _toggleTabBar(hidden) {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ hidden })
    }
  },

  // 双方真实资料 helper（当前用户视角：me=当前登录用户）
  _pairOf(space) {
    return db.pairOf(space, app.globalData.openid)
  },

  load() {
    const space = app.globalData.space
    const spaces = app.globalData.spaces || []
    const settings = db.getCachedSettings()

    // 空间列表：默认空间置顶，其余保持原顺序
    const order = spaces.slice().sort((a, b) =>
      (a._id === settings.defaultSpaceId ? -1 : 0) - (b._id === settings.defaultSpaceId ? -1 : 0)
    )
    const spaceItems = order.map(s => {
      const p = this._pairOf(s)
      const n = (s.records || []).length
      return {
        id: s._id,
        name: p.me + ' vs ' + p.friend,
        sub: (n ? n + ' 场战绩' : '还没有记录') + ' · 邀请码 ' + (s.inviteCode || '——'),
        cur: !!space && s._id === space._id,
        isDef: s._id === settings.defaultSpaceId,
        meAvatar: p.meAvatar,
        frAvatar: p.frAvatar
      }
    })

    const cur = this._pairOf(space)
    this.setData({
      spaceItems,
      hasSpace: !!space && !!space._id,
      meName: cur.me,
      friendName: cur.friend,
      meAvatar: cur.meAvatar,
      frAvatar: cur.frAvatar,
      inviteCode: (space && space.inviteCode) || '',
      defaultType: settings.defaultType || '台球',
      defaultTypeEmoji: util.emojiOf(settings.defaultType || '台球'),
      typeOptions: util.typeList(settings.customTypes)
    })
  },

  onMeInput(e) { this.setData({ meName: e.detail.value }) },
  onFrInput(e) { this.setData({ friendName: e.detail.value }) },

  // 保存双人名字（改的是当前空间）：云端更新 + 全局即时生效
  async saveNames() {
    if (this.data.saving) return
    const meName = (this.data.meName || '').trim().slice(0, 8) || '我'
    const friendName = (this.data.friendName || '').trim().slice(0, 8) || '小晗子'
    if (!app.globalData.space) return
    // 数据模型约定：playerAName=创建者名、playerBName=朋友名（创建者视角）。
    // 非创建者编辑时，要把界面上的「我/朋友」映射到正确的 A/B，否则会污染创建者视角的兜底名。
    const isCreator = util.isCreatorOf(app.globalData.space, app.globalData.openid || db.getOpenid())
    const aName = isCreator ? meName : friendName
    const bName = isCreator ? friendName : meName
    this.setData({ saving: true })
    try {
      await db.updateSpace({ playerAName: aName, playerBName: bName })
      app.setNames(aName, bName)
      this.setData({ meName, friendName })
      wx.showToast({ title: '名字已同步', icon: 'none' })
      this.load()
    } catch (e) {
      console.error('改名失败:', e)
      wx.showToast({ title: '保存失败：' + (e.errMsg || e.message || '网络异常'), icon: 'none', duration: 2500 })
    } finally {
      this.setData({ saving: false })
    }
  },

  /* ---------- 默认比赛类型 ---------- */
  openTypeSheet() {
    this._toggleTabBar(true)
    const settings = db.getCachedSettings()
    this.setData({ typeSheet: true, typeOptions: util.typeList(settings.customTypes) })
  },
  closeTypeSheet() {
    this.setData({ typeSheet: false })
    this._toggleTabBar(false)
  },
  noop() {},

  // 选一个类型设为默认（写云端 user_settings，新开记录默认用它）
  async pickDefaultType(e) {
    const t = e.currentTarget.dataset.type
    if (t === '自定义') {
      // 新类型：存进我的自定义类型列表，并设为默认（只有我可见，不影响朋友）
      wx.showModal({
        title: '自定义比赛',
        editable: true,
        placeholderText: '比如：飞镖 / 保龄球',
        success: async res => {
          if (!res.confirm || !res.content || !res.content.trim()) return
          const name = res.content.trim().slice(0, 8)
          try {
            await db.addCustomType(name)
            await this.applyDefaultType(name)
          } catch (err) {
            console.error('添加自定义类型失败:', err)
            wx.showToast({ title: err.message || '保存失败', icon: 'none' })
          }
        }
      })
      return
    }
    this.applyDefaultType(t)
  },

  async applyDefaultType(t) {
    try {
      await db.saveUserSettings({ defaultType: t })
      this.setData({ typeSheet: false })
      this._toggleTabBar(false)
      this.load()
      wx.showToast({ title: '已设为默认：' + t, icon: 'none' })
    } catch (e) {
      console.error('设置默认类型失败:', e)
      wx.showToast({ title: '保存失败：' + (e.errMsg || e.message || '网络异常'), icon: 'none', duration: 2500 })
    }
  },

  /* ---------- 空间列表 ---------- */
  // 切换当前空间（列表点击）
  async pickSpace(e) {
    const id = e.currentTarget.dataset.id
    if (!id || id === (app.globalData.space || {})._id) return
    wx.showLoading({ title: '切换中' })
    try {
      await db.switchSpace(id)
      this.load()
      wx.showToast({ title: '已切换到该空间', icon: 'none' })
    } catch (err) {
      console.error('切换失败:', err)
      wx.showToast({ title: '切换失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },

  // 设为默认空间（存云端，每次启动优先进入这个空间）
  async setDefaultSpace(e) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    try {
      await db.saveUserSettings({ defaultSpaceId: id })
      this.load()
      wx.showToast({ title: '已设为默认空间', icon: 'none' })
    } catch (err) {
      console.error('设置默认空间失败:', err)
      wx.showToast({ title: '保存失败：' + (err.errMsg || err.message || '网络异常'), icon: 'none', duration: 2500 })
    }
  },

  copyCode() {
    wx.setClipboardData({
      data: this.data.inviteCode,
      success: () => wx.showToast({ title: '邀请码已复制', icon: 'none' })
    })
  },

  goJoin() {
    wx.navigateTo({ url: '/pages/join/join' })
  },

  // 分享卡片：带上当前空间邀请码，朋友点开直达加入页
  onShareAppMessage() {
    const code = this.data.inviteCode
    return {
      title: '🎱 来加入我们的比赛空间，一起记战绩！',
      path: '/pages/join/join' + (code ? '?code=' + code : '')
    }
  }
})
