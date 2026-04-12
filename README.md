# 校园山姆拼单平台

面向大学生的山姆会员店商品拼单 Web 应用，支持移动端优先的响应式设计。

## 功能特性

### 核心功能
- **拼单创建与管理** — 团长发起拼单，设置截止时间、取货地点
- **商品拆分售卖** — 固定商品支持整份购买和拆分单位购买两模式，自定义商品仅整份购买
- **费用智能分摊** — 自动计算商品费、包装费、运费，团长优惠（满¥99免运费）
- **拼单状态流转** — 拼单中 → 待付款 → 已下单 → 已送达 → 已完成
- **收款进度管理** — 团长查看各成员付款状态，一键确认/拒绝
- **留言板** — 拼单成员实时交流
- **冰鲜配送标识** — 生鲜类商品冰鲜配送附加费自动计算

### 角色说明
| 角色 | 权限 |
|------|------|
| 团长 | 创建拼单、增加商品、停止招募、确认送达、取消拼单、管理收款 |
| 成员 | 选购商品、付款、退出拼单、留言 |

## 技术栈

**前端：** React 18 + TypeScript + Vite + Tailwind CSS + Framer Motion + Lucide React

**后端：** Node.js + Express + SQLite (better-sqlite3)

## 项目结构

```
/Users/vv/Desktop/sam/
├── client/                  # 前端应用（端口5175）
│   ├── src/
│   │   ├── components/      # 公共组件（底部导航、iOS风格滚轮选择器）
│   │   ├── pages/           # 页面组件
│   │   │   ├── LoginPage    # 登录/注册
│   │   │   ├── SquarePage   # 拼单广场
│   │   │   ├── ShopPage    # 商品选购
│   │   │   ├── CreatePage   # 创建拼单
│   │   │   ├── DetailPage   # 拼单详情
│   │   │   ├── MyPage      # 我的拼单
│   │   │   └── ProfilePage # 个人中心
│   │   ├── types/           # TypeScript类型定义
│   │   ├── utils/          # API请求封装、动画配置
│   │   ├── App.tsx
│   │   └── main.tsx
│   └── package.json
│
├── server/                  # 后端服务（端口3000）
│   ├── index.js             # 服务入口
│   ├── db.js                # SQLite数据库配置
│   ├── config.js            # 运费预警配置
│   ├── routes/
│   │   ├── users.js         # 用户注册/登录/信息更新
│   │   ├── groupBuys.js     # 拼单CRUD、状态流转、收款进度
│   │   ├── products.js      # 商品管理
│   │   ├── orderItems.js    # 订单项（支持整份/拆分原子扣减）
│   │   ├── payments.js      # 支付凭证、确认/拒绝
│   │   ├── costDetails.js   # 费用分摊详情
│   │   ├── messages.js      # 留言板
│   │   └── stats.js         # 平台统计（尾差收益）
│   └── utils/
│       └── calculator.js    # 费用计算逻辑
│
├── SPEC1.md                 # 项目需求规格文档
├── TECHNICAL_DOC.md          # 技术文档
└── README.md                # 本文档
```

## 快速启动

### 环境要求
- Node.js >= 18
- npm

### 安装依赖

```bash
# 安装后端依赖
cd server
npm install

# 安装前端依赖
cd ../client
npm install
```

### 启动服务

```bash
# 终端1：启动后端（端口3000）
cd server
node index.js

# 终端2：启动前端（端口5175）
cd client
npm run dev
```

### 访问应用
- 前端地址：http://localhost:5175
- 后端 API：http://localhost:3000/api

## 数据库

SQLite 数据库文件位于 `server/campus.sqlite`，首次启动时自动初始化表结构。

主要数据表：
- `users` — 用户信息
- `group_buys` — 拼单
- `products` — 商品（含拆分规格）
- `order_items` — 订单项（整份/拆分）
- `cost_details` — 费用分摊
- `payments` — 支付记录
- `messages` — 留言板
- `platform_revenue` — 平台尾差收益

## 费用规则

| 模式 | 条件 | 运费 | 包装费 | 冰鲜附加费 | 平台酬劳 |
|------|------|------|--------|------------|----------|
| 山姆模式 | ≥99元 | 0元 | 1元 | 1元(如含冰鲜) | 0.5元 |
| 京东模式 | <99元 | 5元 | 2元 | 0 | 0.5元 |

团长优惠 2 元（拼单中存在其他成员且有拆分购买时生效）。

## API 概览

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/users/register | 注册 |
| POST | /api/users/login | 登录 |
| POST | /api/group-buys | 创建拼单 |
| GET | /api/group-buys | 获取拼单列表 |
| GET | /api/group-buys/:id | 拼单详情 |
| PUT | /api/group-buys/:id/status | 更新状态 |
| DELETE | /api/group-buys/:id/members/me | 退出拼单 |
| POST | /api/order-items | 创建订单项（整份/拆分） |
| DELETE | /api/order-items/:id | 删除订单项 |
| GET | /api/group-buys/:id/payment-progress | 收款进度 |
| PUT | /api/payments/:id/confirm | 确认/拒绝付款 |
| GET | /api/messages/:groupId | 留言列表 |
| POST | /api/messages | 发送留言 |
| GET | /api/stats/platform | 平台统计 |

详细 API 文档见 [TECHNICAL_DOC.md](./TECHNICAL_DOC.md)。

## 备注

- 学号格式：B/F + 8位数字（如 `B25011215`）
- 拆分库存使用原子扣减（`UPDATE ... WHERE stock >= ?`），防止超卖
- 服务器启动后自动执行 7 天自动完成定时任务（每小时检查一次"已送达"超过7天的拼单）
- 运费预警：商品名称含"酒/饮料/牛奶/矿泉水/纯净水/碳酸饮料"且总金额>200元时输出警告日志
