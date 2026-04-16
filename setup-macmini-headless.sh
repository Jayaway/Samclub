#!/bin/bash
# ============================================================
#  🦞 Mac mini 无头运行 OpenClaw（小龙虾）终极版一键脚本
#  版本: 3.0 (融合版)
#
#  功能:
#    1. 系统环境检查与修复 (macOS版本/磁盘/内存/网络)
#    2. Homebrew 安装 (含网络超时重试)
#    3. Node.js 22 安装 (含版本冲突处理)
#    4. OpenClaw 安装与配置
#    5. 电源管理 pmset (永不睡眠 + 断电自启 + Wake-on-LAN)
#    6. 主机名设置 (Bonjour mDNS)
#    7. SSH 远程登录开启
#    8. VNC 屏幕共享开启
#    9. Tailscale 安装与配置 (外网穿透)
#    10. LaunchAgent 守护进程 (开机自启 + 崩溃重启)
#    11. 健康检查脚本 (进程/端口/磁盘监控)
#    12. Shields Up 单向访问控制 (可选)
#    13. 全局验证与诊断报告
#
#  使用:
#    chmod +x setup-macmini-headless.sh
#    ./setup-macmini-headless.sh
#
#  注意:
#    - 首次运行建议在有显示器的环境下执行
#    - Tailscale 登录需要浏览器授权 (会自动弹出)
#    - OpenClaw onboarding 需要交互式终端
# ============================================================

set -uo pipefail
# 注意: 不用 set -e，因为某些命令的失败需要被捕获处理

# ==================== 全局变量 ====================
SCRIPT_VERSION="3.0"
LOG_FILE="/tmp/macmini-headless-setup-$(date +%Y%m%d-%H%M%S).log"
OPENCLAW_BIN=""
OPENCLAW_CONFIG_DIR="$HOME/.openclaw"
OPENCLAW_LOG_DIR="$HOME/.openclaw/logs"
OPENCLAW_SCRIPT_DIR="$HOME/.openclaw/scripts"
LAUNCH_AGENT_DIR="$HOME/Library/LaunchAgents"
PLIST_FILE="$LAUNCH_AGENT_DIR/com.openclaw.gateway.plist"
HEALTHCHECK_SCRIPT="$OPENCLAW_SCRIPT_DIR/openclaw-healthcheck.sh"
GATEWAY_PORT="${GATEWAY_PORT:-18789}"
HOSTNAME="${MACMINI_HOSTNAME:-}"
TAILSCALE_INSTALLED=false
ERRORS_OCCURRED=0
WARNINGS_OCCURRED=0

# ==================== 颜色与日志 ====================
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
BOLD='\033[1m'
NC='\033[0m'

log_info()  { echo -e "${GREEN}[✓]${NC}  $*" | tee -a "$LOG_FILE"; }
log_warn()  { echo -e "${YELLOW}[!]${NC}  $*" | tee -a "$LOG_FILE"; WARNINGS_OCCURRED=$((WARNINGS_OCCURRED + 1)); }
log_error() { echo -e "${RED}[✗]${NC}  $*" | tee -a "$LOG_FILE"; ERRORS_OCCURRED=$((ERRORS_OCCURRED + 1)); }
log_step()  { echo -e "\n${BLUE}${BOLD}[${1}]${NC} ${2}" | tee -a "$LOG_FILE"; }
log_detail(){ echo -e "    ${CYAN}→${NC} $*" | tee -a "$LOG_FILE"; }
log_sep()   { echo -e "${MAGENTA}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}" | tee -a "$LOG_FILE"; }

# ==================== 工具函数 ====================

# 带超时的命令执行
run_with_timeout() {
    local timeout_sec="$1"
    shift
    local cmd="$*"
    local pid

    "$@" &
    pid=$!
    local watcher_pid

    (
        sleep "$timeout_sec"
        if kill -0 "$pid" 2>/dev/null; then
            kill -TERM "$pid" 2>/dev/null
            wait "$pid" 2>/dev/null
            return 124  # timeout
        fi
    ) &
    watcher_pid=$!
    wait "$pid" 2>/dev/null
    local result=$?
    # 清理监控子进程
    kill "$watcher_pid" 2>/dev/null
    wait "$watcher_pid" 2>/dev/null
    return $result
}

# 带重试的函数
run_with_retry() {
    local max_retries="$1"
    local delay="$2"
    local description="$3"
    shift 3
    local attempt=1

    while [ $attempt -le $max_retries ]; do
        log_detail "尝试 $attempt/$max_retries: $description"
        if "$@" 2>&1 | tee -a "$LOG_FILE"; then
            return 0
        fi
        if [ $attempt -lt $max_retries ]; then
            log_detail "等待 ${delay}s 后重试..."
            sleep "$delay"
        fi
        attempt=$((attempt + 1))
    done
    return 1
}

# 检查端口是否被占用
check_port() {
    local port="$1"
    if lsof -i ":$port" >/dev/null 2>&1; then
        return 0  # 被占用
    else
        return 1  # 空闲
    fi
}

# 检查网络连通性
check_network() {
    # 尝试多个 DNS 和 CDN
    local hosts=("8.8.8.8" "1.1.1.1" "114.114.114.114")
    for host in "${hosts[@]}"; do
        if ping -c 1 -W 3 "$host" >/dev/null 2>&1; then
            return 0
        fi
    done
    # ping 可能被禁用，尝试 curl
    if curl -s --connect-timeout 5 https://www.apple.com >/dev/null 2>&1; then
        return 0
    fi
    return 1
}

# 检查 DNS 解析
check_dns() {
    if nslookup github.com >/dev/null 2>&1 || \
       dig github.com +short >/dev/null 2>&1 || \
       host github.com >/dev/null 2>&1; then
        return 0
    fi
    return 1
}

# 检查磁盘空间
check_disk_space() {
    local path="${1:-$HOME}"
    local min_gb="${2:-5}"
    local available_gb

    # 方法 1: 使用 df -g (macOS 专用，输出单位为 GB)
    available_gb=$(df -g "$path" 2>/dev/null | awk 'NR==2 {print $4}' | tr -d 'Gg')
    if [[ -n "$available_gb" ]] && [[ "$available_gb" =~ ^[0-9]+(\.[0-9]+)?$ ]]; then
        if (( $(echo "$available_gb < $min_gb" | bc -l 2>/dev/null || awk "BEGIN{print ($available_gb < $min_gb)}") )); then
            return 1
        fi
        return 0
    fi

    # 方法 2: 使用 df -h (通用，需解析单位)
    local raw_value
    raw_value=$(df -h "$path" 2>/dev/null | awk 'NR==2 {print $4}')
    if [[ -n "$raw_value" ]]; then
        local num unit
        num=$(echo "$raw_value" | grep -oE '[0-9]+(\.[0-9]+)?')
        unit=$(echo "$raw_value" | grep -oE '[A-Za-z]+$')

        case "${unit^^}" in
            T|TB) available_gb=$(awk "BEGIN{printf \"%.1f\", $num * 1024}") ;;
            G|GB) available_gb="$num" ;;
            M|MB) available_gb=$(awk "BEGIN{printf \"%.1f\", $num / 1024}") ;;
            K|KB) available_gb=$(awk "BEGIN{printf \"%.1f\", $num / 1024 / 1024}") ;;
            *)    available_gb="$num" ;;
        esac

        if (( $(awk "BEGIN{print ($available_gb < $min_gb)}") )); then
            return 1
        fi
    fi
    return 0
}

# 请求 sudo 权限并保持
ensure_sudo() {
    if ! sudo -n true 2>/dev/null; then
        log_detail "需要管理员权限，请输入密码..."
        sudo -v
        if [ $? -ne 0 ]; then
            log_error "获取管理员权限失败"
            return 1
        fi
        # 后台保持 sudo
        while true; do sudo -n true 2>/dev/null; sleep 60; kill -0 "$$" || exit; done 2>/dev/null &
    fi
    return 0
}

