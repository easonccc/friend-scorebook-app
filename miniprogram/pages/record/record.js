// pages/record/record.js - 记一场（新增）/ 编辑比赛（复用）
// 同一份表单两种模式：无参数进入 = 新增；带 ?id=xxx 进入 = 编辑预填
const app = getApp()
const db = require('../../utils/db')
const util = require('../../utils/util')

const DUR_OPTIONS = [
  { v: 0, label: '不记录' },
  { v: 30, label: '30 分' },
  { v: 45, label: '45 分' },
  { v: 60, label: '60 分' },
  { v: 90, label: '90 分' }
]

Page({
  data: {
    isEdit: false,
    editId: '',
    meName: '我',
    friendName: '小晗子',
    meAvatar: '🐼',     // 我的真实头像
    frAvatar: '🐨',     // 朋友的真实头像
    // 多朋友：新增模式下可切换空间（编辑模式下锁定）
    spaceSheet: false,
    spaceOptions: [],
    // 类型
    type: '台球',
    typeEmoji: '🎱',
    typeSheet: false,
    typeOptions: [],
    // 比分
    a: 0,
    b: 0,
    total: 0,
    winText: '',
    winClass: 'draw',
    // 时间
    timeStamp: 0,
    timeText: '',
    timeSheet: false,
    dateVal: '',
    timeVal: '',
    // 地点
    loc: '',
    // 时长
    dur: 0,
    durOptions: DUR_OPTIONS,
    durCustom: '',     // 自定义分钟输入
    // 保存中
    saving: false
  },

  onLoad(options) {
    const space = app.globalData.space || {}
    const settings = db.getCachedSettings()
    const p = this._pairOf(space)

    this.setData({
      meName: p.me,
      friendName: p.friend,
      meAvatar: p.meAvatar,
      frAvatar: p.frAvatar,
      typeOptions: util.typeList(settings.customTypes),
      spaceOptions: this.buildSpaceOptions()
    })

    // 刷新当前空间双方资料（朋友改名后能拿到最新），拉完更新显示
    if (space && space._id) {
      db.fetchMembers(space).then(() => {
        const p2 = this._pairOf(app.globalData.space || {})
        this.setData({ meName: p2.me, friendName: p2.friend, meAvatar: p2.meAvatar, frAvatar: p2.frAvatar, spaceOptions: this.buildSpaceOptions() })
      }).catch(() => {})
    }

    // 后台刷新云端设置（换设备后自定义类型/默认类型也会同步过来）
    db.fetchUserSettings().then(s => {
      this.setData({ typeOptions: util.typeList(s.customTypes) })
    }).catch(() => {})

    // 编辑模式：根据 id 预填（比分按当前用户视角展示：a=我分，b=对手分）
    if (options.id) {
      const rec = (app.globalData.records || []).find(r => r._id === options.id)
      if (rec) {
        const p = this._pairOf(space)
        // 数据库存 a=创建者分/b=朋友分；当前用户=朋友时翻转成"我=rec.b, 对手=rec.a"
        const myA = p.isCreator ? (rec.a || 0) : (rec.b || 0)
        const myB = p.isCreator ? (rec.b || 0) : (rec.a || 0)
        this.setData({
          isEdit: true,
          editId: rec._id,
          type: rec.type || settings.defaultType,
          typeEmoji: util.emojiOf(rec.type || settings.defaultType),
          a: myA,
          b: myB,
          timeStamp: rec.time || Date.now(),
          loc: rec.loc || '',
          dur: rec.duration || 0
        })
        this.syncDerived()
        return
      }
      // 找不到记录（可能被删了），退回新增
    }

    // 新增：类型用「默认比赛类型」（设置页可改），时间取当前
    const defType = settings.defaultType || '台球'
    this.setData({ type: defType, typeEmoji: util.emojiOf(defType), timeStamp: Date.now(), loc: '', dur: 0 })
    this.syncDerived()
  },

  // 根据 a/b/type/time/dur 刷新派生展示（总局数、胜者、时间文案）
  syncDerived() {
    const { a, b, timeStamp } = this.data
    const d = {
      total: a + b,
      timeText: util.fmtTime(timeStamp)
    }
    if (a > b) { d.winText = '🏆 ' + this.data.meName + ' 赢了'; d.winClass = 'win' }
    else if (a < b) { d.winText = '🏆 ' + this.data.friendName + ' 赢了'; d.winClass = 'lose' }
    else { d.winText = '平局'; d.winClass = 'draw' }
    this.setData(d)
  },

  /* ---------- 比分：直接输入 + 步进微调 ---------- */
  // 点击比分数字直接键入（总局数自动相加，胜者自动判断）
  onScoreInput(e) {
    const side = e.currentTarget.dataset.side
    const key = side === 'a' ? 'a' : 'b'
    let v = parseInt(e.detail.value, 10)
    if (isNaN(v)) v = 0
    if (v < 0) v = 0
    if (v > 99) v = 99
    this.setData({ [key]: v })
    this.syncDerived()
  },

  tapScore(e) {
    const { side, delta } = e.currentTarget.dataset
    const key = side === 'a' ? 'a' : 'b'
    const v = this.data[key] + Number(delta)
    if (v < 0 || v > 99) return
    this.setData({ [key]: v })
    this.syncDerived()
  },

  /* ---------- 返回 ---------- */
  goBack() {
    wx.navigateBack({ delta: 1 })
  },

  /* ---------- 多朋友：切换空间（仅新增模式） ---------- */
  // 双方真实资料 helper（当前用户视角：me=当前登录用户）
  _pairOf(space) {
    return db.pairOf(space, app.globalData.openid)
  },
  buildSpaceOptions() {
    const cur = app.globalData.space
    const settings = db.getCachedSettings()
    return (app.globalData.spaces || []).map((s) => {
      const p = this._pairOf(s)
      return {
        _id: s._id,
        name: p.me + ' vs ' + p.friend,
        cur: !!(cur && cur._id === s._id),
        isDef: s._id === settings.defaultSpaceId,
        count: (s.records || []).length,
        emoji: p.frAvatar,   // 弹层用朋友头像作标识
        inviteCode: s.inviteCode || ''
      }
    })
  },
  openSpaceSheet() {
    if (this.data.isEdit) return // 编辑中的记录锁定在当前空间
    this.setData({ spaceSheet: true, spaceOptions: this.buildSpaceOptions() })
  },
  closeSpaceSheet() { this.setData({ spaceSheet: false }) },
  noop() {},
  goJoin() {
    this.setData({ spaceSheet: false })
    wx.navigateTo({ url: '/pages/join/join' })
  },
  async pickSpace(e) {
    const id = e.currentTarget.dataset.id
    if (id === (app.globalData.space || {})._id) {
      this.setData({ spaceSheet: false })
      return
    }
    try {
      await db.switchSpace(id)
      // 换朋友后：比分/时长清空重填，类型回到默认，避免串数据
      const defType = db.getCachedSettings().defaultType || '台球'
      const p = this._pairOf(app.globalData.space || {})
      this.setData({
        spaceSheet: false,
        meName: p.me,
        friendName: p.friend,
        meAvatar: p.meAvatar,
        frAvatar: p.frAvatar,
        a: 0, b: 0, loc: '', dur: 0, durCustom: '',
        type: defType, typeEmoji: util.emojiOf(defType), timeStamp: Date.now()
      })
      this.syncDerived()
    } catch (err) {
      wx.showToast({ title: '切换失败', icon: 'none' })
    }
  },
  async setDefaultSpace(e) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    try {
      await db.saveUserSettings({ defaultSpaceId: id })
      this.setData({ spaceOptions: this.buildSpaceOptions() })
      wx.showToast({ title: '已设为默认空间', icon: 'none' })
    } catch (err) {
      console.error('设置默认空间失败:', err)
      wx.showToast({ title: '保存失败', icon: 'none', duration: 2500 })
    }
  },

  /* ---------- 比赛类型 ---------- */
  openTypeSheet() { this.setData({ typeSheet: true }) },
  closeTypeSheet() { this.setData({ typeSheet: false }) },

  pickType(e) {
    const t = e.currentTarget.dataset.type
    if (t === '自定义') {
      // 自定义类型：输入名称 → 存进我的 user_settings（只有我自己能看到，不影响朋友）
      wx.showModal({
        title: '自定义比赛',
        editable: true,
        placeholderText: '比如：飞镖 / 保龄球',
        success: res => {
          if (!res.confirm || !res.content || !res.content.trim()) return
          const name = res.content.trim().slice(0, 8)
          this.setData({ type: name, typeEmoji: '🎯', typeSheet: false })
          db.addCustomType(name)
            .then(() => {
              // 持久化成功，类型选择器里立刻可见
              this.setData({ typeOptions: util.typeList(db.getCachedSettings().customTypes) })
            })
            .catch(err => {
              console.warn('自定义类型暂未同步到云端（本次记录不受影响）:', err.message || err)
            })
        }
      })
      return
    }
    this.setData({ type: t, typeEmoji: util.emojiOf(t), typeSheet: false })
  },

  /* ---------- 时间 ---------- */
  openTimeSheet() {
    const d = new Date(this.data.timeStamp)
    const pad = n => (n < 10 ? '0' + n : '' + n)
    this.setData({
      timeSheet: true,
      dateVal: d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()),
      timeVal: pad(d.getHours()) + ':' + pad(d.getMinutes())
    })
  },
  closeTimeSheet() { this.setData({ timeSheet: false }) },
  onDateChange(e) { this.setData({ dateVal: e.detail.value }) },
  onTimeChange(e) { this.setData({ timeVal: e.detail.value }) },
  confirmTime() {
    const ts = new Date(this.data.dateVal + 'T' + this.data.timeVal + ':00').getTime()
    this.setData({ timeStamp: ts, timeSheet: false })
    this.syncDerived()
  },
  useNow() {
    this.setData({ timeStamp: Date.now(), timeSheet: false })
    this.syncDerived()
  },

  /* ---------- 地点 / 时长 ---------- */
  onLocInput(e) { this.setData({ loc: e.detail.value }) },
  pickDur(e) {
    this.setData({ dur: Number(e.currentTarget.dataset.v), durCustom: '' })
  },
  onDurInput(e) {
    const v = parseInt(e.detail.value, 10) || 0
    this.setData({ durCustom: e.detail.value, dur: v })
  },

  /* ---------- 保存 ---------- */
  async onSave() {
    if (this.data.saving) return
    const { a, b, type, timeStamp, loc, dur, isEdit, editId } = this.data
    if (a === 0 && b === 0) {
      wx.showToast({ title: '先记个比分吧！', icon: 'none' })
      return
    }
    if (!app.globalData.space) {
      wx.showToast({ title: '请先创建/加入空间', icon: 'none' })
      return
    }
    this.setData({ saving: true })
    const spaceId = app.globalData.space._id
    // a/b 是当前用户视角（a=我分, b=对手分）；存库时还原成绝对角色（a=创建者分, b=朋友分）
    const p = this._pairOf(app.globalData.space || {})
    const realA = p.isCreator ? a : b   // 创建者分
    const realB = p.isCreator ? b : a   // 朋友分
    const payload = { type, time: timeStamp, loc, duration: dur, a: realA, b: realB }

    try {
      if (isEdit) {
        const patch = await db.updateRecord(spaceId, editId, payload)
        // 同步内存缓存，详情页返回时能立刻看到
        const list = app.globalData.records
        const i = list.findIndex(r => r._id === editId)
        if (i > -1) list[i] = Object.assign({}, list[i], patch)
        wx.showToast({ title: '✅ 已更新', icon: 'none' })
      } else {
        const rec = await db.addRecord(Object.assign({ spaceId }, payload))
        app.globalData.records.unshift(rec)
        wx.showToast({ title: '🎉 记上了！', icon: 'none' })
      }
      setTimeout(() => wx.navigateBack(), 700)
    } catch (e) {
      console.error('保存失败:', e)
      wx.showToast({ title: '保存失败：' + (e.errMsg || e.message || '网络异常'), icon: 'none', duration: 2500 })
    } finally {
      this.setData({ saving: false })
    }
  }
})
