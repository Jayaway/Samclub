# 问题追踪 - 跨模块问题

> 本文件用于记录前后端交互中发现的问题，由发现方填写，交给对应模块负责人修复。
> 不要直接修改对方模块的代码，请记录在此文件后交给对应 Agent 处理。

---

## 待处理问题

### [后端] 问题 #1: 费用计算与 SPEC.md 不符
**发现日期**: 2026-04-09
**发现者**: 前端 Agent / 集成 Agent
**模块**: 后端 - calculator.js

**问题描述**:
SPEC.md 明确规定"无团长优惠：所有成员（包括发起人）平等分摊费用"，但 `calculator.js` 中的 `calculateCostShare` 函数实现了团长优惠逻辑：
- 存在 `LEADER_FEE = 2` 常量
- 发起人可获得 2 元抵扣
- 其他成员需要分摊这 2 元

**相关代码位置**: `server/utils/calculator.js` 第 12-13 行，第 77-97 行

**影响接口**: `GET /api/group-buys/:id/cost-details`

**期望行为**: 所有人平等分摊，无团长折扣

**状态**: 已修复 (2026-04-09)

**修复说明**: 移除了 `LEADER_FEE` 常量，修改 `calculateCostShare` 函数为纯比例分摊逻辑，所有成员平等分摊费用。

### [后端] 问题 #2: calculateCostShare 参数缺失
**发现日期**: 2026-04-09
**发现者**: 集成 Agent
**模块**: 后端 - groupBuys.js

**问题描述**:
`GET /api/group-buys/:id/cost-details` 接口中调用 `calculateCostShare` 时缺少 `leaderId` 参数：

当前代码（第 234 行）：
```javascript
const costDetails = calculateCostShare(totalAmount, userOrders, frozen);
```

应为：
```javascript
const costDetails = calculateCostShare(totalAmount, userOrders, gb.creator_id, frozen);
```

**相关代码位置**: `server/routes/groupBuys.js` 第 234 行

**影响接口**: `GET /api/group-buys/:id/cost-details`

**期望行为**: 正确传入 creator_id 作为 leaderId 参数

**状态**: 已修复 (2026-04-09)

**修复说明**: 由于移除了团长优惠逻辑，`calculateCostShare` 函数不再需要 `leaderId` 参数。现函数签名为 `calculateCostShare(totalAmount, userOrders, hasFrozen)`，调用处已相应更新。

### [后端] 问题 #3: 生鲜附加费与 SPEC.md 不符
**发现日期**: 2026-04-09
**发现者**: 集成 Agent
**模块**: 后端 - calculator.js

**问题描述**:
SPEC.md 规定生鲜附加费为 2 元，但 `calculator.js` 中 `FEES.sam.frozen` 和 `FEES.jd.frozen` 均为 1 元。

**相关代码位置**: `server/utils/calculator.js` 第 8-9 行

**期望行为**:
- `FEES.sam.frozen` 应为 `2`
- `FEES.jd.frozen` 应为 `2`

**状态**: 已修复 (2026-04-09)

**修复说明**: 将 `FEES.sam.frozen` 和 `FEES.jd.frozen` 从 1 修改为 2。

---

## 已解决问题

### 问题 #1: 费用计算与 SPEC.md 不符
**修复日期**: 2026-04-09
**修复内容**: 移除 `LEADER_FEE` 常量，修改 `calculateCostShare` 函数为纯比例分摊逻辑

### 问题 #2: calculateCostShare 参数缺失
**修复日期**: 2026-04-09
**修复内容**: 移除团长优惠逻辑后，函数不再需要 `leaderId` 参数，调用处已相应更新

### 问题 #3: 生鲜附加费与 SPEC.md 不符
**修复日期**: 2026-04-09
**修复内容**: 将 `FEES.sam.frozen` 和 `FEES.jd.frozen` 从 1 修改为 2

---

## 新发现的跨模块问题

### [后端] 问题 #4: 缺失获取付款记录 API
**发现日期**: 2026-04-09
**发现者**: 前端 Agent
**模块**: 后端 - 缺失 API

**问题描述**:
前端 My.vue 需要获取用户的付款记录来显示"已付款/待确认"状态。

**状态**: 不是真正的问题 (2026-04-09)

**说明**: 经检查 `server/routes/payments.js`，相关 API 已存在：
- `GET /api/payments?user_id=X&group_buy_id=Y` (第 113 行)
- `GET /api/payments/group/:groupBuyId` (第 135 行)

前端需正确调用这些接口即可。

### [后端] 问题 #5: 登录 API 接受多余参数
**发现日期**: 2026-04-09
**发现者**: 前端 Agent
**模块**: 后端 - users.js

**问题描述**:
API_CONTRACT.md 第 2.2 节定义登录 API 请求体为:
```json
{
  "student_id": "学号"
}
```

但后端代码要求同时提供 `student_id` 和 `nickname` 两个参数。

**相关代码位置**: `server/routes/users.js` 登录处理

**期望行为**:
后端应只接受 `student_id` 参数。

**状态**: 已修复 (2026-04-09)

**修复说明**: 修改后端登录逻辑，仅验证 `student_id`，移除对 `nickname` 的要求。