# ==================== 阶段 0: 启动 ====================
phase_zero_banner() {
    clear
    echo ""
    log_sep
    echo -e "${BOLD}${MAGENTA}  🦞 Mac mini 无头运行 OpenClaw 终极配置脚本 v${SCRIPT_VERSION}${NC}"
    echo -e "${BOLD}${MAGENTA}     融合基础设施层 + OpenClaw 应用层 + 全面异常处理${NC}"
    log_sep
    echo ""
    echo -e "  📋 配置清单:"
    echo -e "    ${CYAN}1.${NC} 系统环境检查与修复"
    echo -e "    ${CYAN}2.${NC} Homebrew 包管理器"
    echo -e "    ${CYAN}3.${NC} Node.js 22"
    echo -e "    ${CYAN}4.${NC} OpenClaw 安装"
    echo -e "    ${CYAN}5.${NC} 电源管理 (永不睡眠 + 断电自启)"
    echo -e "    ${CYAN}6.${NC} 主机名 (Bonjour mDNS)"
    echo -e "    ${CYAN}7.${NC} SSH 远程登录"
    echo -e "    ${CYAN}8.${NC} VNC 屏幕共享"
    echo -e "    ${CYAN}9.${NC} Tailscale 外网穿透"
    echo -e "    ${CYAN}10.${NC} LaunchAgent 守护进程"
    echo -e "    ${CYAN}11.${NC} 健康检查脚本"
    echo -e "    ${CYAN}12.${NC} Shields Up 安全加固"
    echo -e "    ${CYAN}13.${NC} 全局验证与诊断"
    echo ""
    echo -e "  📝 日志文件: ${CYAN}${LOG_FILE}${NC}"
    echo ""

    read -rp "$(echo -e ${YELLOW}按 Enter 开始配置，或 Ctrl+C 取消...${NC} )" _
}

# ==================== 阶段 1: 系统环境检查 ====================
phase_one_system_check() {
    log_step "1/13" "系统环境检查与修复"

    # 1.1 检查 macOS
    log_detail "检查操作系统..."
    if [[ "$(uname)" != "Darwin" ]]; then
        log_error "此脚本仅支持 macOS，当前系统: $(uname)"
        exit 1
    fi

    local macos_version
    macos_version="$(sw_vers -productVersion 2>/dev/null || echo "未知")"
    local macos_build
    macos_build="$(sw_vers -buildVersion 2>/dev/null || echo "未知")"
    local arch
    arch="$(uname -m)"

    log_info "系统: macOS $macos_version ($macos_build) [$arch]"

    # 检查 macOS 版本 (建议 13.0+)
    local major_version
    major_version=$(echo "$macos_version" | cut -d. -f1)
    if [[ -n "$major_version" ]] && [[ "$major_version" -lt 13 ]]; then
        log_warn "macOS 版本较低 ($macos_version)，建议升级到 Ventura (13.0) 或更高版本"
        log_warn "部分功能可能不可用，继续安装..."
    fi

    # 1.2 检查网络
    log_detail "检查网络连通性..."
    if ! check_network; then
        log_error "网络不通！请检查 WiFi/网线连接"
        log_detail "尝试的检测方式: ping 8.8.8.8, ping 1.1.1.1, curl apple.com"
        echo ""
        read -rp "$(echo -e ${YELLOW}网络不通，是否仍要继续？[y/N]: ${NC})" continue_anyway
        if [[ ! "$continue_anyway" =~ ^[Yy]$ ]]; then
            log_error "用户取消，退出"
            exit 1
        fi
    else
        log_info "网络连通性: 正常"
    fi

    # 1.3 检查 DNS
    log_detail "检查 DNS 解析..."
    if ! check_dns; then
        log_warn "DNS 解析异常，可能影响软件下载"
        log_detail "建议: 检查 DNS 设置，或临时使用 8.8.8.8 / 114.114.114.114"
        log_detail "修复命令: sudo networksetup -setdnsservers Wi-Fi 8.8.8.8 114.114.114.114"
    else
        log_info "DNS 解析: 正常"
    fi

    # 1.4 检查磁盘空间
    log_detail "检查磁盘空间..."
    if ! check_disk_space "$HOME" 5; then
        local available
        available=$(df -h "$HOME" | awk 'NR==2 {print $4}')
        log_error "磁盘空间不足！可用: $available，建议至少保留 5GB"
        log_detail "清理建议:"
        log_detail "  - 清空垃圾桶"
        log_detail "  - 删除 ~/Library/Caches 下的缓存"
        log_detail "  - 运行: sudo rm -rf /private/var/log/*.gz"
        exit 1
    else
        local available
        available=$(df -h "$HOME" | awk 'NR==2 {print $4}')
        log_info "磁盘空间: 可用 $available"
    fi

    # 1.5 检查内存
    log_detail "检查系统内存..."
    local total_mem
    total_mem=$(sysctl -n hw.memsize 2>/dev/null | awk '{printf "%.0f", $1/1024/1024/1024}')
    if [[ -n "$total_mem" ]] && [[ "$total_mem" -lt 8 ]]; then
        log_warn "内存仅 ${total_mem}GB，运行 OpenClaw + 大模型可能吃力，建议 16GB+"
    else
        log_info "系统内存: ${total_mem}GB"
    fi

    # 1.6 检查 SIP (System Integrity Protection)
    log_detail "检查 SIP 状态..."
    local sip_status
    sip_status=$(csrutil status 2>&1 | grep -o 'enabled\|disabled' || echo "未知")
    log_info "SIP 状态: $sip_status"

    # 1.7 检查是否有 Xcode Command Line Tools
    log_detail "检查 Xcode CLI Tools..."
    if xcode-select -p &>/dev/null; then
        log_info "Xcode CLI Tools: 已安装"
    else
        log_warn "Xcode CLI Tools 未安装，某些编译操作可能需要"
        log_detail "安装命令: xcode-select --install"
    fi

    # 1.8 获取 sudo 权限
    log_detail "获取管理员权限..."
    if ! ensure_sudo; then
        log_error "无法获取管理员权限，部分功能将不可用"
    else
        log_info "管理员权限: 已获取"
    fi
}

# ==================== 阶段 2: Homebrew ====================
phase_two_homebrew() {
    log_step "2/13" "安装/更新 Homebrew"

    # 检查是否已安装
    if command -v brew &>/dev/null; then
        local brew_version
        brew_version=$(brew --version | head -1)
        log_info "Homebrew 已安装: $brew_version"

        # 检查 brew 是否正常工作
        if ! brew doctor &>/dev/null; then
            log_warn "Homebrew 诊断发现问题，尝试修复..."
            brew doctor 2>&1 | tail -5 | tee -a "$LOG_FILE"
        fi

        # 更新 brew
        log_detail "更新 Homebrew..."
        if ! run_with_timeout 120 brew update 2>&1 | tee -a "$LOG_FILE"; then
            log_warn "Homebrew 更新超时或失败，继续使用当前版本"
        else
            log_info "Homebrew 已更新"
        fi
    else
        log_detail "Homebrew 未安装，正在安装..."
        log_detail "（国内网络可能较慢，如超时请配置代理）"

        # 设置环境变量
        export HOMEBREW_NO_AUTO_UPDATE=1
        export HOMEBREW_NO_INSTALL_CLEANUP=1

        # 尝试使用国内镜像（如果网络不好）
        if ! run_with_timeout 300 /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)" 2>&1 | tee -a "$LOG_FILE"; then
            log_error "Homebrew 安装失败！"
            log_detail "可能原因:"
            log_detail "  1. 网络超时 → 配置代理: export ALL_PROXY=socks5://127.0.0.1:1080"
            log_detail "  2. DNS 问题 → 换 DNS: sudo networksetup -setdnsservers Wi-Fi 8.8.8.8"
            log_detail "  3. 使用国内镜像: https://mirrors.tuna.tsinghua.edu.cn/help/homebrew/"
            log_detail ""
            log_detail "手动安装命令:"
            log_detail '  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"'
            exit 1
        fi

        # Apple Silicon 路径处理
        if [[ "$(uname -m)" == "arm64" ]]; then
            eval "$(/opt/homebrew/bin/brew shellenv)"
            # 写入 zshrc
            if ! grep -q '/opt/homebrew/bin/brew' "$HOME/.zshrc" 2>/dev/null; then
                echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> "$HOME/.zshrc"
            fi
        fi

        log_info "Homebrew 安装完成"
    fi
}

