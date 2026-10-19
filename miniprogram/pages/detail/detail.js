// pages/detail/detail.js - 比赛详情：查看 / 编辑 / 删除
const app = getApp()
const db = require('../../utils/db')
const stats = require('../../utils/stats')
const util = require('../../utils/util')

Page({
  data: {
    id: '',
    exists: false,
    meName: '我',
    friendName: '小晗子',
    rec: null,
    showDeleteSheet: false,
    deleting: false
  },

  onLoad(options) {
    this.setData({ id: options.id || '' })
  },

  // onShow 每次进入都重渲染：从详情页进编辑再返回时能看到最新数据
  onShow() {
    this.render()
    // 刷新当前空间双方资料（朋友改名后能拿到最新），拉完再渲染
    const space = app.globalData.space
    if (space && space._id) {
      db.fetchMembers(space).then(() => this.render()).catch(() => {})
    }
  },

  // 双方真实资料 helper（当前用户视角：me=当前登录用户）
  _pairOf(space) {
    return db.pairOf(space, app.globalData.openid)
  },

  render() {
    const space = app.globalData.space || {}
    const pair = this._pairOf(space)
    const meName = pair.me
    const friendName = pair.friend
    const rec = (app.globalData.records || []).find(r => r._id === this.data.id)

    if (!rec) {
      this.setData({ exists: false, meName, friendName, rec: null })
      return
    }

    // 比分转当前用户视角（me=当前用户，a=当前用户分）
    const v = util.toMyView(rec, pair.isCreator)
    this.setData({
      exists: true,
      meName,
      friendName,
      rec: {
        _id: rec._id,
        emoji: util.emojiOf(rec.type),
        type: rec.type,
        timeText: util.fmtTime(rec.time),
        loc: rec.loc || '',
        durationText: util.fmtDuration(rec.duration),
        a: v.a,
        b: v.b,
        total: v.a + v.b,
        winnerText: stats.winnerText(v.winner, meName, friendName),
        winClass: v.winner === 'me' ? 'win' : v.winner === 'friend' ? 'lose' : 'draw',
        // 金额：选填，仅在有值时展示（代表赢家赢得的金额）
        amountText: rec.amount != null ? '¥' + Number(rec.amount).toFixed(2) : ''
      }
    })
  },

  goEdit() {
    wx.navigateTo({ url: '/pages/record/record?id=' + this.data.id })
  },

  openDelete() { this.setData({ showDeleteSheet: true }) },
  closeDelete() { this.setData({ showDeleteSheet: false }) },
  noop() {},

  async confirmDelete() {
    if (this.data.deleting) return
    this.setData({ deleting: true })
    try {
      const spaceId = app.globalData.space._id
      await db.deleteRecord(spaceId, this.data.id)
      // 同步内存缓存
      app.globalData.records = app.globalData.records.filter(r => r._id !== this.data.id)
      wx.showToast({ title: '已删除', icon: 'none' })
      setTimeout(() => wx.navigateBack(), 600)
    } catch (e) {
      console.error('删除失败:', e)
      wx.showToast({ title: '删除失败：' + (e.errMsg || e.message || '网络异常'), icon: 'none', duration: 2500 })
    } finally {
      this.setData({ deleting: false, showDeleteSheet: false })
    }
  },

  goBack() {
    wx.navigateBack({ delta: 1 })
  }
})
