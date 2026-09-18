// custom-tab-bar/index.js
// 自定义 TabBar：首页 / 记一场(中间凸起) / 统计 / 设置
// 为什么把「记一场」做成凸起按钮而不是普通 tab：
//   1. 视觉上强调最高频操作（打完一场 10 秒记下来）
//   2. 技术上它用 wx.navigateTo 打开记录页，而不是 switchTab，
//      这样记录页可以带参数复用为「编辑模式」，也不占用 tab 名额
Component({
  data: {
    selected: 0,
    hidden: false,   // 弹框打开时由页面置 true，隐藏 TabBar 防止遮挡底部抽屉
    spaceOn: false,  // 是否已有比赛空间：false 时禁用「记一场」并灰显
    tabs: [
      { text: '首页', icon: '🏠', path: '/pages/index/index', center: false },
      { text: '记一场', icon: '＋', path: '/pages/record/record', center: true },
      { text: '统计', icon: '📊', path: '/pages/stats/stats', center: false },
      { text: '设置', icon: '⚙️', path: '/pages/settings/settings', center: false }
    ]
  },

  // 所在页面 onShow 时自动同步空间状态（无需各页面手动调）
  pageLifetimes: {
    show() {
      const app = getApp()
      this.setData({ spaceOn: !!(app && app.globalData && app.globalData.space) })
    }
  },

  methods: {
    onTap(e) {
      const t = this.data.tabs[e.currentTarget.dataset.index]
      if (t.center) {
        // 以 globalData.space 为准（data.spaceOn 只用于灰显，可能未及时同步）
        const app = getApp()
        const hasSpace = !!(app && app.globalData && app.globalData.space)
        if (!hasSpace) {
          wx.showToast({ title: '先创建比赛空间再记一场', icon: 'none' })
          return
        }
        wx.navigateTo({ url: t.path })
        return
      }
      if (this.data.selected === e.currentTarget.dataset.index) return
      wx.switchTab({ url: t.path })
    }
  }
})