# ==================== 阶段 3: Node.js ====================
phase_three_nodejs() {
    log_step "3/13" "安装/配置 Node.js 22"

    local required_major=22
    local node_version=""
    local node_major=""

    # 检查是否已安装
    if command -v node &>/dev/null; then
        node_version=$(node -v 2>/dev/null | sed 's/v//')
        node_major=$(echo "$node_version" | cut -d. -f1)
        log_info "Node.js 已安装: v$node_version"

        if [[ "$node_major" -ge "$required_major" ]]; then
            log_info "Node.js 版本满足要求 (>= $required_major)"
            return 0
        else
            log_warn "Node.js 版本过低 (v$node_version)，需要 >= $required_major"
            log_detail "将安装 Node.js $required_major..."
        fi
    fi

    # 检查是否有 nvm
    if command -v nvm &>/dev/null || [[ -s "$HOME/.nvm/nvm.sh" ]]; then
        log_detail "检测到 nvm，使用 nvm 安装..."
        export NVM_DIR="$HOME/.nvm"
        [[ -s "$NVM_DIR/nvm.sh" ]] && . "$NVM_DIR/nvm.sh"
        if nvm install "$required_major" 2>&1 | tee -a "$LOG_FILE"; then
            nvm use "$required_major"
            nvm alias default "$required_major"
            log_info "Node.js $required_major 安装完成 (via nvm)"
            return 0
        else
            log_warn "nvm 安装失败，尝试 Homebrew..."
        fi
    fi

    # 使用 Homebrew 安装
    log_detail "通过 Homebrew 安装 Node.js $required_major..."

    # 先检查是否有冲突的 node 版本
    if brew list node 2>/dev/null | grep -q node; then
        log_detail "卸载旧版 node..."
        brew unlink node 2>/dev/null || true
    fi

    if ! brew install "node@${required_major}" 2>&1 | tee -a "$LOG_FILE"; then
        log_error "Node.js $required_major 安装失败！"
        log_detail "替代方案:"
        log_detail "  1. 使用 nvm: curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh | bash"
        log_detail "  2. 官网下载: https://nodejs.org/"
        return 1
    fi

    # 链接
    brew link --overwrite "node@${required_major}" 2>/dev/null || \
        brew link "node@${required_major}" --force 2>/dev/null

    # 验证
    if command -v node &>/dev/null; then
        node_version=$(node -v)
        log_info "Node.js 安装完成: $node_version"
    else
        log_error "Node.js 安装后仍不可用，请检查 PATH"
        log_detail "手动添加: export PATH=\"/opt/homebrew/opt/node@${required_major}/bin:\$PATH\""
        return 1
    fi

    # 检查 npx
    if command -v npx &>/dev/null; then
        log_info "npx: $(npx --version)"
    else
        log_error "npx 不可用！"
        return 1
    fi
}

# ==================== 阶段 4: OpenClaw ====================
phase_four_openclaw() {
    log_step "4/13" "安装/配置 OpenClaw"

    # 创建目录
    mkdir -p "$OPENCLAW_CONFIG_DIR"
    mkdir -p "$OPENCLAW_LOG_DIR"
    mkdir -p "$OPENCLAW_SCRIPT_DIR"
    mkdir -p "$HOME/.openclaw/workspace/skills"

    # 检查是否已安装
    if command -v openclaw &>/dev/null; then
        local version
        version=$(openclaw --version 2>/dev/null || echo "未知")
        log_info "OpenClaw 已安装: $version"

        read -rp "$(echo -e ${YELLOW}检测到已安装的 OpenClaw，是否重新安装？[y/N]: ${NC})" reinstall
        if [[ "$reinstall" =~ ^[Yy]$ ]]; then
            log_detail "正在重新安装 OpenClaw..."
            if ! run_with_timeout 180 curl -fsSL https://openclaw.ai/install.sh | bash 2>&1 | tee -a "$LOG_FILE"; then
                log_error "OpenClaw 安装失败！"
                log_detail "可能原因: 网络超时、DNS 问题、安装脚本变更"
                log_detail "手动安装: curl -fsSL https://openclaw.ai/install.sh | bash"
                return 1
            fi
        fi
    else
        log_detail "正在安装 OpenClaw..."
        log_detail "（首次安装可能需要 1-3 分钟）"

        if ! run_with_timeout 180 curl -fsSL https://openclaw.ai/install.sh | bash 2>&1 | tee -a "$LOG_FILE"; then
            log_error "OpenClaw 安装失败！"
            log_detail "可能原因:"
            log_detail "  1. 网络超时 → 检查网络或配置代理"
            log_detail "  2. DNS 解析失败 → 换 DNS"
            log_detail "  3. 安装脚本 URL 变更 → 访问 https://openclaw.ai 获取最新命令"
            log_detail "手动安装: curl -fsSL https://openclaw.ai/install.sh | bash"
            return 1
        fi
        log_info "OpenClaw 安装完成"
    fi

    # 确保 PATH
    if ! grep -q '.local/bin' "$HOME/.zshrc" 2>/dev/null; then
        echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$HOME/.zshrc"
    fi
    export PATH="$HOME/.local/bin:$PATH"

    # 查找 openclaw 路径
    if [[ -f "$HOME/.local/bin/openclaw" ]]; then
        OPENCLAW_BIN="$HOME/.local/bin/openclaw"
    elif command -v openclaw &>/dev/null; then
        OPENCLAW_BIN="$(which openclaw)"
    else
        log_error "找不到 openclaw 可执行文件！"
        return 1
    fi
    log_info "OpenClaw 路径: $OPENCLAW_BIN"

    # 检查配置文件
    if [[ -f "$OPENCLAW_CONFIG_DIR/openclaw.json" ]]; then
        log_info "配置文件已存在: $OPENCLAW_CONFIG_DIR/openclaw.json"
    else
        log_warn "未检测到 OpenClaw 配置文件"
        log_detail "稍后需要运行 'openclaw' 完成 onboarding 向导"
        log_detail "onboarding 需要交互式终端（选择模型、输入 API Key 等）"
    fi

    # 检查端口冲突
    if check_port "$GATEWAY_PORT"; then
        local occupying_proc
        occupying_proc=$(lsof -i ":$GATEWAY_PORT" | tail -1)
        log_warn "端口 $GATEWAY_PORT 已被占用: $occupying_proc"
        log_detail "OpenClaw gateway 可能无法启动"
        log_detail "解决: 终止占用进程，或修改 GATEWAY_PORT 环境变量后重新运行"
    else
        log_info "Gateway 端口 $GATEWAY_PORT: 空闲"
    fi
}

