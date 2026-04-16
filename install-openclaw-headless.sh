#!/bin/bash
# ============================================================
#  OpenClaw (小龙虾) Mac mini 无头一键安装脚本
#  功能：自动安装 OpenClaw + 配置守护进程 + 开机自启
#  使用：chmod +x install-openclaw-headless.sh && ./install-openclaw-headless.sh
# ============================================================

set -euo pipefail

# ---------- 颜色定义 ----------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info()  { echo -e "${GREEN}[INFO]${NC}  $*"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $*"; }
log_step()  { echo -e "${BLUE}[STEP]${NC}  $*"; }

# ---------- 配置项（可按需修改） ----------
OPENCLAW_INSTALL_DIR="$HOME/.local/bin"
OPENCLAW_CONFIG_DIR="$HOME/.openclaw"
OPENCLAW_LOG_DIR="$HOME/.openclaw/logs"
LAUNCH_AGENT_DIR="$HOME/Library/LaunchAgents"
PLIST_FILE="$LAUNCH_AGENT_DIR/com.openclaw.gateway.plist"
HEALTHCHECK_SCRIPT="$HOME/.openclaw/scripts/openclaw-healthcheck.sh"
GATEWAY_PORT="${GATEWAY_PORT:-18789}"

# ---------- 前置检查 ----------
log_step "1/7 检查系统环境..."

# 检查 macOS
if [[ "$(uname)" != "Darwin" ]]; then
    log_error "此脚本仅支持 macOS"
    exit 1
fi

log_info "系统: $(sw_vers -productVersion) ($(uname -m))"

# 检查 Homebrew
if ! command -v brew &>/dev/null; then
    log_warn "未检测到 Homebrew，正在安装..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    # Apple Silicon 路径处理
    if [[ "$(uname -m)" == "arm64" ]]; then
        eval "$(/opt/homebrew/bin/brew shellenv)"
    fi
    log_info "Homebrew 安装完成"
else
    log_info "Homebrew 已安装: $(brew --version | head -1)"
fi

# 检查 Node.js (>= 22)
if ! command -v node &>/dev/null || [[ $(node -v | sed 's/v//' | cut -d. -f1) -lt 22 ]]; then
    log_warn "Node.js 版本不足或未安装，正在通过 brew 安装 Node.js 22..."
    brew install node@22
    brew link --overwrite node@22
fi
log_info "Node.js: $(node -v)"

# 检查 npx
if ! command -v npx &>/dev/null; then
    log_error "npx 不可用，请检查 Node.js 安装"
    exit 1
fi
log_info "npx: $(npx --version)"

# ---------- 创建必要目录 ----------
log_step "2/7 创建目录结构..."
mkdir -p "$OPENCLAW_INSTALL_DIR"
mkdir -p "$OPENCLAW_CONFIG_DIR"
mkdir -p "$OPENCLAW_LOG_DIR"
mkdir -p "$HOME/.openclaw/scripts"
mkdir -p "$HOME/.openclaw/workspace/skills"
log_info "目录结构创建完成"

# ---------- 安装 OpenClaw ----------
log_step "3/7 安装 OpenClaw CLI..."

if command -v openclaw &>/dev/null; then
    log_info "OpenClaw 已安装: $(openclaw --version 2>/dev/null || echo '版本未知')"
    read -rp "$(echo -e ${YELLOW}检测到已安装的 OpenClaw，是否重新安装？[y/N]: ${NC})" reinstall
    if [[ "$reinstall" =~ ^[Yy]$ ]]; then
        curl -fsSL https://openclaw.ai/install.sh | bash
        log_info "OpenClaw 重新安装完成"
    fi
else
    log_info "正在下载安装 OpenClaw..."
    curl -fsSL https://openclaw.ai/install.sh | bash
    log_info "OpenClaw 安装完成"
fi

# 确保 PATH
if ! grep -q '.local/bin' "$HOME/.zshrc" 2>/dev/null; then
    echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$HOME/.zshrc"
    export PATH="$HOME/.local/bin:$PATH"
    log_info "已将 ~/.local/bin 添加到 PATH"
fi

# ---------- 配置 OpenClaw ----------
log_step "4/7 配置 OpenClaw..."

if [[ ! -f "$OPENCLAW_CONFIG_DIR/openclaw.json" ]]; then
    log_warn "未检测到 OpenClaw 配置文件"
    log_info "请先运行 'openclaw' 完成 onboarding 向导（需要交互式终端）"
    log_info "onboarding 完成后，重新运行本脚本即可自动配置守护进程"
    log_info ""
    log_info "快速 onboarding 命令："
    log_info "  openclaw"
    log_info ""
    log_warn "跳过配置步骤，仅安装守护进程框架..."

    # 创建一个占位配置（用户 onboarding 后会被覆盖）
    cat > "$OPENCLAW_CONFIG_DIR/openclaw.json" << 'PLACEHOLDER'
{
  "gateway": {
    "port": 18789
  }
}
PLACEHOLDER
else
    log_info "配置文件已存在: $OPENCLAW_CONFIG_DIR/openclaw.json"
