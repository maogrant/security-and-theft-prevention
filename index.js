// HAKIMI DRM PROTOCOL - GITHUB EDITION
jQuery(async function() {
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

    // 安全解密
    function safeDecrypt(base64Str) {
        try {
            return JSON.parse(decodeURIComponent(escape(window.atob(base64Str))));
        } catch (e) { console.error("[Hakimi] Decrypt Fail:", e); return null; }
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
            
            const raw = charObj.creator_notes.split(LOCK_MARKER)[1];
            const decrypted = safeDecrypt(raw);

            if (decrypted) {
                const realData = decrypted.data || decrypted;

                // 2. 修改全局数据库 (内存层)
                // 这一步把空壳替换成真身
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
                    extensions: realData.extensions || {},
                    // 关键：挂载世界书
                    character_book: realData.character_book || realData.world_info,
                    // 抹除锁标记 (保留原始注释)
                    creator_notes: realData.creator_notes || "Decrypted"
                });

                // 3. 强制重载 (让酒馆重新读取内存)
                isReloading = true;
                try {
                    toastr.info("正在解码...", "Hakimi DRM");
                    await context.loadCharacter(charId);
                    toastr.success(`🔓 ${realData.name} 解锁完成`, "Hakimi DRM");
                } catch (e) {
                    console.error("重载失败", e);
                } finally {
                    setTimeout(() => { isReloading = false; }, 1000);
                }
            }
        }
    }

    // 注册监听器
    if (window.eventSource) {
        window.eventSource.on(window.event_types.CHARACTER_SELECTED, () => {
            setTimeout(interceptAndReload, 50);
        });
    }
});