# ==================== 阶段 5: 电源管理 ====================
phase_five_power() {
    log_step "5/13" "配置电源管理 (pmset)"

    log_detail "当前电源配置:"
    pmset -g 2>&1 | tee -a "$LOG_FILE" | head -10
    echo ""

    log_detail "配置永不睡眠 + 断电自启..."

    # 禁止系统睡眠
    if sudo pmset -a sleep 0 2>&1 | tee -a "$LOG_FILE"; then
        log_info "系统睡眠: 已禁用 (sleep 0)"
    else
        log_error "设置 sleep 0 失败"
    fi

    # 禁止磁盘睡眠
    if sudo pmset -a disksleep 0 2>&1 | tee -a "$LOG_FILE"; then
        log_info "磁盘睡眠: 已禁用 (disksleep 0)"
    else
        log_error "设置 disksleep 0 失败"
    fi

    # 显示器休眠（无显示器无所谓，但设个值避免报错）
    if sudo pmset -a displaysleep 30 2>&1 | tee -a "$LOG_FILE"; then
        log_info "显示器休眠: 30 分钟 (displaysleep 30)"
    else
        log_error "设置 displaysleep 30 失败"
    fi

    # 开启 Wake-on-LAN
    if sudo pmset -a womp 1 2>&1 | tee -a "$LOG_FILE"; then
        log_info "网络唤醒: 已开启 (womp 1)"
    else
        log_warn "Wake-on-LAN 设置失败（部分 Mac 不支持）"
    fi

    # 断电后自动开机
    if sudo pmset -a autorestart 1 2>&1 | tee -a "$LOG_FILE"; then
        log_info "断电自启: 已开启 (autorestart 1)"
    else
        log_error "断电自启设置失败"
    fi

    # 关闭 Power Nap
    if sudo pmset -a powernap 0 2>&1 | tee -a "$LOG_FILE"; then
        log_info "Power Nap: 已关闭 (powernap 0)"
    else
        log_warn "Power Nap 关闭失败（部分 Mac 不支持）"
    fi

    # 验证
    echo ""
    log_detail "验证配置:"
    local sleep_val disksleep_val displaysleep_val womp_val autorestart_val powernap_val
    sleep_val=$(pmset -g | grep -E "sleep\s" | awk '{print $2}' | head -1)
    disksleep_val=$(pmset -g | grep -E "disksleep\s" | awk '{print $2}' | head -1)
    womp_val=$(pmset -g | grep -E "womp\s" | awk '{print $2}' | head -1)
    autorestart_val=$(pmset -g | grep -E "autorestart\s" | awk '{print $2}' | head -1)

    log_detail "  sleep=$sleep_val disksleep=$disksleep_val womp=$womp_val autorestart=$autorestart_val"

    if [[ "$sleep_val" == "0" ]] && [[ "$autorestart_val" == "1" ]]; then
        log_info "电源管理配置: 验证通过 ✅"
    else
        log_warn "电源管理配置可能未完全生效，请运行 'pmset -g' 手动检查"
    fi
}

# ==================== 阶段 6: 主机名 ====================
phase_six_hostname() {
    log_step "6/13" "配置主机名 (Bonjour mDNS)"

    local current_name
    current_name=$(scutil --get LocalHostName 2>/dev/null || echo "未知")
    log_info "当前主机名: $current_name"

    if [[ -n "$HOSTNAME" ]]; then
        log_detail "使用环境变量指定的主机名: $HOSTNAME"
    else
        echo ""
        read -rp "$(echo -e ${YELLOW}请输入主机名（纯英文小写，如 my-mini，直接回车跳过）: ${NC})" HOSTNAME
    fi

    if [[ -n "$HOSTNAME" ]]; then
        # 验证主机名格式
        if ! echo "$HOSTNAME" | grep -qE '^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$'; then
            log_error "主机名格式无效！只允许小写字母、数字和连字符，且不能以连字符开头/结尾"
            log_detail "示例: my-mini, server-01, claw-host"
            return 1
        fi

        # 设置主机名
        sudo scutil --set ComputerName "$HOSTNAME" 2>&1 | tee -a "$LOG_FILE"
        sudo scutil --set LocalHostName "$HOSTNAME" 2>&1 | tee -a "$LOG_FILE"
        sudo scutil --set HostName "$HOSTNAME" 2>&1 | tee -a "$LOG_FILE"

        # 验证
        local new_name
        new_name=$(scutil --get LocalHostName 2>/dev/null)
        if [[ "$new_name" == "$HOSTNAME" ]]; then
            log_info "主机名已设置为: $HOSTNAME"
            log_info "Bonjour 地址: ${HOSTNAME}.local"
            log_detail "以后可以用以下方式连接:"
            log_detail "  SSH:  ssh $(whoami)@${HOSTNAME}.local"
            log_detail "  VNC:  vnc://${HOSTNAME}.local"
        else
            log_error "主机名设置失败（当前: $new_name）"
        fi
    else
        log_info "跳过主机名配置，使用当前名称: $current_name"
        log_detail "后续可用: ssh $(whoami)@${current_name}.local"
    fi
}

# ==================== 阶段 7: SSH ====================
phase_seven_ssh() {
    log_step "7/13" "配置 SSH 远程登录"

    # 检查当前状态
    local ssh_status
    ssh_status=$(sudo systemsetup -getremotelogin 2>/dev/null | grep -o 'On\|Off' || echo "未知")
    log_info "SSH 当前状态: $ssh_status"

    if [[ "$ssh_status" == "On" ]]; then
        log_info "SSH 已开启"
    else
        log_detail "正在开启 SSH..."
        if sudo systemsetup -setremotelogin on 2>&1 | tee -a "$LOG_FILE"; then
            log_info "SSH 已开启"
        else
            log_error "SSH 开启失败！"
            log_detail "手动开启: 系统设置 → 通用 → 共享 → 远程登录 → 开启"
            log_detail "或命令: sudo systemsetup -setremotelogin on"
            return 1
        fi
    fi

    # 检查 SSH 配置安全加固
    local sshd_config="/etc/ssh/sshd_config"
    log_detail "检查 SSH 安全配置..."

    # 检查是否允许密码登录（建议用密钥）
    if sudo grep -q "^PasswordAuthentication yes" "$sshd_config" 2>/dev/null; then
        log_warn "SSH 允许密码登录，建议配置密钥认证更安全"
        log_detail "生成密钥: ssh-keygen -t ed25519"
        log_detail "上传到服务器: ssh-copy-id user@host"
    fi

    # 检查是否禁止 root 登录
    if ! sudo grep -q "^PermitRootLogin no" "$sshd_config" 2>/dev/null; then
        log_warn "建议禁止 root 远程 SSH 登录"
        log_detail "在 $sshd_config 中添加: PermitRootLogin no"
    fi

    # 显示连接信息
    local hostname
    hostname=$(scutil --get LocalHostName 2>/dev/null || echo "$(hostname)")
    local local_ip
    local_ip=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "未知")

    log_info "SSH 连接方式:"
    log_detail "  局域网: ssh $(whoami)@${hostname}.local"
    if [[ "$local_ip" != "未知" ]]; then
        log_detail "  或:     ssh $(whoami)@${local_ip}"
    fi
}

