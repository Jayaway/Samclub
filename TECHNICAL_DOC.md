# 校园山姆拼单平台 - 技术文档

## 1. 项目概述

### 1.1 项目简介
校园山姆拼单平台是一个面向大学生的山姆商品拼单Web应用，支持移动端优先的响应式设计。

### 1.2 核心功能
- 山姆商品拼单创建与管理
- 商品拆分售卖（整份/单个购买）
- 平台统一下单收款
- 冰鲜配送商品标识
- 费用智能分摊（含团长优惠）
- 拼单状态手动流转

### 1.3 技术栈

**前端：**
- React 18 + TypeScript
- Vite (构建工具)
- Tailwind CSS (样式)
- Framer Motion (动画)
- Lucide React (图标)

**后端：**
- Node.js + Express
- SQLite (数据库)

## 2. 项目结构

```
/Users/vv/Desktop/sam/
├── SPEC1.md                 # 项目规格文档
├── TECHNICAL_DOC.md         # 本文档
├── client/                  # 前端应用
│   ├── src/
│   │   ├── components/     # 公共组件
│   │   │   ├── BottomNav.tsx       # 底部导航栏
│   │   │   └── WheelPicker.tsx    # iOS风格时间选择器
│   │   ├── pages/          # 页面组件
│   │   │   ├── LoginPage.tsx       # 登录/注册页
│   │   │   ├── SquarePage.tsx      # 拼单广场
│   │   │   ├── ShopPage.tsx       # 商品选购页
│   │   │   ├── CreatePage.tsx     # 创建拼单页
│   │   │   ├── DetailPage.tsx     # 拼单详情页
│   │   │   ├── ProfilePage.tsx    # 个人中心页
│   │   │   └── MyPage.tsx         # 我的拼单页
│   │   ├── types/          # TypeScript类型定义
│   │   │   └── index.ts
│   │   ├── utils/          # 工具函数
│   │   │   ├── api.ts             # API请求封装
│   │   │   └── animations.ts      # 动画配置
│   │   ├── App.tsx         # 根组件
│   │   ├── main.tsx        # 入口文件
│   │   └── index.css       # 全局样式
│   └── package.json
├── server/                  # 后端服务
│   ├── index.js            # 服务入口
│   ├── db.js               # 数据库配置
│   ├── routes/             # 路由模块
│   │   ├── users.js        # 用户相关API
│   │   ├── groupBuys.js    # 拼单相关API
│   │   ├── products.js     # 商品相关API
│   │   ├── orderItems.js   # 订单项API
│   │   ├── payments.js     # 支付相关API
│   │   ├── costDetails.js  # 费用详情API
│   │   ├── messages.js     # 留言板API
│   │   └── stats.js        # 平台统计API
│   ├── utils/
│   │   └── calculator.js   # 费用计算工具
│   └── config.js           # 服务端配置（运费预警关键词/阈值）
│   └── package.json
```

## 3. 页面路由

```
Page = 'login' | 'square' | 'shop' | 'create' | 'detail' | 'my' | 'profile'
```

| 页面 | 路由 | 说明 |
|------|------|------|
| 登录/注册 | / | 用户登录或注册 |
| 拼单广场 | square | 浏览所有拼单 |
| 商品选购 | shop | 加入拼单时选购商品 |
| 创建拼单 | create | 发起新的拼单 |
| 拼单详情 | detail | 查看拼单详情和成员 |
| 我的拼单 | my | 我的拼单列表 |
| 个人中心 | profile | 用户信息和设置 |

## 4. 数据库模型

### 4.1 用户表 (users)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| student_id | TEXT | 学号（B/F + 8位数字） |
| nickname | TEXT | 昵称 |
| avatar | TEXT | 头像URL |
| payment_qr | TEXT | 收款码图片URL |
| dorm_building | TEXT | 宿舍地址 |
| phone | TEXT | 手机号 |
| credit_score | INTEGER | 信用分 |

### 4.2 拼单表 (group_buys)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| creator_id | INTEGER | 团长用户ID |
| title | TEXT | 拼单标题 |
| deadline | TEXT | 截止时间 |
| pickup_location | TEXT | 取货地点 |
| status | TEXT | 状态 |
| payment_remark | TEXT | 付款备注（生成格式：GB{id}_{昵称}_{随机码}） |
| delivered_at | TEXT | 标记为已送达的时间（用于7天自动完成） |
| created_at | TEXT | 创建时间 |

