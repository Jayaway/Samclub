/**
 * 输入验证中间件
 * 提供请求体、URL参数校验，以及字符串转义工具函数
 */

/**
 * HTML转义函数，防止XSS攻击
 * @param {string} str - 需要转义的字符串
 * @returns {string} 转义后的安全字符串
 */
export function sanitizeString(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * 转义SQL LIKE通配符
 * 将 % _ 等特殊字符转义，防止LIKE注入
 * @param {string} str - 需要转义的字符串
 * @returns {string} 转义后的字符串
 */
export function escapeLike(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/[%_\\]/g, '\\$&');
}

/**
 * 校验请求体中间件
 * @param {Object} schema - 校验规则
 *   { field: { required: boolean, type: string, maxLength?: number, pattern?: RegExp, custom?: (val) => string|null } }
 * @returns {Function} Express中间件
 */
export function validateBody(schema) {
  return (req, res, next) => {
    const errors = [];

    for (const [field, rules] of Object.entries(schema)) {
      const value = req.body[field];

      // 必填校验
      if (rules.required && (value === undefined || value === null || value === '')) {
        errors.push(`${field} 为必填项`);
        continue;
      }

      // 如果值不存在且非必填，跳过后续校验
      if (value === undefined || value === null) continue;

      // 类型校验
      if (rules.type) {
        const actualType = Array.isArray(value) ? 'array' : typeof value;
        if (actualType !== rules.type) {
          errors.push(`${field} 类型应为 ${rules.type}`);
          continue;
        }
      }

      // 最大长度校验
      if (rules.maxLength && typeof value === 'string' && value.length > rules.maxLength) {
        errors.push(`${field} 长度不能超过 ${rules.maxLength} 个字符`);
      }

      // 正则校验
      if (rules.pattern && typeof value === 'string' && !rules.pattern.test(value)) {
        errors.push(`${field} 格式不正确`);
      }

      // 自定义校验函数
      if (rules.custom && typeof rules.custom === 'function') {
        const customError = rules.custom(value);
        if (customError) {
          errors.push(customError);
        }
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({ error: errors.join('; ') });
    }

    next();
  };
}

/**
 * 校验URL参数中间件
 * @param {Object} schema - 校验规则（同 validateBody）
 * @returns {Function} Express中间件
 */
export function validateParams(schema) {
  return (req, res, next) => {
    const errors = [];

    for (const [field, rules] of Object.entries(schema)) {
      const value = req.params[field];

      // 必填校验
      if (rules.required && (value === undefined || value === null || value === '')) {
        errors.push(`${field} 为必填参数`);
        continue;
      }

      if (value === undefined || value === null) continue;

      // 类型校验（URL参数均为字符串，这里主要做数字等类型转换校验）
      if (rules.type === 'number') {
        if (isNaN(Number(value))) {
          errors.push(`${field} 应为数字`);
        }
      }

      // 正则校验
      if (rules.pattern && !rules.pattern.test(value)) {
        errors.push(`${field} 格式不正确`);
      }

      // 自定义校验函数
      if (rules.custom && typeof rules.custom === 'function') {
        const customError = rules.custom(value);
        if (customError) {
          errors.push(customError);
        }
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({ error: errors.join('; ') });
    }

    next();
  };
}