# ==================== 阶段 8: VNC 屏幕共享 ====================
phase_eight_vnc() {
    log_step "8/13" "配置 VNC 屏幕共享"

    # 检查 macOS 版本 (VNC 配置方式因版本而异)
    local macos_major
    macos_major=$(sw_vers -productVersion | cut -d. -f1)

    # 检查当前状态
    log_detail "检查屏幕共享状态..."

    # 方法 1: 使用 screencapturedb (macOS 14+)
    # 方法 2: 使用 defaults
    local screen_sharing_enabled=false

    if sudo launchctl list | grep -q "com.apple.screensharing" 2>/dev/null; then
        screen_sharing_enabled=true
    fi

    # 尝试通过 defaults 检查
    if defaults read /Library/Preferences/com.apple.screensharing 2>/dev/null | grep -q "ScreenSharingEnabled.*1"; then
        screen_sharing_enabled=true
    fi

    if $screen_sharing_enabled; then
        log_info "屏幕共享: 已开启"
    else
        log_detail "正在开启屏幕共享..."

        # macOS Ventura (13) 及以上使用不同的方式
        if [[ "$macos_major" -ge 13 ]]; then
            # 尝试通过 kickstart 启动
            sudo /System/Library/CoreServices/RemoteManagement/ARDAgent.app/Contents/Resources/kickstart \
                -activate -configure -access -on \
                -users $(whoami) -privs -all \
                -restart -agent 2>&1 | tee -a "$LOG_FILE"

            if [ $? -eq 0 ]; then
                log_info "屏幕共享: 已开启 (via kickstart)"
            else
                log_warn "kickstart 方式开启失败，尝试其他方式..."
                # 备用方式
                sudo defaults write /var/db/launchd.db/com.apple.launchd/overrides.plist \
                    com.apple.screensharing -dict Disabled -bool false 2>/dev/null
                sudo launchctl load -w /System/Library/LaunchDaemons/com.apple.screensharing.plist 2>/dev/null
            fi
        else
            # macOS Monterey (12) 及以下
            sudo defaults write /Library/Preferences/com.apple.screensharing ScreenSharingEnabled -bool true 2>/dev/null
            sudo launchctl load -w /System/Library/LaunchDaemons/com.apple.screensharing.plist 2>/dev/null
        fi

        # 最终验证
        sleep 2
        if sudo launchctl list | grep -q "com.apple.screensharing" 2>/dev/null; then
            log_info "屏幕共享: 已开启 ✅"
        else
            log_warn "屏幕共享可能未成功开启"
            log_detail "手动开启: 系统设置 → 通用 → 共享 → 屏幕共享 → 开启"
            log_detail "安全建议: 仅允许特定用户访问，权限设为 观察+控制"
        fi
    fi

    # VNC 密码设置（可选）
    echo ""
    read -rp "$(echo -e ${YELLOW}是否设置 VNC 访问密码？[y/N]（推荐）: ${NC})" set_vnc_pwd
    if [[ "$set_vnc_pwd" =~ ^[Yy]$ ]]; then
        log_detail "设置 VNC 密码..."
        if sudo defaults write /Library/Preferences/com.apple.VNCSettings \
            VNCPassword -string "$(openssl rand -base64 8 | tr -d '=/+')" 2>/dev/null; then
            log_info "VNC 密码已设置（随机生成）"
            log_warn "注意: 如果忘记密码，可在 系统设置→共享→屏幕共享→电脑设置 中查看/修改"
        else
            log_warn "VNC 密码设置失败，可在系统设置中手动设置"
        fi
    fi

    # 显示连接信息
    local hostname
    hostname=$(scutil --get LocalHostName 2>/dev/null || echo "$(hostname)")
    log_info "VNC 连接方式:"
    log_detail "  局域网: vnc://${hostname}.local"
    log_detail "  在 Finder 中: 前往 → 连接服务器 → vnc://${hostname}.local"
}

# ==================== 阶段 9: Tailscale ====================
phase_nine_tailscale() {
    log_step "9/13" "安装/配置 Tailscale (外网穿透)"

    echo ""
    read -rp "$(echo -e ${YELLOW}是否安装 Tailscale？（实现外网远程访问 Mac mini）[Y/n]: ${NC})" install_ts
    if [[ "$install_ts" =~ ^[Nn]$ ]]; then
        SKIP_TAILSCALE=true
        log_info "跳过 Tailscale 安装"
        return 0
    fi

    # 检查是否已安装
    if command -v tailscale &>/dev/null || [[ -d "/Applications/Tailscale.app" ]]; then
        TAILSCALE_INSTALLED=true
        local ts_version
        ts_version=$(tailscale version 2>/dev/null | head -1 || echo "未知")
        log_info "Tailscale 已安装: $ts_version"

        # 检查是否已登录
        local ts_status
        ts_status=$(tailscale status --self 2>/dev/null)
        if [[ -n "$ts_status" ]] && ! echo "$ts_status" | grep -qi "logged out\|not connected"; then
            log_info "Tailscale 已登录"
            local ts_ip
            ts_ip=$(tailscale ip -4 2>/dev/null)
            if [[ -n "$ts_ip" ]]; then
                log_info "Tailscale IP: $ts_ip"
            fi
        else
            log_warn "Tailscale 未登录，需要重新登录"
            log_detail "运行: tailscale up"
            log_detail "（会自动弹出浏览器进行授权）"
        fi

        read -rp "$(echo -e ${YELLOW}是否重新安装 Tailscale？[y/N]: ${NC})" reinstall_ts
        if [[ "$reinstall_ts" =~ ^[Yy]$ ]]; then
            TAILSCALE_INSTALLED=false
        else
            return 0
        fi
    fi

    log_detail "正在下载安装 Tailscale..."

    # 方法 1: 通过官方 PKG 安装
    log_detail "获取最新版本..."

    local pkg_name=""
    local pkg_url=""

    # 尝试获取最新版本
    pkg_name=$(curl -fsSL --connect-timeout 15 --max-time 30 \
        "https://pkgs.tailscale.com/stable/" 2>/dev/null | \
        grep -Eo 'Tailscale-[0-9.]+-macos\.pkg' | head -n1)

    if [[ -n "$pkg_name" ]]; then
        pkg_url="https://pkgs.tailscale.com/stable/${pkg_name}"
        log_detail "下载: $pkg_name"

        if curl -fL --connect-timeout 30 --max-time 300 \
            "$pkg_url" -o "/tmp/$pkg_name" 2>&1 | tee -a "$LOG_FILE"; then

            log_detail "安装 Tailscale..."
            if sudo installer -pkg "/tmp/$pkg_name" -target / 2>&1 | tee -a "$LOG_FILE"; then
                TAILSCALE_INSTALLED=true
                log_info "Tailscale 安装完成"
                # 清理
                rm -f "/tmp/$pkg_name"
            else
                log_error "Tailscale PKG 安装失败"
            fi
        else
            log_error "Tailscale 下载失败"
        fi
    fi

    # 方法 2: 如果 PKG 方式失败，尝试 Homebrew
    if ! $TAILSCALE_INSTALLED; then
        log_detail "尝试通过 Homebrew 安装 Tailscale..."
        if brew install --cask tailscale 2>&1 | tee -a "$LOG_FILE"; then
            TAILSCALE_INSTALLED=true
            log_info "Tailscale 安装完成 (via Homebrew)"
        else
            log_error "Homebrew 安装 Tailscale 也失败了"
            log_detail "替代方案:"
            log_detail "  1. 手动下载: https://tailscale.com/download/mac"
            log_detail "  2. App Store 搜索 Tailscale"
            return 1
        fi
    fi

    # 验证安装
    if [[ -d "/Applications/Tailscale.app" ]]; then
        log_info "Tailscale.app: 已安装"
    else
        log_warn "Tailscale.app 未找到"
    fi

    if command -v tailscale &>/dev/null; then
        log_info "tailscale CLI: $(tailscale version 2>/dev/null | head -1)"
    else
        log_warn "tailscale CLI 不可用，可能需要重启终端"
    fi

    # 登录
    echo ""
    log_detail "接下来需要登录 Tailscale（会弹出浏览器授权页面）"
    log_detail "两台设备（MacBook 和 Mac mini）需要登录同一个 Tailscale 账号"
    read -rp "$(echo -e ${YELLOW}现在登录 Tailscale？[Y/n]: ${NC})" login_ts
    if [[ ! "$login_ts" =~ ^[Nn]$ ]]; then
        log_detail "启动 Tailscale..."
        # 启动 Tailscale.app
        open -a Tailscale 2>/dev/null || true
        sleep 3

        if command -v tailscale &>/dev/null; then
            tailscale up 2>&1 | tee -a "$LOG_FILE"
            sleep 5

            # 验证
            local ts_ip
            ts_ip=$(tailscale ip -4 2>/dev/null)
            if [[ -n "$ts_ip" ]]; then
                log_info "Tailscale 登录成功！"
                log_info "Tailscale IP: $ts_ip"
                log_detail "在外网连接方式:"
                log_detail "  SSH:  ssh $(whoami)@${ts_ip}"
                log_detail "  VNC:  vnc://${ts_ip}"
            else
                log_warn "Tailscale 登录可能未完成，请稍后运行 'tailscale status' 检查"
            fi
        else
            log_warn "tailscale CLI 不可用，请在 Tailscale.app 中手动登录"
        fi
    fi

    # 提示在 MacBook 上也安装
    echo ""
    log_detail "⚠️  记得在你的 MacBook 上也安装并登录 Tailscale（同一个账号）"
    log_detail "MacBook 安装后运行: tailscale up"
    log_detail "然后运行: tailscale status 查看两台设备是否互相可见"
}

