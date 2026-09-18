// utils/stats.js - 统计计算（纯函数，无副作用）
// 从原型 HTML 的逻辑移植而来，保证统计口径与原型一致
//
// 约定：每条记录 { a, b } 是「我 vs 朋友」的比分，
// winner 字段只存角色（me / friend / draw），不存姓名 ——
// 这样改名字后，历史战绩与统计全部自动跟随，无需重算。

// 判定胜者：a > b => me，a < b => friend，相等 => draw
function winnerOf(r) {
  if (r.a > r.b) return 'me'
  if (r.a < r.b) return 'friend'
  return 'draw'
}

// 胜者文案（由页面根据当前名字渲染，这里只给角色）
function winnerText(w, meName, friendName) {
  if (w === 'me') return meName + ' 赢了'
  if (w === 'friend') return friendName + ' 赢了'
  return '平局'
}

// 按类型筛选记录（'全部' 返回原数组）
function filterByType(records, type) {
  if (!type || type === '全部') return records
  return records.filter(r => r.type === type)
}

// 汇总统计。入参 records 需为时间倒序（最新在前），与云数据库查询一致
function buildStats(records) {
  const n = records.length
  let m = 0, f = 0, d = 0
  let myPts = 0, frPts = 0
  const typeMap = {}

  records.forEach(r => {
    const w = winnerOf(r)
    if (w === 'me') m++
    else if (w === 'friend') f++
    else d++
    myPts += r.a
    frPts += r.b

    const t = r.type || '台球'
    if (!typeMap[t]) typeMap[t] = { type: t, n: 0, m: 0, f: 0, d: 0 }
    const g = typeMap[t]
    g.n++
    if (w === 'me') g.m++
    else if (w === 'friend') g.f++
    else g.d++
  })

  const pct = x => (n ? x / n * 100 : 0)

  // 最近 10 场的胜负序列（时间正序，最早在左），用于画趋势点
  const recent = records.slice(0, 10).map(winnerOf).reverse()

  return {
    n, m, f, d,
    mRate: pct(m),
    fRate: pct(f),
    dRate: pct(d),
    myPts, frPts,
    myAvg: n ? myPts / n : 0,
    frAvg: n ? frPts / n : 0,
    recent,
    types: Object.keys(typeMap).map(k => {
      const g = typeMap[k]
      return {
        type: g.type,
        n: g.n, m: g.m, f: g.f, d: g.d,
        mRate: g.n ? g.m / g.n * 100 : 0
      }
    })
  }
}

module.exports = { winnerOf, winnerText, filterByType, buildStats }