### 4.3 商品表 (products)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| group_buy_id | INTEGER | 所属拼单ID |
| product_type | TEXT | 商品类型（'fixed'=固定商品，'custom'=自定义商品）；自定义商品不支持拆分 |
| name | TEXT | 商品名称 |
| original_price | REAL | 原价 |
| quantity | INTEGER | 整份数量（盒/箱） |
| remaining_quantity | INTEGER | 剩余可购数量 |
| allow_split | INTEGER | 是否允许拆分（0/1）；仅fixed商品有效 |
| split_unit | TEXT | 拆分单位（片/个）；仅fixed商品有效 |
| split_quantity_per_whole | INTEGER | 每整份包含的拆分单位数（如6片/盒） |
| split_price_per_unit | INTEGER | 每个拆分单位的价格（分） |
| self_retain_quantity | INTEGER | 发起人自留拆分单位数（不计入可售库存） |
| needs_cold_chain | INTEGER | 是否需冰鲜配送（0/1） |
| unit_price | REAL | 整份单价（元） |
| split_remaining_quantity | INTEGER | 剩余可售拆分单位数（null表示不可拆分） |

**校验规则**：
1. 所有成员购买的拆分单位总数 ≤ (quantity × split_quantity_per_whole) - self_retain_quantity
2. **拆分单价上限**：`split_price_per_unit` ≤ `original_price / split_quantity_per_whole`（允许相等或更低作为促销，禁止更高）

### 4.4 订单项表 (order_items)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| group_buy_id | INTEGER | 所属拼单ID |
| user_id | INTEGER | 用户ID |
| product_id | INTEGER | 商品ID |
| quantity | INTEGER | 购买数量 |
| subtotal | REAL | 小计金额（分） |
| purchase_type | TEXT | 购买类型（'whole'=整份，'split'=拆分单位） |

### 4.5 费用详情表 (cost_details)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| group_buy_id | INTEGER | 所属拼单ID |
| user_id | INTEGER | 用户ID |
| base_amount | REAL | 商品金额 |
| share_fee | REAL | 分摊费用 |
| leader_discount | REAL | 团长优惠 |
| final_amount | REAL | 最终应付 |

### 4.6 支付记录表 (payments)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| group_buy_id | INTEGER | 所属拼单ID |
| user_id | INTEGER | 用户ID |
| amount | REAL | 支付金额 |
| proof_image | TEXT | 付款凭证图片URL |
| status | TEXT | 状态（'待确认' / '已确认' / '已拒绝'） |
| confirm_time | TEXT | 团长确认/拒绝时间 |

### 4.7 留言表 (messages)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| group_buy_id | INTEGER | 所属拼单ID |
| user_id | INTEGER | 用户ID |
| content | TEXT | 留言内容 |
| created_at | TEXT | 创建时间 |

### 4.8 平台收益表 (platform_revenue)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| group_buy_id | INTEGER | 所属拼单ID（唯一） |
| diff_cents | INTEGER | 尾差收益（分） |
| recorded_at | TEXT | 记录时间 |

## 5. API接口

### 5.1 用户API
```
POST /api/users/register     - 注册用户（学号格式：B/F + 8位数字）
POST /api/users/login        - 登录
GET  /api/users/me           - 获取当前用户信息
PUT  /api/users/:id          - 更新用户信息（含昵称、头像、宿舍、收款码）
```

### 5.2 拼单API
```
GET  /api/group-buys                    - 获取拼单列表
POST /api/group-buys                    - 创建拼单（自动生成payment_remark）
GET  /api/group-buys/:id                - 获取拼单详情
PUT  /api/group-buys/:id/status          - 更新拼单状态（变更为"已下单"时触发通知）
DELETE /api/group-buys/:id               - 删除拼单
GET  /api/group-buys/:id/cost-details   - 获取费用详情
GET  /api/group-buys/:id/payment-info   - 获取团长收款码和付款备注
GET  /api/group-buys/:id/payment-progress - 团长查看收款进度（含各成员应付/实付状态）
DELETE /api/group-buys/:id/members/me   - 成员主动退出（触发重算）
POST /api/group-buys/:id/products       - 团长增加商品（触发重算+模式检测）
POST /api/group-buys/:id/delivered      - 管理员确认送达（触发短信/站内通知）
```

