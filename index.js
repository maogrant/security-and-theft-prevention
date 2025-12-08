// HAKIMI DRM PROTOCOL - v12.0 (Overwrite & Save)
jQuery(async function() {
    console.log("🐱 [Hakimi v12] 覆写式卫兵已就位");

    // 挂载视觉指示器
    if (!document.getElementById('hakimi-indicator')) {
        const indicator = document.createElement('div');
        indicator.id = 'hakimi-indicator';
        Object.assign(indicator.style, {
            position: 'fixed', top: '0', left: '0', width: '100%', height: '3px',
            background: '#00ff9d', zIndex: '99999', boxShadow: '0 0 10px #00ff9d', pointerEvents: 'none'
        });
        document.body.appendChild(indicator);
    }

    const LOCK_MARKER = "HAKIMI_LOCK_V2::"; 
    let isProcessing = false;

    function safeDecrypt(base64Str) {
        try {
            return JSON.parse(decodeURIComponent(escape(window.atob(base64Str))));
        } catch (e) { console.error("[Hakimi] Decrypt Error:", e); return null; }
    }

    // 暴力刷新 UI (视觉层)
    function bruteForceUI(data) {
        function fill(id, val) {
            const el = document.querySelector(id);
            if (el && val) {
                el.value = val;
                $(el).trigger('input').trigger('change');
            }
        }
        fill('#description_textarea', data.description);
        fill('#first_message_textarea', data.first_mes);
        fill('#personality_textarea', data.personality);
        fill('#scenario_textarea', data.scenario);
        fill('#mes_example_textarea', data.mes_example);
        fill('#system_prompt_textarea', data.system_prompt);
        
        if(document.querySelector('.character-name')) 
            document.querySelector('.character-name').textContent = data.name;
    }

    async function runProtocol() {
        if (isProcessing) return; // 锁住防止递归

        const context = SillyTavern.getContext();
        const charId = context.characterId;
        if (!charId) return;

        const charObj = context.characters[charId];
        if (!charObj) return;

        // 1. 检查锁
        if (charObj.creator_notes && charObj.creator_notes.includes(LOCK_MARKER)) {
            console.log("🔒 [Hakimi] 发现加密体，开始覆写程序...");
            isProcessing = true;

            try {
                const raw = charObj.creator_notes.split(LOCK_MARKER)[1];
                const decrypted = safeDecrypt(raw);

                if (decrypted) {
                    const realData = decrypted.data || decrypted;
                    
                    toastr.info("正在解密并写入数据...", "Hakimi v12");

                    // 2. 内存数据全量替换
                    // 这一步是为了让 saveCharacter 知道要存什么
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
                        
                        // 关键：正则扩展
                        extensions: realData.extensions || {},
                        
                        // 关键：世界书
                        // 如果有 character_book，必须赋值给 charObj
                        character_book: realData.character_book || realData.world_info,
                        
                        // 去掉锁标记，防止下次再触发
                        creator_notes: realData.creator_notes || "Decrypted by Hakimi"
                    });
                    
                    // 兼容处理：确保 data 子对象也同步（某些旧逻辑读这里）
                    charObj.data = charObj.data || {};
                    Object.assign(charObj.data, charObj);

                    // 3. 💾【核弹级操作】强制保存回硬盘
                    // 我们直接调用酒馆的 saveCharacter API
                    // 这会用解密后的真数据，覆盖掉硬盘上那个 LOCKED 文件
                    await context.saveCharacter(charId, charObj);
                    console.log("💾 [Hakimi] 已将解密数据写入硬盘");

                    // 4. 🚑 暴力刷新 UI (为了让人设立刻显示)
                    bruteForceUI(realData);

                    // 5. 🔄 强制重载 (让酒馆去读刚才写入的新文件)
                    // 这一次，硬盘上的文件已经是真的了，所以正则和世界书一定会被加载！
                    await context.loadCharacter(charId);
                    
                    toastr.success(`🔓 ${realData.name} 永久解密完成！`, "Hakimi");

                }
            } catch (e) {
                console.error("Hakimi Protocol Failed:", e);
                toastr.error("解密流程出错", "Hakimi Error");
            } finally {
                setTimeout(() => { isProcessing = false; }, 2000);
            }
        }
    }

    // 注册监听
    if (window.eventSource) {
        // 监听“加载完毕”事件 (比 Selected 更靠后，此时空壳已准备好被宰割)
        window.eventSource.on(window.event_types.CHARACTER_LOADED, () => {
            setTimeout(runProtocol, 200);
        });
        
        // 监听“选择”事件 (双保险)
        window.eventSource.on(window.event_types.CHARACTER_SELECTED, () => {
            setTimeout(runProtocol, 200);
        });
    }
});});
