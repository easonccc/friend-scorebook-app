// pages/stats/stats.js - 统计：总战绩 / 胜率 / 趋势 / 比分 / 类型明细 / 每次比赛
// 多朋友扩展：顶部朋友筛选（全部朋友 / 具体朋友）+ 类型筛选，
// 所有卡片与比赛列表按两级筛选同步重算；「全部朋友」时合并所有空间记录。
const app = getApp()
const db = require('../../utils/db')
const statsUtil = require('../../utils/stats')
const util = require('../../utils/util')

Page({
  data: {
    // 朋友筛选：'全部' = 所有空间合并；否则为具体 spaceId
    friendFilter: '全部',
    friendFilters: [],        // [{ id: '全部', name: '全部朋友' }, { id: spaceId, name: 朋友名 }, ...]
    // 类型筛选
    filter: '全部',
    filters: ['全部'],
    meName: '我',
    friendName: '小晗子',
    hasSpace: false,
    // 总战绩
    n: 0, m: 0, f: 0, d: 0,
    // 胜率
    mRate: 0, fRate: 0, dRate: 0,
    // 最近 10 场
    rM: 0, rF: 0,
    trend: [],
    // 比分
    myPts: 0, frPts: 0, myAvg: '0.0', frAvg: '0.0',
    // 类型明细
    types: [],
    // 每次比赛列表（倒序，最新在前）
    matchList: [],
    leadText: ''
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 2, hidden: false, spaceOn: !!(app.globalData.space) })
    }
    this.render()
    // 刷新所有空间双方资料（朋友改名后能拿到最新），拉完再渲染一次
    const spaces = app.globalData.spaces || []
    if (spaces.length) {
      Promise.all(spaces.filter(s => s._id).map(s => db.fetchMembers(s).catch(() => {})))
        .then(() => this.render()).catch(() => {})
    }
  },

  async onPullDownRefresh() {
    // 下拉刷新：把当前筛选对应的空间都同步一遍云端
    try {
      const ids = this.pickSpaceIds()
      for (const sid of ids) {
        await db.fetchRecords(sid)
      }
    } catch (e) {
      console.warn('同步云端失败:', e.errMsg || e)
    }
    this.render()
    wx.stopPullDownRefresh()
  },

  // 当前朋友筛选命中的空间 id 列表
  pickSpaceIds() {
    const spaces = app.globalData.spaces || []
    if (this.data.friendFilter === '全部') return spaces.map(s => s._id)
    return spaces.filter(s => s._id === this.data.friendFilter).map(s => s._id)
  },

  // 按朋友筛选 + 类型筛选取记录；每条标注 _sid 便于跨空间定位
  filteredRecords() {
    const spaces = app.globalData.spaces || []
    const wantAll = this.data.friendFilter === '全部'
    let list = []
    spaces.forEach(s => {
      if (!wantAll && s._id !== this.data.friendFilter) return
      const rs = s.records || []
      rs.forEach(r => list.push(Object.assign({ _sid: s._id }, r)))
    })
    if (this.data.filter !== '全部') {
      list = list.filter(r => r.type === this.data.filter)
    }
    // 统一按时间倒序（最新在前），供统计与列表使用
    list.sort((x, y) => (y.time || 0) - (x.time || 0))
    return list
  },

  // 双方真实资料 helper（当前用户视角：me=当前登录用户）
  _pairOf(space) {
    return db.pairOf(space, app.globalData.openid)
  },

  render() {
    const spaces = app.globalData.spaces || []
    const current = app.globalData.space || {}
    const myOpenid = app.globalData.openid
    const curPair = this._pairOf(current)
    const meName = curPair.me

    // 每个空间「当前用户是否创建者」，用于比分视角转换
    const creatorOf = {}
    spaces.forEach(s => { creatorOf[s._id] = util.isCreatorOf(s, myOpenid) })

    // 朋友筛选 chips：全部朋友 + 每个空间（以对手真实名区分）
    const friendFilters = [{ id: '全部', name: '全部朋友' }].concat(
      spaces.map(s => ({ id: s._id, name: this._pairOf(s).friend }))
    )
    let friendFilter = this.data.friendFilter
    if (!friendFilters.some(f => f.id === friendFilter)) friendFilter = '全部'

    // 没有空间时只展示空态
    if (!spaces.length) {
      this.setData({ hasSpace: false, friendFilters })
      return
    }

    // 若筛选值被修正过，先写回，filteredRecords 直接读 this.data
    if (friendFilter !== this.data.friendFilter) {
      this.setData({ friendFilter })
    }

    // 先按朋友筛选取全部记录，用于推导类型 chips 与类型筛选修正
    const byFriend = this.filteredRecords()
    const typeSet = {}
    byFriend.forEach(r => { typeSet[r.type || '台球'] = true })
    const filters = ['全部'].concat(Object.keys(typeSet))
    let filter = this.data.filter
    if (filters.indexOf(filter) === -1) filter = '全部'
    if (filter !== this.data.filter) {
      this.setData({ filter })
    }

    // 朋友筛选 + 类型筛选都确定后，再取最终列表，并转成当前用户视角
    const list = this.filteredRecords().map(r => util.toMyView(r, creatorOf[r._sid]))

    const st = statsUtil.buildStats(list)

    // 金额统计展示值：净输赢随正负翻转文案与颜色
    const net = st.netAmount
    const netText = (net >= 0 ? '+¥' : '-¥') + Math.abs(net).toFixed(2)
    const netLabel = net > 0 ? '我净赚' : net < 0 ? '我净亏' : '持平'
    const netCls = net > 0 ? 'pos' : net < 0 ? 'neg' : 'zero'
    const myWinAmountText = '¥' + st.myWinAmount.toFixed(2)
    const frWinAmountText = '¥' + st.frWinAmount.toFixed(2)

    // 最近 10 场（list 已是倒序，取前 10 再正序展示）
    const recent = list.slice(0, 10).reverse()
    let rM = 0, rF = 0
    recent.forEach(r => {
      if (r.winner === 'me') rM++
      else if (r.winner === 'friend') rF++
    })

    // 每个空间的对手真实名（用于跨空间合并时给每条记录标注对手）
    const friendMap = {}
    spaces.forEach(s => { friendMap[s._id] = this._pairOf(s).friend })
    const matchList = list.slice(0, 30).map(r => {
      const frName = friendMap[r._sid] || '朋友'
      // 单场金额回显：赢家方向标注 +¥ / -¥，平局仅显示金额
      let amountText = ''
      let amountCls = ''
      if (r.amount != null && !isNaN(Number(r.amount))) {
        const amt = Number(r.amount)
        if (r.winner === 'me') { amountText = '我赢 +¥' + amt.toFixed(2); amountCls = 'pos' }
        else if (r.winner === 'friend') { amountText = '朋友赢 -¥' + amt.toFixed(2); amountCls = 'neg' }
        else { amountText = '¥' + amt.toFixed(2); amountCls = 'zero' }
      }
      return {
        _id: r._id,
        sid: r._sid,
        emoji: util.emojiOf(r.type),
        type: r.type,
        a: r.a,
        b: r.b,
        friendName: frName,
        timeText: util.fmtTime(r.time),
        winText: statsUtil.winnerText(r.winner, meName, frName),
        cls: r.winner === 'me' ? 'me' : r.winner === 'friend' ? 'fr' : 'dr',
        amountText,
        amountCls
      }
    })

    const friendName = curPair.friend
    const leadOpponent = friendFilter === '全部' ? '朋友们' : friendName

    this.setData({
      hasSpace: true,
      friendFilters,
      friendFilter,
      filters,
      filter,
      meName,
      friendName,
      n: st.n, m: st.m, f: st.f, d: st.d,
      mRate: st.mRate.toFixed(1),
      fRate: st.fRate.toFixed(1),
      dRate: st.dRate.toFixed(1),
      rM, rF,
      trend: recent.map((r, i) => ({
        i,
        cls: r.winner === 'me' ? 'me' : r.winner === 'friend' ? 'fr' : 'dr'
      })),
      myPts: st.myPts, frPts: st.frPts,
      myAvg: st.myAvg.toFixed(1),
      frAvg: st.frAvg.toFixed(1),
      amountGames: st.amountGames,
      netText, netLabel, netCls,
      myWinAmountText, frWinAmountText,
      types: st.types.map(t => Object.assign({}, t, {
        emoji: util.emojiOf(t.type),
        rateText: Math.round(t.mRate) + '%'
      })),
      matchList,
      leadText: st.n === 0 ? '还没有比赛，来记一场吧'
        : st.m > st.f ? meName + ' 暂时领先！'
        : st.f > st.m ? leadOpponent + ' 暂时领先！'
        : '势均力敌，加赛一场？'
    })
  },

  pickFriendFilter(e) {
    this.setData({ friendFilter: e.currentTarget.dataset.id })
    this.render()
  },

  pickFilter(e) {
    this.setData({ filter: e.currentTarget.dataset.f })
    this.render()
  },

  // 点击比赛列表进详情：先切到该记录所属空间，再打开详情
  async goDetail(e) {
    const { id, sid } = e.currentTarget.dataset
    if (!id) return
    if (sid && sid !== (app.globalData.space || {})._id) {
      try {
        await db.switchSpace(sid)
      } catch (err) {
        wx.showToast({ title: '切换空间失败', icon: 'none' })
        return
      }
    }
    wx.navigateTo({ url: '/pages/detail/detail?id=' + id })
  },

  goRecord() {
    wx.navigateTo({ url: '/pages/record/record' })
  },

  goJoin() {
    wx.navigateTo({ url: '/pages/join/join' })
  }
})