### 5.6 留言板API
```
GET  /api/messages/:groupId   - 获取拼单留言列表
POST /api/messages            - 发送留言
```

### 5.3 商品API
```
POST /api/products         - 添加商品
PUT  /api/products/:id     - 更新商品
DELETE /api/products/:id    - 删除商品
```

### 5.4 订单API
```
GET  /api/order-items/user/:userId/group/:groupBuyId  - 获取用户订单
POST /api/order-items     - 创建订单项（支持purchase_type: whole/split）
                       同用户同商品已存在时为UPSERT（差量增减库存）
DELETE /api/order-items/:id - 删除订单项（自动归还库存）
``````

### 5.5 支付API
```
POST /api/payments                    - 创建/更新支付记录
GET  /api/payments?user_id=&group_buy_id=  - 获取用户支付记录
GET  /api/payments/group/:groupBuyId  - 获取拼单所有支付记录（团长用）
PUT  /api/payments/:id/confirm        - 团长确认/拒绝支付（body: { status: '已确认' | '已拒绝' }）
POST /api/payments/batch-confirm       - 批量确认支付（body: { payment_ids: number[], status: string }）
```

### 5.7 平台统计API
```
GET /api/stats/platform   - 平台收益统计（含尾差汇总、月统计、近期拼单明细）
```

## 6. 费用计算规则

### 6.1 运费规则

| 模式 | 条件 | 运费 | 包装费 | 冰鲜附加费 | 平台酬劳 |
|------|------|------|--------|------------|----------|
| 山姆模式 | ≥99元 | 0元 | 1元 | 1元(如含冰鲜) | 0.5元 |
| 京东模式 | <99元 | 5元 | 2元(含冰鲜) | 0 | 0.5元 |

### 6.2 团长优惠
- 优惠金额：2元
- **生效条件（满足其一即可）：**
  1. **拆分激励**：拼单中存在至少一名其他成员，且该成员购买了团长设定的至少一个拆分单位（不论团长自身商品金额是否≥99元）
  2. **普通拼单激励（可选）**：若团长未开启任何拆分，但拼单总人数≥2且总金额<99元（团长帮助凑单免运费），也可给予优惠（需与产品确认）
- **例外情况（不享受优惠）：**
  1. 拼单中只有团长一人
  2. 团长未开启任何商品的"允许拆分"选项（无论是否有其他成员加入，均视为普通拼单，无优惠）
  3. 团长开启了拆分，但无其他成员购买拆分单位

### 6.3 分摊算法
1. 计算每人初步应付：个人商品金额 + 按比例分摊的附加费用
2. 应用团长优惠：团长减2元，其他成员均摊2元
3. 尾差处理：四舍五入到分，**差额归平台**（不论盈亏均归平台，团长优惠保持精确2元）

## 7. 拼单状态流转

```
拼单中 → 待付款 → 已下单 → 已送达 → 已完成
         ↘ 已取消（超时未付/团长取消）
