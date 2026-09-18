// pages/index/index.js - 首页：谁更强 + 记一场 + 最近比赛
const app = getApp()
const db = require('../../utils/db')
const stats = require('../../utils/stats')
const util = require('../../utils/util')

Page({
  data: {
    hasSpace: false,
    loading: true,
    spaceName: '',
    me: '我',
    friend: '',
    meAvatar: '🐼',     // 我（创建者）的真实头像 emoji
    frAvatar: '🐨',     // 朋友的真实头像 emoji
    // 多朋友空间
    spaces: [],          // 选择弹层的空间列表
    spaceSheet: false,   // 选择朋友弹层
    // 战绩条
    total: 0,
    mWin: 0,
    fWin: 0,
    mRate: 0,
    leadText: '',
    // 最近比赛列表
    recent: []
  },

  onShow() {
    // 自定义 TabBar 高亮「首页」，并确保 TabBar 可见（弹框关闭后兜底恢复）
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0, hidden: false, spaceOn: !!app.globalData.space })
    }
    this.refresh()
  },

  // 弹框打开/关闭时隐藏/恢复自定义 TabBar（防止框架级图层盖住底部抽屉）
  _toggleTabBar(hidden) {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ hidden })
    }
  },

  onPullDownRefresh() {
    this.refresh().finally(() => wx.stopPullDownRefresh())
  },

  // 刷新：读全局状态 -> 渲染 -> 后台从云端拉最新数据覆盖
  async refresh() {
    let space = app.globalData.space
    // 当前空间为空：尝试从空间列表选默认/第一个；列表也空则从云端恢复（清缓存场景）
    if (!space || !space._id) {
      if (!(app.globalData.spaces || []).length) {
        try { await db.fetchUserSpaces() } catch (e) {}
      }
      const all = app.globalData.spaces || []
      if (all.length) {
        const settings = db.getCachedSettings()
        const target = (settings.defaultSpaceId && all.find(s => s._id === settings.defaultSpaceId)) || all[0]
        if (target) {
          app.globalData.space = target
          app.globalData.records = target.records || []
          space = target
        }
      }
    }
    if (!space || !space._id) {
      this.setData({
        hasSpace: false,
        loading: false,
        spaces: this.buildSpaceItems()
      })
      return
    }
    // 先用本地缓存秒开渲染
    this.render(app.globalData.space, app.globalData.records)
    this.setData({ hasSpace: true, loading: false, spaces: this.buildSpaceItems() })

    // 拉双方真实资料（nickname/avatar），拉完再刷新一次显示
    db.fetchMembers(space).then(() => {
      this.render(space, app.globalData.records)
      this.setData({ spaces: this.buildSpaceItems() })
    }).catch(() => {})

    // 再拉云端最新数据（朋友新增的比赛也会同步过来）
    try {
      const records = await db.fetchRecords(space._id)
      app.globalData.records = records
      this.render(space, records)
      this.setData({ spaces: this.buildSpaceItems() })
    } catch (e) {
      // 拉取失败时保留本地缓存，不打断使用
      console.warn('同步云端失败:', e.errMsg || e)
      wx.showToast({ title: '同步失败，显示本地数据', icon: 'none' })
    }
  },

  // 双方真实资料 helper（当前用户视角：me=当前登录用户）
  _pairOf(space) {
    return db.pairOf(space, app.globalData.openid)
  },

  // 选择弹层的空间列表项（默认空间置顶 + 标记，名称/头像取真实 users 资料）
  buildSpaceItems() {
    const settings = db.getCachedSettings()
    const order = (app.globalData.spaces || []).slice().sort((a, b) =>
      (a._id === settings.defaultSpaceId ? -1 : 0) - (b._id === settings.defaultSpaceId ? -1 : 0)
    )
    return order.map((s) => {
      const p = this._pairOf(s)
      return {
        _id: s._id,
        name: p.me + ' vs ' + p.friend,
        friendName: p.friend,
        count: (s.records || []).length,
        cur: !!(app.globalData.space && app.globalData.space._id === s._id),
        isDef: s._id === settings.defaultSpaceId,
        emoji: p.frAvatar,   // 弹层用朋友头像作空间标识
        inviteCode: s.inviteCode || ''
      }
    })
  },

  render(space, records) {
    const p = this._pairOf(space)
    const me = p.me
    const friend = p.friend
    // 比分转当前用户视角：me=当前用户，a=当前用户分（数据库存的是创建者视角，需翻转）
    const myRecords = (records || []).map(r => util.toMyView(r, p.isCreator))
    const st = stats.buildStats(myRecords)
    const recent = myRecords.slice(0, 5).map(r => ({
      _id: r._id,
      emoji: util.emojiOf(r.type),
      type: r.type,
      a: r.a,
      b: r.b,
      meName: me,
      friendName: friend,
      timeText: util.fmtTime(r.time),
      winner: r.winner,
      winnerText: stats.winnerText(r.winner, me, friend),
      winClass: r.winner === 'me' ? 'win' : r.winner === 'friend' ? 'lose' : 'draw',
      loc: r.loc || ''
    }))
    this.setData({
      spaceName: (me + ' & ' + friend),
      me,
      friend,
      meAvatar: p.meAvatar,
      frAvatar: p.frAvatar,
      total: st.n,
      mWin: st.m,
      fWin: st.f,
      mRate: Math.round(st.mRate),
      leadText: st.n === 0 ? '还没有比赛，来记一场吧'
        : st.m > st.f ? me + ' 暂时领先！'
        : st.f > st.m ? friend + ' 暂时领先！'
        : '势均力敌，加赛一场？',
      recent
    })
  },

  // 选择朋友弹层
  openSpaceSheet() {
    this._toggleTabBar(true)
    this.setData({ spaceSheet: true, spaces: this.buildSpaceItems() })
  },
  closeSpaceSheet() {
    this.setData({ spaceSheet: false })
    this._toggleTabBar(false)
  },
  noop() {},
  // 切换空间：切完直接进记录页（贴合「选好朋友直接记」）
  async pickSpace(e) {
    const id = e.currentTarget.dataset.id
    if (id === (app.globalData.space || {})._id) {
      this.setData({ spaceSheet: false })
      wx.navigateTo({ url: '/pages/record/record' })
      return
    }
    try {
      await db.switchSpace(id)
      this.setData({ spaceSheet: false })
      this.refresh()
      wx.navigateTo({ url: '/pages/record/record' })
    } catch (err) {
      wx.showToast({ title: '切换失败', icon: 'none' })
    }
  },

  // 设为默认空间（存云端 user_settings，每次启动优先进入）
  async setDefaultSpace(e) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    try {
      await db.saveUserSettings({ defaultSpaceId: id })
      this.setData({ spaces: this.buildSpaceItems() })
      wx.showToast({ title: '已设为默认空间', icon: 'none' })
    } catch (err) {
      console.error('设置默认空间失败:', err)
      wx.showToast({ title: '保存失败：' + (err.errMsg || err.message || '网络异常'), icon: 'none', duration: 2500 })
    }
  },

  // 空状态引导
  goJoin() {
    this.setData({ spaceSheet: false })
    this._toggleTabBar(false)
    wx.navigateTo({ url: '/pages/join/join' })
  },

  goRecord() {
    wx.navigateTo({ url: '/pages/record/record' })
  },

  goDetail(e) {
    wx.navigateTo({ url: '/pages/detail/detail?id=' + e.currentTarget.dataset.id })
  },

  goStats() {
    wx.switchTab({ url: '/pages/stats/stats' })
  }
})
