# 🦞 Mac mini 无头运行 OpenClaw — 故障排查完全指南

## 目录

1. [安装阶段问题](#1-安装阶段问题)
2. [网络与连接问题](#2-网络与连接问题)
3. [OpenClaw 运行问题](#3-openclaw-运行问题)
4. [远程访问问题](#4-远程访问问题)
5. [Tailscale 问题](#5-tailscale-问题)
6. [电源与系统问题](#6-电源与系统问题)
7. [性能与资源问题](#7-性能与资源问题)
8. [安全相关问题](#8-安全相关问题)
9. [日常维护命令速查](#9-日常维护命令速查)

---

## 1. 安装阶段问题

### 1.1 Homebrew 安装失败

**症状**: `curl: (7) Failed to connect` 或 `Installation failed`

**原因与解决方案**:

| 原因 | 解决方案 |
|------|----------|
| 网络超时 | 配置代理: `export ALL_PROXY=socks5://127.0.0.1:1080` |
| DNS 解析失败 | `sudo networksetup -setdnsservers Wi-Fi 8.8.8.8 114.114.114.114` |
| GitHub 被墙 | 使用国内镜像: `https://mirrors.tuna.tsinghua.edu.cn/help/homebrew/` |
| 证书问题 | `export GIT_SSL_NO_VERIFY=1` |

**国内镜像安装**:
```bash
# 清华镜像
export HOMEBREW_API_DOMAIN="https://mirrors.tuna.tsinghua.edu.cn/homebrew-bottles/api"
export HOMEBREW_BOTTLE_DOMAIN="https://mirrors.tuna.tsinghua.edu.cn/homebrew-bottles"
export HOMEBREW_BREW_GIT_REMOTE="https://mirrors.tuna.tsinghua.edu.cn/git/homebrew/brew.git"
export HOMEBREW_CORE_GIT_REMOTE="https://mirrors.tuna.tsinghua.edu.cn/git/homebrew/homebrew-core.git"
/bin/bash -c "$(curl -fsSL https://mirrors.tuna.tsinghua.edu.cn/misc/homebrew-install.sh)"
```

### 1.2 Node.js 版本冲突

**症状**: `openclaw: Node.js version too old` 或 `NODE_MODULE_VERSION mismatch`

**解决方案**:
```bash
# 方案 A: 使用 nvm 管理多版本
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh | bash
source ~/.zshrc
nvm install 22
nvm use 22
nvm alias default 22

# 方案 B: 通过 Homebrew 指定版本
brew unlink node 2>/dev/null
brew install node@22
brew link --overwrite node@22

# 验证
node -v  # 应输出 v22.x.x
```

### 1.3 OpenClaw 安装失败

**症状**: `command not found: openclaw` 或安装脚本报错

**排查步骤**:
```bash
# 1. 检查 PATH
echo $PATH | tr ':' '\n' | grep local

# 2. 手动添加 PATH
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc

# 3. 检查安装位置
ls -la ~/.local/bin/openclaw

# 4. 如果文件存在但不可执行
chmod +x ~/.local/bin/openclaw

# 5. 重新安装
curl -fsSL https://openclaw.ai/install.sh | bash
```

### 1.4 磁盘空间不足

**症状**: `No space left on device`

**清理方案**:
```bash
# 查看磁盘使用
df -h ~

# 清理 Homebrew 缓存
brew cleanup --prune=all

# 清理 npm 缓存
npm cache clean --force

# 清理系统日志
sudo rm -rf /private/var/log/asl/*.asl
sudo rm -rf /Library/Logs/*

# 清理 Xcode 缓存（如果安装了）
rm -rf ~/Library/Developer/Xcode/DerivedData/*
rm -rf ~/Library/Developer/Xcode/Archives/*

# 清理垃圾桶
sudo rm -rf ~/.Trash/*

# 查找大文件
du -sh ~/Library/Caches/* | sort -rh | head -10
```

---

## 2. 网络与连接问题

### 2.1 Mac mini 无法联网

**排查步骤**:
```bash
# 1. 检查网络接口
ifconfig en0 | grep "status"

# 2. 检查 WiFi 连接
networksetup -getinfo Wi-Fi

# 3. 检查 DNS
nslookup apple.com
# 如果失败，重置 DNS
sudo dscacheutil -flushcache
sudo killall -HUP mDNSResponder

# 4. 检查网关
netstat -rn | grep default

# 5. 重置网络
sudo ifconfig en0 down && sudo ifconfig en0 up
# 或重启 WiFi
networksetup -setairportpower en0 off && networksetup -setairportpower en0 on
```

### 2.2 Bonjour/mDNS 不工作

**症状**: `ssh user@my-mini.local` 连不上，但 IP 可以

**解决方案**:
```bash
# 1. 检查 mDNS 服务
sudo launchctl list | grep mDNSResponder

# 2. 重启 mDNS
sudo killall -HUP mDNSResponder

# 3. 检查主机名
scutil --get LocalHostName
# 如果为空，设置:
sudo scutil --set LocalHostName "my-mini"
sudo scutil --set HostName "my-mini"

# 4. 检查防火墙是否阻止
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate

# 5. 临时方案: 直接用 IP
ipconfig getifaddr en0  # 获取 IP
ssh user@<IP>
```

### 2.3 端口被占用

**症状**: `Address already in use` 或 OpenClaw gateway 启动失败

**排查与解决**:
```bash
# 查看端口占用
lsof -i :18789

# 终止占用进程
kill -9 <PID>

# 如果是旧 OpenClaw 进程
pkill -f "openclaw.*gateway"
openclaw gateway restart

# 修改端口（如果需要）
export GATEWAY_PORT=18800
openclaw gateway start --port 18800
```

---

## 3. OpenClaw 运行问题

### 3.1 Gateway 启动失败

**排查步骤**:
```bash
# 1. 查看错误日志
tail -50 ~/.openclaw/logs/gateway-stderr.log

# 2. 常见错误及解决:

# 错误: "Unknown model: volcengine/..."
# 解决: 编辑配置文件，删除残留的 volcengine 配置
nano ~/.openclaw/openclaw.json
# 删除 auth.profiles.volcengine 相关内容
openclaw doctor --fix

# 错误: "EADDRINUSE" (端口被占用)
# 解决: 见 2.3

# 错误: "LLM request timed out"
# 解决: 检查网络/代理，或换模型

# 错误: "permission denied"
# 解决: 检查文件权限
chmod -R 755 ~/.openclaw
```

### 3.2 Unknown Model 错误

**症状**: `Error: Unknown model: volcengine/doubao-seed-...`

**解决方案**:
```bash
# 1. 修复配置
openclaw doctor --fix

# 2. 手动编辑配置
nano ~/.openclaw/openclaw.json

# 3. 确保配置格式正确（示例）:
# {
#   "models": {
#     "providers": {
#       "ark": {
#         "baseUrl": "https://ark.cn-beijing.volces.com/api/v3",
#         "apiKey": "你的key",
#         "api": "openai-completions",
#         "models": [{
#           "id": "doubao-seed-2-0-pro-260215",
#           "name": "豆包 Seed 2.0 Pro",
#           "contextWindow": 256000,
#           "maxTokens": 128000
#         }]
#       }
#     }
#   },
#   "agents": {
#     "defaults": {
#       "model": {
#         "primary": "ark/doubao-seed-2-0-pro-260215"
#       }
#     }
#   }
# }

# 4. 重启
openclaw gateway restart
```

### 3.3 模型响应超时

**症状**: `LLM request timed out` 或长时间无响应

**排查**:
```bash
# 1. 测试网络到模型 API 的连通性
curl -s --connect-timeout 10 https://ark.cn-beijing.volces.com/api/v3/models \
  -H "Authorization: Bearer 你的key" | head -20

# 2. 如果超时，检查代理设置
echo $ALL_PROXY
echo $HTTPS_PROXY

# 3. 配置代理（如果需要）
export HTTPS_PROXY=http://127.0.0.1:7890
# 写入配置持久化
echo 'export HTTPS_PROXY=http://127.0.0.1:7890' >> ~/.zshrc

# 4. 换更快的模型或更近的 API 节点
```

### 3.4 Skills 安装失败

**症状**: `npx clawhub install xxx` 报错

**解决方案**:
```bash
# 1. 检查 npx
npx --version
# 如果不可用，重装 Node.js

# 2. 检查网络（npm registry 可能被墙）
npm config get registry
# 换国内镜像
npm config set registry https://registry.npmmirror.com

# 3. 清理 npx 缓存
npm cache clean --force

# 4. 手动安装 skill
# 查看已安装的 skills
ls ~/.openclaw/workspace/skills/

# 5. 检查权限
chmod -R 755 ~/.openclaw/workspace/skills/
```

### 3.5 LaunchAgent 不工作

**症状**: 开机后 OpenClaw 没有自动启动

**排查步骤**:
```bash
# 1. 检查服务状态
launchctl list | grep openclaw

# 2. 检查 plist 语法
plutil -lint ~/Library/LaunchAgents/com.openclaw.gateway.plist

# 3. 查看系统日志
log show --predicate 'subsystem == "com.apple.xpc.launchd"' --last 5m | grep openclaw

# 4. 手动加载
launchctl unload ~/Library/LaunchAgents/com.openclaw.gateway.plist
launchctl load -w ~/Library/LaunchAgents/com.openclaw.gateway.plist

# 5. 检查路径是否正确
grep ProgramArguments ~/Library/LaunchAgents/com.openclaw.gateway.plist
# 确认 openclaw 路径存在
ls -la ~/.local/bin/openclaw

# 6. 如果 PATH 问题，在 plist 的 EnvironmentVariables 中添加完整路径

# 7. 查看服务退出原因
launchctl list com.openclaw.gateway
# 如果看到 exit code，对照:
# 0 = 正常退出 (KeepAlive 会重启)
# 127 = 命令找不到 (检查路径)
# 126 = 权限不足 (chmod +x)
# 1 = 程序错误 (查看 stderr 日志)
```

---

## 4. 远程访问问题

### 4.1 SSH 连不上

**排查步骤**:
```bash
# 在 Mac mini 上检查（需要显示器或已有访问权限）:

# 1. SSH 服务状态
sudo systemsetup -getremotelogin
# 如果 Off，开启:
sudo systemsetup -setremotelogin on

# 2. SSH 服务是否在运行
sudo launchctl list | grep ssh
# 如果没有，启动:
sudo launchctl load -w /System/Library/LaunchDaemons/ssh.plist

# 3. 检查端口
sudo lsof -i :22

# 4. 检查防火墙
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate

# 5. 检查用户是否允许 SSH
# 系统设置 → 通用 → 共享 → 远程登录 → 确认你的用户在列表中

# 从 MacBook 上测试:
# ssh -v user@host.local  # -v 显示详细连接过程
```

### 4.2 VNC/屏幕共享连不上

**排查步骤**:
```bash
# 1. 检查屏幕共享服务
sudo launchctl list | grep screensharing

# 2. 如果没有，启动
sudo launchctl load -w /System/Library/LaunchDaemons/com.apple.screensharing.plist

# 3. macOS Ventura+ 的启动方式
sudo /System/Library/CoreServices/RemoteManagement/ARDAgent.app/Contents/Resources/kickstart \
  -activate -configure -access -on \
  -users $(whoami) -privs -all \
  -restart -agent

# 4. 检查端口
sudo lsof -i :5900

# 5. 检查防火墙是否阻止 VNC
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --listapp

# 6. 重启屏幕共享
sudo launchctl unload /System/Library/LaunchDaemons/com.apple.screensharing.plist
sudo launchctl load -w /System/Library/LaunchDaemons/com.apple.screensharing.plist
```

### 4.3 远程连接后终端乱码

**解决方案**:
```bash
# 在 Mac mini 上设置 locale
echo 'export LANG=zh_CN.UTF-8' >> ~/.zshrc
echo 'export LC_ALL=zh_CN.UTF-8' >> ~/.zshrc
source ~/.zshrc

# 在 MacBook 的 SSH 客户端中设置编码
# iTerm2: Preferences → Profiles → Terminal → Character Encoding → UTF-8
# Terminal.app: 偏好设置 → 描述文件 → 终端 → 字符编码 → UTF-8
```

---

## 5. Tailscale 问题

### 5.1 Tailscale 安装失败

**解决方案**:
```bash
# 方案 A: Homebrew
brew install --cask tailscale

# 方案 B: 手动下载
# 访问 https://tailscale.com/download/mac 下载 DMG

# 方案 C: 直接下载 PKG
curl -fL "https://pkgs.tailscale.com/stable/Tailscale-latest-macos.pkg" -o /tmp/tailscale.pkg
sudo installer -pkg /tmp/tailscale.pkg -target /
```

### 5.2 Tailscale 登录失败

**症状**: `tailscale up` 后无响应或报错

**解决方案**:
```bash
# 1. 检查状态
tailscale status

# 2. 重新登录
tailscale logout
tailscale up

# 3. 如果浏览器不弹出，手动获取登录链接
tailscale up --login-server=https://login.tailscale.com

# 4. 检查 Tailscale.app 是否在运行
pgrep -f Tailscale
# 如果没有，启动:
open -a Tailscale

# 5. 检查网络（Tailscale 需要访问协调服务器）
curl -s https://login.tailscale.com >/dev/null && echo "OK" || echo "FAIL"
```

### 5.3 两台设备互相看不到

**排查步骤**:
```bash
# 1. 确认两台设备登录同一个账号
tailscale status --self
# 检查用户名/邮箱是否一致

# 2. 查看所有设备
tailscale status

# 3. 如果设备不在列表中
# - 确认两台设备都已登录
# - 在 Tailscale 管理后台检查: https://login.tailscale.com/admin/machines

# 4. 检查 ACL 规则（管理后台）
# 确保没有阻止设备间通信的规则

# 5. 强制重新连接
tailscale down && tailscale up
```

### 5.4 Tailscale 连接慢或断开

**解决方案**:
```bash
# 1. 检查连接类型（直连 vs 中继）
tailscale status
# "direct" = 直连（快）
# "relay" = DERP 中继（慢）
# "--" = 未连接

# 2. 如果是 relay，尝试强制直连
tailscale ping <对方IP>

# 3. 检查 NAT 穿透
tailscale netcheck

# 4. 重启 Tailscale
tailscale down && tailscale up

# 5. 更新 Tailscale
brew upgrade tailscale
```

### 5.5 Shields Up 后无法被访问

**症状**: 开启 Shields Up 后 MacBook 连不上 Mac mini

**说明**: Shields Up 是**单向**的，在 MacBook 上开启会影响 Mac mini 连接 MacBook，在 Mac mini 上开启会影响 MacBook 连接 Mac mini。

```bash
# 确认 Shields Up 状态
tailscale status --self | grep shields

# 关闭 Shields Up
tailscale set --shields-up=false

# 重新开启（确认在正确的设备上）
tailscale set --shields-up=true
```

---

## 6. 电源与系统问题

### 6.1 Mac mini 自动睡眠

**症状**: 一段时间后无法远程连接

**排查与解决**:
```bash
# 1. 检查当前设置
pmset -g

# 2. 修复: 禁止所有睡眠
sudo pmset -a sleep 0
sudo pmset -a disksleep 0
sudo pmset -a displaysleep 0
sudo pmset -a womp 1
sudo pmset -a autorestart 1
sudo pmset -a powernap 0

# 3. 验证
pmset -g | grep -E "sleep|disksleep|autorestart|womp"

# 4. 如果 pmset 不生效，检查是否有其他覆盖
# 系统设置 → 电池 → 选项 → 确保没有"启用 Power Nap"
# 系统设置 → 锁定屏幕 → 确保"在此时间后关闭显示器"不影响睡眠
```

### 6.2 断电后不自动开机

**排查**:
```bash
# 1. 检查设置
pmset -g | grep autorestart

# 2. 如果不是 1
sudo pmset -a autorestart 1

# 3. 检查固件是否支持
# 部分 Mac mini 需要在 NVRAM 中设置
sudo nvram AutoBoot=%00  # 关闭自动开机
sudo nvram AutoBoot=%03  # 开启自动开机（断电恢复）

# 4. 如果以上都不行，可能是硬件限制
# 检查: 系统设置 → 电池 → 定时启动/关机 → 设置开机时间
```

### 6.3 Mac mini 风扇噪音大

**解决方案**:
```bash
# 1. 检查 CPU 温度和负载
sudo powermetrics --samplers smc -i 1 -n 1

# 2. 检查是否有高 CPU 进程
top -l 1 -o cpu -n 10

# 3. 如果是 OpenClaw 导致的
# - 检查是否有死循环的 skill
# - 降低模型调用频率
# - 检查日志是否有大量错误重试

# 4. 清理系统缓存
sudo purge
```

---

## 7. 性能与资源问题

### 7.1 内存不足

**症状**: 系统卡顿、swap 使用高

**排查与解决**:
```bash
# 1. 查看内存使用
memory_pressure
vm_stat

# 2. 查看内存占用最多的进程
ps aux --sort=-%mem | head -10

# 3. 查看 swap
sysctl vm.swapusage

# 4. 清理内存
sudo purge

# 5. 如果经常内存不足
# - 关闭不必要的程序
# - 增加 swap（不推荐，会降低 SSD 寿命）
# - 考虑升级内存（Mac mini M 系列统一内存，购买时选好）
```

### 7.2 CPU 占用过高

**排查**:
```bash
# 1. 查看 CPU 占用
top -l 1 -o cpu -n 20

# 2. 持续监控
sudo powermetrics --samplers cpu_power -i 5000 -n 3

# 3. 如果是 OpenClaw 进程占用高
# 检查是否有异常任务
openclaw gateway status

# 4. 限制 OpenClaw 资源（通过 nice 命令）
# 在 LaunchAgent plist 中添加:
# <key>Nice</key>
# <integer>10</integer>
```

### 7.3 磁盘 IO 过高

**排查**:
```bash
# 1. 查看 IO 活动
sudo iostat -w 3

# 2. 查看哪些进程在大量读写
sudo fs_usage -w -f filesys | head -50

# 3. 如果是日志文件过大
du -sh ~/.openclaw/logs/*
# 清理或轮转日志
# 健康检查脚本已内置日志轮转功能
```

---

## 8. 安全相关问题

### 8.1 SSH 暴力破解

**防护措施**:
```bash
# 1. 禁用密码登录，仅用密钥
# 编辑 /etc/ssh/sshd_config:
sudo nano /etc/ssh/sshd_config
# 添加/修改:
# PasswordAuthentication no
# PubkeyAuthentication yes

# 2. 生成密钥对（在 MacBook 上）
ssh-keygen -t ed25519 -C "your@email.com"

# 3. 上传公钥到 Mac mini
ssh-copy-id user@mac-mini.local

# 4. 更换默认端口（可选）
# 在 /etc/ssh/sshd_config 中修改 Port 22 为其他端口
# 同时修改 LaunchAgent 中的端口配置

# 5. 使用 fail2ban（需安装）
brew install fail2ban
# 配置 /usr/local/etc/fail2ban/jail.local
```

### 8.2 Tailscale 安全配置

**最佳实践**:
```bash
# 1. 在 Tailscale 管理后台设置 ACL
# https://login.tailscale.com/admin/acls
# 示例 ACL:
# {
#   "acls": [
#     {"action": "accept", "src": ["your-macbook"], "dst": ["mac-mini:*"]},
#     {"action": "deny",   "src": ["*"],          "dst": ["mac-mini:*"]}
#   ]
# }

# 2. 启用 key expiry（定期需要重新认证）
# 管理后台 → Settings → Key expiry → 启用

# 3. 在 Mac mini 上开启 Shields Up
tailscale set --shields-up=true
```

---

## 9. 日常维护命令速查

### 服务管理
```bash
# OpenClaw Gateway
openclaw gateway start        # 启动
openclaw gateway stop         # 停止
openclaw gateway restart      # 重启
openclaw gateway status       # 状态

# LaunchAgent
launchctl load -w ~/Library/LaunchAgents/com.openclaw.gateway.plist    # 启用
launchctl unload ~/Library/LaunchAgents/com.openclaw.gateway.plist     # 停用
launchctl list | grep openclaw                                         # 查看状态

# Tailscale
tailscale up                   # 连接
tailscale down                 # 断开
tailscale status               # 查看所有设备
tailscale ip -4                # 查看本机 IP
tailscale ping <IP>            # 测试连通性
tailscale set --shields-up=true   # 开启防火墙
tailscale set --shields-up=false  # 关闭防火墙
```

### 日志查看
```bash
# OpenClaw 日志
tail -f ~/.openclaw/logs/gateway-stdout.log    # 标准输出
tail -f ~/.openclaw/logs/gateway-stderr.log    # 错误日志
tail -f ~/.openclaw/logs/healthcheck.log       # 健康检查日志
tail -f ~/.openclaw/logs/cron.log              # Cron 执行日志

# 系统日志
log show --predicate 'process == "openclaw"' --last 10m    # OpenClaw 系统日志
log show --predicate 'eventMessage contains "openclaw"' --last 1h

# LaunchAgent 日志
log show --predicate 'subsystem == "com.apple.xpc.launchd"' --last 5m | grep openclaw
```

### 诊断命令
```bash
# 一键诊断
openclaw doctor --fix         # OpenClaw 自修复

# 系统状态
pmset -g                      # 电源管理
memory_pressure               # 内存压力
df -h ~                       # 磁盘空间
top -l 1 -o cpu -n 10        # CPU 占用

# 网络诊断
ifconfig en0                  # 网络接口
netstat -rn | grep default    # 默认网关
scutil --get LocalHostName    # 主机名
ping -c 3 8.8.8.8            # 网络连通性
nc -zv 127.0.0.1 18789       # 端口检测

# Tailscale 诊断
tailscale status              # 设备列表
tailscale netcheck            # NAT 穿透检测
tailscale debug prefs         # 配置查看
```

### 技能管理
```bash
# 安装技能
npx clawhub install <skill-name>

# 查看已安装技能
ls ~/.openclaw/workspace/skills/

# 安装后重启
openclaw gateway restart
```

### 紧急恢复
```bash
# 如果一切都不工作，终极恢复方案:

# 1. 接上显示器和键盘
# 2. 登录系统
# 3. 运行修复
openclaw doctor --fix
openclaw gateway restart

# 4. 如果还不行，完全重装
openclaw uninstall --all --yes
curl -fsSL https://openclaw.ai/install.sh | bash
openclaw  # 重新 onboarding

# 5. 重新加载守护进程
launchctl unload ~/Library/LaunchAgents/com.openclaw.gateway.plist
launchctl load -w ~/Library/LaunchAgents/com.openclaw.gateway.plist
```