# ==================== 阶段 10: LaunchAgent ====================
phase_ten_launchagent() {
    log_step "10/13" "配置 LaunchAgent 守护进程"

    if [[ -z "$OPENCLAW_BIN" ]]; then
        log_error "OpenClaw 未安装，跳过守护进程配置"
        return 1
    fi

    # 停止已有的旧服务
    if launchctl list 2>/dev/null | grep -q "com.openclaw.gateway"; then
        log_detail "检测到已运行的 OpenClaw 守护进程，先停止..."
        launchctl unload "$PLIST_FILE" 2>/dev/null || true
        sleep 2
    fi

    # 确定 Node 路径（OpenClaw 可能依赖 Node）
    local node_path=""
    if [[ -x "/opt/homebrew/opt/node@22/bin/node" ]]; then
        node_path="/opt/homebrew/opt/node@22/bin/node"
    elif [[ -x "/opt/homebrew/bin/node" ]]; then
        node_path="/opt/homebrew/bin/node"
    elif command -v node &>/dev/null; then
        node_path="$(which node)"
    fi

    # 构建 PATH
    local extra_path=""
    if [[ -n "$node_path" ]]; then
        extra_path="$(dirname "$node_path"):"
    fi
    extra_path+="$(dirname "$OPENCLAW_BIN"):/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"

    # 创建 LaunchAgent
    log_detail "创建 LaunchAgent 配置..."
    mkdir -p "$LAUNCH_AGENT_DIR"

    cat > "$PLIST_FILE" << PLIST_EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
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
        <string>${extra_path}</string>
        <key>HOME</key>
        <string>${HOME}</string>
        <key>LANG</key>
        <string>zh_CN.UTF-8</string>
    </dict>

    <key>RunAtLoad</key>
    <true/>

    <key>KeepAlive</key>
    <dict>
        <key>SuccessfulExit</key>
        <false/>
        <key>NetworkState</key>
        <true/>
        <key>PathState</key>
        <dict>
            <key>${OPENCLAW_BIN}</key>
            <true/>
        </dict>
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

    # 验证 plist 格式
    if plutil -lint "$PLIST_FILE" 2>&1 | tee -a "$LOG_FILE"; then
        log_info "LaunchAgent 配置文件: 格式正确"
    else
        log_error "LaunchAgent plist 格式错误！"
        return 1
    fi

    # 加载服务
    log_detail "加载 LaunchAgent 服务..."
    if launchctl load -w "$PLIST_FILE" 2>&1 | tee -a "$LOG_FILE"; then
        log_info "LaunchAgent 已加载（开机自启 + 崩溃重启）"
    else
        log_error "LaunchAgent 加载失败！"
        log_detail "手动加载: launchctl load -w $PLIST_FILE"
        log_detail "查看状态: launchctl list | grep openclaw"
        return 1
    fi

    # 等待并验证
    log_detail "等待服务启动..."
    sleep 5

    if launchctl list 2>/dev/null | grep -q "com.openclaw.gateway"; then
        local pid
        pid=$(launchctl list 2>/dev/null | grep "com.openclaw.gateway" | awk '{print $1}' | grep -E '^[0-9]+$' | head -1)
        if [[ -n "$pid" ]]; then
            log_info "OpenClaw 守护进程运行中 (PID: $pid)"
        else
            log_warn "服务已加载但进程可能未启动，检查日志:"
            log_detail "  tail -f $OPENCLAW_LOG_DIR/gateway-stderr.log"
        fi
    else
        log_warn "服务可能未成功加载"
    fi
}

# ==================== 阶段 11: 健康检查 ====================
phase_eleven_healthcheck() {
    log_step "11/13" "安装健康检查脚本"

    cat > "$HEALTHCHECK_SCRIPT" << 'HEALTH_EOF'
#!/bin/bash
# ============================================================
#  OpenClaw 健康检查与自动恢复脚本 v2.0
#  由 crontab 每 5 分钟调用一次
# ============================================================

OPENCLAW_BIN="$HOME/.local/bin/openclaw"
LOG_DIR="$HOME/.openclaw/logs"
HEALTH_LOG="$LOG_DIR/healthcheck.log"
MAX_LOG_LINES=2000
ALERT_EMAIL="${OPENCLAW_ALERT_EMAIL:-}"
GATEWAY_PORT="${OPENCLAW_GATEWAY_PORT:-18789}"
DISK_WARN_PERCENT=90
MAX_RESTART_PER_HOUR=3
RESTART_COUNT_FILE="$LOG_DIR/.restart_count"

mkdir -p "$LOG_DIR"

# ---------- 日志管理 ----------
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >> "$HEALTH_LOG"
    # 保持日志大小
    local lines
    lines=$(wc -l < "$HEALTH_LOG" 2>/dev/null || echo 0)
    if [[ "$lines" -gt $MAX_LOG_LINES ]]; then
        tail -n $((MAX_LOG_LINES / 2)) "$HEALTH_LOG" > "${HEALTH_LOG}.tmp"
        mv "${HEALTH_LOG}.tmp" "$HEALTH_LOG"
    fi
}

send_alert() {
    local msg="$1"
    log "⚠️  告警: $msg"
    # macOS 通知
    osascript -e "display notification \"$msg\" with title \"OpenClaw 告警\"" 2>/dev/null || true
    # 邮件告警（可选）
    if [[ -n "$ALERT_EMAIL" ]]; then
        echo "$msg" | mail -s "[OpenClaw 告警] $msg" "$ALERT_EMAIL" 2>/dev/null || true
    fi
}

# ---------- 频率限制 ----------
check_restart_rate() {
    local now
    now=$(date +%s)
    local one_hour_ago=$((now - 3600))

    # 清理过期记录
    if [[ -f "$RESTART_COUNT_FILE" ]]; then
        # 只保留最近 1 小时的记录
        awk -v cutoff="$one_hour_ago" '$1 > cutoff {print}' "$RESTART_COUNT_FILE" > "${RESTART_COUNT_FILE}.tmp"
        mv "${RESTART_COUNT_FILE}.tmp" "$RESTART_COUNT_FILE"
    fi

    local count
    count=$(wc -l < "$RESTART_COUNT_FILE" 2>/dev/null || echo 0)

    if [[ "$count" -ge $MAX_RESTART_PER_HOUR ]]; then
        log "❌ 最近 1 小时已重启 $count 次，达到上限，不再自动重启"
        send_alert "OpenClaw 频繁重启（1小时内 $count 次），已暂停自动恢复，请手动检查"
        return 1
    fi
    return 0
}

record_restart() {
    date +%s >> "$RESTART_COUNT_FILE"
}

# ---------- 检查函数 ----------
check_process() {
    pgrep -f "openclaw.*gateway" >/dev/null 2>&1
}

check_port() {
    local port="$1"
    # 方法 1: lsof
    if lsof -i ":$port" >/dev/null 2>&1; then
        return 0
    fi
    # 方法 2: nc
    if nc -z 127.0.0.1 "$port" 2>/dev/null; then
        return 0
    fi
    # 方法 3: curl
    if curl -s --connect-timeout 3 "http://127.0.0.1:$port" >/dev/null 2>&1; then
        return 0
    fi
    return 1
}

check_disk() {
    local usage
    usage=$(df -h "$HOME" | awk 'NR==2 {print $5}' | tr -d '%')
    if [[ "$usage" -gt $DISK_WARN_PERCENT ]]; then
        send_alert "磁盘空间不足: ${usage}% 已使用（阈值: ${DISK_WARN_PERCENT}%）"
        return 1
    fi
    return 0
}

check_memory() {
    local mem_pressure
    mem_pressure=$(memory_pressure 2>/dev/null | grep "System-wide memory free percentage" | awk '{print $NF}' | tr -d '%')
    if [[ -n "$mem_pressure" ]] && [[ "$mem_pressure" -lt 10 ]]; then
        send_alert "内存严重不足: 仅剩 ${mem_pressure}% 可用"
        return 1
    fi
    return 0
}

check_launchagent() {
    launchctl list 2>/dev/null | grep -q "com.openclaw.gateway"
}