```

| 状态 | 触发动作 | 说明 |
|------|----------|------|
| 拼单中 | 创建后 | 成员可加入/修改商品，发起人可移出成员 |
| 待付款 | 团长点击"停止招募" | 冻结商品选择，禁止成员变动；团长展示收款码；成员标记已付款 |
| 已下单 | 团长点击"统一下单" | 所有成员已付款，团长确认后进入已下单 |
| 已送达 | 团长点击"确认送达" | 商品已取回至取货点 |
| 已完成 | 团长点击"完成"或7天后 | 拼单结束 |
| 已取消 | 团长点击"取消拼单"或超时未付 | 拼单结束，金额原路退回 |

**"待付款"阶段规则：**
- 禁止任何成员变动（不可加入新成员，不可移出成员）
- 成员上传付款凭证后由团长确认
- 若存在超时未付成员，团长只能选择"取消拼单"（不可移出单个成员）

## 8. 功能模块

### 8.1 注册登录
- 学号格式：B/F + 8位数字（如 B25011215），用于区分专升本/本科生并支持身份追溯
- 手机号：可选，11位数字格式校验
- 头像上传：支持图片预览

### 8.2 拼单广场
- Tab筛选：全部/进行中/已完成
- 拼单卡片：显示标题、团长、进度、剩余时间、参与人数

### 8.3 创建拼单
- 取货地点：默认填充注册地址
- 截止时间：iOS风格滚轮选择器（分钟15倍数）
- 重复检查：检查±1小时内同类拼单
- 商品设置（商品选择器支持固定/自定义切换）：
  - 固定商品：从预设商品列表选择，支持拆分设置
  - 自定义商品：手动输入名称、价格、数量，不支持拆分
  - 整份数量：发起人购买的份数
  - 允许拆分：是否允许其他成员按拆分单位购买（仅固定商品）
  - 拆分单位：片/个/包等（仅固定商品）
  - 每份含拆分单位数：如6片/盒（仅固定商品）
  - 拆分单价：每个拆分单位的价格（分）（仅固定商品）
  - **自留拆分单位数量**（仅允许拆分时）：发起人自留不售卖的部分，不计入可售库存

### 8.4 商品选购
- 支持整份购买和拆分购买
- 支持在同一商品上切换购买类型（跨类型切换时先删再创）
- 实时计算凑单进度

### 8.5 拼单详情
- 费用明细：商品费、包装费、运费、平台酬劳、团长优惠
- 成员管理：查看参与者、付款状态
- 团长操作：状态流转（停止招募/取消拼单/确认送达/完成）、增加商品（仅"拼单中"状态）
- **收款进度**（团长，待付款阶段）：底部栏"收款进度"按钮，点击弹出底部面板，显示待收总额、已收/待收人数比、每个成员的应付金额和付款状态，支持"确认收款"和"拒绝"按钮
- 成员操作：付款（待付款阶段）、主动退出拼单（仅"拼单中"状态）
- **留言板**：
  - 拼单成员可发送文字留言（限500字）
  - 仅参与拼单的成员可留言（团长和已下单成员）
  - 实时展示留言时间戳
  - 从拼单详情页顶部入口进入
- **"待付款"阶段规则**：
  - 禁止任何成员加入或退出
  - 团长展示收款码，成员付款后团长确认
  - 所有成员付款后，团长点击"统一下单"进入已下单
  - 若存在超时未付，团长只能取消整个拼单
- **增加商品规则**（仅团长，仅"拼单中"状态）：
  - 团长可添加新商品到现有拼单
  - 添加后自动重新计算所有成员分摊费用
  - **模式切换检测**：若添加商品导致运费模式变化（京东↔山姆），弹窗警告团长
  - 通知：所有成员收到"拼单商品已更新"推送
- **成员退出规则**（仅"拼单中"状态）：
  - 成员可主动退出拼单（团长不可退出）
  - 退出后系统自动重新计算剩余成员费用
  - 退款由团长线下处理

### 8.6 我的拼单
- Tab切换：我发起的 / 我参与的
- 状态筛选：拼单中/待付款/已完成/已取消

### 8.7 个人中心
- 用户信息展示与编辑
- 历史参与记录
- 帮助与反馈
- 关于我们

## 9. 启动方式

### 9.1 开发环境

**后端服务（端口3000）：**
```bash
cd /Users/vv/Desktop/sam/server
node index.js
```

**前端服务（端口5175）：**
```bash
cd /Users/vv/Desktop/sam/client
npm run dev
```

### 9.2 生产构建

```bash
cd /Users/vv/Desktop/sam/client
npm run build
```

构建输出到 `client/dist` 目录。

## 10. 注意事项

1. **管理员运费预警**：商品名称匹配预警关键词（默认：酒、饮料、牛奶、矿泉水、纯净水、碳酸饮料）且总金额超过阈值（默认200元）时，后台输出警告日志；关键词和阈值可通过 `server/config.js` 配置
2. **网页版适配**：最大宽度限制为 448px（max-w-md），移动端优先
3. **安全区域**：底部导航已适配 iOS safe-area-inset-bottom
4. **自动完成定时任务**：服务器启动后立即执行一次，然后每小时的整点时刻检查"已送达"超过7天的拼单，自动将其状态更新为"已完成"