fi

# ---------- 安装守护进程 (LaunchAgent) ----------
log_step "5/7 配置开机自启守护进程..."

# 查找 openclaw 可执行文件路径
OPENCLAW_BIN=""
if [[ -f "$HOME/.local/bin/openclaw" ]]; then
    OPENCLAW_BIN="$HOME/.local/bin/openclaw"
elif command -v openclaw &>/dev/null; then
    OPENCLAW_BIN="$(which openclaw)"
else
    log_error "找不到 openclaw 可执行文件"
    exit 1
fi

log_info "OpenClaw 路径: $OPENCLAW_BIN"

# 创建 LaunchAgent plist
cat > "$PLIST_FILE" << PLIST_EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.openclaw.gateway</string>

    <key>ProgramArguments</key>
    <array>
        <string>${OPENCLAW_BIN}</string>
        <string>gateway</string>
        <string>start</string>
        <string>--foreground</string>
    </array>

    <key>WorkingDirectory</key>
    <string>${HOME}</string>

    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:${OPENCLAW_INSTALL_DIR}:/opt/homebrew/opt/node@22/bin</string>
        <key>HOME</key>
        <string>${HOME}</string>
    </dict>

    <key>RunAtLoad</key>
    <true/>

    <key>KeepAlive</key>
    <dict>
        <key>SuccessfulExit</key>
        <false/>
        <key>NetworkState</key>
        <true/>
    </dict>

    <key>StandardOutPath</key>
    <string>${OPENCLAW_LOG_DIR}/gateway-stdout.log</string>

    <key>StandardErrorPath</key>
    <string>${OPENCLAW_LOG_DIR}/gateway-stderr.log</string>

    <key>StartInterval</key>
    <integer>300</integer>

    <key>SoftResourceLimits</key>
    <dict>
        <key>NumberOfFiles</key>
        <integer>4096</integer>
    </dict>

    <key>HardResourceLimits</key>
    <dict>
        <key>NumberOfFiles</key>
        <integer>8192</integer>
    </dict>
</dict>
</plist>
PLIST_EOF

log_info "LaunchAgent 配置文件已创建: $PLIST_FILE"

# ---------- 安装健康检查脚本 ----------
log_step "6/7 安装健康检查脚本..."

cat > "$HEALTHCHECK_SCRIPT" << 'HEALTH_EOF'
#!/bin/bash
# OpenClaw 健康检查与自动恢复脚本
# 建议通过 crontab 每 5 分钟运行一次

OPENCLAW_BIN="$HOME/.local/bin/openclaw"
LOG_DIR="$HOME/.openclaw/logs"
HEALTH_LOG="$LOG_DIR/healthcheck.log"
MAX_LOG_LINES=1000
ALERT_EMAIL=""  # 可选：设置邮箱接收告警

mkdir -p "$LOG_DIR"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >> "$HEALTH_LOG"
    # 保持日志文件大小
    if [[ $(wc -l < "$HEALTH_LOG" 2>/dev/null || echo 0) -gt $MAX_LOG_LINES ]]; then
        tail -n $((MAX_LOG_LINES / 2)) "$HEALTH_LOG" > "${HEALTH_LOG}.tmp"
        mv "${HEALTH_LOG}.tmp" "$HEALTH_LOG"
    fi
}

send_alert() {
    local msg="$1"
    log "⚠️  告警: $msg"
    if [[ -n "$ALERT_EMAIL" ]]; then
        echo "$msg" | mail -s "[OpenClaw 告警] $msg" "$ALERT_EMAIL" 2>/dev/null || true
    fi
}

