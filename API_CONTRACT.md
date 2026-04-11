# 校园山姆拼单 - API 接口文档

> 本文档是前后端共享的接口约定，所有 API 必须严格遵循此文档定义。
> 版本: 1.0.0 | 更新日期: 2026-04-09

---

## 1. 基础信息

- **Base URL**: `/api`
- **数据格式**: JSON
- **认证方式**: 请求体中携带 `user_id` 字段

---

## 2. 用户接口

### 2.1 用户注册
```
POST /api/users/register
```

**请求体**:
```json
{
  "student_id": "学号",
  "nickname": "昵称",
  "dorm_building": "宿舍楼（可选）"
}
```

**响应 (201)**:
```json
{
  "id": 1,
  "student_id": "2021001234",
  "nickname": "张三",
  "avatar": "",
  "dorm_building": "",
  "credit_score": 100
}
```

---

### 2.2 用户登录
```
POST /api/users/login
```

**请求体**:
```json
{
  "student_id": "学号"
}
```

**响应 (200)**:
```json
{
  "id": 1,
  "student_id": "2021001234",
  "nickname": "张三",
  "avatar": "",
  "credit_score": 100
}
```

**错误响应 (404)**:
```json
{
  "error": "用户不存在"
}
```

---

### 2.3 获取当前用户信息
```
GET /api/users/me
```

**请求头**: `X-User-Id: {user_id}`

**响应 (200)**:
```json
{
  "id": 1,
  "student_id": "2021001234",
  "nickname": "张三",
  "avatar": "",
  "dorm_building": "",
  "credit_score": 100
}
```

---

## 3. 拼单接口

### 3.1 获取拼单列表
```
GET /api/group-buys
```

**查询参数**:
| 参数 | 类型 | 说明 |
|------|------|------|
| status | string | 状态筛选（进行中/已完成/已取消） |
| sort | string | 排序方式（默认 created_at DESC） |

**响应 (200)**:
```json
[
  {
    "id": 1,
    "creator_id": 1,
    "title": "山姆拼单-4月批次",
    "deadline": "2026-04-15T18:00:00.000Z",
    "status": "进行中",
    "pickup_location": "东门快递站",
    "total_amount": 156.50,
    "delivery_mode": "sam",
    "has_frozen": true,
    "total_cost": 160.00,
    "progress": 100,
    "leader_name": "张三",
    "leader_avatar": "",
    "member_count": 5,
    "created_at": "2026-04-09T10:00:00.000Z"
  }
]
```

---

### 3.2 获取拼单详情
```
GET /api/group-buys/:id
```

**响应 (200)**:
```json
{
  "id": 1,
  "creator_id": 1,
  "title": "山姆拼单-4月批次",
  "deadline": "2026-04-15T18:00:00.000Z",
  "status": "进行中",
  "pickup_location": "东门快递站",
  "leader_name": "张三",
  "leader_avatar": "",
  "total_amount": 156.50,
  "has_frozen": true,
  "mode": "sam",
  "packaging": 1,
  "delivery": 0,
  "frozen": 1,
  "reward": 0.5,
  "products": [
    {
      "id": 1,
      "name": "瑞士卷",
      "original_price": 68,
      "total_quantity": 2,
      "remaining_quantity": 1,
      "is_split_allowed": true,
      "is_frozen": 0,
      "unit_price": 34
    }
  ],
  "orderItems": [
    {
      "id": 1,
      "product_id": 1,
      "user_id": 1,
      "product_name": "瑞士卷",
      "is_frozen": 0,
      "user_name": "张三",
      "quantity": 1,
      "subtotal": 34
    }
  ],
  "members": [
    {
      "id": 1,
      "nickname": "张三",
      "avatar": ""
    }
  ],
  "costDetails": [
    {
      "id": 1,
      "user_id": 1,
      "user_name": "张三",
      "base_amount": 34,
      "share_fee": 1.28,
      "leader_discount": 0,
      "final_amount": 35.28,
      "paid_status": "未付"
    }
  ]
}
```

---

### 3.3 创建拼单
```
POST /api/group-buys
```

**请求体**:
```json
{
  "creator_id": 1,
  "title": "山姆拼单-4月批次",
  "deadline": "2026-04-15T18:00:00.000Z",
  "pickup_location": "东门快递站",
  "products": [
    {
      "name": "瑞士卷",
      "original_price": 68,
      "total_quantity": 2,
      "remaining_quantity": 2,
      "is_split_allowed": true,
      "is_frozen": false,
      "unit_price": 34
    }
  ]
}
```

**响应 (201)**:
```json
{
  "id": 1,
  "creator_id": 1,
  "title": "山姆拼单-4月批次",
  "deadline": "2026-04-15T18:00:00.000Z",
  "status": "进行中",
  "pickup_location": "东门快递站"
}
```

---

### 3.4 更新拼单状态
```
PUT /api/group-buys/:id/status
```

