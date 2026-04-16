# 🦞 Mac mini 无头运行 OpenClaw（小龙虾）完整方案

## 方案概述

本方案解决的核心问题：**Mac mini 在初始配置完成后，拔掉显示器也能 7×24 小时自动运行 OpenClaw，无需任何手动干预。**

## 架构设计

```
┌─────────────────────────────────────────────────┐
│                  Mac mini (无头)                  │
│                                                   │
│  ┌─────────────┐    ┌──────────────────────────┐ │
│  │  LaunchAgent │───▶│  OpenClaw Gateway        │ │
│  │  (开机自启)   │    │  (后台常驻, 端口 18789)   │ │
│  │  (崩溃重启)   │    └──────────┬───────────────┘ │
│  └─────────────┘               │                  │
│                                │                  │
│  ┌─────────────┐    ┌──────────▼───────────────┐ │
│  │  Cron 定时    │───▶│  健康检查脚本              │ │
│  │  (每5分钟)    │    │  (进程/端口/磁盘监控)      │ │
│  └─────────────┘    └──────────────────────────┘ │
│                                                   │
│  ┌─────────────────────────────────────────────┐ │
│  │  SSH 远程访问 (端口 22)                       │ │
│  │  → openclaw tui / openclaw chat              │ │
│  └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
         ▲
         │ SSH / 局域网
         │
┌────────┴────────┐
│  你的主力机/手机  │
│  终端 / iPad SSH  │
└─────────────────┘
```

## 文件说明

| 文件 | 用途 |
|------|------|
| `install-openclaw-headless.sh` | 一键安装脚本（安装 OpenClaw + 配置守护进程 + 开机自启） |
| `openclaw-healthcheck.sh` | 健康检查脚本（进程监控、端口检测、自动恢复、磁盘告警） |

> 注：LaunchAgent plist 文件由安装脚本自动生成，无需手动创建。

## 快速开始

### 第一步：首次安装（只需一次）

```bash
# 1. 下载脚本
chmod +x install-openclaw-headless.sh

# 2. 运行安装
./install-openclaw-headless.sh

# 3. 完成 onboarding（首次需要交互式终端）
openclaw
# 按提示选择模型、配置 API Key 等

# 4. 启动守护进程
launchctl load -w ~/Library/LaunchAgents/com.openclaw.gateway.plist
```

### 第二步：拔掉显示器，享受无头运行 🎉

安装完成后，你可以：
- ✅ 拔掉显示器
- ✅ 拔掉键盘鼠标
- ✅ 只保留电源线和网线
- ✅ Mac mini 开机后自动启动 OpenClaw
- ✅ 崩溃后自动重启
- ✅ 每 5 分钟自动健康检查

### 第三步：远程管理

```bash
# 从主力机 SSH 连接
ssh yourname@192.168.x.x

# 进入交互界面
openclaw tui

# 命令行直接对话
openclaw chat "帮我整理桌面文件"

# 查看状态
openclaw gateway status

# 查看日志
tail -f ~/.openclaw/logs/gateway-stdout.log
```

## 核心组件详解

### 1. LaunchAgent 守护进程

macOS 原生的服务管理机制，功能：
- **RunAtLoad**: 开机自动启动
- **KeepAlive**: 进程退出后自动重启
- **NetworkState**: 网络恢复后自动重启
- **StandardOut/ErrorPath**: 自动记录日志

### 2. 健康检查脚本

每 5 分钟自动运行，检查项：
- OpenClaw 进程是否存在
- Gateway 端口是否正常监听
- 磁盘空间是否充足（>90% 告警）
- 异常时自动重启并记录日志

### 3. SSH 远程访问

macOS 内置 SSH 服务，启用后可从任何设备远程管理。

## 常用管理命令

```bash
# ========== 服务管理 ==========
launchctl load -w ~/Library/LaunchAgents/com.openclaw.gateway.plist   # 启用
launchctl unload ~/Library/LaunchAgents/com.openclaw.gateway.plist    # 停止
launchctl list | grep openclaw                                         # 查看状态

# ========== OpenClaw 管理 ==========
openclaw gateway start      # 启动 gateway
openclaw gateway stop       # 停止 gateway
openclaw gateway restart    # 重启 gateway
openclaw gateway status     # 查看状态
openclaw doctor --fix       # 修复配置
openclaw tui                # 交互界面
openclaw chat "消息"        # 命令行对话

# ========== 日志查看 ==========
tail -f ~/.openclaw/logs/gateway-stdout.log    # 标准输出
tail -f ~/.openclaw/logs/gateway-stderr.log    # 错误日志
tail -f ~/.openclaw/logs/healthcheck.log       # 健康检查日志

# ========== 技能管理 ==========
npx clawhub install <skill-name>    # 安装技能
openclaw gateway restart             # 安装后需重启
```

## 故障排查

| 问题 | 解决方案 |
|------|----------|
| 开机后 OpenClaw 没启动 | `launchctl list \| grep openclaw` 查看状态，检查 plist 路径 |
| 端口被占用 | `lsof -i :18789` 查看占用进程，`openclaw gateway restart` |
| Unknown model 错误 | 检查 `~/.openclaw/openclaw.json` 中的模型配置 |
| SSH 连不上 | 系统设置 → 通用 → 共享 → 远程登录 → 开启 |
| 进程反复崩溃 | 查看 `~/.openclaw/logs/gateway-stderr.log` 定位原因 |

## 进阶配置（可选）

### 设置 Mac mini 定时开机

系统设置 → 电池 → 定时启动/关机 → 设置每天开机时间

### 配置内网穿透（外网访问）

推荐使用 Tailscale（免费、简单）：
```bash
brew install tailscale
sudo tailscale up
# 之后可通过 Tailscale IP 从任何网络 SSH 连接
```

### 配置邮件告警

编辑 `~/.openclaw/scripts/openclaw-healthcheck.sh`，设置 `ALERT_EMAIL` 变量：
```bash
ALERT_EMAIL="your@email.com"
```

## 注意事项

1. **首次 onboarding 必须在交互式终端完成**（需要选择模型、输入 API Key 等）
2. **onboarding 完成后**，后续所有操作均可无头进行
3. 建议使用 **UPS 不间断电源**，防止断电导致数据异常
4. 定期检查 `~/.openclaw/logs/` 下的日志文件大小
5. OpenClaw 版本更新：`openclaw update` 或重新运行安装脚本