# 检查 openclaw 进程是否存在
check_process() {
    if pgrep -f "openclaw.*gateway" >/dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# 检查 gateway 端口是否在监听
check_port() {
    local port="${1:-18789}"
    if lsof -i ":$port" >/dev/null 2>&1 || \
       nc -z 127.0.0.1 "$port" 2>/dev/null; then
        return 0
    else
        return 1
    fi
}

# 检查磁盘空间
check_disk() {
    local usage
    usage=$(df -h "$HOME" | awk 'NR==2 {print $5}' | tr -d '%')
    if [[ "$usage" -gt 90 ]]; then
        send_alert "磁盘空间不足: ${usage}% 已使用"
        return 1
    fi
    return 0
}

# 主逻辑
main() {
    local port="${1:-18789}"
    local restart_count=0

    # 磁盘检查
    check_disk

    # 进程检查
    if ! check_process; then
        log "❌ OpenClaw 进程不存在，尝试启动..."
        if [[ -x "$OPENCLAW_BIN" ]]; then
            "$OPENCLAW_BIN" gateway start >> "$LOG_DIR/gateway-stdout.log" 2>> "$LOG_DIR/gateway-stderr.log"
            sleep 5
            if check_process; then
                log "✅ OpenClaw 启动成功"
            else
                send_alert "OpenClaw 启动失败，请手动检查"
            fi
        else
            send_alert "openclaw 可执行文件不存在: $OPENCLAW_BIN"
        fi
    fi

    # 端口检查
    if ! check_port "$port"; then
        log "⚠️  Gateway 端口 $port 未响应，尝试重启..."
        "$OPENCLAW_BIN" gateway restart >> "$LOG_DIR/gateway-stdout.log" 2>> "$LOG_DIR/gateway-stderr.log"
        sleep 5
        if check_port "$port"; then
            log "✅ Gateway 重启成功"
        else
            send_alert "Gateway 端口 $port 重启后仍无响应"
        fi
    fi

    log "✅ 健康检查通过 (PID: $(pgrep -f 'openclaw.*gateway' | head -1))"
}

main "$@"
HEALTH_EOF

chmod +x "$HEALTHCHECK_SCRIPT"
log_info "健康检查脚本已安装: $HEALTHCHECK_SCRIPT"

# 设置 crontab（每 5 分钟检查一次）
(crontab -l 2>/dev/null | grep -v "openclaw-healthcheck"; echo "*/5 * * * * $HEALTHCHECK_SCRIPT 18789 >> $OPENCLAW_LOG_DIR/cron.log 2>&1") | crontab -
log_info "已设置 crontab 定时健康检查（每 5 分钟）"

# ---------- 启用 SSH（远程管理） ----------
log_step "7/7 配置远程管理..."

# 检查 SSH 是否已启用
SSH_ENABLED=$(sudo systemsetup -getremotelogin 2>/dev/null | grep -c "On" || echo "0")

if [[ "$SSH_ENABLED" -eq 0 ]]; then
    log_info "正在启用 SSH 远程登录..."
    sudo systemsetup -setremotelogin on 2>/dev/null && log_info "SSH 已启用" || log_warn "SSH 启用失败（可能需要手动在系统设置中开启）"
else
    log_info "SSH 远程登录已启用"
fi

# 显示本机 IP
LOCAL_IP=$(ipconfig getifaddr en0 2>/dev/null || echo "未知")
log_info "本机 IP: $LOCAL_IP"
log_info "远程连接命令: ssh $(whoami)@${LOCAL_IP}"

# ---------- 完成 ----------
echo ""
echo "============================================"
echo -e "${GREEN}  🦞 OpenClaw 无头安装配置完成！${NC}"
echo "============================================"
echo ""
echo -e "${BLUE}📋 安装摘要：${NC}"
echo "  OpenClaw 路径:  $OPENCLAW_BIN"
echo "  配置目录:       $OPENCLAW_CONFIG_DIR"
echo "  日志目录:       $OPENCLAW_LOG_DIR"
echo "  守护进程:       $PLIST_FILE"
echo "  健康检查:       $HEALTHCHECK_SCRIPT"
echo "  Gateway 端口:   $GATEWAY_PORT"
echo ""
echo -e "${BLUE}🚀 后续操作：${NC}"
echo ""
echo "  1️⃣  首次使用 - 完成 onboarding（只需一次）："
echo "     openclaw"
echo ""
echo "  2️⃣  启动守护进程："
echo "     launchctl load -w $PLIST_FILE"
echo ""
echo "  3️⃣  查看运行状态："
echo "     openclaw gateway status"
echo "     launchctl list | grep openclaw"
echo ""
echo "  4️⃣  查看日志："
echo "     tail -f $OPENCLAW_LOG_DIR/gateway-stdout.log"
echo "     tail -f $OPENCLAW_LOG_DIR/gateway-stderr.log"
echo ""
echo "  5️⃣  远程管理（从其他电脑）："
echo "     ssh $(whoami)@${LOCAL_IP}"
echo "     openclaw tui          # 进入交互界面"
echo "     openclaw chat '你好'   # 命令行直接对话"
echo ""
echo "  6️⃣  停止守护进程："
echo "     launchctl unload $PLIST_FILE"
echo ""
echo -e "${GREEN}✅ 配置完成后，Mac mini 无需显示器即可 7×24 小时运行小龙虾！${NC}"
echo ""
