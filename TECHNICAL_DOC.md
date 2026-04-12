# 校园山姆拼单平台 - 技术文档

## 1. 项目概述

### 1.1 项目简介
校园山姆拼单平台是一个面向大学生的山姆商品拼单Web应用，支持移动端优先的响应式设计。

### 1.2 核心功能
- 山姆商品拼单创建与管理
- 商品拆分售卖（整份/单个购买）
- 平台统一下单收款
- 生鲜冷冻商品标识
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
│   │   └── costDetails.js  # 费用详情API
│   ├── utils/
│   │   └── calculator.js   # 费用计算工具
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
| student_id | TEXT | 学号 |
| nickname | TEXT | 昵称 |
| avatar | TEXT | 头像URL |
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
| created_at | TEXT | 创建时间 |

### 4.3 商品表 (products)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| group_buy_id | INTEGER | 所属拼单ID |
| name | TEXT | 商品名称 |
| original_price | REAL | 原价 |
| total_quantity | INTEGER | 总数量 |
| remaining_quantity | INTEGER | 剩余数量 |
| is_split_allowed | INTEGER | 是否允许拆分 |
| is_frozen | INTEGER | 是否生鲜 |
| unit_price | REAL | 单价 |

### 4.4 订单项表 (order_items)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| group_buy_id | INTEGER | 所属拼单ID |
| user_id | INTEGER | 用户ID |
| product_id | INTEGER | 商品ID |
| quantity | INTEGER | 购买数量 |
| subtotal | REAL | 小计金额 |

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
| remark | TEXT | 备注 |
| confirmed | INTEGER | 是否确认 |

## 5. API接口

### 5.1 用户API
```
POST /api/users/register     - 注册用户
POST /api/users/login        - 登录
GET  /api/users/me           - 获取当前用户信息
PUT  /api/users/address      - 修改宿舍地址
```

### 5.2 拼单API
```
GET  /api/group-buys                    - 获取拼单列表
POST /api/group-buys                    - 创建拼单
GET  /api/group-buys/:id                - 获取拼单详情
PUT  /api/group-buys/:id/status          - 更新拼单状态
DELETE /api/group-buys/:id               - 删除拼单
GET  /api/group-buys/:id/cost-details   - 获取费用详情
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
POST /api/order-items     - 创建订单项
DELETE /api/order-items/:id - 删除订单项
```

### 5.5 支付API
```
POST /api/payments        - 创建支付记录
PUT  /api/payments/:id/confirm - 确认支付
```

## 6. 费用计算规则

### 6.1 运费规则

| 模式 | 条件 | 运费 | 包装费 | 生鲜附加费 | 平台酬劳 |
|------|------|------|--------|------------|----------|
| 山姆模式 | ≥99元 | 0元 | 1元 | 1元(如含生鲜) | 0.5元 |
| 京东模式 | <99元 | 5元 | 2元(含冰鲜) | 0 | 0.5元 |

### 6.2 团长优惠
- 优惠金额：2元
- 生效条件：拼单人数>1，且存在其他成员购买团长拆分商品
- 不生效情况：
  1. 只有团长一人
  2. 团长商品≥99元且未开启任何商品的"允许拆分"

### 6.3 分摊算法
1. 计算每人初步应付：个人商品金额 + 按比例分摊的附加费用
2. 应用团长优惠：团长减2元，其他成员均摊2元
3. 尾差处理：四舍五入到分，差额归平台

## 7. 拼单状态流转

```
拼单中 → 待付款 → 已下单 → 已送达 → 已完成
```

| 状态 | 触发动作 | 说明 |
|------|----------|------|
| 拼单中 | 创建后 | 成员可加入/修改商品 |
| 待付款 | 团长点击"停止招募" | 冻结商品选择，展示收款码 |
| 已下单 | 团长点击"已下单" | 需所有成员已付款 |
| 已送达 | 团长点击"确认送达" | 商品已取回至取货点 |
| 已完成 | 团长点击"完成"或7天后 | 拼单结束 |

## 8. 功能模块

### 8.1 注册登录
- 学号格式：8-10位字母或数字
- 手机号：可选，11位数字格式校验
- 头像上传：支持图片预览

### 8.2 拼单广场
- Tab筛选：全部/进行中/已完成
- 拼单卡片：显示标题、团长、进度、剩余时间、参与人数

### 8.3 创建拼单
- 取货地点：默认填充注册地址
- 截止时间：iOS风格滚轮选择器（分钟15倍数）
- 重复检查：检查±1小时内同类拼单

### 8.4 商品选购
- 支持整份购买和拆分购买
- 实时计算凑单进度

### 8.5 拼单详情
- 费用明细：商品费、包装费、运费、平台酬劳、团长优惠
- 成员管理：查看参与者、付款状态
- 团长操作：移除未付款成员、状态流转

### 8.6 我的拼单
- Tab切换：我发起的 / 我参与的
- 状态筛选：拼单中/已完成/已失效

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

1. **管理员运费预警**：商品含酒水/饮料且总金额>200元时，后台输出警告日志
2. **网页版适配**：最大宽度限制为 448px（max-w-md），移动端优先
3. **安全区域**：底部导航已适配 iOS safe-area-inset-bottom