# ---------- 主逻辑 ----------
main() {
    local port="${1:-$GATEWAY_PORT}"

    # 1. 磁盘检查
    check_disk

    # 2. 内存检查
    check_memory

    # 3. LaunchAgent 检查
    if ! check_launchagent; then
        log "⚠️  LaunchAgent 未加载，尝试重新加载..."
        launchctl load -w "$HOME/Library/LaunchAgents/com.openclaw.gateway.plist" 2>> "$LOG_DIR/healthcheck-error.log"
        sleep 3
    fi

    # 4. 进程检查
    if ! check_process; then
        log "❌ OpenClaw 进程不存在"

        if ! check_restart_rate; then
            return 1
        fi

        if [[ -x "$OPENCLAW_BIN" ]]; then
            log "🔄 尝试启动 OpenClaw..."
            "$OPENCLAW_BIN" gateway start >> "$LOG_DIR/gateway-stdout.log" 2>> "$LOG_DIR/gateway-stderr.log"
            sleep 8

            if check_process; then
                record_restart
                log "✅ OpenClaw 启动成功"
            else
                send_alert "OpenClaw 启动失败，请手动检查日志"
                log "❌ 启动失败，查看: tail -50 $LOG_DIR/gateway-stderr.log"
            fi
        else
            send_alert "openclaw 可执行文件不存在: $OPENCLAW_BIN"
        fi
    fi

    # 5. 端口检查
    if ! check_port "$port"; then
        log "⚠️  Gateway 端口 $port 未响应"

        if ! check_restart_rate; then
            return 1
        fi

        log "🔄 尝试重启 Gateway..."
        "$OPENCLAW_BIN" gateway restart >> "$LOG_DIR/gateway-stdout.log" 2>> "$LOG_DIR/gateway-stderr.log"
        sleep 8

        if check_port "$port"; then
            record_restart
            log "✅ Gateway 重启成功"
        else
            send_alert "Gateway 端口 $port 重启后仍无响应"
        fi
    fi

    # 6. 最终状态
    local pid
    pid=$(pgrep -f 'openclaw.*gateway' | head -1)
    if [[ -n "$pid" ]]; then
        log "✅ 健康检查通过 (PID: $pid, Port: $port)"
    else
        log "❌ 健康检查未通过"
    fi
}

main "$@"
HEALTH_EOF

    chmod +x "$HEALTHCHECK_SCRIPT"
    log_info "健康检查脚本: $HEALTHCHECK_SCRIPT"

    # 设置 crontab
    log_detail "设置 crontab（每 5 分钟检查一次）..."
    local cron_entry="*/5 * * * * $HEALTHCHECK_SCRIPT $GATEWAY_PORT >> $OPENCLAW_LOG_DIR/cron.log 2>&1"

    # 检查是否已存在
    if crontab -l 2>/dev/null | grep -q "openclaw-healthcheck"; then
        log_detail "crontab 已存在，更新..."
        (crontab -l 2>/dev/null | grep -v "openclaw-healthcheck"; echo "$cron_entry") | crontab -
    else
        (crontab -l 2>/dev/null; echo "$cron_entry") | crontab -
    fi
    log_info "crontab 已设置（每 5 分钟健康检查）"

    # 验证
    if crontab -l 2>/dev/null | grep -q "openclaw-healthcheck"; then
        log_info "crontab 验证: 通过 ✅"
    else
        log_error "crontab 设置失败"
    fi
}

# ==================== 阶段 12: Shields Up ====================
phase_twelve_shields() {
    log_step "12/13" "Shields Up 安全加固（可选）"

    if ! $TAILSCALE_INSTALLED && ! command -v tailscale &>/dev/null; then
        log_info "Tailscale 未安装，跳过 Shields Up 配置"
        return 0
    fi

    echo ""
    log_detail "Shields Up 功能: 开启后，Mac mini 只能被你主动连接"
    log_detail "其他设备无法主动连接到这台 Mac mini（单向访问控制）"
    echo ""
    read -rp "$(echo -e ${YELLOW}是否在 Mac mini 上开启 Shields Up？[y/N]: ${NC})" enable_shields
    if [[ "$enable_shields" =~ ^[Yy]$ ]]; then
        if tailscale set --shields-up=true 2>&1 | tee -a "$LOG_FILE"; then
            log_info "Shields Up: 已开启 🔒"
            log_detail "效果: MacBook → Mac mini ✅ | Mac mini → MacBook ❌"
            log_detail "恢复: tailscale set --shields-up=false"
        else
            log_error "Shields Up 设置失败"
        fi
    else
        log_info "跳过 Shields Up（保持双向访问）"
        log_detail "稍后可手动开启: tailscale set --shields-up=true"
    fi
}

