// HAKIMI DRM PROTOCOL - GITHUB EDITION
(function() {
    // 依赖检查
    if (typeof jQuery === 'undefined') {
        console.error("[Hakimi] 缺少 jQuery 依赖");
        return;
    }
    
    jQuery(async function() {
        // 检查核心依赖
        if (typeof SillyTavern === 'undefined') {
            console.error("[Hakimi] 缺少 SillyTavern 依赖");
            return;
        }
        if (typeof toastr === 'undefined') {
            console.warn("[Hakimi] toastr 未加载，将使用 console 替代");
        }
        
        console.log("🐱 [Hakimi] 插件已从 GitHub 加载！");

    // 1. 挂载视觉指示器 (证明插件活着)
    const indicator = document.createElement('div');
    indicator.id = 'hakimi-indicator';
    document.body.appendChild(indicator);
    
    // 弹窗提示一次 (确认安装成功)
    if (!localStorage.getItem('hakimi_installed_alert')) {
        alert("✅ 哈基米防盗插件安装成功！\n屏幕顶部的绿条代表卫兵已就位。");
        localStorage.setItem('hakimi_installed_alert', 'true');
    }

    const LOCK_MARKER = "HAKIMI_LOCK_V2::"; 
    let isReloading = false; // 防死循环锁

    // 安全解密 (必须与加密端 btoa(unescape(encodeURIComponent())) 对应)
    function safeDecrypt(base64Str) {
        try {
            if (!base64Str || typeof base64Str !== 'string') return null;
            // 与加密端对应: btoa(unescape(encodeURIComponent(str)))
            // 解密: decodeURIComponent(escape(atob(str)))
            const decoded = decodeURIComponent(escape(window.atob(base64Str)));
            console.log("[Hakimi] 解密成功，数据长度:", decoded.length);
            return JSON.parse(decoded);
        } catch (e) { 
            console.error("[Hakimi] Decrypt Fail:", e); 
            return null; 
        }
    }

    // 验证解密数据结构
    function validateDecryptedData(data) {
        if (!data || typeof data !== 'object') return false;
        const realData = data.data || data;
        // 至少需要 name 字段
        return realData && typeof realData.name === 'string';
    }

    // 安全的 toastr 调用
    function safeToast(type, message, title) {
        if (typeof toastr !== 'undefined' && toastr[type]) {
            toastr[type](message, title);
        } else {
            console.log(`[${title}] ${message}`);
        }
    }

    // 核心拦截重载逻辑
    async function interceptAndReload() {
        if (isReloading) return; // 如果正在重载，跳过

        const context = SillyTavern.getContext();
        const charId = context.characterId;
        
        if (!charId || !context.characters[charId]) return;

        const charObj = context.characters[charId];

        // 检查加密锁
        if (charObj.creator_notes && charObj.creator_notes.includes(LOCK_MARKER)) {
            console.log("🔒 [Hakimi] 发现加密卡，启动拦截...");
            
            const parts = charObj.creator_notes.split(LOCK_MARKER);
            if (parts.length < 2 || !parts[1]) {
                console.warn("[Hakimi] 加密数据格式无效");
                return;
            }
            const raw = parts[1].trim();
            const decrypted = safeDecrypt(raw);

            if (decrypted && validateDecryptedData(decrypted)) {
                const realData = decrypted.data || decrypted;
                console.log("[Hakimi] 解密数据结构:", Object.keys(realData));

                // 2. 修改全局数据库 (内存层)
                // 这一步把空壳替换成真身 - 复制所有关键字段
                Object.assign(charObj, {
                    name: realData.name,
                    description: realData.description,
                    personality: realData.personality,
                    first_mes: realData.first_mes,
                    mes_example: realData.mes_example,
                    scenario: realData.scenario,
                    system_prompt: realData.system_prompt,
                    post_history_instructions: realData.post_history_instructions,
                    tags: realData.tags,
                    // 保留原始扩展并合并（包含正则表达式等）
                    extensions: { ...charObj.extensions, ...(realData.extensions || {}) },
                    // 关键：挂载世界书
                    character_book: realData.character_book || realData.world_info,
                    // 备选开场白
                    alternate_greetings: realData.alternate_greetings || [],
                    // 元数据
                    creator: realData.creator,
                    character_version: realData.character_version,
                    // 抹除锁标记 (保留原始注释)
                    creator_notes: realData.creator_notes || "Decrypted by Hakimi"
                });
                
                // 如果有 data 层，也同步更新
                if (charObj.data) {
                    Object.assign(charObj.data, {
                        name: realData.name,
                        description: realData.description,
                        personality: realData.personality,
                        first_mes: realData.first_mes,
                        mes_example: realData.mes_example,
                        scenario: realData.scenario,
                        system_prompt: realData.system_prompt,
                        post_history_instructions: realData.post_history_instructions,
                        tags: realData.tags,
                        extensions: { ...charObj.data.extensions, ...(realData.extensions || {}) },
                        character_book: realData.character_book || realData.world_info,
                        alternate_greetings: realData.alternate_greetings || [],
                        creator: realData.creator,
                        character_version: realData.character_version,
                        creator_notes: realData.creator_notes || "Decrypted by Hakimi"
                    });
                }
                
                console.log("[Hakimi] 内存数据已替换，角色名:", realData.name);

                // 3. 强制重载 (让酒馆重新读取内存)
                isReloading = true;
                try {
                    safeToast('info', "正在解码...", "Hakimi DRM");
                    await context.loadCharacter(charId);
                    safeToast('success', `🔓 ${realData.name} 解锁完成`, "Hakimi DRM");
                } catch (e) {
                    console.error("[Hakimi] 重载失败", e);
                    safeToast('error', "角色重载失败", "Hakimi DRM");
                } finally {
                    // 等待 DOM 更新完成后再解锁
                    requestAnimationFrame(() => {
                        setTimeout(() => { isReloading = false; }, 500);
                    });
                }
            }
        }
    }

    // 注册监听器
    if (window.eventSource && window.event_types?.CHARACTER_SELECTED) {
        window.eventSource.on(window.event_types.CHARACTER_SELECTED, () => {
            setTimeout(interceptAndReload, 50);
        });
        console.log("[Hakimi] 事件监听器已注册");
    } else {
        console.warn("[Hakimi] eventSource 或 event_types 不可用，监听器未注册");
    }
    });
})();