**请求体**:
```json
{
  "status": "已完成"
}
```

**响应 (200)**:
```json
{
  "id": 1,
  "status": "已完成"
}
```

---

## 4. 商品接口

### 4.1 添加商品
```
POST /api/products
```

**请求体**:
```json
{
  "group_buy_id": 1,
  "name": "麻薯",
  "original_price": 59.8,
  "total_quantity": 3,
  "remaining_quantity": 3,
  "is_split_allowed": true,
  "is_frozen": false,
  "unit_price": 19.93
}
```

**响应 (201)**:
```json
{
  "id": 2,
  "group_buy_id": 1,
  "name": "麻薯",
  "original_price": 59.8,
  "total_quantity": 3,
  "remaining_quantity": 3,
  "is_split_allowed": true,
  "is_frozen": false,
  "unit_price": 19.93
}
```

---

### 4.2 删除商品
```
DELETE /api/products/:id
```

**响应 (200)**:
```json
{
  "success": true
}
```

---

## 5. 订单接口

### 5.1 添加订单项
```
POST /api/order-items
```

**请求体**:
```json
{
  "group_buy_id": 1,
  "user_id": 1,
  "product_id": 1,
  "quantity": 2
}
```

**响应 (201)**:
```json
{
  "id": 1,
  "group_buy_id": 1,
  "user_id": 1,
  "product_id": 1,
  "quantity": 2,
  "subtotal": 68
}
```

---

### 5.2 删除订单项
```
DELETE /api/order-items/:id
```

**响应 (200)**:
```json
{
  "success": true
}
```

---

## 6. 费用接口

### 6.1 获取费用分摊详情
```
GET /api/group-buys/:id/cost-details
```

**响应 (200)**:
```json
{
  "costDetails": [
    {
      "id": 1,
      "user_id": 1,
      "user_name": "张三",
      "base_amount": 68,
      "share_fee": 1.28,
      "leader_discount": 0,
      "final_amount": 69.28,
      "paid_status": "未付"
    }
  ],
  "totalCost": 70.50,
  "mode": "sam",
  "has_frozen": false,
  "packaging": 1,
  "delivery": 0,
  "frozen": 0,
  "reward": 0.5
}
```

---

## 7. 支付接口

### 7.1 提交付款凭证
```
POST /api/payments
```

**请求体**:
```json
{
  "group_buy_id": 1,
  "user_id": 1,
  "amount": 69.28,
  "proof_image": "data:image/png;base64,..."
}
```

**响应 (201)**:
```json
{
  "id": 1,
  "group_buy_id": 1,
  "user_id": 1,
  "amount": 69.28,
  "status": "待确认"
}
```

---

### 7.2 确认付款
```
PUT /api/payments/:id/confirm
```

**请求体**:
```json
{
  "status": "已确认"
}
```

**响应 (200)**:
```json
{
  "id": 1,
  "status": "已确认"
}
```

---

### 7.3 批量确认付款
```
POST /api/payments/batch-confirm
```

**请求体**:
```json
{
  "payment_ids": [1, 2, 3],
  "status": "已确认"
}
```

**响应 (200)**:
```json
{
  "success": true,
  "updated": 3
}
```

---

## 8. 错误响应格式

所有错误响应遵循以下格式:
```json
{
  "error": "错误描述"
}
```

HTTP 状态码:
- 400: 请求参数错误
- 404: 资源不存在
- 500: 服务器内部错误

---

## 9. 费用计算规则

### 9.1 配送模式判断
- 商品总额 ≥ 99元: 山姆模式
- 商品总额 < 99元: 京东模式

### 9.2 费用配置
| 费用项 | 山姆模式 | 京东模式 |
|--------|---------|---------|
| 包装费 | 1元 | 1.2元 |
| 运费 | 0元 | 5元 |
| 生鲜附加费 | 2元（如有） | 2元（如有） |
| 平台酬劳 | 0.5元 | 0.5元 |

### 9.3 费用分摊规则
**重要**: 所有成员（包括发起人）平等分摊费用，无团长优惠。

每人应付 = 个人商品金额 + (个人商品金额 / 总商品金额) × (包装费 + 运费 + 生鲜附加费 + 酬劳)

### 9.4 计算示例
假设商品总额 128 元（含生鲜），山姆模式：
- 总成本 = 128 + 1(包装) + 2(生鲜) + 0.5(酬劳) = 131.5 元
- A 买了 64 元，应付 = 64 + 64/128 × 3.5 = 64 + 1.75 = 65.75 元
- B 买了 64 元，应付 = 64 + 64/128 × 3.5 = 64 + 1.75 = 65.75 元

---

## 10. 变更记录

| 版本 | 日期 | 变更内容 |
|------|------|---------|
| 1.0.0 | 2026-04-09 | 初始版本 |
| 1.0.1 | 2026-04-09 | 修正生鲜附加费为2元，明确无团长优惠规则 |