# ==================== 阶段 13: 全局验证 ====================
phase_thirteen_verify() {
    log_step "13/13" "全局验证与诊断报告"

    echo ""
    log_sep
    echo -e "${BOLD}  📊 诊断报告${NC}"
    log_sep

    local all_passed=true

    # 1. macOS
    echo -e "\n${CYAN}▸ 系统环境${NC}"
    local macos_ver
    macos_ver=$(sw_vers -productVersion 2>/dev/null)
    local arch
    arch=$(uname -m)
    echo -e "  macOS: ${macos_ver} [$arch]"

    # 2. 网络
    echo -e "\n${CYAN}▸ 网络状态${NC}"
    if check_network; then
        echo -e "  网络连通: ${GREEN}✅ 正常${NC}"
    else
        echo -e "  网络连通: ${RED}❌ 异常${NC}"
        all_passed=false
    fi

    local local_ip
    local_ip=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "未获取到")
    echo -e "  本机 IP:  $local_ip"

    local hostname
    hostname=$(scutil --get LocalHostName 2>/dev/null || echo "未知")
    echo -e "  主机名:    $hostname ($hostname.local)"

    # 3. SSH
    echo -e "\n${CYAN}▸ SSH 远程登录${NC}"
    local ssh_on
    ssh_on=$(sudo systemsetup -getremotelogin 2>/dev/null | grep -o 'On\|Off')
    if [[ "$ssh_on" == "On" ]]; then
        echo -e "  SSH:       ${GREEN}✅ 已开启${NC}"
        echo -e "  连接:      ssh $(whoami)@${hostname}.local"
    else
        echo -e "  SSH:       ${RED}❌ 未开启${NC}"
        all_passed=false
    fi

    # 4. VNC
    echo -e "\n${CYAN}▸ VNC 屏幕共享${NC}"
    if sudo launchctl list 2>/dev/null | grep -q "com.apple.screensharing"; then
        echo -e "  屏幕共享:  ${GREEN}✅ 已开启${NC}"
        echo -e "  连接:      vnc://${hostname}.local"
    else
        echo -e "  屏幕共享:  ${YELLOW}⚠️  未知/未开启${NC}"
    fi

    # 5. 电源管理
    echo -e "\n${CYAN}▸ 电源管理${NC}"
    local sleep_val disksleep_val autorestart_val womp_val
    sleep_val=$(pmset -g 2>/dev/null | grep " sleep" | awk '{print $2}' | head -1)
    disksleep_val=$(pmset -g 2>/dev/null | grep "disksleep" | awk '{print $2}' | head -1)
    autorestart_val=$(pmset -g 2>/dev/null | grep "autorestart" | awk '{print $2}' | head -1)
    womp_val=$(pmset -g 2>/dev/null | grep " womp" | awk '{print $2}' | head -1)

    [[ "$sleep_val" == "0" ]] && echo -e "  永不睡眠:  ${GREEN}✅${NC}" || echo -e "  永不睡眠:  ${RED}❌ (当前: $sleep_val)${NC}"
    [[ "$disksleep_val" == "0" ]] && echo -e "  磁盘不休眠: ${GREEN}✅${NC}" || echo -e "  磁盘不休眠: ${RED}❌ (当前: $disksleep_val)${NC}"
    [[ "$autorestart_val" == "1" ]] && echo -e "  断电自启:  ${GREEN}✅${NC}" || echo -e "  断电自启:  ${RED}❌ (当前: $autorestart_val)${NC}"
    [[ "$womp_val" == "1" ]] && echo -e "  网络唤醒:  ${GREEN}✅${NC}" || echo -e "  网络唤醒:  ${YELLOW}⚠️  未开启${NC}"

    # 6. Tailscale
    echo -e "\n${CYAN}▸ Tailscale${NC}"
    if command -v tailscale &>/dev/null; then
        local ts_ip
        ts_ip=$(tailscale ip -4 2>/dev/null)
        if [[ -n "$ts_ip" ]]; then
            echo -e "  Tailscale: ${GREEN}✅ 已登录${NC}"
            echo -e "  Tailscale IP: $ts_ip"
            echo -e "  外网 SSH:  ssh $(whoami)@${ts_ip}"
            echo -e "  外网 VNC:  vnc://${ts_ip}"
        else
            echo -e "  Tailscale: ${YELLOW}⚠️  已安装但未登录${NC}"
        fi
    else
        echo -e "  Tailscale: ${YELLOW}⚠️  未安装${NC}"
    fi

    # 7. OpenClaw
    echo -e "\n${CYAN}▸ OpenClaw${NC}"
    if command -v openclaw &>/dev/null; then
        echo -e "  OpenClaw: ${GREEN}✅ 已安装${NC} ($(openclaw --version 2>/dev/null || echo '?'))"
    else
        echo -e "  OpenClaw: ${RED}❌ 未安装${NC}"
        all_passed=false
    fi

    # 8. LaunchAgent
    echo -e "\n${CYAN}▸ 守护进程${NC}"
    if launchctl list 2>/dev/null | grep -q "com.openclaw.gateway"; then
        local la_pid
        la_pid=$(launchctl list 2>/dev/null | grep "com.openclaw.gateway" | awk '{print $1}' | grep -E '^[0-9]+$' | head -1)
        if [[ -n "$la_pid" ]]; then
            echo -e "  LaunchAgent: ${GREEN}✅ 运行中 (PID: $la_pid)${NC}"
        else
            echo -e "  LaunchAgent: ${YELLOW}⚠️  已加载但进程未运行${NC}"
        fi
    else
        echo -e "  LaunchAgent: ${RED}❌ 未加载${NC}"
        all_passed=false
    fi

    # 9. 健康检查
    echo -e "\n${CYAN}▸ 健康检查${NC}"
    if crontab -l 2>/dev/null | grep -q "openclaw-healthcheck"; then
        echo -e "  Cron:       ${GREEN}✅ 已设置（每 5 分钟）${NC}"
    else
        echo -e "  Cron:       ${RED}❌ 未设置${NC}"
    fi

    # 10. 磁盘
    echo -e "\n${CYAN}▸ 磁盘空间${NC}"
    local disk_info
    disk_info=$(df -h "$HOME" | awk 'NR==2 {printf "已用: %s / %s (%s)", $3, $2, $5}')
    echo -e "  $disk_info"

    # 总结
    echo ""
    log_sep
    if $all_passed; then
        echo -e "${GREEN}${BOLD}  🎉 所有核心配置验证通过！${NC}"
    else
        echo -e "${YELLOW}${BOLD}  ⚠️  部分配置需要关注，请查看上方报告${NC}"
    fi
    echo -e "${RED}  错误: $ERRORS_OCCURRED  ${YELLOW}警告: $WARNINGS_OCCURRED${NC}"
    log_sep

    # 最终提示
    echo ""
    echo -e "${BOLD}  📋 后续操作清单${NC}"
    echo ""
    echo -e "  ${CYAN}1.${NC} 完成 OpenClaw onboarding（首次必须，交互式终端）:"
    echo -e "      ${GREEN}openclaw${NC}"
    echo ""
    echo -e "  ${CYAN}2.${NC} 重启守护进程（onboarding 完成后）:"
    echo -e "      ${GREEN}launchctl unload ~/Library/LaunchAgents/com.openclaw.gateway.plist${NC}"
    echo -e "      ${GREEN}launchctl load -w ~/Library/LaunchAgents/com.openclaw.gateway.plist${NC}"
    echo ""
    echo -e "  ${CYAN}3.${NC} 在 MacBook 上安装 Tailscale（如未安装）:"
    echo -e "      ${GREEN}brew install --cask tailscale && tailscale up${NC}"
    echo ""
    echo -e "  ${CYAN}4.${NC} 验证远程连接:"
    echo -e "      局域网: ${GREEN}ssh $(whoami)@${hostname}.local${NC}"
    if command -v tailscale &>/dev/null; then
        local ts_ip
        ts_ip=$(tailscale ip -4 2>/dev/null)
        if [[ -n "$ts_ip" ]]; then
            echo -e "      外网:   ${GREEN}ssh $(whoami)@${ts_ip}${NC}"
        fi
    fi
    echo ""
    echo -e "  ${CYAN}5.${NC} 常用管理命令:"
    echo -e "      查看状态:  ${GREEN}openclaw gateway status${NC}"
    echo -e "      查看日志:  ${GREEN}tail -f ~/.openclaw/logs/gateway-stdout.log${NC}"
    echo -e "      健康日志:  ${GREEN}tail -f ~/.openclaw/logs/healthcheck.log${NC}"
    echo -e "      重启服务:  ${GREEN}openclaw gateway restart${NC}"
    echo -e "      修复配置:  ${GREEN}openclaw doctor --fix${NC}"
    echo ""
    echo -e "  ${CYAN}6.${NC} 日志文件位置:"
    echo -e "      ${GREEN}~/.openclaw/logs/${NC}"
    echo ""
    echo -e "  ${CYAN}7.${NC} 配置完成后，可以:"
    echo -e "      ✅ 拔掉显示器"
    echo -e "      ✅ 拔掉键盘鼠标"
    echo -e "      ✅ 只保留电源线和网线"
    echo -e "      ✅ Mac mini 7×24 无头运行小龙虾 🦞"
    echo ""
}

# ==================== 主函数 ====================
main() {
    # 初始化日志
    echo "Mac mini 无头配置脚本 v${SCRIPT_VERSION} - $(date)" > "$LOG_FILE"
    echo "========================================" >> "$LOG_FILE"

    phase_zero_banner

    # 阶段 1: 系统检查（必须通过）
    phase_one_system_check
    if [[ $ERRORS_OCCURRED -gt 0 ]]; then
        echo ""
        log_error "系统环境检查未通过，请先解决上述问题后重新运行"
        exit 1
    fi

    # 阶段 2-3: 基础环境（Homebrew + Node.js）
    phase_two_homebrew
    phase_three_nodejs

    # 阶段 4: OpenClaw 安装（后续阶段依赖此步骤）
    phase_four_openclaw
    if [[ -z "$OPENCLAW_BIN" ]]; then
        echo ""
        log_error "OpenClaw 未成功安装，守护进程和健康检查将跳过"
        log_detail "请手动安装 OpenClaw 后重新运行本脚本"
        # 继续执行基础设施配置（电源、SSH、VNC、Tailscale）
        OPENCLAW_SKIP=true
    else
        OPENCLAW_SKIP=false
    fi

    # 阶段 5-9: 基础设施配置（不依赖 OpenClaw）
    phase_five_power
    phase_six_hostname
    phase_seven_ssh
    phase_eight_vnc
    phase_nine_tailscale

    # 阶段 10-12: OpenClaw 相关（需要 OpenClaw 已安装）
    if [[ "$OPENCLAW_SKIP" != "true" ]]; then
        phase_ten_launchagent
        phase_eleven_healthcheck
    else
        echo ""
        log_warn "跳过 LaunchAgent 和健康检查配置（OpenClaw 未安装）"
    fi

    phase_twelve_shields

    # 阶段 13: 验证报告（始终执行）
    phase_thirteen_verify

    echo ""
    echo -e "  📝 完整日志已保存: ${CYAN}${LOG_FILE}${NC}"
    echo ""
}

# 运行
main "$@"
